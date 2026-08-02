import { useState } from "react";
import { Star } from "lucide-react";
import { RATING_EMOJIS } from "../../utils/companions";

/**
 * getRatingEmoji — retourne l'émoji correspondant à une note (1-10), selon
 * le compagnon choisi sur le profil. Si `companionId` n'est pas fourni,
 * lit la préférence mise en cache (synchronisée depuis le profil Supabase
 * par AuthContext) pour un accès synchrone rapide dans les listes de cartes.
 */
export function getRatingEmoji(rating, companionId) {
  if (!rating) return null;
  const id = companionId || (typeof localStorage !== "undefined" ? localStorage.getItem("pref_companion") : null) || "default";
  const emojis = RATING_EMOJIS[id] || RATING_EMOJIS.default;
  const band =
    rating <= 2 ? 0 :
    rating <= 4 ? 1 :
    rating === 5 ? 2 :
    rating <= 7 ? 3 :
    rating <= 9 ? 4 : 5;
  return emojis[band];
}

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