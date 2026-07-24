import { useMemo, useRef, useEffect, useState } from "react";
import { Plus, Film, Tv, RefreshCw, X, Search } from "lucide-react";
import { STATUS, STATUS_ORDER } from "../../utils/status";
import { useLibrary }    from "../../context/LibraryContext";
import { useCountUp }    from "../../hooks/useCountUp";
import { BurgerMenu }    from "../common/BurgerMenu";
import { calcWatchTime } from "../../utils/watchTime";

function FilterChip({ active, onClick, children, colorClass }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-95 motion-reduce:transition-none whitespace-nowrap ${active ? colorClass || "bg-violet-600 border-violet-500 text-white" : "bg-white/5 border-white/10 text-violet-300 hover:bg-white/10 hover:text-violet-100 hover:scale-[1.03]"}`}>
      {children}
    </button>
  );
}
const STATUS_CHIP_COLOR = {
  "en-cours":  "bg-amber-400/90 border-amber-400 text-violet-950",
  "termine":   "bg-teal-400/90 border-teal-400 text-violet-950",
  "a-voir":    "bg-sky-400/90 border-sky-400 text-violet-950",
  "abandonne": "bg-rose-400/90 border-rose-400 text-violet-950",
};

export function Header({
  typeFilter, selectedStatuses = [], searchQuery = "",
  onTypeFilterChange, onToggleStatus, onClearFilters,
  onSearchChange, onAddClick,
  syncing = false, syncProgress = { current: 0, total: 0 }, onSyncClick,
}) {
  const { entries, loading } = useLibrary();
  const searchRef = useRef(null);
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    function h(e) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const byType       = useMemo(() => typeFilter === "all" ? entries : entries.filter(e => e.type === typeFilter), [entries, typeFilter]);
  const topGenres    = useMemo(() => { const t = {}; entries.forEach(e => e.genres.forEach(g => { t[g] = (t[g] || 0) + 1; })); return Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 3); }, [entries]);
  const totalWatched = useMemo(() => entries.reduce((s, e) => s + e.seasons.reduce((s2, se) => s2 + (se.watchedEpisodes || 0), 0), 0), [entries]);
  const totalKnown   = useMemo(() => entries.reduce((s, e) => s + e.seasons.reduce((s2, se) => s2 + (se.totalEpisodes || 0), 0), 0), [entries]);
  const globalPct    = totalKnown > 0 ? Math.min(100, (totalWatched / totalKnown) * 100) : 0;
  const watchTime    = useMemo(() => calcWatchTime(entries), [entries]);
  const animTotal    = useCountUp(entries.length);
  const animEnCours  = useCountUp(byType.filter(e => e.status === "en-cours").length);
  const animWatched  = useCountUp(totalWatched);
  const hasFilters   = selectedStatuses.length > 0;
  const isSearch     = searchQuery.trim().length > 0;

  return (
    <>
      {/* ══ STICKY TOP BAR ════════════════════════════════════════════════ */}
      <div className="sticky top-0 z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-6 bg-violet-950/95 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="h-8 w-8 rounded-xl flex-shrink-0" aria-hidden />
            <div>
              <p className="font-mono text-[9px] tracking-[0.25em] text-violet-500 uppercase leading-none mb-0.5 hidden sm:block">Journal de visionnage</p>
              <h1 className="text-lg font-bold tracking-tight leading-none" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>ANIVAULT</h1>
            </div>
          </div>
          {/* Actions — hauteur unifiée h-9 sur tous les boutons */}
          <div className="flex items-center gap-2">
            <button onClick={onSyncClick} disabled={syncing}
              title={syncing ? `Sync… ${syncProgress.current}/${syncProgress.total}` : "Actualiser les données"}
              className="h-9 flex items-center gap-1.5 px-3 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 disabled:opacity-70 active:scale-95 transition-all motion-reduce:transition-none">
              <RefreshCw size={14} className={`text-violet-400 ${syncing ? "animate-spin motion-reduce:animate-none" : ""}`} />
              {syncing
                ? <span className="text-xs font-mono text-violet-400 hidden sm:inline">{syncProgress.current}/{syncProgress.total}</span>
                : <span className="text-xs font-mono text-violet-400 hidden sm:inline">Sync</span>}
            </button>
            <BurgerMenu />
            <button onClick={onAddClick}
              className="h-9 flex items-center gap-1.5 bg-amber-400 text-violet-950 font-semibold text-sm px-4 rounded-xl hover:bg-amber-300 active:scale-95 transition-all motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300">
              <Plus size={16} />
              <span className="hidden sm:inline">Ajouter</span>
            </button>
          </div>
        </div>
      </div>

      {/* ══ STATS ═════════════════════════════════════════════════════════ */}
      {!loading && entries.length > 0 && (
        <div className="rounded-2xl bg-violet-900/30 border border-white/5 mb-6 overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
            <div className="p-4"><p className="font-mono text-2xl font-medium">{animTotal}</p><p className="text-[11px] text-violet-400 uppercase tracking-wide">Titres suivis</p></div>
            <div className="p-4"><p className="font-mono text-2xl font-medium">{animEnCours}</p><p className="text-[11px] text-violet-400 uppercase tracking-wide">En cours</p></div>
            <div className="p-4"><p className="font-mono text-2xl font-medium text-amber-400">{watchTime}</p><p className="text-[11px] text-violet-400 uppercase tracking-wide">Temps total</p></div>
            <div className="p-4">
              {topGenres.length > 0
                ? (<><p className="font-medium truncate">{topGenres.map(([g]) => g).join(", ")}</p><p className="text-[11px] text-violet-400 uppercase tracking-wide">Genres préférés</p></>)
                : (<><p className="font-medium text-violet-500">—</p><p className="text-[11px] text-violet-400 uppercase tracking-wide">Genres préférés</p></>)}
            </div>
          </div>
          {totalKnown > 0 && (
            <div className="px-4 pt-3 pb-4 border-t border-white/5">
              <div className="flex items-center justify-between mb-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-violet-400">Progression globale</p>
                <p className="font-mono text-[11px] text-violet-300">{animWatched} / {totalKnown} épisodes</p>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-teal-400 transition-[width] duration-1000 ease-out motion-reduce:transition-none" style={{ width: `${globalPct}%` }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ RECHERCHE ═════════════════════════════════════════════════════ */}
      <div className="mb-4">
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border transition-colors duration-200 motion-reduce:transition-none ${searchFocused ? "bg-violet-900/60 border-violet-500/60 shadow-[0_0_0_3px_rgba(139,92,246,0.15)]" : "bg-violet-900/30 border-white/5 hover:border-white/10"}`}>
          <Search size={15} className={`flex-shrink-0 transition-colors duration-200 motion-reduce:transition-none ${searchFocused || isSearch ? "text-violet-300" : "text-violet-500"}`} />
          <input ref={searchRef} type="text" value={searchQuery} onChange={e => onSearchChange(e.target.value)}
            onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
            placeholder="Rechercher par titre, genre, note… (ou appuie sur /)"
            className="flex-1 bg-transparent text-sm text-violet-50 placeholder-violet-500 focus:outline-none" />
          {isSearch && (
            <button onClick={() => { onSearchChange(""); searchRef.current?.focus(); }} aria-label="Effacer"
              className="flex-shrink-0 p-0.5 rounded-full text-violet-400 hover:text-violet-200 hover:bg-white/10 active:scale-90 transition-all motion-reduce:transition-none">
              <X size={14} />
            </button>
          )}
          {!isSearch && !searchFocused && (
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded border border-white/10 font-mono text-[10px] text-violet-500 select-none">/</kbd>
          )}
        </div>
      </div>

      {/* ══ BOUTON AJOUTER ════════════════════════════════════════════════ */}
      <button onClick={onAddClick}
        className="w-full flex items-center justify-center gap-2 mb-4 py-2.5 rounded-xl border border-dashed border-amber-400/30 text-amber-400/70 hover:bg-amber-400/8 hover:border-amber-400/60 hover:text-amber-400 transition-all text-sm font-medium active:scale-[0.99] motion-reduce:transition-none">
        <Plus size={15} /> Ajouter un titre
      </button>

      {/* ══ FILTRE TYPE : Tout / Animes / Séries ══════════════════════════ */}
      <div className="flex justify-center mb-5">
        <div className="inline-flex rounded-full bg-white/5 border border-white/10 p-0.5">
          {[{ key: "all", label: "Tout", icon: null }, { key: "anime", label: "Animes", icon: <Film size={12} /> }, { key: "serie", label: "Séries", icon: <Tv size={12} /> }].map(({ key, label, icon }) => (
            <button key={key} onClick={() => onTypeFilterChange(key)}
              className={`flex items-center gap-1.5 px-6 py-1.5 rounded-full text-xs font-medium transition-all duration-200 active:scale-95 motion-reduce:transition-none ${typeFilter === key ? "bg-amber-400 text-violet-950 font-semibold shadow-sm" : "text-violet-300 hover:text-violet-100"}`}>
              {icon}{label}
            </button>
          ))}
        </div>
      </div>

      {/* ══ FILTRES STATUT ════════════════════════════════════════════════ */}
      <div className="rounded-2xl bg-violet-900/20 border border-white/5 p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-violet-500">Statut</p>
          {hasFilters && (
            <button onClick={onClearFilters}
              className="flex items-center gap-1 text-[10px] font-mono text-violet-400 hover:text-violet-200 transition-colors motion-reduce:transition-none">
              <X size={10} /> Réinitialiser
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_ORDER.map(k => (
            <FilterChip key={k} active={selectedStatuses.includes(k)} onClick={() => onToggleStatus(k)} colorClass={STATUS_CHIP_COLOR[k]}>
              <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${STATUS[k].dot}`} />
              {STATUS[k].label}
            </FilterChip>
          ))}
        </div>
      </div>
    </>
  );
}