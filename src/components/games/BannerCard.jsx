import { useMemo } from "react";
import { Sparkles, Coins, CalendarDays } from "lucide-react";
import { RARITY, normalizeTier } from "../../utils/waifinity";
import { BANNER_COST, BANNER_RATE } from "../../utils/waifinityBanners";
import { CardFrame } from "./CardFrame";
import { RarityBadge } from "./RarityBadge";
import { haptics } from "../../utils/haptics";

const HEADING = { fontFamily: "'Space Grotesk',sans-serif" };
const PREVIEW_COUNT = 8;

/**
 * Bannière de saison (voir utils/waifinityBanners.js) : met en avant les
 * personnages des animes de la saison en cours, avec un aperçu défilant des
 * plus rares, et un booster dédié. Mêmes chances de rareté que le booster
 * normal — seule change la provenance d'une partie des cartes.
 */
export function BannerCard({ banner, coins, busy, canAfford, onBuy }) {
  const preview = useMemo(() => (banner ? banner.featured.slice(0, PREVIEW_COUNT) : []), [banner]);
  if (!banner) return null;
  const missing = BANNER_COST - coins;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-br from-fuchsia-900/50 via-violet-900/60 to-amber-900/20 p-4">
      <div aria-hidden="true" className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full bg-amber-400/20 blur-3xl" />

      <div className="relative flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center flex-shrink-0 text-amber-200">
          <CalendarDays size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-mono uppercase tracking-widest text-amber-300">Bannière de saison</p>
          <p className="text-base font-bold text-white leading-tight" style={HEADING}>{banner.label}</p>
          <p className="text-xs text-violet-200 mt-0.5">
            {banner.featured.length} personnages de {banner.seriesCount} anime{banner.seriesCount > 1 ? "s" : ""} du moment.
            Environ {Math.round(BANNER_RATE * 100)} % des cartes viennent de la bannière, avec les chances de rareté habituelles.
          </p>
        </div>
      </div>

      {/* Aperçu : les plus rares de la bannière */}
      <div className="relative mt-3 -mx-1 flex gap-2 overflow-x-auto snap-x px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list" aria-label="Personnages à l'honneur">
        {preview.map((c) => {
          const r = RARITY[normalizeTier(c.tier)];
          return (
            <div key={c.id} role="listitem" className="snap-start flex-shrink-0 w-[68px]">
              <CardFrame tier={c.tier} className="relative" style={{ boxShadow: `0 0 10px -3px ${r.glow}` }}>
                <div className="relative aspect-[3/4] bg-violet-900/60">
                  {c.image && <img src={c.image} alt={c.name} loading="lazy" draggable="false" className="w-full h-full object-cover" />}
                  <div className="absolute top-0.5 left-0.5 scale-75 origin-top-left"><RarityBadge tier={c.tier} /></div>
                </div>
              </CardFrame>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => { haptics.success(); onBuy(); }}
        disabled={busy || !canAfford}
        className="relative mt-3 w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-amber-400 text-violet-950 text-sm font-semibold disabled:bg-white/5 disabled:border disabled:border-white/10 disabled:text-violet-400 disabled:cursor-not-allowed active:scale-[0.98] transition-transform motion-reduce:transition-none"
      >
        <span className="flex items-center gap-1.5"><Sparkles size={14} />Booster de saison</span>
        <span className="flex flex-col items-end leading-tight">
          <span className="flex items-center gap-1 font-semibold tabular-nums"><Coins size={13} />{BANNER_COST}</span>
          {missing > 0 && <span className="text-[10px] font-medium opacity-80">{missing} de plus</span>}
        </span>
      </button>
    </section>
  );
}
