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
  const entriesRef   = useRef(entries);
  entriesRef.current = entries;

  useEffect(() => {
    function scheduleAll() {
      const currentEntries = entriesRef.current;
      if (!currentEntries?.length) return;

      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];

      const active  = currentEntries.filter((e) => e.status === "en-cours");
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

              const title = "AniVault";
              const body  = `${entry.title} — Épisode ${airing.episode} disponible !`;

              // ── Notification in-app (store) ──────────────────────────────
              const dedupeKey = `${entry.id}-ep${airing.episode}`;
              addNotification({
                title,
                body,
                entryId: entry.id,
                icon: "sparkles",
                dedupeKey
              });

              // ── Notification navigateur (si permission accordée) ──────────
              if (
                "serviceWorker" in navigator &&
                Notification.permission === "granted" &&
                localStorage.getItem("pref_notifications") !== "false"
              ) {
                navigator.serviceWorker.ready
                  .then((reg) =>
                    reg.showNotification(title, {
                      body,
                      icon:  "/logo.png",
                      badge: "/favicon-96x96.png",
                      tag:   `anivault-${entry.id}-${airing.episode}`,
                      data:  { entryId: entry.id },
                    })
                  )
                  .catch(() => {});
              }
            }, delay);

            timersRef.current.push(t);
          })
          .catch(() => {});
      });
    }

    // Programmation immédiate (nouvelle entrée ajoutée, statut changé…)
    scheduleAll();

    // Re-scan périodique : un épisode qui diffuse dans 3 jours n'entre dans
    // la fenêtre de 24h qu'avec le temps qui passe, pas parce que `entries`
    // change. Sans ce re-scan, on ne "capte" que ce qui est déjà dans la
    // fenêtre au moment exact où entries a changé pour une autre raison —
    // ce qui expliquait des notifications reçues pour certains titres et
    // pas d'autres, en apparence au hasard.
    const interval = setInterval(scheduleAll, 15 * 60 * 1000); // toutes les 15 min

    return () => {
      clearInterval(interval);
      timersRef.current.forEach(clearTimeout);
    };
  }, [entries]);

  // Le hook ne renvoie plus requestPermission — utilise l'export standalone
  // requestNotificationPermission() ci-dessus, qui ne nécessite pas de monter
  // ce hook (et donc pas de dupliquer toute la logique de programmation).
}