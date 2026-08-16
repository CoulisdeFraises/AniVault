import { useState, useRef, useEffect } from "react";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 80; // pixels à tirer avant de déclencher

// Remonte l'arbre DOM depuis la cible du toucher pour trouver le conteneur
// réellement scrollable sous le doigt (ex : la liste d'épisodes d'un jour
// dans le Calendrier, qui scrolle indépendamment de la fenêtre). Sans ça,
// PullToRefresh ne regarde que window.scrollY, qui reste à 0 dans les pages
// où le scroll se fait dans un conteneur interne — il s'arme alors à tort
// et bloque le scroll de ce conteneur (cf. bug calendrier).
function findScrollableAncestor(node) {
  while (node && node !== document.body && node !== document.documentElement) {
    if (node.nodeType === 1) {
      const style = window.getComputedStyle(node);
      const canScrollY = /(auto|scroll)/.test(style.overflowY);
      if (canScrollY && node.scrollHeight > node.clientHeight + 1) return node;
    }
    node = node.parentNode;
  }
  return null; // aucun conteneur interne : c'est bien la fenêtre qui scrolle
}

function getRelevantScrollTop(scrollEl) {
  if (scrollEl) return scrollEl.scrollTop;
  return window.scrollY || document.documentElement.scrollTop || 0;
}

/**
 * Pull-to-refresh corrigé pour PWA mobile.
 *
 * CORRECTIFS vs version précédente :
 * - Les événements React synthétiques sont enregistrés en mode "passive: true"
 *   par défaut, ce qui empêche e.preventDefault() → scroll natif non bloqué.
 * - On utilise désormais window.addEventListener avec { passive: false } sur
 *   "touchmove" pour pouvoir appeler preventDefault() et bloquer le pull-to-
 *   refresh natif d'Android Chrome en mode PWA standalone.
 * - Les handlers utilisent des refs pour éviter les closures périmées sans
 *   re-enregistrer les listeners à chaque render.
 */
export function PullToRefresh({ onRefresh, children, className = "" }) {
  const [pullY, setPullY] = useState(0);
  const [phase, setPhase] = useState("idle");
  // phase : "idle" | "pulling" | "ready" | "refreshing"

  // Refs mutables — accessibles dans les handlers sans stale closure
  const startYRef      = useRef(null);
  const phaseRef       = useRef("idle");
  const onRefreshRef   = useRef(onRefresh);
  const scrollElRef    = useRef(null); // conteneur scrollable sous le doigt, s'il y en a un

  // Garder onRefreshRef à jour sans re-enregistrer les listeners
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  // Garder phaseRef synchronisé avec l'état React
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    function handleTouchStart(e) {
      // Désactive le pull-to-refresh si une modale/panneau est ouverte
      // (Modal.jsx, NotificationPanel, etc. verrouillent déjà le scroll du
      // body via overflow:hidden à l'ouverture — on réutilise ce signal
      // plutôt que de coordonner un état séparé entre composants).
      if (document.body.style.overflow === "hidden") return;
      // Cherche si le doigt est posé sur un conteneur avec son propre scroll
      // (ex : liste du jour dans le Calendrier) plutôt que sur la fenêtre.
      const scrollEl = findScrollableAncestor(e.target);
      scrollElRef.current = scrollEl;
      // N'activer que si ce conteneur (ou la fenêtre, à défaut) est en haut
      const scrollTop = getRelevantScrollTop(scrollEl);
      if (scrollTop > 4) return;
      startYRef.current = e.touches[0].clientY;
    }

    function handleTouchMove(e) {
      if (document.body.style.overflow === "hidden") { startYRef.current = null; return; }
      if (startYRef.current === null || phaseRef.current === "refreshing") return;
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0) { startYRef.current = null; return; }

      // Bloque le scroll natif ET le pull-to-refresh du navigateur/PWA
      e.preventDefault();

      const y = Math.min(delta * 0.42, THRESHOLD + 22);
      setPullY(y);
      setPhase(y >= THRESHOLD ? "ready" : "pulling");
      phaseRef.current = y >= THRESHOLD ? "ready" : "pulling";
    }

    async function handleTouchEnd() {
      const wasReady = phaseRef.current === "ready";
      startYRef.current = null;

      if (wasReady) {
        setPhase("refreshing");
        phaseRef.current = "refreshing";
        setPullY(52);
        try { await onRefreshRef.current(); } catch (_) {}
      }

      setPullY(0);
      setPhase("idle");
      phaseRef.current = "idle";
    }

    // passive: true  → touchstart/touchend (pas besoin de preventDefault)
    // passive: false → touchmove (nécessaire pour preventDefault)
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove",  handleTouchMove,  { passive: false });
    window.addEventListener("touchend",   handleTouchEnd,   { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove",  handleTouchMove);
      window.removeEventListener("touchend",   handleTouchEnd);
    };
  }, []); // Tableau vide : enregistré une seule fois, les refs gèrent les mises à jour

  const progress = Math.min(pullY / THRESHOLD, 1);
  const visible  = phase !== "idle";

  const iconColor =
    phase === "refreshing" ? "text-amber-400" :
    phase === "ready"      ? "text-amber-300" :
                             "text-violet-500";

  return (
    <div className={className} style={{ overscrollBehavior: "contain" }}>
      {/* Indicateur visuel */}
      <div
        style={{
          height: visible
            ? phase === "refreshing" ? 52 : pullY
            : 0,
          transition:
            phase === "refreshing" || phase === "idle"
              ? "height 0.28s ease"
              : "none",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {visible && (
          <RefreshCw
            size={20}
            className={`${iconColor} transition-colors duration-200`}
            style={{
              opacity: progress,
              transform: phase !== "refreshing" ? `rotate(${progress * 360}deg)` : undefined,
              animation: phase === "refreshing" ? "spin 1s linear infinite" : "none",
              transition: phase === "idle" ? "none" : "color 0.2s",
            }}
            aria-hidden
          />
        )}
      </div>

      {children}
    </div>
  );
}