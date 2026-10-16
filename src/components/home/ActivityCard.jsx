import { BarChart3, ChevronRight } from "lucide-react";

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export function ActivityCard({ week, goal, onOpenHistory }) {
  const max = Math.max(...week.perDay, 1);

  return (
    <section className="rounded-2xl bg-violet-900/40 border border-white/10 px-2.5 py-2 mb-4 animate-fadeIn">
      <button onClick={onOpenHistory} className="w-full flex items-center justify-between mb-1 active:opacity-80">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-violet-50">
          <BarChart3 size={13} className="text-amber-400" />Mon activité cette semaine
        </span>
        <span className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[10px] text-violet-200">{week.total} épisode{week.total > 1 ? "s" : ""}</span>
          <ChevronRight size={14} className="text-violet-400" />
        </span>
      </button>

      <div className="flex items-end gap-1">
        <div className="flex flex-1 items-end justify-between gap-1 h-[42px]">
          {week.perDay.map((n, i) => {
            const h = n === 0 ? 8 : Math.max(16, (n / max) * 100);
            const hot = n > 0 && n >= max * 0.7;
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full gap-0.5" title={`${DAYS[i]} : ${n}`}>
                <div className="w-full max-w-[14px] flex-1 rounded-full bg-white/5 flex items-end overflow-hidden">
                  <div className={`w-full rounded-full transition-[height] duration-700 motion-reduce:transition-none ${
                    hot ? "bg-gradient-to-t from-amber-400 to-amber-200" : n > 0 ? "bg-violet-400" : "bg-violet-500/40"}`}
                    style={{ height: `${h}%` }} />
                </div>
                <span className={`text-[8px] leading-none ${i === week.todayIndex ? "text-amber-300 font-semibold" : "text-violet-400"}`}>{DAYS[i]}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
