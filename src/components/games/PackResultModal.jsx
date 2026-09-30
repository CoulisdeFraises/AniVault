import { createPortal } from "react-dom";
import { Coins, PackageCheck, Trophy } from "lucide-react";
import { Modal } from "../Modal/Modal";
import { Confetti } from "../common/Confetti";
import { RARITY, normalizeTier } from "../../utils/waifinity";
import { CardFrame } from "./CardFrame";

/**
 * Récap d'un booster récupéré : les 10 cartes sont maintenant dans la
 * collection. Chaque carte indique si elle est NOUVELLE ou si c'était un
 * doublon (converti en Anigold), puis on affiche le total de pièces gagnées et
 * les éventuelles séries complétées (voir claimPackCards dans
 * utils/waifinity.js). Des confettis soulignent un NOUVEAU personnage
 * Legendary/Secret ou une série complétée — posés via un portail sur <body>
 * pour rester en plein écran malgré le `transform` du panneau de la Modal.
 */
export function PackResultModal({ results, onClose }) {
  const newCount = results.filter((r) => !r.isDuplicate).length;
  const dupCount = results.length - newCount;
  const dupCoins = results.reduce((sum, r) => sum + r.coinsGained, 0);
  const seriesBonuses = results.map((r) => r.seriesBonus).filter(Boolean);
  const bonusCoins = seriesBonuses.reduce((sum, b) => sum + b.coins, 0);
  const totalCoins = dupCoins + bonusCoins;

  const hasNewSecret = results.some((r) => !r.isDuplicate && r.card.tier === "secret");
  const hasNewTop = results.some((r) => !r.isDuplicate && (r.card.tier === "legendary" || r.card.tier === "secret"));
  const showConfetti = hasNewTop || seriesBonuses.length > 0;

  return (
    <>
      {showConfetti && createPortal(
        <Confetti active intensity={seriesBonuses.length > 0 || hasNewSecret ? "series" : "season"} />,
        document.body
      )}
      <Modal onClose={onClose} maxWidth="max-w-md" zIndex="z-50">
        <div className="p-5 text-center">
          <div className="flex items-center justify-center gap-2 text-teal-300 mb-1">
            <PackageCheck size={18} />
            <p className="font-mono text-[11px] uppercase tracking-widest">Booster ajouté à ta collection</p>
          </div>
          <p className="text-sm text-violet-200 mb-4">
            <span className="font-semibold text-white">{newCount}</span> nouveau{newCount > 1 ? "x" : ""}
            {dupCount > 0 && <> · <span className="font-semibold text-white">{dupCount}</span> doublon{dupCount > 1 ? "s" : ""}</>}
          </p>

          <div className="grid grid-cols-5 gap-1.5 mb-4">
            {results.map(({ card, isDuplicate, coinsGained }, i) => {
              const r = RARITY[normalizeTier(card.tier)];
              return (
                <div key={card.packSlot ?? i} className="relative aspect-[3/4] animate-popIn" style={{ animationDelay: `${i * 40}ms` }}>
                  <CardFrame tier={card.tier} className="relative w-full h-full" style={{ boxShadow: `0 0 10px -3px ${r.glow}` }}>
                    {card.image
                      ? <img src={card.image} alt={card.name} loading="lazy" className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-violet-900 flex items-center justify-center text-violet-600">?</div>}
                    <span className={`absolute bottom-0 inset-x-0 text-[8.5px] font-bold leading-4 ${
                      isDuplicate ? "bg-amber-400/90 text-violet-950" : "bg-teal-400/90 text-violet-950"}`}>
                      {isDuplicate ? `+${coinsGained}` : "NEW"}
                    </span>
                  </CardFrame>
                </div>
              );
            })}
          </div>

          {totalCoins > 0 && (
            <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-300 text-sm font-semibold mb-3">
              <Coins size={16} />+{totalCoins} Anigold
              {dupCoins > 0 && bonusCoins > 0 && <span className="text-[11px] font-medium text-amber-200/70">({dupCoins} doublons + {bonusCoins} bonus)</span>}
            </div>
          )}

          {seriesBonuses.map((b) => (
            <div key={b.key}
              className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-400/15 to-fuchsia-500/15 border border-amber-400/40 text-amber-200 text-sm font-semibold mb-3">
              <Trophy size={16} className="flex-shrink-0" />
              <span>Série « {b.series} » complétée · +{b.coins} Anigold</span>
            </div>
          ))}

          <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-amber-400 text-violet-950 text-sm font-semibold active:scale-[0.98]">
            Continuer
          </button>
        </div>
      </Modal>
    </>
  );
}
