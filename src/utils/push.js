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
 * Retourne true si tout s'est bien passé.
 */
export async function subscribeToPush(userId) {
  if (!isPushSupported() || !userId) return false;

  const granted = await requestNotificationPermission();
  if (!granted) return false;

  try {
    const registration = await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
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

    if (error) { console.error("Impossible d'enregistrer l'abonnement push :", error); return false; }
    return true;
  } catch (err) {
    console.error("Échec de l'abonnement push :", err);
    return false;
  }
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
