import { useMemo, useState } from "react";
import { Plus, Film, Tv, LogOut, ChevronDown, Settings, User, Calendar, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Chip } from "../common/Chip";
import { STATUS, STATUS_ORDER } from "../../utils/status";
import { useLibrary } from "../../context/LibraryContext";
import { useAuth } from "../../context/AuthContext";
import { RefreshCw } from "lucide-react";

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

export function Header({
  filter, typeFilter, onFilterChange, onTypeFilterChange, onAddClick,
  syncing = false, syncProgress = { current: 0, total: 0 }, onSyncClick,
}) {
  const { entries, loading } = useLibrary();
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const avatarColor = user?.user_metadata?.avatar_color || "#7c3aed";

  const byType = useMemo(
    () => (typeFilter === "all" ? entries : entries.filter((e) => e.type === typeFilter)),
    [entries, typeFilter]
  );
  const counts = useMemo(
    () => STATUS_ORDER.reduce((acc, k) => ({ ...acc, [k]: byType.filter((e) => e.status === k).length }), {}),
    [byType]
  );
  const topGenres = useMemo(() => {
    const tally = {};
    entries.forEach((e) => e.genres.forEach((g) => { tally[g] = (tally[g] || 0) + 1; }));
    return Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [entries]);

  function closeMenu() { setMenuOpen(false); }

  function go(path) { closeMenu(); navigate(path); }

  return (
    <>
      {/* ── Barre principale ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="font-mono text-[11px] tracking-[0.3em] text-violet-400 uppercase mb-1">
            Mon Journal de visionnage
          </p>
          <h1
            className="text-3xl sm:text-4xl font-bold tracking-tight"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            ANIVAULT
          </h1>
        </div>

        <div className="flex items-center gap-2">

          {/* Sync */}
          <button
            onClick={onSyncClick}
            disabled={syncing}
            title={syncing ? `Sync en cours… ${syncProgress.current}/${syncProgress.total}` : "Actualiser les données"}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 disabled:opacity-70 transition-colors motion-reduce:transition-none"
          >
            <RefreshCw size={14} className={`text-violet-400 ${syncing ? "animate-spin motion-reduce:animate-none" : ""}`} />
            {syncing
              ? <span className="text-xs font-mono text-violet-400 hidden sm:inline">{syncProgress.current}/{syncProgress.total}</span>
              : <span className="text-xs font-mono text-violet-400 hidden sm:inline">Sync</span>
            }
          </button>

          {/* ── Burger menu ── */}
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 transition-colors motion-reduce:transition-none"
              aria-label="Menu"
            >
              {/* Mini avatar */}
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                style={{ backgroundColor: avatarColor }}
              >
                {getInitials(profile)}
              </div>
              <Menu size={15} className="text-violet-400" />
            </button>

            {/* Dropdown */}
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={closeMenu} />
                <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-violet-900 border border-white/10 shadow-xl z-20 overflow-hidden">

                  {/* Info utilisateur */}
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
                    <button
                      onClick={() => go("/profile")}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-violet-200 hover:bg-white/10 transition-colors motion-reduce:transition-none"
                    >
                      <User size={15} className="text-violet-400 flex-shrink-0" />
                      Mon profil
                    </button>
                    <button
                      onClick={() => go("/calendar")}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-violet-200 hover:bg-white/10 transition-colors motion-reduce:transition-none"
                    >
                      <Calendar size={15} className="text-violet-400 flex-shrink-0" />
                      Calendrier
                    </button>
                    <button
                      onClick={() => go("/settings")}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-violet-200 hover:bg-white/10 transition-colors motion-reduce:transition-none"
                    >
                      <Settings size={15} className="text-violet-400 flex-shrink-0" />
                      Paramètres
                    </button>
                  </div>

                  <div className="border-t border-white/5 py-1">
                    <button
                      onClick={() => { closeMenu(); logout(); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-300 hover:bg-rose-500/10 transition-colors motion-reduce:transition-none"
                    >
                      <LogOut size={15} />
                      Se déconnecter
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Ajouter */}
          <button
            onClick={onAddClick}
            className="flex items-center gap-1.5 bg-amber-400 text-violet-950 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-amber-300 transition-colors motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-violet-950"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Ajouter un titre</span>
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      {!loading && entries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/10 rounded-2xl bg-violet-900/30 border border-white/5 mb-6 overflow-hidden">
          <div className="p-4">
            <p className="font-mono text-2xl font-medium">{entries.length}</p>
            <p className="text-[11px] text-violet-400 uppercase tracking-wide">Titres suivis</p>
          </div>
          <div className="p-4">
            <p className="font-mono text-2xl font-medium">{counts["en-cours"]}</p>
            <p className="text-[11px] text-violet-400 uppercase tracking-wide">En cours</p>
          </div>
          <div className="p-4">
            {topGenres.length > 0 ? (
              <>
                <p className="font-medium truncate">{topGenres.map(([g]) => g).join(", ")}</p>
                <p className="text-[11px] text-violet-400 uppercase tracking-wide">Genres préférés</p>
              </>
            ) : (
              <>
                <p className="font-medium text-violet-500">—</p>
                <p className="text-[11px] text-violet-400 uppercase tracking-wide">Genres préférés</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Filtre type ── */}
      <div className="flex justify-center mb-5">
        <div className="inline-flex rounded-full bg-white/5 border border-white/10 p-0.5">
          {[
            { key: "all",   label: "Tout",   icon: null },
            { key: "anime", label: "Animes", icon: <Film size={12} /> },
            { key: "serie", label: "Séries", icon: <Tv size={12} /> },
          ].map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => onTypeFilterChange(key)}
              className={`flex items-center gap-1.5 px-6 py-1.5 rounded-full text-xs font-medium transition-colors motion-reduce:transition-none
                ${typeFilter === key ? "bg-amber-400 text-violet-950 font-semibold" : "text-violet-300 hover:text-violet-100"}`}
            >
              {icon}{label}
            </button>
          ))}
        </div>
      </div>
      <div className="border-b border-white/10 mb-5" />

      {/* ── Filtre statut ── */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Chip active={filter === "all"} onClick={() => onFilterChange("all")}>
          Tous <span className="font-mono opacity-70">({byType.length})</span>
        </Chip>
        {STATUS_ORDER.map((k) => (
          <Chip
            key={k}
            active={filter === k}
            onClick={() => onFilterChange(k)}
            colorClass={
              k === "en-cours" ? "bg-amber-400/90 border-amber-400 text-violet-950" :
              k === "termine"  ? "bg-teal-400/90 border-teal-400 text-violet-950"   :
              k === "a-voir"   ? "bg-sky-400/90 border-sky-400 text-violet-950"     :
                                 "bg-rose-400/90 border-rose-400 text-violet-950"
            }
          >
            {STATUS[k].label} <span className="font-mono opacity-70">({counts[k]})</span>
          </Chip>
        ))}
      </div>
    </>
  );
}