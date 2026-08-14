import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { X, Pencil, Star, Loader2, RefreshCw, Film, Tv, Disc2, Clapperboard,
         CheckCheck, ChevronRight, Check, Heart, ListPlus, AlertTriangle, WifiOff } from "lucide-react";
import { EpisodeList }             from "../components/EpisodeList/EpisodeList";
import { StarRating, RatingMeter, getRatingEmoji } from "../components/common/Rating";
import { TitleFormModal }          from "../components/Modal/TitleFormModal";
import { STATUS, seasonTotals, formatRating }    from "../utils/status";
import { useLibrary }              from "../context/LibraryContext";
import { fetchSeasonInfo, importResult, refreshEntryCard, fetchNextAiring } from "../api";
import { fetchAniListRecommendations, fetchSimilarTitles } from "../api/recommendations";
import { fetchTMDBSimilarMovies, fetchTMDBSimilarSeries, hasTMDB } from "../api/tmdb";
import { SynopsisModal }  from "../components/common/SynopsisModal";
import { AddToListModal } from "../components/common/AddToListModal";
import { useLists }       from "../context/ListsContext";
import { getFormatGroup } from "../utils/format";
import { Confetti }           from "../components/common/Confetti";
import { CelebrationBanner }  from "../components/common/CelebrationBanner";
import { haptics } from "../utils/haptics";
import { normalizeSeriesTitle } from "../utils/titles";

function EpisodeSlider({ watched, total, entryId, globalIndex, setEpisodeCount }) {
  const pct = total > 0 ? (watched / total) * 100 : 0;
  return (
    <div className="mb-3">
      <input type="range" min={0} max={total} value={watched}
        onChange={e => setEpisodeCount(entryId, globalIndex, Number(e.target.value))}
        className="episode-slider w-full cursor-pointer"
        style={{ background: `linear-gradient(to right, #a78bfa ${pct}%, rgba(109,40,217,0.25) ${pct}%)` }}
      />
      <div className="flex justify-between font-mono text-[10px] text-violet-600 mt-1">
        <span>0</span>
        <span className="text-violet-400 font-medium">{watched} / {total} ép.</span>
        <span>{total}</span>
      </div>
    </div>
  );
}

function AccordionHeader({ icon, label, count, summary, isOpen, onToggle }) {
  return (
    <button type="button" onClick={onToggle}
      className="flex items-center justify-between w-full py-2 text-left group select-none border-b border-white/5">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="flex-shrink-0 text-violet-400 flex items-center">{icon}</span>
        <span className="font-mono text-[11px] uppercase tracking-widest text-violet-400 group-hover:text-violet-200 transition-colors">{label}</span>
        <span className="font-mono text-[11px] text-violet-600">({count})</span>
        {!isOpen && summary && <span className="font-mono text-[11px] text-violet-500 truncate ml-1">— {summary}</span>}
      </div>
      <ChevronRight size={14} className={`flex-shrink-0 ml-2 text-violet-500 group-hover:text-violet-300 transition-all duration-200 ${isOpen ? "rotate-90" : ""}`} />
    </button>
  );
}

function RecCard({ rec, onAdd, adding, alreadyInLib, onClick }) {
  return (
    <div onClick={onClick}
      className="relative flex-shrink-0 w-24 rounded-xl overflow-hidden bg-white/[0.04] border border-white/5 group cursor-pointer active:scale-[0.97] transition-transform">
      <div className="aspect-[2/3] w-full overflow-hidden">
        {rec.image
          ? <img src={rec.image} alt="" loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 motion-reduce:transition-none" />
          : <div className="w-full h-full bg-violet-900/50 flex items-center justify-center">
              <Film size={28} className="text-violet-500/40" />
            </div>}
      </div>
      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-1.5 pt-5">
        <p className="font-mono text-[9px] text-white leading-tight line-clamp-2 mb-1" title={rec.title}>{rec.title}</p>
        {rec.score > 0 && <p className="font-mono text-[8px] text-amber-400 mb-1">★ {(rec.score / 10).toFixed(1)}</p>}
        {alreadyInLib
          ? <span className="font-mono text-[8px] text-violet-400 block text-center">✓ Dans ta liste</span>
          : <button onClick={e => { e.stopPropagation(); onAdd(rec); }} disabled={adding}
              className="w-full font-mono text-[8px] py-0.5 rounded-md bg-amber-400/25 text-amber-300 hover:bg-amber-400/40 active:scale-95 transition-all disabled:opacity-50 text-center">
              {adding ? "…" : "+ Ajouter"}
            </button>}
      </div>
    </div>
  );
}

