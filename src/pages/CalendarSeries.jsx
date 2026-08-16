// src/pages/CalendarSeries.jsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ChevronLeft, ChevronRight, X, Plus, Check } from "lucide-react";
import { fetchTVMazeScheduleForDate } from "../api/tvmaze";
import { useLibrary }    from "../context/LibraryContext";
import { importResult }  from "../api";
import { TopBar }        from "../components/common/TopBar";
import { Modal }         from "../components/Modal/Modal";
import { AnimatePresence } from "motion/react";
import { PullToRefresh } from "../components/common/PullToRefresh";
import { CalendarTabs }  from "../components/common/CalendarTabs";
import { useWeekNavigation, DAY_NAMES } from "../hooks/useWeekNavigation";
import { getCached, getStaleCached, setCached, TTL } from "../lib/cache";

// ── Lundi de la semaine courante (minuit local) ──────────────────────────────
function getMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}
function pad(n) { return String(n).padStart(2, "0"); }
function toISODate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

// ── Regroupe les épisodes d'une même série sortant le même jour ─────────────
// Ex : une série qui sort 2 épisodes le même jour (final de saison en double,
// rattrapage…) n'occupe qu'une seule ligne dans le calendrier.
function groupSameDayEpisodes(dayEntries) {
  const map = new Map();
  dayEntries.forEach((e) => {
    if (!map.has(e.tvmazeId)) {
      map.set(e.tvmazeId, {
        tvmazeId: e.tvmazeId, title: e.title, image: e.image, genres: e.genres,
        network: e.network, airingAt: e.airingAt, episodes: [],
      });
    }
    const group = map.get(e.tvmazeId);
    group.episodes.push({ season: e.season, episode: e.episode, episodeName: e.episodeName, summary: e.summary });
    if (e.airingAt < group.airingAt) group.airingAt = e.airingAt;
  });
  return [...map.values()]
    .map((g) => ({ ...g, episodes: g.episodes.sort((a, b) => a.season - b.season || a.episode - b.episode) }))
    .sort((a, b) => a.airingAt - b.airingAt);
}

// Formate une liste d'épisodes en "S2 · Ép. 3-4" (plages consécutives regroupées)
function formatEpisodeLabel(episodes) {
  const bySeason = new Map();
  episodes.forEach(({ season, episode }) => {
    if (!bySeason.has(season)) bySeason.set(season, []);
    bySeason.get(season).push(episode);
  });
  return [...bySeason.entries()].map(([season, eps]) => {
    const sorted = [...eps].sort((a, b) => a - b);
    const ranges = [];
    let start = sorted[0], prev = sorted[0];
    for (let i = 1; i <= sorted.length; i++) {
      const n = sorted[i];
      if (n === prev + 1) { prev = n; continue; }
      ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = prev = n;
    }
    return `S${season} · Ép. ${ranges.join(", ")}`;
  }).join(" · ");
}

