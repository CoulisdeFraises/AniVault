import { useState, useRef, useEffect } from "react";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 80; // pixels à tirer avant de déclencher

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
export function PullToRefresh({ onRefresh, children }) {
  const [pullY, setPullY] = useState(0);
  const [phase, setPhase] = useState("idle");
  // phase : "idle" | "pulling" | "ready" | "refreshing"

  // Refs mutables — accessibles dans les handlers sans stale closure
  const startYRef   = useRef(null);
  const phaseRef    = useRef("idle");
  const onRefreshRef = useRef(onRefresh);

  // Garder onRefreshRef à jour sans re-enregistrer les listeners
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  // Garder phaseRef synchronisé avec l'état React
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => {
    function handleTouchStart(e) {
      // N'activer que si on est en haut de la page
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      if (scrollTop > 4) return;
      startYRef.current = e.touches[0].clientY;
    }

    function handleTouchMove(e) {
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
    <div style={{ overscrollBehavior: "contain" }}>
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