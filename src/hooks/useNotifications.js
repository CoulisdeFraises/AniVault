import { useEffect, useCallback, useRef } from "react";
import { fetchNextAiring } from "../api";

/**
 * useNotifications — surveille les prochains épisodes des titres "en cours"
 * et déclenche une notification Web quand un épisode est sur le point de sortir
 * (dans les prochaines 24 heures).
 *
 * Usage dans App.jsx (à l'intérieur de LibraryProvider) :
 *   const { requestPermission } = useNotifications(entries);
 *
 * @param {Array}  entries  Liste des entrées de la bibliothèque
 */
export function useNotifications(entries) {
  const timersRef = useRef([]);

  /** Demande la permission si pas encore accordée */
  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied")  return false;
    const res = await Notification.requestPermission();
    return res === "granted";
  }, []);

  useEffect(() => {
    if (!("Notification" in window))           return;
    if (Notification.permission !== "granted") return;
    if (!entries?.length)                      return;

    // Nettoie les anciens timers
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    const active = entries.filter(e => e.status === "en-cours");
    const MAX_24H = 24 * 60 * 60 * 1000;

    active.forEach(entry => {
      fetchNextAiring(entry)
        .then(airing => {
          if (!airing?.airingAt) return;
          const delay = airing.airingAt - Date.now();
          // Notifie seulement si l'épisode sort dans les 24 prochaines heures
          if (delay <= 0 || delay > MAX_24H) return;

          const t = setTimeout(() => {
            const n = new Notification("🎌 AniVault", {
              body:  `${entry.title} — Épisode ${airing.episode} disponible !`,
              icon:  "/logo.png",
              badge: "/favicon-96x96.png",
              tag:   `anivault-${entry.id}-${airing.episode}`,
            });
            n.onclick = () => {
              window.focus();
              window.location.hash = `/details/${entry.id}`;
            };
          }, delay);

          timersRef.current.push(t);
        })
        .catch(() => {}); // silencieux (rate-limit, offline…)
    });

    return () => timersRef.current.forEach(clearTimeout);
  }, [entries]);

  return { requestPermission };
}
