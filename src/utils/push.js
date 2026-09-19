import { supabase } from "../lib/supabase";
import { requestNotificationPermission } from "../hooks/useNotifications";
import { addNotification } from "../hooks/useNotificationStore";

const VAPID_PUBLIC_KEY = "BCLIfy6xHabWEamC07LKr_JUqxOTkLQ5H4zRoCNbFZppNdMUvri2g25nwuiDg2RP5-UfeoxrJg2QCz3NEuKQ3jE";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window;
}

/**
 * subscribeToPush — demande la permission, obtient/crée la souscription
 * navigateur, puis l'enregistre dans Supabase.
 *
 * Stratégie Supabase : DELETE puis INSERT (pas d'upsert) pour éviter
 * d'accumuler des lignes en cas de changement d'endpoint par le navigateur
 * et sans avoir besoin de contrainte UNIQUE sur la table.
 *
 * Retourne { ok, reason? }.
 */
export async function subscribeToPush(userId) {
  if (!isPushSupported())
    return { ok: false, reason: "Les notifications push ne sont pas supportées sur ce navigateur/appareil." };
  if (!userId)
    return { ok: false, reason: "Utilisateur non connecté." };

  // ── 1. Permission navigateur ─────────────────────────────────────────────
  const granted = await requestNotificationPermission();
  if (!granted) return { ok: false, reason: "Permission refusée par le navigateur." };

  // ── 2. Service Worker ────────────────────────────────────────────────────
  let registration;
  try {
    registration = await navigator.serviceWorker.ready;
  } catch {
    return { ok: false, reason: "Le Service Worker n'est pas disponible (essaie de recharger la page)." };
  }

  // ── 3. Souscription navigateur (réutilise si elle existe déjà) ──────────
  let subscription;
  try {
    subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly:      true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
  } catch (err) {
    console.error("Échec de l'abonnement push :", err);
    return { ok: false, reason: `Échec de l'abonnement navigateur : ${err.message || err}` };
  }

  const raw = subscription.toJSON();

  // ── 4. Supabase : supprime les anciennes lignes de cet utilisateur ───────
  //    (endpoint périmé, changement de navigateur, etc.)
  //    puis insère la souscription courante.
  //    On évite intentionnellement upsert+onConflict qui requiert une
  //    contrainte UNIQUE côté SQL pas forcément présente.
  await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", userId);

  const { error } = await supabase.from("push_subscriptions").insert({
    user_id:  userId,
    endpoint: raw.endpoint,
    p256dh:   raw.keys.p256dh,
    auth:     raw.keys.auth,
  });

  if (error) {
    console.error("Impossible d'enregistrer l'abonnement push :", error);
    const reason = /relation .* does not exist/i.test(error.message)
      ? "La table push_subscriptions n'existe pas encore côté Supabase — exécute le script SQL avant de réessayer."
      : `Échec de l'enregistrement : ${error.message}`;
    return { ok: false, reason };
  }

  return { ok: true };
}

/**
 * syncSubscription — re-synchronise silencieusement une souscription
 * navigateur existante avec Supabase, sans demander de permission.
 * Appelé au démarrage de l'app pour ne pas avoir à toggler les notifs.
 */
export async function syncSubscription(userId) {
  if (!userId || !isPushSupported()) return;
  if (Notification.permission !== "granted") return;
  if (localStorage.getItem("pref_notifications") === "false") return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    // ── Cas : le navigateur a perdu la souscription (après déploiement,
    //    update du SW, rotation automatique…).
    //    Si la pref est active et la permission accordée → on re-souscrit
    //    silencieusement, sans demander quoi que ce soit à l'utilisateur.
    if (!subscription) {
      await subscribeToPush(userId);
      return;
    }

    const raw = subscription.toJSON();

    // Vérifie si Supabase a déjà la bonne ligne
    const { data } = await supabase
      .from("push_subscriptions")
      .select("endpoint")
      .eq("user_id", userId)
      .eq("endpoint", raw.endpoint)
      .maybeSingle();

    if (data) return; // déjà à jour

    // Ligne absente ou obsolète → on réécrit
    await supabase.from("push_subscriptions").delete().eq("user_id", userId);
    await supabase.from("push_subscriptions").insert({
      user_id:  userId,
      endpoint: raw.endpoint,
      p256dh:   raw.keys.p256dh,
      auth:     raw.keys.auth,
    });
  } catch {
    // silencieux
  }
}

// ── Rattrapage des notifications manquées (app fermée au moment du push) ────
//
// La fonction Edge notify-episodes insère une ligne dans `sent_notifications`
// (user_id, entry_key, episode, sent_at) AVANT d'envoyer le push. Cette table
// ne contient pas de titre/body : on les reconstruit ici à partir de `entries`
// (bibliothèque locale), en reproduisant la construction de `entry_key` faite
// côté edge function (`${source}_${id}`).
const LAST_SYNC_KEY = "anivault:notif-last-sync";

/**
 * markNotificationsSyncedNow — avance le curseur "dernier sync" à l'instant
 * présent. À appeler dès qu'une notif est reçue EN DIRECT (app ouverte, SW
 * message), pour que le prochain `syncMissedNotifications` (au lancement
 * suivant) ne la re-fetch pas depuis `sent_notifications` et ne l'affiche
 * pas une seconde fois.
 *
 * Sans ça : une notif reçue en direct à 10h n'avance jamais ce curseur ;
 * s'il est resté à 9h (dernier sync du matin), rouvrir l'app le soir relance
 * syncMissedNotifications avec `since = 9h`, qui re-découvre la ligne de
 * 10h et la réaffiche — d'où le doublon "Programme du jour" remonté ici.
 */
export function markNotificationsSyncedNow() {
  localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
}

