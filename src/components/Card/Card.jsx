import { memo, useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Pencil, Trash2, Film, Tv, Check, CheckCheck, ChevronRight, Star, RotateCcw } from "lucide-react";
import "./Card.css";
import { ProgressBar }   from "./ProgressBar";
import { ConfirmDialog } from "../Modal/Modal";
import { getRatingEmoji } from "../common/Rating";
import { STATUS, seasonTotals, formatCountdown } from "../../utils/status";
import { CATEGORY_LABELS, CATEGORY_ICONS } from "../../utils/entry";
import { useLibrary } from "../../context/LibraryContext";
import { fetchNextAiring } from "../../api";

// ── Calcule le statut à restaurer en fonction des épisodes vus ───────────────
function getResumeStatus(entry) {
  const { watched, total } = seasonTotals(entry.seasons);
  if (total != null && total > 0 && watched >= total) return "termine";
  if (watched > 0) return "en-cours";
  return "a-voir";
}

export const Card = memo(function Card({ entry, onEdit, index = 0 }) {
  const {
    incrementEpisode, decrementEpisode, setEpisodeCount,
    markDone, deleteEntry, saveEntry,
  } = useLibrary();
  const navigate = useNavigate();
  const location = useLocation();

  const seasons = entry.seasons;
  const [activeSeason,      setActiveSeason]      = useState(() => {
    const idx = seasons.findIndex((s) => s.totalEpisodes == null || s.watchedEpisodes < s.totalEpisodes);
    return idx === -1 ? seasons.length - 1 : idx;
  });
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [nextAiring,        setNextAiring]        = useState(null);
  const cardRef = useRef(null);

  const isAbandoned = entry.status === "abandonne";
  const s = STATUS[entry.status];

  // ── Animation d'entrée ───────────────────────────────────────────────────
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const delay = Math.min(index * 45, 350);
    el.style.animation = `fadeInUp 0.35s ease-out ${delay}ms both`;
    const t = setTimeout(() => {
      if (cardRef.current) cardRef.current.style.removeProperty("animation");
    }, delay + 380);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Prochain épisode ─────────────────────────────────────────────────────
  useEffect(() => {
    if (entry.status === "termine" || entry.status === "abandonne") { setNextAiring(null); return; }
    if (!((entry.source === "anilist" && entry.anilistIds?.length) || (entry.source === "tvmaze" && entry.tvmazeId))) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const result = await fetchNextAiring(entry);
        if (!cancelled) setNextAiring(result);
      } catch (_) {}
    }, Math.random() * 800);
    return () => { cancelled = true; clearTimeout(t); };
  }, [entry.id, entry.source, entry.status, entry.anilistIds?.length, entry.tvmazeId]);

  const current   = seasons[Math.min(activeSeason, seasons.length - 1)];
  const { watched: totalWatched, total: totalAll } = seasonTotals(seasons);
  const canFinish = entry.status === "en-cours" && totalAll != null && totalAll > 0 && totalWatched >= totalAll;
  const seasonDone = current.totalEpisodes != null && current.watchedEpisodes >= current.totalEpisodes;
  const hasNext    = activeSeason < seasons.length - 1;
  const showCategoryBadge = entry.type === "anime" && entry.category && entry.category !== "tv";

  // ── Animation saison complète ────────────────────────────────────────────
  const prevRef = useRef({ watched: current.watchedEpisodes, seasonIdx: activeSeason });
  useEffect(() => {
    const prev = prevRef.current;
    const justCompleted =
      prev.seasonIdx === activeSeason &&
      current.totalEpisodes != null &&
      current.watchedEpisodes >= current.totalEpisodes &&
      prev.watched < current.totalEpisodes;

    if (justCompleted && cardRef.current) {
      const el = cardRef.current;
      el.style.animation = "none";
      void el.offsetWidth;
      el.style.animation = "seasonComplete 0.85s cubic-bezier(0.22, 0.61, 0.36, 1) both";
      const t = setTimeout(() => {
        if (cardRef.current) cardRef.current.style.removeProperty("animation");
      }, 950);
      prevRef.current = { watched: current.watchedEpisodes, seasonIdx: activeSeason };
      return () => clearTimeout(t);
    }
    prevRef.current = { watched: current.watchedEpisodes, seasonIdx: activeSeason };
  }, [current.watchedEpisodes, current.totalEpisodes, activeSeason]);

  // ── Reprendre : restaure le statut calculé depuis les épisodes vus ───────
  function handleResume(e) {
    e.stopPropagation();
    const newStatus = getResumeStatus(entry);
    saveEntry({ ...entry, status: newStatus }, entry.id);
  }

  return (
    <>
      <div
        ref={cardRef}
        onClick={() => navigate(`/details/${entry.id}`, { state: { backgroundLocation: location } })}
        className={`
          relative card-noise rounded-2xl bg-violet-900/30
          border-t border-r border-b border-white/5
          transition-all duration-200 ease-out motion-reduce:transition-none
          cursor-pointer
          ${isAbandoned
            ? "opacity-70"
            : "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-950/60 hover:bg-violet-800/40"
          }
        `}
      >
        {/* ── Contenu grisé quand abandonné ────────────────────────────────── */}
        <div className={`p-3 sm:p-4 flex gap-2 sm:gap-3 ${isAbandoned ? "grayscale" : ""}`}>

          {/* ── Bordure gauche colorée selon statut ── */}
          <div
            className="absolute inset-y-0 left-0 w-[3px] rounded-l-2xl"
            style={{ background: `linear-gradient(to bottom, ${s.color}, ${s.color}70, ${s.color}10)` }}
          />

          {/* ── Image ratio 2:3 ── */}
          {(() => {
            const displayImage  = current?.coverImage || (activeSeason === 0 ? entry.coverImage : null);
            const fallbackImage = entry.seasons[0]?.coverImage || entry.coverImage;
            const showFallback  = !displayImage && activeSeason > 0 && fallbackImage;
            return displayImage ? (
              <div className="flex-shrink-0 aspect-[2/3] max-h-36 self-start rounded-lg overflow-hidden bg-white/5">
                <img src={displayImage} alt="" className="w-full h-full object-cover" />
              </div>
            ) : showFallback ? (
              <div className="relative flex-shrink-0 aspect-[2/3] max-h-36 self-start rounded-lg overflow-hidden bg-white/5">
                <img src={fallbackImage} alt="" className="w-full h-full object-cover brightness-[0.25]" />
                <span className="absolute inset-0 flex items-center justify-center text-5xl font-bold text-white/50">?</span>
              </div>
            ) : null;
          })()}

          {/* ── Contenu principal ── */}
          {/*
            pointer-events-none sur tout le contenu quand abandonné.
            Les boutons edit/delete overrident avec pointer-events-auto.
            pointer-events:none sur un parent n'empêche PAS un enfant
            pointer-events:auto de recevoir des clics → pattern standard CSS.
          */}
          <div className={`flex-1 min-w-0 flex flex-col gap-1.5 sm:gap-2 relative z-10 ${isAbandoned ? "pointer-events-none" : ""}`}>

            {/* ── Titre + boutons edit/delete ── */}
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0 flex-1">

                {/* Ligne 1 : type + catégorie + statut */}
                <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-violet-300 whitespace-nowrap">
                    {entry.type === "anime" ? <Film size={10} /> : <Tv size={10} />}
                    {entry.type === "anime" ? "Anime" : "Série"}
                  </span>

                  {showCategoryBadge && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-violet-700/40 text-violet-300 whitespace-nowrap border border-violet-600/30">
                      {CATEGORY_ICONS[entry.category]} {CATEGORY_LABELS[entry.category]}
                    </span>
                  )}

                  <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/5 whitespace-nowrap ${s.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${s.dot} ${entry.status === "en-cours" ? "animate-pulse" : ""}`} />
                    {s.label}
                  </span>
                </div>

                {/* Titre */}
                <h3
                  className="font-semibold text-sm sm:text-base text-violet-50 leading-tight truncate"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                  title={entry.title}
                >
                  {entry.title}
                </h3>

                {/* Countdown prochain épisode */}
                {nextAiring && (() => {
                  const countdown = formatCountdown(nextAiring.airingAt);
                  if (!countdown) return null;
                  return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-sky-300 mt-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse flex-shrink-0" />
                      {nextAiring.season ? `S${nextAiring.season} · ` : ""}Ép.{nextAiring.episode}
                      <span className="hidden sm:inline">{countdown}</span>
                    </span>
                  );
                })()}
              </div>

              {/* ── Boutons edit / delete ─────────────────────────────────────
                  pointer-events-auto explicite pour réactiver même quand le
                  parent a pointer-events-none (cartes abandonnées).
              ─────────────────────────────────────────────────────────────── */}
              <div
                className="flex gap-0.5 shrink-0 pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => onEdit(entry)}
                  aria-label="Modifier"
                  className="p-2 rounded-lg text-violet-300 hover:bg-white/10 hover:text-violet-50 active:scale-95 transition-transform motion-reduce:transition-none"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDeleteWarning(true); }}
                  aria-label="Supprimer"
                  className="p-2 rounded-lg text-violet-300 hover:bg-rose-500/20 hover:text-rose-300 active:scale-95 transition-transform motion-reduce:transition-none"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* ── Genres ── */}
            {entry.genres.length > 0 && (
              <div className="flex gap-1 overflow-hidden">
                {entry.genres.slice(0, 3).map((g) => (
                  <span key={g} className="px-1.5 py-0.5 rounded-full bg-white/5 text-[10px] text-violet-300 whitespace-nowrap">{g}</span>
                ))}
                {entry.genres.length > 3 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-white/5 text-[10px] text-violet-500 whitespace-nowrap">+{entry.genres.length - 3}</span>
                )}
              </div>
            )}

            {/* ── Onglets saisons (désactivés si abandonné) ── */}
            <div
              className="flex items-center gap-1 overflow-x-auto flex-nowrap scrollbar-none"
              onClick={(e) => e.stopPropagation()}
            >
              {seasons.map((se, i) => (
                <button
                  key={se.number}
                  onClick={() => setActiveSeason(i)}
                  disabled={isAbandoned}
                  className={`px-2 py-1 rounded-md text-[10px] font-mono border whitespace-nowrap flex-shrink-0 transition-colors active:scale-95 motion-reduce:transition-none ${
                    i === activeSeason
                      ? `${s.border} ${s.text} bg-white/10`
                      : "border-white/10 text-violet-400 hover:bg-white/5"
                  } ${isAbandoned ? "cursor-not-allowed" : ""}`}
                >
                  S{se.number}
                </button>
              ))}
              {seasonDone && hasNext && !isAbandoned && (
                <button
                  onClick={() => setActiveSeason(activeSeason + 1)}
                  className="flex items-center gap-0.5 text-[10px] text-violet-400 hover:text-violet-200 flex-shrink-0 whitespace-nowrap active:scale-95 transition-transform motion-reduce:transition-none"
                >
                  Suiv. <ChevronRight size={11} />
                </button>
              )}
            </div>

            {/* ── Progression épisodes ── */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span
                  key={current.watchedEpisodes}
                  className="font-mono text-[11px] text-violet-300 tracking-wider animate-countBounce motion-reduce:animate-none"
                >
                  S{current.number} · {String(current.watchedEpisodes).padStart(2, "0")}
                  {current.totalEpisodes != null ? `/${String(current.totalEpisodes).padStart(2, "0")}` : ""}
                </span>

                {/* Boutons +1 / -1 / tout — désactivés si abandonné */}
                {!isAbandoned && (
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => decrementEpisode(entry.id, activeSeason)}
                      className="font-mono text-[10px] uppercase px-2 py-1 rounded-md bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95 transition-transform motion-reduce:transition-none min-w-[36px] text-center"
                    >
                      -1
                    </button>
                    {(current.totalEpisodes == null || current.watchedEpisodes < current.totalEpisodes) && (
                      <button
                        onClick={() => incrementEpisode(entry.id, activeSeason)}
                        className="font-mono text-[10px] uppercase px-2 py-1 rounded-md bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95 transition-transform motion-reduce:transition-none min-w-[36px] text-center"
                      >
                        +1
                      </button>
                    )}
                    {current.totalEpisodes != null && current.watchedEpisodes < current.totalEpisodes && (
                      <button
                        onClick={() => setEpisodeCount(entry.id, activeSeason, current.totalEpisodes)}
                        aria-label="Tout cocher"
                        className="font-mono text-[10px] uppercase px-2 py-1 rounded-md bg-teal-500/15 text-teal-300 hover:bg-teal-500/30 active:scale-95 transition-transform motion-reduce:transition-none flex items-center gap-1"
                      >
                        <CheckCheck size={11} />
                        <span className="hidden sm:inline">tout</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="h-3.5 flex items-center">
                {current.totalEpisodes != null ? (
                  <ProgressBar
                    watched={current.watchedEpisodes}
                    total={current.totalEpisodes}
                    colorClass={s.bar}
                    glow={entry.status === "en-cours"}
                    color={s.color}
                    /* Le scrubber est désactivé via pointer-events-none du parent */
                    onChange={isAbandoned ? undefined : (v) => setEpisodeCount(entry.id, activeSeason, v)}
                  />
                ) : (
                  <p className="text-[10px] font-mono text-violet-500">Total inconnu</p>
                )}
              </div>

              {seasons.length > 1 && (
                <p className="text-[10px] font-mono text-violet-500 mt-0.5">
                  {totalWatched}{totalAll != null ? `/${totalAll}` : ""} éps vus
                </p>
              )}
            </div>

            {/* ── Bouton terminer (masqué si abandonné) ── */}
            {canFinish && !isAbandoned && (
              <button
                onClick={(e) => { e.stopPropagation(); markDone(entry.id); }}
                className="flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg bg-teal-400/15 text-teal-300 hover:bg-teal-400/25 active:scale-95 transition-transform motion-reduce:transition-none"
              >
                <Check size={13} /> Terminé
              </button>
            )}
          </div>

          {/* ── Note ── */}
          <div className={`flex flex-col items-center justify-center gap-0.5 pl-2 sm:pl-3 border-l border-white/5 min-w-[40px] sm:min-w-[48px] relative z-10 flex-shrink-0 ${isAbandoned ? "pointer-events-none" : ""}`}>
            <p className="font-mono text-[9px] uppercase tracking-widest text-violet-400 hidden sm:block">Note</p>
            <div className="flex items-center gap-0.5">
              <span className="text-lg sm:text-xl font-bold text-violet-50" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {entry.rating || "—"}
              </span>
              {entry.rating > 0 && <Star size={13} fill="#fbbf24" strokeWidth={0} />}
            </div>
            {getRatingEmoji(entry.rating) && (
              <span className="text-xl sm:text-2xl">{getRatingEmoji(entry.rating)}</span>
            )}
          </div>
        </div>{/* fin du div grisé */}

        {/* ── Overlay + bouton "Reprendre ?" ───────────────────────────────────
            z-20 pour passer au-dessus du contenu grisé.
            pointer-events-none sur le fond pour laisser passer le clic carte
            (ouverture du détail). Le bouton lui-même a pointer-events-auto.
        ─────────────────────────────────────────────────────────────────────── */}
        {isAbandoned && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl pointer-events-none">
            <button
              onClick={handleResume}
              className="
                pointer-events-auto
                flex items-center gap-2 px-4 py-2 rounded-xl
                bg-violet-900/95 border border-violet-500/40
                text-violet-100 text-sm font-semibold
                hover:bg-violet-700/95 hover:border-violet-400/60
                active:scale-95 transition-all duration-150 motion-reduce:transition-none
                shadow-xl shadow-violet-950/60
                animate-fadeIn
              "
            >
              <RotateCcw size={14} className="text-amber-300" />
              Reprendre ?
            </button>
          </div>
        )}
      </div>

      {showDeleteWarning && (
        <ConfirmDialog
          icon={<Trash2 size={14} className="text-rose-400" />}
          title="Supprimer ce titre ?"
          description={
            <>
              <span className="text-violet-50 font-medium">« {entry.title} »</span> et toute sa progression seront
              supprimés définitivement.
            </>
          }
          confirmLabel="Supprimer"
          onConfirm={() => { deleteEntry(entry.id); setShowDeleteWarning(false); }}
          onCancel={() => setShowDeleteWarning(false)}
        />
      )}
    </>
  );
});
