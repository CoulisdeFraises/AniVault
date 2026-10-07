import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Clock, RefreshCw, AlertTriangle, Coins, ChevronDown, Check, Gift } from "lucide-react";
import {
  RARITY, RARITY_ORDER, PACK_WEIGHTS, FREE_COOLDOWN_HOURS, FREE_COOLDOWN_MS, SHOP_BOOSTER_COST,
  DAILY_REWARDS, NEW_CARD_COINS, SERIES_MIN_SIZE, SERIES_BONUS_CAP,
  countByTier, formatCountdown, formatPercent,
} from "../../utils/waifinity";
import { RarityDot } from "./RarityBadge";
import { MissionsCard } from "./MissionsCard";
import { GameButton, Panel } from "./ui";
import { haptics } from "../../utils/haptics";

const HEADING = { fontFamily: "'Space Grotesk',sans-serif" };

/** Récompense quotidienne : série de 7 jours, le 7e rapporte le plus. */
function DailyReward({ daily, onClaim, busy, ready }) {
  const { claimed, streak, nextStreak, reward } = daily;
  return (
    <Panel tone={!claimed && ready ? "highlight" : "default"}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white" style={HEADING}>Récompense quotidienne</p>
          <p className="text-xs text-violet-300 mt-0.5">
            {claimed ? "C'est noté. Reviens demain pour garder ta série." : `Jour ${nextStreak} sur ${DAILY_REWARDS.length}`}
          </p>
        </div>
        {claimed ? (
          <span className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-200">
            <Check size={14} />Récupérée
          </span>
        ) : (
          <GameButton className="flex-shrink-0" onClick={() => { haptics.success(); onClaim(); }} disabled={busy || !ready}>
            <Gift size={14} />+{reward}
          </GameButton>
        )}
      </div>

      <ol className="mt-3 grid grid-cols-7 gap-1.5">
        {DAILY_REWARDS.map((amount, i) => {
          const day = i + 1;
          const done = claimed ? day <= streak : day < nextStreak;
          const current = !claimed && day === nextStreak;
          return (
            <li key={day}
              className={`flex flex-col items-center rounded-lg border py-1.5 ${
                current ? "border-amber-400/60 bg-amber-400/10"
                  : done ? "border-white/5 bg-white/[0.04]" : "border-white/10 bg-transparent"}`}>
              <span className={`text-[10px] ${current ? "text-amber-200" : "text-violet-400"}`}>J{day}</span>
              <span className={`mt-0.5 text-xs font-semibold tabular-nums ${
                done ? "text-violet-500" : current ? "text-amber-300" : day === DAILY_REWARDS.length ? "text-amber-200" : "text-violet-100"}`}>
                {done ? <Check size={13} className="mx-auto" /> : `+${amount}`}
              </span>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

/** Volet repliable (chances de tirage, récompenses…). */
function Disclosure({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <Panel flush className="overflow-hidden">
      <button
        onClick={() => { haptics.tap(); setOpen((v) => !v); }}
        className="w-full flex items-center justify-between px-4 py-3 text-left active:scale-[0.99] transition-transform motion-reduce:transition-none"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-violet-100">{title}</span>
        <ChevronDown size={15} className={`text-violet-400 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  );
}

const colHead = "w-14 text-right text-[11px] text-violet-400";

/** Onglet « Boosters » : récompense quotidienne, booster gratuit, chances et gains d'Anigold. */
export function BoostersTab({ game, onGoShop }) {
  const {
    pool, poolMeta, poolLoading, poolError, reloadPool,
    canOpenFree, cooldownMs, openFreeBooster,
    daily, claimDaily, walletBusy, walletReady,
    missions, claimMission, claimMissionBonus,
  } = game;

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
        <GameButton variant="danger" onClick={reloadPool}>Réessayer</GameButton>
      </div>
    );
  }

  const generatedAt = poolMeta?.generatedAt ? new Date(poolMeta.generatedAt).toLocaleDateString("fr-FR") : null;
  const waiting = !canOpenFree && cooldownMs > 0;
  const waitPct = waiting ? Math.min(100, Math.max(0, (1 - cooldownMs / FREE_COOLDOWN_MS) * 100)) : 100;

  return (
    <div className="space-y-4">
      {/* ── Booster gratuit ── */}
      <Panel tone={canOpenFree ? "highlight" : "default"} className="sm:p-5">
        <div className="flex items-center gap-4">
          <div className="relative w-14 h-[4.5rem] flex-shrink-0" aria-hidden="true">
            <span className="absolute inset-0 rounded-xl bg-violet-800 border border-white/15 -rotate-12 origin-bottom-left" />
            <span className="absolute inset-0 rounded-xl bg-violet-700 border border-white/15 -rotate-[4deg] origin-bottom-left" />
            <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-amber-400/25 to-fuchsia-500/25 border border-amber-400/40 rotate-[5deg] origin-bottom-left flex items-center justify-center">
              <Sparkles size={20} className="text-amber-300" />
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-white" style={HEADING}>Booster gratuit</p>
            <p className="text-xs text-violet-300 mt-0.5">
              10 personnages, tous ajoutés à ta collection. Un nouveau booster toutes les {FREE_COOLDOWN_HOURS} heures.
            </p>
          </div>
        </div>

        <GameButton
          size="lg" full
          onClick={() => { haptics.success(); openFreeBooster(); }}
          disabled={!canOpenFree}
          className="mt-4 overflow-hidden"
        >
          {waiting && (
            <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-white/10 transition-[width] duration-1000 ease-linear motion-reduce:transition-none" style={{ width: `${waitPct}%` }} />
          )}
          <span className="relative flex items-center gap-2">
            {canOpenFree
              ? <><Sparkles size={16} />Ouvrir le booster</>
              : waiting
                ? <><Clock size={16} />Prochain booster dans {formatCountdown(cooldownMs)}</>
                : "Aucun personnage disponible"}
          </span>
        </GameButton>

        {onGoShop && (
          <button onClick={() => { haptics.tap(); onGoShop(); }}
            className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-violet-300 hover:text-amber-300 active:scale-[0.98] transition-colors motion-reduce:transition-none">
            Envie d'en ouvrir plus ? Booster normal en boutique ·
            <Coins size={11} className="text-amber-400" />{SHOP_BOOSTER_COST}
          </button>
        )}
      </Panel>

      {/* ── Récompense quotidienne ── */}
      <DailyReward daily={daily} onClaim={claimDaily} busy={walletBusy} ready={walletReady} />

      {/* ── Missions du jour ── */}
      {missions && <MissionsCard missions={missions} onClaim={claimMission} onClaimBonus={claimMissionBonus} busy={walletBusy} ready={walletReady} />}

      {/* ── Chances de tirage ── */}
      <Disclosure title="Chances de tirage">
        <div className="flex items-center gap-2 px-4 pb-1 text-[11px] text-violet-400">
          <span className="flex-1">Rareté · personnages dans le bassin</span>
          <span className="w-20 text-right text-[11px] text-violet-400">Par carte</span>
        </div>
        <ul className="divide-y divide-white/5 px-4 pb-1.5">
          {RARITY_ORDER.map((t) => {
            const r = RARITY[t];
            return (
              <li key={t} className="flex items-center gap-2.5 py-1.5">
                <RarityDot tier={t} size={8} />
                <span className={`text-[13px] font-semibold flex-1 truncate ${r.text}`}>
                  {r.label}{tierCounts[t] ? <span className="font-normal text-violet-400"> · {tierCounts[t]}</span> : null}
                </span>
                <span className="w-20 text-right font-mono text-xs text-violet-100 tabular-nums">{formatPercent(PACK_WEIGHTS.standard[t])}</span>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-violet-400 px-4 pb-3">Les mêmes chances s'appliquent à tous les boosters. La rareté dépend du nombre de favoris du personnage sur MyAnimeList.</p>
      </Disclosure>

      {/* ── Gains d'Anigold ── */}
      <Disclosure title="Comment gagner de l'Anigold">
        <div className="flex items-center gap-2 px-4 pb-1 text-[11px] text-violet-400">
          <span className="flex-1">Par carte</span>
          <span className={colHead}>Nouvelle</span>
          <span className={colHead}>Doublon</span>
        </div>
        <ul className="divide-y divide-white/5 px-4 pb-1.5">
          {RARITY_ORDER.map((t) => (
            <li key={t} className="flex items-center gap-2.5 py-1.5">
              <RarityDot tier={t} size={8} />
              <span className={`text-[13px] font-semibold flex-1 truncate ${RARITY[t].text}`}>{RARITY[t].label}</span>
              <span className="w-14 text-right font-mono text-xs text-violet-100 tabular-nums">+{NEW_CARD_COINS[t]}</span>
              <span className="w-14 text-right font-mono text-xs text-violet-100 tabular-nums">+{RARITY[t].coinValue}</span>
            </li>
          ))}
        </ul>
        <ul className="px-4 pb-3 pt-1 space-y-1 text-xs text-violet-300">
          <li>Série complète (à partir de {SERIES_MIN_SIZE} personnages) : 40 + 8 par personnage, jusqu'à {SERIES_BONUS_CAP}.</li>
          <li>Récompense quotidienne : de {DAILY_REWARDS[0]} à {DAILY_REWARDS[DAILY_REWARDS.length - 1]} sur 7 jours.</li>
        </ul>
      </Disclosure>

      {/* ── Source du bassin ── */}
      <div className="flex items-center justify-between gap-3 px-1 text-xs text-violet-500">
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
