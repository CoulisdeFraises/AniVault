import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { AnimatePresence } from "motion/react";
import { X, Pencil, Star, Loader2, RefreshCw, Film, Tv, Disc2, Clapperboard,
         CheckCheck, ChevronRight, ChevronDown, Check, Heart, ListPlus, AlertTriangle, WifiOff,
         Plus, Minus, CalendarClock, MoreHorizontal } from "lucide-react";
import { EpisodeList }             from "../components/EpisodeList/EpisodeList";
import { RatingBadge, CompanionPeek, getRatingImageSrc } from "../components/common/Rating";
import { RatingPicker, RATING_LABELS } from "../components/common/RatingPicker";
import { TitleFormModal }          from "../components/Modal/TitleFormModal";
import { STATUS, STATUS_ORDER, seasonTotals, formatRating, getDisplayStatus }    from "../utils/status";
import { useLibrary }              from "../context/LibraryContext";
import { fetchSeasonInfo, importResult, refreshEntryCard, fetchNextAiring } from "../api";
import { fetchAniListRecommendations, fetchSimilarTitles } from "../api/recommendations";
import { fetchTMDBSimilarMovies, fetchTMDBSimilarSeries, hasTMDB } from "../api/tmdb";
import { SynopsisModal }  from "../components/common/SynopsisModal";
import { WatchProviders } from "../components/common/WatchProviders";
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

