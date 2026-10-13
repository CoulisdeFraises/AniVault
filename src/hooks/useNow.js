import { useSyncExternalStore } from "react";

// ── useNow — horloge partagée ──────────────────────────────────────────────
// Renvoie `Date.now()` rafraîchi toutes les minutes (et au retour sur l'app).
// Sert à recalculer les statuts dérivés du temps (« à jour » : un épisode vient
// de sortir) sans rechargement. UN SEUL minuteur pour toute l'app, quel que soit
// le nombre de cartes qui l'utilisent.

const TICK_MS = 60 * 1000;
let now = Date.now();
let timer = null;
const listeners = new Set();

function tick() {
  now = Date.now();
  listeners.forEach((l) => l());
}
function onVisible() {
  if (document.visibilityState === "visible") tick();
}

function subscribe(listener) {
  listeners.add(listener);
  if (listeners.size === 1) {
    timer = setInterval(tick, TICK_MS);
    document.addEventListener("visibilitychange", onVisible);
    tick(); // l'horloge a pu rester figée tant que personne n'écoutait
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", onVisible);
    }
  };
}

export function useNow() {
  return useSyncExternalStore(subscribe, () => now, () => now);
}
