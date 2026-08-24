import { useState } from "react";
import { Star } from "lucide-react";

// Import correct avec le chemin relatif adapté à votre structure
import { RATING_EMOJIS, getCompanion } from "../../utils/companions"; 

export function getRatingBand(rating) {
  if (!rating) return null;
  if (rating <= 2) return 0;
  if (rating <= 4) return 1;
  if (rating === 5) return 2;
  if (rating <= 7) return 3;
  if (rating <= 9) return 4;
  return 5;
}

export function getRatingEmoji(rating, companionId) {
  const band = getRatingBand(rating);
  if (band === null) return null;
  const id = companionId || (typeof localStorage !== "undefined" ? localStorage.getItem("pref_companion") : null) || "default";
  const emojis = RATING_EMOJIS[id] || RATING_EMOJIS.default;
  return emojis[band];
}

/**
 * RatingBadge — affiche la note sous forme d'image (si le compagnon a un jeu
 * d'images, ex. Chlo) ou d'émoji (fallback pour les compagnons sans images).
 * `className` contrôle la taille : les classes text-* fixent le font-size de
 * l'élément (image comme span), et h-[1.15em] s'appuie dessus pour que
 * l'image et l'émoji restent visuellement à la même échelle partout.
 */
export function RatingBadge({ rating, companionId, className = "" }) {
  const band = getRatingBand(rating);
  if (band === null) return null;

  const id = companionId || (typeof localStorage !== "undefined" ? localStorage.getItem("pref_companion") : null) || "default";
  const companion = getCompanion(id);

  if (companion?.imageFolder) {
    return (
      <img
        src={`${companion.imageFolder}/rating-${band}.png`}
        alt={`Note ${rating}/10`}
        className={`inline-block h-[1.15em] w-auto align-middle ${className}`}
        loading="lazy"
      />
    );
  }

  const emojis = RATING_EMOJIS[id] || RATING_EMOJIS.default;
  return <span className={className}>{emojis[band]}</span>;
}

// --- Composants d'interface ---

export function RatingMeter({ value, onChange, size = "sm" }) {
  const h = size === "sm" ? "h-4" : "h-6";
  return (
    <div className="flex items-end gap-0.5">
      {Array.from({ length: 10 }).map((_, i) => {
        const filled = i < value;
        return (
          <button
            key={i}
            type="button"
            aria-label={`Note ${i + 1} sur 10`}
            onClick={() => onChange && onChange(i + 1 === value ? 0 : i + 1)}
            className={`w-1.5 ${h} rounded-sm transition-colors motion-reduce:transition-none
              ${filled ? "bg-amber-400" : "bg-white/10"}
              ${onChange ? "hover:bg-amber-300 cursor-pointer" : "cursor-default"}`}
            style={{ height: `${40 + i * 6}%` }}
            disabled={!onChange}
          />
        );
      })}
    </div>
  );
}

export function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(null);
  const display = hovered ?? value;

  return (
    <div className="flex gap-1">
      {Array.from({ length: 10 }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i + 1 === value ? 0 : i + 1)}
          onMouseEnter={() => setHovered(i + 1)}
          onMouseLeave={() => setHovered(null)}
          className="text-amber-400 hover:scale-125 transition-transform motion-reduce:transition-none"
          aria-label={`Note ${i + 1} sur 10`}
        >
          {i < display
            ? <Star size={20} fill="currentColor" strokeWidth={0} />
            : <Star size={20} fill="none" strokeWidth={1.5} className="text-white/20" />
          }
        </button>
      ))}
    </div>
  );
}

/**
 * Composant de visualisation pour l'affichage des notes (image du compagnon
 * si disponible, sinon émoji) — wrapper pratique autour de RatingBadge.
 */
export function RatingDisplay({ value, companionId, className = "text-xl" }) {
  if (!value) return <span className="text-sm text-gray-400">Pas de note</span>;

  return (
    <div className="flex items-center gap-2">
      <RatingBadge rating={value} companionId={companionId} className={className} />
    </div>
  );
}
