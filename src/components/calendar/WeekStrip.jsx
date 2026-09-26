import { motion } from "motion/react";

const SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/**
 * Bandeau des 7 jours de la semaine : sélection directe d'un jour, avec la
 * date et le nombre d'épisodes (selon le filtre actif). Remplace l'ancien
 * indicateur à petits points — beaucoup plus explicite sur "où on est" et
 * sur le fait qu'il y a d'autres jours à côté.
 * `visibleCount` > 1 (desktop) : plusieurs jours sont mis en évidence.
 */
export function WeekStrip({ days, dayOffset, visibleCount, todayDateString, onSelect, layoutId }) {
  return (
    <div role="tablist" aria-label="Jours de la semaine"
      className="flex-1 min-w-0 flex items-stretch gap-1 rounded-2xl bg-white/5 border border-white/10 p-1">
      {days.map(({ date, entries }, i) => {
        const active  = i >= dayOffset && i < dayOffset + visibleCount;
        const isToday = date.toDateString() === todayDateString;
        const n = entries.length;
        return (
          <button key={i} role="tab" aria-selected={active}
            aria-label={`${date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}, ${n} épisode${n !== 1 ? "s" : ""}`}
            onClick={() => onSelect(i)}
            className="relative flex-1 min-w-0 flex flex-col items-center justify-center py-1.5 rounded-xl active:scale-95 transition-transform motion-reduce:transition-none">
            {active && (
              visibleCount === 1 ? (
                <motion.span layoutId={layoutId}
                  className="absolute inset-0 rounded-xl bg-gradient-to-b from-violet-200 to-violet-400 shadow-[0_0_14px_rgba(167,139,250,0.45)]"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }} />
              ) : (
                <span className="absolute inset-0 rounded-xl bg-gradient-to-b from-violet-200 to-violet-400 shadow-[0_0_14px_rgba(167,139,250,0.45)]" />
              )
            )}
            <span className={`relative z-10 font-mono text-[9px] uppercase tracking-wide ${active ? "text-violet-900" : "text-violet-400"}`}>{SHORT[i]}</span>
            <span className={`relative z-10 text-[15px] leading-tight font-bold tabular-nums ${
              active ? "text-violet-950" : isToday ? "text-amber-300" : "text-violet-100"}`}>{date.getDate()}</span>
            <span className="relative z-10 h-3 flex items-center">
              {n > 0 ? (
                <span className={`font-mono text-[9px] font-semibold leading-none px-1 rounded-full ${
                  active ? "text-violet-950 bg-white/40" : "text-violet-200 bg-violet-500/30"}`}>{n}</span>
              ) : (
                <span className={`w-1 h-1 rounded-full ${active ? "bg-violet-900/40" : "bg-white/15"}`} />
              )}
            </span>
            {isToday && <span className="absolute top-1 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 animate-glowPulse motion-reduce:animate-none" />}
          </button>
        );
      })}
    </div>
  );
}
