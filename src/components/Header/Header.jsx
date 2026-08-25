import { useMemo, useRef, useEffect, useState } from "react";
import { motion } from "motion/react";
import {
  Plus, Film, Tv, Clapperboard, RefreshCw, X, Search,
  LibraryBig, PlayCircle, CheckCircle2, Bookmark, XCircle,
  Clock, Flame,
} from "lucide-react";
import { useLibrary }           from "../../context/LibraryContext";
import { useCountUp }           from "../../hooks/useCountUp";
import { BurgerMenu }           from "../common/BurgerMenu";
import { NotificationPanel }    from "../common/NotificationPanel";  // ← AJOUT
import { calcWatchMinutes, formatWatchTime, calcCurrentStreak } from "../../utils/watchTime";
import { STATUS, STATUS_ORDER } from "../../utils/status";

// Teintes des cellules de stats — classes complètes (et non interpolées)
// pour rester détectables par le scanner JIT de Tailwind.
const STAT_TINTS = {
  sky:    "bg-sky-400/10 text-sky-300",
  amber:  "bg-amber-400/10 text-amber-300",
  teal:   "bg-teal-400/10 text-teal-300",
  rose:   "bg-rose-400/10 text-rose-300",
  flame:  "bg-orange-400/10 text-orange-300",
};

// Unités cyclées au clic sur la cellule "Temps total"
const TIME_UNITS = ["auto", "months", "years"];

// Icône + teinte par statut, pour la cellule "Titres en cours" cyclable
const STATUS_STAT_ICON = { "en-cours": PlayCircle, "termine": CheckCircle2, "a-voir": Bookmark, "abandonne": XCircle };
const STATUS_STAT_TINT = { "en-cours": STAT_TINTS.amber, "termine": STAT_TINTS.teal, "a-voir": STAT_TINTS.sky, "abandonne": STAT_TINTS.rose };

// Cellule "Titres" cyclable : tout → séries → animes → films
const TITLE_STAT_ORDER = ["all", "serie", "anime", "film"];
const TITLE_STAT_LABEL = { all: "Titres", serie: "Séries", anime: "Animes", film: "Films" };
const TITLE_STAT_ICON  = { all: LibraryBig, serie: Tv, anime: Film, film: Clapperboard };
const TITLE_STAT_TINT  = { all: STAT_TINTS.sky, serie: STAT_TINTS.sky, anime: STAT_TINTS.sky, film: STAT_TINTS.sky };

function filterByType(entries, key) {
  if (key === "all")   return entries;
  if (key === "film")  return entries.filter((e) => e.category === "movie");
  if (key === "serie") return entries.filter((e) => e.type === "serie" && e.category !== "movie");
  return entries.filter((e) => e.type === key); // "anime"
}

