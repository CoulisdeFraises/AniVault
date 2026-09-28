import { createPortal } from "react-dom";
import { RARITY, normalizeTier } from "../../utils/waifinity";

/**
 * Flash plein écran à la couleur du palier, joué à la révélation d'une carte
 * Epic ou mieux (RARITY.flashPeak = 0 → rien). Posé sur <body> pour couvrir
 * tout l'écran ; `onDone` permet au parent de le démonter une fois joué.
 */
export function ScreenFlash({ tier, onDone }) {
  const r = RARITY[normalizeTier(tier)];
  if (!r.flashPeak) return null;
  return createPortal(
    <div
      aria-hidden="true"
      onAnimationEnd={onDone}
      className="screen-flash pointer-events-none fixed inset-0 z-[90]"
      style={{
        background: `radial-gradient(circle at 50% 45%, ${r.glow} 0%, transparent 70%), rgba(255,255,255,0.10)`,
        "--flash-peak": r.flashPeak,
        animationDelay: "120ms",
      }}
    />,
    document.body
  );
}
