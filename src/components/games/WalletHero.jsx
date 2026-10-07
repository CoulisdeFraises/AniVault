import { Coins, Gem, Layers } from "lucide-react";
import { useCountUp } from "../../hooks/useCountUp";
import { CurrencyPill } from "./ui";

const HEADING = { fontFamily: "'Space Grotesk',sans-serif" };

function ProgressBar({ pct, owned, thin = false }) {
  return (
    <div className={`${thin ? "h-1.5" : "h-2.5"} rounded-full bg-black/25 overflow-hidden ring-1 ring-white/5`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-amber-300 via-amber-400 to-fuchsia-500 shadow-[0_0_12px_rgba(251,191,36,0.45)] transition-[width] duration-700 motion-reduce:transition-none"
        style={{ width: `${Math.max(pct, owned ? 2 : 0)}%` }}
      />
    </div>
  );
}

/**
 * Solde + progression de la collection.
 *  - `compact` (écrans secondaires) : une ligne, pour garder le solde sous les yeux
 *    sans voler de place ;
 *  - par défaut (écran Boosters, point d'entrée du jeu) : bloc complet avec halos,
 *    dans le même esprit que les dégradés de l'Agenda.
 */
export function WalletHero({ game, compact = false }) {
  const owned = game.collectionList.length;
  const total = game.pool.length;
  const pct = total ? Math.min(100, (owned / total) * 100) : 0;
  const pctLabel = `${pct < 10 ? pct.toFixed(1) : Math.round(pct)} %`;
  const coins = useCountUp(game.coins);
  const opened = game.stats.opened;

  if (compact) {
    return (
      <div className="mb-5 flex items-center gap-2.5">
        <CurrencyPill icon={Coins} value={coins.toLocaleString("fr-FR")} label="Anigold" />
        <CurrencyPill icon={Gem} value={game.fragments} label="Fragments" tone="violet" />
        <div className="ml-auto flex items-center gap-2 min-w-0 flex-1 max-w-[11rem]">
          <div className="flex-1 min-w-0"><ProgressBar pct={pct} owned={owned} thin /></div>
          <span className="text-[11px] text-violet-300 tabular-nums flex-shrink-0">{owned}{total ? `/${total}` : ""}</span>
        </div>
      </div>
    );
  }

  return (
    <section
      className="relative mb-5 overflow-hidden rounded-3xl border border-white/[0.12] p-4 sm:p-5
        bg-gradient-to-br from-violet-700/55 via-violet-900/55 to-violet-950/70
        shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_40px_-20px_rgba(0,0,0,0.8)]"
    >
      {/* halos : même vocabulaire que le fond de l'Agenda */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-12 w-56 h-56 rounded-full bg-amber-400/[0.12] blur-3xl" />
      </div>

      <div className="relative flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-violet-200">Solde</p>
          <p className="mt-0.5 flex items-baseline gap-2 text-[2.1rem] leading-none font-bold text-amber-200 tabular-nums" style={HEADING}>
            <Coins size={26} className="self-center flex-shrink-0 text-amber-300" aria-hidden="true" />
            {coins.toLocaleString("fr-FR")}
            <span className="text-sm font-medium text-amber-100/70">Anigold</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <CurrencyPill icon={Gem} value={game.fragments} label="Fragments" tone="violet" />
          <span className="flex items-center gap-1 text-[11px] text-violet-300 tabular-nums">
            <Layers size={11} aria-hidden="true" />{opened} booster{opened > 1 ? "s" : ""} ouvert{opened > 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <div className="relative mt-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-violet-200">Collection</span>
          <span className="text-violet-50 tabular-nums">
            {owned}{total ? ` / ${total}` : ""}
            {total > 0 && <span className="ml-2 text-amber-200">{pctLabel}</span>}
          </span>
        </div>
        <ProgressBar pct={pct} owned={owned} />
      </div>
    </section>
  );
}
