import { useRef, useState } from "react";
import { Star } from "lucide-react";
import { haptics } from "../../utils/haptics";

// ── Sélecteur de note en étoiles (1-10) ──────────────────────────────────────
// Un tap sur une étoile note ; un tap sur la note actuelle l'efface ; on peut
// aussi faire glisser le doigt pour ajuster. Clavier : ← → Début Fin.
// Sans `onChange`, le composant est un simple affichage en lecture seule.

export const RATING_LABELS = [
  null, "À fuir", "Très faible", "Faible", "Passable", "Moyen",
  "Correct", "Bien", "Très bien", "Excellent", "Chef-d'œuvre",
];
const GOLD = "#fbbf24";

/** Couleur d'accent d'une note : or dès qu'il y a une note, violet clair sinon. */
export function ratingColor(v) {
  return Math.round(Number(v) || 0) > 0 ? GOLD : "#a78bfa";
}

export function RatingPicker({ value = 0, onChange, size = "md", showLabel = true }) {
  const ref = useRef(null);
  const moved = useRef(false);
  const [preview, setPreview] = useState(null);
  const interactive = typeof onChange === "function";
  const shown = preview ?? value;
  const shownInt = Math.round(shown) || 0;
  const starSize = size === "lg" ? 28 : size === "sm" ? 20 : 24;

  function idxAt(clientX) {
    const r = ref.current.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - r.left, 0), r.width - 1);
    return Math.floor((x / r.width) * 10) + 1;
  }

  const handlers = interactive ? {
    onPointerDown: (e) => {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      moved.current = false;
      setPreview(idxAt(e.clientX));
    },
    onPointerMove: (e) => {
      if (preview === null) return;
      const i = idxAt(e.clientX);
      if (i !== preview) { moved.current = true; setPreview(i); haptics.tap(); }
    },
    onPointerUp: (e) => {
      if (preview === null) return;
      const i = idxAt(e.clientX);
      setPreview(null);
      onChange(!moved.current && i === Math.round(value) ? 0 : i);
    },
    onPointerCancel: () => setPreview(null),
    onKeyDown: (e) => {
      const v = Math.round(value) || 0;
      const next = e.key === "ArrowRight" || e.key === "ArrowUp" ? Math.min(10, v + 1)
        : e.key === "ArrowLeft" || e.key === "ArrowDown" ? Math.max(0, v - 1)
        : e.key === "Home" ? 0 : e.key === "End" ? 10 : null;
      if (next === null) return;
      e.preventDefault();
      onChange(next);
    },
  } : {};

  return (
    <div className="select-none">
      {showLabel && (
        <div className="flex items-baseline justify-between gap-2 mb-1">
          <span className="flex items-baseline gap-1">
            <span className="text-lg font-bold leading-none transition-colors"
              style={{ color: shownInt ? GOLD : "rgba(196,181,253,0.5)", fontFamily: "'Space Grotesk',sans-serif" }}>
              {shownInt || "—"}
            </span>
            <span className="text-[11px] text-violet-500">/10</span>
          </span>
          <span className="text-xs font-medium text-violet-300 truncate">
            {shownInt ? RATING_LABELS[shownInt] : interactive ? "Touche pour noter" : "Pas de note"}
          </span>
        </div>
      )}
      <div ref={ref} {...handlers}
        role={interactive ? "slider" : "img"}
        tabIndex={interactive ? 0 : undefined}
        aria-label={interactive ? "Note sur 10" : `Note ${shownInt || "aucune"} sur 10`}
        aria-valuemin={interactive ? 0 : undefined} aria-valuemax={interactive ? 10 : undefined}
        aria-valuenow={interactive ? Math.round(value) || 0 : undefined}
        aria-valuetext={interactive ? (shownInt ? `${shownInt} sur 10, ${RATING_LABELS[shownInt]}` : "Pas de note") : undefined}
        className={`flex items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 ${interactive ? "cursor-pointer" : ""}`}
        style={{ height: Math.max(36, starSize + 10), touchAction: interactive ? "pan-y" : undefined }}>
        {Array.from({ length: 10 }, (_, i) => {
          const on = i < shownInt;
          return (
            <span key={i} className="flex-1 flex items-center justify-center">
              <Star size={starSize}
                fill={on ? GOLD : "none"} strokeWidth={on ? 0 : 1.5}
                className={`transition-transform duration-150 motion-reduce:transition-none ${on ? "" : "text-white/25"}`}
                style={{
                  transform: preview !== null && i + 1 === preview ? "scale(1.25)" : "none",
                  filter: on ? "drop-shadow(0 0 5px rgba(251,191,36,0.45))" : "none",
                }} />
            </span>
          );
        })}
      </div>
    </div>
  );
}
