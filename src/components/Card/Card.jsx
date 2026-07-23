import { memo, useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Pencil, Trash2, Film, Tv, Check, CheckCheck, ChevronRight, Star, RotateCcw } from "lucide-react";
import "./Card.css";
import { ProgressBar }   from "./ProgressBar";
import { ConfirmDialog } from "../Modal/Modal";
import { getRatingEmoji } from "../common/Rating";
import { STATUS, seasonTotals, formatCountdown } from "../../utils/status";
import { useLibrary } from "../../context/LibraryContext";
import { fetchNextAiring } from "../../api";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function getFormatGroup(format) {
  if (!format || format === "TV" || format === "TV_SHORT") return "tv";
  if (format === "MOVIE") return "movie";
  return "extra"; // OVA, ONA, SPECIAL, MUSIC
}

function getResumeStatus(entry) {
  const { watched, total } = seasonTotals(entry.seasons);
  if (total != null && total > 0 && watched >= total) return "termine";
  if (watched > 0) return "en-cours";
  return "a-voir";
}

// ─────────────────────────────────────────────────────────────────────────────
// AccordionHeader — bouton cliquable avec résumé quand fermé
// ─────────────────────────────────────────────────────────────────────────────
function AccordionHeader({ icon, label, count, summary, isOpen, onToggle }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className="flex items-center justify-between w-full py-1 text-left group select-none"
    >
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <span className="text-base leading-none">{icon}</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-violet-400 group-hover:text-violet-200 transition-colors whitespace-nowrap">
          {label}
        </span>
        <span className="font-mono text-[10px] text-violet-600 whitespace-nowrap">({count})</span>
        {!isOpen && summary && (
          <span className="font-mono text-[10px] text-violet-500 truncate ml-1">— {summary}</span>
        )}
      </div>
      <ChevronRight
        size={12}
        className={`flex-shrink-0 ml-2 text-violet-500 group-hover:text-violet-300 transition-all duration-200 ${isOpen ? "rotate-90" : ""}`}
      />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OvaRow — une ligne OVA/ONA avec scrubber complet (-1 / +1 / Tout + barre)
// ─────────────────────────────────────────────────────────────────────────────
const OvaRow = memo(function OvaRow({ season, entryId, statusStyle, isAbandoned }) {
  const { incrementEpisode, decrementEpisode, setEpisodeCount } = useLibrary();
  const gi   = season.globalIndex;
  const done = season.totalEpisodes != null && season.watchedEpisodes >= season.totalEpisodes;
  const FORMAT_LABEL = { OVA: "OAV", ONA: "ONA", SPECIAL: "Spécial", MUSIC: "Musique" };
  const label = FORMAT_LABEL[season.format] ?? "Extra";
  const s = statusStyle;

  return (
    <div
      className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Label */}
      <span className="font-mono text-[10px] text-violet-400 w-16 flex-shrink-0 truncate">
        {label} {season.number}
      </span>

      {/* Compteur */}
      <span className="font-mono text-[10px] text-violet-300 w-12 flex-shrink-0 text-right tabular-nums">
        {String(season.watchedEpisodes).padStart(2, "0")}
        {season.totalEpisodes != null ? `/${String(season.totalEpisodes).padStart(2, "0")}` : "/?"}
      </span>

      {/* Boutons */}
      {!isAbandoned && (
        <div className="flex gap-1 flex-shrink-0">
          {season.watchedEpisodes > 0 && (
            <button onClick={() => decrementEpisode(entryId, gi)}
              className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95 transition-transform">-1</button>
          )}
          {(season.totalEpisodes == null || season.watchedEpisodes < season.totalEpisodes) && (
            <button onClick={() => incrementEpisode(entryId, gi)}
              className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95 transition-transform">+1</button>
          )}
          {season.totalEpisodes != null && !done && (
            <button onClick={() => setEpisodeCount(entryId, gi, season.totalEpisodes)}
              aria-label="Tout marquer vu"
              className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-300 hover:bg-teal-500/30 active:scale-95 transition-transform flex items-center gap-0.5">
              <CheckCheck size={10} />
            </button>
          )}
        </div>
      )}

      {/* Barre de progression */}
      <div className="flex-1 h-2.5 flex items-center min-w-0">
        {season.totalEpisodes != null ? (
          <ProgressBar
            watched={season.watchedEpisodes} total={season.totalEpisodes}
            colorClass={s.bar} glow={false} color={s.color}
            onChange={isAbandoned ? undefined : (v) => setEpisodeCount(entryId, gi, v)}
          />
        ) : (
          <span className="text-[9px] font-mono text-violet-600">Total inconnu</span>
        )}
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// FilmRow — une ligne Film avec simple checkbox Vu / Pas vu
// ─────────────────────────────────────────────────────────────────────────────
const FilmRow = memo(function FilmRow({ season, entryId, isAbandoned }) {
  const { setEpisodeCount } = useLibrary();
  const gi   = season.globalIndex;
  const seen = season.watchedEpisodes >= (season.totalEpisodes ?? 1);

  return (
    <div
      className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="font-mono text-[10px] text-violet-400 flex-1 truncate">
        Film {season.number}
        {season.totalEpisodes != null && season.totalEpisodes > 1 && (
          <span className="text-violet-600 ml-1">({season.totalEpisodes} éps)</span>
        )}
      </span>
      {!isAbandoned ? (
        <button
          onClick={() => setEpisodeCount(entryId, gi, seen ? 0 : (season.totalEpisodes ?? 1))}
          className={`font-mono text-[10px] px-3 py-0.5 rounded-full border transition-all duration-150 active:scale-95 ${
            seen
              ? "bg-teal-500/20 border-teal-500/40 text-teal-300 hover:bg-teal-500/30"
              : "bg-white/5 border-white/10 text-violet-500 hover:bg-white/10 hover:text-violet-300 hover:border-white/20"
          }`}
        >
          {seen ? "✓ Vu" : "Pas vu"}
        </button>
      ) : (
        <span className={`font-mono text-[10px] ${seen ? "text-teal-400" : "text-violet-600"}`}>
          {seen ? "✓ Vu" : "—"}
        </span>
      )}
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Section TV (tabs + scrubber) — réutilisée dans les deux modes
// ─────────────────────────────────────────────────────────────────────────────
const TVSection = memo(function TVSection({ tvSeasons, activeTVIdx, setActiveTVIdx, entry, statusStyle, isAbandoned, dimmed }) {
  const { incrementEpisode, decrementEpisode, setEpisodeCount } = useLibrary();
  const s         = statusStyle;
  const currentTV = tvSeasons[Math.min(activeTVIdx, Math.max(0, tvSeasons.length - 1))] ?? null;
  const tvDone    = currentTV?.totalEpisodes != null && currentTV.watchedEpisodes >= currentTV.totalEpisodes;
  const hasNextTV = activeTVIdx < tvSeasons.length - 1;

  if (!currentTV) return null;

  return (
    <div className={isAbandoned ? "pointer-events-none" : ""}>
      {/* Onglets */}
      {tvSeasons.length > 1 && (
        <div className="flex items-center gap-1 overflow-x-auto flex-nowrap scrollbar-none mb-1.5" onClick={(e) => e.stopPropagation()}>
          {tvSeasons.map((se, i) => (
            <button key={se.globalIndex} onClick={() => setActiveTVIdx(i)} disabled={isAbandoned}
              className={`px-2 py-1 rounded-md text-[10px] font-mono border whitespace-nowrap flex-shrink-0 transition-colors active:scale-95 motion-reduce:transition-none ${
                i === activeTVIdx
                  ? `${s.border} ${s.text} bg-white/10`
                  : "border-white/10 text-violet-400 hover:bg-white/5"
              }`}>
              S{se.number}
            </button>
          ))}
          {tvDone && hasNextTV && !isAbandoned && (
            <button onClick={(e) => { e.stopPropagation(); setActiveTVIdx(activeTVIdx + 1); }}
              className="flex items-center gap-0.5 text-[10px] text-violet-400 hover:text-violet-200 flex-shrink-0 whitespace-nowrap active:scale-95 transition-transform motion-reduce:transition-none">
              Suiv. <ChevronRight size={11} />
            </button>
          )}
        </div>
      )}

      {/* Scrubber */}
      <div onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <span key={currentTV.watchedEpisodes}
            className={`font-mono text-[11px] text-violet-300 tracking-wider tabular-nums animate-countBounce motion-reduce:animate-none ${dimmed}`}>
            S{currentTV.number} · {String(currentTV.watchedEpisodes).padStart(2, "0")}
            {currentTV.totalEpisodes != null ? `/${String(currentTV.totalEpisodes).padStart(2, "0")}` : ""}
          </span>
          {!isAbandoned && (
            <div className="flex gap-1">
              <button onClick={() => decrementEpisode(entry.id, currentTV.globalIndex)}
                className="font-mono text-[10px] uppercase px-2 py-1 rounded-md bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95 transition-transform motion-reduce:transition-none min-w-[36px] text-center">-1</button>
              {(currentTV.totalEpisodes == null || currentTV.watchedEpisodes < currentTV.totalEpisodes) && (
                <button onClick={() => incrementEpisode(entry.id, currentTV.globalIndex)}
                  className="font-mono text-[10px] uppercase px-2 py-1 rounded-md bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95 transition-transform motion-reduce:transition-none min-w-[36px] text-center">+1</button>
              )}
              {currentTV.totalEpisodes != null && currentTV.watchedEpisodes < currentTV.totalEpisodes && (
                <button onClick={() => setEpisodeCount(entry.id, currentTV.globalIndex, currentTV.totalEpisodes)}
                  aria-label="Tout cocher"
                  className="font-mono text-[10px] uppercase px-2 py-1 rounded-md bg-teal-500/15 text-teal-300 hover:bg-teal-500/30 active:scale-95 transition-transform motion-reduce:transition-none flex items-center gap-1">
                  <CheckCheck size={11} /><span className="hidden sm:inline">tout</span>
                </button>
              )}
            </div>
          )}
        </div>
        <div className="h-3.5 flex items-center">
          {currentTV.totalEpisodes != null ? (
            <ProgressBar watched={currentTV.watchedEpisodes} total={currentTV.totalEpisodes}
              colorClass={s.bar} glow={entry.status === "en-cours"} color={s.color}
              onChange={isAbandoned ? undefined : (v) => setEpisodeCount(entry.id, currentTV.globalIndex, v)}
            />
          ) : (
            <p className={`text-[10px] font-mono text-violet-500 ${dimmed}`}>Total inconnu</p>
          )}
        </div>
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Card principale
// ─────────────────────────────────────────────────────────────────────────────
export const Card = memo(function Card({ entry, onEdit, index = 0 }) {
  const { markDone, deleteEntry, saveEntry } = useLibrary();
  const navigate = useNavigate();
  const location = useLocation();

  const seasons = entry.seasons;

  const tvSeasons    = useMemo(() => seasons.map((s, i) => ({ ...s, globalIndex: i })).filter((s) => getFormatGroup(s.format) === "tv"),    [seasons]);
  const extraSeasons = useMemo(() => seasons.map((s, i) => ({ ...s, globalIndex: i })).filter((s) => getFormatGroup(s.format) === "extra"),  [seasons]);
  const movieSeasons = useMemo(() => seasons.map((s, i) => ({ ...s, globalIndex: i })).filter((s) => getFormatGroup(s.format) === "movie"),  [seasons]);

  // Accordion : activé uniquement si plusieurs formats coexistent
  const hasMultipleFormats = [tvSeasons.length > 0, extraSeasons.length > 0, movieSeasons.length > 0].filter(Boolean).length > 1;

  const [activeTVIdx,      setActiveTVIdx]      = useState(() => {
    const idx = tvSeasons.findIndex((s) => s.totalEpisodes == null || s.watchedEpisodes < s.totalEpisodes);
    return idx === -1 ? Math.max(0, tvSeasons.length - 1) : idx;
  });
  const [openSections,     setOpenSections]     = useState({ tv: true, extra: false, movie: false });
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [nextAiring,       setNextAiring]       = useState(null);
  const cardRef = useRef(null);

  const isAbandoned = entry.status === "abandonne";
  const s      = STATUS[entry.status];
  const dimmed = isAbandoned ? "opacity-50 grayscale" : "";

  const currentTV = tvSeasons[Math.min(activeTVIdx, Math.max(0, tvSeasons.length - 1))] ?? null;

  const { watched: tvWatched,    total: tvTotal    } = useMemo(() => seasonTotals(tvSeasons),    [tvSeasons]);
  const { watched: totalWatched, total: totalAll   } = useMemo(() => seasonTotals(seasons),      [seasons]);
  const { watched: extraWatched, total: extraTotal } = useMemo(() => seasonTotals(extraSeasons), [extraSeasons]);

  const canFinish  = entry.status === "en-cours" && tvTotal != null && tvTotal > 0 && tvWatched >= tvTotal;
  const filmsSeen  = movieSeasons.filter((m) => m.watchedEpisodes >= (m.totalEpisodes ?? 1)).length;

  function toggleSection(key) { setOpenSections((prev) => ({ ...prev, [key]: !prev[key] })); }

  // Animation d'entrée
  useEffect(() => {
    const el = cardRef.current; if (!el) return;
    const delay = Math.min(index * 45, 350);
    el.style.animation = `fadeInUp 0.35s ease-out ${delay}ms both`;
    const t = setTimeout(() => { if (cardRef.current) cardRef.current.style.removeProperty("animation"); }, delay + 380);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  // Prochain épisode
  useEffect(() => {
    if (entry.status === "termine" || entry.status === "abandonne") { setNextAiring(null); return; }
    if (!((entry.source === "anilist" && entry.anilistIds?.length) || (entry.source === "tvmaze" && entry.tvmazeId))) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try { const r = await fetchNextAiring(entry); if (!cancelled) setNextAiring(r); } catch (_) {}
    }, Math.random() * 800);
    return () => { cancelled = true; clearTimeout(t); };
  }, [entry.id, entry.source, entry.status, entry.anilistIds?.length, entry.tvmazeId]);

  // Animation saison TV complète
  const prevRef = useRef({ watched: currentTV?.watchedEpisodes ?? 0, seasonIdx: activeTVIdx });
  useEffect(() => {
    if (!currentTV) return;
    const prev = prevRef.current;
    const justDone = prev.seasonIdx === activeTVIdx && currentTV.totalEpisodes != null &&
      currentTV.watchedEpisodes >= currentTV.totalEpisodes && prev.watched < currentTV.totalEpisodes;
    if (justDone && cardRef.current) {
      const el = cardRef.current;
      el.style.animation = "none"; void el.offsetWidth;
      el.style.animation = "seasonComplete 0.85s cubic-bezier(0.22,0.61,0.36,1) both";
      const t = setTimeout(() => { if (cardRef.current) cardRef.current.style.removeProperty("animation"); }, 950);
      prevRef.current = { watched: currentTV.watchedEpisodes, seasonIdx: activeTVIdx };
      return () => clearTimeout(t);
    }
    prevRef.current = { watched: currentTV?.watchedEpisodes ?? 0, seasonIdx: activeTVIdx };
  }, [currentTV?.watchedEpisodes, currentTV?.totalEpisodes, activeTVIdx]);

  function handleResume(e) { e.stopPropagation(); saveEntry({ ...entry, status: getResumeStatus(entry) }, entry.id); }

  return (
    <>
      <div
        ref={cardRef}
        onClick={() => navigate(`/details/${entry.id}`, { state: { backgroundLocation: location } })}
        className="relative card-noise rounded-2xl bg-violet-900/30 border-t border-r border-b border-white/5 p-3 sm:p-4 flex gap-2 sm:gap-3 transition-all duration-200 ease-out motion-reduce:transition-none cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-950/60 hover:bg-violet-800/40"
      >
        {/* Bordure gauche colorée */}
        <div className="absolute inset-y-0 left-0 w-[3px] rounded-l-2xl"
          style={{ background: `linear-gradient(to bottom, ${s.color}, ${s.color}70, ${s.color}10)` }} />

        {/* Couverture */}
        {(() => {
          const img = currentTV?.coverImage || (activeTVIdx === 0 ? entry.coverImage : null);
          const fb  = tvSeasons[0]?.coverImage || entry.coverImage;
          const sf  = !img && activeTVIdx > 0 && fb;
          return img ? (
            <div className={`flex-shrink-0 aspect-[2/3] max-h-36 self-start rounded-lg overflow-hidden bg-white/5 ${dimmed}`}>
              <img src={img} alt="" className="w-full h-full object-cover" />
            </div>
          ) : sf ? (
            <div className={`relative flex-shrink-0 aspect-[2/3] max-h-36 self-start rounded-lg overflow-hidden bg-white/5 ${dimmed}`}>
              <img src={fb} alt="" className="w-full h-full object-cover brightness-[0.25]" />
              <span className="absolute inset-0 flex items-center justify-center text-5xl font-bold text-white/50">?</span>
            </div>
          ) : null;
        })()}

        {/* Contenu principal */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5 sm:gap-2 relative z-10">

          {/* En-tête : type + statut + titre + boutons */}
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-violet-300 whitespace-nowrap ${dimmed}`}>
                  {entry.type === "anime" ? <Film size={10} /> : <Tv size={10} />}
                  {entry.type === "anime" ? "Anime" : "Série"}
                </span>
                <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/5 whitespace-nowrap ${s.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                  {s.label}
                </span>
              </div>
              <h3 className={`font-semibold text-sm sm:text-base text-violet-50 leading-tight truncate ${dimmed}`}
                style={{ fontFamily: "'Space Grotesk', sans-serif" }} title={entry.title}>
                {entry.title}
              </h3>
              {nextAiring && (() => {
                const cd = formatCountdown(nextAiring.airingAt); if (!cd) return null;
                return (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-sky-300 mt-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse flex-shrink-0" />
                    {nextAiring.season ? `S${nextAiring.season} · ` : ""}Ép.{nextAiring.episode}
                    <span className="hidden sm:inline">{cd}</span>
                  </span>
                );
              })()}
            </div>
            <div className="flex gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => onEdit(entry)} aria-label="Modifier"
                className="p-2 rounded-lg text-violet-300 hover:bg-white/10 hover:text-violet-50 active:scale-95 transition-transform motion-reduce:transition-none">
                <Pencil size={13} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setShowDeleteWarning(true); }} aria-label="Supprimer"
                className="p-2 rounded-lg text-violet-300 hover:bg-rose-500/20 hover:text-rose-300 active:scale-95 transition-transform motion-reduce:transition-none">
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Genres */}
          {entry.genres.length > 0 && (
            <div className={`flex gap-1 overflow-hidden ${dimmed}`}>
              {entry.genres.slice(0, 3).map((g) => (
                <span key={g} className="px-1.5 py-0.5 rounded-full bg-white/5 text-[10px] text-violet-300 whitespace-nowrap">{g}</span>
              ))}
              {entry.genres.length > 3 && (
                <span className="px-1.5 py-0.5 rounded-full bg-white/5 text-[10px] text-violet-500 whitespace-nowrap">+{entry.genres.length - 3}</span>
              )}
            </div>
          )}

          {/* ── MODE ACCORDION (plusieurs formats) ── */}
          {hasMultipleFormats ? (
            <div className={`flex flex-col gap-1 ${isAbandoned ? dimmed : ""}`} onClick={(e) => e.stopPropagation()}>

              {/* Section Saisons TV */}
              {tvSeasons.length > 0 && (
                <div className="rounded-lg bg-white/[0.03] border border-white/5 px-2.5 pt-1 pb-1.5">
                  <AccordionHeader
                    icon="📺" label="Saisons" count={tvSeasons.length}
                    summary={`${tvWatched}${tvTotal != null ? `/${tvTotal}` : ""} ép.`}
                    isOpen={openSections.tv} onToggle={() => toggleSection("tv")}
                  />
                  {openSections.tv && (
                    <div className="mt-1.5 pt-1 border-t border-white/5">
                      <TVSection
                        tvSeasons={tvSeasons} activeTVIdx={activeTVIdx} setActiveTVIdx={setActiveTVIdx}
                        entry={entry} statusStyle={s} isAbandoned={isAbandoned} dimmed={dimmed}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Section OVA / ONA */}
              {extraSeasons.length > 0 && (
                <div className="rounded-lg bg-white/[0.03] border border-white/5 px-2.5 pt-1 pb-1">
                  <AccordionHeader
                    icon="📼" label="OVA / ONA" count={extraSeasons.length}
                    summary={`${extraWatched}${extraTotal != null ? `/${extraTotal}` : ""} ép.`}
                    isOpen={openSections.extra} onToggle={() => toggleSection("extra")}
                  />
                  {openSections.extra && (
                    <div className="mt-0.5 pt-0.5 border-t border-white/5">
                      {extraSeasons.map((se) => (
                        <OvaRow key={se.globalIndex} season={se} entryId={entry.id} statusStyle={s} isAbandoned={isAbandoned} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Section Films */}
              {movieSeasons.length > 0 && (
                <div className="rounded-lg bg-white/[0.03] border border-white/5 px-2.5 pt-1 pb-1">
                  <AccordionHeader
                    icon="🎬" label="Films" count={movieSeasons.length}
                    summary={`${filmsSeen}/${movieSeasons.length} vu`}
                    isOpen={openSections.movie} onToggle={() => toggleSection("movie")}
                  />
                  {openSections.movie && (
                    <div className="mt-0.5 pt-0.5 border-t border-white/5">
                      {movieSeasons.map((se) => (
                        <FilmRow key={se.globalIndex} season={se} entryId={entry.id} isAbandoned={isAbandoned} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Total global */}
              <p className={`text-[10px] font-mono text-violet-600 px-0.5`}>
                {totalWatched}{totalAll != null ? `/${totalAll}` : ""} éps au total
              </p>
            </div>
          ) : (
            // ── MODE SIMPLE (TV uniquement) ──
            <div className={isAbandoned ? "pointer-events-none " + dimmed : ""}>
              <TVSection
                tvSeasons={tvSeasons} activeTVIdx={activeTVIdx} setActiveTVIdx={setActiveTVIdx}
                entry={entry} statusStyle={s} isAbandoned={isAbandoned} dimmed={dimmed}
              />
            </div>
          )}

          {/* Bouton "Série principale terminée" */}
          {canFinish && !isAbandoned && (
            <button
              onClick={(e) => { e.stopPropagation(); markDone(entry.id); }}
              className="flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg bg-teal-400/15 text-teal-300 hover:bg-teal-400/25 active:scale-95 transition-transform motion-reduce:transition-none"
            >
              <Check size={13} /> Série principale terminée
            </button>
          )}
        </div>

        {/* Note */}
        <div className={`flex flex-col items-center justify-center gap-0.5 pl-2 sm:pl-3 border-l border-white/5 min-w-[40px] sm:min-w-[48px] relative z-10 flex-shrink-0 ${dimmed}`}>
          <p className="font-mono text-[9px] uppercase tracking-widest text-violet-400 hidden sm:block">Note</p>
          <div className="flex items-center gap-0.5">
            <span className="text-lg sm:text-xl font-bold text-violet-50" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {entry.rating || "—"}
            </span>
            {entry.rating > 0 && <Star size={13} fill="#fbbf24" strokeWidth={0} />}
          </div>
          {getRatingEmoji(entry.rating) && <span className="text-xl sm:text-2xl">{getRatingEmoji(entry.rating)}</span>}
        </div>

        {/* Overlay Reprendre ? */}
        {isAbandoned && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl pointer-events-none">
            <button onClick={handleResume}
              className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-900/95 border border-violet-500/40 text-violet-100 text-sm font-semibold hover:bg-violet-700/95 hover:border-violet-400/60 active:scale-95 transition-all duration-150 motion-reduce:transition-none shadow-xl shadow-violet-950/60 animate-fadeIn">
              <RotateCcw size={14} className="text-rose-400" /> Reprendre ?
            </button>
          </div>
        )}
      </div>

      {showDeleteWarning && (
        <ConfirmDialog
          icon={<Trash2 size={14} className="text-rose-400" />}
          title="Supprimer ce titre ?"
          description={
            <><span className="text-violet-50 font-medium">« {entry.title} »</span> et toute sa progression seront supprimés définitivement.</>
          }
          confirmLabel="Supprimer"
          onConfirm={() => { deleteEntry(entry.id); setShowDeleteWarning(false); }}
          onCancel={() => setShowDeleteWarning(false)}
        />
      )}
    </>
  );
});
