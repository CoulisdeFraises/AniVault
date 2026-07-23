import { useState } from "react";
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
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const avatarColor = user?.user_metadata?.avatar_color || "#7c3aed";

  function closeMenu() { setMenuOpen(false); }
  function go(path)    { closeMenu(); navigate(path); }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 active:scale-95 transition-all motion-reduce:transition-none"
        aria-label="Menu"
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
        <>
          <div className="fixed inset-0 z-10" onClick={closeMenu} />
          <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-violet-900 border border-white/10 shadow-xl z-20 overflow-hidden animate-fadeIn">
            {/* Logo wide */}
            <div className="flex items-center justify-center px-4 py-3 border-b border-white/5">
                <img src="/logo-wide.png" alt="AniVault" className="h-6 object-contain" />
            </div>
            {/* Avatar */}
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
            <div className="py-1">
              <button onClick={() => go("/")}                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-violet-200 hover:bg-white/10 active:bg-white/20 transition-colors motion-reduce:transition-none"><Home      size={15} className="text-violet-400 flex-shrink-0" />Accueil</button>
              <button onClick={() => go("/profile")}         className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-violet-200 hover:bg-white/10 active:bg-white/20 transition-colors motion-reduce:transition-none"><User      size={15} className="text-violet-400 flex-shrink-0" />Mon profil</button>
              <button onClick={() => go("/calendar")}        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-violet-200 hover:bg-white/10 active:bg-white/20 transition-colors motion-reduce:transition-none"><Calendar  size={15} className="text-violet-400 flex-shrink-0" />Calendrier</button>
              <button onClick={() => go("/history")}         className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-violet-200 hover:bg-white/10 active:bg-white/20 transition-colors motion-reduce:transition-none"><Clock     size={15} className="text-violet-400 flex-shrink-0" />Historique</button>
              <button onClick={() => go("/recommendations")} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-violet-200 hover:bg-white/10 active:bg-white/20 transition-colors motion-reduce:transition-none"><Sparkles  size={15} className="text-violet-400 flex-shrink-0" />Recommandations</button>
              <button onClick={() => go("/settings")}        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-violet-200 hover:bg-white/10 active:bg-white/20 transition-colors motion-reduce:transition-none"><Settings  size={15} className="text-violet-400 flex-shrink-0" />Paramètres</button>
            </div>

            {/* Déconnexion */}
            <div className="border-t border-white/5 py-1">
              <button onClick={() => { closeMenu(); logout(); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-300 hover:bg-rose-500/10 active:bg-rose-500/20 transition-colors motion-reduce:transition-none">
                <LogOut size={15} /> Se déconnecter
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}