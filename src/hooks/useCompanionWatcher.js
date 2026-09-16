import { useEffect, useRef } from "react";
import { calcCurrentStreak } from "../utils/watchTime";
import { useCompanion } from "../context/CompanionContext";

// ── useCompanionWatcher ───────────────────────────────────────────────────
//
// Regroupe les déclencheurs du compagnon qui ne sont PAS liés à une action
// ponctuelle (celles-là sont directement dans LibraryContext / useAchievements) :
//   - streak record battu / streak perdue (comparaison avec le dernier état connu)
//   - streak en danger (le soir, si rien regardé aujourd'hui)
//   - retour après une absence (comeback)
//   - message d'accueil aléatoire (idle), si rien d'autre ne s'est déclenché
//
// Chacun a un cooldown persisté en localStorage pour ne pas spammer d'un
// jour sur l'autre (sauf le record, qui ne peut logiquement se reproduire
// que si le record est effectivement battu).

const LS_BEST_STREAK   = "anivault:companion:bestStreak";
const LS_LAST_STREAK   = "anivault:companion:lastStreak";
const LS_LAST_ACTIVE   = "anivault:companion:lastActiveDate";     // dernier jour où une activité a été vue
const LS_DANGER_SHOWN  = "anivault:companion:dangerShownDate";
const LS_IDLE_SHOWN    = "anivault:companion:idleShownDate";

const DANGER_HOUR_START = 21; // même fenêtre que la notif push streak-alert
const IDLE_CHANCE       = 0.3; // 30% de chances d'afficher le message d'accueil aléatoire

function todayKey() {
  // Clé de date locale au navigateur (cohérent avec calcCurrentStreak, qui
  // raisonne aussi en heure locale du navigateur).
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function lastActivityKey(entries) {
  let latest = null;
  for (const entry of entries) {
    for (const h of entry.watchHistory || []) {
      if (!h.watchedAt) continue;
      const d = new Date(h.watchedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!latest || key > latest) latest = key;
    }
  }
  return latest;
}

function daysBetween(fromKey, toKey) {
  const from = new Date(`${fromKey}T00:00:00`);
  const to   = new Date(`${toKey}T00:00:00`);
  return Math.round((to - from) / 86400000);
}

export function useCompanionWatcher(entries, loading) {
  const { triggerCompanion } = useCompanion();
  const ranOnceRef = useRef(false);

  useEffect(() => {
    if (loading || !entries) return;

    const today = todayKey();
    const streak = calcCurrentStreak(entries);

    // ── Streak : record / perdue ──────────────────────────────────────────
    const bestStreak = Number(localStorage.getItem(LS_BEST_STREAK) || 0);
    const lastStreak = localStorage.getItem(LS_LAST_STREAK);

    if (streak > bestStreak) {
      localStorage.setItem(LS_BEST_STREAK, String(streak));
      // Pas de record "0 → 1" ni au tout premier calcul (lastStreak === null) :
      // seulement si on avait déjà une streak connue et qu'elle vient d'être battue.
      if (lastStreak !== null && streak > 1) {
        triggerCompanion("streakRecord", { streak });
      }
    } else if (streak === 0 && lastStreak !== null && Number(lastStreak) > 0) {
      triggerCompanion("streakLost", { streak: lastStreak });
    }
    localStorage.setItem(LS_LAST_STREAK, String(streak));

    // ── Streak en danger (le soir, rien regardé aujourd'hui) ─────────────
    const hour = new Date().getHours();
    const dangerShown = localStorage.getItem(LS_DANGER_SHOWN);
    const watchedToday = lastActivityKey(entries) === today;

    if (streak > 0 && !watchedToday && hour >= DANGER_HOUR_START && dangerShown !== today) {
      triggerCompanion("streakDanger", { streak });
      localStorage.setItem(LS_DANGER_SHOWN, today);
    }

    // ── Comeback (une seule fois par montage, pas à chaque changement d'entries) ──
    if (!ranOnceRef.current) {
      ranOnceRef.current = true;

      const lastActive = localStorage.getItem(LS_LAST_ACTIVE);
      if (lastActive) {
        const gap = daysBetween(lastActive, today);
        if (gap >= 3) {
          triggerCompanion("comeback", { days: gap });
        } else if (gap === 0) {
          // Rien à signaler : déjà actif aujourd'hui.
        } else {
          // Petite absence (1-2 jours) : pas assez significatif pour un comeback,
          // laisse la place au message idle ci-dessous.
          maybeTriggerIdle();
        }
      } else {
        maybeTriggerIdle();
      }

      function maybeTriggerIdle() {
        const idleShown = localStorage.getItem(LS_IDLE_SHOWN);
        if (idleShown === today) return;
        if (Math.random() > IDLE_CHANCE) return;
        triggerCompanion("idle");
        localStorage.setItem(LS_IDLE_SHOWN, today);
      }

      localStorage.setItem(LS_LAST_ACTIVE, today);
    }
  }, [entries, loading, triggerCompanion]);
}
