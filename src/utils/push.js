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
