import { memo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, X, Pencil, Trash2, Film, Tv, Check, ChevronRight, Loader2, Star } from "lucide-react";
import "./Card.css";
import { ProgressBar } from "./ProgressBar";
import { ConfirmDialog } from "../Modal/Modal";
import { getRatingEmoji } from "../common/Rating";
import { STATUS, seasonTotals, formatCountdown } from "../../utils/status";
import { useLibrary } from "../../context/LibraryContext";
import { fetchNextAiring, findNextSeason } from "../../api";

export const Card = memo(function Card({ entry, onEdit }) {
  const { incrementEpisode, decrementEpisode, setEpisodeCount, markDone, addSeason, deleteSeason, deleteEntry } = useLibrary();
  const navigate = useNavigate();

  const seasons = entry.seasons;
  const [activeSeason, setActiveSeason] = useState(() => {
    const idx = seasons.findIndex((s) => s.totalEpisodes == null || s.watchedEpisodes < s.totalEpisodes);
    return idx === -1 ? seasons.length - 1 : idx;
  });
  const [seasonToDelete, setSeasonToDelete] = useState(null);
  const [noSeasonWarning, setNoSeasonWarning] = useState(false);
  const [checkingNextSeason, setCheckingNextSeason] = useState(false);
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [nextAiring, setNextAiring] = useState(null);
  const s = STATUS[entry.status];

  useEffect(() => {
    if (entry.status === "termine" || entry.status === "abandonne") { setNextAiring(null); return; }
    if (!((entry.source === "anilist" && entry.anilistIds?.length) || (entry.source === "tvmaze" && entry.tvmazeId))) return;
    let cancelled = false;
    // Petit délai aléatoire pour étaler les appels quand beaucoup de cartes montent en même temps.
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
  const canFinish = entry.status === "en-cours" && totalAll != null && totalAll > 0 && totalWatched >= totalAll;
  const seasonDone = current.totalEpisodes != null && current.watchedEpisodes >= current.totalEpisodes;
  const hasNext = activeSeason < seasons.length - 1;

  async function handleAddSeason() {
    setCheckingNextSeason(true);
    try {
      const next = await findNextSeason(entry);
      if (next) {
        addSeason(entry.id, next);
        setActiveSeason(seasons.length);
      } else if (entry.source === "anilist" || entry.source === "tvmaze") {
        setNoSeasonWarning(true);
      } else {
        addSeason(entry.id);
        setActiveSeason(seasons.length);
      }
    } finally {
      setCheckingNextSeason(false);
    }
  }

  return (
    <>
      <div onClick={() => navigate(`/details/${entry.id}`)} className={`rounded-2xl bg-violet-900/30 border-l-4 ${s.border} border-t border-r border-b border-white/5 p-4 flex gap-3 transition-colors duration-200 hover:bg-violet-800/40 hover:border-white/10 cursor-pointer`}>
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
              <h3 className="font-semibold text-violet-50 leading-tight truncate" style={{ fontFamily: "'Space Grotesk', sans-serif" }} title={entry.title}>
                {entry.title}
              </h3>
            </div>
            <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => onEdit(entry)} aria-label="Modifier" className="p-1.5 rounded-lg text-violet-300 hover:bg-white/10 hover:text-violet-50">
                <Pencil size={14} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setShowDeleteWarning(true); }} aria-label="Supprimer" className="p-1.5 rounded-lg text-violet-300 hover:bg-rose-500/20 hover:text-rose-300">
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {entry.genres.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {entry.genres.map((g) => <span key={g} className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-violet-300">{g}</span>)}
            </div>
          )}

          {/* Rangée de saisons : défilement horizontal plutôt que retour à la
              ligne, pour que les cartes gardent la même hauteur qu'il y ait
              1 saison (anime) ou 10 (série). */}
          <div className="flex items-center gap-1 overflow-x-auto flex-nowrap pb-0.5" onClick={(e) => e.stopPropagation()}>
            {seasons.map((se, i) => (
              <div key={se.number} className="relative group flex items-center flex-shrink-0">
                <button onClick={() => setActiveSeason(i)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono border whitespace-nowrap ${i === activeSeason ? `${s.border} ${s.text} bg-white/10` : "border-white/10 text-violet-400 hover:bg-white/5"}`}>
                  S{se.number}
                </button>
                {seasons.length > 1 && (
                  <button onClick={() => setSeasonToDelete(i)}
                    aria-label={`Supprimer saison ${se.number}`}
                    className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center w-3.5 h-3.5 rounded-full bg-rose-500 text-white hover:bg-rose-400">
                    <X size={8} />
                  </button>
                )}
              </div>
            ))}
            {seasonDone && hasNext && (
              <button onClick={() => setActiveSeason(activeSeason + 1)} className="flex items-center gap-0.5 text-[10px] text-violet-400 hover:text-violet-200 flex-shrink-0 whitespace-nowrap">
                Saison suiv. <ChevronRight size={11} />
              </button>
            )}
            <button
              onClick={handleAddSeason}
              disabled={checkingNextSeason}
              className="flex items-center gap-0.5 text-[10px] text-violet-400 hover:text-violet-200 px-1.5 py-0.5 rounded-md border border-dashed border-white/20 disabled:opacity-50 flex-shrink-0 whitespace-nowrap">
              {checkingNextSeason ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
              Saison
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-[11px] text-violet-300 tracking-wider">
                S{current.number} · ÉP. {String(current.watchedEpisodes).padStart(2, "0")}
                {current.totalEpisodes != null ? ` / ${String(current.totalEpisodes).padStart(2, "0")}` : ""}
              </span>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => decrementEpisode(entry.id, activeSeason)} className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-md bg-white/10 text-violet-200 hover:bg-white/20">
                  -1 ép.
                </button>
                {(current.totalEpisodes == null || current.watchedEpisodes < current.totalEpisodes) && (
                  <button onClick={() => incrementEpisode(entry.id, activeSeason)} className="text-[10px] font-mono uppercase tracking-wide px-2 py-0.5 rounded-md bg-white/10 text-violet-200 hover:bg-white/20">
                    +1 ép.
                  </button>
                )}
              </div>
            </div>
            <div className="h-4 flex items-center">
              {current.totalEpisodes != null ? (
                <ProgressBar watched={current.watchedEpisodes} total={current.totalEpisodes} colorClass={s.bar} glow={entry.status === "en-cours"} color={s.color} onChange={(v) => setEpisodeCount(entry.id, activeSeason, v)} />
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

          {canFinish && (
            <button onClick={(e) => { e.stopPropagation(); markDone(entry.id); }} className="flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg bg-teal-400/15 text-teal-300 hover:bg-teal-400/25">
              <Check size={13} /> Marquer comme terminé
            </button>
          )}
        </div>
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
        {entry.notes && <p className="text-xs text-violet-300/80 italic line-clamp-2">{entry.notes}</p>}
      </div>

      {seasonToDelete !== null && (
        <ConfirmDialog
          icon={<Trash2 size={14} className="text-rose-400" />}
          title="Supprimer la saison ?"
          description={<>La <span className="text-violet-50 font-medium">Saison {seasons[seasonToDelete]?.number}</span> et sa progression ({seasons[seasonToDelete]?.watchedEpisodes || 0} épisodes vus) seront supprimées définitivement.</>}
          confirmLabel="Supprimer"
          onConfirm={() => { deleteSeason(entry.id, seasonToDelete); setSeasonToDelete(null); }}
          onCancel={() => setSeasonToDelete(null)}
        />
      )}
      {showDeleteWarning && (
        <ConfirmDialog
          icon={<Trash2 size={14} className="text-rose-400" />}
          title="Supprimer ce titre ?"
          description={<><span className="text-violet-50 font-medium">« {entry.title} »</span> et toute sa progression seront supprimés définitivement.</>}
          confirmLabel="Supprimer"
          onConfirm={() => { deleteEntry(entry.id); setShowDeleteWarning(false); }}
          onCancel={() => setShowDeleteWarning(false)}
        />
      )}
      {noSeasonWarning && (
        <ConfirmDialog
          icon={<span className="text-amber-400 text-sm font-bold">!</span>}
          tone="amber"
          title="Aucune saison suivante"
          description={<>Aucune saison supplémentaire n'est référencée pour <span className="text-violet-50 font-medium">« {entry.title} »</span>. Voulez-vous tout de même en ajouter une vide ?</>}
          confirmLabel="Ajouter quand même"
          onConfirm={() => { addSeason(entry.id); setActiveSeason(seasons.length); setNoSeasonWarning(false); }}
          onCancel={() => setNoSeasonWarning(false)}
        />
      )}
    </>
  );
});