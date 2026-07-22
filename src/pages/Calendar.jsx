import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, RefreshCw, Loader2, ChevronLeft } from "lucide-react";
import { fetchWeeklySchedule, hasFrenchVersion } from "../api/anilist";

// ── Noms des jours ─────────────────────────────────────────────────────────────
const DAY_NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

// ── Label de la saison courante ───────────────────────────────────────────────
function getSeasonLabel() {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();
  if (month <= 3) return `Hiver ${year}`;
  if (month <= 6) return `Printemps ${year}`;
  if (month <= 9) return `Été ${year}`;
  return `Automne ${year}`;
}

// ── Carte d'un épisode ────────────────────────────────────────────────────────
function EpisodeCard({ schedule }) {
  const time   = new Date(schedule.airingAt * 1000);
  const isFr   = hasFrenchVersion(schedule.media);
  const title  = schedule.media.title.english || schedule.media.title.romaji;

  return (
    <div className="flex gap-2 p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors motion-reduce:transition-none">
      {schedule.media.coverImage?.medium ? (
        <img
          src={schedule.media.coverImage.medium}
          alt=""
          className="w-10 h-[60px] object-cover rounded-lg flex-shrink-0"
        />
      ) : (
        <div className="w-10 h-[60px] rounded-lg bg-white/10 flex-shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-violet-100 leading-tight line-clamp-2">{title}</p>
        <p className="font-mono text-[10px] text-violet-400 mt-1">Ép. {schedule.episode}</p>
        <p className="font-mono text-[10px] text-violet-500">
          {time.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </p>
        {isFr && (
          <span className="inline-block mt-1 font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/20">
            VF
          </span>
        )}
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export function Calendar() {
  const navigate = useNavigate();

  const [schedules,   setSchedules]   = useState([]);
  const [weekMonday,  setWeekMonday]  = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState("");
  const [filter,      setFilter]      = useState("all"); // "all" | "vf"
  const [weekOffset,  setWeekOffset]  = useState(0);

  // ── Chargement ──
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

  // ── Navigation semaine ──
  function prevWeek() { setWeekOffset((w) => w - 1); }
  function nextWeek() { setWeekOffset((w) => w + 1); }
  function thisWeek() { setWeekOffset(0); }

  // ── Label de la semaine affichée ──
  const weekLabel = useMemo(() => {
    if (!weekMonday) return "";
    const end = new Date(weekMonday);
    end.setDate(weekMonday.getDate() + 6);
    const fmt = (d) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    return `${fmt(weekMonday)} – ${fmt(end)}`;
  }, [weekMonday]);

  // ── Découpage par jour ──
  const byDay = useMemo(() => {
    if (!weekMonday) return [];

    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(weekMonday);
      day.setDate(weekMonday.getDate() + i);
      const dayStart = Math.floor(day.getTime() / 1000);
      const dayEnd   = dayStart + 86400;

      const entries = schedules.filter((s) => {
        if (s.airingAt < dayStart || s.airingAt >= dayEnd) return false;
        if (filter === "vf") return hasFrenchVersion(s.media);
        return true;
      });

      return { date: day, entries };
    });
  }, [schedules, weekMonday, filter]);

  // ── Aujourd'hui ──
  const todayMidnight = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
  }, []);

  return (
    <div
      className="min-h-screen bg-violet-950 text-violet-50"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

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
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Calendrier
            </h1>
          </div>

          {/* Navigation semaine + refresh */}
          <div className="flex items-center gap-2">
            <button
              onClick={prevWeek}
              className="p-2 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 transition-colors motion-reduce:transition-none"
              aria-label="Semaine précédente"
            >
              <ArrowLeft size={15} className="text-violet-400" />
            </button>

            <div className="text-center min-w-[140px]">
              <p className="text-sm font-medium text-violet-100">{weekLabel}</p>
              {weekOffset !== 0 && (
                <button
                  onClick={thisWeek}
                  className="text-[10px] font-mono text-amber-400 hover:text-amber-300 transition-colors motion-reduce:transition-none"
                >
                  Revenir à cette semaine
                </button>
              )}
            </div>

            <button
              onClick={nextWeek}
              className="p-2 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 transition-colors motion-reduce:transition-none"
              aria-label="Semaine suivante"
            >
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

        {/* ── Filtres ── */}
        <div className="flex gap-2 mb-6">
          {[
            { key: "all", label: "Tout (VO)" },
            { key: "vf",  label: "VF disponible" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors motion-reduce:transition-none ${
                filter === key
                  ? "bg-amber-400 text-violet-950 border-amber-400"
                  : "bg-white/5 border-white/10 text-violet-300 hover:bg-white/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Erreur ── */}
        {error && (
          <div className="mb-6 text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* ── Contenu ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 size={28} className="animate-spin text-violet-400" />
            <p className="text-sm text-violet-400 font-mono">Chargement du calendrier…</p>
          </div>
        ) : (
          <>
            {/* Note VF */}
            {filter === "vf" && (
              <p className="text-[11px] text-violet-500 mb-4 font-mono">
                ℹ Les horaires affichés sont ceux de la diffusion originale (VO). La VF est disponible sur ADN, Wakanim ou Crunchyroll FR peu après.
              </p>
            )}

            {/* Grille 7 colonnes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
              {byDay.map(({ date, entries }, i) => {
                const isToday = date.getTime() === todayMidnight;

                return (
                  <div
                    key={i}
                    className={`rounded-2xl border overflow-hidden flex flex-col ${
                      isToday
                        ? "border-amber-400/40 bg-amber-400/5"
                        : "border-white/5 bg-violet-900/20"
                    }`}
                  >
                    {/* En-tête jour */}
                    <div className={`px-3 py-2.5 border-b ${isToday ? "border-amber-400/20" : "border-white/5"}`}>
                      <p className={`font-mono text-[10px] uppercase tracking-widest font-semibold ${
                        isToday ? "text-amber-400" : "text-violet-400"
                      }`}>
                        {DAY_NAMES[i]}
                        {isToday && <span className="ml-1.5 text-[8px] bg-amber-400 text-violet-950 px-1 py-0.5 rounded-full">Aujourd'hui</span>}
                      </p>
                      <p className="text-[10px] text-violet-500 mt-0.5">
                        {date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </p>
                    </div>

                    {/* Épisodes du jour */}
                    <div className="p-2 flex-1 space-y-2 overflow-y-auto max-h-[600px]">
                      {entries.length === 0 ? (
                        <p className="text-[10px] text-violet-600 font-mono text-center py-6">—</p>
                      ) : (
                        entries.map((s) => <EpisodeCard key={s.id} schedule={s} />)
                      )}
                    </div>

                    {/* Compteur */}
                    {entries.length > 0 && (
                      <div className="px-3 py-1.5 border-t border-white/5">
                        <p className="font-mono text-[9px] text-violet-500">
                          {entries.length} épisode{entries.length > 1 ? "s" : ""}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}