import { useEffect, useState } from "react";
import { Sparkles, Copy, Star } from "lucide-react";
import { RARITY, normalizeTier } from "../../utils/waifinity";
import { RarityBadge } from "./RarityBadge";
import { GenderBadge } from "./GenderBadge";
import { CardFrame } from "./CardFrame";
import { ScreenFlash } from "./ScreenFlash";
import { haptics } from "../../utils/haptics";

/**
 * Le retour visuel du tap (scale) est posé sur le <button> et NON sur les
 * faces : `active:scale-95` y écraserait leur `transform` (dont le
 * rotateY(180deg) de la face révélée) et la carte disparaîtrait tant que le
 * doigt reste dessus (backface-visibility: hidden).
 *
 * Carte d'un booster : face cachée (mystère, tap pour révéler) puis face
 * révélée (personnage + rareté). Toutes les cartes du booster sont conservées.
 * Les cartes Legendary et Secret ont un reflet animé et une petite vibration
 * à la révélation. Un halo pulsant derrière la carte (intensité/vitesse
 * selon la rareté — voir RARITY dans utils/waifinity.js) attire l'œil sur
 * les tirages les plus rares. `isDuplicate` affiche un petit badge si ce
 * personnage est déjà dans la collection (ou apparaît une 2e fois dans ce
 * même booster) — calculé par le parent (PackOpening).
 */
export function BoosterCard({ card, revealed, isDuplicate, onReveal }) {
  const r = RARITY[normalizeTier(card.tier)];
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (revealed && r.shine) haptics.success();
  }, [revealed]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleClick() {
    if (revealed) return;
    haptics.light();
    // Flash plein écran à la couleur du palier (Epic et au-dessus) — joué en
    // plein retournement de la carte. Pas de flash sur « Tout révéler » (voir PackOpening).
    if (r.flashPeak) setFlash(true);
    onReveal();
  }

  return (
    <button
      onClick={handleClick}
      className="relative aspect-[3/4] w-full [perspective:800px] active:scale-95 transition-transform motion-reduce:transition-none"
      aria-label={revealed ? `${card.name} — ${r.label}${isDuplicate ? " — déjà possédé" : ""}${card.wish ? " — ton vœu" : ""}` : "Révéler cette carte"}
    >
      {revealed && (
        <div
          className="card-aura absolute -inset-2 sm:-inset-2.5 rounded-2xl -z-10 pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${r.glow} 0%, transparent 72%)`,
            filter: "blur(10px)",
            animationDuration: `${r.auraDuration}s`,
            "--aura-peak": r.auraPeak,
          }}
          aria-hidden="true"
        />
      )}
      <div
        className="relative w-full h-full transition-transform duration-500 motion-reduce:transition-none [transform-style:preserve-3d]"
        style={{ transform: revealed ? "rotateY(180deg)" : "rotateY(0deg)" }}
      >
        {/* ── Face cachée ── */}
        <div className="absolute inset-0 [backface-visibility:hidden] rounded-xl overflow-hidden
          bg-gradient-to-br from-violet-800 to-violet-950 border border-white/15 flex items-center justify-center">
          <div className="absolute inset-0 opacity-20"
            style={{ backgroundImage: "radial-gradient(circle at 30% 20%, white, transparent 40%)" }} />
          <Sparkles size={22} className="text-violet-300/70" />
        </div>

        {/* ── Face révélée ── */}
        <CardFrame
          tier={card.tier}
          className={`absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col
`}
          style={{ boxShadow: revealed ? `0 0 ${r.shine ? 22 : 16}px -2px ${r.glow}` : undefined }}
        >
          <div className="relative flex-1 min-h-0 bg-violet-900/60">
            {card.image
              ? <img src={card.image} alt="" loading="lazy" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-violet-600 text-2xl">?</div>}
            <div className="absolute top-1 left-1"><RarityBadge tier={card.tier} /></div>
            {isDuplicate && (
              <div
                className="absolute top-1 right-1 flex items-center justify-center w-5 h-5 rounded-full bg-black/65 border border-white/25 text-violet-100"
                title="Déjà dans ta collection — converti en Anigold"
                aria-hidden="true"
              >
                <Copy size={10.5} strokeWidth={2.5} />
              </div>
            )}
            {card.wish && (
              <div
                className="absolute bottom-1 right-1 flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 text-violet-950 shadow-md"
                title="Ton vœu"
                aria-hidden="true"
              >
                <Star size={10.5} strokeWidth={2.5} fill="currentColor" />
              </div>
            )}
            {r.shine && revealed && <div className="card-shine" />}
          </div>
          <div className="px-2 py-1.5 bg-black/30 text-left">
            <div className="flex items-center gap-1">
              <p className="text-[11px] font-semibold text-white leading-tight truncate flex-1">{card.name}</p>
              <GenderBadge gender={card.gender} />
            </div>
            <p className="text-[9.5px] text-violet-300 truncate">{card.series}</p>
          </div>
        </CardFrame>
      </div>
      {flash && <ScreenFlash tier={card.tier} onDone={() => setFlash(false)} />}
    </button>
  );
}
