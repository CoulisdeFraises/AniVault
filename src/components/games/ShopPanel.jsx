import { useState, useMemo } from "react";
import { Sparkles, Target, Users, Coins, ChevronDown, Search, Star } from "lucide-react";
import {
  SHOP_BOOSTER_COST, SHOP_TARGET_COST, SHOP_GENDER_COST, GENDER_BOOSTERS,
  RARITY, RARITY_ORDER, WISH_COST, filterPoolByGender, topSeries,
} from "../../utils/waifinity";
import { RarityDot } from "./RarityBadge";
import { PillTabs } from "./PillTabs";
import { BannerCard } from "./BannerCard";
import { AtelierPanel } from "./AtelierPanel";
import { haptics } from "../../utils/haptics";
import { GameButton, Panel, SectionTitle } from "./ui";

const HEADING = { fontFamily: "'Space Grotesk',sans-serif" };

const SHOP_VIEWS = [
  { key: "boosters", label: "Boosters" },
  { key: "atelier",  label: "Atelier" },
];

function Group({ title, children }) {
  return (
    <section className="space-y-2.5">
      <SectionTitle title={title} />
      {children}
    </section>
  );
}

/** Prix + manque éventuel : l'utilisateur sait toujours combien il lui faut encore. */
function Price({ cost, coins }) {
  const missing = cost - coins;
  return (
    <span className="flex flex-col items-end leading-tight">
      <span className="flex items-center gap-1 font-semibold tabular-nums"><Coins size={13} />{cost}</span>
      {missing > 0 && <span className="text-[10px] font-medium opacity-80">{missing} de plus</span>}
    </span>
  );
}

function ShopCard({ icon, title, desc, children }) {
  return (
    <Panel as="div">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-300/25 to-violet-500/10 border border-violet-300/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] flex items-center justify-center flex-shrink-0 text-violet-100">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white" style={HEADING}>{title}</p>
          <p className="text-xs text-violet-300 mt-0.5">{desc}</p>
        </div>
      </div>
      {children}
    </Panel>
  );
}

