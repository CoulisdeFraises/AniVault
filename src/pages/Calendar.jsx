// src/pages/Calendar.jsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2,
  ChevronLeft, ChevronRight, X, Plus, Check, Sparkles,
} from "lucide-react";
import { fetchWeeklySchedule, isReturningSeries } from "../api/anilist";
import { hasTMDB, searchTMDBShow, fetchTMDBEpisodeFR } from "../api/tmdb";
import { useLibrary }  from "../context/LibraryContext";
import { importResult } from "../api";
import { TopBar }    from "../components/common/TopBar";
import { Modal }         from "../components/Modal/Modal";
import { AnimatePresence } from "motion/react";
import { PullToRefresh } from "../components/common/PullToRefresh";
import { CalendarTabs }  from "../components/common/CalendarTabs";
import { useWeekNavigation, DAY_NAMES } from "../hooks/useWeekNavigation";
import { getCached, getStaleCached, setCached, TTL } from "../lib/cache";

const TMDB_CHUNK           = 5;

function getSeasonLabel() {
  const now = new Date(), month = now.getMonth() + 1, year = now.getFullYear();
  if (month <= 3) return `Hiver ${year}`;
  if (month <= 6) return `Printemps ${year}`;
  if (month <= 9) return `Été ${year}`;
  return `Automne ${year}`;
}

function toDate(value) {
  if (value instanceof Date) return value;
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date() : d;
}

function stripHtml(html) {
  return html?.replace(/<[^>]*>/g, "") ?? "";
}

