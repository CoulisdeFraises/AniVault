import { Calendar, Target, Star, Coins, HelpCircle, Heart } from "lucide-react";
import { Modal } from "../Modal/Modal";
import { RARITY, normalizeTier, SHOP_TARGET_COST, wishCost, isRecentlyObtained, MAX_FAVORITES, STATS, statGrade } from "../../utils/waifinity";
import { RarityBadge, RarityDot } from "./RarityBadge";
import { GenderBadge } from "./GenderBadge";
import { CardFrame } from "./CardFrame";
import { TiltCard } from "./TiltCard";
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
export function CharacterSheetModal({ character, entry, canAffordTarget, canAffordWish, busy, isFavorite, favoritesFull, onBuyTargeted, onBuyWish, onToggleFavorite, onClose }) {
  if (!character) return null;
  const owned = !!entry;
  const r = RARITY[normalizeTier(character.tier)];
  const count = entry?.count || 0;
  const stats = character.stats;

  return (
    <Modal
      onClose={onClose}
      maxWidth="max-w-md"
      zIndex="z-50"
      backdropClassName="bg-black/55 backdrop-blur-xl"
      panelClassName="bg-transparent overflow-x-hidden overflow-y-auto flex flex-col items-center"
    >
      <div className="px-4 sm:px-6 py-5 w-full flex flex-col items-center">
        {/* Vraie carte façon TCG, quasi plein écran : nom en haut, description
            en bas, toutes deux en surimpression sur l'image (plus de fond
            violet — juste le flou transparent du calque de la modale
            derrière). Inclinaison qui suit le doigt/la souris tant qu'on
            maintient dessus. */}
        <div className="relative w-full max-w-[340px] sm:max-w-[380px] mx-auto mb-3">
        {/* Halo : même boîte centrée que la carte, il ne suit donc jamais l'inclinaison */}
        <div aria-hidden="true" className="pointer-events-none absolute -inset-3 -z-10 rounded-[2rem] blur-2xl opacity-70"
          style={{ background: `radial-gradient(closest-side, ${owned ? r.glow : "rgba(139,92,246,0.25)"}, transparent 75%)` }} />
        <TiltCard className="w-full" holo={owned && r.shine}>
          <CardFrame tier={character.tier} className="relative w-full aspect-[5/7]"
            style={{ boxShadow: owned ? `0 0 30px -6px ${r.glow}` : `0 8px 30px -8px rgba(0,0,0,0.6)` }}>
            {owned ? (
              <>
                {character.image
                  ? <img src={character.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  : <div className="absolute inset-0 flex items-center justify-center text-violet-600 text-3xl">?</div>}
                {r.shine && <div className="card-shine" />}

                {/* Plaque de nom, en haut de la carte */}
                <div className="absolute inset-x-0 top-0 px-3.5 pt-3 pb-7 bg-gradient-to-b from-black/85 via-black/35 to-transparent">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xl font-bold text-white leading-tight truncate" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
                        {character.name}
                      </p>
                      <p className="text-[12px] text-violet-200/90 truncate">{character.series}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <RarityBadge tier={character.tier} size="md" />
                      {count > 1 && (
                        <span className="min-w-[22px] h-[20px] px-1 rounded-full bg-black/70 border border-white/20 text-white text-[11px] font-mono font-bold flex items-center justify-center">
                          ×{count}
                        </span>
                      )}
                      {isRecentlyObtained(entry) && (
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-violet-950 text-[9px] font-mono font-bold tracking-wide shadow">NEW</span>
                      )}
                      <GenderBadge gender={character.gender} />
                    </div>
                  </div>
                </div>

                {/* Plaque du bas : description + stats avec leur grade */}
                {(character.about || stats) && (
                  <div className="absolute inset-x-0 bottom-0 px-3.5 pt-14 pb-3 bg-gradient-to-t from-black/95 via-black/80 via-50% to-transparent">
                    {character.about && (
                      <p className={`text-[12px] leading-snug text-violet-100 overflow-y-auto ${stats ? "max-h-[3.6rem]" : "max-h-24"}`}>
                        {character.about}
                      </p>
                    )}
                    {stats && (
                      <div className="mt-2 grid grid-cols-7 gap-1">
                        {STATS.map(({ key, short, label }) => {
                          const v = stats[key];
                          if (v == null) return <div key={key} />;
                          const g = statGrade(v);
                          return (
                            <div key={key} title={label} className="flex flex-col items-center rounded-md bg-white/[0.08] border border-white/10 py-1">
                              <span className="text-[8px] font-mono tracking-wide text-violet-300/90">{short}</span>
                              <span className={`text-[16px] leading-tight font-bold ${g.cls}`} style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{g.letter}</span>
                              <span className="text-[9px] font-mono text-violet-200/70">{v}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                <HelpCircle size={52} className="text-violet-700" />
                <p className="text-xs text-violet-500">{character.series}</p>
              </div>
            )}
            {!owned && <div className="absolute top-2 left-2"><RarityBadge tier={character.tier} size="md" /></div>}
          </CardFrame>
        </TiltCard>
        </div>

        {owned && onToggleFavorite && (
          <div className="flex justify-center mb-2">
            <button
              onClick={() => { haptics.tap(); onToggleFavorite(character.id); }}
              disabled={!isFavorite && favoritesFull}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border active:scale-95 transition-colors motion-reduce:transition-none disabled:opacity-35 disabled:cursor-not-allowed
                ${isFavorite ? "bg-pink-400/15 border-pink-400/40 text-pink-300" : "bg-white/5 border-white/10 text-violet-300"}`}
            >
              <Heart size={12} fill={isFavorite ? "currentColor" : "none"} />
              {isFavorite ? "Dans mes favoris" : favoritesFull ? `Favoris complets (${MAX_FAVORITES})` : "Ajouter aux favoris"}
            </button>
          </div>
        )}

        <div className="w-full max-w-[380px]">
        <p className={`flex items-center justify-center gap-1.5 text-[11px] mb-3 ${r.text}`}><RarityDot tier={character.tier} size={7} />{r.desc}</p>

        {owned ? (
          <div className="space-y-3">
            {entry?.firstObtainedAt && (
              <p className="flex items-center justify-center gap-1.5 text-xs text-violet-400">
                <Calendar size={12} />
                Obtenu le {new Date(entry.firstObtainedAt).toLocaleDateString("fr-FR")}
              </p>
            )}
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-violet-400 text-center">
              Personnage non obtenu — sa fiche complète se débloque une fois obtenu.
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
      </div>
    </Modal>
  );
}
