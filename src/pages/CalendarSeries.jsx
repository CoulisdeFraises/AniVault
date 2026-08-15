// src/pages/CalendarSeries.jsx
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ChevronLeft, ChevronRight, Tv } from "lucide-react";
import { useLibrary }    from "../context/LibraryContext";
import { fetchNextAiring } from "../api";
import { TopBar }        from "../components/common/TopBar";
import { PullToRefresh } from "../components/common/PullToRefresh";
import { CalendarTabs }  from "../components/common/CalendarTabs";
import { useWeekNavigation, DAY_NAMES } from "../hooks/useWeekNavigation";

// ── Lundi de la semaine courante (minuit local) ──────────────────────────────
function getMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.getFullYear(), d.getMonth(), diff);
  return monday;
}

// ── Carte épisode (série de la bibliothèque) ──────────────────────────────────
function SeriesEpisodeCard({ item, onClick }) {
  const { entry, episode, season, airingAt } = item;
  const time = new Date(airingAt);

  return (
    <button
      onClick={onClick}
      className="w-full flex gap-2.5 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
    >
      {entry.coverImage ? (
        <img src={entry.coverImage} alt="" className="w-12 h-[72px] object-cover rounded-lg flex-shrink-0" />
      ) : (
        <div className="w-12 h-[72px] rounded-lg bg-white/10 flex-shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-violet-100 leading-snug line-clamp-3">{entry.title}</p>
        <p className="font-mono text-[10px] text-violet-400 mt-1.5">
          {season != null ? `S${season} · ` : ""}Ép. {episode}
        </p>
        <p className="font-mono text-[10px] text-violet-500">
          {time.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </button>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export function CalendarSeries() {
  const navigate = useNavigate();
  const { entries } = useLibrary();
  const {
    VISIBLE_DAYS, dayOffset, gridKey, slideClass,
    canPrevDay, canNextDay, handlePrevDay, handleNextDay, jumpToDay,
    gridPointerHandlers,
  } = useWeekNavigation();

  const [nextAiringList, setNextAiringList] = useState([]);
  const [loading,        setLoading]        = useState(true);

  // Séries de la bibliothèque — même classification que l'onglet "Séries" de
  // la page d'accueil (type "serie", hors films).
  const seriesEntries = useMemo(
    () => entries.filter((e) => e.type === "serie" && e.category !== "movie"),
    [entries]
  );

  const load = async () => {
    setLoading(true);
    const results = await Promise.allSettled(
      seriesEntries.map(async (entry) => {
        const next = await fetchNextAiring(entry);
        return next?.airingAt ? { entry, ...next } : null;
      })
    );
    setNextAiringList(results.filter((r) => r.status === "fulfilled" && r.value).map((r) => r.value));
    setLoading(false);
  };

  useEffect(() => { load(); }, [seriesEntries.map((e) => e.id).join(",")]); // eslint-disable-line

  const weekMonday = useMemo(() => getMonday(), []);

  const byDay = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(weekMonday);
      day.setDate(weekMonday.getDate() + i);
      const dayStart = day.getTime();
      const dayEnd   = dayStart + 86400000;
      const dayEntries = nextAiringList
        .filter((x) => x.airingAt >= dayStart && x.airingAt < dayEnd)
        .sort((a, b) => a.airingAt - b.airingAt);
      return { date: day, entries: dayEntries };
    });
  }, [nextAiringList, weekMonday]);

  const visibleDays      = byDay.slice(dayOffset, dayOffset + VISIBLE_DAYS);
  const todayDateString  = useMemo(() => new Date().toDateString(), []);
  const totalVisible     = visibleDays.reduce((sum, d) => sum + d.entries.length, 0);

  const weekLabel = useMemo(() => {
    const end = new Date(weekMonday);
    end.setDate(weekMonday.getDate() + 6);
    const fmt = (d) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    return `${fmt(weekMonday)} – ${fmt(end)}`;
  }, [weekMonday]);

  return (
    <div className="min-h-screen bg-violet-950 text-violet-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      <PullToRefresh onRefresh={load}>
        <div className="max-w-5xl mx-auto px-3 sm:px-6 pb-nav pt-safe-8">

          {/* ── En-tête ── */}
          <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
            <div className="min-w-0">
              <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-200 active:scale-95 transition-all motion-reduce:transition-none mb-2">
                <ChevronLeft size={16} /> Retour
              </button>
              <p className="font-mono text-[11px] tracking-[0.3em] text-violet-400 uppercase mb-0.5">Prochains épisodes</p>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Calendrier</h1>
            </div>
            <TopBar />
          </div>

          <CalendarTabs />

          <p className="text-center text-xs sm:text-sm font-medium text-violet-400 mb-5">{weekLabel}</p>

          {seriesEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3 text-center px-6">
              <Tv size={28} className="text-violet-600" />
              <p className="text-sm text-violet-400 font-mono">Aucune série dans ta bibliothèque.</p>
              <p className="text-xs text-violet-600">Ajoute une série depuis la recherche pour voir ses prochains épisodes ici.</p>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3">
              <Loader2 size={28} className="animate-spin text-violet-400" />
              <p className="text-sm text-violet-400 font-mono">Chargement des prochains épisodes…</p>
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
                          dayEntries.map((item) => (
                            <SeriesEpisodeCard
                              key={item.entry.id}
                              item={item}
                              onClick={() => navigate(`/details/${item.entry.id}`)}
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
    </div>
  );
}
