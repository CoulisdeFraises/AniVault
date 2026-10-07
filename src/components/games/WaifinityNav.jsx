import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Home, LayoutGrid, Sparkles, Users, Store } from "lucide-react";
import { haptics } from "../../utils/haptics";

// ── Barre de navigation propre à Waifinity ─────────────────────────────────
//
// Remplace la BottomNav de l'app tant qu'on est dans le jeu (celle-ci se masque
// sur /games/waifinity) : les 4 écrans du jeu sont à un tap du pouce, et
// « Accueil » reste là pour quitter. Le bouton central (Boosters) est l'action
// la plus fréquente ; sa pastille signale ce qui est à récupérer (booster
// gratuit, récompense du jour, missions). Même silhouette que la BottomNav pour
// ne pas dépayser, mais un seul accent : l'ambre est réservé à l'écran actif.

const SIDE_LEFT  = [
  { key: "home",       label: "Accueil",    icon: Home,       exit: true },
  { key: "collection", label: "Collection", icon: LayoutGrid },
];
const SIDE_RIGHT = [
  { key: "social",     label: "Social",     icon: Users },
  { key: "shop",       label: "Boutique",   icon: Store },
];

function Badge({ count }) {
  if (!count) return null;
  return (
    <span
      aria-label={`${count} à traiter`}
      className="absolute -top-1 -right-1.5 z-20 min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center
        bg-gradient-to-b from-fuchsia-400 to-rose-500 text-white text-[9.5px] font-bold leading-none tabular-nums
        ring-2 ring-violet-950 shadow-[0_2px_8px_rgba(244,63,94,0.5)]"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

function NavItem({ item, active, badge, onSelect }) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      aria-current={active ? "page" : undefined}
      className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl active:scale-95
        transition-transform motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
    >
      <span className="relative flex items-center justify-center w-11 h-8 rounded-xl">
        {active && (
          <motion.span
            layoutId="waifinity-nav-pill"
            className="absolute inset-0 rounded-xl bg-gradient-to-b from-amber-300/25 to-amber-400/5 ring-1 ring-amber-300/30
              shadow-[0_0_16px_rgba(251,191,36,0.2)]"
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          />
        )}
        <Icon size={19} className={`relative z-10 transition-colors motion-reduce:transition-none ${active ? "text-amber-300" : "text-violet-300"}`} />
        <Badge count={badge} />
      </span>
      <span className={`text-[10.5px] leading-none font-medium ${active ? "text-amber-200" : "text-violet-400"}`}>{item.label}</span>
    </button>
  );
}

/**
 * @param tab       écran actif ("boosters" | "collection" | "social" | "shop")
 * @param onChange  (tabKey) => void
 * @param badges    { boosters?: number, social?: number }
 */
export function WaifinityNav({ tab, onChange, badges = {} }) {
  const navigate = useNavigate();

  function select(item) {
    haptics.tap();
    if (item.exit) navigate("/");
    else onChange(item.key);
  }

  const boostersActive = tab === "boosters";

  return (
    <nav
      aria-label="Navigation Waifinity"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center pointer-events-none px-3"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div
        className="pointer-events-auto relative w-full max-w-md flex items-center justify-between gap-0.5
          rounded-[1.75rem] bg-violet-950/80 backdrop-blur-xl border border-white/10
          shadow-[0_20px_50px_-12px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.07)] px-1.5 py-1.5"
      >
        {SIDE_LEFT.map((it) => (
          <NavItem key={it.key} item={it} active={tab === it.key} onSelect={select} />
        ))}

        {/* Bouton central : Boosters */}
        <div className="flex-shrink-0 w-[4.5rem] flex flex-col items-center">
          <button
            type="button"
            onClick={() => { haptics.tap(); onChange("boosters"); }}
            aria-label="Boosters"
            aria-current={boostersActive ? "page" : undefined}
            className={`relative -mt-7 w-[3.75rem] h-[3.75rem] rounded-full flex items-center justify-center active:scale-90
              transition-[transform,box-shadow] motion-reduce:transition-none
              bg-gradient-to-b from-amber-200 via-amber-400 to-amber-500
              ring-4 ring-violet-950
              focus-visible:outline-none focus-visible:ring-amber-200
              shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_10px_26px_-6px_rgba(245,158,11,0.75)]
              ${boostersActive ? "" : "saturate-[0.85]"} ${badges.boosters ? "animate-glowPulse motion-reduce:animate-none" : ""}`}
          >
            <Sparkles size={24} className="text-violet-950" />
            <Badge count={badges.boosters} />
          </button>
          <span className={`mt-0.5 text-[10.5px] leading-none font-medium ${boostersActive ? "text-amber-200" : "text-violet-400"}`}>Boosters</span>
        </div>

        {SIDE_RIGHT.map((it) => (
          <NavItem key={it.key} item={it} active={tab === it.key} badge={badges[it.key]} onSelect={select} />
        ))}
      </div>
    </nav>
  );
}
