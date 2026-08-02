import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useLocation } from "react-router-dom";
import { Menu, Home, User, Calendar, Settings, LogOut, Clock, Sparkles, Users, ListPlus, Database } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ExportImportModal } from "./ExportImportModal";
import { Avatar } from "./Avatar";

export function BurgerMenu() {
  const { user, profile, userProfile, logout } = useAuth();
  const navigate    = useNavigate();
  const location    = useLocation();
  const buttonRef   = useRef(null);
  const dropdownRef = useRef(null);

  const [menuOpen,        setMenuOpen]        = useState(false);
  const [exportImportOpen, setExportImportOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });

  const avatarColor = user?.user_metadata?.avatar_color || "#7c3aed";

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
      <div className="flex items-center justify-center px-4 py-3 border-b border-white/5">
        <img src="/logo-wide.png" alt="AniVault" className="h-6 object-contain" />
      </div>

      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
        <Avatar name={profile} color={avatarColor} photoUrl={userProfile?.avatar_url} size="md" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-violet-50 truncate">{profile}</p>
          <p className="text-[10px] text-violet-400 truncate">{user?.email}</p>
        </div>
      </div>

      <nav className="py-1">
        {[
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

      {/* Export / Import */}
      <div className="border-t border-white/5 py-1">
        <button
          onClick={() => { closeMenu(); setExportImportOpen(true); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-violet-200 hover:bg-white/10 active:bg-white/20 transition-colors motion-reduce:transition-none"
        >
          <Database size={15} className="flex-shrink-0 text-violet-400" />
          Données & Sauvegarde
        </button>
      </div>

      {/* Déconnexion */}
      <div className="border-t border-white/5 py-1">
        <button
          onClick={() => { closeMenu(); logout(); navigate("/login"); }}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-300 hover:bg-rose-500/10 active:bg-rose-500/20 transition-colors motion-reduce:transition-none"
        >
          <LogOut size={15} className="flex-shrink-0 text-rose-400" />
          Déconnexion
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex items-center rounded-xl bg-violet-900/40 border border-white/10 overflow-hidden flex-shrink-0">
        {location.pathname !== "/" && (
          <button
            onClick={() => navigate("/")}
            aria-label="Retour à l'accueil"
            title="Accueil"
            className="h-9 w-9 flex items-center justify-center border-r border-white/10 hover:bg-violet-800/50 active:scale-95 transition-all motion-reduce:transition-none"
          >
            <Home size={16} className="text-violet-400" />
          </button>
        )}
        <button
          ref={buttonRef}
          onClick={menuOpen ? closeMenu : openMenu}
          aria-label="Menu"
          aria-expanded={menuOpen}
          className="h-9 w-9 flex items-center justify-center hover:bg-violet-800/50 active:scale-95 transition-all motion-reduce:transition-none"
        >
          <Menu size={16} className="text-violet-400" />
        </button>
      </div>

      {menuOpen && createPortal(dropdown, document.body)}
      {exportImportOpen && <ExportImportModal onClose={() => setExportImportOpen(false)} />}
    </>
  );
}