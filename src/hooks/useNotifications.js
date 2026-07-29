import { useEffect, useRef } from "react";
import { fetchNextAiring } from "../api";
import { addNotification } from "./useNotificationStore";

// Fonction autonome (pas un hook) : ne dépend d'aucun state React, donc peut
// être appelée directement depuis n'importe quel composant (ex: NotificationPanel)
// sans re-déclencher toute la logique de programmation des notifications.
export async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied")  return false;
  const res = await Notification.requestPermission();
  return res === "granted";
}

export function useNotifications(entries) {
  const timersRef    = useRef([]);
  const firedRef     = useRef(new Set()); // évite les doublons sur re-render

  useEffect(() => {
    if (!entries?.length) return;

    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    const active  = entries.filter((e) => e.status === "en-cours");
    const MAX_24H = 24 * 60 * 60 * 1000;

    active.forEach((entry) => {
      fetchNextAiring(entry)
        .then((airing) => {
          if (!airing?.airingAt) return;
          const delay = airing.airingAt - Date.now();
          if (delay <= 0 || delay > MAX_24H) return;

          // Clé unique pour éviter de reprogrammer deux fois le même épisode
          const key = `${entry.id}-ep${airing.episode}`;
          if (firedRef.current.has(key)) return;

          const t = setTimeout(() => {
            firedRef.current.add(key);

            const title = "NOUVEL EPISODE";
            const body  = `${entry.title} — Épisode ${airing.episode} disponible !`;

            // ── Notification in-app (store) ──────────────────────────────
            addNotification({ title, body, entryId: entry.id, icon: "glyphs-poly:sparkles" });

            // ── Notification navigateur (si permission accordée) ──────────
            if ("Notification" in window && Notification.permission === "granted") {
              const n = new Notification(title, {
                body,
                icon:  "/logo.png",
                badge: "/favicon-96x96.png",
                tag:   `anivault-${entry.id}-${airing.episode}`,
              });
              n.onclick = () => {
                window.focus();
                window.location.hash = `/details/${entry.id}`;
              };
            }
          }, delay);

          timersRef.current.push(t);
        })
        .catch(() => {});
    });

    return () => timersRef.current.forEach(clearTimeout);
  }, [entries]);

  // Le hook ne renvoie plus requestPermission — utilise l'export standalone
  // requestNotificationPermission() ci-dessus, qui ne nécessite pas de monter
  // ce hook (et donc pas de dupliquer toute la logique de programmation).
}