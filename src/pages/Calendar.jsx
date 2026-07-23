import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, RefreshCw, Loader2,
  ChevronLeft, ChevronRight, X,
} from "lucide-react";
import { fetchWeeklySchedule, hasFrenchVersion, isReturningSeries } from "../api/anilist";
import { hasTMDB, searchTMDBShow, fetchTMDBEpisodeFR, fetchTMDBWatchProvidersFR } from "../api/tmdb";
import { useLibrary } from "../context/LibraryContext";
import { BurgerMenu } from "../components/common/BurgerMenu";

const DAY_NAMES    = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const VISIBLE_DAYS = 3;
const TMDB_CHUNK   = 5;

function getSeasonLabel() {
  const now = new Date(), month = now.getMonth() + 1, year = now.getFullYear();
  if (month <= 3) return `Hiver ${year}`;
  if (month <= 6) return `Printemps ${year}`;
  if (month <= 9) return `Été ${year}`;
  return `Automne ${year}`;
}
function todayIndex() { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; }

// ── Modal détail épisode ──────────────────────────────────────────────────────
function EpisodeDetailModal({ schedule, initialFrTitle, hasFrFromTmdb, onClose }) {
  const [loading,     setLoading]     = useState(true);
  const [frTitle,     setFrTitle]     = useState(initialFrTitle ?? null);
  const [frSynopsis,  setFrSynopsis]  = useState(null);
  const [episodeName, setEpisodeName] = useState(null);

  const rawTitle        = schedule.media.title.english || schedule.media.title.romaji;
  const displayTitle    = frTitle    || rawTitle;
  const displaySynopsis = frSynopsis || schedule.media.description || null;
  const isFr            = hasFrFromTmdb || hasFrenchVersion(schedule.media);
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

  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-w-sm w-full bg-violet-900 rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-fadeInUp motion-reduce:animate-none" onClick={(e) => e.stopPropagation()}>
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
              {isFr && <span className="font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/20">VF dispo</span>}
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
    </div>
  );
}

