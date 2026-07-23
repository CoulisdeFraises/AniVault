import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, Home, User, Calendar, Settings, LogOut, Clock, Sparkles } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export function BurgerMenu() {
  const { user, profile, logout } = useAuth();
  const navigate  = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef(null);

  const avatarColor = user?.user_metadata?.avatar_color || "#7c3aed";

  // ── Fermeture au clic en dehors (mousedown, plus fiable que l'overlay) ──
  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    // mousedown pour intercepter avant que d'éventuels éléments consomment le click
    document.addEventListener("mousedown", handleOutside);
    // Fermeture aussi sur Escape
    function handleKey(e) { if (e.key === "Escape") setMenuOpen(false); }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  function closeMenu() { setMenuOpen(false); }
  function go(path)    { closeMenu(); navigate(path); }

  return (
    // z-50 sur le wrapper pour passer au-dessus des stacking contexts créés
    // par les animations CSS du Header (fadeInUp, etc.)
    <div ref={wrapperRef} className="relative z-50">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 active:scale-95 transition-all motion-reduce:transition-none"
        aria-label="Menu"
        aria-expanded={menuOpen}
      >
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
          style={{ backgroundColor: avatarColor }}
        >
          {getInitials(profile)}
        </div>
        <Menu size={15} className="text-violet-400" />
      </button>

      {menuOpen && (
        <div
          className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-violet-900 border border-white/10 shadow-2xl overflow-hidden animate-fadeIn"
          // z-50 hérité du parent, on le renforce juste en cas de contexte imbriqué
          style={{ zIndex: 50 }}
        >
          {/* Logo */}
          <div className="flex items-center justify-center px-4 py-3 border-b border-white/5">
            <img src="/logo-wide.png" alt="AniVault" className="h-6 object-contain" />
          </div>

          {/* Avatar + infos */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ backgroundColor: avatarColor }}
            >
              {getInitials(profile)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-violet-50 truncate">{profile}</p>
              <p className="text-[10px] text-violet-400 truncate">{user?.email}</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="py-1">
            {[
              { path: "/",               icon: <Home      size={15} />, label: "Accueil"          },
              { path: "/profile",        icon: <User      size={15} />, label: "Mon profil"       },
              { path: "/calendar",       icon: <Calendar  size={15} />, label: "Calendrier"       },
              { path: "/history",        icon: <Clock     size={15} />, label: "Historique"       },
              { path: "/recommendations",icon: <Sparkles  size={15} />, label: "Recommandations"  },
              { path: "/settings",       icon: <Settings  size={15} />, label: "Paramètres"       },
            ].map(({ path, icon, label }) => (
              <button
                key={path}
                onClick={() => go(path)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-violet-200 hover:bg-white/10 active:bg-white/20 transition-colors motion-reduce:transition-none"
              >
                <span className="text-violet-400 flex-shrink-0">{icon}</span>
                {label}
              </button>
            ))}
          </nav>

          {/* Déconnexion */}
          <div className="border-t border-white/5 py-1">
            <button
              onClick={() => { closeMenu(); logout(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-300 hover:bg-rose-500/10 active:bg-rose-500/20 transition-colors motion-reduce:transition-none"
            >
              <LogOut size={15} /> Se déconnecter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
