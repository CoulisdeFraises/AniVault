import { Calendar, Target, Star, Coins, HelpCircle } from "lucide-react";
import { Modal } from "../Modal/Modal";
import { RARITY, normalizeTier, SHOP_TARGET_COST, wishCost } from "../../utils/waifinity";
import { RarityBadge } from "./RarityBadge";
import { GenderBadge } from "./GenderBadge";
import { haptics } from "../../utils/haptics";

/**
 * Fiche personnage (description courte tirée de MyAnimeList, voir
 * scripts/sync-waifu-pool.mjs) : ouverte au tap d'une carte depuis "Ma collection" ou
 * l'onglet Explorer (voir CollectionGrid / SeriesExplorer). `character` vient
 * du bassin (image, favoris, série, rareté…), `entry` de la collection du
 * joueur (compteur, date d'obtention) — absent si le personnage n'est pas
 * encore possédé.
 *
 * Non obtenu → fiche verrouillée : pas d'image, pas de lien MAL, mais deux
 * raccourcis pour tenter de l'obtenir : un vœu (garantit CE personnage précis
 * dans les 10 cartes du prochain booster, cher, scalé par palier) ou un
 * booster ciblé sur sa série (moins cher, pas garanti) — mêmes actions que
 * dans la Boutique, juste accessibles sans changer d'onglet.
 */
export function CharacterSheetModal({ character, entry, canAffordTarget, canAffordWish, busy, onBuyTargeted, onBuyWish, onClose }) {
  if (!character) return null;
  const owned = !!entry;
  const r = RARITY[normalizeTier(character.tier)];
  const count = entry?.count || 0;

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm" zIndex="z-50">
      <div className="p-5">
        <div
          className={`relative w-40 h-56 mx-auto rounded-2xl overflow-hidden border-2 ${r.border} mb-4`}
          style={owned ? { boxShadow: `0 0 26px -4px ${r.glow}` } : undefined}
        >
          {owned ? (
            <>
              {character.image
                ? <img src={character.image} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-violet-900/40 flex items-center justify-center text-violet-600 text-2xl">?</div>}
              {r.shine && <div className="card-shine" />}
              {count > 1 && (
                <span className="absolute top-1.5 right-1.5 min-w-[22px] h-[22px] px-1.5 rounded-full bg-black/70 text-white text-[11px] font-mono font-bold flex items-center justify-center">
                  ×{count}
                </span>
              )}
            </>
          ) : (
            <div className="w-full h-full bg-violet-900/40 flex items-center justify-center">
              <HelpCircle size={40} className="text-violet-700" />
            </div>
          )}
          <div className="absolute top-1.5 left-1.5"><RarityBadge tier={character.tier} size="md" /></div>
        </div>

        <div className="text-center">
          <p className={`text-[11px] mb-1 ${r.text}`}>{r.emoji} {r.desc}</p>
          <div className="flex items-center justify-center gap-1.5">
            <p className="text-lg font-bold text-white" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
              {owned ? character.name : "???"}
            </p>
            {owned && <GenderBadge gender={character.gender} />}
          </div>
          <p className="text-xs text-violet-400 mt-0.5">{character.series}</p>
        </div>

        {owned ? (
          <div className="mt-4 space-y-3">
            {character.about && (
              <p className="max-h-32 overflow-y-auto text-[12.5px] leading-relaxed text-violet-200 text-left rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5">
                {character.about}
              </p>
            )}
            {entry?.firstObtainedAt && (
              <p className="flex items-center justify-center gap-1.5 text-xs text-violet-400">
                <Calendar size={12} />
                Adopté le {new Date(entry.firstObtainedAt).toLocaleDateString("fr-FR")}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-violet-400 text-center">
              Personnage non obtenu — sa fiche complète se débloque une fois adopté.
            </p>

            {onBuyWish && (() => {
              const cost = wishCost(character.tier);
              const afford = canAffordWish ? canAffordWish(character.tier) : false;
              return (
                <>
                  <button
                    onClick={() => { if (busy || !afford) return; haptics.success(); onBuyWish(character); onClose(); }}
                    disabled={busy || !afford}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-400 text-violet-950 text-sm font-semibold disabled:opacity-35 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
                  >
                    <Star size={14} fill="currentColor" />Vœu sur ce personnage
                    <span className="flex items-center gap-0.5"><Coins size={12} />{cost}</span>
                  </button>
                  <p className="text-[10px] text-violet-500 text-center -mt-1.5">Garanti dans les 10 cartes du prochain booster.</p>
                  {!afford && <p className="text-[10px] text-rose-300 text-center">Pas assez d'Anigold</p>}
                </>
              );
            })()}

            {character.seriesId != null && onBuyTargeted && (
              <>
                <button
                  onClick={() => { if (busy || !canAffordTarget) return; haptics.success(); onBuyTargeted(character.seriesId); onClose(); }}
                  disabled={busy || !canAffordTarget}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-violet-100 text-sm font-semibold disabled:opacity-35 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
                >
                  <Target size={14} />Booster ciblé · {character.series}
                  <span className="flex items-center gap-0.5"><Coins size={12} />{SHOP_TARGET_COST}</span>
                </button>
                {!canAffordTarget && <p className="text-[10px] text-rose-300 text-center">Pas assez d'Anigold</p>}
              </>
            )}
          </div>
        )}

        <button onClick={onClose} className="w-full mt-5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-violet-200 text-sm font-semibold active:scale-[0.98]">
          Fermer
        </button>
      </div>
    </Modal>
  );
}
