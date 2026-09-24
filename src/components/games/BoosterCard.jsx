import { Sparkles, Check } from "lucide-react";
import { RARITY } from "../../utils/waifinity";
import { RarityBadge } from "./RarityBadge";
import { haptics } from "../../utils/haptics";

/**
 * Carte d'un booster : face cachée (mystère, tap pour révéler) puis face
 * révélée (personnage + rareté). Une fois révélée, un nouveau tap la
 * sélectionne comme choix final (mise en avant par un anneau + coche).
 */
export function BoosterCard({ card, revealed, selected, onReveal, onSelect }) {
  const r = RARITY[card.tier] || RARITY.commune;

  function handleClick() {
    if (!revealed) { haptics.light(); onReveal(); return; }
    haptics.tap(); onSelect();
  }

  return (
    <button
      onClick={handleClick}
      className="relative aspect-[3/4] w-full [perspective:800px] group"
      aria-label={revealed ? `${card.name} — ${r.label}${selected ? " — sélectionnée" : ""}` : "Révéler cette carte"}
    >
      <div
        className="relative w-full h-full transition-transform duration-500 motion-reduce:transition-none [transform-style:preserve-3d]"
        style={{ transform: revealed ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        {/* ── Face cachée ── */}
        <div className="absolute inset-0 [backface-visibility:hidden] rounded-xl overflow-hidden
          bg-gradient-to-br from-violet-800 to-violet-950 border border-white/15 flex items-center justify-center
          active:scale-95 transition-transform motion-reduce:transition-none">
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: "radial-gradient(circle at 30% 20%, white, transparent 40%)" }} />
          <Sparkles size={22} className="text-violet-300/70" />
        </div>

        {/* ── Face révélée ── */}
        <div
          className={`absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] rounded-xl overflow-hidden
            border-2 ${r.border} bg-violet-950 flex flex-col active:scale-95 transition-transform motion-reduce:transition-none
            ${selected ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-violet-950" : ""}`}
          style={{ boxShadow: revealed ? `0 0 16px -2px ${r.glow}` : undefined }}
        >
          <div className="relative flex-1 min-h-0 bg-violet-900">
            {card.image
              ? <img src={card.image} alt="" loading="lazy" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-violet-600 text-2xl">?</div>}
            <div className="absolute top-1 left-1"><RarityBadge tier={card.tier} /></div>
            {selected && (
              <div className="absolute inset-0 bg-amber-400/15 flex items-center justify-center">
                <span className="w-7 h-7 rounded-full bg-amber-400 text-violet-950 flex items-center justify-center shadow-lg">
                  <Check size={16} strokeWidth={3} />
                </span>
              </div>
            )}
          </div>
          <div className="px-1.5 py-1 bg-black/40">
            <p className="text-[10px] font-semibold text-white leading-tight truncate">{card.name}</p>
            <p className="text-[8.5px] text-violet-300 truncate">{card.series}</p>
          </div>
        </div>
      </div>
    </button>
  );
}
