import { Sparkles } from "lucide-react";
import { CardFrame } from "./CardFrame";
import { COSMETIC_GRADES } from "../../utils/waifinityCosmetics";

export const SLOT_LABEL = { frame: "Cadre", effect: "Effet" };

const GRADE_STYLE = {
  1: "bg-white/[0.08] text-violet-200 border-white/15",
  2: "bg-sky-400/10 text-sky-200 border-sky-300/30",
  3: "bg-fuchsia-400/10 text-fuchsia-200 border-fuchsia-300/30",
  4: "bg-amber-400/15 text-amber-200 border-amber-300/40",
};

/** Pastille de grade (Classique → Légendaire) d'un cosmétique. */
export function GradeChip({ grade = 1, className = "" }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wide ${GRADE_STYLE[grade] || GRADE_STYLE[1]} ${className}`}>
      {COSMETIC_GRADES[grade]?.label || COSMETIC_GRADES[1].label}
    </span>
  );
}

/**
 * Aperçu d'un cosmétique sur une vraie carte (celle du joueur si on la connaît,
 * sinon un dégradé neutre). `cosmetic` = { frame, effect } (ids). La largeur est
 * donnée par l'appelant (className).
 */
export function CosmeticPreview({ cosmetic, card, tier = "rare", className = "" }) {
  return (
    <CardFrame tier={card?.tier || tier} cosmetic={cosmetic} className={`relative aspect-[3/4] w-full ${className}`}>
      {card?.image ? (
        <img src={card.image} alt="" loading="lazy" draggable={false} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-fuchsia-800 to-violet-900 flex items-center justify-center text-white/25">
          <Sparkles size={28} />
        </div>
      )}
    </CardFrame>
  );
}
