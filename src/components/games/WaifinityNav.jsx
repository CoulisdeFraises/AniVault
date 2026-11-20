import { motion } from "motion/react";
import { LayoutGrid, Library, Sparkles, Users, Store } from "lucide-react";
import { haptics } from "../../utils/haptics";

// ── Barre de navigation de Waifinity ───────────────────────────────────────
//
// Les 5 écrans du jeu, et rien d'autre : le retour aux jeux vit dans la barre
// de statut en haut (WaifinityHud). Le bouton central ambré (Boosters) est
// l'action la plus fréquente ; il pulse quand il y a quelque chose à récupérer.
// Même habillage « dock flottant » que la barre principale de l'app (verre
// violet, pastille active ambrée), pour que le jeu reste de la même famille.
//
// Pastilles rouges : ce qui attend une action du joueur (booster gratuit,
// récompenses, échanges en attente).

const ITEMS = [
  { key: "collection", icon: LayoutGrid, label: "Collection" },
  { key: "series",     icon: Library,    label: "Séries" },
  { key: "boosters",   icon: Sparkles,   label: "Boosters", primary: true },
  { key: "social",     icon: Users,      label: "Social" },
  { key: "shop",       icon: Store,      label: "Boutique" },
];

function Badge({ count, className = "" }) {
  if (!count) return null;
  return (
    <span
      aria-label={`${count} à traiter`}
      className={`absolute z-20 min-w-[16px] h-[16px] px-1 rounded-full flex items-center justify-center
        bg-rose-500 text-white text-[9.5px] font-bold leading-none tabular-nums ring-2 ring-violet-950 ${className}`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

/**
 * @param tab       écran actif ("boosters" | "collection" | "social" | "series" | "shop")
 * @param onChange  (tabKey) => void
 * @param badges    { boosters?: number, social?: number }
 */
export function WaifinityNav({ tab, onChange, badges = {} }) {
  return (
    <nav
      aria-label="Navigation Waifinity"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center pointer-events-none px-3"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div
        className="pointer-events-auto w-full max-w-md grid grid-cols-5 items-end
          rounded-[1.75rem] bg-violet-950/80 backdrop-blur-xl border border-white/[0.12]
          shadow-[0_20px_50px_-10px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.08)] px-1.5 py-1.5"
      >
        {ITEMS.map(({ key, icon: Icon, label, primary }) => {
          const active = tab === key;
          const badge = badges[key];

          if (primary) {
            return (
              <div key={key} className="flex justify-center">
                <button
                  onClick={() => { haptics.tap(); onChange(key); }}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={`relative -mt-7 w-[3.75rem] h-[3.75rem] rounded-full flex flex-col items-center justify-center
                    bg-gradient-to-b from-amber-200 via-amber-300 to-amber-400 border-2 border-violet-950
                    shadow-[inset_0_1px_0_rgba(255,255,255,0.7),inset_0_-3px_0_rgba(180,83,9,0.4),0_10px_24px_-6px_rgba(245,158,11,0.7)]
                    active:scale-90 transition-transform motion-reduce:transition-none
                    ${badge ? "animate-glowPulse motion-reduce:animate-none" : ""} ${active ? "" : "saturate-[0.85]"}`}
                >
                  <Icon size={22} className="text-violet-950" />
                  <Badge count={badge} className="-top-0.5 -right-0.5" />
                </button>
              </div>
            );
          }

          return (
            <button
              key={key}
              onClick={() => { haptics.tap(); onChange(key); }}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl
                active:scale-95 transition-transform motion-reduce:transition-none"
            >
              <span className="relative flex items-center justify-center w-11 h-7 rounded-xl">
                {active && (
                  <motion.span
                    layoutId="waifinityNavActivePill"
                    className="absolute inset-0 rounded-xl bg-amber-400/[0.16] ring-1 ring-amber-300/25"
                    transition={{ type: "spring", bounce: 0.25, duration: 0.4 }}
                  />
                )}
                <Icon size={18} className={`relative z-10 transition-colors motion-reduce:transition-none ${
                  active ? "text-amber-300" : "text-violet-400"
                }`} />
                <Badge count={badge} className="-top-1 -right-0.5" />
              </span>
              <span className={`font-mono text-[9px] uppercase tracking-wide leading-none ${
                active ? "text-amber-300" : "text-violet-400"
              }`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