// ── Modal détail épisode ──────────────────────────────────────────────────────
function EpisodeDetailModal({ schedule, initialFrTitle, onClose }) {
  const [loading,     setLoading]     = useState(true);
  const [frTitle,     setFrTitle]     = useState(initialFrTitle ?? null);
  const [frSynopsis,  setFrSynopsis]  = useState(null);
  const [episodeName, setEpisodeName] = useState(null);

  const rawTitle        = schedule.media.title.english || schedule.media.title.romaji;
  const displayTitle    = frTitle    || rawTitle;
  const displaySynopsis = frSynopsis || stripHtml(schedule.media.description) || null;
  const airingDate      = new Date(schedule.airingAt * 1000);
  const cover           = schedule.media.coverImage?.large || schedule.media.coverImage?.medium;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    if (!initialFrTitle) setFrTitle(null);
    setFrSynopsis(null);
    setEpisodeName(null);

    async function load() {
      const title = schedule.media.title.english || schedule.media.title.romaji;
      const tmdbTask = hasTMDB()
        ? searchTMDBShow(title)
            .then(async (tmdb) => {
              if (!tmdb) return { frTitle: null, frSynopsis: null, frEpName: null };
              const frEpName = tmdb.id ? await fetchTMDBEpisodeFR(tmdb.id, schedule.episode).catch(() => null) : null;
              return { frTitle: tmdb.name ?? null, frSynopsis: tmdb.overview ?? null, frEpName };
            })
            .catch(() => ({ frTitle: null, frSynopsis: null, frEpName: null }))
        : Promise.resolve({ frTitle: null, frSynopsis: null, frEpName: null });

      const jikanTask = schedule.media.idMal
        ? fetch(`https://api.jikan.moe/v4/anime/${schedule.media.idMal}/episodes/${schedule.episode}`)
            .then((r) => (r.ok ? r.json() : null)).then((j) => j?.data?.title ?? null).catch(() => null)
        : Promise.resolve(null);

      const [tmdb, jikanEpName] = await Promise.all([tmdbTask, jikanTask]);
      if (cancelled) return;
      if (tmdb.frTitle)    setFrTitle(tmdb.frTitle);
      if (tmdb.frSynopsis) setFrSynopsis(tmdb.frSynopsis);
      setEpisodeName(tmdb.frEpName || jikanEpName || null);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [schedule.media.id, schedule.episode]);

  return (
    <Modal onClose={onClose} maxWidth="max-w-sm" zIndex="z-50">
      <div className="relative flex flex-col max-h-[90vh]">
        {cover && (
          <div className="relative h-44 flex-shrink-0 overflow-hidden bg-violet-950">
            <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 scale-110" style={{ filter: "blur(16px)" }} aria-hidden />
            <img src={cover} alt={displayTitle} className="relative mx-auto h-full w-auto object-contain drop-shadow-xl" />
          </div>
        )}
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white/70 hover:text-white active:scale-95 transition-all motion-reduce:transition-none z-10" aria-label="Fermer">
          <X size={15} />
        </button>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <div className="flex items-start gap-2">
              <h2 className="flex-1 text-sm font-bold text-violet-100 leading-snug">{displayTitle}</h2>
              {loading && hasTMDB() && <Loader2 size={12} className="flex-shrink-0 mt-0.5 text-violet-500 animate-spin" />}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="font-mono text-[11px] text-amber-400 font-semibold">Épisode {schedule.episode}</span>
              {!loading && episodeName && <span className="font-mono text-[11px] text-violet-300 truncate max-w-[160px]">— {episodeName}</span>}
              {loading && <span className="h-2 w-24 rounded bg-white/10 animate-pulse" />}
            </div>
          </div>
          {loading ? (
            <div className="space-y-1.5 pt-0.5">
              {[1, 0.917, 0.833, 0.625].map((w, i) => (
                <div key={i} className="h-2 rounded shimmer" style={{ width: `${w * 100}%` }} />
              ))}
            </div>
          ) : displaySynopsis ? (
            <p className="text-xs text-violet-300 leading-relaxed">{displaySynopsis}</p>
          ) : (
            <p className="text-xs text-violet-500 font-mono italic">Aucun synopsis disponible.</p>
          )}
          <p className="font-mono text-[10px] text-violet-500 pt-1 border-t border-white/5">
            {airingDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
            {" · "}
            {airingDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
    </Modal>
  );
}

// ── Carte épisode ─────────────────────────────────────────────────────────────
// Restructurée en <div> pour accueillir le bouton Ajouter sans imbriquer des <button>
function EpisodeCard({ schedule, onClick, frTitle, isLoadingTitle, isInLibrary, onAdd, isAdding }) {
  const time  = new Date(schedule.airingAt * 1000);
  const title = frTitle || schedule.media.title.english || schedule.media.title.romaji;

  return (
    <div className="w-full flex gap-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors overflow-hidden">

      {/* Zone cliquable principale → ouvre le modal détail */}
      <button
        onClick={onClick}
        className="flex gap-2.5 flex-1 min-w-0 p-2.5 text-left active:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 rounded-xl"
      >
        {schedule.media.coverImage?.medium ? (
          <img src={schedule.media.coverImage.medium} alt="" className="w-12 h-[72px] object-cover rounded-lg flex-shrink-0" />
        ) : (
          <div className="w-12 h-[72px] rounded-lg bg-white/10 flex-shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-medium text-violet-100 leading-snug line-clamp-3 transition-opacity duration-300 ${isLoadingTitle ? "opacity-60" : "opacity-100"}`}>
            {title}
          </p>
          {isLoadingTitle && <div className="h-0.5 w-2/3 mt-1 rounded-full shimmer" />}
          <p className="font-mono text-[10px] text-violet-400 mt-1.5">Ép. {schedule.episode}</p>
          <p className="font-mono text-[10px] text-violet-500">
            {time.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </button>

      {/* Bouton Ajouter / badge "Dans ma liste" */}
      <div className="flex-shrink-0 flex items-center pr-2.5">
        {isInLibrary ? (
          // Déjà dans la bibliothèque → badge non cliquable
          <div
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-teal-500/15 text-teal-400"
            title="Déjà dans ta liste"
          >
            <Check size={12} strokeWidth={2.5} />
            <span className="font-mono text-[9px] uppercase tracking-wide hidden sm:inline">Ma liste</span>
          </div>
        ) : (
          // Pas encore ajouté → bouton d'ajout
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            disabled={isAdding}
            aria-label={`Ajouter ${title} à ma liste`}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-400/15 border border-amber-400/25 text-amber-400 hover:bg-amber-400/25 active:scale-95 transition-all motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAdding
              ? <Loader2 size={12} className="animate-spin" />
              : <Plus    size={12} strokeWidth={2.5} />
            }
            <span className="font-mono text-[9px] uppercase tracking-wide hidden sm:inline">
              {isAdding ? "Ajout…" : "Ajouter"}
            </span>
          </button>
        )}
      </div>

    </div>
  );
}

// Onglet d'une barre de filtres segmentée (groupe unique, largeur partagée à parts égales)
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
export function Calendar() {
  const navigate = useNavigate();
  const { entries: libraryEntries, saveEntry } = useLibrary();
  const {
    VISIBLE_DAYS, dayOffset, gridKey, slideClass,
    canPrevDay, canNextDay, handlePrevDay, handleNextDay, jumpToDay,
    gridPointerHandlers,
  } = useWeekNavigation();

  const [schedules,        setSchedules]        = useState([]);
  const [weekMonday,       setWeekMonday]        = useState(null);
  const [loading,          setLoading]           = useState(true);
  const [refreshing,       setRefreshing]        = useState(false);
  const [error,            setError]             = useState("");
  // Le calendrier n'affiche plus que la semaine en cours (la navigation
  // semaine précédente/suivante a été retirée, jugée inutile).
  const weekOffset = 0;
  const [selectedSchedule, setSelectedSchedule]  = useState(null);
  const [tmdbTitles,       setTmdbTitles]        = useState({});
  const [contentFilter,    setContentFilter]     = useState("all");

  // IDs en cours d'ajout (Set de media.id AniList)
  const [addingIds, setAddingIds] = useState(new Set());

  // IDs AniList déjà présents dans la bibliothèque
  const libraryAnilistIds = useMemo(
    () => new Set(libraryEntries.flatMap((e) => e.anilistIds || []).map(String)),
    [libraryEntries]
  );

  // ── Chargement semaine ────────────────────────────────────────────────────
  const load = useCallback(async (offset, isRefresh = false) => {
    const cacheKey = `calendar_week_${offset}`;

    if (!isRefresh) {
      const cached = getCached(cacheKey);
      if (cached) {
        setSchedules(cached.schedules);
        setWeekMonday(toDate(cached.monday));
        setLoading(false);
        return;
      }
    }

    if (isRefresh) setRefreshing(true);
    else           setLoading(true);
    setError("");

    try {
      const { schedules: data, monday } = await fetchWeeklySchedule(offset, { force: isRefresh });
      setCached(cacheKey, { schedules: data, monday }, TTL.CALENDAR);
      setSchedules(data);
      setWeekMonday(toDate(monday));
    } catch (err) {
      const stale = getStaleCached(cacheKey);
      if (stale) {
        setSchedules(stale.schedules);
        setWeekMonday(toDate(stale.monday));
        setError(err?.message ? `⚠️ ${err.message} — données précédentes affichées.` : "⚠️ Connexion indisponible — données hors-ligne affichées.");
      } else {
        setError(err?.message || "Impossible de charger le calendrier. Vérifie ta connexion et réessaie.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(weekOffset); }, [weekOffset]);

  // ── Pre-fetch TMDB (titres FR uniquement) ──────────────────────────────────
  // NB : la détection "VF disponible" a été retirée — aucune source de données
  // gratuite/fiable ne permet de distinguer VF et VOSTFR (ni AniList, ni les
  // watch/providers TMDB, qui n'indiquent que la dispo régionale, pas la
  // langue du doublage). Ce fetch ne sert donc plus qu'à récupérer les titres
  // français des séries pour l'affichage.
  useEffect(() => {
    if (!hasTMDB() || schedules.length === 0) { setTmdbTitles({}); return; }
    let cancelled = false;
    const uniqueMedia = [...new Map(schedules.map((s) => [s.media.id, s.media])).values()];

    async function fetchTmdbData() {
      for (let i = 0; i < uniqueMedia.length; i += TMDB_CHUNK) {
        if (cancelled) return;
        const chunk = uniqueMedia.slice(i, i + TMDB_CHUNK);
        const results = await Promise.allSettled(
          chunk.map(async (media) => {
            const tmdb = await searchTMDBShow(media.title.english || media.title.romaji);
            return { id: media.id, name: tmdb?.name ?? null };
          })
        );
        if (cancelled) return;
        const pt = {};
        results.forEach((r) => {
          if (r.status !== "fulfilled") return;
          if (r.value.name) pt[r.value.id] = r.value.name;
        });
        if (Object.keys(pt).length) setTmdbTitles((p) => ({ ...p, ...pt }));
      }
    }

    setTmdbTitles({});
    fetchTmdbData();
    return () => { cancelled = true; };
  }, [schedules]);

  const handleAddToLibrary = useCallback(async (schedule) => {
    const mediaId = schedule.media.id;
    if (addingIds.has(mediaId)) return;

    setAddingIds((prev) => new Set([...prev, mediaId]));
    try {
      const searchResult = {
        id:       mediaId,
        source:   "anilist",
        title:    schedule.media.title.english || schedule.media.title.romaji,
        genres:   schedule.media.genres || [],
        image:    schedule.media.coverImage?.large || schedule.media.coverImage?.medium || null,
        episodes: schedule.media.episodes ?? null,
        format:   schedule.media.format ?? null,
      };

      const imported = await importResult(searchResult);
      saveEntry(
        { ...imported, type: "anime", status: "a-voir", rating: 0 },
        null // null = création, pas édition
      );
    } catch (err) {
      console.error("Erreur lors de l'ajout à la bibliothèque :", err);
    } finally {
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.delete(mediaId);
        return next;
      });
    }
  }, [addingIds, saveEntry]);

  // ── Calculs dérivés ───────────────────────────────────────────────────────
  const weekLabel = useMemo(() => {
    if (!weekMonday) return "";
    const end = new Date(weekMonday);
    end.setDate(weekMonday.getDate() + 6);
    const fmt = (d) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    return `${fmt(weekMonday)} – ${fmt(end)}`;
  }, [weekMonday]);

  const byDay = useMemo(() => {
    if (!weekMonday) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const day      = new Date(weekMonday);
      day.setDate(weekMonday.getDate() + i);
      const dayStart = Math.floor(day.getTime() / 1000);
      const dayEnd   = dayStart + 86400;
      const entries  = schedules.filter((s) => {
        if (s.airingAt < dayStart || s.airingAt >= dayEnd) return false;
        if (contentFilter === "mylibrary") return libraryAnilistIds.has(String(s.media.id));
        if (contentFilter === "new")       return !isReturningSeries(s.media);
        if (contentFilter === "returning") return  isReturningSeries(s.media);
        return true;
      });
      return { date: day, entries };
    });
  }, [schedules, weekMonday, contentFilter, libraryAnilistIds]);

  const visibleDays   = byDay.slice(dayOffset, dayOffset + VISIBLE_DAYS);
  const todayDateString = useMemo(() => new Date().toDateString(), []);
  const totalVisible  = visibleDays.reduce((sum, d) => sum + d.entries.length, 0);

  return (
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-violet-950 text-violet-50" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Zone fixe : en-tête, onglets, filtres, navigation jours ── */}
      <div className="flex-shrink-0 max-w-5xl w-full mx-auto px-3 sm:px-6 pt-safe-8">

        {/* ── En-tête ── */}
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div className="min-w-0">
            <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-200 active:scale-95 transition-all motion-reduce:transition-none mb-2">
              <ChevronLeft size={16} /> Retour
            </button>
            <p className="font-mono text-[11px] tracking-[0.3em] text-violet-400 uppercase mb-0.5">{getSeasonLabel()}</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Calendrier</h1>
          </div>

          <TopBar />
        </div>

        <CalendarTabs />

        {/* ── Bascule Saison en cours / Saison prochaine ── */}
        {/* Remplace l'ancienne navigation semaine par semaine (retirée, peu
            utile) et le bouton d'actualisation manuel (redondant avec le
            tire-pour-actualiser déjà disponible sur toute la page). */}
        <div className="flex justify-center mb-1">
          <div className="inline-flex w-full max-w-sm items-center gap-1 rounded-full bg-white/5 border border-white/10 p-0.5">
            <button
              aria-current="page"
              className="flex-1 min-w-0 px-2 py-1.5 rounded-full text-[11px] font-medium bg-amber-400 text-violet-950 whitespace-nowrap"
            >
              Saison en cours
            </button>
            <button
              onClick={() => navigate("/calendar/next-season")}
              className="flex-1 min-w-0 flex items-center justify-center gap-1 px-2 py-1.5 rounded-full text-[11px] font-medium text-violet-300 hover:bg-white/10 active:scale-95 transition-all motion-reduce:transition-none whitespace-nowrap"
            >
              <Sparkles size={11} />
              Saison prochaine
            </button>
          </div>
        </div>
        <p className="text-center text-xs sm:text-sm font-medium text-violet-400 mb-2">{weekLabel}</p>

        {/* ── Filtres — barre segmentée centrée ── */}
        <div className="flex justify-center mb-3">
          <div className="inline-flex w-full max-w-md items-center gap-1 rounded-full bg-white/5 border border-white/10 p-1">
            <FilterTab active={contentFilter === "all"}       onClick={() => setContentFilter("all")}>Tout</FilterTab>
            <FilterTab active={contentFilter === "mylibrary"} onClick={() => setContentFilter("mylibrary")}>Ma liste</FilterTab>
            <FilterTab active={contentFilter === "new"}       onClick={() => setContentFilter("new")}>Nouvelles</FilterTab>
            <FilterTab active={contentFilter === "returning"} onClick={() => setContentFilter("returning")}>Reprises</FilterTab>
          </div>
        </div>

        {error && (
          <div className="mb-3 text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">{error}</div>
        )}

        {/* ── Navigation jours ── */}
        {!loading && (
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
              {/* Indicateur de position : petits points représentant les 7 jours */}
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
        )}
      </div>

      {/* ── Zone scrollable : seule cette zone défile, contenue entre l'en-tête
          et le bottom nav (pb-nav) — plus de scroll de toute la page. ── */}
      <PullToRefresh onRefresh={() => load(weekOffset, true)} className="flex-1 min-h-0 flex flex-col">
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-auto max-w-5xl w-full mx-auto px-3 sm:px-6 pb-nav">

          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3">
              <Loader2 size={28} className="animate-spin text-violet-400" />
              <p className="text-sm text-violet-400 font-mono">Chargement du calendrier…</p>
            </div>
          ) : (
            /* ── Grille jours — écoute les swipes horizontaux ── */
            <div
              key={gridKey}
              {...gridPointerHandlers}
              style={{ touchAction: "pan-y" }} // scroll vertical libre, swipe horizontal capturé
              className={`grid gap-3 motion-reduce:animate-none ${slideClass} ${
                VISIBLE_DAYS === 1 ? "grid-cols-1" : "grid-cols-3"
              }`}
            >
              {visibleDays.map(({ date, entries }, i) => {
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

                    <div className="p-2.5 sm:p-3 flex-1 space-y-2">
                      {entries.length === 0 ? (
                        <p className="text-[11px] text-violet-600 font-mono text-center py-8">Aucun épisode</p>
                      ) : (
                        entries.map((s) => (
                          <EpisodeCard
                            key={s.id}
                            schedule={s}
                            onClick={() => setSelectedSchedule(s)}
                            frTitle={tmdbTitles[s.media.id] ?? null}
                            isLoadingTitle={hasTMDB() && !tmdbTitles[s.media.id]}
                            isInLibrary={libraryAnilistIds.has(String(s.media.id))}
                            onAdd={() => handleAddToLibrary(s)}
                            isAdding={addingIds.has(s.media.id)}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </PullToRefresh>

      {/* ── Modal détail épisode ── */}
      <AnimatePresence>
        {selectedSchedule && (
          <EpisodeDetailModal
            key="episode-detail"
            schedule={selectedSchedule}
            initialFrTitle={tmdbTitles[selectedSchedule.media.id] ?? null}
            onClose={() => setSelectedSchedule(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}