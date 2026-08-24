import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { Home, ListPlus, Calendar, Search, Sparkles, Users, User } from "lucide-react";

// ── Pages accessibles depuis la barre flottante ────────────────────────────────
// Les actions "de compte / réglages" (paramètres, historique, sync,
// données & sauvegarde, déconnexion, notifs) restent en haut de chaque page
// via <TopBar />. Ici : uniquement la navigation entre les grandes sections.
const ITEMS = [
  { path: "/",                icon: Home,     label: "Accueil"  },
  { path: "/lists",           icon: ListPlus, label: "Listes"   },
  { path: "/calendar",        icon: Calendar, label: "Agenda"   },
  { path: "/search",          icon: Search,   label: "Ajouter",  primary: true },
  { path: "/recommendations", icon: Sparkles, label: "Recos"    },
  { path: "/community",       icon: Users,    label: "Amis"     },
  { path: "/profile",         icon: User,     label: "Profil"   },
];

/**
 * BottomNav — barre flottante semi-transparente, visible sur toutes les
 * tailles d'écran (mobile comme bureau — c'est la seule navigation entre
 * les grandes sections de l'app, il n'existe pas de nav latérale/haute
 * dédiée au bureau).
 * Rendue une seule fois au niveau racine (App.jsx) pour garantir une
 * navigation homogène entre toutes les pages protégées.
 */
export function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-center pointer-events-none px-3"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div
        className="pointer-events-auto w-full max-w-md flex items-center justify-between gap-0.5
          rounded-[1.75rem] bg-violet-950/75 backdrop-blur-xl border border-white/10
          shadow-2xl shadow-black/50 px-1.5 py-1.5"
      >
        {ITEMS.map(({ path, icon: Icon, label, primary }) => {
          const active = location.pathname === path;
          if (primary) {
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`flex-shrink-0 -mt-6 w-14 h-14 rounded-full flex items-center justify-center
                  shadow-lg shadow-amber-500/30 active:scale-90 transition-all motion-reduce:transition-none
                  ${active ? "bg-amber-300" : "bg-amber-400"}`}
              >
                <Icon size={20} className="text-violet-950" />
              </button>
            );
          }
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl
                active:scale-95 transition-all motion-reduce:transition-none"
            >
              <span className="relative flex items-center justify-center w-9 h-7 rounded-xl">
                {/* Pastille active — partage un layoutId entre tous les onglets :
                    Motion détecte le changement d'instance et anime le déplacement
                    (position + taille) d'un onglet à l'autre plutôt que de la faire
                    juste apparaître/disparaître. */}
                {active && (
                  <motion.span
                    layoutId="bottomNavActivePill"
                    className="absolute inset-0 rounded-xl bg-amber-400/15"
                    transition={{ type: "spring", bounce: 0.25, duration: 0.4 }}
                  />
                )}
                <Icon size={18} className={`relative z-10 transition-colors motion-reduce:transition-none ${
                  active ? "text-amber-400" : "text-violet-400"
                }`} />
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
