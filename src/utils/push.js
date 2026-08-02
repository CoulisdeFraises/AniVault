import { supabase } from "../lib/supabase";
import { requestNotificationPermission } from "../hooks/useNotifications";

// Clé VAPID publique — la privée ne quitte jamais le serveur (secret Supabase).
const VAPID_PUBLIC_KEY = "BCLIfy6xHabWEamC07LKr_JUqxOTkLQ5H4zRoCNbFZppNdMUvri2g25nwuiDg2RP5-UfeoxrJg2QCz3NEuKQ3jE";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window;
}

/**
 * Demande la permission, s'abonne au push du navigateur, et enregistre
 * l'abonnement dans Supabase (push_subscriptions) pour cet utilisateur.
 * Retourne { ok, reason? } — reason est un message lisible en cas d'échec,
 * pour que l'UI puisse enfin dire CE QUI a échoué au lieu de rester muette.
 */
export async function subscribeToPush(userId) {
  if (!isPushSupported()) return { ok: false, reason: "Les notifications push ne sont pas supportées sur ce navigateur/appareil." };
  if (!userId) return { ok: false, reason: "Utilisateur non connecté." };

  const granted = await requestNotificationPermission();
  if (!granted) return { ok: false, reason: "Permission refusée par le navigateur." };

  let registration;
  try {
    registration = await navigator.serviceWorker.ready;
  } catch {
    return { ok: false, reason: "Le Service Worker n'est pas disponible (essaie de recharger la page)." };
  }

  let subscription;
  try {
    subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
  } catch (err) {
    console.error("Échec de l'abonnement push :", err);
    return { ok: false, reason: `Échec de l'abonnement navigateur : ${err.message || err}` };
  }

  const raw = subscription.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id:  userId,
      endpoint: raw.endpoint,
      p256dh:   raw.keys.p256dh,
      auth:     raw.keys.auth,
    },
    { onConflict: "endpoint" }
  );

  if (error) {
    console.error("Impossible d'enregistrer l'abonnement push :", error);
    // Message le plus courant : la table n'existe pas encore (SQL pas exécuté).
    const reason = /relation .* does not exist/i.test(error.message)
      ? "La table push_subscriptions n'existe pas encore côté Supabase — exécute le script SQL avant de réessayer."
      : `Échec de l'enregistrement : ${error.message}`;
    return { ok: false, reason };
  }

  return { ok: true };
}

/** Désabonne l'appareil courant du push (Réglages → désactiver notifications). */
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