// ── Carte épisode ─────────────────────────────────────────────────────────────
function EpisodeCard({ schedule, showVfBadge, onClick, frTitle, isFrench, isLoadingTitle }) {
  const time  = new Date(schedule.airingAt * 1000);
  const title = frTitle || schedule.media.title.english || schedule.media.title.romaji;

  return (
    <button
      onClick={onClick}
      className="w-full text-left flex gap-2.5 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 active:scale-[0.98] transition-all motion-reduce:transition-none cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
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
        {/* Shimmer discret pendant le pre-fetch du titre FR */}
        {isLoadingTitle && (
          <div className="h-0.5 w-2/3 mt-1 rounded-full shimmer" />
        )}
        <p className="font-mono text-[10px] text-violet-400 mt-1.5">Ép. {schedule.episode}</p>
        <p className="font-mono text-[10px] text-violet-500">
          {time.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </p>
        {showVfBadge && isFrench && (
          <span className="inline-block mt-1 font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/20">VF</span>
        )}
      </div>
    </button>
  );
}

function FilterBtn({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all active:scale-95 motion-reduce:transition-none whitespace-nowrap ${
        active ? "bg-amber-400 text-violet-950 border-amber-400" : "bg-white/5 border-white/10 text-violet-300 hover:bg-white/10"
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
  const [tmdbTitles,       setTmdbTitles]        = useState({});
  const [tmdbFrAvailable,  setTmdbFrAvailable]   = useState({});
  const [contentFilter,    setContentFilter]     = useState("all");
  const [langFilter,       setLangFilter]        = useState("all");

  // ── Slide directionnel pour les animations de grille ──
  const [gridKey,   setGridKey]   = useState(0);
  const [slideDir,  setSlideDir]  = useState("none");

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

  // ── Pre-fetch TMDB (titres FR + disponibilité FR) ──
  useEffect(() => {
    if (!hasTMDB() || schedules.length === 0) { setTmdbTitles({}); setTmdbFrAvailable({}); return; }
    let cancelled = false;
    const uniqueMedia = [...new Map(schedules.map((s) => [s.media.id, s.media])).values()];

    async function fetchTmdbData() {
      for (let i = 0; i < uniqueMedia.length; i += TMDB_CHUNK) {
        if (cancelled) return;
        const chunk = uniqueMedia.slice(i, i + TMDB_CHUNK);
        const results = await Promise.allSettled(
          chunk.map(async (media) => {
            const tmdb  = await searchTMDBShow(media.title.english || media.title.romaji);
            const hasFR = tmdb?.id ? await fetchTMDBWatchProvidersFR(tmdb.id).catch(() => false) : false;
            return { id: media.id, name: tmdb?.name ?? null, hasFR };
          })
        );
        if (cancelled) return;
        const pt = {}, pf = {};
        results.forEach((r) => {
          if (r.status !== "fulfilled") return;
          if (r.value.name)  pt[r.value.id] = r.value.name;
          if (r.value.hasFR) pf[r.value.id] = true;
        });
        if (Object.keys(pt).length) setTmdbTitles((p) => ({ ...p, ...pt }));
        if (Object.keys(pf).length) setTmdbFrAvailable((p) => ({ ...p, ...pf }));
      }
    }

    setTmdbTitles({});
    setTmdbFrAvailable({});
    fetchTmdbData();
    return () => { cancelled = true; };
  }, [schedules]);

  // ── Navigation avec direction pour le slide ──
  function prevWeek() {
    setSlideDir("from-right");
    setGridKey((k) => k + 1);
    setWeekOffset((w) => w - 1);
    setDayOffset(0);
  }
  function nextWeek() {
    setSlideDir("from-left");
    setGridKey((k) => k + 1);
    setWeekOffset((w) => w + 1);
    setDayOffset(0);
  }
  function thisWeek() {
    setSlideDir("from-right");
    setGridKey((k) => k + 1);
    setWeekOffset(0);
    setDayOffset(Math.max(0, Math.min(4, todayIndex() - 1)));
  }
  function handlePrevDay() {
    setSlideDir("from-right");
    setGridKey((k) => k + 1);
    setDayOffset((d) => Math.max(0, d - 1));
  }
  function handleNextDay() {
    setSlideDir("from-left");
    setGridKey((k) => k + 1);
    setDayOffset((d) => Math.min(7 - VISIBLE_DAYS, d + 1));
  }

  const weekLabel = useMemo(() => {
    if (!weekMonday) return "";
    const end = new Date(weekMonday);
    end.setDate(weekMonday.getDate() + 6);
    const fmt = (d) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    return `${fmt(weekMonday)} – ${fmt(end)}`;
  }, [weekMonday]);

  const isAvailableInFR = useCallback(
    (media) => tmdbFrAvailable[media.id] || hasFrenchVersion(media),
    [tmdbFrAvailable]
  );

  const byDay = useMemo(() => {
    if (!weekMonday) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const day      = new Date(weekMonday);
      day.setDate(weekMonday.getDate() + i);
      const dayStart = Math.floor(day.getTime() / 1000);
      const dayEnd   = dayStart + 86400;
      const entries  = schedules.filter((s) => {
        if (s.airingAt < dayStart || s.airingAt >= dayEnd) return false;
        if (langFilter    === "vf"        && !isAvailableInFR(s.media)) return false;
        if (contentFilter === "mylibrary") return libraryAnilistIds.has(String(s.media.id));
        if (contentFilter === "new")       return !isReturningSeries(s.media);
        if (contentFilter === "returning") return  isReturningSeries(s.media);
        return true;
      });
      return { date: day, entries };
    });
  }, [schedules, weekMonday, langFilter, contentFilter, libraryAnilistIds, isAvailableInFR]);

  const visibleDays   = byDay.slice(dayOffset, dayOffset + VISIBLE_DAYS);
  const canPrevDay    = dayOffset > 0;
  const canNextDay    = dayOffset + VISIBLE_DAYS < 7;
  const todayMidnight = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d.getTime(); }, []);
  const totalVisible  = visibleDays.reduce((sum, d) => sum + d.entries.length, 0);

  // Classe de slide selon la direction
  const slideClass = slideDir === "from-left"  ? "animate-slideFromLeft"
                   : slideDir === "from-right" ? "animate-slideFromRight"
                   : "";

  return (
    <div className="min-h-screen bg-violet-950 text-violet-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* ── En-tête ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-200 active:scale-95 transition-all motion-reduce:transition-none mb-3">
              <ChevronLeft size={16} /> Retour
            </button>
            <p className="font-mono text-[11px] tracking-[0.3em] text-violet-400 uppercase mb-1">{getSeasonLabel()}</p>
            <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Calendrier</h1>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={prevWeek} className="p-2 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 active:scale-95 transition-all motion-reduce:transition-none" aria-label="Semaine précédente">
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
            <button onClick={nextWeek} className="p-2 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 active:scale-95 transition-all motion-reduce:transition-none" aria-label="Semaine suivante">
              <ArrowRight size={15} className="text-violet-400" />
            </button>
            <button
              onClick={() => load(weekOffset, true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 disabled:opacity-50 active:scale-95 text-sm text-violet-300 transition-all motion-reduce:transition-none"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin motion-reduce:animate-none" : ""} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
          </div>
        </div>

        {/* ── Filtres ── */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <FilterBtn active={contentFilter === "all"}       onClick={() => setContentFilter("all")}>Tout</FilterBtn>
          <FilterBtn active={contentFilter === "mylibrary"} onClick={() => setContentFilter("mylibrary")}>Ma liste</FilterBtn>
          <FilterBtn active={contentFilter === "new"}       onClick={() => setContentFilter("new")}>Nouvelles séries</FilterBtn>
          <FilterBtn active={contentFilter === "returning"} onClick={() => setContentFilter("returning")}>Séries qui reprennent</FilterBtn>
          <span className="w-px h-5 bg-white/20 mx-1 rounded-full" aria-hidden />
          <FilterBtn active={langFilter === "all"} onClick={() => setLangFilter("all")}>VO</FilterBtn>
          <FilterBtn active={langFilter === "vf"}  onClick={() => setLangFilter("vf")}>VF</FilterBtn>
        </div>

        {error && (
          <div className="mb-6 text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">{error}</div>
        )}
        {langFilter === "vf" && !loading && (
          <p className="text-[11px] text-violet-500 font-mono mb-4">
            ℹ Les horaires sont ceux de la diffusion VO. La VF/VOSTFR est disponible sur ADN, Crunchyroll FR ou Netflix FR peu après.
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
                onClick={handlePrevDay}
                disabled={!canPrevDay}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 text-sm text-violet-300 transition-all motion-reduce:transition-none"
              >
                <ChevronLeft size={15} />
                <span className="hidden sm:inline text-xs">Préc.</span>
              </button>

              <p className="font-mono text-[11px] text-violet-500">
                {totalVisible} épisode{totalVisible !== 1 ? "s" : ""} affichés
              </p>

              <button
                onClick={handleNextDay}
                disabled={!canNextDay}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 text-sm text-violet-300 transition-all motion-reduce:transition-none"
              >
                <span className="hidden sm:inline text-xs">Suiv.</span>
                <ChevronRight size={15} />
              </button>
            </div>

            {/*
              key={gridKey} : force le remontage de la grille à chaque navigation.
              slideClass     : slide depuis la gauche ou la droite selon la direction.
            */}
            <div key={gridKey} className={`grid grid-cols-3 gap-4 motion-reduce:animate-none ${slideClass}`}>
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
                          /* animate-glowPulse : halo amber pulsant sur le badge du jour courant */
                          <span className="font-mono text-[8px] bg-amber-400 text-violet-950 px-1.5 py-0.5 rounded-full font-bold animate-glowPulse motion-reduce:animate-none">
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
                            frTitle={tmdbTitles[s.media.id] ?? null}
                            isFrench={isAvailableInFR(s.media)}
                            isLoadingTitle={hasTMDB() && !tmdbTitles[s.media.id]}
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

            <div className="flex justify-center gap-1.5 mt-4">
              {Array.from({ length: 7 - VISIBLE_DAYS + 1 }, (_, i) => (
                <button
                  key={i}
                  onClick={() => { setSlideDir(i > dayOffset ? "from-left" : "from-right"); setGridKey((k) => k + 1); setDayOffset(i); }}
                  className={`w-2 h-2 rounded-full transition-colors active:scale-90 motion-reduce:transition-none ${dayOffset === i ? "bg-amber-400" : "bg-white/20 hover:bg-white/40"}`}
                  aria-label={`Voir à partir de ${DAY_NAMES[i]}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {selectedSchedule && (
        <EpisodeDetailModal
          schedule={selectedSchedule}
          initialFrTitle={tmdbTitles[selectedSchedule.media.id] ?? null}
          hasFrFromTmdb={tmdbFrAvailable[selectedSchedule.media.id] ?? false}
          onClose={() => setSelectedSchedule(null)}
        />
      )}
    </div>
  );
}