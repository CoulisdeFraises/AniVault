import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, Home, User, Calendar, Settings, LogOut, Clock, Sparkles, Users, ListPlus } from "lucide-react";
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
  const navigate    = useNavigate();
  const location    = useLocation();
  const buttonRef   = useRef(null);
  const dropdownRef = useRef(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  const avatarColor  = user?.user_metadata?.avatar_color || "#7c3aed";
  const isOnHomePage = location.pathname === "/";

  function openMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    setMenuOpen(true);
  }
  function closeMenu() { setMenuOpen(false); }
  function go(path)    { closeMenu(); navigate(path); }

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutside(e) {
      if (!buttonRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target)) closeMenu();
    }
    function handleKey(e) { if (e.key === "Escape") closeMenu(); }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown",   handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown",   handleKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleResize() {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (rect) setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [menuOpen]);

  const dropdown = (
    <div
      ref={dropdownRef}
      style={{ position: "fixed", top: pos.top, right: pos.right, zIndex: 9999, width: "14rem" }}
      className="rounded-2xl bg-violet-900 border border-white/10 shadow-2xl overflow-hidden animate-fadeIn"
    >
      {/* Logo */}
      <div className="flex items-center justify-center px-4 py-3 border-b border-white/5">
        <img src="/logo-wide.png" alt="AniVault" className="h-6 object-contain" />
      </div>

      {/* Avatar + infos */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
          style={{ backgroundColor: avatarColor }}>
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
          { path: "/",                icon: <Home      size={15} />, label: "Accueil"         },
          { path: "/profile",         icon: <User      size={15} />, label: "Mon profil"      },
          { path: "/lists",           icon: <ListPlus  size={15} />, label: "Mes Listes"      },
          { path: "/calendar",        icon: <Calendar  size={15} />, label: "Calendrier"      },
          { path: "/history",         icon: <Clock     size={15} />, label: "Historique"      },
          { path: "/recommendations", icon: <Sparkles  size={15} />, label: "Recommandations" },
          { path: "/community",       icon: <Users     size={15} />, label: "Communauté"      },
          { path: "/settings",        icon: <Settings  size={15} />, label: "Paramètres"      },
        ].map(({ path, icon, label }) => (
          <button key={path} onClick={() => go(path)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors motion-reduce:transition-none ${
              location.pathname === path
                ? "text-amber-300 bg-amber-400/10"
                : "text-violet-200 hover:bg-white/10 active:bg-white/20"
            }`}>
            <span className={`flex-shrink-0 ${location.pathname === path ? "text-amber-400" : "text-violet-400"}`}>
              {icon}
            </span>
            {label}
            {location.pathname === path && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
            )}
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
  );

  return (
    <div className="flex items-center gap-2">

      {/* ── Bouton Home ── toujours visible, grisé sur la homepage ── */}
      <button
        onClick={() => navigate("/")}
        aria-label="Accueil"
        disabled={isOnHomePage}
        className={`h-9 w-9 flex items-center justify-center rounded-xl border transition-all motion-reduce:transition-none ${
          isOnHomePage
            ? "bg-amber-400/15 border-amber-400/30 text-amber-400 cursor-default"
            : "bg-violet-900/40 border-white/10 text-violet-300 hover:bg-violet-800/50 hover:text-violet-50 hover:border-white/20 active:scale-95"
        }`}
      >
        <Home size={15} />
      </button>

      {/* ── Burger Menu ── */}
      <button
        ref={buttonRef}
        onClick={() => (menuOpen ? closeMenu() : openMenu())}
        aria-label="Menu"
        className="h-9 flex items-center gap-2 px-2.5 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 active:scale-95 transition-all motion-reduce:transition-none"
      >
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
          style={{ backgroundColor: avatarColor }}>
          {getInitials(profile)}
        </div>
        <Menu size={15} className="text-violet-300" />
      </button>

      {menuOpen && createPortal(dropdown, document.body)}
    </div>
  );
}