export function Details() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { entries, saveEntry, updateSeasonRating, setEpisodeCount, updateSeasonTotal,
          incrementEpisode, decrementEpisode, markDone } = useLibrary();
  const { isInFavorites, toggleFavorite } = useLists();
  const entry = entries.find((e) => e.id === id);

  // ── Fermeture ─────────────────────────────────────────────────────────
  // Details s'ouvre en overlay par-dessus la page d'origine (via
  // state.backgroundLocation, cf. App.jsx). À la fermeture, on doit donc
  // revenir à cette page (Listes, Historique, Accueil…) plutôt que de
  // forcer systématiquement un retour à l'accueil.
  function closeDetails() {
    if (location.state?.backgroundLocation) navigate(-1);
    else navigate("/");
  }

  const tvSeasons    = useMemo(() => (entry?.seasons || []).map((s, i) => ({ ...s, globalIndex: i })).filter(s => getFormatGroup(s.format) === "tv"),    [entry?.seasons]);
  const extraSeasons = useMemo(() => (entry?.seasons || []).map((s, i) => ({ ...s, globalIndex: i })).filter(s => getFormatGroup(s.format) === "extra"),  [entry?.seasons]);
  const movieSeasons = useMemo(() => (entry?.seasons || []).map((s, i) => ({ ...s, globalIndex: i })).filter(s => getFormatGroup(s.format) === "movie"),  [entry?.seasons]);
  const isStandaloneFilm = tvSeasons.length === 0 && extraSeasons.length === 0 && movieSeasons.length > 0;
  const hasMulti = [tvSeasons.length > 0, extraSeasons.length > 0, movieSeasons.length > 0]
    .filter(Boolean).length > 1 || isStandaloneFilm;

  const [activeTVIdx,    setActiveTVIdx]   = useState(0);
  const [open,           setOpen]          = useState({ tv: false, extra: false, movie: isStandaloneFilm });
  const [openEpisodes,   setOpenEpisodes]  = useState(false);
  const [seasonCache,    setSeasonCache]   = useState({});
  const [loadingEps,     setLoadingEps]    = useState(false);
  // ── Refresh carte ──────────────────────────────────────────────────────────
  const [refreshingCard, setRefreshingCard] = useState(false);
  const [refreshResult,  setRefreshResult]  = useState(null); // null | { newCount }
  // ──────────────────────────────────────────────────────────────────────────
  const [editing,        setEditing]       = useState(false);
  const [recs,           setRecs]          = useState([]);
  const [loadingRecs,    setLoadingRecs]   = useState(false);
  const [addingId,       setAddingId]      = useState(null);
  const [addError,       setAddError]      = useState(null);
  const [synopsisRec,    setSynopsisRec]   = useState(null);
  const [addToListOpen,  setAddToListOpen] = useState(false);
  const [touchStartY,    setTouchStartY]   = useState(null);
  const [celebration,    setCelebration]   = useState(null); // null | { tier, title, subtitle }
  const [nextAiring,     setNextAiring]    = useState(null);

  const prevSeasonWatchedRef = useRef({});
  const prevStatusRef        = useRef(null);
  const celebrationTimerRef  = useRef(null);

  // Verrou de scroll : Details.jsx est une route à part entière rendue comme
  // un overlay plein écran (pas une modale via le composant <Modal> partagé),
  // donc elle doit gérer elle-même le blocage du scroll de la page en dessous.
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, []);

  useEffect(() => {
    setActiveTVIdx(0); setSeasonCache({});
    setOpen({
      tv: false,
      extra: false,
      movie: (entry?.seasons || []).length > 0 &&
            (entry?.seasons || []).every(s => getFormatGroup(s.format) === "movie"),
    });
    setOpenEpisodes(false);
    setRefreshResult(null);
    // Réinitialise le suivi de complétion pour éviter une fausse célébration
    // en arrivant sur un titre déjà terminé.
    clearTimeout(celebrationTimerRef.current);
    setCelebration(null);
    prevStatusRef.current = entry?.status ?? null;
    prevSeasonWatchedRef.current = Object.fromEntries((entry?.seasons || []).map((s, i) => [i, s.watchedEpisodes]));
  }, [id]); // eslint-disable-line

  function triggerCelebration(payload) {
    clearTimeout(celebrationTimerRef.current);
    setCelebration(payload);
    haptics.celebration();
    celebrationTimerRef.current = setTimeout(() => setCelebration(null), payload.tier === "series" ? 4200 : 3200);
  }

  // ── Détection : une saison vient d'être terminée ────────────────────────────
  useEffect(() => {
    if (!entry) return;
    const prevMap = prevSeasonWatchedRef.current;
    entry.seasons.forEach((s, i) => {
      const total = s.totalEpisodes;
      if (total == null || total <= 0) return;
      const isNowDone = s.watchedEpisodes >= total;
      const prevWatched = prevMap[i];
      const wasDone = prevWatched != null && prevWatched >= total;
      // La série entière qui se termine a sa propre célébration (plus grande) ;
      // on évite de déclencher les deux en même temps.
      if (isNowDone && !wasDone && entry.status !== "termine") {
        triggerCelebration({
          tier: "season",
          title: `Saison ${s.number ?? ""} terminée !`.replace("  ", " "),
          subtitle: entry.title,
        });
      }
    });
    prevSeasonWatchedRef.current = Object.fromEntries(entry.seasons.map((s, i) => [i, s.watchedEpisodes]));
  }, [entry?.seasons]); // eslint-disable-line

  // ── Détection : la série entière vient d'être terminée ──────────────────────
  useEffect(() => {
    if (!entry) return;
    const prev = prevStatusRef.current;
    if (prev != null && prev !== "termine" && entry.status === "termine") {
      triggerCelebration({ tier: "series", title: "Série terminée !", subtitle: entry.title });
    }
    prevStatusRef.current = entry.status;
  }, [entry?.status]); // eslint-disable-line

  // ── Prochain épisode prévu (AniList/TVmaze) ──────────────────────────────
  // Un titre "Terminé" alors qu'un épisode est encore annoncé est incohérent
  // (et bloquait la sync/les notifs, qui ignorent les titres "termine") :
  // on récupère systématiquement l'info, y compris pour un titre déjà marqué
  // terminé, et on corrige automatiquement le statut si besoin.
  useEffect(() => {
    if (!entry) { setNextAiring(null); return; }
    if (entry.status === "abandonne") { setNextAiring(null); return; }
    if (!((entry.source === "anilist" && entry.anilistIds?.length) || (entry.source === "tvmaze" && entry.tvmazeId))) {
      setNextAiring(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetchNextAiring(entry);
        if (cancelled) return;
        setNextAiring(r);
        if (r?.airingAt && entry.status === "termine") {
          saveEntry({ ...entry, status: "en-cours" }, entry.id);
        }
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [entry?.id, entry?.source, entry?.status, entry?.anilistIds?.length, entry?.tvmazeId]); // eslint-disable-line

  useEffect(() => {
    if (!entry) return;
    let cancelled = false;
    setLoadingEps(true);
    (async () => {
      try {
        const data = await fetchSeasonInfo(entry, curTV?.globalIndex ?? activeTVIdx);
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

  useEffect(() => {
    if (!entry) { setRecs([]); return; }
    let cancelled = false;
    setLoadingRecs(true);
    setRecs([]);

    const isFilm  = entry.category === "movie";
    const isSerie = entry.type === "serie" && !isFilm;
    const isAnime = entry.type === "anime";

    let fetchPromise;

    if (isAnime) {
      // ── Anime → AniList similar ──────────────────────────────────────────
      const excludeIds = entries.flatMap((e) => e.anilistIds || []).map(Number);
      const anilistId  = entry.anilistIds?.[0]
        ?? entry.seasons?.find((s) => s.anilistId)?.anilistId
        ?? null;
      fetchPromise = anilistId
        ? fetchSimilarTitles(anilistId, excludeIds)
        : entry.genres?.length
          ? fetchAniListRecommendations(entry.genres, excludeIds)
          : Promise.resolve([]);

    } else if (isFilm && hasTMDB()) {
      // ── Film → TMDB similar movies ───────────────────────────────────────
      const excludeIds = entries
        .filter((e) => e.category === "movie" && e.tmdbId)
        .map((e) => Number(e.tmdbId));
      fetchPromise = entry.tmdbId
        ? fetchTMDBSimilarMovies(entry.tmdbId, excludeIds)
        : Promise.resolve([]);

    } else if (isSerie && hasTMDB()) {
      // ── Série → TMDB similar TV shows ────────────────────────────────────
      const excludeIds = entries
        .filter((e) => e.tmdbId)
        .map((e) => Number(e.tmdbId));
      fetchPromise = entry.tmdbId
        ? fetchTMDBSimilarSeries(entry.tmdbId, excludeIds)
        : Promise.resolve([]);

    } else {
      // Pas de token TMDB ou cas non géré
      setRecs([]);
      setLoadingRecs(false);
      return;
    }

    fetchPromise.then((results) => {
      if (!cancelled) {
        setRecs((results || []).filter(Boolean).slice(0, 20));
        setLoadingRecs(false);
      }
    }).catch(() => {
      if (!cancelled) setLoadingRecs(false);
    });

    return () => { cancelled = true; };
  }, [entry?.id]); // eslint-disable-line

  // ── Guard : entry introuvable (chargement en cours ou ID invalide) ──────
  if (!entry) return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm text-violet-50 flex items-center justify-center p-4 z-50">
      <div className="text-center">
        <p className="text-violet-300 mb-4">Ce titre n'existe plus.</p>
        <button onClick={closeDetails} className="text-amber-300 hover:text-amber-200 text-sm font-medium">
          Retour à l'accueil
        </button>
      </div>
    </div>
  );

  // ── Dérivations — entry est garantie non-null à partir d'ici ───────────
  const s       = STATUS[entry.status] ?? STATUS["a-voir"];
  const curTV = tvSeasons[activeTVIdx] ?? null
  const watched = curTV?.watchedEpisodes || 0;
  const curEps  = seasonCache[activeTVIdx]?.episodes || [];
  const curEpsReason = seasonCache[activeTVIdx]?.reason ?? null;
  const hasNextTV = activeTVIdx < tvSeasons.length - 1;

  const { watched: tvW, total: tvT }   = seasonTotals(tvSeasons);
  const { watched: extW, total: extT } = seasonTotals(extraSeasons);
  const filmSeen  = movieSeasons.filter(m => m.watchedEpisodes >= (m.totalEpisodes ?? 1)).length;
  const canFinish = entry.status === "en-cours" && tvT != null && tvT > 0 && tvW >= tvT && !nextAiring?.airingAt;

  const libraryAnilistIds = useMemo(
    () => new Set(entries.flatMap((e) => e.anilistIds || []).map(Number)),
    [entries]
  );
  const libraryTmdbIds = useMemo(
    () => new Set(entries.map((e) => e.tmdbId).filter(Boolean).map(Number)),
    [entries]
  );
  // Filet de sécurité par titre : les IDs seuls ne suffisent pas (une œuvre
  // peut avoir été ajoutée via une autre source, ou son ID de saison peut
  // différer de celui renvoyé par les recommandations). On recoupe donc
  // aussi sur le titre normalisé, comme sur la page Recommandations.
  const libraryTitles = useMemo(
    () => new Set(
      entries.flatMap((e) => [e.title, e.titleFrench, e.titleRomaji, e.titleEnglish])
        .filter(Boolean)
        .map(normalizeSeriesTitle)
    ),
    [entries]
  );
  function isRecAlreadyInLibrary(rec) {
    const recId = Number(rec.id);
    return libraryAnilistIds.has(recId)
      || libraryTmdbIds.has(recId)
      || libraryTitles.has(normalizeSeriesTitle(rec.title));
  }

  const dedupedRecs = useMemo(() => {
    const seen = new Set();
    return recs
      .filter(Boolean)
      .filter((rec) => {
        const key = normalizeSeriesTitle(rec.title);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [recs]);

  const displayImage  = curTV?.coverImage || (activeTVIdx === 0 ? entry.coverImage : null);
  const fallbackImage = tvSeasons[0]?.coverImage || entry.coverImage;
  const showFallback  = !displayImage && activeTVIdx > 0 && fallbackImage;
  const FMT_LABEL     = { OVA: "OAV", ONA: "ONA", SPECIAL: "Spécial", TV_SHORT: "Court", MUSIC: "Musique" };

  function handleMarkAllWatched() {
    if (!curTV || curTV.totalEpisodes == null) return;
    haptics.success();
    setEpisodeCount(entry.id, curTV.globalIndex, curTV.totalEpisodes);
    if (hasNextTV) setTimeout(() => setActiveTVIdx(prev => prev + 1), 300);
  }

  /**
   * handleRefreshCard — vérifie si de nouvelles saisons / OVA / Films sont
   * disponibles sur AniList ou TVmaze, et met à jour la carte si c'est le cas.
   * La progression existante est toujours préservée.
   */
  async function handleRefreshCard() {
    if (refreshingCard) return;
    setRefreshingCard(true);
    setRefreshResult(null);
    try {
      const result = await refreshEntryCard(entry);
      if (!result) {
        haptics.error();
        setRefreshResult({ status: "unsupported" });
        setTimeout(() => setRefreshResult(null), 5000);
        return;
      }
      saveEntry(
        {
          ...entry,
          seasons: result.seasons,
          ...(result.anilistIds?.length ? { anilistIds: result.anilistIds } : {}),
        },
        entry.id
      );
      haptics.light();
      setRefreshResult({ status: "success", newCount: result.newCount });
      setTimeout(() => setRefreshResult(null), 5000);
    } catch (err) {
      haptics.error();
      setRefreshResult({ status: "error", message: err?.message });
      setTimeout(() => setRefreshResult(null), 6000);
    }
    finally { setRefreshingCard(false); }
  }

  async function handleAddRec(rec) {
    if (isRecAlreadyInLibrary(rec)) return; // garde-fou doublon (ID ou titre)
    setAddingId(rec.id);
    setAddError(null);
    try {
      const imported = await importResult(rec);
      saveEntry({ ...imported, status: "a-voir", rating: 0, notes: "" }, null);
      haptics.light();
    } catch (err) {
      haptics.error();
      setAddError(`Impossible d'ajouter « ${rec.title} » — ${err?.message || "réessaie dans un instant."}`);
      setTimeout(() => setAddError(null), 5000);
    }
    finally { setAddingId(null); }
  }

  function handleOuterClick() {
    if (synopsisRec) { setSynopsisRec(null); return; }
    closeDetails();
  }

  function handleDragTouchStart(e) {
    setTouchStartY(e.touches[0].clientY);
  }
  function handleDragTouchEnd(e) {
    if (touchStartY === null) return;
    const delta = e.changedTouches[0].clientY - touchStartY;
    if (delta > 80) closeDetails();
    setTouchStartY(null);
  }

  return (
    <>
      <Confetti active={!!celebration} intensity={celebration?.tier === "series" ? "series" : "season"} />
      <CelebrationBanner
        show={!!celebration}
        tier={celebration?.tier}
        title={celebration?.title}
        subtitle={celebration?.subtitle}
        durationMs={celebration?.tier === "series" ? 4200 : 3200}
      />
    <div
      className="fixed inset-0 z-50 text-violet-50 bg-black/60 backdrop-blur-sm
        flex items-end
        sm:items-center sm:justify-center sm:p-4"
      style={{ fontFamily: "'Inter',sans-serif" }}
      onClick={handleOuterClick}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-violet-900 border border-white/10 flex flex-col w-full
          rounded-t-3xl max-h-[92dvh]
          sm:rounded-2xl sm:max-w-2xl sm:max-h-[92vh]
          animate-slideUp sm:animate-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >

        {/* ── Drag handle — mobile uniquement ── */}
        <div
          className="sm:hidden flex justify-center pt-3 pb-1 flex-shrink-0 touch-none select-none"
          onTouchStart={handleDragTouchStart}
          onTouchEnd={handleDragTouchEnd}
        >
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* ── Header ── */}
        <div className="flex gap-3 sm:gap-4 p-4 sm:p-6 border-b border-white/5 flex-shrink-0">
          {displayImage
            ? <img src={displayImage} alt="" loading="lazy"
                className="w-16 h-24 sm:w-24 sm:h-36 object-cover rounded-xl flex-shrink-0" />
            : showFallback
              ? <div className="relative w-16 h-24 sm:w-24 sm:h-36 rounded-xl overflow-hidden flex-shrink-0">
                  <img src={fallbackImage} alt="" loading="lazy" className="w-full h-full object-cover brightness-[0.25]" />
                  <span className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-white/50">?</span>
                </div>
              : null}

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-violet-300">
                    {entry.category === "movie" ? <Clapperboard size={10} /> : entry.type === "anime" ? <Film size={10} /> : <Tv size={10} />}
                    {entry.category === "movie" ? "Film" : entry.type === "anime" ? "Anime" : "Série"}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest ${s.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{s.label}
                  </span>
                </div>
                <h2 className="text-base sm:text-xl font-bold text-violet-50 leading-tight line-clamp-2"
                  style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{entry.title}</h2>
              </div>

              {/* ── Boutons header ── */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => { haptics.light(); toggleFavorite(entry); }}
                  aria-label={isInFavorites(entry.id) ? "Retirer des favoris" : "Ajouter aux favoris"}
                  className={`p-1.5 rounded-lg transition-colors ${isInFavorites(entry.id) ? "text-pink-400 hover:bg-pink-500/10" : "text-violet-300 hover:bg-white/10 hover:text-pink-300"}`}>
                  <Heart size={14} fill={isInFavorites(entry.id) ? "currentColor" : "none"} />
                </button>
                <button onClick={() => setAddToListOpen(true)} aria-label="Ajouter à une liste"
                  className="p-1.5 rounded-lg text-violet-300 hover:bg-white/10 hover:text-amber-300 transition-colors">
                  <ListPlus size={14} />
                </button>
                {/* ── Actualiser la carte (nouvelles saisons / OVA / Films) ── */}
                {(entry.source === "anilist" || entry.source === "tvmaze") && (
                  <button
                    onClick={handleRefreshCard}
                    disabled={refreshingCard}
                    aria-label="Actualiser — chercher de nouveaux contenus"
                    title="Chercher de nouvelles saisons, OVA ou films"
                    className="p-1.5 rounded-lg text-violet-300 hover:bg-white/10 hover:text-teal-300 transition-colors disabled:opacity-40"
                  >
                    <RefreshCw size={14} className={refreshingCard ? "animate-spin" : ""} />
                  </button>
                )}
                <button onClick={() => setEditing(true)}
                  className="p-1.5 rounded-lg text-violet-300 hover:bg-white/10 hover:text-violet-50">
                  <Pencil size={14} />
                </button>
                <button onClick={closeDetails}
                  className="p-1.5 rounded-lg text-violet-300 hover:bg-white/10">
                  <X size={14} />
                </button>
              </div>
            </div>

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

            {entry.description && (
              <div className="mb-2 max-h-14 sm:max-h-20 overflow-y-auto border-l-2 border-violet-600 pl-2 pr-1">
                <p className="text-[11px] text-violet-300/75 leading-relaxed italic">{entry.description}</p>
              </div>
            )}

            <div className="mb-1">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xl sm:text-3xl font-bold text-violet-50"
                  style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
                  {formatRating(entry.rating) || "—"}
                </span>
                {entry.rating > 0 && <Star size={18} fill="#fbbf24" strokeWidth={0} />}
                {getRatingEmoji(entry.rating) && <span className="text-xl sm:text-3xl">{getRatingEmoji(entry.rating)}</span>}
              </div>
              <p className="font-mono text-[10px] text-violet-500">
                {entry.rating > 0 ? "Moyenne des saisons notées — note-les ci-dessous" : "Aucune saison notée pour l'instant"}
              </p>
            </div>
            {entry.notes && <p className="text-[11px] text-violet-300/80 italic mt-1 line-clamp-2">{entry.notes}</p>}
          </div>
        </div>

        {/* ── Bannière résultat actualisation ── */}
        {refreshResult !== null && (
          <div className={`mx-4 sm:mx-6 mt-2 px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-mono animate-fadeIn flex-shrink-0 ${
            refreshResult.status === "error"
              ? "bg-rose-500/15 border border-rose-500/30 text-rose-300"
              : refreshResult.status === "unsupported"
                ? "bg-amber-500/15 border border-amber-500/30 text-amber-300"
                : "bg-teal-500/15 border border-teal-500/30 text-teal-300"
          }`}>
            {refreshResult.status === "error"
              ? <WifiOff size={12} className="flex-shrink-0" />
              : refreshResult.status === "unsupported"
                ? <AlertTriangle size={12} className="flex-shrink-0" />
                : <Check size={12} className="flex-shrink-0" />}
            <span className="flex-1">
              {refreshResult.status === "error"
                ? (refreshResult.message || "Échec de l'actualisation — vérifie ta connexion et réessaie.")
                : refreshResult.status === "unsupported"
                  ? "Ce titre ne peut pas être actualisé automatiquement (source non reconnue)."
                  : refreshResult.newCount > 0
                    ? `${refreshResult.newCount} nouveau${refreshResult.newCount > 1 ? "x" : ""} contenu${refreshResult.newCount > 1 ? "s" : ""} ajouté${refreshResult.newCount > 1 ? "s" : ""} !`
                    : "Aucun nouveau contenu disponible pour le moment."}
            </span>
            <button onClick={() => setRefreshResult(null)} aria-label="Fermer" className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
              <X size={12} />
            </button>
          </div>
        )}

        {/* ── Corps scrollable ── */}
        <div className="flex-1 overflow-y-auto">
          {hasMulti ? (
            <div className="p-3 sm:p-4 space-y-2">

              {tvSeasons.length > 0 && (
                <div className="rounded-xl bg-white/[0.03] border border-white/5 overflow-hidden">
                  <div className="px-3 sm:px-4">
                    <AccordionHeader icon={<Tv size={15} />} label="Série principale" count={tvSeasons.length}
                      summary={`${tvW}${tvT != null ? `/${tvT}` : ""} ép.`}
                      isOpen={open.tv} onToggle={() => setOpen(p => ({ ...p, tv: !p.tv }))} />
                  </div>
                  {open.tv && (
                    <div className="px-3 sm:px-4 pb-4">
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
                      {curTV && (
                        <div className="flex items-center gap-2 mt-2 mb-1 flex-wrap">
                          <span className="font-mono text-[10px] uppercase tracking-widest text-violet-500">
                            Note S{curTV.number}
                          </span>
                          <StarRating value={curTV.rating || 0}
                            onChange={r => { haptics.tap(); updateSeasonRating(entry.id, curTV.globalIndex, r); }} />
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-3 mb-2 gap-2 flex-wrap">
                        <p className="font-mono text-[11px] text-violet-400">{watched} / {curTV?.totalEpisodes ?? "?"} ép. vus</p>
                        <div className="flex items-center gap-2">
                          {canFinish && (
                            <button onClick={() => markDone(entry.id)}
                              className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 active:scale-95">
                              <Check size={10} /> Terminée
                            </button>
                          )}
                        </div>
                      </div>
                      {curTV && (
                        <div className="flex gap-1.5 sm:gap-2 mb-3 flex-wrap">
                          <button onClick={() => { haptics.tap(); decrementEpisode(entry.id, curTV.globalIndex); }}
                            className="font-mono text-xs px-3 py-1.5 rounded-lg bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95 transition-transform">-1 ép.</button>
                          {(curTV.totalEpisodes == null || curTV.watchedEpisodes < curTV.totalEpisodes) && (
                            <button onClick={() => { haptics.tap(); incrementEpisode(entry.id, curTV.globalIndex); }}
                              className="font-mono text-xs px-3 py-1.5 rounded-lg bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95 transition-transform">+1 ép.</button>
                          )}
                          {curTV.totalEpisodes != null && curTV.watchedEpisodes < curTV.totalEpisodes && (
                            <button onClick={handleMarkAllWatched}
                              className="font-mono text-xs px-3 py-1.5 rounded-lg bg-teal-500/15 text-teal-300 hover:bg-teal-500/30 active:scale-95 transition-transform flex items-center gap-1">
                              <CheckCheck size={12} />{hasNextTV ? "Tout → Suiv." : "Tout"}
                            </button>
                          )}
                        </div>
                      )}
                      {curTV && curTV.totalEpisodes != null && curTV.totalEpisodes > 0 && (
                        <EpisodeSlider watched={curTV.watchedEpisodes} total={curTV.totalEpisodes}
                          entryId={entry.id} globalIndex={curTV.globalIndex} setEpisodeCount={setEpisodeCount} />
                      )}
                      {loadingEps
                        ? <div className="flex items-center gap-2 text-violet-400 text-sm py-4"><Loader2 size={14} className="animate-spin" /> Chargement…</div>
                        : <EpisodeList episodes={curEps} totalEpisodes={curTV?.totalEpisodes} watched={watched}
                        unknownReason={curEpsReason}
                            statusColor={s.color} onSetEpisode={v => curTV && setEpisodeCount(entry.id, curTV.globalIndex, v)} />}
                    </div>
                  )}
                </div>
              )}

              {extraSeasons.length > 0 && (
                <div className="rounded-xl bg-white/[0.03] border border-white/5 overflow-hidden">
                  <div className="px-3 sm:px-4">
                    <AccordionHeader icon={<Disc2 size={15} />} label="OVA / Specials" count={extraSeasons.length}
                      summary={`${extW}${extT != null ? `/${extT}` : ""} ép.`}
                      isOpen={open.extra} onToggle={() => setOpen(p => ({ ...p, extra: !p.extra }))} />
                  </div>
                  {open.extra && (
                    <div className="px-3 sm:px-4 pb-3 space-y-1 pt-2">
                      {extraSeasons.map(se => {
                        const label = se.title || `${FMT_LABEL[se.format] ?? se.format} ${se.number}`;
                        const done  = se.totalEpisodes != null && se.watchedEpisodes >= se.totalEpisodes;
                        return (
                          <div key={se.globalIndex} className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0">
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-xs text-violet-200 break-words leading-tight">{label}</p>
                              <p className="font-mono text-[10px] text-violet-500 mt-0.5">
                                {String(se.watchedEpisodes).padStart(2, "0")}{se.totalEpisodes != null ? `/${String(se.totalEpisodes).padStart(2, "0")}` : "/?"} ép.
                              </p>
                              <div className="mt-1">
                                <RatingMeter value={se.rating || 0}
                                  onChange={r => { haptics.tap(); updateSeasonRating(entry.id, se.globalIndex, r); }} />
                              </div>
                            </div>
                            <div className="flex gap-1 flex-shrink-0 pt-0.5">
                              {se.watchedEpisodes > 0 && (
                                <button onClick={() => { haptics.tap(); decrementEpisode(entry.id, se.globalIndex); }}
                                  className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95">-1</button>
                              )}
                              {(se.totalEpisodes == null || se.watchedEpisodes < se.totalEpisodes) && (
                                <button onClick={() => { haptics.tap(); incrementEpisode(entry.id, se.globalIndex); }}
                                  className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95">+1</button>
                              )}
                              {se.totalEpisodes != null && !done && (
                                <button onClick={() => { haptics.success(); setEpisodeCount(entry.id, se.globalIndex, se.totalEpisodes); }}
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

              {movieSeasons.length > 0 && (
                <div className="rounded-xl bg-white/[0.03] border border-white/5 overflow-hidden">
                  <div className="px-3 sm:px-4">
                    <AccordionHeader icon={<Film size={15} />} label="Films" count={movieSeasons.length}
                      summary={`${filmSeen}/${movieSeasons.length} vu`}
                      isOpen={open.movie} onToggle={() => setOpen(p => ({ ...p, movie: !p.movie }))} />
                  </div>
                  {open.movie && (
                    <div className="px-3 sm:px-4 pb-3 space-y-1 pt-2">
                      {movieSeasons.map(se => {
                        const label = se.title || `Film ${se.number}`;
                        const seen  = se.watchedEpisodes >= (se.totalEpisodes ?? 1);
                        return (
                          <div key={se.globalIndex} className="flex items-start gap-2 py-1.5 border-b border-white/5 last:border-0">
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-xs text-violet-200 break-words leading-tight">{label}</p>
                              {se.totalEpisodes != null && se.totalEpisodes > 1 && (
                                <p className="font-mono text-[10px] text-violet-500 mt-0.5">{se.totalEpisodes} épisodes</p>
                              )}
                              <div className="mt-1">
                                <RatingMeter value={se.rating || 0}
                                  onChange={r => { haptics.tap(); updateSeasonRating(entry.id, se.globalIndex, r); }} />
                              </div>
                            </div>
                            <button onClick={() => { haptics.tap(); setEpisodeCount(entry.id, se.globalIndex, seen ? 0 : (se.totalEpisodes ?? 1)); }}
                              className={`font-mono text-[10px] px-2.5 py-1 rounded-full border transition-all active:scale-95 flex-shrink-0 mt-0.5 ${seen ? "bg-teal-500/20 border-teal-500/40 text-teal-300 hover:bg-teal-500/30" : "bg-white/5 border-white/10 text-violet-400 hover:bg-white/10 hover:text-violet-200"}`}>
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

              <div className="mx-3 sm:mx-4 mt-3 rounded-xl bg-white/[0.03] border border-white/5 overflow-hidden">
                <button type="button" onClick={() => setOpenEpisodes(v => !v)}
                  className="flex items-center justify-between w-full px-3 sm:px-4 py-3 text-left group select-none border-b border-white/5">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Tv size={15} className="text-violet-400 flex-shrink-0" />
                    <span className="font-mono text-[11px] uppercase tracking-widest text-violet-400 group-hover:text-violet-200 transition-colors">
                      Épisodes{curTV?.title ? ` — ${curTV.title}` : curTV ? ` — S${curTV.number}` : ""}
                    </span>
                    <span className="font-mono text-[11px] text-violet-600">({curTV?.totalEpisodes ?? "?"})</span>
                    {!openEpisodes && (
                      <span className="font-mono text-[11px] text-violet-500 truncate ml-1">
                        — {watched}{curTV?.totalEpisodes != null ? `/${curTV.totalEpisodes}` : ""} ép. vus
                      </span>
                    )}
                  </div>
                  <ChevronRight size={14} className={`flex-shrink-0 ml-2 text-violet-500 group-hover:text-violet-300 transition-all duration-200 ${openEpisodes ? "rotate-90" : ""}`} />
                </button>

                {openEpisodes && (
                  <div className="px-3 sm:px-4 pb-4 pt-3">
                    <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                      <p className="font-mono text-[11px] text-violet-400">{watched} / {curTV?.totalEpisodes ?? "?"} ép. vus</p>
                      {canFinish && (
                        <button onClick={() => markDone(entry.id)}
                          className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 active:scale-95">
                          <Check size={10} /> Terminée
                        </button>
                      )}
                    </div>
                    {curTV && (
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-violet-500">
                          Note{tvSeasons.length > 1 ? ` S${curTV.number}` : ""}
                        </span>
                        <StarRating value={curTV.rating || 0}
                          onChange={r => { haptics.tap(); updateSeasonRating(entry.id, curTV.globalIndex, r); }} />
                      </div>
                    )}
                    {curTV && (
                      <div className="flex gap-1.5 sm:gap-2 mb-3 flex-wrap">
                        <button onClick={() => { haptics.tap(); decrementEpisode(entry.id, curTV.globalIndex); }}
                          className="font-mono text-xs px-3 py-1.5 rounded-lg bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95 transition-transform">-1 ép.</button>
                        {(curTV.totalEpisodes == null || curTV.watchedEpisodes < curTV.totalEpisodes) && (
                          <button onClick={() => { haptics.tap(); incrementEpisode(entry.id, curTV.globalIndex); }}
                            className="font-mono text-xs px-3 py-1.5 rounded-lg bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95 transition-transform">+1 ép.</button>
                        )}
                        {curTV.totalEpisodes != null && curTV.watchedEpisodes < curTV.totalEpisodes && (
                          <button onClick={handleMarkAllWatched}
                            className="font-mono text-xs px-3 py-1.5 rounded-lg bg-teal-500/15 text-teal-300 hover:bg-teal-500/30 active:scale-95 transition-transform flex items-center gap-1">
                            <CheckCheck size={12} />{hasNextTV ? "Tout → Suiv." : "Tout"}
                          </button>
                        )}
                      </div>
                    )}
                    {curTV && curTV.totalEpisodes != null && curTV.totalEpisodes > 0 && (
                      <EpisodeSlider watched={curTV.watchedEpisodes} total={curTV.totalEpisodes}
                        entryId={entry.id} globalIndex={curTV.globalIndex} setEpisodeCount={setEpisodeCount} />
                    )}
                    {loadingEps
                      ? <div className="flex items-center gap-2 text-violet-400 text-sm py-6"><Loader2 size={14} className="animate-spin" /> Chargement…</div>
                      : <EpisodeList episodes={curEps} totalEpisodes={curTV?.totalEpisodes} watched={watched}
                        unknownReason={curEpsReason}
                          statusColor={s.color} onSetEpisode={v => curTV && setEpisodeCount(entry.id, curTV.globalIndex, v)} />
                    }
                  </div>
                )}
              </div>
              <div className="pb-4" />
            </>
          )}

          {(loadingRecs || dedupedRecs.length > 0) && (
            <div className="pt-1 pb-5 border-t border-white/5 mt-2">
              <div className="flex items-center gap-3 mx-3 sm:mx-4 my-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-500/30 to-violet-500/10" />
                <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-violet-500 whitespace-nowrap flex-shrink-0">
                  Recommandations similaires
                </p>
                <div className="h-px flex-1 bg-gradient-to-l from-transparent via-violet-500/30 to-violet-500/10" />
              </div>
              {loadingRecs
                ? <div className="flex items-center justify-center py-8"><Loader2 size={18} className="animate-spin text-violet-500" /></div>
                : <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none px-3 sm:px-4">
                    {dedupedRecs.map(rec => (
                      <RecCard key={`${rec.source}-${rec.id}`} rec={rec} onAdd={handleAddRec}
                        adding={addingId === rec.id}
                        alreadyInLib={isRecAlreadyInLibrary(rec)}
                        onClick={() => setSynopsisRec(rec)} />
                    ))}
                  </div>}
              {addError && (
                <p className="mx-3 sm:mx-4 mt-2 text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  {addError}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {synopsisRec && (
        <SynopsisModal rec={synopsisRec} onClose={() => setSynopsisRec(null)}
          onAdd={handleAddRec} adding={addingId === synopsisRec.id}
          alreadyInLib={isRecAlreadyInLibrary(synopsisRec)} />
      )}
      {addToListOpen && <AddToListModal entry={entry} onClose={() => setAddToListOpen(false)} />}
      {editing && <TitleFormModal editingEntry={entry} onClose={() => setEditing(false)} />}
    </div>
    </>
  );
}