function buildEntryKey(entry) {
  if (entry.source === "anilist" && entry.anilistIds?.length) {
    return `anilist_${entry.anilistIds[entry.anilistIds.length - 1]}`;
  }
  if (entry.source === "tvmaze" && entry.tvmazeId) {
    return `tvmaze_${entry.tvmazeId}`;
  }
  return null;
}

/**
 * syncMissedNotifications — va chercher dans `sent_notifications` tout ce
 * qui a été envoyé depuis le dernier passage, et réinjecte ça dans le store
 * local (NotificationPanel) via addNotification. Le dedupeKey utilisé ici
 * (`${entry.id}-ep${episode}`) est identique à celui utilisé pour les push
 * reçus app ouverte (App.jsx), donc pas de doublon si les deux mécanismes
 * se chevauchent.
 */
export async function syncMissedNotifications(userId, entries = []) {
  if (!userId) return;

  const since = localStorage.getItem(LAST_SYNC_KEY) || new Date(0).toISOString();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("sent_notifications")
    .select("entry_key, episode, sent_at")
    .eq("user_id", userId)
    .gt("sent_at", since)
    .order("sent_at", { ascending: true });

  if (error) {
    console.error("Échec de la récupération des notifications manquées :", error);
    return;
  }

  data?.forEach((row) => {
    // Alertes de streak (fonction Edge streak-alert) : pas d'entry associée,
    // entry_key vaut toujours "streak-alert" — traitement à part.
    if (row.entry_key === "streak-alert") {
      addNotification({
        title: "Ta streak était en danger 🔥",
        body: "Tu as reçu une alerte pendant que l'app était fermée.",
        icon: "flame",
        dedupeKey: row.entry_key,
      });
      return;
    }

    // Récap hebdo (fonction Edge weekly-summary) : idem, pas d'entry associée.
    // On ne reconstruit pas les stats ici (coûteux et déjà périmé) — on
    // renvoie juste vers le panel pour inciter à ouvrir l'app.
    if (row.entry_key === "weekly-summary") {
      addNotification({
        title: "Ton récap de la semaine 📊",
        body: "Ouvre l'app pour voir ton récap complet.",
        icon: "bar-chart",
        dedupeKey: row.entry_key,
      });
      return;
    }

    // Programme du jour (fonction Edge daily-digest) : idem.
    if (row.entry_key === "daily-digest") {
      addNotification({
        title: "📺 Programme du jour",
        body: "Ouvre l'app pour voir ce qui sort aujourd'hui.",
        icon: "calendar-days",
        dedupeKey: row.entry_key,
      });
      return;
    }

    // Rappel d'inactivité globale (fonction Edge inactivity-reminder).
    if (row.entry_key === "inactivity-reminder") {
      addNotification({
        title: "On ne t'a pas vu récemment 👋",
        body: "Ta bibliothèque t'attend — un petit épisode ce soir ?",
        icon: "moon",
        dedupeKey: row.entry_key,
      });
      return;
    }

    // "Bientôt terminé" (fonction Edge episode-soon-finishing) : liée à une
    // entry, mais avec un entry_key préfixé ("finishing_anilist_123_24"),
    // donc pas de match direct via buildEntryKey.
    if (row.entry_key.startsWith("finishing_")) {
      const key = row.entry_key.replace(/^finishing_/, "").replace(/_\d+$/, "");
      const entry = entries.find((e) => buildEntryKey(e) === key);
      addNotification({
        title: "Bientôt la fin ! 🏁",
        body: entry ? `Tu approches de la fin de ${entry.title}.` : "Une de tes séries touche à sa fin.",
        entryId: entry?.id ?? null,
        icon: "flag",
        dedupeKey: row.entry_key,
      });
      return;
    }

    // "Nouvelle saison" (fonction Edge new-season-check).
    if (row.entry_key.startsWith("newseason_")) {
      const key = row.entry_key.replace(/^newseason_/, "");
      const entry = entries.find((e) => buildEntryKey(e) === key);
      addNotification({
        title: "Nouvelle saison ! ✨",
        body: entry ? `Une suite à ${entry.title} est disponible.` : "Une suite est disponible sur une de tes séries.",
        entryId: entry?.id ?? null,
        icon: "sparkles",
        dedupeKey: row.entry_key,
      });
      return;
    }

    // "Entrée oubliée" (fonction Edge stalled-entry).
    if (row.entry_key.startsWith("stalled_")) {
      const key = row.entry_key.replace(/^stalled_/, "");
      const entry = entries.find((e) => buildEntryKey(e) === key);
      addNotification({
        title: "Ça prend la poussière 📺",
        body: entry ? `Ça fait un moment que tu n'as pas avancé sur ${entry.title}.` : "Une de tes séries n'a pas bougé depuis un moment.",
        entryId: entry?.id ?? null,
        icon: "clock",
        dedupeKey: `${row.entry_key}-${row.sent_at}`,
      });
      return;
    }

    const entry = entries.find((e) => buildEntryKey(e) === row.entry_key);
    const body  = entry
      ? `${entry.title} — Épisode ${row.episode} disponible !`
      : `Épisode ${row.episode} disponible !`;

    addNotification({
      title: "Prépare toi !",
      body,
      entryId: entry?.id ?? null,
      icon: "sparkles",
      dedupeKey: entry ? `${entry.id}-ep${row.episode}` : `${row.entry_key}-ep${row.episode}`,
    });
  });

  localStorage.setItem(LAST_SYNC_KEY, nowIso);
}

/** Désabonne l'appareil courant du push. */
export async function unsubscribeFromPush() {
  if (!isPushSupported()) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint);
    await subscription.unsubscribe();
  } catch (err) {
    console.error("Échec du désabonnement push :", err);
  }
}
