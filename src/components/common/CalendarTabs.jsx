import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { Film, Tv, Clapperboard } from "lucide-react";

const TABS = [
  { path: "/calendar",         label: "Animes", icon: Film },
  { path: "/calendar/series",  label: "Séries", icon: Tv },
  { path: "/calendar/films",   label: "Films",  icon: Clapperboard },
];

/**
 * CalendarTabs — bascule entre les 3 sous-pages du Calendrier.
 * Même pattern visuel (pilule segmentée) que l'ancien bouton
 * "Saison en cours / Saison prochaine", repris pour cohérence.
 */
export function CalendarTabs() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex justify-center mb-3">
      <div className="inline-flex w-full max-w-sm items-center gap-1 rounded-full bg-white/5 border border-white/10 p-0.5">
        {TABS.map(({ path, label, icon: Icon }) => {
          const active = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => !active && navigate(path)}
              aria-current={active ? "page" : undefined}
              className={`relative flex-1 min-w-0 flex items-center justify-center gap-1 px-2 py-1.5 rounded-full text-[11px] font-medium transition-colors active:scale-95 motion-reduce:transition-none whitespace-nowrap ${
                active ? "text-violet-950" : "text-violet-300 hover:bg-white/10"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="calendar-tabs-pill"
                  className="absolute inset-0 bg-amber-400 rounded-full"
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1">
                <Icon size={11} />
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
