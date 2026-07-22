import { useState, useEffect, useRef } from "react";

// Easing : décélération cubique
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

/**
* Anime un nombre de sa valeur précédente vers `target`.
* S'arrête instantanément si prefers-reduced-motion est activé.
*/
export function useCountUp(target, duration = 750) {
  const [value, setValue] = useState(0);
  const prevRef  = useRef(0);
  const rafRef   = useRef(null);

  useEffect(() => {
    // Respecter la préférence de réduction de mouvement
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setValue(target);
      prevRef.current = target;
      return;
    }

    const from = prevRef.current;
    const to   = target;
    prevRef.current = to;

    if (from === to) return;

    const startTime = performance.now();

    function tick(now) {
      const elapsed  = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current  = Math.round(from + (to - from) * easeOutCubic(progress));
      setValue(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return value;
}