// Petite cellule de stat — structure identique pour toutes (icône → valeur →
// libellé) afin que les icônes restent parfaitement alignées entre elles,
// quelle que soit la longueur du contenu affiché.
function StatCell({ icon, tint, value, label, onClick, ariaLabel, dots }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-label={onClick ? ariaLabel : undefined}
      title={onClick ? ariaLabel : undefined}
      className={`flex flex-col items-start px-1.5 py-2 sm:px-3 sm:py-3 text-left min-w-0 ${onClick ? "active:scale-[0.96] transition-transform motion-reduce:transition-none" : ""}`}
    >
      <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center mb-1 sm:mb-1.5 flex-shrink-0 ${tint}`}>
        {icon}
      </div>
      <p className="font-mono text-sm sm:text-lg font-bold tabular-nums leading-tight text-violet-50 truncate w-full">{value}</p>
      <div className="flex items-center justify-between w-full mt-0.5 gap-1">
        <p className="text-[8px] sm:text-[10px] text-violet-400 uppercase tracking-wide leading-tight truncate">{label}</p>
        {dots && <div className="flex gap-0.5 flex-shrink-0">{dots}</div>}
      </div>
    </Comp>
  );
}

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

  const byType = useMemo(() => filterByType(entries, typeFilter), [entries, typeFilter]);
  const totalWatched = useMemo(() => entries.reduce((s, e) => s + e.seasons.reduce((s2, se) => s2 + (se.watchedEpisodes || 0), 0), 0), [entries]);
  const totalKnown   = useMemo(() => entries.reduce((s, e) => s + e.seasons.reduce((s2, se) => s2 + (se.totalEpisodes || 0), 0), 0), [entries]);
  const globalPct    = totalKnown > 0 ? Math.min(100, (totalWatched / totalKnown) * 100) : 0;
  const watchMinutes = useMemo(() => calcWatchMinutes(entries), [entries]);
  const [timeUnit, setTimeUnit] = useState("auto");
  const watchTime    = useMemo(() => formatWatchTime(watchMinutes, timeUnit), [watchMinutes, timeUnit]);
  const cycleTimeUnit = () => setTimeUnit((u) => TIME_UNITS[(TIME_UNITS.indexOf(u) + 1) % TIME_UNITS.length]);

  // Cellule "Titres en cours" cyclable : clic → statut suivant
  const [statusStatIdx, setStatusStatIdx] = useState(0);
  const statusStatKey = STATUS_ORDER[statusStatIdx];
  const statusStatCount = useMemo(() => byType.filter(e => e.status === statusStatKey).length, [byType, statusStatKey]);
  const cycleStatusStat = () => setStatusStatIdx((i) => (i + 1) % STATUS_ORDER.length);
  const StatusStatIcon = STATUS_STAT_ICON[statusStatKey];

  const currentStreak = useMemo(() => calcCurrentStreak(entries), [entries]);

  // Cellule "Titres" cyclable : clic → type suivant (tout / séries / animes / films)
  const [titleStatIdx, setTitleStatIdx] = useState(0);
  const titleStatKey   = TITLE_STAT_ORDER[titleStatIdx];
  const titleStatCount = useMemo(() => filterByType(entries, titleStatKey).length, [entries, titleStatKey]);
  const cycleTitleStat = () => setTitleStatIdx((i) => (i + 1) % TITLE_STAT_ORDER.length);
  const TitleStatIcon  = TITLE_STAT_ICON[titleStatKey];

  const animTotal       = useCountUp(titleStatCount);
  const animStatusStat  = useCountUp(statusStatCount);
  const animStreak      = useCountUp(currentStreak);
  const animWatched     = useCountUp(totalWatched);
  const animKnown       = useCountUp(totalKnown);
  const animPct         = useCountUp(Math.round(globalPct));
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

      {/* Stats — un seul bloc, séparateurs sobres, progression intégrée */}
      {!loading && entries.length > 0 && (
        <div className="mb-5 rounded-xl sm:rounded-2xl bg-violet-900/30 border border-white/5 overflow-hidden">
          <div className="grid grid-cols-4 divide-x divide-white/5">
            <StatCell
              icon={<TitleStatIcon size={13} />}
              tint={TITLE_STAT_TINT[titleStatKey]}
              value={animTotal}
              label={TITLE_STAT_LABEL[titleStatKey]}
              onClick={cycleTitleStat}
              ariaLabel="Afficher un autre type de titres"
              dots={TITLE_STAT_ORDER.map((k) => (
                <span key={k} className={`w-1 h-1 rounded-full ${k === titleStatKey ? "bg-sky-300" : "bg-white/15"}`} />
              ))}
            />

            <StatCell
              icon={<StatusStatIcon size={13} />}
              tint={STATUS_STAT_TINT[statusStatKey]}
              value={animStatusStat}
              label={STATUS[statusStatKey].label}
              onClick={cycleStatusStat}
              ariaLabel="Afficher un autre statut"
              dots={STATUS_ORDER.map((s) => (
                <span key={s} className={`w-1 h-1 rounded-full ${s === statusStatKey ? "bg-amber-300" : "bg-white/15"}`} />
              ))}
            />

            <StatCell
              icon={<Flame size={13} />}
              tint={STAT_TINTS.flame}
              value={animStreak}
              label="Streak"
            />

            {/* Temps total — cliquable, cycle auto → mois → années */}
            <StatCell
              icon={<Clock size={13} />}
              tint={STAT_TINTS.teal}
              value={watchTime}
              label="Temps"
              onClick={cycleTimeUnit}
              ariaLabel="Changer l'unité du temps total"
              dots={TIME_UNITS.map((u) => (
                <span key={u} className={`w-1 h-1 rounded-full ${u === timeUnit ? "bg-teal-300" : "bg-white/15"}`} />
              ))}
            />
          </div>

          {totalKnown > 0 && (
            <div className="border-t border-white/5 px-3 sm:px-4 pt-2 sm:pt-2.5 pb-2.5 sm:pb-3">
              <div className="flex items-center justify-between mb-1.5">
                <p className="font-mono text-[9px] sm:text-[10px] uppercase tracking-widest text-violet-400">Progression</p>
                <p className="font-mono text-[10px] sm:text-[11px] text-violet-300 tabular-nums">
                  {animWatched}/{animKnown} <span className="text-amber-300 font-semibold">· {animPct}%</span>
                </p>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.45)] transition-[width] duration-1000 ease-out motion-reduce:transition-none"
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