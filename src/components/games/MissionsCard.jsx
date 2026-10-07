import { Check, Gift, Coins, Gem, Target } from "lucide-react";
import { MISSION_BONUS } from "../../utils/waifinityMissions";
import { haptics } from "../../utils/haptics";
import { GameButton, Panel } from "./ui";

const HEADING = { fontFamily: "'Space Grotesk',sans-serif" };

/**
 * Missions du jour (voir utils/waifinityMissions.js) : 3 objectifs qui se
 * remettent à zéro chaque jour, chacun avec sa récompense en Anigold, et un
 * bonus (Anigold + fragments) quand les 3 sont récupérées. La progression se
 * met à jour toute seule pendant le jeu ; le joueur récupère chaque
 * récompense d'un tap quand la barre est pleine.
 */
export function MissionsCard({ missions, onClaim, onClaimBonus, busy, ready }) {
  const { list, allClaimed, bonusClaimed } = missions;
  if (!list.length) return null;
  const doneCount = list.filter((m) => m.claimed).length;

  return (
    <Panel>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-white" style={HEADING}>
            <Target size={14} className="text-amber-300" />Missions du jour
          </p>
          <p className="text-xs text-violet-300 mt-0.5">{doneCount}/{list.length} terminées · nouvelles missions demain</p>
        </div>
      </div>

      <ul className="mt-3 space-y-2">
        {list.map((m) => {
          const pct = Math.min(100, (m.progress / m.target) * 100);
          return (
            <li key={m.id} className="rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className={`text-[13px] leading-tight ${m.claimed ? "text-violet-500 line-through" : "text-violet-50"}`}>{m.label}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden"
                      role="progressbar" aria-valuemin={0} aria-valuemax={m.target} aria-valuenow={m.progress} aria-label={m.label}>
                      <div className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${m.done ? "bg-emerald-400" : "bg-gradient-to-r from-amber-400 to-fuchsia-500"}`}
                        style={{ width: `${Math.max(pct, m.progress ? 4 : 0)}%` }} />
                    </div>
                    <span className="font-mono text-[10px] text-violet-300 tabular-nums">{m.progress}/{m.target}</span>
                  </div>
                </div>

                {m.claimed ? (
                  <span className="flex-shrink-0 flex items-center gap-1 text-[11px] text-emerald-300"><Check size={13} />Reçu</span>
                ) : (
                  <GameButton
                    size="sm" className="flex-shrink-0"
                    onClick={() => { haptics.success(); onClaim(m.id); }}
                    disabled={!m.done || busy || !ready}
                  >
                    {m.done ? <Gift size={12} /> : <Coins size={12} />}+{m.reward}
                  </GameButton>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className={`mt-3 flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
        allClaimed && !bonusClaimed ? "border-amber-400/50 bg-amber-400/10" : "border-white/10 bg-white/[0.03]"}`}>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-violet-100">Bonus des 3 missions</p>
          <p className="flex items-center gap-2 text-[11px] text-violet-300 mt-0.5">
            <span className="flex items-center gap-1"><Coins size={10} className="text-amber-400" />{MISSION_BONUS.coins}</span>
            <span className="flex items-center gap-1"><Gem size={10} className="text-violet-300" />{MISSION_BONUS.fragments}</span>
          </p>
        </div>
        {bonusClaimed ? (
          <span className="flex items-center gap-1 text-[11px] text-emerald-300"><Check size={13} />Reçu</span>
        ) : (
          <GameButton
            size="sm"
            onClick={() => { haptics.success(); onClaimBonus(); }}
            disabled={!allClaimed || busy || !ready}
          >
            <Gift size={12} />Récupérer
          </GameButton>
        )}
      </div>
    </Panel>
  );
}
