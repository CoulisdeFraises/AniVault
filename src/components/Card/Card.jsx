import { memo, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Pencil, Trash2, Film, Tv, Disc2, Check, Star,
  RotateCcw, Heart, RefreshCw, ListPlus, Clapperboard,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLists }         from "../../context/ListsContext";
import { ConfirmDialog }    from "../Modal/Modal";
import { RatingBadge, CompanionPeek, getRatingImageSrc } from "../common/Rating";
import { STATUS, seasonTotals, formatCountdown, formatRating, getDisplayStatus } from "../../utils/status";
import { useLibrary }       from "../../context/LibraryContext";
import { fetchNextAiring, refreshEntryCard } from "../../api";
import { getShowProgress }  from "../../context/PrefsContext";
import { AddToListModal }   from "../common/AddToListModal";
import { getFormatGroup }   from "../../utils/format";
import { haptics }          from "../../utils/haptics";
import {
  CARD_OVERLAY_VARIANTS, CARD_OVERLAY_TRANSITION,
  CARD_BADGE_VARIANTS,   CARD_BADGE_TRANSITION,
} from "../../lib/motionVariants";

function getResumeStatus(entry) {
  const { watched, total } = seasonTotals(entry.seasons);
  if (total != null && total > 0 && watched >= total) return "termine";
  return watched > 0 ? "en-cours" : "a-voir";
}

const SWIPE_THRESHOLD = 72;
const LONG_PRESS_MS   = 500;

