import { useState } from "react";
import { Sparkles, Target, Coins, ChevronDown } from "lucide-react";
import {
  SHOP_CHANCE_COST, SHOP_TARGET_COST, PACK_WEIGHTS, GENDER_PREF_LABEL, topSeries,
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
            <Coins size={14} />{cost} Waifu Coins
          </button>
          {!canAfford && <p className="text-[10px] text-rose-300 text-center mt-1.5">Pas assez de pièces</p>}
        </>
      )}
    </div>
  );
}

export function ShopPanel({ activePool, genderPref, pendingPack, canAffordChance, canAffordTarget, onBuyChance, onBuyTargeted }) {
  const [seriesOpen, setSeriesOpen] = useState(false);
  const series = topSeries(activePool);
  const busy = !!pendingPack;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-widest text-violet-500">Boosters</p>
        {genderPref !== "all" && (
          <p className="text-[11px] text-violet-400">Tirage : {GENDER_PREF_LABEL[genderPref]} <span className="text-violet-500">(modifiable dans Boosters)</span></p>
        )}
      </div>

      <ShopCard
        icon={<Sparkles size={18} />}
        title="Booster Chance+"
        desc={`10 cartes avec de bien meilleures chances : environ ×${mult("legendary")} de Legendary et ×${mult("secret")} de Secret par rapport au booster gratuit.`}
        cost={SHOP_CHANCE_COST}
        canAfford={canAffordChance}
        disabled={busy || !activePool.length}
        onBuy={() => { haptics.success(); onBuyChance(); }}
      />

      <ShopCard
        icon={<Target size={18} />}
        title="Booster ciblé"
        desc={`10 cartes piochées uniquement dans une série de ton choix, avec les chances du Chance+ · ${SHOP_TARGET_COST} Waifu Coins`}
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
        {!canAffordTarget && <p className="text-[10px] text-rose-300 text-center mt-1.5">Pas assez de pièces</p>}
      </ShopCard>
    </div>
  );
}
