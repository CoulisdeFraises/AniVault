// src/pages/CalendarFilms.jsx
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Clapperboard, Loader2, Sparkles } from "lucide-react";
import { useLibrary }    from "../context/LibraryContext";
import { fetchAniListReleaseDates } from "../api/anilist";
import { fetchTMDBMovieReleaseDate } from "../api/tmdb";
import { TopBar }        from "../components/common/TopBar";
import { CalendarTabs }  from "../components/common/CalendarTabs";

const WEEKDAY_SHORT = ["L", "M", "M", "J", "V", "S", "D"];

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function monthKey(d) { return `${d.getFullYear()}-${d.getMonth()}`; }

// ── Page principale ───────────────────────────────────────────────────────────
export function CalendarFilms() {
  const navigate = useNavigate();
  const { entries } = useLibrary();

  const [cursor,      setCursor]      = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [selectedDay, setSelectedDay] = useState(null); // Date | null
  const [releaseDates, setReleaseDates] = useState({}); // unitKey -> timestamp ms
  const [loading,      setLoading]      = useState(true);

  // Films de la bibliothèque — même classification que l'onglet "Films" de
  // la page d'accueil (peu importe le type, category === "movie").
  const filmEntries = useMemo(() => entries.filter((e) => e.category === "movie"), [entries]);

  // Une entrée "Film" peut représenter UN film (TMDB) ou PLUSIEURS films
  // bundlés dans une franchise (AniList — ex. une entrée qui regroupe tous les
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

  const eventsByMonth = useMemo(() => {
    const map = new Map();
    releaseEvents.forEach((ev) => {
      const key = monthKey(ev.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    });
    return map;
  }, [releaseEvents]);

  const visibleEvents  = eventsByMonth.get(monthKey(cursor)) || [];
  const totalThisMonth = visibleEvents.length;

  // ── Grille du mois (semaines commençant le lundi) ─────────────────────────
  const gridDays = useMemo(() => {
    const year = cursor.getFullYear(), month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // 0 = lundi
    const daysInMonth   = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstWeekday; i++) {
      const d = new Date(year, month, 1 - (firstWeekday - i));
      days.push({ date: d, inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({ date: new Date(year, month, day), inMonth: true });
    }
    while (days.length % 7 !== 0) {
      const last = days[days.length - 1].date;
      const d = new Date(last); d.setDate(d.getDate() + 1);
      days.push({ date: d, inMonth: false });
    }
    return days;
  }, [cursor]);

  const today = useMemo(() => new Date(), []);
  const monthLabel = cursor.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  function goPrevMonth() { setSelectedDay(null); setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1)); }
  function goNextMonth() { setSelectedDay(null); setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1)); }
  function goToday()     { setSelectedDay(null); setCursor(() => { const d = new Date(); d.setDate(1); return d; }); }

  function eventsForDay(date) {
    return visibleEvents.filter((ev) => sameDay(ev.date, date));
  }

  const selectedEvents = selectedDay ? eventsForDay(selectedDay) : [];
  const unresolvedCount = movieUnits.length - Object.keys(releaseDates).length;

  return (
    <div className="min-h-screen bg-violet-950 text-violet-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-5xl mx-auto px-3 sm:px-6 pb-nav pt-safe-8">

        {/* ── En-tête ── */}
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div className="min-w-0">
            <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-200 active:scale-95 transition-all motion-reduce:transition-none mb-2">
              <ChevronLeft size={16} /> Retour
            </button>
            <p className="font-mono text-[11px] tracking-[0.3em] text-violet-400 uppercase mb-0.5">Sorties de films</p>
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
            {/* ── Navigation mois ── */}
            <div className="flex items-center justify-between mb-3">
              <button onClick={goPrevMonth}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 active:scale-95 text-sm text-violet-300 transition-all motion-reduce:transition-none">
                <ChevronLeft size={15} />
              </button>

              <div className="flex flex-col items-center gap-0.5">
                <button onClick={goToday} className="capitalize text-sm font-semibold text-violet-100 hover:text-amber-300 transition-colors">
                  {monthLabel}
                </button>
                <p className="font-mono text-[11px] text-violet-500">
                  {totalThisMonth} sortie{totalThisMonth !== 1 ? "s" : ""}
                </p>
              </div>

              <button onClick={goNextMonth}
                className="flex items-center gap-1 px-3 py-2 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 active:scale-95 text-sm text-violet-300 transition-all motion-reduce:transition-none">
                <ChevronRight size={15} />
              </button>
            </div>

            {/* ── En-têtes jours ── */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAY_SHORT.map((w, i) => (
                <p key={i} className="text-center font-mono text-[10px] uppercase text-violet-500">{w}</p>
              ))}
            </div>

            {/* ── Grille du mois ── */}
            <div className="grid grid-cols-7 gap-1 mb-5">
              {gridDays.map(({ date, inMonth }, i) => {
                const isToday    = sameDay(date, today);
                const isSelected = selectedDay && sameDay(date, selectedDay);
                const dayEvents  = inMonth ? eventsForDay(date) : [];
                const cover      = dayEvents[0]?.entry?.coverImage;
                const isUpcoming = dayEvents.length > 0 && date.getTime() >= new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

                return (
                  <button
                    key={i}
                    onClick={() => inMonth && dayEvents.length > 0 && setSelectedDay(isSelected ? null : date)}
                    disabled={!inMonth || dayEvents.length === 0}
                    className={`relative aspect-square rounded-lg overflow-hidden flex flex-col items-center justify-center gap-0.5 transition-all motion-reduce:transition-none ${
                      !inMonth ? "opacity-20" : ""
                    } ${
                      isSelected ? "ring-2 ring-amber-400" : ""
                    } ${
                      dayEvents.length > 0 ? "cursor-pointer active:scale-95" : "cursor-default"
                    } ${
                      isToday ? "bg-amber-400/10 border border-amber-400/30" : "bg-white/5 border border-white/5"
                    }`}
                  >
                    {cover && (
                      <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40" />
                    )}
                    <span className={`relative z-10 font-mono text-[11px] ${isToday ? "text-amber-300 font-bold" : "text-violet-300"}`}>
                      {date.getDate()}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className={`relative z-10 w-1.5 h-1.5 rounded-full ${isUpcoming ? "bg-amber-400" : "bg-violet-400"}`} />
                    )}
                  </button>
                );
              })}
            </div>

            {unresolvedCount > 0 && (
              <p className="text-[11px] text-violet-600 font-mono text-center mb-4">
                Date de sortie inconnue pour {unresolvedCount} film{unresolvedCount !== 1 ? "s" : ""} — non affiché{unresolvedCount !== 1 ? "s" : ""}.
              </p>
            )}

            {/* ── Détail du jour sélectionné ── */}
            {selectedDay && (
              <div className="rounded-2xl border border-white/5 bg-violet-900/20 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="font-mono text-xs uppercase tracking-widest text-violet-300">
                    {selectedDay.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                </div>
                <div className="p-2.5 sm:p-3 space-y-2">
                  {selectedEvents.map((ev) => {
                    const upcoming = ev.date.getTime() >= new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
                    return (
                      <button
                        key={ev.key}
                        onClick={() => navigate(`/details/${ev.entry.id}`)}
                        className="w-full flex gap-2.5 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left"
                      >
                        {ev.entry.coverImage ? (
                          <img src={ev.entry.coverImage} alt="" className="w-10 h-14 object-cover rounded-lg flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-14 rounded-lg bg-white/10 flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1 flex flex-col justify-center">
                          <p className="text-xs font-medium text-violet-100 leading-snug truncate">{ev.label}</p>
                          {upcoming ? (
                            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-amber-400 mt-1">
                              <Sparkles size={10} /> Sortie à venir
                            </span>
                          ) : (
                            <span className="font-mono text-[10px] text-violet-500 mt-1">Déjà sorti</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
