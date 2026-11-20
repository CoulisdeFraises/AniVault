import { createPortal } from "react-dom";
import { Coins, PackageCheck, Trophy, Gem } from "lucide-react";
import { Modal } from "../Modal/Modal";
import { Confetti } from "../common/Confetti";
import { RARITY, normalizeTier } from "../../utils/waifinity";
import { CardFrame } from "./CardFrame";
import { GameButton } from "./ui";

const HEADING = { fontFamily: "'Space Grotesk',sans-serif" };

function Line({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-violet-300">{label}</span>
      <span className="font-semibold text-amber-300 tabular-nums">+{value}</span>
    </div>
  );
}

/**
 * Récap d'un booster récupéré : les 10 cartes sont dans la collection.
 * Chaque carte indique si elle est nouvelle ou si c'était un doublon, avec
 * l'Anigold qu'elle a rapporté. Le détail (nouveautés, doublons, séries) est
 * listé ligne par ligne pour que le total soit toujours lisible. Des confettis
 * soulignent un NOUVEAU Legendary/Secret ou une série complétée — via un
 * portail sur <body> pour rester plein écran malgré le `transform` du panneau.
 */
export function PackResultModal({ results, onClose }) {
  const newOnes = results.filter((r) => !r.isDuplicate);
  const dups = results.filter((r) => r.isDuplicate);
  const newCoins = newOnes.reduce((sum, r) => sum + r.coinsGained, 0);
  const dupCoins = dups.reduce((sum, r) => sum + r.coinsGained, 0);
  const seriesBonuses = results.map((r) => r.seriesBonus).filter(Boolean);
  const bonusCoins = seriesBonuses.reduce((sum, b) => sum + b.coins, 0);
  const totalCoins = newCoins + dupCoins + bonusCoins;
  const totalFragments = dups.reduce((sum, r) => sum + (r.fragmentsGained || 0), 0);

  const hasNewSecret = newOnes.some((r) => r.card.tier === "secret");
  const hasNewTop = newOnes.some((r) => r.card.tier === "legendary" || r.card.tier === "secret");
  const showConfetti = hasNewTop || seriesBonuses.length > 0;

  return (
    <>
      {showConfetti && createPortal(
        <Confetti active intensity={seriesBonuses.length > 0 || hasNewSecret ? "series" : "season"} />,
        document.body
      )}
      <Modal onClose={onClose} maxWidth="max-w-md" zIndex="z-50">
        <div className="p-5">
          <div className="text-center mb-4">
            <span className="mx-auto mb-2 flex w-12 h-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400/25 to-fuchsia-500/20 border border-amber-300/30 text-amber-200 shadow-[0_0_24px_-4px_rgba(251,191,36,0.5)]">
              <PackageCheck size={22} />
            </span>
            <h2 className="text-lg font-bold text-white" style={HEADING}>Booster ajouté à ta collection</h2>
            <p className="text-sm text-violet-300 mt-0.5">
              {newOnes.length} nouveau{newOnes.length > 1 ? "x" : ""}
              {dups.length > 0 && <> · {dups.length} doublon{dups.length > 1 ? "s" : ""}</>}
            </p>
          </div>

          <div className="grid grid-cols-5 gap-1.5 mb-4">
            {results.map(({ card, isDuplicate }, i) => {
              const r = RARITY[normalizeTier(card.tier)];
              return (
                <div key={card.packSlot ?? i} className="relative aspect-[3/4] animate-popIn" style={{ animationDelay: `${i * 40}ms` }}>
                  <CardFrame tier={card.tier} className="relative w-full h-full" style={{ boxShadow: `0 0 10px -3px ${r.glow}` }}>
                    {card.image
                      ? <img src={card.image} alt={card.name} loading="lazy" className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-violet-900 flex items-center justify-center text-violet-600">?</div>}
                    <span className={`absolute bottom-0 inset-x-0 text-[9px] font-bold leading-4 text-center ${
                      isDuplicate ? "bg-amber-400/90 text-violet-950" : "bg-teal-400/90 text-violet-950"}`}>
                      {isDuplicate ? "Doublon" : "Nouveau"}
                    </span>
                  </CardFrame>
                </div>
              );
            })}
          </div>

          {seriesBonuses.map((b) => (
            <div key={b.key}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-amber-400/15 to-fuchsia-500/15 border border-amber-400/40 text-amber-100 text-sm mb-3">
              <Trophy size={16} className="flex-shrink-0 text-amber-300" />
              <span className="min-w-0 flex-1">Série « {b.series} » complétée</span>
              <span className="font-semibold tabular-nums">+{b.coins}</span>
            </div>
          ))}

          {totalCoins > 0 && (
            <div className="rounded-xl bg-amber-400/10 border border-amber-400/25 px-3.5 py-3 mb-4 space-y-1.5">
              {newCoins > 0 && <Line label={`Nouveaux personnages (${newOnes.length})`} value={newCoins} />}
              {dupCoins > 0 && <Line label={`Doublons (${dups.length})`} value={dupCoins} />}
              {bonusCoins > 0 && <Line label="Séries complétées" value={bonusCoins} />}
              <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-2 mt-1">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-white"><Coins size={15} className="text-amber-400" />Total</span>
                <span className="text-base font-bold text-amber-300 tabular-nums">+{totalCoins} Anigold</span>
              </div>
            </div>
          )}

          {totalFragments > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-violet-500/10 border border-violet-400/25 px-3.5 py-2.5 mb-4 text-sm">
              <span className="flex items-center gap-1.5 text-violet-100"><Gem size={15} className="text-violet-300" />Fragments ({dups.length} doublon{dups.length > 1 ? "s" : ""})</span>
              <span className="font-bold text-violet-200 tabular-nums">+{totalFragments}</span>
            </div>
          )}

          <GameButton size="lg" full onClick={onClose}>Continuer</GameButton>
        </div>
      </Modal>
    </>
  );
}
