import { useMemo, useState } from "react";
import { Plus, Film, Tv, LogOut, Settings, User, Calendar, Menu, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Chip } from "../common/Chip";
import { STATUS, STATUS_ORDER } from "../../utils/status";
import { useLibrary } from "../../context/LibraryContext";
import { useAuth } from "../../context/AuthContext";
import { useCountUp } from "../../hooks/useCountUp";
import { BurgerMenu } from "../common/BurgerMenu";

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

//test pour push et deploiement

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

  // ── Progression globale ──
  const totalWatched = useMemo(
    () => entries.reduce((sum, e) => sum + e.seasons.reduce((s2, s) => s2 + (s.watchedEpisodes || 0), 0), 0),
    [entries]
  );
  const totalKnown = useMemo(
    () => entries.reduce((sum, e) => sum + e.seasons.reduce((s2, s) => s2 + (s.totalEpisodes || 0), 0), 0),
    [entries]
  );
  const globalPct = totalKnown > 0 ? Math.min(100, (totalWatched / totalKnown) * 100) : 0;

  // ── Compteurs animés ──
  const animatedTotal    = useCountUp(entries.length);
  const animatedEnCours  = useCountUp(counts["en-cours"] ?? 0);
  const animatedWatched  = useCountUp(totalWatched);

  function closeMenu() { setMenuOpen(false); }
  function go(path)    { closeMenu(); navigate(path); }

  return (
    <>
      {/* ── Barre principale ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="font-mono text-[11px] tracking-[0.3em] text-violet-400 uppercase mb-1">
            Mon Journal de visionnage
          </p>
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="AniVault"
              className="h-8 w-8 rounded-lg flex-shrink-0"
            />
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
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sync */}
          <button
            onClick={onSyncClick}
            disabled={syncing}
            title={syncing ? `Sync en cours… ${syncProgress.current}/${syncProgress.total}` : "Actualiser les données"}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 disabled:opacity-70 active:scale-95 transition-all motion-reduce:transition-none"
          >
            <RefreshCw size={14} className={`text-violet-400 ${syncing ? "animate-spin motion-reduce:animate-none" : ""}`} />
            {syncing
              ? <span className="text-xs font-mono text-violet-400 hidden sm:inline">{syncProgress.current}/{syncProgress.total}</span>
              : <span className="text-xs font-mono text-violet-400 hidden sm:inline">Sync</span>
            }
          </button>

          {/* Burger */}
          <BurgerMenu />

          {/* Ajouter */}
          <button
            onClick={onAddClick}
            className="flex items-center gap-1.5 bg-amber-400 text-violet-950 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-amber-300 active:scale-95 transition-all motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-violet-950"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Ajouter un titre</span>
          </button>
        </div>
      </div>

      {/* ── Stats + barre de progression globale ── */}
      {!loading && entries.length > 0 && (
        <div className="rounded-2xl bg-violet-900/30 border border-white/5 mb-6 overflow-hidden">
          {/* Compteurs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
            <div className="p-4">
              <p className="font-mono text-2xl font-medium">{animatedTotal}</p>
              <p className="text-[11px] text-violet-400 uppercase tracking-wide">Titres suivis</p>
            </div>
            <div className="p-4">
              <p className="font-mono text-2xl font-medium">{animatedEnCours}</p>
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

          {/* Barre de progression globale */}
          {totalKnown > 0 && (
            <div className="px-4 pt-3 pb-4 border-t border-white/5">
              <div className="flex items-center justify-between mb-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-violet-400">
                  Progression globale
                </p>
                <p className="font-mono text-[11px] text-violet-300">
                  {animatedWatched} / {totalKnown} épisodes
                </p>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-teal-400 transition-[width] duration-1000 ease-out motion-reduce:transition-none"
                  style={{ width: `${globalPct}%` }}
                />
              </div>
            </div>
          )}
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
              className={`flex items-center gap-1.5 px-6 py-1.5 rounded-full text-xs font-medium transition-colors active:scale-95 motion-reduce:transition-none ${
                typeFilter === key ? "bg-amber-400 text-violet-950 font-semibold" : "text-violet-300 hover:text-violet-100"
              }`}
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