import { useEffect, useLayoutEffect, useRef } from "react";

// Largeur < 100 % : un petit bout des jours voisins dépasse sur les bords de
// l'écran (flou + estompé, voir .day-panel dans animations.css).
const PANEL_W      = "min(85vw, 440px)";
const SETTLE_MS    = 120;  // silence de scroll avant de considérer le carrousel "posé"
const AFTER_TOUCH  = 220;  // délai laissé à l'inertie/au snap natif après le lâcher du doigt

/**
 * Carrousel des jours (mobile) : scroll horizontal natif avec accroche
 * (scroll-snap). Le jour centré est net, les voisins sont floutés/estompés.
 *
 * Choix de conception (après un bug de carrousel "coincé entre deux jours") :
 *  - AUCUNE écriture de style à chaque frame de scroll : l'état net/flou est un
 *    simple attribut `data-active` posé sur le panneau centré, le rendu étant
 *    fait en CSS (transition) ;
 *  - AUCUN re-render React pendant le geste : l'index actif n'est remonté au
 *    parent (`onActiveChange`) qu'une fois le carrousel posé ;
 *  - filet de sécurité : si, une fois le scroll terminé et le doigt levé, le
 *    carrousel n'est pas aligné sur un jour (snap natif raté), on le recentre
 *    nous-mêmes.
 *
 * Contrôlé de l'extérieur : un `activeIndex` modifié ailleurs (bandeau des
 * jours) fait défiler le carrousel ; on ne réagit pas aux changements que
 * l'on a soi-même provoqués.
 */
export function DayCarousel({ days, activeIndex, onActiveChange, renderDay }) {
  const scrollerRef  = useRef(null);
  const panelRefs    = useRef([]);
  const knownRef     = useRef(activeIndex);  // dernier index connu du parent
  const visualRef    = useRef(activeIndex);  // panneau actuellement mis en avant
  const touchingRef  = useRef(false);
  const timerRef     = useRef(0);
  const onChangeRef  = useRef(onActiveChange);
  onChangeRef.current = onActiveChange;

  const targetFor = (i) => {
    const el = scrollerRef.current, p = panelRefs.current[i];
    return el && p ? p.offsetLeft + p.offsetWidth / 2 - el.clientWidth / 2 : 0;
  };

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

  const markActive = (i) => {
    visualRef.current = i;
    panelRefs.current.forEach((p, k) => { if (p) p.dataset.active = String(k === i); });
  };

  // Position initiale, sans animation ni flash.
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTo({ left: targetFor(activeIndex), behavior: "auto" });
    knownRef.current = activeIndex;
    markActive(activeIndex);
  }, []); // eslint-disable-line

  // Changement d'index venu de l'extérieur (bandeau des jours…) → on défile.
  useEffect(() => {
    if (activeIndex === knownRef.current) return; // c'est nous qui l'avons remonté
    knownRef.current = activeIndex;
    markActive(activeIndex);
    scrollerRef.current?.scrollTo({ left: targetFor(activeIndex), behavior: "smooth" });
  }, [activeIndex]); // eslint-disable-line

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const settle = () => {
      if (touchingRef.current) return;
      const i = nearestIndex();
      const target = targetFor(i);
      // Snap natif raté (carrousel entre deux jours, doigt levé) : on recentre.
      if (Math.abs(el.scrollLeft - target) > 2) {
        markActive(i);
        el.scrollTo({ left: target, behavior: "smooth" });
        return; // les événements de scroll relanceront settle() une fois posé
      }
      markActive(i);
      if (i !== knownRef.current) { knownRef.current = i; onChangeRef.current(i); }
    };

    const onScroll = () => {
      const i = nearestIndex();
      if (i !== visualRef.current) markActive(i); // ne touche au DOM que si ça change
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(settle, SETTLE_MS);
    };
    const onTouchStart = () => { touchingRef.current = true; clearTimeout(timerRef.current); };
    const onTouchEnd   = () => {
      touchingRef.current = false;
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(settle, AFTER_TOUCH);
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      clearTimeout(timerRef.current);
    };
  }, [days.length]); // eslint-disable-line

  // Espaceurs (et non padding) de part et d'autre : le padding de fin d'un
  // conteneur flex scrollable est ignoré par certains navigateurs (Safari).
  // Largeur = (largeur visible − panneau) / 2 − gap.
  const spacer = { flex: `0 0 calc((100% - ${PANEL_W}) / 2 - 0.5rem)` };

  return (
    <div ref={scrollerRef}
      className="relative flex gap-2 overflow-x-auto overscroll-x-contain snap-x snap-mandatory scrollbar-none -mx-3 py-1 items-start"
      style={{ scrollbarWidth: "none" }}>
      <div aria-hidden="true" style={spacer} />
      {days.map((day, i) => (
        <div key={i} ref={(n) => (panelRefs.current[i] = n)}
          className="day-panel flex-shrink-0 snap-center" style={{ width: PANEL_W }}>
          {renderDay(day, i)}
        </div>
      ))}
      <div aria-hidden="true" style={spacer} />
    </div>
  );
}
