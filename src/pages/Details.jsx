import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { X, Pencil, Star, Loader2, RefreshCw, Film, Tv } from "lucide-react";
import { EpisodeList } from "../components/EpisodeList/EpisodeList";
import { StarRating, getRatingEmoji } from "../components/common/Rating";
import { TitleFormModal } from "../components/Modal/TitleFormModal";
import { STATUS } from "../utils/status";
import { useLibrary } from "../context/LibraryContext";
import { fetchSeasonInfo } from "../api";

export function Details() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { entries, updateRating, setEpisodeCount, updateSeasonTotal } = useLibrary();
  const entry = entries.find((e) => e.id === id);

  const [activeSeason, setActiveSeason] = useState(0);
  const [seasonCache, setSeasonCache] = useState({});
  const [loadingEps, setLoadingEps] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => { setActiveSeason(0); setSeasonCache({}); }, [id]);

  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    setLoadingEps(true);
    (async () => {
      try {
        const data = await fetchSeasonInfo(entry, activeSeason);
        if (cancelled) return;
        setSeasonCache((prev) => ({ ...prev, [activeSeason]: data }));
        const storedTotal = entry.seasons[activeSeason]?.totalEpisodes;
        if (data.totalEpisodes != null && data.totalEpisodes !== storedTotal) {
          updateSeasonTotal(entry.id, activeSeason, data.totalEpisodes);
        }
      } catch (_) {}
      finally { if (!cancelled) setLoadingEps(false); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id, activeSeason]);

  if (!entry) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm text-violet-50 flex items-center justify-center p-4 z-50">
        <div className="text-center">
          <p className="text-violet-300 mb-4">Ce titre n'existe plus (ou a été supprimé).</p>
          <button onClick={() => navigate("/")} className="text-amber-300 hover:text-amber-200 text-sm font-medium">Retour à l'accueil</button>
        </div>
      </div>
    );
  }

  const s = STATUS[entry.status];
  const currentSeason = entry.seasons[activeSeason];
  const watched = currentSeason?.watchedEpisodes || 0;
  const currentEps = seasonCache[activeSeason]?.episodes || [];

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const data = await fetchSeasonInfo(entry, activeSeason);
      setSeasonCache((prev) => ({ ...prev, [activeSeason]: data }));
      if (data.totalEpisodes != null) updateSeasonTotal(entry.id, activeSeason, data.totalEpisodes);
    } catch (_) {}
    finally { setRefreshing(false); }
  }

  const displayImage = currentSeason?.coverImage || (activeSeason === 0 ? entry.coverImage : null);
  const fallbackImage = entry.seasons[0]?.coverImage || entry.coverImage;
  const showFallback = !displayImage && activeSeason > 0 && fallbackImage;

  return (
    /* Fond transparent avec flou — la page d'avant reste visible derrière */
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm text-violet-50 flex items-center justify-center p-4 z-50"
      style={{ fontFamily: "'Inter', sans-serif" }}
      onClick={() => navigate("/")}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-violet-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
      >
        <div className="flex gap-4 p-6 border-b border-white/5 flex-shrink-0">
          {displayImage ? (
            <img src={displayImage} alt="" className="w-24 h-36 object-cover rounded-xl flex-shrink-0" />
          ) : showFallback ? (
            <div className="relative w-24 h-36 rounded-xl overflow-hidden flex-shrink-0">
              <img src={fallbackImage} alt="" className="w-full h-full object-cover brightness-[0.25]" />
              <span className="absolute inset-0 flex items-center justify-center text-5xl font-bold text-white/50">?</span>
            </div>
          ) : null}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
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
                </div>
                <h2 className="text-xl font-bold text-violet-50 leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {entry.title}
                </h2>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg text-violet-300 hover:bg-white/10 hover:text-violet-50">
                  <Pencil size={14} />
                </button>
                <button onClick={() => navigate("/")} className="p-1.5 rounded-lg text-violet-300 hover:bg-white/10">
                  <X size={14} />
                </button>
              </div>
            </div>
            {entry.genres.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {entry.genres.map((g) => <span key={g} className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-violet-300">{g}</span>)}
              </div>
            )}
            {entry.description && (
              <div className="mb-3 max-h-28 overflow-y-auto border-l-2 border-violet-600 pl-3 pr-1">
                <p className="text-xs text-violet-300/75 leading-relaxed italic">{entry.description}</p>
              </div>
            )}
            <div className="mb-1">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-3xl font-bold text-violet-50" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                  {entry.rating || "—"}
                </span>
                {entry.rating > 0 && <Star size={26} fill="#fbbf24" strokeWidth={0} />}
              </div>
              <div className="flex items-center gap-3">
                <StarRating value={entry.rating} onChange={(r) => updateRating(entry.id, r)} />
                {getRatingEmoji(entry.rating) && <span className="text-4xl">{getRatingEmoji(entry.rating)}</span>}
              </div>
            </div>
            {entry.notes && <p className="text-xs text-violet-300/80 italic">{entry.notes}</p>}
          </div>
        </div>

        {entry.seasons.length > 1 && (
          <div className="flex gap-1.5 px-6 pt-4 flex-shrink-0 overflow-x-auto">
            {entry.seasons.map((se, i) => (
              <button key={i} onClick={() => setActiveSeason(i)}
                className={`px-3 py-1 rounded-md text-xs font-mono border flex-shrink-0 ${i === activeSeason ? `${s.border} ${s.text} bg-white/10` : "border-white/10 text-violet-400 hover:bg-white/5"}`}>
                S{se.number}
              </button>
            ))}
          </div>
        )}

        <div className="px-6 pt-3 pb-1 flex-shrink-0 flex items-center justify-between">
          <p className="font-mono text-[11px] text-violet-500">
            {watched} / {currentSeason?.totalEpisodes ?? "?"} épisodes vus
          </p>
          {(entry.source === "anilist" || entry.source === "tvmaze") && (
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide text-violet-400 hover:text-violet-200 disabled:opacity-50"
              aria-label="Actualiser les épisodes de cette saison"
            >
              <RefreshCw size={11} className={refreshing ? "animate-spin motion-reduce:animate-none" : ""} />
              Actualiser
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {loadingEps ? (
            <div className="flex items-center gap-2 text-violet-400 text-sm py-6">
              <Loader2 size={14} className="animate-spin" /> Chargement des épisodes…
            </div>
          ) : (
            <EpisodeList
              episodes={currentEps}
              totalEpisodes={currentSeason?.totalEpisodes}
              watched={watched}
              statusColor={s.color}
              onSetEpisode={(value) => setEpisodeCount(entry.id, activeSeason, value)}
            />
          )}
        </div>
      </div>

      {editing && <TitleFormModal editingEntry={entry} onClose={() => setEditing(false)} />}
    </div>
  );
}