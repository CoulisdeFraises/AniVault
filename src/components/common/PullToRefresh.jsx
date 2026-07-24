import { useState, useRef } from "react";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 80; // pixels à tirer avant de déclencher

/**
 * Pull-to-refresh natif pour mobile.
 * Wrappez le contenu de la page avec ce composant.
 * onRefresh doit retourner une Promise.
 */
export function PullToRefresh({ onRefresh, children }) {
  const [pullY,  setPullY]  = useState(0);
  const [phase,  setPhase]  = useState("idle");
  // phase : idle | pulling | ready | refreshing
  const startY = useRef(null);

  function onTouchStart(e) {
    if (window.scrollY > 4) return; // pas en haut → rien
    startY.current = e.touches[0].clientY;
  }

  function onTouchMove(e) {
    if (startY.current === null || phase === "refreshing") return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) { startY.current = null; return; }
    const y = Math.min(delta * 0.42, THRESHOLD + 22);
    setPullY(y);
    setPhase(y >= THRESHOLD ? "ready" : "pulling");
  }

  async function onTouchEnd() {
    const wasReady = phase === "ready";
    startY.current = null;

    if (wasReady) {
      setPhase("refreshing");
      setPullY(52);
      try { await onRefresh(); } catch (_) {}
    }

    setPullY(0);
    setPhase("idle");
  }

  const progress = Math.min(pullY / THRESHOLD, 1);
  const visible  = phase !== "idle";

  const iconColor =
    phase === "refreshing" ? "text-amber-400" :
    phase === "ready"      ? "text-amber-300" :
                             "text-violet-500";

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
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
              opacity:   progress,
              transform: `rotate(${progress * 360}deg)`,
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