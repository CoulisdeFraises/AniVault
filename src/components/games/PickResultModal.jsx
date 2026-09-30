import { createPortal } from "react-dom";
import { Coins, PartyPopper, Trophy, Star } from "lucide-react";
import { Modal } from "../Modal/Modal";
import { Confetti } from "../common/Confetti";
import { RARITY, normalizeTier } from "../../utils/waifinity";
import { CardFrame } from "./CardFrame";
import { RarityBadge } from "./RarityBadge";
import { GenderBadge } from "./GenderBadge";

/**
 * Écran d'adoption : la carte "pop" à l'ouverture (animate-popIn) plutôt que
 * de simplement apparaître avec le panneau de la modale. Une pluie de
 * confettis souligne un NOUVEAU personnage Legendary/Secret (pas un doublon),
 * ou une série tout juste complétée (result.seriesBonus, voir pickCard dans
 * useWaifinity) — posée via un portail direct sur <body> pour rester en plein
 * écran malgré le `transform` du panneau de la Modal (qui, sinon, la
 * recadrerait à la taille de la carte). Un nouveau Legendary/Secret gagne
 * aussi des rayons tournants derrière la carte, en plus des confettis.
 */
export function PickResultModal({ result, onClose }) {
  const { card, isDuplicate, coinsGained, seriesBonus } = result;
  const r = RARITY[normalizeTier(card.tier)];
  const isTopTier = card.tier === "legendary" || card.tier === "secret";
  const isNewTopTier = !isDuplicate && isTopTier;
  const showConfetti = isNewTopTier || !!seriesBonus;

  return (
    <>
      {showConfetti && createPortal(
        <Confetti active intensity={seriesBonus || card.tier === "secret" ? "series" : "season"} />,
        document.body
      )}
      <Modal onClose={onClose} maxWidth="max-w-xs" zIndex="z-50">
        <div className="p-5 text-center">
          <div className={`relative mx-auto mb-4 ${isNewTopTier ? "w-36 h-48" : "w-32 h-44"}`}>
            {isNewTopTier && (
              <div className="absolute -inset-14 overflow-hidden rounded-full pointer-events-none" aria-hidden="true">
                <svg viewBox="0 0 100 100"
                  className="rays absolute left-1/2 top-1/2 w-[150%] h-[150%] opacity-40">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <rect key={i} x="49" y="0" width="2" height="50" fill={r.glow}
                      transform={`rotate(${i * 30} 50 50)`} />
                  ))}
                </svg>
              </div>
            )}
            <CardFrame tier={card.tier} className={`relative w-full h-full animate-popIn`}
              style={{ boxShadow: `0 0 26px -4px ${r.glow}` }}>
              {card.image
                ? <img src={card.image} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-violet-900 flex items-center justify-center text-violet-600">?</div>}
              {r.shine && <div className="card-shine" />}
            </CardFrame>
          </div>

          <div className="flex justify-center mb-1.5"><RarityBadge tier={card.tier} size="md" /></div>
          <p className={`text-[11px] mb-2 ${r.text}`}>{r.emoji} {r.desc}</p>

          <div className="flex items-center justify-center gap-1.5">
            <p className="text-base font-bold text-white" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{card.name}</p>
            <GenderBadge gender={card.gender} />
          </div>
          <p className="text-xs text-violet-400">{card.series}</p>
          <div className="mb-4" />

          {isDuplicate ? (
            <div
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-300 text-sm font-semibold mb-4 animate-popIn"
              style={{ animationDelay: "0.12s" }}
            >
              <Coins size={16} />Déjà dans ta collection · +{coinsGained} Anigold
            </div>
          ) : (
            <div
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-teal-400/10 border border-teal-400/30 text-teal-300 text-sm font-semibold mb-4 animate-popIn"
              style={{ animationDelay: "0.12s" }}
            >
              {card.wish
                ? <><Star size={16} fill="currentColor" />Vœu exaucé !</>
                : <><PartyPopper size={16} />Nouveau personnage adopté !</>}
            </div>
          )}

          {seriesBonus && (
            <div
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-400/15 to-fuchsia-500/15 border border-amber-400/40 text-amber-200 text-sm font-semibold mb-4 animate-popIn"
              style={{ animationDelay: "0.22s" }}
            >
              <Trophy size={16} className="flex-shrink-0" />
              <span>Série « {seriesBonus.series} » complétée · +{seriesBonus.coins} Anigold</span>
            </div>
          )}

          <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-amber-400 text-violet-950 text-sm font-semibold active:scale-[0.98]">
            Continuer
          </button>
        </div>
      </Modal>
    </>
  );
}
