import { useState, useEffect, useRef } from "react";

// ── Navigation semaine partagée ──────────────────────────────────────────────
// Factorisé depuis l'ancien Calendar.jsx (onglet Animes) pour être réutilisé
// par les onglets Animes ET Séries, qui partagent exactement le même
// mécanisme : N jours visibles à la fois, navigation prev/suiv, swipe
// horizontal tactile, petite animation de glissement au changement de jour.

export const DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const VISIBLE_DAYS_MOBILE  = 1;
const VISIBLE_DAYS_DESKTOP = 3;
const SWIPE_THRESHOLD      = 60; // px minimum pour déclencher un changement de jour

export function todayIndex() { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; }

function useVisibleDays() {
  const [days, setDays] = useState(
    typeof window !== "undefined" && window.innerWidth < 640
      ? VISIBLE_DAYS_MOBILE
      : VISIBLE_DAYS_DESKTOP
  );
  useEffect(() => {
    const handler = () => setDays(window.innerWidth < 640 ? VISIBLE_DAYS_MOBILE : VISIBLE_DAYS_DESKTOP);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return days;
}

/**
 * useWeekNavigation — gère l'offset de jour affiché (0-6), le swipe tactile
 * horizontal, et la petite animation de glissement entre jours.
 * Ne connaît rien des données affichées : à combiner avec un tableau de
 * 7 entrées (une par jour de la semaine) construit par l'appelant.
 */
export function useWeekNavigation() {
  const VISIBLE_DAYS = useVisibleDays();
  const [dayOffset, setDayOffset] = useState(() =>
    Math.max(0, Math.min(7 - VISIBLE_DAYS, todayIndex() - (VISIBLE_DAYS > 1 ? 1 : 0)))
  );
  const [gridKey,  setGridKey]  = useState(0);
  const [slideDir, setSlideDir] = useState("none");
  const swipePtr = useRef({ id: null, startX: 0, startY: 0, axis: null });

  const canPrevDay = dayOffset > 0;
  const canNextDay = dayOffset + VISIBLE_DAYS < 7;

  function handlePrevDay() { setSlideDir("from-right"); setGridKey((k) => k + 1); setDayOffset((d) => Math.max(0, d - 1)); }
  function handleNextDay() { setSlideDir("from-left");  setGridKey((k) => k + 1); setDayOffset((d) => Math.min(7 - VISIBLE_DAYS, d + 1)); }

  function jumpToDay(i) {
    const newOffset = Math.max(0, Math.min(7 - VISIBLE_DAYS, i - Math.floor(VISIBLE_DAYS / 2)));
    setSlideDir(newOffset > dayOffset ? "from-left" : "from-right");
    setGridKey((k) => k + 1);
    setDayOffset(newOffset);
  }

  function handleGridPointerDown(e) {
    if (e.button > 0) return;
    swipePtr.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, axis: null };
  }
  function handleGridPointerMove(e) {
    if (swipePtr.current.id == null) return;
    const dx = e.clientX - swipePtr.current.startX;
    const dy = e.clientY - swipePtr.current.startY;
    if (!swipePtr.current.axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      swipePtr.current.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }
  }
  function handleGridPointerUp(e) {
    if (swipePtr.current.id == null) return;
    const dx = e.clientX - swipePtr.current.startX;
    if (swipePtr.current.axis === "x") {
      if (dx < -SWIPE_THRESHOLD && canNextDay) handleNextDay();
      else if (dx > SWIPE_THRESHOLD && canPrevDay) handlePrevDay();
    }
    swipePtr.current = { id: null, startX: 0, startY: 0, axis: null };
  }
  function handleGridPointerCancel() {
    swipePtr.current = { id: null, startX: 0, startY: 0, axis: null };
  }

  const slideClass = slideDir === "from-left" ? "animate-slideFromLeft" : slideDir === "from-right" ? "animate-slideFromRight" : "";

  return {
    VISIBLE_DAYS, dayOffset, gridKey, slideClass,
    canPrevDay, canNextDay, handlePrevDay, handleNextDay, jumpToDay,
    gridPointerHandlers: {
      onPointerDown: handleGridPointerDown,
      onPointerMove: handleGridPointerMove,
      onPointerUp: handleGridPointerUp,
      onPointerCancel: handleGridPointerCancel,
    },
  };
}
