import { useState } from "react";
import { Star } from "lucide-react";

export function getRatingEmoji(rating) {
  if (!rating) return null;
  if (rating <= 2) return "😭";
  if (rating <= 4) return "😞";
  if (rating === 5) return "😐";
  if (rating <= 7) return "😊";
  if (rating <= 9) return "😁";
  return "🤩";
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