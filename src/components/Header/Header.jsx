import { useMemo, useRef, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Plus, Film, Tv, Clapperboard, RefreshCw, X, Search, LibraryBig, PlayCircle, Clock, Sparkles } from "lucide-react";
import { useLibrary }           from "../../context/LibraryContext";
import { useCountUp }           from "../../hooks/useCountUp";
import { BurgerMenu }           from "../common/BurgerMenu";
import { NotificationPanel }    from "../common/NotificationPanel";  // ← AJOUT
import { calcWatchTime }        from "../../utils/watchTime";

// Teintes des cartes de stats — classes complètes (et non interpolées) pour
// rester détectables par le scanner JIT de Tailwind.
const STAT_TINTS = {
  sky:   { glow: "bg-sky-400/10",   chip: "bg-sky-400/10 text-sky-300",     value: "text-violet-50" },
  amber: { glow: "bg-amber-400/10", chip: "bg-amber-400/10 text-amber-300", value: "text-violet-50" },
  teal:  { glow: "bg-teal-400/10",  chip: "bg-teal-400/10 text-teal-300",   value: "text-violet-50" },
  pink:  { glow: "bg-pink-400/10",  chip: "bg-pink-400/10 text-pink-300",   value: "text-violet-50" },
};

export function Header({
  typeFilter, searchQuery = "",
  onTypeFilterChange,
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

  const byType = useMemo(() => {
    if (typeFilter === "all")   return entries;
    if (typeFilter === "film")  return entries.filter(e => e.category === "movie");
    if (typeFilter === "serie") return entries.filter(e => e.type === "serie" && e.category !== "movie");
    return entries.filter(e => e.type === typeFilter); // "anime"
  }, [entries, typeFilter]);
  const topGenres    = useMemo(() => { const t = {}; entries.forEach(e => e.genres.forEach(g => { t[g] = (t[g] || 0) + 1; })); return Object.entries(t).sort((a, b) => b[1] - a[1]).slice(0, 3); }, [entries]);
  const totalWatched = useMemo(() => entries.reduce((s, e) => s + e.seasons.reduce((s2, se) => s2 + (se.watchedEpisodes || 0), 0), 0), [entries]);
  const totalKnown   = useMemo(() => entries.reduce((s, e) => s + e.seasons.reduce((s2, se) => s2 + (se.totalEpisodes || 0), 0), 0), [entries]);
  const globalPct    = totalKnown > 0 ? Math.min(100, (totalWatched / totalKnown) * 100) : 0;
  const watchTime    = useMemo(() => calcWatchTime(entries), [entries]);
  const animTotal    = useCountUp(entries.length);
  const animEnCours  = useCountUp(byType.filter(e => e.status === "en-cours").length);
  const animWatched  = useCountUp(totalWatched);
  const isSearch     = searchQuery.trim().length > 0;

  const [logoPlaying, setLogoPlaying] = useState(false);
  const logoTimerRef = useRef(null);

  // Rejoue le gif du logo une fois au clic, puis revient au logo statique.
  // Le "?t=" force le navigateur à relancer l'animation depuis la 1ère frame
  // à chaque clic (sinon un gif déjà en cache ne redémarre pas).
  function playLogoOnce() {
    clearTimeout(logoTimerRef.current);
    setLogoPlaying(Date.now());
    logoTimerRef.current = setTimeout(() => setLogoPlaying(false), 850);
  }
  useEffect(() => () => clearTimeout(logoTimerRef.current), []);

  return (
    <>
      <div
        className="sticky top-0 z-40 -mx-4 sm:-mx-6 px-4 sm:px-6 pb-3 mb-6 bg-violet-950/95 backdrop-blur-md border-b border-white/5"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <button
              type="button" onClick={playLogoOnce}
              aria-label="Rejouer l'animation du logo"
              className="flex-shrink-0 h-12 w-12 rounded-full bg-white p-[3px] shadow-sm active:scale-95 transition-transform motion-reduce:transition-none"
            >
              <img
                src={logoPlaying ? `/splash-anim.gif?t=${logoPlaying}` : "/logo.png"}
                alt="Logo AniVault"
                className="h-full w-full rounded-full object-cover"
              />
            </button>
            <div>
              <p className="font-mono text-[9px] tracking-[0.25em] text-violet-500 uppercase leading-none mb-0.5 hidden sm:block">Journal de visionnage</p>
              <h1 className="text-2xl font-bold italic tracking-tight leading-none" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>ANIVAULT</h1>
            </div>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-2">
            <button onClick={onSyncClick} disabled={syncing}
              title={syncing ? `Sync… ${syncProgress.current}/${syncProgress.total}` : "Actualiser les données"}
              className="h-9 flex items-center gap-1.5 px-3 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 disabled:opacity-70 active:scale-95 transition-all motion-reduce:transition-none">
              <RefreshCw size={14} className={`text-violet-400 ${syncing ? "animate-spin motion-reduce:animate-none" : ""}`} />
              {syncing
                ? <span className="text-xs font-mono text-violet-400 hidden sm:inline">{syncProgress.current}/{syncProgress.total}</span>
                : <span className="text-xs font-mono text-violet-400 hidden sm:inline">Sync</span>}
            </button>
            {/* ── Cloche notifications ── */}
            <NotificationPanel />
            <BurgerMenu />
          </div>
        </div>
      </div>

      {/* Stats */}
      {!loading && entries.length > 0 && (
        <div className="mb-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { icon: <LibraryBig size={16} />,  value: animTotal,   label: "Titres suivis", tint: "sky" },
              { icon: <PlayCircle size={16} />,  value: animEnCours, label: "En cours",      tint: "amber" },
              { icon: <Clock size={16} />,       value: watchTime,   label: "Temps total",   tint: "teal" },
            ].map(({ icon, value, label, tint }) => (
              <div
                key={label}
                className="relative rounded-2xl bg-violet-900/30 border border-white/5 p-3.5 overflow-hidden active:scale-[0.97] transition-transform motion-reduce:transition-none"
              >
                <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full ${STAT_TINTS[tint].glow} blur-xl pointer-events-none`} />
                <div className={`relative w-8 h-8 rounded-xl flex items-center justify-center mb-2.5 ${STAT_TINTS[tint].chip}`}>{icon}</div>
                <p className={`relative font-mono text-xl sm:text-2xl font-bold tabular-nums leading-none ${STAT_TINTS[tint].value}`}>{value}</p>
                <p className="relative text-[10px] text-violet-400 uppercase tracking-wide mt-1.5">{label}</p>
              </div>
            ))}

            <div className="relative rounded-2xl bg-violet-900/30 border border-white/5 p-3.5 overflow-hidden active:scale-[0.97] transition-transform motion-reduce:transition-none">
              <div className={`absolute -right-4 -top-4 w-16 h-16 rounded-full ${STAT_TINTS.pink.glow} blur-xl pointer-events-none`} />
              <div className={`relative w-8 h-8 rounded-xl flex items-center justify-center mb-2.5 ${STAT_TINTS.pink.chip}`}><Sparkles size={16} /></div>
              {topGenres.length > 0 ? (
                <p className="relative text-[13px] sm:text-sm font-semibold text-violet-50 leading-snug line-clamp-2">{topGenres.map(([g]) => g).join(", ")}</p>
              ) : (
                <p className="relative text-sm font-semibold text-violet-600">—</p>
              )}
              <p className="relative text-[10px] text-violet-400 uppercase tracking-wide mt-1.5">Genres préférés</p>
            </div>
          </div>

          {totalKnown > 0 && (
            <div className="mt-2.5 rounded-2xl bg-violet-900/30 border border-white/5 px-4 pt-3.5 pb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-violet-400">Progression globale</p>
                <p className="font-mono text-[11px] text-violet-300 tabular-nums">
                  {animWatched} / {totalKnown} épisodes <span className="text-amber-300 font-semibold">· {Math.round(globalPct)}%</span>
                </p>
              </div>
              <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.45)] transition-[width] duration-1000 ease-out motion-reduce:transition-none"
                  style={{ width: `${globalPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recherche */}
      <div className="mb-4">
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border transition-colors duration-200 motion-reduce:transition-none ${searchFocused ? "bg-violet-900/60 border-violet-500/60 shadow-[0_0_0_3px_rgba(139,92,246,0.15)]" : "bg-violet-900/30 border-white/5 hover:border-white/10"}`}>
          <Search size={15} className={`flex-shrink-0 transition-colors duration-200 motion-reduce:transition-none ${searchFocused || isSearch ? "text-violet-300" : "text-violet-500"}`} />
          <input ref={searchRef} type="text" value={searchQuery} onChange={e => onSearchChange(e.target.value)}
            onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)}
            placeholder="Rechercher dans ta bibliothèque (Titre, genre, note...)"
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

      {/* Filtre type */}
      <div className="flex rounded-2xl bg-white/5 border border-white/10 p-0.5 mb-5">
        {[{ key: "all", label: "Tout", icon: null }, { key: "anime", label: "Animes", icon: <Film size={12} /> }, { key: "serie", label: "Séries", icon: <Tv size={12} /> }, { key: "film",  label: "Films",   icon: <Clapperboard size={12} /> }].map(({ key, label, icon }) => (
          <button key={key} onClick={() => onTypeFilterChange(key)}
            className={`relative flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-xl text-xs font-medium transition-colors duration-200 active:scale-95 motion-reduce:transition-none ${typeFilter === key ? "text-violet-950 font-semibold" : "text-violet-300 hover:text-violet-100"}`}>
            {typeFilter === key && (
              <motion.span
                layoutId="home-type-filter-pill"
                className="absolute inset-0 bg-amber-400 rounded-xl shadow-sm"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">{icon}{label}</span>
          </button>
        ))}
      </div>
    </>
  );
}