function RecCard({ rec, onAdd, adding, alreadyInLib, onClick, fluid = false }) {
  return (
    <div onClick={onClick}
      className={`relative ${fluid ? "w-full" : "flex-shrink-0 w-24"} rounded-xl overflow-hidden bg-white/[0.04] border border-white/5 group cursor-pointer active:scale-[0.97] transition-transform`}>
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

const doneOf = (se) => se.totalEpisodes != null && se.watchedEpisodes >= se.totalEpisodes;

/**
 * Carte « Continuer » — toujours visible sous l'en-tête, quel que soit l'onglet.
 * C'est LE raccourci pour avancer : un gros bouton +1 sous le pouce.
 */
function ContinueCard({ kind, se, title, color, nextEpName, nextAiringLabel, hasNextSeason, canFinish,
                        onPlus, onMinus, onAll, onToggleMovie, onNextSeason, onFinish, onRate }) {
  if (!se) return null;
  const isMovie = kind === "movie";
  const total   = se.totalEpisodes;
  const watched = se.watchedEpisodes || 0;
  const done    = isMovie ? watched >= (total ?? 1) : doneOf(se);
  const pct     = isMovie ? (done ? 100 : 0) : total > 0 ? Math.min(100, (watched / total) * 100) : 0;
  const kicker  = isMovie ? (done ? "Film vu" : "À regarder") : done ? "Saison terminée" : "Prochain épisode";
  const sub     = isMovie
    ? null
    : done
      ? `${total} épisodes vus`
      : `Ép. ${watched + 1}${nextEpName ? ` — ${nextEpName}` : ""}`;

  const glow  = { background: `linear-gradient(135deg, ${color}, ${color}cc)`, boxShadow: `0 10px 24px -8px ${color}aa` };
  const cta   = "flex-shrink-0 inline-flex items-center justify-center gap-2 min-h-[46px] pl-2 pr-4 rounded-2xl font-bold text-sm text-violet-950 active:scale-95 transition-transform motion-reduce:transition-none";
  const dot   = "w-7 h-7 rounded-full bg-black/15 flex items-center justify-center flex-shrink-0";
  const ghost = "inline-flex items-center justify-center gap-1.5 min-h-[36px] px-3 rounded-xl bg-white/[0.06] border border-white/10 text-violet-100 text-xs font-medium hover:bg-white/10 active:scale-95 transition-all motion-reduce:transition-none";

  return (
    <div className="rounded-2xl border border-white/10 p-3"
      style={{ background: `linear-gradient(135deg, ${color}18, rgba(255,255,255,0.04) 60%)` }}>
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color }}>{kicker}</p>
          <p className="text-sm font-semibold text-violet-50 truncate leading-snug">{title}</p>
          {sub && <p className="text-[11px] text-violet-300 truncate">{sub}</p>}
        </div>

        {isMovie ? (
          done ? (
            <button onClick={onToggleMovie} aria-pressed="true" className={`${ghost} min-h-[44px] px-4 text-sm`}>
              <Check size={16} strokeWidth={3} style={{ color }} />Vu
            </button>
          ) : (
            <button onClick={onToggleMovie} className={cta} style={glow}>
              <span className={dot}><Check size={16} strokeWidth={3} /></span>Marquer vu
            </button>
          )
        ) : done ? (
          hasNextSeason ? (
            <button onClick={onNextSeason} className={`${cta} pl-5`} style={glow}>
              Saison suivante<ChevronRight size={18} strokeWidth={3} />
            </button>
          ) : canFinish ? (
            <button onClick={onFinish} className={cta} style={glow}>
              <span className={dot}><CheckCheck size={16} strokeWidth={3} /></span>Terminer
            </button>
          ) : null
        ) : (
          <button onClick={onPlus} aria-label="Marquer l'épisode suivant comme vu" className={cta} style={glow}>
            <span className={dot}><Plus size={18} strokeWidth={3} /></span>1 épisode
          </button>
        )}
      </div>

      {!isMovie && (
        <>
          <div className="mt-2.5 h-1.5 rounded-full bg-white/10 overflow-hidden" role="progressbar"
               aria-valuemin={0} aria-valuemax={total ?? undefined} aria-valuenow={watched}>
            <div className="h-full rounded-full transition-all duration-300 motion-reduce:transition-none"
              style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}99, ${color})`, boxShadow: `0 0 10px ${color}88` }} />
          </div>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="font-mono text-[11px] text-violet-300">{watched}{total != null ? ` / ${total}` : ""} ép.</span>
            {nextAiringLabel && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-violet-400">
                <CalendarClock size={11} />{nextAiringLabel}
              </span>
            )}
            <span className="flex-1" />
            {watched > 0 && (
              <button onClick={onMinus} aria-label="Retirer un épisode vu" className={ghost}>
                <Minus size={14} />1 ép.
              </button>
            )}
            {total != null && !done && (
              <button onClick={onAll}
                className={`${ghost} !bg-teal-400/10 !border-teal-400/25 !text-teal-300 hover:!bg-teal-400/20`}>
                <CheckCheck size={14} />Tout voir
              </button>
            )}
          </div>
          {done && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <p className="font-mono text-[10px] uppercase tracking-widest text-violet-400">Ta note pour cette saison</p>
              <RatingPicker value={se.rating || 0} onChange={onRate} size="sm" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TabBar({ tabs, active, onChange, color }) {
  return (
    <div role="tablist" className="flex px-3 sm:px-4 mt-2 border-b border-white/5 flex-shrink-0">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button key={t.id} role="tab" aria-selected={on} onClick={() => onChange(t.id)}
            className={`relative flex-1 min-h-[44px] text-xs font-medium transition-colors ${on ? "text-violet-50" : "text-violet-400 hover:text-violet-200"}`}>
            {t.label}{t.badge ? <span className="ml-1 font-mono text-[10px] text-violet-500">{t.badge}</span> : null}
            {on && <span className="absolute inset-x-4 -bottom-px h-0.5 rounded-full" style={{ backgroundColor: color }} />}
          </button>
        );
      })}
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
  const isStandaloneFilm  = tvSeasons.length === 0 && extraSeasons.length === 0 && movieSeasons.length > 0;
  // Un titre 100% OVA/ONA/Spécial (sans saison TV ni film) doit lui aussi
  // passer par l'affichage "multi-sections" : sinon il tombe dans la mise en
  // page pensée pour une saison TV unique (curTV), qui ne sait pas gérer les
  // extras, et impossible de cocher le moindre épisode.
  const isStandaloneExtra = tvSeasons.length === 0 && movieSeasons.length === 0 && extraSeasons.length > 0;
  const hasMulti = [tvSeasons.length > 0, extraSeasons.length > 0, movieSeasons.length > 0]
    .filter(Boolean).length > 1 || isStandaloneFilm || isStandaloneExtra;

  const [activeTVIdx,    setActiveTVIdx]   = useState(0);
  const [open,           setOpen]          = useState({ tv: false, extra: isStandaloneExtra, movie: isStandaloneFilm });
  const [tab,           setTab]           = useState("apercu");
  const [synopsisOpen,  setSynopsisOpen]  = useState(false);
  const [statusMenu,    setStatusMenu]    = useState(false);
  const [moreOpen,      setMoreOpen]      = useState(false);
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
    // Saison de départ : la première pas encore terminée (sinon la dernière).
    const firstOpen = tvSeasons.findIndex(se => se.totalEpisodes == null || se.watchedEpisodes < se.totalEpisodes);
    setActiveTVIdx(firstOpen >= 0 ? firstOpen : Math.max(0, tvSeasons.length - 1));
    setSeasonCache({});
    setOpen({
      tv: false,
      extra: (entry?.seasons || []).length > 0 &&
            (entry?.seasons || []).every(s => getFormatGroup(s.format) === "extra"),
      movie: (entry?.seasons || []).length > 0 &&
            (entry?.seasons || []).every(s => getFormatGroup(s.format) === "movie"),
    });
    setTab("apercu");
    setSynopsisOpen(false);
    setStatusMenu(false);
    setMoreOpen(false);
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
  // Les saisons de format "MOVIE" sont exclues : leur passage à "vu" a déjà sa
  // propre célébration dédiée ("Film vu !", déclenchée par le toggle dans la
  // section Films), pour éviter un doublon avec "Saison X terminée !".
  useEffect(() => {
    if (!entry) return;
    const prevMap = prevSeasonWatchedRef.current;
    entry.seasons.forEach((s, i) => {
      if (s.format === "MOVIE") return;
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
  // Un statut qui bascule sur "termine" alors qu'un prochain épisode est déjà
  // annoncé (nextAiring) ne signifie pas que la série est finie : on vient
  // seulement de rattraper tous les épisodes sortis (ex. total encore égal au
  // nombre d'épisodes diffusés à ce jour). Dans ce cas c'est "À jour !" qu'il
  // faut afficher, pas "Série terminée !" — l'effet de correction juste après
  // (ligne ~222) remet d'ailleurs le statut à "en-cours" dans la foulée.
  //
  // Pour un film (entry.category === "movie"), un statut "termine" signifie
  // juste "vu" : ce n'est pas une série, donc ni "Série terminée !" ni
  // "À jour !" n'ont de sens ici — le toggle "Vu"/"Pas vu" déclenche déjà sa
  // propre célébration ("Film vu !", tier "movie"), donc on ignore ce cas.
  useEffect(() => {
    if (!entry) return;
    const prev = prevStatusRef.current;
    if (prev != null && prev !== "termine" && entry.status === "termine" && entry.category !== "movie") {
      if (nextAiring?.airingAt) {
        triggerCelebration({ tier: "caughtup", title: "À jour !", subtitle: entry.title });
      } else {
        triggerCelebration({ tier: "series", title: "Série terminée !", subtitle: entry.title });
      }
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
          saveEntry({ ...entry, status: "en-cours" }, entry.id, true);
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
          updateSeasonTotal(entry.id, curSeason.globalIndex, data.totalEpisodes, true);
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
  const s       = STATUS[getDisplayStatus(entry, nextAiring)] ?? STATUS["a-voir"];
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
  const companionImgSrc = entry.rating > 0 ? getRatingImageSrc(entry.rating) : null;
  const FMT_LABEL     = { OVA: "OAV", ONA: "ONA", SPECIAL: "Spécial", TV_SHORT: "Court", MUSIC: "Musique" };

  // ── Carte « Continuer » : la saison sur laquelle on agit en priorité ──
  const focusExtra = extraSeasons.find(se => !doneOf(se)) ?? extraSeasons[0] ?? null;
  const focusMovie = movieSeasons.find(se => !(se.watchedEpisodes >= (se.totalEpisodes ?? 1))) ?? movieSeasons[0] ?? null;
  const focusKind  = curTV ? "tv" : focusExtra ? "extra" : focusMovie ? "movie" : null;
  const focusSe    = curTV ?? focusExtra ?? focusMovie;
  const nextEpName = curTV ? (curEps[watched]?.name || null) : null;
  const nextAiringLabel = Number.isFinite(Number(nextAiring?.airingAt))
    ? `${nextAiring.episode ? `Ép. ${nextAiring.episode} · ` : ""}${new Date(nextAiring.airingAt).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}`
    : null;

  function toggleMovie(se) {
    haptics.tap();
    const label = se.title || `Film ${se.number}`;
    const willBeSeen = !(se.watchedEpisodes >= (se.totalEpisodes ?? 1));
    setEpisodeCount(entry.id, se.globalIndex, willBeSeen ? (se.totalEpisodes ?? 1) : 0);
    if (willBeSeen) triggerCelebration({ tier: "movie", title: "Film vu !", subtitle: label });
  }

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

  // ── Onglets ───────────────────────────────────────────────────────────
  const hasEpisodesTab = tvSeasons.length > 0 || extraSeasons.length > 0;
  const tabs = [
    { id: "apercu",   label: "Aperçu" },
    { id: "episodes", label: hasEpisodesTab ? "Épisodes" : "Films", badge: hasEpisodesTab ? (tvT != null && tvT > 0 ? `${tvW}/${tvT}` : null) : `${filmSeen}/${movieSeasons.length}` },
    { id: "notes",    label: "Notes" },
    ...((loadingRecs || dedupedRecs.length > 0) ? [{ id: "similaires", label: "Similaires" }] : []),
  ];
  const activeTab = tabs.some(t => t.id === tab) ? tab : "apercu";
  const headerImage = displayImage || fallbackImage;
  const descLong = (entry.description || "").length > 220;

  // Boutons ronds posés sur l'image : fond sombre translucide pour rester lisibles sur n'importe quelle affiche.
  const heroBtn = "w-10 h-10 rounded-full flex items-center justify-center text-white/90 bg-black/40 backdrop-blur-sm hover:bg-black/55 active:scale-95 transition-all motion-reduce:transition-none";
  const menuItem = "w-full flex items-center gap-3 min-h-[44px] px-3 rounded-xl text-sm text-violet-100 hover:bg-white/10 active:bg-white/15 disabled:opacity-40 text-left";

  function renderExtras() {
    return (
      <div className="rounded-2xl bg-white/[0.03] border border-white/5 overflow-hidden">
        {!isStandaloneExtra && (
          <div className="px-3 sm:px-4">
            <AccordionHeader icon={<Disc2 size={15} />} label="OVA / Specials" count={extraSeasons.length}
              summary={`${extW}${extT != null ? `/${extT}` : ""} ép.`}
              isOpen={open.extra} onToggle={() => setOpen(p => ({ ...p, extra: !p.extra }))} />
          </div>
        )}
        {(isStandaloneExtra || open.extra) && (
          <div className="px-3 sm:px-4 pb-3 space-y-3 pt-2">
            {extraSeasons.map(se => {
              const label = se.title || `${FMT_LABEL[se.format] ?? se.format} ${se.number}`;
              const done  = doneOf(se);
              return (
                <div key={se.globalIndex} className="pb-3 border-b border-white/5 last:border-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-violet-200 break-words leading-tight">{label}</p>
                      <p className="font-mono text-[10px] text-violet-500 mt-0.5">
                        {String(se.watchedEpisodes).padStart(2, "0")}{se.totalEpisodes != null ? `/${String(se.totalEpisodes).padStart(2, "0")}` : "/?"} ép.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {se.watchedEpisodes > 0 && (
                        <button onClick={() => { haptics.tap(); decrementEpisode(entry.id, se.globalIndex); }} aria-label="Retirer un épisode vu"
                          className="min-h-[36px] min-w-[36px] font-mono text-xs px-2 rounded-lg bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95">−1</button>
                      )}
                      {(se.totalEpisodes == null || !done) && (
                        <button onClick={() => { haptics.tap(); incrementEpisode(entry.id, se.globalIndex); }} aria-label="Marquer un épisode de plus comme vu"
                          className="min-h-[36px] min-w-[36px] font-mono text-xs px-2 rounded-lg bg-white/10 text-violet-200 hover:bg-white/20 active:scale-95">+1</button>
                      )}
                      {se.totalEpisodes != null && !done && (
                        <button onClick={() => { haptics.success(); setEpisodeCount(entry.id, se.globalIndex, se.totalEpisodes); }}
                          className="min-h-[36px] font-mono text-xs px-2.5 rounded-lg bg-teal-500/15 text-teal-300 hover:bg-teal-500/30 active:scale-95 flex items-center gap-1">
                          <CheckCheck size={12} /> Tout
                        </button>
                      )}
                    </div>
                  </div>
                  {se.totalEpisodes != null && (
                    <div className="mt-2">
                      <EpisodeList episodes={[]} totalEpisodes={se.totalEpisodes} watched={se.watchedEpisodes}
                        statusColor={s.color}
                        onSetEpisode={v => { haptics.tap(); setEpisodeCount(entry.id, se.globalIndex, v); }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderMovies() {
    return (
      <div className="rounded-2xl bg-white/[0.03] border border-white/5 overflow-hidden">
        {!isStandaloneFilm && (
          <div className="px-3 sm:px-4">
            <AccordionHeader icon={<Film size={15} />} label="Films" count={movieSeasons.length}
              summary={`${filmSeen}/${movieSeasons.length} vu`}
              isOpen={open.movie} onToggle={() => setOpen(p => ({ ...p, movie: !p.movie }))} />
          </div>
        )}
        {(isStandaloneFilm || open.movie) && (
          <div className="px-3 sm:px-4 pb-2 pt-1">
            {movieSeasons.map(se => {
              const label = se.title || `Film ${se.number}`;
              const seen  = se.watchedEpisodes >= (se.totalEpisodes ?? 1);
              return (
                <div key={se.globalIndex} className="flex items-center justify-between gap-2 py-2 border-b border-white/5 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm text-violet-100 break-words leading-tight">{label}</p>
                    {se.totalEpisodes != null && se.totalEpisodes > 1 && (
                      <p className="font-mono text-[10px] text-violet-500 mt-0.5">{se.totalEpisodes} épisodes</p>
                    )}
                  </div>
                  <button onClick={() => toggleMovie(se)} aria-pressed={seen}
                    className={`min-h-[40px] font-mono text-xs px-4 rounded-full border transition-all active:scale-95 flex-shrink-0 ${seen ? "bg-teal-500/20 border-teal-500/40 text-teal-300 hover:bg-teal-500/30" : "bg-white/5 border-white/15 text-violet-300 hover:bg-white/10"}`}>
                    {seen ? "✓ Vu" : "Pas vu"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <Confetti active={!!celebration} intensity={celebration?.tier === "series" ? "series" : celebration?.tier === "caughtup" ? "caughtup" : "season"} />
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
        className="bg-violet-950 border border-white/10 flex flex-col w-full
          rounded-t-3xl max-h-[92dvh] h-[92dvh]
          sm:rounded-2xl sm:max-w-2xl sm:max-h-[92vh] sm:h-[88vh]
          animate-slideUp sm:animate-none overflow-hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >

        {/* ── En-tête : l'image occupe toute la largeur, titre / statut / note par-dessus ── */}
        <div className="relative flex-shrink-0">
          <div className="relative h-56 sm:h-72">
            <div className="absolute inset-0 overflow-hidden">
              {headerImage
                ? <img src={headerImage} alt="" loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ objectPosition: "center 22%" }} />
                : <div className="absolute inset-0 bg-gradient-to-br from-violet-800 to-violet-950" />}
              {!displayImage && showFallback && <div className="absolute inset-0 bg-black/60" />}
              <div className="absolute inset-0 bg-gradient-to-t from-violet-950 via-violet-950/60 to-black/25" />
            </div>

            {/* Poignée — mobile uniquement */}
            <div className="sm:hidden absolute top-0 inset-x-0 flex justify-center pt-3 pb-3 touch-none select-none z-10"
              onTouchStart={handleDragTouchStart} onTouchEnd={handleDragTouchEnd}>
              <div className="w-10 h-1 rounded-full bg-white/50" />
            </div>

            {/* Actions : favori, menu « … », fermer */}
            <div className="absolute top-3 sm:top-4 right-3 sm:right-4 flex items-center gap-2 z-10">
              <button onClick={() => { haptics.light(); toggleFavorite(entry); }}
                aria-label={isInFavorites(entry.id) ? "Retirer des favoris" : "Ajouter aux favoris"}
                className={`${heroBtn} ${isInFavorites(entry.id) ? "!text-pink-400" : ""}`}>
                <Heart size={18} fill={isInFavorites(entry.id) ? "currentColor" : "none"} />
              </button>
              <button onClick={() => setMoreOpen(v => !v)} aria-label="Plus d'actions" aria-haspopup="menu" aria-expanded={moreOpen}
                className={heroBtn}>
                <MoreHorizontal size={20} />
              </button>
              <button onClick={closeDetails} aria-label="Fermer" className={heroBtn}>
                <X size={20} />
              </button>
            </div>

            {/* Titre, statut, note */}
            <div className="absolute bottom-0 inset-x-0 px-4 sm:px-6 pb-3">
              <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-violet-200 mb-1 max-w-full">
                {entry.category === "movie" ? <Clapperboard size={11} /> : entry.type === "anime" ? <Film size={11} /> : <Tv size={11} />}
                {entry.category === "movie" ? "Film" : entry.type === "anime" ? "Anime" : "Série"}
                {entry.genres?.length > 0 && <span className="text-violet-300/70 normal-case tracking-normal truncate">· {entry.genres.slice(0, 2).join(", ")}</span>}
              </span>
              <h2 className="text-xl sm:text-3xl font-bold text-white leading-tight line-clamp-2 drop-shadow-lg"
                style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{entry.title}</h2>

              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <button onClick={() => { setStatusMenu(v => !v); setMoreOpen(false); }} aria-expanded={statusMenu} aria-label="Changer le statut"
                  className={`inline-flex items-center gap-1.5 min-h-[34px] pl-3 pr-2 rounded-full bg-black/45 backdrop-blur-sm border border-white/15 text-xs font-medium active:scale-95 transition-transform ${s.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{s.label}
                  <ChevronDown size={13} className={`transition-transform ${statusMenu ? "rotate-180" : ""}`} />
                </button>
                <button onClick={() => setTab("notes")} aria-label="Voir mes notes"
                  className="inline-flex items-center gap-1 min-h-[34px] px-3 rounded-full bg-black/45 backdrop-blur-sm border border-white/15 text-xs font-bold text-white active:scale-95 transition-transform">
                  <Star size={12} fill="#fbbf24" strokeWidth={0} />{formatRating(entry.rating) || "—"}<span className="text-violet-300/70 font-normal">/10</span>
                </button>
              </div>
            </div>
          </div>

          {/* Menu « … » */}
          {moreOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMoreOpen(false)} aria-hidden="true" />
              <div role="menu" aria-label="Plus d'actions"
                className="absolute right-3 sm:right-4 top-[3.75rem] sm:top-[4.25rem] z-30 w-60 rounded-2xl bg-violet-900 border border-white/10 shadow-xl shadow-black/50 p-1 animate-fadeIn">
                <button role="menuitem" className={menuItem} onClick={() => { setMoreOpen(false); setAddToListOpen(true); }}>
                  <ListPlus size={17} className="text-violet-300" />Ajouter à une liste
                </button>
                {(entry.source === "anilist" || entry.source === "tvmaze") && (
                  <button role="menuitem" className={menuItem} disabled={refreshingCard}
                    onClick={() => { setMoreOpen(false); handleRefreshCard(); }}>
                    <RefreshCw size={17} className={`text-violet-300 ${refreshingCard ? "animate-spin" : ""}`} />
                    <span>Chercher de nouveaux contenus<span className="block text-[10px] text-violet-400">Saisons, OVA, films</span></span>
                  </button>
                )}
                <button role="menuitem" className={menuItem} onClick={() => { setMoreOpen(false); setEditing(true); }}>
                  <Pencil size={17} className="text-violet-300" />Modifier
                </button>
              </div>
            </>
          )}

          {statusMenu && (
            <div className="flex gap-1.5 px-4 sm:px-6 pt-3 pb-1 overflow-x-auto scrollbar-none animate-fadeIn" role="menu" aria-label="Statut">
              {STATUS_ORDER.map(k => {
                const st = STATUS[k];
                const on = entry.status === k;
                return (
                  <button key={k} role="menuitemradio" aria-checked={on}
                    onClick={() => { haptics.tap(); if (!on) saveEntry({ ...entry, status: k }, entry.id); setStatusMenu(false); }}
                    className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-full border text-xs flex-shrink-0 transition-colors ${on ? `${st.border} ${st.text} bg-white/10` : "border-white/10 text-violet-300 hover:bg-white/5"}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Bannière résultat actualisation ── */}
        {refreshResult !== null && (
          <div className={`mx-4 sm:mx-6 mt-1 px-3 py-2 rounded-xl flex items-center gap-2 text-xs font-mono animate-fadeIn flex-shrink-0 ${
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
            <button onClick={() => setRefreshResult(null)} aria-label="Fermer" className="flex-shrink-0 p-1 opacity-60 hover:opacity-100 transition-opacity">
              <X size={12} />
            </button>
          </div>
        )}

        <TabBar tabs={tabs} active={activeTab} onChange={(t) => { haptics.tap(); setTab(t); }} color={s.color} />

        {/* ── Contenu de l'onglet (seule zone qui défile) ── */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" role="tabpanel">

          {/* ═══ Aperçu ═══ */}
          {activeTab === "apercu" && (
            <div className="p-3 sm:p-4 space-y-4 animate-fadeIn">
              {/* ── Encart principal : prochain épisode / progression ── */}
              <ContinueCard
                kind={focusKind}
                se={focusSe}
                title={focusKind === "tv"
                  ? (curTV.title || (tvSeasons.length > 1 ? `Saison ${curTV.number}` : entry.title))
                  : (focusSe?.title || (focusKind === "movie" ? `Film ${focusSe?.number ?? ""}` : focusSe ? `${FMT_LABEL[focusSe.format] ?? focusSe.format} ${focusSe.number}` : ""))}
                color={s.color}
                nextEpName={nextEpName}
                nextAiringLabel={nextAiringLabel}
                hasNextSeason={focusKind === "tv" && hasNextTV}
                canFinish={focusKind === "tv" && canFinish}
                onPlus={() => { haptics.tap(); incrementEpisode(entry.id, focusSe.globalIndex); }}
                onMinus={() => { haptics.tap(); decrementEpisode(entry.id, focusSe.globalIndex); }}
                onAll={() => { if (focusKind === "tv") handleMarkAllWatched(); else { haptics.success(); setEpisodeCount(entry.id, focusSe.globalIndex, focusSe.totalEpisodes); } }}
                onToggleMovie={() => toggleMovie(focusSe)}
                onNextSeason={() => { haptics.tap(); setActiveTVIdx(i => Math.min(i + 1, tvSeasons.length - 1)); setTab("episodes"); }}
                onFinish={() => markDone(entry.id)}
                onRate={r => { haptics.tap(); updateSeasonRating(entry.id, focusSe.globalIndex, r); }}
              />

              {entry.genres?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {entry.genres.map(g => (
                    <span key={g} className="px-2.5 py-1 rounded-full bg-white/5 border border-white/5 text-[11px] text-violet-300">{g}</span>
                  ))}
                </div>
              )}

              {entry.description ? (
                <div>
                  <p className={`text-sm text-violet-200/85 leading-relaxed whitespace-pre-line ${synopsisOpen ? "" : "line-clamp-5"}`}>{entry.description}</p>
                  {descLong && (
                    <button onClick={() => setSynopsisOpen(v => !v)}
                      className="mt-1 min-h-[36px] text-xs font-medium text-amber-300 hover:text-amber-200">
                      {synopsisOpen ? "Réduire" : "Lire la suite"}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-violet-500 italic">Aucun résumé disponible.</p>
              )}

              <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3">
                <WatchProviders
                  tmdbId={entry.tmdbId}
                  anilistId={entry.anilistIds?.[0]}
                  titles={[entry.title, entry.titleFrench]}
                  kind={entry.category === "movie" ? "movie" : "tv"}
                />
              </div>
            </div>
          )}

          {/* ═══ Épisodes ═══ */}
          {activeTab === "episodes" && (
            <div className="p-3 sm:p-4 space-y-3 animate-fadeIn">
              {tvSeasons.length > 0 && (
                <div className="space-y-2">
                  {tvSeasons.length > 1 && (
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1" role="tablist" aria-label="Saisons">
                      {tvSeasons.map((se, i) => (
                        <button key={se.globalIndex} role="tab" aria-selected={i === activeTVIdx}
                          onClick={() => { haptics.tap(); setActiveTVIdx(i); }} title={se.title || undefined}
                          className={`inline-flex items-center gap-1 min-h-[38px] px-3.5 rounded-full text-xs font-mono border flex-shrink-0 transition-colors ${i === activeTVIdx ? `${s.border} ${s.text} bg-white/10` : "border-white/10 text-violet-400 hover:bg-white/5"}`}>
                          S{se.number}{doneOf(se) && <Check size={12} />}
                        </button>
                      ))}
                    </div>
                  )}

                  {curTV && (
                    <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-3">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="min-w-0 truncate font-mono text-[11px] text-violet-300">{curTV.title || `Saison ${curTV.number}`}</p>
                        <p className="flex-shrink-0 font-mono text-[11px] text-violet-400">{watched} / {curTV.totalEpisodes ?? "?"} vus</p>
                      </div>
                      {curTV.totalEpisodes != null && curTV.totalEpisodes > 12 && (
                        <EpisodeSlider watched={curTV.watchedEpisodes} total={curTV.totalEpisodes}
                          entryId={entry.id} globalIndex={curTV.globalIndex} setEpisodeCount={setEpisodeCount} />
                      )}
                      <p className="text-[10px] text-violet-500 mb-2">Touche un épisode pour cocher tout jusqu'à celui-ci.</p>
                      {loadingEps
                        ? <div className="flex items-center gap-2 text-violet-400 text-sm py-6"><Loader2 size={14} className="animate-spin" /> Chargement…</div>
                        : <EpisodeList key={`${entry.id}-${curTV.globalIndex}`} autoScroll
                            episodes={curEps} totalEpisodes={curTV.totalEpisodes} watched={watched}
                            unknownReason={curEpsReason}
                            statusColor={s.color} onSetEpisode={v => setEpisodeCount(entry.id, curTV.globalIndex, v)} />}
                    </div>
                  )}
                </div>
              )}

              {extraSeasons.length > 0 && renderExtras()}
              {movieSeasons.length > 0 && renderMovies()}
            </div>
          )}

          {/* ═══ Notes ═══ */}
          {activeTab === "notes" && (() => {
            const avg   = Math.round(entry.rating) || 0;
            const rated = (entry.seasons || []).filter(se => se.rating > 0).length;
            const groups = [
              { key: "tv",    label: "Saisons",        list: tvSeasons,    name: (se) => se.title ? `S${se.number} — ${se.title}` : `Saison ${se.number}` },
              { key: "extra", label: "OVA / Specials", list: extraSeasons, name: (se) => se.title || `${FMT_LABEL[se.format] ?? se.format} ${se.number}` },
              { key: "movie", label: "Films",          list: movieSeasons, name: (se) => se.title || `Film ${se.number}` },
            ].filter(g => g.list.length > 0);
            return (
              <div className="p-3 sm:p-4 space-y-3 animate-fadeIn">
                {/* Résumé compact */}
                <div className="relative rounded-2xl overflow-hidden border border-white/10 px-3.5 py-3 min-h-[5rem] flex items-center"
                  style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.16), rgba(76,29,149,0.34))" }}>
                  <div className={`flex items-center gap-3 ${companionImgSrc ? "pr-20 sm:pr-24" : ""}`}>
                    <div className="flex items-baseline gap-1 flex-shrink-0">
                      <Star size={20} fill={avg ? "#fbbf24" : "none"} strokeWidth={avg ? 0 : 1.5} className="self-center text-white/30" />
                      <span className="text-4xl font-bold leading-none" style={{ color: avg ? "#fbbf24" : "rgba(255,255,255,0.35)", fontFamily: "'Space Grotesk',sans-serif" }}>
                        {formatRating(entry.rating) || "—"}
                      </span>
                      <span className="text-xs text-violet-400">/10</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-violet-100 leading-tight">{avg ? RATING_LABELS[avg] : "Pas encore noté"}</p>
                      <p className="font-mono text-[10px] text-violet-400 mt-0.5">
                        {rated > 0 ? `Moyenne de ${rated}/${entry.seasons.length} noté${rated > 1 ? "s" : ""}` : "Note une saison ci-dessous"}
                      </p>
                    </div>
                    {avg > 0 && !companionImgSrc && <RatingBadge rating={entry.rating} className="text-2xl h-8 ml-auto" />}
                  </div>
                  {companionImgSrc && (
                    <CompanionPeek rating={entry.rating} className="bottom-0 right-1 h-20 sm:h-24 z-10" />
                  )}
                </div>

                {/* Notes par saison / OVA / film */}
                {groups.map(g => (
                  <section key={g.key} aria-label={g.label} className="space-y-1.5">
                    {(groups.length > 1 || g.list.length > 1) && (
                      <h3 className="px-1 font-mono text-[10px] uppercase tracking-widest text-violet-400">{g.label}</h3>
                    )}
                    {g.list.map(se => {
                      const r = Math.round(se.rating) || 0;
                      return (
                        <div key={se.globalIndex} className="rounded-xl bg-white/[0.04] border border-white/10 px-3 pt-2 pb-0.5">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="text-[13px] font-medium text-violet-100 truncate min-w-0">{g.name(se)}</p>
                            <p className="flex-shrink-0 font-mono text-[11px]" style={{ color: r ? "#fbbf24" : undefined }}>
                              {r ? <><b>{r}</b>/10 · <span className="text-violet-300">{RATING_LABELS[r]}</span></> : <span className="text-violet-500">Pas noté</span>}
                            </p>
                          </div>
                          <RatingPicker value={se.rating || 0} showLabel={false} size="sm"
                            onChange={v => { haptics.tap(); updateSeasonRating(entry.id, se.globalIndex, v); }} />
                        </div>
                      );
                    })}
                  </section>
                ))}

                {/* Avis personnel */}
                <section aria-label="Mon avis" className="rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-violet-400">Mon avis</h3>
                    {entry.notes && (
                      <button onClick={() => setEditing(true)} aria-label="Modifier mon avis"
                        className="w-8 h-8 -mr-1.5 rounded-full flex items-center justify-center text-violet-300 hover:bg-white/10 active:scale-95 transition-all">
                        <Pencil size={13} />
                      </button>
                    )}
                  </div>
                  {entry.notes ? (
                    <p className="text-[13px] text-violet-100 leading-relaxed whitespace-pre-line border-l-2 pl-2.5 mt-1" style={{ borderColor: s.color }}>{entry.notes}</p>
                  ) : (
                    <button onClick={() => setEditing(true)}
                      className="mt-1.5 w-full min-h-[40px] rounded-lg border border-dashed border-white/20 text-xs text-violet-300 hover:bg-white/5 active:scale-[0.99] transition-all flex items-center justify-center gap-1.5">
                      <Pencil size={13} />Écrire mon avis
                    </button>
                  )}
                </section>
              </div>
            );
          })()}

          {/* ═══ Similaires ═══ */}
          {activeTab === "similaires" && (
            <div className="p-3 sm:p-4 animate-fadeIn">
              {loadingRecs
                ? <div className="flex items-center justify-center py-10"><Loader2 size={18} className="animate-spin text-violet-500" /></div>
                : <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {dedupedRecs.map(rec => (
                      <RecCard key={`${rec.source}-${rec.id}`} rec={rec} fluid onAdd={handleAddRec}
                        adding={addingId === rec.id}
                        alreadyInLib={isRecAlreadyInLibrary(rec)}
                        onClick={() => setSynopsisRec(rec)} />
                    ))}
                  </div>}
              {addError && (
                <p className="mt-3 text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  {addError}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {synopsisRec && (
          <SynopsisModal key="synopsis" rec={synopsisRec} onClose={() => setSynopsisRec(null)}
            onAdd={handleAddRec} adding={addingId === synopsisRec.id}
            alreadyInLib={isRecAlreadyInLibrary(synopsisRec)} />
        )}
        {addToListOpen && <AddToListModal key="add-to-list" entry={entry} onClose={() => setAddToListOpen(false)} />}
        {editing && <TitleFormModal key="edit-title" editingEntry={entry} onClose={() => setEditing(false)} />}
      </AnimatePresence>
    </div>
    </>
  );
}
