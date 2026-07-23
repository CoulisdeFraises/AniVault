import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { X, Pencil, Star, Loader2, RefreshCw, Film, Tv, CheckCheck, ChevronRight, Check } from "lucide-react";
import { EpisodeList }             from "../components/EpisodeList/EpisodeList";
import { StarRating, getRatingEmoji } from "../components/common/Rating";
import { TitleFormModal }          from "../components/Modal/TitleFormModal";
import { STATUS, seasonTotals }    from "../utils/status";
import { useLibrary }              from "../context/LibraryContext";
import { fetchSeasonInfo, importResult } from "../api";
import { fetchAniListRecommendations }   from "../api/recommendations";

// ── helpers ──────────────────────────────────────────────────────────────────
function getFormatGroup(f) {
  if (!f || f === "TV") return "tv";   // TV_SHORT → extra
  if (f === "MOVIE") return "movie";
  return "extra";
}

function AccordionHeader({ icon, label, count, summary, isOpen, onToggle }) {
  return (
    <button type="button" onClick={onToggle}
      className="flex items-center justify-between w-full py-2 text-left group select-none border-b border-white/5">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-base leading-none">{icon}</span>
        <span className="font-mono text-[11px] uppercase tracking-widest text-violet-400 group-hover:text-violet-200 transition-colors">{label}</span>
        <span className="font-mono text-[11px] text-violet-600">({count})</span>
        {!isOpen && summary && <span className="font-mono text-[11px] text-violet-500 truncate ml-1">— {summary}</span>}
      </div>
      <ChevronRight size={14} className={`flex-shrink-0 ml-2 text-violet-500 group-hover:text-violet-300 transition-all duration-200 ${isOpen ? "rotate-90" : ""}`} />
    </button>
  );
}

