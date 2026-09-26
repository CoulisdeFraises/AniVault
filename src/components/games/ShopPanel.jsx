import { useState, useMemo } from "react";
import { Sparkles, Target, Users, Coins, ChevronDown } from "lucide-react";
import {
  SHOP_CHANCE_COST, SHOP_TARGET_COST, SHOP_GENDER_COST, PACK_WEIGHTS, GENDER_BOOSTERS,
  filterPoolByGender, topSeries,
} from "../../utils/waifinity";
import { haptics } from "../../utils/haptics";

const mult = (tier) => Math.round(PACK_WEIGHTS.chance[tier] / PACK_WEIGHTS.free[tier]);

function ShopCard({ icon, title, desc, cost, canAfford, disabled, onBuy, hideBuyButton, children }) {
  return (
    <div className="rounded-2xl bg-violet-900/40 border border-white/10 p-4">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-violet-500/20 border border-violet-400/30 flex items-center justify-center flex-shrink-0 text-violet-200">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{title}</p>
          <p className="text-xs text-violet-300 mt-0.5">{desc}</p>
        </div>
      </div>
      {children}
      {!hideBuyButton && (
        <>
          <button
            onClick={onBuy}
            disabled={disabled || !canAfford}
            className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-400 text-violet-950 text-sm font-semibold disabled:opacity-35 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
          >
            <Coins size={14} />{cost} Anigold
          </button>
          {!canAfford && <p className="text-[10px] text-rose-300 text-center mt-1.5">Pas assez d'Anigold</p>}
        </>
      )}
    </div>
  );
}

export function ShopPanel({
  pool, pendingPack, canAffordChance, canAffordTarget, canAffordGender,
  onBuyChance, onBuyTargeted, onBuyGender,
}) {
  const [seriesOpen, setSeriesOpen] = useState(false);
  const series = useMemo(() => topSeries(pool), [pool]);
  const genderCounts = useMemo(
    () => Object.fromEntries(Object.keys(GENDER_BOOSTERS).map((g) => [g, filterPoolByGender(pool, g).length])),
    [pool]
  );
  const busy = !!pendingPack;

  return (
    <div className="space-y-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-violet-500">Boosters</p>

      <ShopCard
        icon={<Sparkles size={18} />}
        title="Booster Chance+"
        desc={`10 cartes avec de bien meilleures chances : environ ×${mult("legendary")} de Legendary et ×${mult("secret")} de Secret par rapport au booster gratuit.`}
        cost={SHOP_CHANCE_COST}
        canAfford={canAffordChance}
        disabled={busy || !pool.length}
        onBuy={() => { haptics.success(); onBuyChance(); }}
      />

      <ShopCard
        icon={<Users size={18} />}
        title="Booster Waifus ou Husbandos"
        desc="10 cartes uniquement ♀ (waifus) ou uniquement ♂ (husbandos), avec les chances du booster gratuit."
        hideBuyButton
      >
        <div className="mt-3 grid grid-cols-2 gap-2">
          {Object.entries(GENDER_BOOSTERS).map(([gender, cfg]) => (
            <button key={gender}
              onClick={() => { haptics.success(); onBuyGender(gender); }}
              disabled={busy || !canAffordGender || !genderCounts[gender]}
              className="flex flex-col items-center gap-0.5 py-2.5 rounded-xl bg-amber-400 text-violet-950 text-sm font-semibold disabled:opacity-35 disabled:cursor-not-allowed active:scale-[0.98] transition-transform motion-reduce:transition-none">
              <span>{gender === "female" ? "♀" : "♂"} {cfg.label}</span>
              <span className="flex items-center gap-1 text-[11px] font-medium"><Coins size={11} />{SHOP_GENDER_COST} Anigold</span>
            </button>
          ))}
        </div>
        {!canAffordGender && <p className="text-[10px] text-rose-300 text-center mt-1.5">Pas assez d'Anigold</p>}
      </ShopCard>

      <ShopCard
        icon={<Target size={18} />}
        title="Booster ciblé"
        desc={`10 cartes piochées uniquement dans une série de ton choix, avec les chances du Chance+ · ${SHOP_TARGET_COST} Anigold`}
        hideBuyButton
      >
        <button onClick={() => setSeriesOpen((v) => !v)} disabled={busy || !series.length}
          className="mt-3 w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-violet-200 disabled:opacity-40">
          Choisir une série
          <ChevronDown size={14} className={`transition-transform motion-reduce:transition-none ${seriesOpen ? "rotate-180" : ""}`} />
        </button>
        {seriesOpen && (
          <div className="mt-2 max-h-52 overflow-y-auto rounded-xl bg-violet-950/60 border border-white/10 divide-y divide-white/5">
            {series.map((s) => (
              <button key={s.seriesId}
                onClick={() => { if (busy || !canAffordTarget) return; haptics.success(); setSeriesOpen(false); onBuyTargeted(s.seriesId); }}
                disabled={busy || !canAffordTarget}
                className="w-full flex items-center justify-between px-3 py-2 text-left text-xs text-violet-100 hover:bg-white/5 disabled:opacity-40">
                <span className="truncate">{s.series}</span>
                <span className="font-mono text-violet-400 flex-shrink-0 ml-2">{s.count}</span>
              </button>
            ))}
          </div>
        )}
        {!canAffordTarget && <p className="text-[10px] text-rose-300 text-center mt-1.5">Pas assez d'Anigold</p>}
      </ShopCard>
    </div>
  );
}
