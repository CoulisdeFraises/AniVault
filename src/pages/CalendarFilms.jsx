// src/pages/CalendarFilms.jsx
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Clapperboard, Star } from "lucide-react";
import { useLibrary }   from "../context/LibraryContext";
import { TopBar }       from "../components/common/TopBar";
import { CalendarTabs } from "../components/common/CalendarTabs";
import { formatRating } from "../utils/status";

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

  // Films de la bibliothèque — même classification que l'onglet "Films" de
  // la page d'accueil (peu importe le type, category === "movie").
  const filmEntries = useMemo(() => entries.filter((e) => e.category === "movie"), [entries]);

  // Tous les visionnages de films, à plat, avec référence à leur entrée.
  const watchEvents = useMemo(() => {
    return filmEntries.flatMap((entry) =>
      (entry.watchHistory || []).map((h) => ({ ...h, entry, date: new Date(h.watchedAt) }))
    );
  }, [filmEntries]);

  const eventsByMonth = useMemo(() => {
    const map = new Map();
    watchEvents.forEach((ev) => {
      const key = monthKey(ev.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ev);
    });
    return map;
  }, [watchEvents]);

  const visibleEvents = eventsByMonth.get(monthKey(cursor)) || [];
  const totalThisMonth = visibleEvents.length;

  // ── Grille du mois (semaines commençant le lundi) ─────────────────────────
  const gridDays = useMemo(() => {
    const year = cursor.getFullYear(), month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // 0 = lundi
    const daysInMonth   = new Date(year, month + 1, 0).getDate();

    const days = [];
    // Jours de fin du mois précédent pour compléter la 1ère semaine
    for (let i = 0; i < firstWeekday; i++) {
      const d = new Date(year, month, 1 - (firstWeekday - i));
      days.push({ date: d, inMonth: false });
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({ date: new Date(year, month, day), inMonth: true });
    }
    // Complète jusqu'à un multiple de 7
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

  return (
    <div className="min-h-screen bg-violet-950 text-violet-50" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-5xl mx-auto px-3 sm:px-6 pb-nav pt-safe-8">

        {/* ── En-tête ── */}
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div className="min-w-0">
            <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-200 active:scale-95 transition-all motion-reduce:transition-none mb-2">
              <ChevronLeft size={16} /> Retour
            </button>
            <p className="font-mono text-[11px] tracking-[0.3em] text-violet-400 uppercase mb-0.5">Visionnages</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Calendrier</h1>
          </div>
          <TopBar />
        </div>

        <CalendarTabs />

        {filmEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3 text-center px-6">
            <Clapperboard size={28} className="text-violet-600" />
            <p className="text-sm text-violet-400 font-mono">Aucun film dans ta bibliothèque.</p>
            <p className="text-xs text-violet-600">Ajoute un film depuis la recherche pour suivre tes visionnages ici.</p>
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
                  {totalThisMonth} film{totalThisMonth !== 1 ? "s" : ""} visionné{totalThisMonth !== 1 ? "s" : ""}
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
                      <span className="relative z-10 w-1.5 h-1.5 rounded-full bg-amber-400" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Détail du jour sélectionné ── */}
            {selectedDay && (
              <div className="rounded-2xl border border-white/5 bg-violet-900/20 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="font-mono text-xs uppercase tracking-widest text-violet-300">
                    {selectedDay.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                </div>
                <div className="p-2.5 sm:p-3 space-y-2">
                  {selectedEvents.map((ev, i) => (
                    <button
                      key={`${ev.entry.id}-${i}`}
                      onClick={() => navigate(`/details/${ev.entry.id}`)}
                      className="w-full flex gap-2.5 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left"
                    >
                      {ev.entry.coverImage ? (
                        <img src={ev.entry.coverImage} alt="" className="w-10 h-14 object-cover rounded-lg flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-14 rounded-lg bg-white/10 flex-shrink-0" />
                      )}
                      <div className="min-w-0 flex-1 flex flex-col justify-center">
                        <p className="text-xs font-medium text-violet-100 leading-snug truncate">{ev.entry.title}</p>
                        {ev.entry.rating > 0 && (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] text-amber-400 mt-1">
                            <Star size={10} fill="#fbbf24" strokeWidth={0} /> {formatRating(ev.entry.rating)}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