// ── Carte suggestion ──────────────────────────────────────────────────────────
function RecCard({ rec, onAdd, adding, alreadyInLib }) {
  return (
    <div className="rounded-xl bg-white/[0.04] border border-white/5 overflow-hidden flex flex-col">
      {rec.image && (
        <div className="aspect-[2/3] w-full overflow-hidden">
          <img src={rec.image} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-2 flex-1 flex flex-col gap-1">
        <p className="text-[11px] font-medium text-violet-100 leading-snug line-clamp-2" title={rec.title}>{rec.title}</p>
        <div className="flex items-center gap-1 mt-auto pt-1.5">
          {rec.score > 0 && (
            <span className="font-mono text-[9px] text-amber-400 shrink-0">★ {(rec.score / 10).toFixed(1)}</span>
          )}
          {alreadyInLib ? (
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-violet-500 ml-auto">Dans ta liste</span>
          ) : (
            <button onClick={() => onAdd(rec)} disabled={adding}
              className="font-mono text-[9px] px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300 hover:bg-amber-400/25 active:scale-95 transition-all disabled:opacity-50 ml-auto whitespace-nowrap">
              {adding ? "…" : "+ Ajouter"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────
export function Details() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { entries, saveEntry, updateRating, setEpisodeCount, updateSeasonTotal, incrementEpisode, decrementEpisode, markDone } = useLibrary();
  const entry = entries.find((e) => e.id === id);

  const tvSeasons    = useMemo(() => (entry?.seasons || []).map((s, i) => ({ ...s, globalIndex: i })).filter(s => getFormatGroup(s.format) === "tv"),    [entry?.seasons]);
  const extraSeasons = useMemo(() => (entry?.seasons || []).map((s, i) => ({ ...s, globalIndex: i })).filter(s => getFormatGroup(s.format) === "extra"),  [entry?.seasons]);
  const movieSeasons = useMemo(() => (entry?.seasons || []).map((s, i) => ({ ...s, globalIndex: i })).filter(s => getFormatGroup(s.format) === "movie"),  [entry?.seasons]);
  const hasMulti = [tvSeasons.length > 0, extraSeasons.length > 0, movieSeasons.length > 0].filter(Boolean).length > 1;

  // ── État ───────────────────────────────────────────────────────────────────
  const [activeTVIdx,  setActiveTVIdx]  = useState(0);
  const [open,         setOpen]         = useState({ tv: false, extra: false, movie: false }); // ← tous fermés
  const [seasonCache,  setSeasonCache]  = useState({});
  const [loadingEps,   setLoadingEps]   = useState(false);
  const [refreshing,   setRefreshing]   = useState(false);
  const [editing,      setEditing]      = useState(false);
  const [recs,         setRecs]         = useState([]);
  const [loadingRecs,  setLoadingRecs]  = useState(false);
  const [addingId,     setAddingId]     = useState(null);

  // Reset complet à chaque changement d'entrée
  useEffect(() => {
    setActiveTVIdx(0);
    setSeasonCache({});
    setOpen({ tv: false, extra: false, movie: false });
  }, [id]);

  // Chargement des épisodes de la saison TV active
  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    setLoadingEps(true);
    (async () => {
      try {
        const data = await fetchSeasonInfo(entry, activeTVIdx);
        if (cancelled) return;
        setSeasonCache(prev => ({ ...prev, [activeTVIdx]: data }));
        const curSeason = tvSeasons[activeTVIdx];
        if (curSeason && data.totalEpisodes != null && data.totalEpisodes !== curSeason.totalEpisodes) {
          updateSeasonTotal(entry.id, curSeason.globalIndex, data.totalEpisodes);
        }
      } catch (_) {}
      finally { if (!cancelled) setLoadingEps(false); }
    })();
    return () => { cancelled = true; };
  }, [entry?.id, activeTVIdx]); // eslint-disable-line

  // Chargement des suggestions (anime AniList uniquement)
  useEffect(() => {
    if (!entry || entry.type !== "anime" || !entry.genres?.length) { setRecs([]); return; }
    let cancelled = false;
    setLoadingRecs(true);
    setRecs([]);
    const excludeIds = entries.flatMap(e => e.anilistIds || []);
    fetchAniListRecommendations(entry.genres, excludeIds).then(results => {
      if (!cancelled) { setRecs(results.slice(0, 6)); setLoadingRecs(false); }
    });
    return () => { cancelled = true; };
  }, [entry?.id]); // eslint-disable-line

  if (!entry) return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm text-violet-50 flex items-center justify-center p-4 z-50">
      <div className="text-center">
        <p className="text-violet-300 mb-4">Ce titre n'existe plus.</p>
        <button onClick={() => navigate("/")} className="text-amber-300 hover:text-amber-200 text-sm font-medium">Retour à l'accueil</button>
      </div>
    </div>
  );

  // ── Dérivés ────────────────────────────────────────────────────────────────
  const s         = STATUS[entry.status];
  const curTV     = tvSeasons[activeTVIdx] ?? null;
  const watched   = curTV?.watchedEpisodes || 0;
  const curEps    = seasonCache[activeTVIdx]?.episodes || [];
  const hasNextTV = activeTVIdx < tvSeasons.length - 1;

  const { watched: tvW, total: tvT }   = seasonTotals(tvSeasons);
  const { watched: extW, total: extT } = seasonTotals(extraSeasons);
  const filmSeen  = movieSeasons.filter(m => m.watchedEpisodes >= (m.totalEpisodes ?? 1)).length;
  const canFinish = entry.status === "en-cours" && tvT != null && tvT > 0 && tvW >= tvT;

  const libraryAnilistIds = useMemo(
    () => new Set(entries.flatMap(e => e.anilistIds || [])),
    [entries]
  );

  const displayImage  = curTV?.coverImage || (activeTVIdx === 0 ? entry.coverImage : null);
  const fallbackImage = tvSeasons[0]?.coverImage || entry.coverImage;
  const showFallback  = !displayImage && activeTVIdx > 0 && fallbackImage;

  const FMT_LABEL = { OVA: "OAV", ONA: "ONA", SPECIAL: "Spécial", TV_SHORT: "Court", MUSIC: "Musique" };

  // ── Actions ────────────────────────────────────────────────────────────────
  // "Tout" : marque tous les épisodes vus, avance automatiquement sur la saison suivante
  function handleMarkAllWatched() {
    if (!curTV || curTV.totalEpisodes == null) return;
    setEpisodeCount(entry.id, curTV.globalIndex, curTV.totalEpisodes);
    if (hasNextTV) {
      setTimeout(() => setActiveTVIdx(prev => prev + 1), 300);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const data = await fetchSeasonInfo(entry, activeTVIdx);
      setSeasonCache(prev => ({ ...prev, [activeTVIdx]: data }));
      if (data.totalEpisodes != null && curTV) updateSeasonTotal(entry.id, curTV.globalIndex, data.totalEpisodes);
    } catch (_) {}
    finally { setRefreshing(false); }
  }

  async function handleAddRec(rec) {
    setAddingId(rec.id);
    try {
      const imported = await importResult(rec);
      saveEntry({
        ...imported,
        type: "anime",
        status: "a-voir",
        rating: 0,
        notes: "",
      }, null);
    } catch (_) {}
    finally { setAddingId(null); }
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm text-violet-50 flex items-center justify-center p-3 sm:p-4 z-50"
      style={{ fontFamily: "'Inter',sans-serif" }} onClick={() => navigate("/")}>
      <div onClick={e => e.stopPropagation()}
        className="bg-violet-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col">

        {/* ── Header ── */}
        <div className="flex gap-3 sm:gap-4 p-4 sm:p-6 border-b border-white/5 flex-shrink-0">
          {/* Cover */}
          {displayImage
            ? <img src={displayImage} alt="" className="w-16 h-24 sm:w-24 sm:h-36 object-cover rounded-xl flex-shrink-0" />
            : showFallback
              ? <div className="relative w-16 h-24 sm:w-24 sm:h-36 rounded-xl overflow-hidden flex-shrink-0">
                  <img src={fallbackImage} alt="" className="w-full h-full object-cover brightness-[0.25]" />
                  <span className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-white/50">?</span>
                </div>
              : null}

          {/* Infos */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-violet-300">
                    {entry.type === "anime" ? <Film size={10} /> : <Tv size={10} />}
                    {entry.type === "anime" ? "Anime" : "Série"}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest ${s.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{s.label}
                  </span>
                </div>
                <h2 className="text-base sm:text-xl font-bold text-violet-50 leading-tight line-clamp-2"
                  style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
                  {entry.title}
                </h2>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg text-violet-300 hover:bg-white/10 hover:text-violet-50"><Pencil size={14} /></button>
                <button onClick={() => navigate("/")} className="p-1.5 rounded-lg text-violet-300 hover:bg-white/10"><X size={14} /></button>
              </div>
            </div>

            {/* Genres */}
            {entry.genres.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {entry.genres.slice(0, 4).map(g => (
                  <span key={g} className="px-1.5 py-0.5 rounded-full bg-white/5 text-[10px] text-violet-300">{g}</span>
                ))}
                {entry.genres.length > 4 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-white/5 text-[10px] text-violet-500">+{entry.genres.length - 4}</span>
                )}
              </div>
            )}

            {/* Description */}
            {entry.description && (
              <div className="mb-2 max-h-14 sm:max-h-20 overflow-y-auto border-l-2 border-violet-600 pl-2 pr-1">
                <p className="text-[11px] text-violet-300/75 leading-relaxed italic">{entry.description}</p>
              </div>
            )}

            {/* Note */}
            <div className="mb-1">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xl sm:text-3xl font-bold text-violet-50" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
                  {entry.rating || "—"}
                </span>
                {entry.rating > 0 && <Star size={18} fill="#fbbf24" strokeWidth={0} />}
                {getRatingEmoji(entry.rating) && <span className="text-xl sm:text-3xl">{getRatingEmoji(entry.rating)}</span>}
              </div>
              <StarRating value={entry.rating} onChange={r => updateRating(entry.id, r)} />
            </div>
            {entry.notes && <p className="text-[11px] text-violet-300/80 italic mt-1 line-clamp-2">{entry.notes}</p>}
          </div>
        </div>

        {/* ── Corps scrollable ── */}
        <div className="flex-1 overflow-y-auto">

          {hasMulti ? (
            /* ── MODE ACCORDION ── */
            <div className="p-3 sm:p-4 space-y-2">

              {/* Série principale */}
              {tvSeasons.length > 0 && (
                <div className="rounded-xl bg-white/[0.03] border border-white/5 overflow-hidden">
                  <div className="px-3 sm:px-4">
                    <AccordionHeader icon="📺" label="Série principale" count={tvSeasons.length}
                      summary={`${tvW}${tvT != null ? `/${tvT}` : ""} ép.`}
                      isOpen={open.tv} onToggle={() => setOpen(p => ({ ...p, tv: !p.tv }))} />
                  </div>
                  {open.tv && (
                    <div className="px-3 sm:px-4 pb-4">
                      {/* Onglets saisons */}
                      {tvSeasons.length > 1 && (
                        <div className="flex gap-1.5 pt-3 pb-1 overflow-x-auto scrollbar-none">
                          {tvSeasons.map((se, i) => (
                            <button key={i} onClick={() => setActiveTVIdx(i)} title={se.title || undefined}
                              className={`px-2.5 py-1 rounded-md text-xs font-mono border flex-shrink-0 transition-colors ${i === activeTVIdx ? `${s.border} ${s.text} bg-white/10` : "border-white/10 text-violet-400 hover:bg-white/5"}`}>
                              S{se.number}
                            </button>
                          ))}
                        </div>
                      )}
                      {curTV?.title && <p className="font-mono text-[11px] text-violet-500 truncate mt-2" title={curTV.title}>{curTV.title}</p>}

                      {/* Contrôles */}
                      <div className="flex items-center justify-between mt-3 mb-2 gap-2 flex-wrap">
                        <p className="font-mono text-[11px] text-violet-400">
                          {watched} / {curTV?.totalEpisodes ?? "?"} ép. vus
                        </p>
                        <div className="flex items-center gap-2">
                          {canFinish && (
                            <button onClick={() => markDone(entry.id)}
                              className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 active:scale-95">
                              <Check size={10} /> Terminée
                            </button>
                          )}
                          {(entry.source === "anilist" || entry.source === "tvmaze") && (
                            <button onClick={handleRefresh} disabled={refreshing}
                              className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide text-violet-400 hover:text-violet-200 disabled:opacity-50">
                              <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} /> Actualiser
                            </button>
                          )}
                        </div>
                      </div>

                      {/* +1 / -1 / Tout */}
                      {curTV && (
                        <div className="flex gap-1.5 sm:gap-2 mb-3 flex-wrap">
                          <button onClick={() => decrementEpisode(entry.id, curTV.globalIndex)}
                            className="font-mono text-xs px-3 py-1.5 rounded-lg bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95 transition-transform">
                            -1 ép.
                          </button>
                          {(curTV.totalEpisodes == null || curTV.watchedEpisodes < curTV.totalEpisodes) && (
                            <button onClick={() => incrementEpisode(entry.id, curTV.globalIndex)}
                              className="font-mono text-xs px-3 py-1.5 rounded-lg bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95 transition-transform">
                              +1 ép.
                            </button>
                          )}
                          {curTV.totalEpisodes != null && curTV.watchedEpisodes < curTV.totalEpisodes && (
                            <button onClick={handleMarkAllWatched}
                              className="font-mono text-xs px-3 py-1.5 rounded-lg bg-teal-500/15 text-teal-300 hover:bg-teal-500/30 active:scale-95 transition-transform flex items-center gap-1">
                              <CheckCheck size={12} />
                              {hasNextTV ? "Tout → Suiv." : "Tout"}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Liste épisodes */}
                      {loadingEps
                        ? <div className="flex items-center gap-2 text-violet-400 text-sm py-4"><Loader2 size={14} className="animate-spin" /> Chargement…</div>
                        : <EpisodeList episodes={curEps} totalEpisodes={curTV?.totalEpisodes} watched={watched} statusColor={s.color} onSetEpisode={v => curTV && setEpisodeCount(entry.id, curTV.globalIndex, v)} />}
                    </div>
                  )}
                </div>
              )}

              {/* OVA / Specials */}
              {extraSeasons.length > 0 && (
                <div className="rounded-xl bg-white/[0.03] border border-white/5 overflow-hidden">
                  <div className="px-3 sm:px-4">
                    <AccordionHeader icon="📼" label="OVA / Specials" count={extraSeasons.length}
                      summary={`${extW}${extT != null ? `/${extT}` : ""} ép.`}
                      isOpen={open.extra} onToggle={() => setOpen(p => ({ ...p, extra: !p.extra }))} />
                  </div>
                  {open.extra && (
                    <div className="px-3 sm:px-4 pb-3 space-y-1 pt-2">
                      {extraSeasons.map(se => {
                        const label = se.title || `${FMT_LABEL[se.format] ?? se.format} ${se.number}`;
                        const done  = se.totalEpisodes != null && se.watchedEpisodes >= se.totalEpisodes;
                        return (
                          <div key={se.globalIndex} className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0">
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-xs text-violet-200 truncate" title={label}>{label}</p>
                              <p className="font-mono text-[10px] text-violet-500">
                                {String(se.watchedEpisodes).padStart(2, "0")}{se.totalEpisodes != null ? `/${String(se.totalEpisodes).padStart(2, "0")}` : "/?"} ép.
                              </p>
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              {se.watchedEpisodes > 0 && (
                                <button onClick={() => decrementEpisode(entry.id, se.globalIndex)}
                                  className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95">-1</button>
                              )}
                              {(se.totalEpisodes == null || se.watchedEpisodes < se.totalEpisodes) && (
                                <button onClick={() => incrementEpisode(entry.id, se.globalIndex)}
                                  className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95">+1</button>
                              )}
                              {se.totalEpisodes != null && !done && (
                                <button onClick={() => setEpisodeCount(entry.id, se.globalIndex, se.totalEpisodes)}
                                  className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-300 hover:bg-teal-500/30 active:scale-95 flex items-center">
                                  <CheckCheck size={10} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Films */}
              {movieSeasons.length > 0 && (
                <div className="rounded-xl bg-white/[0.03] border border-white/5 overflow-hidden">
                  <div className="px-3 sm:px-4">
                    <AccordionHeader icon="🎬" label="Films" count={movieSeasons.length}
                      summary={`${filmSeen}/${movieSeasons.length} vu`}
                      isOpen={open.movie} onToggle={() => setOpen(p => ({ ...p, movie: !p.movie }))} />
                  </div>
                  {open.movie && (
                    <div className="px-3 sm:px-4 pb-3 space-y-1 pt-2">
                      {movieSeasons.map(se => {
                        const label = se.title || `Film ${se.number}`;
                        const seen  = se.watchedEpisodes >= (se.totalEpisodes ?? 1);
                        return (
                          <div key={se.globalIndex} className="flex items-center justify-between gap-2 py-1.5 border-b border-white/5 last:border-0">
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-xs text-violet-200 truncate" title={label}>{label}</p>
                              {se.totalEpisodes != null && se.totalEpisodes > 1 && (
                                <p className="font-mono text-[10px] text-violet-500">{se.totalEpisodes} épisodes</p>
                              )}
                            </div>
                            <button onClick={() => setEpisodeCount(entry.id, se.globalIndex, seen ? 0 : (se.totalEpisodes ?? 1))}
                              className={`font-mono text-[10px] px-2.5 py-1 rounded-full border transition-all active:scale-95 flex-shrink-0 ${seen ? "bg-teal-500/20 border-teal-500/40 text-teal-300 hover:bg-teal-500/30" : "bg-white/5 border-white/10 text-violet-400 hover:bg-white/10 hover:text-violet-200"}`}>
                              {seen ? "✓ Vu" : "Pas vu"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

          ) : (
            /* ── MODE SIMPLE (TV uniquement) ── */
            <>
              {tvSeasons.length > 1 && (
                <div className="flex gap-1.5 px-4 sm:px-6 pt-4 pb-1 overflow-x-auto scrollbar-none">
                  {tvSeasons.map((se, i) => (
                    <button key={i} onClick={() => setActiveTVIdx(i)} title={se.title || undefined}
                      className={`px-3 py-1 rounded-md text-xs font-mono border flex-shrink-0 transition-colors ${i === activeTVIdx ? `${s.border} ${s.text} bg-white/10` : "border-white/10 text-violet-400 hover:bg-white/5"}`}>
                      S{se.number}
                    </button>
                  ))}
                </div>
              )}
              <div className="px-4 sm:px-6 pt-3 pb-1 flex items-center justify-between gap-2 flex-wrap">
                <p className="font-mono text-[11px] text-violet-500">{watched} / {curTV?.totalEpisodes ?? "?"} ép. vus</p>
                <div className="flex items-center gap-2">
                  {curTV?.totalEpisodes != null && curTV.watchedEpisodes < curTV.totalEpisodes && (
                    <button onClick={handleMarkAllWatched}
                      className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded bg-teal-500/15 text-teal-300 hover:bg-teal-500/30 active:scale-95">
                      <CheckCheck size={10} />{hasNextTV ? "Tout → Suiv." : "Tout"}
                    </button>
                  )}
                  {(entry.source === "anilist" || entry.source === "tvmaze") && (
                    <button onClick={handleRefresh} disabled={refreshing}
                      className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide text-violet-400 hover:text-violet-200 disabled:opacity-50">
                      <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} /> Actualiser
                    </button>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6">
                {loadingEps
                  ? <div className="flex items-center gap-2 text-violet-400 text-sm py-6"><Loader2 size={14} className="animate-spin" /> Chargement…</div>
                  : <EpisodeList episodes={curEps} totalEpisodes={curTV?.totalEpisodes} watched={watched} statusColor={s.color} onSetEpisode={v => curTV && setEpisodeCount(entry.id, curTV.globalIndex, v)} />}
              </div>
            </>
          )}

          {/* ── Séparateur + Suggestions ────────────────────────────────── */}
          {(loadingRecs || recs.length > 0) && (
            <div className="px-3 sm:px-4 pt-1 pb-5 border-t border-white/5 mt-2">
              {/* Séparateur décoratif */}
              <div className="flex items-center gap-3 my-4">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-500/30 to-violet-500/10" />
                <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-violet-500 whitespace-nowrap flex-shrink-0">
                  Suggestions
                </p>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent via-violet-500/30 to-violet-500/10" />
              </div>

              {loadingRecs ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={18} className="animate-spin text-violet-500" />
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {recs.map(rec => (
                    <RecCard
                      key={rec.id}
                      rec={rec}
                      onAdd={handleAddRec}
                      adding={addingId === rec.id}
                      alreadyInLib={libraryAnilistIds.has(rec.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {editing && <TitleFormModal editingEntry={entry} onClose={() => setEditing(false)} />}
    </div>
  );
}