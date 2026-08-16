// src/pages/CalendarFilms.jsx
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Clapperboard, Loader2, Sparkles } from "lucide-react";
import { useLibrary }    from "../context/LibraryContext";
import { fetchAniListReleaseDates } from "../api/anilist";
import { fetchTMDBMovieReleaseDate } from "../api/tmdb";
import { TopBar }        from "../components/common/TopBar";
import { CalendarTabs }  from "../components/common/CalendarTabs";

const MAX_MONTHS_AHEAD = 2; // + le mois en cours = 3 mois consultables au total

function monthKey(d) { return `${d.getFullYear()}-${d.getMonth()}`; }
function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

// ── Page principale ───────────────────────────────────────────────────────────
export function CalendarFilms() {
  const navigate = useNavigate();
  const { entries } = useLibrary();

  const [monthOffset,  setMonthOffset]  = useState(0); // 0, 1 ou 2
  const [releaseDates, setReleaseDates] = useState({}); // unitKey -> timestamp ms
  const [loading,      setLoading]      = useState(true);

  // Films de la bibliothèque — même classification que l'onglet "Films" de
  // la page d'accueil (peu importe le type, category === "movie").
  const filmEntries = useMemo(() => entries.filter((e) => e.category === "movie"), [entries]);

  // Une entrée "Film" peut représenter UN film (TMDB) ou PLUSIEURS films
  // bundlés dans une franchise (AniList — une entrée qui regroupe tous les
  // films d'une saga a un anilistId distinct par saison/film, voir seasons[]).
  // On éclate donc chaque entrée en "unités-film" individuelles, chacune avec
  // sa propre date de sortie.
  const movieUnits = useMemo(() => {
    const units = [];
    filmEntries.forEach((entry) => {
      if (entry.source === "tmdb_movie" && entry.tmdbId) {
        units.push({ key: `${entry.id}:tmdb`, entry, label: entry.title, tmdbId: entry.tmdbId, anilistId: null });
      } else if (entry.source === "anilist") {
        const movieSeasons = (entry.seasons || []).filter((s) => s.anilistId);
        movieSeasons.forEach((s) => {
          units.push({
            key: `${entry.id}:${s.anilistId}`,
            entry,
            label: movieSeasons.length > 1 ? (s.title || entry.title) : entry.title,
            tmdbId: null,
            anilistId: s.anilistId,
          });
        });
      }
    });
    return units;
  }, [filmEntries]);

  const load = async () => {
    setLoading(true);
    const anilistIds = movieUnits.filter((u) => u.anilistId).map((u) => u.anilistId);
    const tmdbUnits   = movieUnits.filter((u) => u.tmdbId);

    const [anilistDatesById, tmdbResults] = await Promise.all([
      fetchAniListReleaseDates(anilistIds),
      Promise.allSettled(tmdbUnits.map(async (u) => ({ key: u.key, date: await fetchTMDBMovieReleaseDate(u.tmdbId) }))),
    ]);

    const map = {};
    movieUnits.forEach((u) => {
      if (u.anilistId && anilistDatesById[u.anilistId]) map[u.key] = anilistDatesById[u.anilistId];
    });
    tmdbResults.forEach((r) => { if (r.status === "fulfilled" && r.value.date) map[r.value.key] = r.value.date; });

    setReleaseDates(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, [movieUnits.map((u) => u.key).join(",")]); // eslint-disable-line

  const releaseEvents = useMemo(
    () => movieUnits.filter((u) => releaseDates[u.key]).map((u) => ({ ...u, date: new Date(releaseDates[u.key]) })),
    [movieUnits, releaseDates]
  );

  const today = useMemo(() => new Date(), []);
  const cursor = useMemo(() => new Date(today.getFullYear(), today.getMonth() + monthOffset, 1), [today, monthOffset]);

  // ── Liste du mois sélectionné, groupée par jour, triée chronologiquement ──
  const groupedByDay = useMemo(() => {
    const monthEvents = releaseEvents
      .filter((ev) => monthKey(ev.date) === monthKey(cursor))
      .sort((a, b) => a.date - b.date);

    const groups = [];
    monthEvents.forEach((ev) => {
      const last = groups[groups.length - 1];
      if (last && sameDay(last.date, ev.date)) last.entries.push(ev);
      else groups.push({ date: ev.date, entries: [ev] });
    });
    return groups;
  }, [releaseEvents, cursor]);

  const totalThisMonth  = groupedByDay.reduce((sum, g) => sum + g.entries.length, 0);
  const unresolvedCount = movieUnits.length - Object.keys(releaseDates).length;

  const monthOptions = Array.from({ length: MAX_MONTHS_AHEAD + 1 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    return { offset: i, label: i === 0 ? "Ce mois-ci" : d.toLocaleDateString("fr-FR", { month: "long" }) };
  });

  return (
    <div className="min-h-screen bg-violet-950 text-violet-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-5xl mx-auto px-3 sm:px-6 pb-nav pt-safe-8">

        {/* ── En-tête ── */}
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div className="min-w-0">
            <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-200 active:scale-95 transition-all motion-reduce:transition-none mb-2">
              <ChevronLeft size={16} /> Retour
            </button>
            <p className="font-mono text-[11px] tracking-[0.3em] text-violet-400 uppercase mb-0.5">Sorties cinéma</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Calendrier</h1>
          </div>
          <TopBar />
        </div>

        <CalendarTabs />

        {filmEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3 text-center px-6">
            <Clapperboard size={28} className="text-violet-600" />
            <p className="text-sm text-violet-400 font-mono">Aucun film dans ta bibliothèque.</p>
            <p className="text-xs text-violet-600">Ajoute un film depuis la recherche pour voir sa date de sortie ici.</p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 size={28} className="animate-spin text-violet-400" />
            <p className="text-sm text-violet-400 font-mono">Chargement des dates de sortie…</p>
          </div>
        ) : (
          <>
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

            <p className="text-center font-mono text-[11px] text-violet-500 mb-5">
              {totalThisMonth} sortie{totalThisMonth !== 1 ? "s" : ""}
            </p>

            {/* ── Liste chronologique ── */}
            {groupedByDay.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-2 text-center px-6">
                <Sparkles size={22} className="text-violet-600" />
                <p className="text-sm text-violet-400 font-mono">Aucune sortie prévue ce mois-ci.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {groupedByDay.map((group) => (
                  <div key={group.date.toISOString()}>
                    <p className="font-mono text-[11px] uppercase tracking-widest text-violet-400 mb-2 px-1">
                      {group.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                    </p>
                    <div className="rounded-2xl border border-white/5 bg-violet-900/20 overflow-hidden divide-y divide-white/5">
                      {group.entries.map((ev) => (
                        <button
                          key={ev.key}
                          onClick={() => navigate(`/details/${ev.entry.id}`)}
                          className="w-full flex gap-3 p-2.5 hover:bg-white/5 transition-colors text-left"
                        >
                          {ev.entry.coverImage ? (
                            <img src={ev.entry.coverImage} alt="" className="w-11 h-16 object-cover rounded-lg flex-shrink-0" />
                          ) : (
                            <div className="w-11 h-16 rounded-lg bg-white/10 flex-shrink-0" />
                          )}
                          <div className="min-w-0 flex-1 flex flex-col justify-center">
                            <p className="text-sm font-medium text-violet-100 leading-snug line-clamp-2">{ev.label}</p>
                            {ev.entry.genres?.length > 0 && (
                              <p className="text-[11px] text-violet-500 mt-0.5 truncate">{ev.entry.genres.slice(0, 3).join(" · ")}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {unresolvedCount > 0 && (
              <p className="text-[11px] text-violet-600 font-mono text-center mt-5">
                Date de sortie inconnue pour {unresolvedCount} film{unresolvedCount !== 1 ? "s" : ""} — non affiché{unresolvedCount !== 1 ? "s" : ""}.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