export const Card = memo(function Card({ entry, onEdit, index = 0, isAiring = false }) {
  const { markDone, deleteEntry, saveEntry, incrementEpisode, decrementEpisode } = useLibrary();
  const { isInFavorites, removeEntryEverywhere } = useLists();
  const isFavorite = isInFavorites(entry.id);
  const navigate   = useNavigate();
  const location   = useLocation();
  const seasons    = entry.seasons;
  const companionImgSrc = entry.rating > 0 ? getRatingImageSrc(entry.rating) : null;

  const tvSeasons    = useMemo(() => seasons.map((s, i) => ({ ...s, globalIndex: i })).filter(s => getFormatGroup(s.format) === "tv"),    [seasons]);
  const extraSeasons = useMemo(() => seasons.map((s, i) => ({ ...s, globalIndex: i })).filter(s => getFormatGroup(s.format) === "extra"), [seasons]);
  const movieSeasons = useMemo(() => seasons.map((s, i) => ({ ...s, globalIndex: i })).filter(s => getFormatGroup(s.format) === "movie"), [seasons]);

  const activeTVIdx = useMemo(() => {
    const i = tvSeasons.findIndex(s => s.totalEpisodes == null || s.watchedEpisodes < s.totalEpisodes);
    return i === -1 ? Math.max(0, tvSeasons.length - 1) : i;
  }, [tvSeasons]);

  // ── State UI ──────────────────────────────────────────────────────────────
  const [showDel,            setShowDel]            = useState(false);
  const [showAddToList,      setShowAddToList]      = useState(false);
  const [longPressMenu,      setLongPressMenu]      = useState(false);
  const [refreshing,         setRefreshing]         = useState(false);
  const [refreshResult,      setRefreshResult]      = useState(null);
  // refreshResult: { status: "ok" | "new" | "error", message: string } | null
  const [nextAiring,         setNextAiring]         = useState(null);

  // ── State swipe ──────────────────────────────────────────────────────────
  const [swipeX,    setSwipeX]    = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDir,  setSwipeDir]  = useState(null);

  const cardRef     = useRef(null);
  const wrapperRef  = useRef(null);
  const gesturedRef = useRef(false);
  const ptrRef      = useRef({ id: null, startX: 0, startY: 0, timer: null, axis: null });

  const isAbandoned = entry.status === "abandonne";
  const s           = STATUS[getDisplayStatus(entry, nextAiring)] ?? STATUS["a-voir"];
  const dimmed      = isAbandoned ? "opacity-50 grayscale" : "";
  const cur         = tvSeasons[Math.min(activeTVIdx, Math.max(0, tvSeasons.length - 1))] ?? null;
  // Saison ciblée par le swipe (épisode +1 / -1) : la saison TV en cours,
  // sinon le film, sinon la première saison disponible.
  const rateTarget  = cur ?? movieSeasons[0] ?? seasons.map((s, i) => ({ ...s, globalIndex: i }))[0] ?? null;

  const { watched: tvW,  total: tvT  } = useMemo(() => seasonTotals(tvSeasons),    [tvSeasons]);
  const { watched: totW, total: totT  } = useMemo(() => seasonTotals(seasons),      [seasons]);
  const { watched: extW, total: extT  } = useMemo(() => seasonTotals(extraSeasons), [extraSeasons]);
  const filmSeen  = movieSeasons.filter(m => m.watchedEpisodes >= (m.totalEpisodes ?? 1)).length;
  const canFinish = entry.status === "en-cours" && tvT != null && tvT > 0 && tvW >= tvT && !nextAiring?.airingAt;
  const canSwipeEpisode = !!rateTarget && entry.status !== "abandonne";

  // ── Progression de la saison ciblée par le swipe, pour la barre du bas ────
  const progressWatched = rateTarget?.watchedEpisodes ?? 0;
  const progressTotal   = rateTarget
    ? (rateTarget.totalEpisodes ?? (getFormatGroup(rateTarget.format) === "movie" ? 1 : null))
    : null;

  const showEnProduction = useMemo(() => {
    if (entry.status === "termine" || entry.status === "abandonne") return false;
    if (!tvSeasons.length) return false;
    const lastTV = tvSeasons[tvSeasons.length - 1];
    return lastTV.totalEpisodes == null || lastTV.totalEpisodes === 0;
  }, [entry.status, tvSeasons]);

  // ── FIX : auto-fermeture du menu 1,8s après résultat du refresh ──────────
  useEffect(() => {
    if (!refreshResult) return;
    const t = setTimeout(() => {
      setLongPressMenu(false);
      setRefreshResult(null);
      gesturedRef.current = false; // FIX : reset systématique
    }, 1800);
    return () => clearTimeout(t);
  }, [refreshResult]);

  // ── Actions ───────────────────────────────────────────────────────────────
  function handleResume(e) {
    e.stopPropagation();
    saveEntry({ ...entry, status: getResumeStatus(entry) }, entry.id);
  }

  // FIX : ne ferme plus le menu immédiatement, affiche le résultat inline
  async function handleRefresh(e) {
    e?.stopPropagation();
    setRefreshing(true);
    setRefreshResult(null);
    try {
      const result = await refreshEntryCard(entry);
      if (result) {
        saveEntry({
          ...entry,
          seasons: result.seasons,
          ...(result.anilistIds ? { anilistIds: result.anilistIds } : {}),
        }, entry.id);
        haptics.light();
        setRefreshResult(
          result.hasNewContent
            ? { status: "new",  message: `${result.newCount} nouveauté${result.newCount > 1 ? "s" : ""}` }
            : { status: "ok",   message: "Déjà à jour" }
        );
      } else {
        setRefreshResult({ status: "ok", message: "Aucune mise à jour" });
      }
    } catch (_) {
      haptics.error();
      setRefreshResult({ status: "error", message: "Erreur d'actualisation" });
    }
    setRefreshing(false);
    // Le menu se ferme seul via l'effect ci-dessus après 1,8s
  }

  // ── Pointer / gestes ──────────────────────────────────────────────────────
  function handlePointerDown(e) {
    if (longPressMenu || e.button > 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    ptrRef.current = {
      id:     e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      axis:   null,
      timer:  setTimeout(() => {
        gesturedRef.current = true;
        setLongPressMenu(true);
        setRefreshResult(null); // état propre à chaque ouverture
        haptics.longPress();
      }, LONG_PRESS_MS),
    };
  }

  function handlePointerMove(e) {
    if (ptrRef.current.id == null) return;
    const dx  = e.clientX - ptrRef.current.startX;
    const dy  = e.clientY - ptrRef.current.startY;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (!ptrRef.current.axis && (adx > 6 || ady > 6)) {
      ptrRef.current.axis = adx > ady ? "x" : "y";
    }
    if (adx > 8 || ady > 8) clearTimeout(ptrRef.current.timer);
    if (ptrRef.current.axis === "x") {
      gesturedRef.current = true;
      setIsSwiping(true);
      const clamped = Math.max(-120, Math.min(120, dx));
      setSwipeX(clamped);
      setSwipeDir(
        clamped > SWIPE_THRESHOLD  ? "right" :
        clamped < -SWIPE_THRESHOLD ? "left"  : null
      );
    }
  }

  function handlePointerUp(e) {
    clearTimeout(ptrRef.current.timer);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (isSwiping) {
      if (swipeDir === "left" && canSwipeEpisode)       { incrementEpisode(entry.id, rateTarget.globalIndex); haptics.light(); }
      else if (swipeDir === "right" && canSwipeEpisode) { decrementEpisode(entry.id, rateTarget.globalIndex); haptics.light(); }
      setSwipeX(0); setIsSwiping(false); setSwipeDir(null);
    }
    ptrRef.current.id = null;
  }

  function handlePointerCancel(e) {
    clearTimeout(ptrRef.current.timer);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setSwipeX(0); setIsSwiping(false); setSwipeDir(null);
    ptrRef.current.id = null;
  }

  function handleCardClick() {
    if (gesturedRef.current) { gesturedRef.current = false; return; }
    navigate(`/details/${entry.id}`, { state: { backgroundLocation: location } });
  }

  useEffect(() => {
    if (!longPressMenu) return;
    function handleOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setLongPressMenu(false);
        gesturedRef.current = false; // FIX : reset à la fermeture par clic extérieur
      }
    }
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [longPressMenu]);

  // ── Animations ────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = cardRef.current; if (!el) return;
    const d = Math.min(index * 45, 350);
    el.style.animation = `fadeInUp 0.35s ease-out ${d}ms both`;
    const t = setTimeout(() => { if (cardRef.current) cardRef.current.style.removeProperty("animation"); }, d + 380);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  useEffect(() => {
    // Un titre "abandonné" n'a pas besoin d'être vérifié. En revanche un
    // titre "Terminé" DOIT continuer d'être vérifié : c'est la seule façon
    // de détecter qu'un épisode futur est en fait déjà annoncé et de
    // corriger automatiquement un statut "Terminé" passé par erreur (ce qui
    // bloquait aussi la sync/les notifs, réservées aux titres "en-cours").
    if (entry.status === "abandonne") { setNextAiring(null); return; }
    if (!((entry.source === "anilist" && entry.anilistIds?.length) || (entry.source === "tvmaze" && entry.tvmazeId))) return;
    let c = false;
    const t = setTimeout(async () => {
      try {
        const r = await fetchNextAiring(entry);
        if (c) return;
        setNextAiring(r);
        if (r?.airingAt && entry.status === "termine") {
          saveEntry({ ...entry, status: "en-cours" }, entry.id);
        }
      } catch (_) {}
    }, Math.random() * 800);
    return () => { c = true; clearTimeout(t); };
  }, [entry.id, entry.source, entry.status, entry.anilistIds?.length, entry.tvmazeId]);

  const prevTvW = useRef(tvW);
  useEffect(() => {
    if (!cardRef.current) return;
    if (tvT != null && tvW >= tvT && prevTvW.current < tvT) {
      const el = cardRef.current;
      el.style.animation = "none"; void el.offsetWidth;
      el.style.animation = "seasonComplete 0.85s cubic-bezier(0.22,0.61,0.36,1) both";
      const t = setTimeout(() => { if (cardRef.current) cardRef.current.style.removeProperty("animation"); }, 950);
      return () => clearTimeout(t);
    }
    prevTvW.current = tvW;
  }, [tvW, tvT]);

  // ── Cover ─────────────────────────────────────────────────────────────────
  const coverImg = (() => {
    const img = cur?.coverImage || (activeTVIdx === 0 ? entry.coverImage : null);
    const fb  = tvSeasons[0]?.coverImage || entry.coverImage;
    const sf  = !img && activeTVIdx > 0 && fb;
    if (!img && !sf) return null;
    return (
      <div className="relative flex-shrink-0 self-start">
        {img ? (
          <div className={`aspect-[2/3] max-h-36 rounded-lg overflow-hidden bg-white/5 ${dimmed}`}>
            <img src={img} alt="" loading="lazy" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className={`relative aspect-[2/3] max-h-36 rounded-lg overflow-hidden bg-white/5 ${dimmed}`}>
            <img src={fb} alt="" className="w-full h-full object-cover brightness-[0.25]" />
            <span className="absolute inset-0 flex items-center justify-center text-5xl font-bold text-white/50">?</span>
          </div>
        )}
        {isFavorite && (
          <div className="absolute -top-1.5 -right-1.5 z-10 flex items-center justify-center w-5 h-5 rounded-full bg-pink-500/90 shadow-md shadow-pink-500/50">
            <Heart size={9} fill="white" className="text-white" />
          </div>
        )}
      </div>
    );
  })();

  const swipeRevealOpacity = (val, dir) =>
    dir === "right" ? Math.min(1, val / SWIPE_THRESHOLD) : Math.min(1, Math.abs(val) / SWIPE_THRESHOLD);

  return (
    <>
      <div ref={wrapperRef} className="relative select-none" style={{ touchAction: "pan-y" }}>

        {/* Reveal DROITE : Épisode -1 */}
        {canSwipeEpisode && (
          <div className="absolute inset-0 rounded-2xl flex items-center pl-5 pointer-events-none"
            style={{ background: "rgb(244 63 94 / 0.18)", opacity: swipeX > 0 ? swipeRevealOpacity(swipeX, "right") : 0 }}>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-2xl font-bold text-rose-300" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>−1</span>
              <span className="font-mono text-[9px] text-rose-300 uppercase tracking-wide">Épisode</span>
            </div>
          </div>
        )}

        {/* Reveal GAUCHE : Épisode +1 */}
        {canSwipeEpisode && (
          <div className="absolute inset-0 rounded-2xl flex items-center justify-end pr-5 pointer-events-none"
            style={{ background: "rgb(45 212 191 / 0.18)", opacity: swipeX < 0 ? swipeRevealOpacity(swipeX, "left") : 0 }}>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-2xl font-bold text-teal-300" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>+1</span>
              <span className="font-mono text-[9px] text-teal-300 uppercase tracking-wide">Épisode</span>
            </div>
          </div>
        )}

        {/* ── Carte principale ── */}
        <div
          ref={cardRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onClick={handleCardClick}
          style={{
            transform:  `translateX(${swipeX}px)`,
            transition: isSwiping ? "none" : "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
          }}
          className={`relative card-noise rounded-2xl overflow-hidden bg-violet-900/30 p-3 sm:p-4 flex gap-2 sm:gap-3 cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-950/60 hover:bg-violet-800/40 transition-shadow motion-reduce:transition-none ${
            isAiring
              ? "border border-teal-400/60 shadow-[0_0_14px_-2px_rgba(45,212,191,0.55)]"
              : "border-t border-r border-b border-white/5"
          }`}
        >
          <div className="absolute inset-y-0 left-0 w-[3px] rounded-l-2xl"
            style={{ background: `linear-gradient(to bottom,${s.color},${s.color}50,${s.color}10)` }} />

          {coverImg}

          <div className="flex-1 min-w-0 flex flex-col gap-1.5 sm:gap-2 relative z-10">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-violet-300 whitespace-nowrap ${dimmed}`}>
                  {entry.category === "movie" ? <Clapperboard size={10} /> : entry.type === "anime" ? <Film size={10} /> : <Tv size={10} />}
                  {entry.category === "movie" ? "Film" : entry.type === "anime" ? "Anime" : "Série"}
                </span>
                <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/5 whitespace-nowrap ${s.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                  {s.label}
                </span>
                {showEnProduction && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-400/15 border border-indigo-400/25 text-indigo-300 whitespace-nowrap">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse flex-shrink-0" />
                    En Production
                  </span>
                )}
              </div>
              <h3 className={`font-semibold text-sm sm:text-base text-violet-50 leading-tight truncate ${dimmed}`}
                style={{ fontFamily: "'Space Grotesk',sans-serif" }} title={entry.title}>{entry.title}</h3>
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

            {entry.genres.length > 0 && (
              <div className={`flex gap-1 overflow-hidden ${dimmed}`}>
                {entry.genres.slice(0, 3).map(g =>
                  <span key={g} className="px-1.5 py-0.5 rounded-full bg-white/5 text-[10px] text-violet-300 whitespace-nowrap">{g}</span>
                )}
                {entry.genres.length > 3 &&
                  <span className="px-1.5 py-0.5 rounded-full bg-white/5 text-[10px] text-violet-500 whitespace-nowrap">+{entry.genres.length - 3}</span>
                }
              </div>
            )}

            <div className={`flex flex-wrap gap-1.5 ${isAbandoned ? dimmed : ""}`}>
              {tvSeasons.length > 0 && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-violet-300 whitespace-nowrap">
                  <Tv size={10} className="flex-shrink-0" />
                  {tvW}{tvT != null ? `/${tvT}` : ""} ép.
                </span>
              )}
              {extraSeasons.length > 0 && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-violet-300 whitespace-nowrap">
                  <Disc2 size={10} className="flex-shrink-0" />
                  {extW}{extT != null ? `/${extT}` : ""} OVA
                </span>
              )}
              {movieSeasons.length > 0 && (
                <span className="inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-violet-300 whitespace-nowrap">
                  <Film size={10} className="flex-shrink-0" />
                  {filmSeen}/{movieSeasons.length} film{movieSeasons.length > 1 ? "s" : ""}
                </span>
              )}
              {(totW > 0 || totT != null) && (
                <span className="font-mono text-[10px] text-violet-600 px-0.5 self-center">
                  {totW}{totT != null ? `/${totT}` : ""} au total
                </span>
              )}
            </div>

            {canFinish && !isAbandoned && (
              <button onClick={e => { e.stopPropagation(); markDone(entry.id); }}
                className="flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg bg-teal-400/15 text-teal-300 hover:bg-teal-400/25 active:scale-95 transition-transform motion-reduce:transition-none">
                <Check size={13} /> Série principale terminée
              </button>
            )}
          </div>

          <div
            className={`flex flex-col items-center justify-start pt-1 gap-1 pl-2 sm:pl-3 border-l border-white/5 min-w-[44px] sm:min-w-[52px] flex-shrink-0 relative z-10 ${dimmed}`}
          >
            {entry.rating > 0 ? (
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-400/10 border border-amber-400/20">
                  <Star size={11} fill="#fbbf24" strokeWidth={0} className="flex-shrink-0" />
                  <span className="text-sm sm:text-base font-bold text-amber-300 tabular-nums leading-none"
                    style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
                    {formatRating(entry.rating)}
                  </span>
                </div>
                {!companionImgSrc && <RatingBadge rating={entry.rating} className="text-xl sm:text-2xl h-8 sm:h-10" />}
                <p className="font-mono text-[8px] uppercase tracking-widest text-violet-500 hidden sm:block">Note</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-0.5 opacity-40">
                <Star size={14} className="text-violet-500" />
                <span className="font-mono text-[9px] text-violet-500">—</span>
              </div>
            )}
          </div>

          {/* ── Compagnon qui "sort" du coin bas-droit, juste au-dessus de la barre de progression ── */}
          {companionImgSrc && (
            <CompanionPeek rating={entry.rating}
              className="bottom-1.5 right-0 sm:right-1 h-20 sm:h-28 z-[15]" />
          )}

          <AnimatePresence>
            {isAbandoned && (
              <motion.div
                key="resume-badge"
                variants={CARD_BADGE_VARIANTS}
                initial="initial" animate="animate" exit="exit"
                transition={CARD_BADGE_TRANSITION}
                className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl pointer-events-none">
                <button onClick={handleResume}
                  className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-900/95 border border-violet-500/40 text-violet-100 text-sm font-semibold hover:bg-violet-700/95 hover:border-violet-400/60 active:scale-95 transition-all duration-150 motion-reduce:transition-none shadow-xl shadow-violet-950/60">
                  <RotateCcw size={14} className="text-rose-400" /> Reprendre ?
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Barre de progression collée au bas de la carte ── */}
          {progressTotal != null && progressTotal > 0 && (
            <div className="absolute inset-x-0 bottom-0 h-1 bg-black/25 z-10 pointer-events-none overflow-hidden">
              <div
                className="h-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{
                  width: `${Math.min(100, (progressWatched / progressTotal) * 100)}%`,
                  background: s.color,
                }}
              />
            </div>
          )}
        </div>

        {/* ── Menu long-press ── */}
        <AnimatePresence>
        {longPressMenu && (
          <motion.div
            key="long-press-menu"
            variants={CARD_OVERLAY_VARIANTS}
            initial="initial" animate="animate" exit="exit"
            transition={CARD_OVERLAY_TRANSITION}
            className="absolute inset-0 z-30 rounded-2xl bg-violet-950/70 backdrop-blur-xl flex flex-col items-center justify-center gap-1.5 p-3 overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <p className="font-mono text-xs uppercase tracking-widest text-white/90 mb-1 truncate max-w-full px-2 text-center">
              {entry.title}
            </p>

            <div className="grid grid-cols-4 gap-2 w-full">
              {/* Actualiser — reste ouvert, résultat inline, auto-fermeture */}
              <button
                onClick={(e) => { e.stopPropagation(); haptics.tap(); handleRefresh(e); }}
                disabled={refreshing || !!refreshResult}
                className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl border text-[9px] font-mono text-white leading-tight text-center transition-all active:scale-95 disabled:cursor-default ${
                  refreshResult?.status === "new"
                    ? "bg-teal-500/20 border-teal-400/40"
                    : refreshResult?.status === "error"
                    ? "bg-rose-500/20 border-rose-400/40"
                    : refreshResult?.status === "ok"
                    ? "bg-white/10 border-white/20"
                    : "bg-white/15 border-white/25 hover:bg-white/20 disabled:opacity-60"
                }`}
              >
                <RefreshCw size={16} className={`flex-shrink-0 transition-colors ${
                  refreshing                        ? "animate-spin text-white" :
                  refreshResult?.status === "new"   ? "text-teal-300"          :
                  refreshResult?.status === "error" ? "text-rose-300"          :
                  refreshResult?.status === "ok"    ? "text-teal-300"          :
                  "text-white"
                }`} />
                <span>
                  {refreshing                        ? "Actu.…"   :
                   refreshResult?.status === "ok"    ? "À jour"   :
                   refreshResult?.status === "new"   ? "Nouveau"  :
                   refreshResult?.status === "error" ? "Erreur"   :
                   "Actualiser"}
                </span>
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); haptics.tap(); setLongPressMenu(false); gesturedRef.current = false; setShowAddToList(true); }}
                className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-white/15 border border-white/25 hover:bg-white/20 active:scale-95 text-[9px] font-mono text-white leading-tight text-center transition-all"
              >
                <ListPlus size={16} className="text-white flex-shrink-0" />
                <span>Liste</span>
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); haptics.tap(); setLongPressMenu(false); gesturedRef.current = false; onEdit(entry); }}
                className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-white/15 border border-white/25 hover:bg-white/20 active:scale-95 text-[9px] font-mono text-white leading-tight text-center transition-all"
              >
                <Pencil size={16} className="text-white flex-shrink-0" />
                <span>Modifier</span>
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); haptics.medium(); setLongPressMenu(false); gesturedRef.current = false; setShowDel(true); }}
                className="flex flex-col items-center justify-center gap-1 py-2.5 rounded-xl bg-rose-500/25 border border-rose-400/40 hover:bg-rose-500/35 active:scale-95 text-[9px] font-mono text-rose-100 leading-tight text-center transition-all"
              >
                <Trash2 size={16} className="text-rose-200 flex-shrink-0" />
                <span>Suppr.</span>
              </button>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); haptics.tap(); setLongPressMenu(false); gesturedRef.current = false; }}
              className="mt-1 text-xs text-white/70 hover:text-white active:scale-95 transition-all font-mono"
            >
              Annuler
            </button>
          </motion.div>
        )}
        </AnimatePresence>

      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showDel && (
          <ConfirmDialog
            key="del-confirm"
            icon={<Trash2 size={14} className="text-rose-400" />}
            title="Supprimer ce titre ?"
            description={<><span className="text-violet-50 font-medium">« {entry.title} »</span> et toute sa progression seront supprimés définitivement.</>}
            confirmLabel="Supprimer"
            onConfirm={() => { haptics.medium(); deleteEntry(entry.id); removeEntryEverywhere(entry.id); setShowDel(false); }}
            onCancel={() => setShowDel(false)}
          />
        )}
        {showAddToList && (
          <AddToListModal key="add-to-list" entry={entry} onClose={() => setShowAddToList(false)} />
        )}
      </AnimatePresence>
    </>
  );
});