import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Clock, RefreshCw, AlertTriangle, Coins, ChevronDown } from "lucide-react";
import {
  RARITY, RARITY_ORDER, PACK_WEIGHTS, FREE_COOLDOWN_HOURS, SHOP_GENDER_COST,
  countByTier, formatCountdown, formatPercent,
} from "../../utils/waifinity";
import { haptics } from "../../utils/haptics";

/** Onglet « Boosters » : booster gratuit (toutes les 3 h) et volet des chances. */
export function BoostersTab({ game, onGoShop }) {
  const {
    pool, poolMeta, poolLoading, poolError, reloadPool,
    canOpenFree, cooldownMs, openFreeBooster,
  } = game;
  const [showOdds, setShowOdds] = useState(false);

  const tierCounts = useMemo(() => countByTier(pool), [pool]);

  if (poolLoading && !pool.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-violet-300">
        <RefreshCw size={22} className="animate-spin motion-reduce:animate-none" />
        <p className="text-sm">Chargement des personnages…</p>
      </div>
    );
  }
  if (poolError && !pool.length) {
    return (
      <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-center">
        <AlertTriangle size={22} className="mx-auto text-rose-300 mb-2" />
        <p className="text-sm text-rose-200 mb-3">{poolError}</p>
        <button onClick={reloadPool} className="px-4 py-2 rounded-xl bg-rose-500/20 border border-rose-400/40 text-rose-100 text-sm active:scale-95">Réessayer</button>
      </div>
    );
  }

  const generatedAt = poolMeta?.generatedAt ? new Date(poolMeta.generatedAt).toLocaleDateString("fr-FR") : null;

  return (
    <div className="space-y-5">
      {/* ── Booster gratuit ── */}
      <div className="rounded-2xl bg-gradient-to-br from-violet-800/50 to-violet-950/50 border border-white/10 p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <div className="relative w-16 h-20 flex-shrink-0" aria-hidden="true">
            <span className="absolute inset-0 rounded-xl bg-violet-800 border border-white/15 -rotate-12 origin-bottom-left" />
            <span className="absolute inset-0 rounded-xl bg-violet-700 border border-white/15 -rotate-[4deg] origin-bottom-left" />
            <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-amber-400/25 to-fuchsia-500/25 border border-amber-400/40 rotate-[5deg] origin-bottom-left flex items-center justify-center">
              <Sparkles size={22} className="text-amber-300" />
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-white" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Booster gratuit</p>
            <p className="text-xs text-violet-300 mt-0.5">10 personnages à révéler, choisis-en un à adopter. Un booster gratuit toutes les {FREE_COOLDOWN_HOURS} heures.</p>
          </div>
        </div>

        <button
          onClick={() => { haptics.success(); openFreeBooster(); }}
          disabled={!canOpenFree}
          className="mt-5 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-400 text-violet-950 font-semibold disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-transform"
        >
          {canOpenFree
            ? <><Sparkles size={16} />Ouvrir le booster</>
            : cooldownMs > 0
              ? <><Clock size={16} />Disponible dans {formatCountdown(cooldownMs)}</>
              : <>Aucun personnage disponible</>}
        </button>

        {onGoShop && (
          <button onClick={() => { haptics.tap(); onGoShop(); }}
            className="mt-3 w-full flex items-center justify-center gap-1.5 text-[11px] text-violet-300 hover:text-amber-300 active:scale-[0.98] transition-colors motion-reduce:transition-none">
            Envie d'un booster Waifus ou Husbandos ? Boutique ·
            <Coins size={11} className="text-amber-400" />{SHOP_GENDER_COST} Anigold
          </button>
        )}
      </div>

      {/* ── Chances de tirage — volet repliable, compact ── */}
      <div className="rounded-2xl bg-violet-900/40 border border-white/10 overflow-hidden">
        <button
          onClick={() => { haptics.tap(); setShowOdds((v) => !v); }}
          className="w-full flex items-center justify-between px-4 py-3 active:scale-[0.99] transition-transform motion-reduce:transition-none"
          aria-expanded={showOdds}
        >
          <span className="font-mono text-[10px] uppercase tracking-widest text-violet-400">Raretés &amp; chances de tirage</span>
          <ChevronDown size={15} className={`text-violet-400 transition-transform motion-reduce:transition-none ${showOdds ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence initial={false}>
          {showOdds && (
            <motion.div
              key="odds"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 pb-1 font-mono text-[9px] uppercase tracking-wide text-violet-500">
                <span className="flex-1" />
                <span className="w-12 text-right">Gratuit</span>
                <span className="w-12 text-right">Chance+</span>
              </div>
              <ul className="divide-y divide-white/5 px-4 pb-1.5">
                {RARITY_ORDER.map((t) => {
                  const r = RARITY[t];
                  return (
                    <li key={t} className="flex items-center gap-2.5 py-1.5">
                      <span className="text-sm leading-none w-4 text-center" aria-hidden="true">{r.emoji}</span>
                      <span className={`text-[12px] font-semibold flex-1 truncate ${r.text}`}>
                        {r.label}{tierCounts[t] ? ` · ${tierCounts[t]}` : ""}
                      </span>
                      <span className="w-12 text-right font-mono text-[11px] text-violet-100">{formatPercent(PACK_WEIGHTS.free[t])}</span>
                      <span className="w-12 text-right font-mono text-[11px] text-violet-100">{formatPercent(PACK_WEIGHTS.chance[t])}</span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[10px] text-violet-500 px-4 pb-3">Chances par carte. La rareté dépend du nombre de favoris du personnage sur MyAnimeList.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Source du bassin ── */}
      <div className="flex items-center justify-between gap-3 px-1 text-[11px] text-violet-500">
        <p className="min-w-0">
          Bassin : {pool.length} personnages · MyAnimeList{generatedAt ? ` · ${generatedAt}` : ""}
          {import.meta.env.DEV && poolMeta?.source === "live" && (
            <span className="block text-amber-400/80">Mode secours (Supabase injoignable) — les personnages viennent d'AniList en direct.</span>
          )}
        </p>
        <button onClick={reloadPool} disabled={poolLoading}
          className="flex items-center gap-1 flex-shrink-0 text-violet-400 hover:text-violet-200 disabled:opacity-50 active:scale-95">
          <RefreshCw size={11} className={poolLoading ? "animate-spin motion-reduce:animate-none" : ""} />Actualiser
        </button>
      </div>
    </div>
  );
}