export function ShopPanel({
  pool, pendingPack, coins = 0, canAffordBooster, canAffordTarget, canAffordGender,
  onBuyStandard, onBuyTargeted, onBuyGender,
  banner, canAffordBanner, onBuyBanner,
  fragments = 0, ownedCosmetics = [], onBuyCosmetic,
}) {
  const [view, setView] = useState("boosters");
  const [seriesOpen, setSeriesOpen] = useState(false);
  const [seriesQuery, setSeriesQuery] = useState("");
  const series = useMemo(() => topSeries(pool, 300), [pool]);
  const shownSeries = useMemo(() => {
    const q = seriesQuery.trim().toLowerCase();
    return (q ? series.filter((s) => s.series.toLowerCase().includes(q)) : series.slice(0, 40));
  }, [series, seriesQuery]);
  const genderCounts = useMemo(
    () => Object.fromEntries(Object.keys(GENDER_BOOSTERS).map((g) => [g, filterPoolByGender(pool, g).length])),
    [pool]
  );
  const busy = !!pendingPack;

  const viewTabs = (
    <div className="flex justify-center">
      <PillTabs tabs={SHOP_VIEWS} value={view} onChange={setView} layoutId="waifinity-shop-view" size="sm" tone="violet" />
    </div>
  );

  if (view === "atelier") {
    return (
      <div className="space-y-5">
        {viewTabs}
        <AtelierPanel fragments={fragments} owned={ownedCosmetics} onBuy={onBuyCosmetic} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {viewTabs}
      {banner && (
        <BannerCard banner={banner} coins={coins} busy={busy || !pool.length} canAfford={canAffordBanner} onBuy={onBuyBanner} />
      )}

      <Group title="Boosters aléatoires">
        <ShopCard
          icon={<Sparkles size={18} />}
          title="Booster normal"
          desc="10 cartes, toutes ajoutées à ta collection, avec les mêmes chances que le booster gratuit. Sans attendre les 3 heures."
        >
          <GameButton
            full className="mt-3 !justify-between"
            onClick={() => { haptics.success(); onBuyStandard(); }}
            disabled={busy || !pool.length || !canAffordBooster}
          >
            <span>Acheter</span><Price cost={SHOP_BOOSTER_COST} coins={coins} />
          </GameButton>
        </ShopCard>

        <ShopCard
          icon={<Users size={18} />}
          title="Booster Waifus ou Husbandos"
          desc="10 cartes uniquement ♀ ou uniquement ♂, avec les chances du booster normal."
        >
          <div className="mt-3 grid grid-cols-2 gap-2">
            {Object.entries(GENDER_BOOSTERS).map(([gender, cfg]) => (
              <GameButton key={gender}
                className="!flex-col !gap-0.5"
                onClick={() => { haptics.success(); onBuyGender(gender); }}
                disabled={busy || !canAffordGender || !genderCounts[gender]}>
                <span>{gender === "female" ? "♀" : "♂"} {cfg.label}</span>
                <span className="flex items-center gap-1 text-xs font-medium"><Coins size={11} />{SHOP_GENDER_COST}</span>
              </GameButton>
            ))}
          </div>
          {!canAffordGender && <p className="text-xs text-violet-400 text-center mt-2">Il te manque {SHOP_GENDER_COST - coins} Anigold.</p>}
        </ShopCard>
      </Group>

      <Group title="Boosters ciblés">
        <ShopCard
          icon={<Target size={18} />}
          title="Booster ciblé sur une série"
          desc={`10 cartes piochées uniquement dans la série de ton choix, avec les chances du booster normal.`}
        >
          <GameButton variant="secondary" full className="mt-3 !justify-between"
            onClick={() => setSeriesOpen((v) => !v)} disabled={busy || !series.length}
            aria-expanded={seriesOpen}>
            <span>Choisir une série</span>
            <span className="flex items-center gap-2 text-violet-300">
              <span className="flex items-center gap-1 text-xs tabular-nums"><Coins size={11} className="text-amber-400" />{SHOP_TARGET_COST}</span>
              <ChevronDown size={14} className={`transition-transform motion-reduce:transition-none ${seriesOpen ? "rotate-180" : ""}`} />
            </span>
          </GameButton>
          {seriesOpen && (
            <div className="mt-2 rounded-xl bg-violet-950/60 border border-white/10 overflow-hidden">
              <div className="relative border-b border-white/10">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-500 pointer-events-none" />
                <input value={seriesQuery} onChange={(e) => setSeriesQuery(e.target.value)}
                  placeholder="Chercher une série…"
                  className="w-full pl-8 pr-3 py-2 bg-transparent text-sm text-violet-50 placeholder-violet-500 focus:outline-none" />
              </div>
              <div className="max-h-52 overflow-y-auto divide-y divide-white/5">
                {shownSeries.length ? shownSeries.map((s) => (
                  <button key={s.seriesId}
                    onClick={() => { if (busy || !canAffordTarget) return; haptics.success(); setSeriesOpen(false); onBuyTargeted(s.seriesId); }}
                    disabled={busy || !canAffordTarget}
                    className="w-full flex items-center justify-between px-3 py-2 text-left text-sm text-violet-100 hover:bg-white/5 disabled:opacity-40">
                    <span className="truncate">{s.series}</span>
                    <span className="font-mono text-xs text-violet-400 flex-shrink-0 ml-2">{s.count} perso.</span>
                  </button>
                )) : <p className="px-3 py-3 text-xs text-violet-400">Aucune série ne correspond.</p>}
              </div>
            </div>
          )}
          {!canAffordTarget && <p className="text-xs text-violet-400 text-center mt-2">Il te manque {SHOP_TARGET_COST - coins} Anigold.</p>}
        </ShopCard>

        <ShopCard
          icon={<Star size={18} />}
          title="Vœu sur un personnage"
          desc="Garantit un personnage précis parmi les 10 cartes d'un booster normal. Ouvre sa fiche depuis Collection › Explorer pour faire ton vœu."
        >
          <ul className="mt-3 grid grid-cols-3 gap-1.5">
            {RARITY_ORDER.map((t) => (
              <li key={t} className="flex items-center justify-between gap-1 rounded-lg bg-white/[0.04] border border-white/10 px-2 py-1.5">
                <span className="flex items-center gap-1.5 min-w-0">
                  <RarityDot tier={t} size={7} />
                  <span className={`text-[11px] truncate ${RARITY[t].text}`}>{RARITY[t].label}</span>
                </span>
                <span className="font-mono text-[11px] text-violet-100 tabular-nums">{WISH_COST[t]}</span>
              </li>
            ))}
          </ul>
        </ShopCard>
      </Group>
    </div>
  );
}