// ── Modal détail épisode(s) ────────────────────────────────────────────────────
function EpisodeDetailModal({ group, onClose }) {
  const time  = new Date(group.airingAt);
  const multi = group.episodes.length > 1;
  return (
    <Modal onClose={onClose} maxWidth="max-w-sm" zIndex="z-50">
      <div className="relative flex flex-col max-h-[90vh]">
        {group.image && (
          <div className="relative h-44 flex-shrink-0 overflow-hidden bg-violet-950">
            <img src={group.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 scale-110" style={{ filter: "blur(16px)" }} aria-hidden />
            <img src={group.image} alt={group.title} className="relative mx-auto h-full w-auto object-contain drop-shadow-xl" />
          </div>
        )}
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white/70 hover:text-white active:scale-95 transition-all motion-reduce:transition-none z-10" aria-label="Fermer">
          <X size={15} />
        </button>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <h2 className="text-sm font-bold text-violet-100 leading-snug">{group.title}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="font-mono text-[11px] text-amber-400 font-semibold">{formatEpisodeLabel(group.episodes)}</span>
              {!multi && group.episodes[0].episodeName && (
                <span className="font-mono text-[11px] text-violet-300 truncate max-w-[160px]">— {group.episodes[0].episodeName}</span>
              )}
            </div>
          </div>

          {multi ? (
            <div className="space-y-3">
              {group.episodes.map((ep, i) => (
                <div key={i} className={i > 0 ? "pt-3 border-t border-white/5" : ""}>
                  <p className="font-mono text-[11px] text-violet-300 font-semibold">
                    Ép. {ep.episode}{ep.episodeName ? ` — ${ep.episodeName}` : ""}
                  </p>
                  {ep.summary ? (
                    <p className="text-xs text-violet-300 leading-relaxed mt-1">{ep.summary}</p>
                  ) : (
                    <p className="text-xs text-violet-500 font-mono italic mt-1">Aucun synopsis disponible.</p>
                  )}
                </div>
              ))}
            </div>
          ) : group.episodes[0].summary ? (
            <p className="text-xs text-violet-300 leading-relaxed">{group.episodes[0].summary}</p>
          ) : (
            <p className="text-xs text-violet-500 font-mono italic">Aucun synopsis disponible.</p>
          )}

          <p className="font-mono text-[10px] text-violet-500 pt-1 border-t border-white/5">
            {time.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            {" · "}
            {time.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
            {group.network ? ` · ${group.network}` : ""}
          </p>
        </div>
      </div>
    </Modal>
  );
}

// ── Carte épisode(s) ───────────────────────────────────────────────────────────
function EpisodeCard({ group, onClick, isInLibrary, onAdd, isAdding }) {
  const time = new Date(group.airingAt);
  return (
    <div className="w-full flex gap-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors overflow-hidden">
      <button
        onClick={onClick}
        className="flex gap-2.5 flex-1 min-w-0 p-2.5 text-left active:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 rounded-xl"
      >
        {group.image ? (
          <img src={group.image} alt="" className="w-12 h-[72px] object-cover rounded-lg flex-shrink-0" />
        ) : (
          <div className="w-12 h-[72px] rounded-lg bg-white/10 flex-shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-violet-100 leading-snug line-clamp-3">{group.title}</p>
          <p className="font-mono text-[10px] text-violet-400 mt-1.5">{formatEpisodeLabel(group.episodes)}</p>
          <p className="font-mono text-[10px] text-violet-500">
            {time.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </button>

      <div className="flex-shrink-0 flex items-center pr-2.5">
        {isInLibrary ? (
          <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-teal-500/15 text-teal-400" title="Déjà dans ta liste">
            <Check size={12} strokeWidth={2.5} />
            <span className="font-mono text-[9px] uppercase tracking-wide hidden sm:inline">Ma liste</span>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            disabled={isAdding}
            aria-label={`Ajouter ${group.title} à ma liste`}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-400/15 border border-amber-400/25 text-amber-400 hover:bg-amber-400/25 active:scale-95 transition-all motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAdding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} strokeWidth={2.5} />}
            <span className="font-mono text-[9px] uppercase tracking-wide hidden sm:inline">{isAdding ? "Ajout…" : "Ajouter"}</span>
          </button>
        )}
      </div>
    </div>
  );
}

// Onglet segmenté (Tout / Ma liste)
function FilterTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-0 px-2 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 motion-reduce:transition-none whitespace-nowrap ${
        active ? "bg-amber-400 text-violet-950" : "text-violet-300 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export function CalendarSeries() {
  const navigate = useNavigate();
  const { entries: libraryEntries, saveEntry } = useLibrary();
  const {
    VISIBLE_DAYS, dayOffset, gridKey, slideClass,
    canPrevDay, canNextDay, handlePrevDay, handleNextDay, jumpToDay,
    gridPointerHandlers,
  } = useWeekNavigation();

  const [weekEpisodes,  setWeekEpisodes]  = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [error,         setError]         = useState("");
  const [selectedItem,  setSelectedItem]  = useState(null);
  const [contentFilter, setContentFilter] = useState("all");
  const [addingIds,     setAddingIds]     = useState(new Set());

  const weekMonday = useMemo(() => getMonday(), []);

  // IDs TVmaze déjà présents dans la bibliothèque
  const libraryTvmazeIds = useMemo(
    () => new Set(libraryEntries.filter((e) => e.tvmazeId).map((e) => String(e.tvmazeId))),
    [libraryEntries]
  );

  const load = useCallback(async (isRefresh = false) => {
    const cacheKey = `calendar_series_v2_${toISODate(weekMonday)}`;

    if (!isRefresh) {
      const cached = getCached(cacheKey);
      if (cached) {
        setWeekEpisodes(cached);
        setLoading(false);
        return;
      }
    }

    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError("");

    try {
      const dates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekMonday); d.setDate(weekMonday.getDate() + i);
        return toISODate(d);
      });
      const results = await Promise.allSettled(dates.map((d) => fetchTVMazeScheduleForDate(d)));
      const data = results.filter((r) => r.status === "fulfilled").flatMap((r) => r.value);
      setCached(cacheKey, data, TTL.SERIES_CALENDAR);
      setWeekEpisodes(data);
    } catch (err) {
      const stale = getStaleCached(cacheKey);
      if (stale) {
        setWeekEpisodes(stale);
        setError("⚠️ Connexion indisponible — données précédentes affichées.");
      } else {
        setError("Impossible de charger le calendrier. Vérifie ta connexion et réessaie.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [weekMonday]);

  useEffect(() => { load(); }, [load]);

  const byDay = useMemo(() => {
    const filtered = contentFilter === "mine"
      ? weekEpisodes.filter((e) => libraryTvmazeIds.has(String(e.tvmazeId)))
      : weekEpisodes;

    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(weekMonday);
      day.setDate(weekMonday.getDate() + i);
      const dayStart = day.getTime();
      const dayEnd   = dayStart + 86400000;
      const dayEntries = filtered
        .filter((x) => x.airingAt >= dayStart && x.airingAt < dayEnd)
        .sort((a, b) => a.airingAt - b.airingAt);
      return { date: day, entries: groupSameDayEpisodes(dayEntries) };
    });
  }, [weekEpisodes, weekMonday, contentFilter, libraryTvmazeIds]);

  const visibleDays     = byDay.slice(dayOffset, dayOffset + VISIBLE_DAYS);
  const todayDateString = useMemo(() => new Date().toDateString(), []);
  const totalVisible    = visibleDays.reduce((sum, d) => sum + d.entries.reduce((s, g) => s + g.episodes.length, 0), 0);

  const weekLabel = useMemo(() => {
    const end = new Date(weekMonday);
    end.setDate(weekMonday.getDate() + 6);
    const fmt = (d) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    return `${fmt(weekMonday)} – ${fmt(end)}`;
  }, [weekMonday]);

  const handleAddToLibrary = useCallback(async (group) => {
    if (addingIds.has(group.tvmazeId)) return;
    setAddingIds((prev) => new Set([...prev, group.tvmazeId]));
    try {
      const imported = await importResult({
        id: group.tvmazeId, source: "tvmaze", title: group.title,
        image: group.image, genres: group.genres,
      });
      saveEntry({ ...imported, status: "a-voir", rating: 0 }, null);
    } catch (err) {
      console.error("Erreur lors de l'ajout à la bibliothèque :", err);
    } finally {
      setAddingIds((prev) => { const next = new Set(prev); next.delete(group.tvmazeId); return next; });
    }
  }, [addingIds, saveEntry]);

  return (
    <div className="min-h-screen bg-violet-950 text-violet-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PullToRefresh onRefresh={() => load(true)}>
        <div className="max-w-5xl mx-auto px-3 sm:px-6 pb-nav pt-safe-8">

          {/* ── En-tête ── */}
          <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
            <div className="min-w-0">
              <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-200 active:scale-95 transition-all motion-reduce:transition-none mb-2">
                <ChevronLeft size={16} /> Retour
              </button>
              <p className="font-mono text-[11px] tracking-[0.3em] text-violet-400 uppercase mb-0.5">Sorties d'épisodes · France</p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Calendrier</h1>
            </div>
            <TopBar />
          </div>

          <CalendarTabs />

          <p className="text-center text-xs sm:text-sm font-medium text-violet-400 mb-3">{weekLabel}</p>

          {/* ── Filtre Tout / Ma liste ── */}
          <div className="flex justify-center mb-5">
            <div className="inline-flex w-full max-w-xs items-center gap-1 rounded-full bg-white/5 border border-white/10 p-1">
              <FilterTab active={contentFilter === "all"}  onClick={() => setContentFilter("all")}>Tout</FilterTab>
              <FilterTab active={contentFilter === "mine"} onClick={() => setContentFilter("mine")}>Ma liste</FilterTab>
            </div>
          </div>

          {error && (
            <p className="text-center font-mono text-[11px] text-amber-400/90 mb-3 px-4">{error}</p>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3">
              <Loader2 size={28} className="animate-spin text-violet-400" />
              <p className="text-sm text-violet-400 font-mono">Chargement des sorties d'épisodes…</p>
            </div>
          ) : (
            <>
              {/* ── Navigation jours ── */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={handlePrevDay}
                  disabled={!canPrevDay}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 text-sm text-violet-300 transition-all motion-reduce:transition-none"
                >
                  <ChevronLeft size={15} />
                  <span className="hidden sm:inline text-xs">Préc.</span>
                </button>

                <div className="flex flex-col items-center gap-0.5">
                  <p className="font-mono text-[11px] text-violet-500">
                    {totalVisible} épisode{totalVisible !== 1 ? "s" : ""}
                  </p>
                  <div className="flex gap-1 items-center">
                    {Array.from({ length: 7 }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => jumpToDay(i)}
                        aria-label={DAY_NAMES[i]}
                        className={`rounded-full transition-all motion-reduce:transition-none ${
                          i >= dayOffset && i < dayOffset + VISIBLE_DAYS
                            ? "w-3 h-1.5 bg-amber-400"
                            : "w-1.5 h-1.5 bg-white/20 hover:bg-white/40"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleNextDay}
                  disabled={!canNextDay}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 text-sm text-violet-300 transition-all motion-reduce:transition-none"
                >
                  <span className="hidden sm:inline text-xs">Suiv.</span>
                  <ChevronRight size={15} />
                </button>
              </div>

              {/* ── Grille jours ── */}
              <div
                key={gridKey}
                {...gridPointerHandlers}
                style={{ touchAction: "pan-y" }}
                className={`grid gap-3 motion-reduce:animate-none ${slideClass} ${
                  VISIBLE_DAYS === 1 ? "grid-cols-1" : "grid-cols-3"
                }`}
              >
                {visibleDays.map(({ date, entries: dayEntries }, i) => {
                  const isToday   = date.toDateString() === todayDateString;
                  const globalIdx = dayOffset + i;

                  return (
                    <div
                      key={globalIdx}
                      className={`rounded-2xl border overflow-hidden flex flex-col ${
                        isToday ? "border-amber-400/40 bg-amber-400/5" : "border-white/5 bg-violet-900/20"
                      }`}
                    >
                      <div className={`px-3 sm:px-4 py-3 border-b ${isToday ? "border-amber-400/20" : "border-white/5"}`}>
                        <div className="flex items-center justify-between">
                          <p className={`font-mono text-xs uppercase tracking-widest font-semibold ${isToday ? "text-amber-400" : "text-violet-300"}`}>
                            {DAY_NAMES[globalIdx]}
                          </p>
                          {isToday && (
                            <span className="font-mono text-[8px] bg-amber-400 text-violet-950 px-1.5 py-0.5 rounded-full font-bold animate-glowPulse motion-reduce:animate-none">
                              Aujourd'hui
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-violet-500 mt-0.5">
                          {date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                        </p>
                      </div>

                      <div className="p-2.5 sm:p-3 flex-1 space-y-2 overflow-y-auto overscroll-auto max-h-[42vh] sm:max-h-[70vh]">
                        {dayEntries.length === 0 ? (
                          <p className="text-[11px] text-violet-600 font-mono text-center py-8">Aucun épisode</p>
                        ) : (
                          dayEntries.map((group) => (
                            <EpisodeCard
                              key={group.tvmazeId}
                              group={group}
                              onClick={() => setSelectedItem(group)}
                              isInLibrary={libraryTvmazeIds.has(String(group.tvmazeId))}
                              onAdd={() => handleAddToLibrary(group)}
                              isAdding={addingIds.has(group.tvmazeId)}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </PullToRefresh>

      <AnimatePresence>
        {selectedItem && (
          <EpisodeDetailModal key="episode-detail" group={selectedItem} onClose={() => setSelectedItem(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
