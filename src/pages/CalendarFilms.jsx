// src/pages/CalendarFilms.jsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Clapperboard, Loader2, Sparkles } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useLibrary }      from "../context/LibraryContext";
import { importResult }    from "../api";
import {
  hasTMDB, fetchTMDBMovieGenres, fetchTMDBTheatricalReleases,
} from "../api/tmdb";
import { TopBar }         from "../components/common/TopBar";
import { PullToRefresh }  from "../components/common/PullToRefresh";
import { CalendarTabs }   from "../components/common/CalendarTabs";
import { SynopsisModal }  from "../components/common/SynopsisModal";
import { getCached, getStaleCached, setCached, TTL } from "../lib/cache";

const MAX_MONTHS_AHEAD = 2; // + le mois en cours = 3 mois consultables au total
const MAX_PAGES        = 3; // plafond de pages TMDB par mois (≈ 60 films), largement suffisant

function pad(n) { return String(n).padStart(2, "0"); }
function toISODate(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function monthKey(d) { return `${d.getFullYear()}-${d.getMonth()}`; }
function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

// ── Page principale ───────────────────────────────────────────────────────────
export function CalendarFilms() {
  const navigate = useNavigate();
  const { entries, saveEntry } = useLibrary();

  const [monthOffset, setMonthOffset] = useState(0); // 0, 1 ou 2
  const [releasesByMonth, setReleasesByMonth] = useState({}); // "YYYY-M" -> [movies]
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [error,        setError]        = useState("");
  const [genreMap,     setGenreMap]     = useState({});
  const [synopsisMovie, setSynopsisMovie] = useState(null);
  const [addingIds,    setAddingIds]    = useState(new Set());

  const today  = useMemo(() => new Date(), []);
  const cursor = useMemo(() => new Date(today.getFullYear(), today.getMonth() + monthOffset, 1), [today, monthOffset]);
  const key    = monthKey(cursor);

  // tmdbId des films déjà présents dans la bibliothèque, pour l'indicateur "Déjà ajouté"
  const libraryTmdbIds = useMemo(
    () => new Set(entries.filter((e) => e.category === "movie" && e.tmdbId).map((e) => e.tmdbId)),
    [entries]
  );

  useEffect(() => {
    if (!Object.keys(genreMap).length) fetchTMDBMovieGenres().then(setGenreMap);
  }, []); // eslint-disable-line

  const load = useCallback(async (isRefresh = false) => {
    const cacheKey = `calendar_films_${key}`;

    if (!isRefresh) {
      const cached = getCached(cacheKey);
      if (cached) {
        setReleasesByMonth((prev) => ({ ...prev, [key]: cached }));
        setLoading(false);
        return;
      }
    }

    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError("");

    try {
      const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const monthEnd    = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const gte = toISODate(monthStart), lte = toISODate(monthEnd);

      let all = [];
      let page = 1, totalPages = 1;
      do {
        const { results, totalPages: tp } = await fetchTMDBTheatricalReleases(gte, lte, page);
        all = all.concat(results);
        totalPages = tp;
        page++;
      } while (page <= totalPages && page <= MAX_PAGES);

      setCached(cacheKey, all, TTL.FILMS_CALENDAR);
      setReleasesByMonth((prev) => ({ ...prev, [key]: all }));
    } catch (err) {
      const stale = getStaleCached(cacheKey);
      if (stale) {
        setReleasesByMonth((prev) => ({ ...prev, [key]: stale }));
        setError("⚠️ Connexion indisponible — données précédentes affichées.");
      } else {
        setError("Impossible de charger les sorties cinéma. Vérifie ta connexion et réessaie.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cursor, key]);

  useEffect(() => { load(); }, [key]); // eslint-disable-line

  const monthMovies = releasesByMonth[key];

  // ── Liste groupée par jour, triée chronologiquement ───────────────────────
  const groupedByDay = useMemo(() => {
    if (!monthMovies) return [];
    const withDates = monthMovies
      .filter((m) => m.release_date)
      .map((m) => ({ ...m, _date: new Date(m.release_date + "T00:00:00") }))
      .sort((a, b) => a._date - b._date);

    const groups = [];
    withDates.forEach((m) => {
      const last = groups[groups.length - 1];
      if (last && sameDay(last.date, m._date)) last.entries.push(m);
      else groups.push({ date: m._date, entries: [m] });
    });
    return groups;
  }, [monthMovies]);

  const totalThisMonth = groupedByDay.reduce((sum, g) => sum + g.entries.length, 0);

  const monthOptions = Array.from({ length: MAX_MONTHS_AHEAD + 1 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    return { offset: i, label: i === 0 ? "Ce mois-ci" : d.toLocaleDateString("fr-FR", { month: "long" }) };
  });

  function openSynopsis(m) {
    setSynopsisMovie({
      id:          m.id,
      title:       m.title || m.original_title,
      image:       m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : null,
      score:       m.vote_average ? Math.round(m.vote_average * 10) : 0,
      description: m.overview?.trim() || null,
      genres:      (m.genre_ids || []).map((id) => genreMap[id]).filter(Boolean),
      year:        m.release_date ? m.release_date.slice(0, 4) : null,
      genreIds:    m.genre_ids || [],
      overview:    m.overview?.trim() || null,
    });
  }

  const handleAddToLibrary = useCallback(async (movie) => {
    if (addingIds.has(movie.id)) return;
    setAddingIds((prev) => new Set([...prev, movie.id]));
    try {
      const imported = await importResult({
        source:   "tmdb_movie",
        id:       movie.id,
        title:    movie.title,
        image:    movie.image,
        overview: movie.overview,
        genreIds: movie.genreIds,
      });
      saveEntry({ ...imported, type: "serie", status: "a-voir", rating: 0 }, null);
      setSynopsisMovie(null);
    } catch (err) {
      console.error("Erreur lors de l'ajout à la bibliothèque :", err);
    } finally {
      setAddingIds((prev) => { const next = new Set(prev); next.delete(movie.id); return next; });
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
            <p className="font-mono text-[11px] tracking-[0.3em] text-violet-400 uppercase mb-0.5">Sorties cinéma · France</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Calendrier</h1>
          </div>
          <TopBar />
        </div>

        <CalendarTabs />

        {!hasTMDB() ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3 text-center px-6">
            <Clapperboard size={28} className="text-violet-600" />
            <p className="text-sm text-violet-400 font-mono">Configuration TMDB manquante.</p>
            <p className="text-xs text-violet-600">Les sorties cinéma nécessitent une clé API TMDB côté serveur.</p>
          </div>
        ) : (
          <>
            {error && (
              <p className="text-center font-mono text-[11px] text-amber-400/90 mb-3 px-4">{error}</p>
            )}

            {/* ── Sélecteur de mois (3 mois consultables) ── */}
            <div className="flex justify-center mb-5">
              <div className="inline-flex w-full max-w-md items-center gap-1 rounded-full bg-white/5 border border-white/10 p-1">
                {monthOptions.map(({ offset, label }) => (
                  <button
                    key={offset}
                    onClick={() => setMonthOffset(offset)}
                    className={`flex-1 min-w-0 px-3 py-2 rounded-full text-xs font-medium capitalize transition-all active:scale-95 motion-reduce:transition-none whitespace-nowrap ${
                      monthOffset === offset ? "bg-amber-400 text-violet-950" : "text-violet-300 hover:bg-white/10"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-32 gap-3">
                <Loader2 size={28} className="animate-spin text-violet-400" />
                <p className="text-sm text-violet-400 font-mono">Chargement des sorties cinéma…</p>
              </div>
            ) : (
              <>
                <p className="text-center font-mono text-[11px] text-violet-500 mb-5">
                  {totalThisMonth} sortie{totalThisMonth !== 1 ? "s" : ""} en salle
                </p>

                {groupedByDay.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-2 text-center px-6">
                    <Sparkles size={22} className="text-violet-600" />
                    <p className="text-sm text-violet-400 font-mono">Aucune sortie cinéma trouvée ce mois-ci.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {groupedByDay.map((group) => (
                      <div key={group.date.toISOString()}>
                        <p className="font-mono text-[11px] uppercase tracking-widest text-violet-400 mb-2 px-1">
                          {group.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                        </p>
                        <div className="rounded-2xl border border-white/5 bg-violet-900/20 overflow-hidden divide-y divide-white/5">
                          {group.entries.map((m) => {
                            const inLibrary = libraryTmdbIds.has(m.id);
                            return (
                              <button
                                key={m.id}
                                onClick={() => openSynopsis(m)}
                                className="w-full flex gap-3 p-2.5 hover:bg-white/5 transition-colors text-left"
                              >
                                {m.poster_path ? (
                                  <img src={`https://image.tmdb.org/t/p/w185${m.poster_path}`} alt="" className="w-11 h-16 object-cover rounded-lg flex-shrink-0" />
                                ) : (
                                  <div className="w-11 h-16 rounded-lg bg-white/10 flex-shrink-0" />
                                )}
                                <div className="min-w-0 flex-1 flex flex-col justify-center">
                                  <p className="text-sm font-medium text-violet-100 leading-snug line-clamp-2">{m.title || m.original_title}</p>
                                  <p className="text-[11px] text-violet-500 mt-0.5 truncate">
                                    {(m.genre_ids || []).map((id) => genreMap[id]).filter(Boolean).slice(0, 3).join(" · ")}
                                  </p>
                                  {inLibrary && (
                                    <span className="font-mono text-[10px] text-emerald-400 mt-1">✓ Dans ta bibliothèque</span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
      </PullToRefresh>

      <AnimatePresence>
        {synopsisMovie && (
          <SynopsisModal
            key="synopsis"
            rec={synopsisMovie}
            onClose={() => setSynopsisMovie(null)}
            onAdd={handleAddToLibrary}
            adding={addingIds.has(synopsisMovie.id)}
            alreadyInLib={libraryTmdbIds.has(synopsisMovie.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
