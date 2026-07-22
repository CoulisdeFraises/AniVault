import { memo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Trash2, Film, Tv, Check, CheckCheck, ChevronRight, Star } from "lucide-react";
import "./Card.css";
import { ProgressBar } from "./ProgressBar";
import { ConfirmDialog } from "../Modal/Modal";
import { getRatingEmoji } from "../common/Rating";
import { STATUS, seasonTotals, formatCountdown } from "../../utils/status";
import { useLibrary } from "../../context/LibraryContext";
import { fetchNextAiring } from "../../api";

export const Card = memo(function Card({ entry, onEdit }) {
  const { incrementEpisode, decrementEpisode, setEpisodeCount, markDone, deleteEntry } = useLibrary();
  const navigate = useNavigate();

  const seasons = entry.seasons;
  const [activeSeason, setActiveSeason] = useState(() => {
    const idx = seasons.findIndex((s) => s.totalEpisodes == null || s.watchedEpisodes < s.totalEpisodes);
    return idx === -1 ? seasons.length - 1 : idx;
  });
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [nextAiring,        setNextAiring]        = useState(null);
  const [celebrating,       setCelebrating]       = useState(false);

  const s = STATUS[entry.status];

  // ── Next airing ──
  useEffect(() => {
    if (entry.status === "termine" || entry.status === "abandonne") { setNextAiring(null); return; }
    if (!((entry.source === "anilist" && entry.anilistIds?.length) || (entry.source === "tvmaze" && entry.tvmazeId))) return;
    let cancelled = false;
    const jitter = Math.random() * 800;
    const t = setTimeout(async () => {
      try {
        const result = await fetchNextAiring(entry);
        if (!cancelled) setNextAiring(result);
      } catch (_) {}
    }, jitter);
    return () => { cancelled = true; clearTimeout(t); };
  }, [entry.id, entry.source, entry.status, entry.anilistIds?.length, entry.tvmazeId]);

  const current = seasons[Math.min(activeSeason, seasons.length - 1)];
  const { watched: totalWatched, total: totalAll } = seasonTotals(seasons);
  const canFinish  = entry.status === "en-cours" && totalAll != null && totalAll > 0 && totalWatched >= totalAll;
  const seasonDone = current.totalEpisodes != null && current.watchedEpisodes >= current.totalEpisodes;
  const hasNext    = activeSeason < seasons.length - 1;

  // ── Détection complétion de saison → animation ──
  const prevRef = useRef({ watched: current.watchedEpisodes, seasonIdx: activeSeason });

  useEffect(() => {
    const prev = prevRef.current;
    const justCompleted =
      prev.seasonIdx === activeSeason &&           // même saison (pas un simple changement d'onglet)
      current.totalEpisodes != null &&             // total connu
      current.watchedEpisodes >= current.totalEpisodes && // maintenant complète
      prev.watched < current.totalEpisodes;        // avant elle ne l'était pas

    if (justCompleted) {
      setCelebrating(false);
      // Force un re-trigger si on déclenche deux fois de suite la même saison
      requestAnimationFrame(() => setCelebrating(true));
      const t = setTimeout(() => setCelebrating(false), 900);
      prevRef.current = { watched: current.watchedEpisodes, seasonIdx: activeSeason };
      return () => clearTimeout(t);
    }

    prevRef.current = { watched: current.watchedEpisodes, seasonIdx: activeSeason };
  }, [current.watchedEpisodes, current.totalEpisodes, activeSeason]);

  return (
    <>
      <div
        onClick={() => navigate(`/details/${entry.id}`)}
        className={`rounded-2xl bg-violet-900/30 border-l-4 ${s.border} border-t border-r border-b border-white/5 p-4 flex gap-3 transition-colors duration-200 hover:bg-violet-800/40 hover:border-white/10 cursor-pointer${celebrating ? " card-season-complete" : ""}`}
      >
        {(() => {
          const displayImage = current?.coverImage || (activeSeason === 0 ? entry.coverImage : null);
          const fallbackImage = entry.seasons[0]?.coverImage || entry.coverImage;
          const showFallback = !displayImage && activeSeason > 0 && fallbackImage;
          return displayImage ? (
            <div className="self-stretch aspect-[2/3] flex-shrink-0 rounded-lg overflow-hidden bg-white/5">
              <img src={displayImage} alt="" className="w-full h-full object-cover" />
            </div>
          ) : showFallback ? (
            <div className="relative self-stretch aspect-[2/3] flex-shrink-0 rounded-lg overflow-hidden bg-white/5">
              <img src={fallbackImage} alt="" className="w-full h-full object-cover brightness-[0.25]" />
              <span className="absolute inset-0 flex items-center justify-center text-5xl font-bold text-white/50">?</span>
            </div>
          ) : null;
        })()}

        <div className="flex-1 min-w-0 flex flex-col gap-3">

          {/* ── Titre + boutons ── */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-violet-300">
                  {entry.type === "anime" ? <Film size={11} /> : <Tv size={11} />}
                  {entry.type === "anime" ? "Anime" : "Série"}
                </span>
                <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest ${s.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                  {s.label}
                </span>
                {nextAiring && (() => {
                  const countdown = formatCountdown(nextAiring.airingAt);
                  if (!countdown) return null;
                  return (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-sky-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse" />
                      {nextAiring.season ? `S${nextAiring.season} · ` : ""}Ép.{nextAiring.episode} {countdown}
                    </span>
                  );
                })()}
              </div>
              <h3
                className="font-semibold text-violet-50 leading-tight truncate"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                title={entry.title}
              >
                {entry.title}
              </h3>
            </div>
            <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onEdit(entry)}
                aria-label="Modifier"
                className="p-1.5 rounded-lg text-violet-300 hover:bg-white/10 hover:text-violet-50"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setShowDeleteWarning(true); }}
                aria-label="Supprimer"
                className="p-1.5 rounded-lg text-violet-300 hover:bg-rose-500/20 hover:text-rose-300"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* ── Genres ── */}
          {entry.genres.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {entry.genres.map((g) => (
                <span key={g} className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-violet-300">{g}</span>
              ))}
            </div>
          )}

          {/* ── Onglets saisons ── */}
          <div
            className="flex items-center gap-1 overflow-x-auto flex-nowrap pb-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            {seasons.map((se, i) => (
              <button
                key={se.number}
                onClick={() => setActiveSeason(i)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono border whitespace-nowrap flex-shrink-0 ${
                  i === activeSeason
                    ? `${s.border} ${s.text} bg-white/10`
                    : "border-white/10 text-violet-400 hover:bg-white/5"
                }`}
              >
                S{se.number}
              </button>
            ))}
            {seasonDone && hasNext && (
              <button
                onClick={() => setActiveSeason(activeSeason + 1)}
                className="flex items-center gap-0.5 text-[10px] text-violet-400 hover:text-violet-200 flex-shrink-0 whitespace-nowrap"
              >
                Saison suiv. <ChevronRight size={11} />
              </button>
            )}
          </div>

          {/* ── Progression épisodes ── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[11px] text-violet-300 tracking-wider">
                S{current.number} · ÉP. {String(current.watchedEpisodes).padStart(2, "0")}
                {current.totalEpisodes != null ? ` / ${String(current.totalEpisodes).padStart(2, "0")}` : ""}
              </span>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => decrementEpisode(entry.id, activeSeason)}
                  className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-md bg-white/10 text-violet-200 hover:bg-white/20"
                >
                  -1 ép.
                </button>
                {(current.totalEpisodes == null || current.watchedEpisodes < current.totalEpisodes) && (
                  <button
                    onClick={() => incrementEpisode(entry.id, activeSeason)}
                    className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-md bg-white/10 text-violet-200 hover:bg-white/20"
                  >
                    +1 ép.
                  </button>
                )}
                {current.totalEpisodes != null && current.watchedEpisodes < current.totalEpisodes && (
                  <button
                    onClick={() => setEpisodeCount(entry.id, activeSeason, current.totalEpisodes)}
                    aria-label="Tout cocher"
                    title={`Cocher tous les épisodes (${current.totalEpisodes})`}
                    className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-md bg-teal-500/15 text-teal-300 hover:bg-teal-500/30 flex items-center gap-1"
                  >
                    <CheckCheck size={11} /> tout
                  </button>
                )}
              </div>
            </div>
            <div className="h-4 flex items-center">
              {current.totalEpisodes != null ? (
                <ProgressBar
                  watched={current.watchedEpisodes}
                  total={current.totalEpisodes}
                  colorClass={s.bar}
                  glow={entry.status === "en-cours"}
                  color={s.color}
                  onChange={(v) => setEpisodeCount(entry.id, activeSeason, v)}
                />
              ) : (
                <p className="text-[10px] font-mono text-violet-500">Total inconnu — suivi libre</p>
              )}
            </div>
            {seasons.length > 1 && (
              <p className="text-[10px] font-mono text-violet-500 mt-1">
                Total : {totalWatched}{totalAll != null ? `/${totalAll}` : ""} épisodes vus
              </p>
            )}
          </div>

          {/* ── Bouton terminer ── */}
          {canFinish && (
            <button
              onClick={(e) => { e.stopPropagation(); markDone(entry.id); }}
              className="flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg bg-teal-400/15 text-teal-300 hover:bg-teal-400/25"
            >
              <Check size={13} /> Marquer comme terminé
            </button>
          )}
        </div>

        {/* ── Note ── */}
        <div className="flex flex-col items-center justify-center gap-1 pl-3 border-l border-white/5 min-w-[48px]">
          <p className="font-mono text-[9px] uppercase tracking-widest text-violet-400">Ma note</p>
          <div className="flex items-center gap-1">
            <span className="text-xl font-bold text-violet-50" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {entry.rating || "—"}
            </span>
            {entry.rating > 0 && <Star size={16} fill="#fbbf24" strokeWidth={0} />}
          </div>
          {getRatingEmoji(entry.rating) && (
            <span className="text-2xl">{getRatingEmoji(entry.rating)}</span>
          )}
        </div>

        {entry.notes && (
          <p className="text-xs text-violet-300/80 italic line-clamp-2">{entry.notes}</p>
        )}
      </div>

      {/* ── Confirmation suppression titre ── */}
      {showDeleteWarning && (
        <ConfirmDialog
          icon={<Trash2 size={14} className="text-rose-400" />}
          title="Supprimer ce titre ?"
          description={
            <>
              <span className="text-violet-50 font-medium">« {entry.title} »</span> et toute sa progression seront supprimés définitivement.
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