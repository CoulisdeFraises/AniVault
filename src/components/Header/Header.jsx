import { useMemo } from "react";
import { Plus, Film, Tv, RefreshCw, X } from "lucide-react";
import { STATUS, STATUS_ORDER } from "../../utils/status";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "../../utils/entry";
import { useLibrary } from "../../context/LibraryContext";
import { useAuth } from "../../context/AuthContext";
import { useCountUp } from "../../hooks/useCountUp";
import { BurgerMenu } from "../common/BurgerMenu";
import { calcWatchTime } from "../../utils/watchTime";

// ── Chip multi-sélection ──────────────────────────────────────────────────────
function FilterChip({ active, onClick, children, colorClass }) {
  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
        border transition-all active:scale-95 motion-reduce:transition-none whitespace-nowrap
        ${active
          ? colorClass || "bg-violet-600 border-violet-500 text-white"
          : "bg-white/5 border-white/10 text-violet-300 hover:bg-white/10 hover:text-violet-100"
        }
      `}
    >
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

const FORMAT_CHIP_COLOR = {
  tv:    "bg-violet-600 border-violet-500 text-white",
  ova:   "bg-purple-600 border-purple-500 text-white",
  movie: "bg-amber-600 border-amber-500 text-white",
};

export function Header({
  typeFilter,
  selectedStatuses  = [],
  selectedFormats   = [],
  onTypeFilterChange,
  onToggleStatus,
  onToggleFormat,
  onClearFilters,
  onAddClick,
  syncing = false,
  syncProgress = { current: 0, total: 0 },
  onSyncClick,
}) {
  const { entries, loading } = useLibrary();
  const { profile } = useAuth();

  const byType = useMemo(
    () => typeFilter === "all" ? entries : entries.filter((e) => e.type === typeFilter),
    [entries, typeFilter]
  );

  const topGenres = useMemo(() => {
    const tally = {};
    entries.forEach((e) => e.genres.forEach((g) => { tally[g] = (tally[g] || 0) + 1; }));
    return Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [entries]);

  const totalWatched = useMemo(
    () => entries.reduce((sum, e) => sum + e.seasons.reduce((s2, s) => s2 + (s.watchedEpisodes || 0), 0), 0),
    [entries]
  );
  const totalKnown = useMemo(
    () => entries.reduce((sum, e) => sum + e.seasons.reduce((s2, s) => s2 + (s.totalEpisodes || 0), 0), 0),
    [entries]
  );
  const globalPct = totalKnown > 0 ? Math.min(100, (totalWatched / totalKnown) * 100) : 0;
  const watchTime = useMemo(() => calcWatchTime(entries), [entries]);

  const animatedTotal   = useCountUp(entries.length);
  const animatedEnCours = useCountUp(byType.filter((e) => e.status === "en-cours").length);
  const animatedWatched = useCountUp(totalWatched);

  const hasActiveFilters = selectedStatuses.length > 0 || selectedFormats.length > 0;
  const showFormatFilter = typeFilter === "anime";

  return (
    <>
      {/* ── Barre principale ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="font-mono text-[11px] tracking-[0.3em] text-violet-400 uppercase mb-1">
            Mon Journal de visionnage
          </p>
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="" className="h-10 w-10 rounded-xl flex-shrink-0" aria-hidden />
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              ANIVAULT
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
          <BurgerMenu />
          <button
            onClick={onAddClick}
            className="flex items-center gap-1.5 bg-amber-400 text-violet-950 font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-amber-300 active:scale-95 transition-all motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-violet-950"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Ajouter un titre</span>
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      {!loading && entries.length > 0 && (
        <div className="rounded-2xl bg-violet-900/30 border border-white/5 mb-6 overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
            <div className="p-4">
              <p className="font-mono text-2xl font-medium">{animatedTotal}</p>
              <p className="text-[11px] text-violet-400 uppercase tracking-wide">Titres suivis</p>
            </div>
            <div className="p-4">
              <p className="font-mono text-2xl font-medium">{animatedEnCours}</p>
              <p className="text-[11px] text-violet-400 uppercase tracking-wide">En cours</p>
            </div>
            <div className="p-4">
              <p className="font-mono text-2xl font-medium text-amber-400">{watchTime}</p>
              <p className="text-[11px] text-violet-400 uppercase tracking-wide">Temps total</p>
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
          {totalKnown > 0 && (
            <div className="px-4 pt-3 pb-4 border-t border-white/5">
              <div className="flex items-center justify-between mb-2">
                <p className="font-mono text-[10px] uppercase tracking-widest text-violet-400">Progression globale</p>
                <p className="font-mono text-[11px] text-violet-300">{animatedWatched} / {totalKnown} épisodes</p>
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

      {/* ── Filtre type : Tout / Animes / Séries ── */}
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

      {/* ── Filtres multi-sélection ── */}
      <div className="rounded-2xl bg-violet-900/20 border border-white/5 p-4 mb-5 space-y-3">

        {/* En-tête filtres + bouton reset */}
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] uppercase tracking-widest text-violet-500">Filtres</p>
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="flex items-center gap-1 text-[10px] font-mono text-violet-400 hover:text-violet-200 transition-colors motion-reduce:transition-none"
            >
              <X size={10} /> Réinitialiser
            </button>
          )}
        </div>

        {/* Statut */}
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-violet-500 mb-2">Statut</p>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_ORDER.map((k) => (
              <FilterChip
                key={k}
                active={selectedStatuses.includes(k)}
                onClick={() => onToggleStatus(k)}
                colorClass={STATUS_CHIP_COLOR[k]}
              >
                <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${STATUS[k].dot}`} />
                {STATUS[k].label}
              </FilterChip>
            ))}
          </div>
        </div>

        {/* Format (anime uniquement) */}
        {showFormatFilter && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-violet-500 mb-2">Format</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <FilterChip
                  key={key}
                  active={selectedFormats.includes(key)}
                  onClick={() => onToggleFormat(key)}
                  colorClass={FORMAT_CHIP_COLOR[key]}
                >
                  {CATEGORY_ICONS[key]} {label}
                </FilterChip>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}