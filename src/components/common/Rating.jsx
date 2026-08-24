import { useState } from "react";
import { Star } from "lucide-react";

// CORRECTION : Ajustez le chemin pour pointer vers votre dossier utils/companions.js
import { RATING_EMOJIS, getCompanion } from "../../utils/companions"; // <--- PARENTHESES SUPPRIMÉES


/**
 * Retourne l'HTML (img ou span) correspondant à une note (1-10).
 * Utilise les images personnalisées si la config du compagnon le permet, sinon les émojis.
 */
export function getRatingIcon(rating, companionId) {
  if (!rating) return null;

  const id = companionId || (typeof localStorage !== "undefined" ? localStorage.getItem("pref_companion") : null) || "default";
  const companion = getCompanion(id);
  const emojis = RATING_EMOJIS[id] || RATING_EMOJIS.default;
  
  // Calcul de la tranche (0 à 5)
  const band = rating <= 2 ? 0 : rating <= 4 ? 1 : rating === 5 ? 2 : rating <= 7 ? 3 : rating <= 9 ? 4 : 5;

  // Déterminer le chemin d'image
  let imageSrc = null;
  
  if (companion?.imageFolder) {
    // Cas Chlo : les images sont dans /public/chlo/ directement
    const folderName = companion.imageFolder;
    const extension = window.location.search.includes("dev") ? "jpg" : "png"; 
    imageSrc = `/companions/${folderName}/rating-${band}.${extension}`;
  }

  // Retourner soit l'image, soit le placeholder emoji
  if (imageSrc) {
    return `<img src="${imageSrc}" alt="Note ${rating}" class="h-6 w-auto" loading="lazy" />`;
  } else {
    const emoji = emojis[band] || "";
    return `<span>${emoji}</span>`;
  }
}

/**
 * getRatingEmoji — Version retour texte (pour fallback ou debugging)
 */
export function getRatingEmoji(rating, companionId) {
  if (!rating) return null;
  const id = companionId || (typeof localStorage !== "undefined" ? localStorage.getItem("pref_companion") : null) || "default";
  const emojis = RATING_EMOJIS[id] || RATING_EMOJIS.default;

  // Mêmes seuils que getRatingIcon
  const band = rating <= 2 ? 0 : rating <= 4 ? 1 : rating === 5 ? 2 : rating <= 7 ? 3 : rating <= 9 ? 4 : 5;
  
  return emojis[band];
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
 * Composant de visualisation pour l'affichage des notes (à utiliser avec getRatingIcon)
 */
export function RatingDisplay({ value, companionId }) {
  const html = getRatingIcon(value, companionId);
  
  if (!html) return <span className="text-sm text-gray-400">Pas de note</span>;

  return (
    <div 
      className="flex items-center gap-2"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
