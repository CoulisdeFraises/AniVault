import { useState, useMemo } from "react";
import { AnimatePresence } from "motion/react";
import { PlayCircle, Clock, Flame, ChevronRight, Minus, Plus, X } from "lucide-react";
import { Modal } from "../Modal/Modal";
import { haptics } from "../../utils/haptics";
import { calcCurrentStreak } from "../../utils/watchTime";
import { calcBestStreak } from "../../utils/weekStats";

function Delta({ children, tone = "up" }) {
  const color = tone === "up" ? "text-emerald-400" : tone === "down" ? "text-rose-400" : "text-violet-400";
  return <p className={`font-mono text-[10px] mt-1 truncate ${color}`}>{children}</p>;
}

function Stat({ icon, tint, value, label, delta }) {
  return (
    <div className="flex-1 min-w-0 px-1.5 first:pl-0">
      <div className="flex items-center gap-1.5">
        <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${tint}`}>{icon}</span>
        <span className="font-mono text-xl font-bold tabular-nums text-white leading-none">{value}</span>
      </div>
      <p className="text-[9px] uppercase tracking-wide text-violet-300 mt-1.5 leading-tight">{label}</p>
      {delta}
    </div>
  );
}

function Ring({ pct }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
      <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
      <circle cx="32" cy="32" r={r} fill="none" stroke="#fbbf24" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, pct / 100))}
        className="transition-[stroke-dashoffset] duration-1000 ease-out motion-reduce:transition-none" />
    </svg>
  );
}

function GoalModal({ goal, onSave, onClose }) {
  const [value, setValue] = useState(goal);
  const step = (d) => { haptics.tap(); setValue((v) => Math.min(200, Math.max(1, v + d))); };
  return (
    <Modal onClose={onClose} maxWidth="max-w-xs" zIndex="z-50">
      <div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <p className="font-mono text-[11px] uppercase tracking-widest text-violet-400">Objectif hebdo</p>
          <button onClick={onClose} aria-label="Fermer" className="p-1 rounded-lg hover:bg-white/10 text-violet-400"><X size={14} /></button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-violet-300">Combien d'épisodes veux-tu voir par semaine ?</p>
          <div className="flex items-center justify-center gap-5">
            <button onClick={() => step(-1)} aria-label="Moins" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center active:scale-90"><Minus size={16} /></button>
            <span className="font-mono text-3xl font-bold tabular-nums w-14 text-center text-amber-400">{value}</span>
            <button onClick={() => step(1)} aria-label="Plus" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center active:scale-90"><Plus size={16} /></button>
          </div>
          <button onClick={() => onSave(value)} className="w-full py-2.5 rounded-xl bg-amber-400 text-violet-950 text-sm font-semibold active:scale-[0.98]">Enregistrer</button>
        </div>
      </div>
    </Modal>
  );
}

export function WeekSummary({ entries, week, goal, onGoalChange, onOpenHistory }) {
  const [editGoal, setEditGoal] = useState(false);
  const inProgress = useMemo(() => entries.filter((e) => e.status === "en-cours").length, [entries]);
  const streak     = useMemo(() => calcCurrentStreak(entries), [entries]);
  const best       = useMemo(() => calcBestStreak(entries), [entries]);
  const pct        = Math.round((week.total / goal) * 100);

  let epDelta;
  if (week.prevTotal > 0) {
    const d = Math.round(((week.total - week.prevTotal) / week.prevTotal) * 100);
    epDelta = <Delta tone={d > 0 ? "up" : d < 0 ? "down" : "flat"}>{d > 0 ? "▲ +" : d < 0 ? "▼ " : "= "}{d}%</Delta>;
  } else {
    epDelta = <Delta tone={week.total > 0 ? "up" : "flat"}>{week.total > 0 ? `▲ +${week.total}` : "—"}</Delta>;
  }

  return (
    <section className="relative rounded-2xl bg-violet-900/40 backdrop-blur-sm border border-white/10 shadow-lg shadow-black/20 mb-4 overflow-hidden">
      <button onClick={onOpenHistory} aria-label="Voir l'historique"
        className="absolute top-3 right-3 text-violet-400 hover:text-violet-200 z-10"><ChevronRight size={18} /></button>
      <p className="px-4 pt-3 font-semibold text-sm text-violet-50 flex items-center gap-2" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
        Votre semaine
      </p>
      <div className="flex items-start gap-1 px-4 pt-3 pb-3">
        <div className="flex flex-1 min-w-0 divide-x divide-white/10">
          <Stat icon={<PlayCircle size={14} />} tint="bg-violet-500/25 text-violet-200" value={week.total} label="Épisodes regardés" delta={epDelta} />
          <Stat icon={<Clock size={14} />} tint="bg-indigo-400/20 text-indigo-200" value={inProgress} label="Titres en cours"
            delta={<Delta tone={week.startedThisWeek ? "up" : "flat"}>{week.startedThisWeek ? `▲ +${week.startedThisWeek}` : "—"}</Delta>} />
          <Stat icon={<Flame size={14} />} tint="bg-orange-400/20 text-orange-300" value={streak} label="Jours d'affilée"
            delta={<Delta tone={streak > 0 && streak >= best ? "up" : "flat"}>{streak > 0 && streak >= best ? "▲ Record" : `Record ${best}`}</Delta>} />
        </div>
        <button onClick={() => { haptics.tap(); setEditGoal(true); }} aria-label={`Objectif hebdo : ${pct}%. Modifier`}
          className="flex flex-col items-center flex-shrink-0 w-[78px] active:scale-95 transition-transform">
          <span className="relative flex items-center justify-center">
            <Ring pct={pct} />
            <span className="absolute font-mono text-[13px] font-bold text-white">{pct}%</span>
          </span>
          <span className="text-[8.5px] uppercase tracking-wide text-violet-300 mt-1 leading-tight text-center">Objectif hebdo</span>
        </button>
      </div>

      <AnimatePresence>
        {editGoal && <GoalModal key="goal" goal={goal} onClose={() => setEditGoal(false)}
          onSave={(v) => { onGoalChange(v); setEditGoal(false); }} />}
      </AnimatePresence>
    </section>
  );
}
