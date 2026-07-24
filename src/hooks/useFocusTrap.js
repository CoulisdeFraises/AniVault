import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTORS = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

/**
 * useFocusTrap — piège le focus clavier dans un conteneur (modal, drawer…).
 *
 * Usage :
 *   const trapRef = useFocusTrap(isOpen);
 *   return <div ref={trapRef}>…</div>;
 *
 * @param {boolean} active  Active/désactive le trap
 * @param {Function} [onEscape]  Callback appelé quand Escape est pressé
 */
export function useFocusTrap(active = true, onEscape) {
  const ref = useRef(null);

  useEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;

    // Focus automatique sur le premier élément focusable
    const focusables = () => [...el.querySelectorAll(FOCUSABLE_SELECTORS)];
    const first = focusables()[0];
    const previouslyFocused = document.activeElement;

    // Petit délai pour laisser l'animation s'ouvrir
    const focusTimer = setTimeout(() => first?.focus(), 50);

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        onEscape?.();
        return;
      }
      if (e.key !== "Tab") return;

      const all = focusables();
      if (!all.length) return;
      const firstEl = all[0];
      const lastEl  = all[all.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }

    el.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      el.removeEventListener("keydown", handleKeyDown);
      // Rend le focus à l'élément qui avait le focus avant l'ouverture
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [active, onEscape]);

  return ref;
}
