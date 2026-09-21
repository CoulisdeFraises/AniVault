import { useEffect, useLayoutEffect, useRef } from "react";

// Largeur < 100 % : un petit bout des jours voisins dépasse sur les bords de
// l'écran (flou + estompé) pour signaler qu'on peut swiper.
const PANEL_W   = "min(85vw, 440px)";
const MIN_SCALE = 0.95;
const MIN_ALPHA = 0.55;
const MAX_BLUR  = 3;   // px, atteint sur les jours voisins

/**
 * Carrousel des jours (mobile) : un vrai scroll horizontal avec accroche
 * (scroll-snap), où le jour actif est centré et les jours voisins dépassent
 * de chaque côté (petit aperçu flou), légèrement réduits et estompés. Le doigt suit
 * réellement le contenu, contrairement à l'ancien "swipe puis animation".
 *
 * Contrôlé de l'extérieur : `activeIndex` / `onActiveChange`. Un changement
 * d'index venu d'ailleurs (bandeau des jours) fait défiler le carrousel ; un
 * swipe de l'utilisateur remonte l'index via `onActiveChange`.
 */
export function DayCarousel({ days, activeIndex, onActiveChange, renderDay }) {
  const scrollerRef = useRef(null);
  const panelRefs   = useRef([]);
  const activeRef   = useRef(activeIndex);
  const programmatic = useRef(false);
  const timerRef    = useRef(0);
  const mountedRef  = useRef(false);

  activeRef.current = activeIndex;

  const nearestIndex = () => {
    const el = scrollerRef.current;
    if (!el) return 0;
    const center = el.scrollLeft + el.clientWidth / 2;
    let best = 0, bestD = Infinity;
    panelRefs.current.forEach((p, i) => {
      if (!p) return;
      const d = Math.abs(p.offsetLeft + p.offsetWidth / 2 - center);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  };

  const scrollToIndex = (i, behavior) => {
    const el = scrollerRef.current, p = panelRefs.current[i];
    if (!el || !p) return;
    const left = p.offsetLeft + p.offsetWidth / 2 - el.clientWidth / 2;
    programmatic.current = true;
    clearTimeout(timerRef.current);
    el.scrollTo({ left, behavior });
    timerRef.current = setTimeout(() => { programmatic.current = false; }, behavior === "auto" ? 50 : 600);
  };

  // Position initiale, sans animation ni flash.
  useLayoutEffect(() => { scrollToIndex(activeIndex, "auto"); mountedRef.current = true; }, []); // eslint-disable-line

  // Changement d'index externe (bandeau des jours…) → on fait défiler.
  useEffect(() => {
    if (!mountedRef.current) return;
    if (nearestIndex() === activeIndex) return; // déjà là (swipe de l'utilisateur)
    scrollToIndex(activeIndex, "smooth");
  }, [activeIndex]); // eslint-disable-line

  // Mise à l'échelle / opacité selon la distance au centre + remontée de l'index.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;

    const update = () => {
      raf = 0;
      const center = el.scrollLeft + el.clientWidth / 2;
      let best = 0, bestD = Infinity;
      panelRefs.current.forEach((p, i) => {
        if (!p) return;
        const d = Math.abs(p.offsetLeft + p.offsetWidth / 2 - center);
        if (d < bestD) { bestD = d; best = i; }
        if (reduce) return;
        const t = Math.min(1, d / (p.offsetWidth * 0.9));
        p.style.transform = `scale(${1 - (1 - MIN_SCALE) * t})`;
        p.style.opacity   = String(1 - (1 - MIN_ALPHA) * t);
        p.style.filter    = t > 0.03 ? `blur(${(MAX_BLUR * t).toFixed(2)}px)` : "none";
      });
      if (!programmatic.current && best !== activeRef.current) {
        onActiveChange(best);
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    const onEnd    = () => { programmatic.current = false; };

    update();
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("scrollend", onEnd);
    window.addEventListener("resize", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("scrollend", onEnd);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(timerRef.current);
    };
  }, [onActiveChange, days.length]);

  return (
    <div ref={scrollerRef}
      className="relative flex gap-2 overflow-x-auto overscroll-x-contain snap-x snap-mandatory scrollbar-none -mx-3 py-1 items-start"
      style={{ paddingInline: `calc((100% - ${PANEL_W}) / 2)`, scrollbarWidth: "none" }}>
      {days.map((day, i) => (
        <div key={i} ref={(n) => (panelRefs.current[i] = n)}
          className="flex-shrink-0 snap-center will-change-transform" style={{ width: PANEL_W }}>
          {renderDay(day, i)}
        </div>
      ))}
    </div>
  );
}
