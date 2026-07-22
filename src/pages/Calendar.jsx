import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, RefreshCw, Loader2,
  ChevronLeft, ChevronRight, X,
} from "lucide-react";
import { fetchWeeklySchedule, hasFrenchVersion, isReturningSeries } from "../api/anilist";
import { hasTMDB, searchTMDBShow, fetchTMDBEpisodeFR } from "../api/tmdb";
import { useLibrary } from "../context/LibraryContext";

// ── Constantes ────────────────────────────────────────────────────────────────
const DAY_NAMES    = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const VISIBLE_DAYS = 3;

function getSeasonLabel() {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();
  if (month <= 3) return `Hiver ${year}`;
  if (month <= 6) return `Printemps ${year}`;
  if (month <= 9) return `Été ${year}`;
  return `Automne ${year}`;
}

function todayIndex() {
  const dow = new Date().getDay();
  return dow === 0 ? 6 : dow - 1;
}

// ── Modal détail épisode ──────────────────────────────────────────────────────
function EpisodeDetailModal({ schedule, onClose }) {
  const [loading,      setLoading]      = useState(true);
  const [frTitle,      setFrTitle]      = useState(null);
  const [frSynopsis,   setFrSynopsis]   = useState(null);
  const [episodeName,  setEpisodeName]  = useState(null);

  const rawTitle       = schedule.media.title.english || schedule.media.title.romaji;
  const displayTitle   = frTitle    || rawTitle;
  const displaySynopsis = frSynopsis || schedule.media.description || null;
  const isFr           = hasFrenchVersion(schedule.media);
  const airingDate     = new Date(schedule.airingAt * 1000);
  const cover          = schedule.media.coverImage?.large || schedule.media.coverImage?.medium;

  // ── Fetch TMDB (FR) + Jikan (fallback nom épisode) en parallèle ──
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFrTitle(null);
    setFrSynopsis(null);
    setEpisodeName(null);

    async function load() {
      const title = schedule.media.title.english || schedule.media.title.romaji;

      // ── TMDB : titre FR + synopsis FR + nom d'épisode FR ──
      const tmdbTask = hasTMDB()
        ? searchTMDBShow(title)
            .then(async (tmdb) => {
              if (!tmdb) return { frTitle: null, frSynopsis: null, frEpName: null };
              const frEpName = tmdb.id
                ? await fetchTMDBEpisodeFR(tmdb.id, schedule.episode).catch(() => null)
                : null;
              return {
                frTitle:    tmdb.name     ?? null,
                frSynopsis: tmdb.overview ?? null,
                frEpName,
              };
            })
            .catch(() => ({ frTitle: null, frSynopsis: null, frEpName: null }))
        : Promise.resolve({ frTitle: null, frSynopsis: null, frEpName: null });

      // ── Jikan : nom d'épisode EN/romaji (fallback si TMDB n'a pas le nom FR) ──
      const jikanTask = schedule.media.idMal
        ? fetch(
            `https://api.jikan.moe/v4/anime/${schedule.media.idMal}/episodes/${schedule.episode}`
          )
            .then((r) => (r.ok ? r.json() : null))
            .then((json) => json?.data?.title ?? null)
            .catch(() => null)
        : Promise.resolve(null);

      const [tmdb, jikanEpName] = await Promise.all([tmdbTask, jikanTask]);
      if (cancelled) return;

      if (tmdb.frTitle)    setFrTitle(tmdb.frTitle);
      if (tmdb.frSynopsis) setFrSynopsis(tmdb.frSynopsis);
      // Priorité : nom FR TMDB > nom EN Jikan
      setEpisodeName(tmdb.frEpName || jikanEpName || null);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [schedule.media.id, schedule.episode]);

  // Fermeture sur Échap
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-sm w-full bg-violet-900 rounded-2xl border border-white/10 overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Bannière cover ── */}
        {cover && (
          <div className="relative h-44 overflow-hidden bg-violet-950">
            <img
              src={cover}
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-30 scale-110"
              style={{ filter: "blur(16px)" }}
              aria-hidden
            />
            <img
              src={cover}
              alt={displayTitle}
              className="relative mx-auto h-full w-auto object-contain drop-shadow-xl"
            />
          </div>
        )}

        {/* ── Bouton fermer ── */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white/70 hover:text-white transition-colors motion-reduce:transition-none"
          aria-label="Fermer"
        >
          <X size={15} />
        </button>

        {/* ── Contenu ── */}
        <div className="p-4 space-y-3">

          {/* Titre + badges */}
          <div>
            <div className="flex items-start gap-2">
              <h2 className="flex-1 text-sm font-bold text-violet-100 leading-snug">
                {displayTitle}
              </h2>
              {/* Indicateur de chargement discret à côté du titre */}
              {loading && hasTMDB() && (
                <Loader2
                  size={12}
                  className="flex-shrink-0 mt-0.5 text-violet-500 animate-spin"
                  aria-label="Chargement des infos en français…"
                />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="font-mono text-[11px] text-amber-400 font-semibold">
                Épisode {schedule.episode}
              </span>
              {!loading && episodeName && (
                <span className="font-mono text-[11px] text-violet-300 truncate max-w-[160px]">
                  — {episodeName}
                </span>
              )}
              {loading && (
                <span className="h-2 w-24 rounded bg-white/10 animate-pulse" />
              )}
              {isFr && (
                <span className="font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/20">
                  VF dispo
                </span>
              )}
            </div>
          </div>

          {/* Synopsis */}
          {loading ? (
            // Skeleton pendant le fetch
            <div className="space-y-1.5 pt-0.5">
              <div className="h-2 rounded bg-white/10 animate-pulse w-full"  />
              <div className="h-2 rounded bg-white/10 animate-pulse w-11/12" />
              <div className="h-2 rounded bg-white/10 animate-pulse w-4/5"   />
              <div className="h-2 rounded bg-white/10 animate-pulse w-3/5"   />
            </div>
          ) : displaySynopsis ? (
            <p className="text-xs text-violet-300 leading-relaxed line-clamp-6">
              {displaySynopsis}
            </p>
          ) : (
            <p className="text-xs text-violet-500 font-mono italic">
              Aucun synopsis disponible.
            </p>
          )}

          {/* Horaire */}
          <p className="font-mono text-[10px] text-violet-500 pt-1 border-t border-white/5">
            {airingDate.toLocaleDateString("fr-FR", {
              weekday: "long", day: "numeric", month: "long",
            })}
            {" · "}
            {airingDate.toLocaleTimeString("fr-FR", {
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Carte épisode ─────────────────────────────────────────────────────────────
function EpisodeCard({ schedule, showVfBadge, onClick }) {
  const time  = new Date(schedule.airingAt * 1000);
  const title = schedule.media.title.english || schedule.media.title.romaji;
  const isFr  = hasFrenchVersion(schedule.media);

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex gap-2.5 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
    >
      {schedule.media.coverImage?.medium ? (
        <img
          src={schedule.media.coverImage.medium}
          alt=""
          className="w-12 h-[72px] object-cover rounded-lg flex-shrink-0"
        />
      ) : (
        <div className="w-12 h-[72px] rounded-lg bg-white/10 flex-shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-violet-100 leading-snug line-clamp-3">{title}</p>
        <p className="font-mono text-[10px] text-violet-400 mt-1.5">Ép. {schedule.episode}</p>
        <p className="font-mono text-[10px] text-violet-500">
          {time.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </p>
        {showVfBadge && isFr && (
          <span className="inline-block mt-1 font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/20">
            VF
          </span>
        )}
      </div>
    </button>
  );
}

// ── Bouton filtre ─────────────────────────────────────────────────────────────
function FilterBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors motion-reduce:transition-none whitespace-nowrap ${
        active
          ? "bg-amber-400 text-violet-950 border-amber-400"
          : "bg-white/5 border-white/10 text-violet-300 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export function Calendar() {
  const navigate = useNavigate();
  const { entries: libraryEntries } = useLibrary();

  const [schedules,        setSchedules]        = useState([]);
  const [weekMonday,       setWeekMonday]        = useState(null);
  const [loading,          setLoading]           = useState(true);
  const [refreshing,       setRefreshing]        = useState(false);
  const [error,            setError]             = useState("");
  const [weekOffset,       setWeekOffset]        = useState(0);
  const [selectedSchedule, setSelectedSchedule]  = useState(null);

  const [contentFilter, setContentFilter] = useState("all");
  const [langFilter,    setLangFilter]    = useState("all");

  const [dayOffset, setDayOffset] = useState(() =>
    Math.max(0, Math.min(7 - VISIBLE_DAYS, todayIndex() - 1))
  );

  const libraryAnilistIds = useMemo(
    () => new Set(libraryEntries.flatMap((e) => e.anilistIds || []).map(String)),
    [libraryEntries]
  );

  const load = useCallback(async (offset, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else           setLoading(true);
    setError("");
    try {
      const { schedules: data, monday } = await fetchWeeklySchedule(offset);
      setSchedules(data);
      setWeekMonday(monday);
    } catch {
      setError("Impossible de charger le calendrier. Vérifie ta connexion et réessaie.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(weekOffset); }, [weekOffset]);

  function prevWeek() { setWeekOffset((w) => w - 1); setDayOffset(0); }
  function nextWeek() { setWeekOffset((w) => w + 1); setDayOffset(0); }
  function thisWeek() { setWeekOffset(0); setDayOffset(Math.max(0, Math.min(4, todayIndex() - 1))); }

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

      const entries = schedules.filter((s) => {
        if (s.airingAt < dayStart || s.airingAt >= dayEnd) return false;
        if (langFilter    === "vf"        && !hasFrenchVersion(s.media)) return false;
        if (contentFilter === "mylibrary") return libraryAnilistIds.has(String(s.media.id));
        if (contentFilter === "new")       return !isReturningSeries(s.media);
        if (contentFilter === "returning") return  isReturningSeries(s.media);
        return true;
      });

      return { date: day, entries };
    });
  }, [schedules, weekMonday, langFilter, contentFilter, libraryAnilistIds]);

  const visibleDays = byDay.slice(dayOffset, dayOffset + VISIBLE_DAYS);
  const canPrevDay  = dayOffset > 0;
  const canNextDay  = dayOffset + VISIBLE_DAYS < 7;

  const todayMidnight = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
  }, []);

  const totalVisible = visibleDays.reduce((sum, d) => sum + d.entries.length, 0);

  return (
    <div className="min-h-screen bg-violet-950 text-violet-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* ── En-tête ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-200 transition-colors motion-reduce:transition-none mb-3"
            >
              <ChevronLeft size={16} /> Retour
            </button>
            <p className="font-mono text-[11px] tracking-[0.3em] text-violet-400 uppercase mb-1">
              {getSeasonLabel()}
            </p>
            <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Calendrier
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={prevWeek} className="p-2 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 transition-colors motion-reduce:transition-none" aria-label="Semaine précédente">
              <ArrowLeft size={15} className="text-violet-400" />
            </button>
            <div className="text-center min-w-[150px]">
              <p className="text-sm font-medium text-violet-100">{weekLabel}</p>
              {weekOffset !== 0 && (
                <button onClick={thisWeek} className="text-[10px] font-mono text-amber-400 hover:text-amber-300 transition-colors motion-reduce:transition-none">
                  Cette semaine
                </button>
              )}
            </div>
            <button onClick={nextWeek} className="p-2 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 transition-colors motion-reduce:transition-none" aria-label="Semaine suivante">
              <ArrowRight size={15} className="text-violet-400" />
            </button>
            <button
              onClick={() => load(weekOffset, true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 disabled:opacity-50 text-sm text-violet-300 transition-colors motion-reduce:transition-none"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin motion-reduce:animate-none" : ""} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
          </div>
        </div>

        {/* ── Barre de filtres unifiée ── */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <FilterBtn active={contentFilter === "all"}       onClick={() => setContentFilter("all")}>Tout</FilterBtn>
          <FilterBtn active={contentFilter === "mylibrary"} onClick={() => setContentFilter("mylibrary")}>Ma liste</FilterBtn>
          <FilterBtn active={contentFilter === "new"}       onClick={() => setContentFilter("new")}>Nouvelles séries</FilterBtn>
          <FilterBtn active={contentFilter === "returning"} onClick={() => setContentFilter("returning")}>Séries qui reprennent</FilterBtn>

          <span className="w-px h-5 bg-white/20 mx-1 rounded-full" aria-hidden />

          <FilterBtn active={langFilter === "all"} onClick={() => setLangFilter("all")}>VO</FilterBtn>
          <FilterBtn active={langFilter === "vf"}  onClick={() => setLangFilter("vf")}>VF</FilterBtn>
        </div>

        {/* ── Erreur ── */}
        {error && (
          <div className="mb-6 text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* ── Note VF ── */}
        {langFilter === "vf" && !loading && (
          <p className="text-[11px] text-violet-500 font-mono mb-4">
            ℹ Les horaires sont ceux de la diffusion VO. La VF/VOSTFR est disponible sur ADN, Wakanim ou Crunchyroll FR peu après.
          </p>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 size={28} className="animate-spin text-violet-400" />
            <p className="text-sm text-violet-400 font-mono">Chargement du calendrier…</p>
          </div>
        ) : (
          <>
            {/* ── Navigation jours ── */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setDayOffset((d) => Math.max(0, d - 1))}
                disabled={!canPrevDay}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 disabled:opacity-30 disabled:cursor-not-allowed text-sm text-violet-300 transition-colors motion-reduce:transition-none"
              >
                <ChevronLeft size={15} />
                <span className="hidden sm:inline text-xs">Préc.</span>
              </button>

              <p className="font-mono text-[11px] text-violet-500">
                {totalVisible} épisode{totalVisible !== 1 ? "s" : ""} affichés
              </p>

              <button
                onClick={() => setDayOffset((d) => Math.min(7 - VISIBLE_DAYS, d + 1))}
                disabled={!canNextDay}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 disabled:opacity-30 disabled:cursor-not-allowed text-sm text-violet-300 transition-colors motion-reduce:transition-none"
              >
                <span className="hidden sm:inline text-xs">Suiv.</span>
                <ChevronRight size={15} />
              </button>
            </div>

            {/* ── Grille 3 colonnes ── */}
            <div className="grid grid-cols-3 gap-4">
              {visibleDays.map(({ date, entries }, i) => {
                const isToday   = date.getTime() === todayMidnight;
                const globalIdx = dayOffset + i;

                return (
                  <div
                    key={globalIdx}
                    className={`rounded-2xl border overflow-hidden flex flex-col ${
                      isToday ? "border-amber-400/40 bg-amber-400/5" : "border-white/5 bg-violet-900/20"
                    }`}
                  >
                    <div className={`px-4 py-3 border-b ${isToday ? "border-amber-400/20" : "border-white/5"}`}>
                      <div className="flex items-center justify-between">
                        <p className={`font-mono text-xs uppercase tracking-widest font-semibold ${isToday ? "text-amber-400" : "text-violet-300"}`}>
                          {DAY_NAMES[globalIdx]}
                        </p>
                        {isToday && (
                          <span className="font-mono text-[8px] bg-amber-400 text-violet-950 px-1.5 py-0.5 rounded-full font-bold">
                            Aujourd'hui
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-violet-500 mt-0.5">
                        {date.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
                      </p>
                    </div>

                    <div className="p-3 flex-1 space-y-2 overflow-y-auto max-h-[70vh]">
                      {entries.length === 0 ? (
                        <p className="text-[11px] text-violet-600 font-mono text-center py-8">Aucun épisode</p>
                      ) : (
                        entries.map((s) => (
                          <EpisodeCard
                            key={s.id}
                            schedule={s}
                            showVfBadge={langFilter === "all"}
                            onClick={() => setSelectedSchedule(s)}
                          />
                        ))
                      )}
                    </div>

                    {entries.length > 0 && (
                      <div className="px-4 py-2 border-t border-white/5">
                        <p className="font-mono text-[10px] text-violet-500">
                          {entries.length} épisode{entries.length > 1 ? "s" : ""}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Indicateur position dans la semaine ── */}
            <div className="flex justify-center gap-1.5 mt-4">
              {Array.from({ length: 7 - VISIBLE_DAYS + 1 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setDayOffset(i)}
                  className={`w-2 h-2 rounded-full transition-colors motion-reduce:transition-none ${
                    dayOffset === i ? "bg-amber-400" : "bg-white/20 hover:bg-white/40"
                  }`}
                  aria-label={`Voir à partir de ${DAY_NAMES[i]}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Modal détail épisode ── */}
      {selectedSchedule && (
        <EpisodeDetailModal
          schedule={selectedSchedule}
          onClose={() => setSelectedSchedule(null)}
        />
      )}
    </div>
  );
}