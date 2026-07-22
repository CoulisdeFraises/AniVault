import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, RefreshCw, Loader2,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { fetchWeeklySchedule, hasFrenchVersion, isReturningSeries } from "../api/anilist";
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

// Index du jour courant (0 = lundi … 6 = dimanche)
function todayIndex() {
  const dow = new Date().getDay();
  return dow === 0 ? 6 : dow - 1;
}

// ── Carte épisode ─────────────────────────────────────────────────────────────
function EpisodeCard({ schedule, showVfBadge }) {
  const time  = new Date(schedule.airingAt * 1000);
  const title = schedule.media.title.english || schedule.media.title.romaji;
  const isFr  = hasFrenchVersion(schedule.media);

  return (
    <div className="flex gap-2.5 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors motion-reduce:transition-none">
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
    </div>
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

  const [schedules,  setSchedules]  = useState([]);
  const [weekMonday, setWeekMonday] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState("");
  const [weekOffset, setWeekOffset] = useState(0);

  // Filtre contenu (une seule valeur active)
  const [contentFilter, setContentFilter] = useState("all");
  // "all" | "mylibrary" | "new" | "returning"

  // Filtre langue (une seule valeur active)
  const [langFilter, setLangFilter] = useState("all");
  // "all" | "vf"

  // Offset de la fenêtre de 3 jours (0–4)
  const [dayOffset, setDayOffset] = useState(() =>
    Math.max(0, Math.min(7 - VISIBLE_DAYS, todayIndex() - 1))
  );

  // ── IDs AniList présents dans la bibliothèque ──
  const libraryAnilistIds = useMemo(
    () => new Set(
      libraryEntries.flatMap((e) => e.anilistIds || []).map(String)
    ),
    [libraryEntries]
  );

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
  function prevWeek() { setWeekOffset((w) => w - 1); setDayOffset(0); }
  function nextWeek() { setWeekOffset((w) => w + 1); setDayOffset(0); }
  function thisWeek() { setWeekOffset(0); setDayOffset(Math.max(0, Math.min(4, todayIndex() - 1))); }

  // ── Label semaine ──
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
      const day      = new Date(weekMonday);
      day.setDate(weekMonday.getDate() + i);
      const dayStart = Math.floor(day.getTime() / 1000);
      const dayEnd   = dayStart + 86400;

      const entries = schedules.filter((s) => {
        if (s.airingAt < dayStart || s.airingAt >= dayEnd) return false;

        // Filtre langue
        if (langFilter === "vf" && !hasFrenchVersion(s.media)) return false;

        // Filtre contenu
        if (contentFilter === "mylibrary")
          return libraryAnilistIds.has(String(s.media.id));
        if (contentFilter === "new")
          return !isReturningSeries(s.media);
        if (contentFilter === "returning")
          return isReturningSeries(s.media);

        return true;
      });

      return { date: day, entries };
    });
  }, [schedules, weekMonday, langFilter, contentFilter, libraryAnilistIds]);

  // ── Jours visibles (fenêtre de 3) ──
  const visibleDays = byDay.slice(dayOffset, dayOffset + VISIBLE_DAYS);
  const canPrevDay  = dayOffset > 0;
  const canNextDay  = dayOffset + VISIBLE_DAYS < 7;

  // ── Aujourd'hui ──
  const todayMidnight = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
  }, []);

  // ── Compteur total visible ──
  const totalVisible = visibleDays.reduce((sum, d) => sum + d.entries.length, 0);

  return (
    <div
      className="min-h-screen bg-violet-950 text-violet-50"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
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
            <h1
              className="text-3xl font-bold tracking-tight"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Calendrier
            </h1>
          </div>

          {/* Navigation semaine */}
          <div className="flex items-center gap-2">
            <button
              onClick={prevWeek}
              className="p-2 rounded-xl bg-violet-900/40 border border-white/10 hover:bg-violet-800/50 transition-colors motion-reduce:transition-none"
              aria-label="Semaine précédente"
            >
              <ArrowLeft size={15} className="text-violet-400" />
            </button>
            <div className="text-center min-w-[150px]">
              <p className="text-sm font-medium text-violet-100">{weekLabel}</p>
              {weekOffset !== 0 && (
                <button
                  onClick={thisWeek}
                  className="text-[10px] font-mono text-amber-400 hover:text-amber-300 transition-colors motion-reduce:transition-none"
                >
                  Cette semaine
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

        {/* ── Filtres ligne 1 : type de série ── */}
        <div className="flex flex-wrap gap-2 mb-2">
          <FilterBtn active={contentFilter === "all"}       onClick={() => setContentFilter("all")}>
            Tout
          </FilterBtn>
          <FilterBtn active={contentFilter === "mylibrary"} onClick={() => setContentFilter("mylibrary")}>
            Ma liste
          </FilterBtn>
          <FilterBtn active={contentFilter === "new"}       onClick={() => setContentFilter("new")}>
            Nouvelles séries
          </FilterBtn>
          <FilterBtn active={contentFilter === "returning"} onClick={() => setContentFilter("returning")}>
            Séries qui reprennent
          </FilterBtn>
        </div>

        {/* ── Filtres ligne 2 : langue ── */}
        <div className="flex flex-wrap gap-2 mb-6">
          <FilterBtn active={langFilter === "all"} onClick={() => setLangFilter("all")}>
            Tout (VO)
          </FilterBtn>
          <FilterBtn active={langFilter === "vf"}  onClick={() => setLangFilter("vf")}>
            VF disponible
          </FilterBtn>
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
            ℹ Les horaires sont ceux de la diffusion VO. La VF est disponible sur ADN, Wakanim ou Crunchyroll FR peu après.
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
                const isToday = date.getTime() === todayMidnight;
                const globalIdx = dayOffset + i;

                return (
                  <div
                    key={globalIdx}
                    className={`rounded-2xl border overflow-hidden flex flex-col ${
                      isToday
                        ? "border-amber-400/40 bg-amber-400/5"
                        : "border-white/5 bg-violet-900/20"
                    }`}
                  >
                    {/* En-tête jour */}
                    <div className={`px-4 py-3 border-b ${isToday ? "border-amber-400/20" : "border-white/5"}`}>
                      <div className="flex items-center justify-between">
                        <p className={`font-mono text-xs uppercase tracking-widest font-semibold ${
                          isToday ? "text-amber-400" : "text-violet-300"
                        }`}>
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

                    {/* Épisodes */}
                    <div className="p-3 flex-1 space-y-2 overflow-y-auto max-h-[70vh]">
                      {entries.length === 0 ? (
                        <p className="text-[11px] text-violet-600 font-mono text-center py-8">
                          Aucun épisode
                        </p>
                      ) : (
                        entries.map((s) => (
                          <EpisodeCard
                            key={s.id}
                            schedule={s}
                            showVfBadge={langFilter === "all"}
                          />
                        ))
                      )}
                    </div>

                    {/* Compteur bas */}
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
    </div>
  );
}