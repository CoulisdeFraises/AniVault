import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Home, Gamepad2, LayoutGrid, Library, Sparkles, Users, Store } from "lucide-react";
import { haptics } from "../../utils/haptics";

// ── Barre de navigation de Waifinity ───────────────────────────────────────
//
// Strictement le même habillage que la barre principale (common/BottomNav) :
// même conteneur flottant, mêmes pastilles actives, mêmes libellés, même bouton
// central ambré. Seuls les éléments changent : les 5 écrans du jeu + « Accueil »
// pour quitter, « Jeux » pour revenir à la liste des jeux. Le bouton central (Boosters) est l'action la plus fréquente.
// Si tu modifies le style de l'une des deux barres, répercute-le dans l'autre.
//
// Seul ajout propre au jeu : une petite pastille de compteur (booster gratuit,
// récompenses, échanges en attente).

const ITEMS = [
  { key: "home",       icon: Home,       label: "Accueil",    exit: true, to: "/" },
  { key: "games",      icon: Gamepad2,   label: "Jeux",       exit: true, to: "/games" },
  { key: "collection", icon: LayoutGrid, label: "Collection" },
  { key: "boosters",   icon: Sparkles,   label: "Boosters",   primary: true },
  { key: "social",     icon: Users,      label: "Social" },
  { key: "series",     icon: Library,    label: "Séries" },
  { key: "shop",       icon: Store,      label: "Boutique" },
];

function Badge({ count, className = "" }) {
  if (!count) return null;
  return (
    <span
      aria-label={`${count} à traiter`}
      className={`absolute z-20 min-w-[15px] h-[15px] px-1 rounded-full flex items-center justify-center
        bg-rose-500 text-white text-[9px] font-bold leading-none tabular-nums ring-2 ring-violet-950 ${className}`}
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
  const navigate = useNavigate();

  function select(item) {
    haptics.tap();
    if (item.exit) navigate(item.to || "/");
    else onChange(item.key);
  }

  return (
    <nav
      aria-label="Navigation Waifinity"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center pointer-events-none px-3"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div
        className="pointer-events-auto w-full max-w-md flex items-center justify-between gap-0.5
          rounded-[1.75rem] bg-violet-950/75 backdrop-blur-xl border border-white/10
          shadow-2xl shadow-black/50 px-1.5 py-1.5"
      >
        {ITEMS.map(({ key, icon: Icon, label, primary, exit, to }) => {
          const active = !exit && tab === key;
          const badge = badges[key];

          if (primary) {
            return (
              <button
                key={key}
                onClick={() => select({ key })}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`relative flex-shrink-0 -mt-6 w-14 h-14 rounded-full flex items-center justify-center
                  shadow-lg shadow-amber-500/30 active:scale-90 transition-all motion-reduce:transition-none
                  ${active ? "bg-amber-300" : "bg-amber-400"} ${badge ? "animate-glowPulse motion-reduce:animate-none" : ""}`}
              >
                <Icon size={20} className="text-violet-950" />
                <Badge count={badge} className="-top-0.5 -right-0.5" />
              </button>
            );
          }

          return (
            <button
              key={key}
              onClick={() => select({ key, exit, to })}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl
                active:scale-95 transition-all motion-reduce:transition-none"
            >
              <span className="relative flex items-center justify-center w-9 h-7 rounded-xl">
                {active && (
                  <motion.span
                    layoutId="waifinityNavActivePill"
                    className="absolute inset-0 rounded-xl bg-amber-400/15"
                    transition={{ type: "spring", bounce: 0.25, duration: 0.4 }}
                  />
                )}
                <Icon size={18} className={`relative z-10 transition-colors motion-reduce:transition-none ${
                  active ? "text-amber-400" : "text-violet-400"
                }`} />
                <Badge count={badge} className="-top-1 -right-1" />
              </span>
              <span
                className={`font-mono text-[8.5px] uppercase tracking-wide leading-none ${
                  active ? "text-amber-300" : "text-violet-500"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
