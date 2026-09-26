import { memo, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Pencil, Trash2, Film, Tv, Check, Star, Play, X,
  RotateCcw, Heart, RefreshCw, ListPlus, Clapperboard, Languages,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useLists }         from "../../context/ListsContext";
import { ConfirmDialog }    from "../Modal/Modal";
import { STATUS, seasonTotals, formatCountdown, formatRating, getDisplayStatus } from "../../utils/status";
import { useLibrary }       from "../../context/LibraryContext";
import { fetchNextAiring, refreshEntryCard } from "../../api";
import { getShowProgress }  from "../../context/PrefsContext";
import { AddToListModal }   from "../common/AddToListModal";
import { TitlePickerModal } from "./TitlePickerModal";
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
  const [showTitlePicker,    setShowTitlePicker]    = useState(false);
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
    const box = `w-[58px] h-[82px] rounded-xl overflow-hidden bg-white/5 border border-white/10 ${dimmed}`;
    const TypeIcon = entry.category === "movie" ? Clapperboard : entry.type === "anime" ? Film : Tv;
    return (
      <div className="relative flex-shrink-0 self-center">
        {img ? (
          <div className={box}><img src={img} alt="" loading="lazy" className="w-full h-full object-cover" /></div>
        ) : fb ? (
          <div className={`relative ${box}`}>
            <img src={fb} alt="" className="w-full h-full object-cover brightness-[0.25]" />
            <span className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-white/50">?</span>
          </div>
        ) : (
          <div className={`${box} flex items-center justify-center`}><TypeIcon size={20} className="text-violet-600" /></div>
        )}
        {isFavorite && (
          <div className="absolute -top-1.5 -right-1.5 z-10 flex items-center justify-center w-4 h-4 rounded-full bg-pink-500/90 shadow-md shadow-pink-500/50">
            <Heart size={8} fill="white" className="text-white" />
          </div>
        )}
      </div>
    );
  })();

  // ── Libellés compacts (ligne "Ép.") ───────────────────────────────────────
  const hasTV    = tvSeasons.length > 0;
  const epMain   = hasTV ? `Ép. ${tvW}` : movieSeasons.length ? `${filmSeen}/${movieSeasons.length}` : `Ép. ${totW}`;
  const epSub    = hasTV ? `/ ${tvT ?? "?"} au total`
                 : movieSeasons.length ? `film${movieSeasons.length > 1 ? "s" : ""}`
                 : `/ ${totT ?? "?"} au total`;
  const extraTxt = hasTV && extraSeasons.length ? ` · +${extW}${extT != null ? `/${extT}` : ""} OVA` : "";
  const TypeIcon = entry.category === "movie" ? Clapperboard : entry.type === "anime" ? Film : Tv;
  const cd       = nextAiring ? formatCountdown(nextAiring.airingAt) : null;
  const genres   = entry.genres.slice(0, 2);
  const pct      = progressTotal ? Math.min(100, (progressWatched / progressTotal) * 100) : 0;

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
          className={`relative card-noise rounded-2xl overflow-hidden bg-violet-900/30 pl-4 pr-3 py-2.5 flex items-center gap-3 min-h-[100px] cursor-pointer hover:bg-violet-800/40 transition-colors motion-reduce:transition-none ${
            isAiring
              ? "border border-teal-400/60 shadow-[0_0_14px_-2px_rgba(45,212,191,0.55)]"
              : "border border-white/10"
          }`}
        >
          {/* Liseré de statut */}
          <span className="absolute left-0 inset-y-2.5 w-1 rounded-r-full pointer-events-none"
            style={{ background: s.color, boxShadow: `0 0 10px ${s.color}80` }} />

          {coverImg}

          <div className="flex-1 min-w-0 flex flex-col gap-1 relative z-10">
            {/* Ligne 1 : type + statut */}
            <div className={`flex items-center gap-1.5 pr-14 min-w-0 overflow-hidden ${dimmed}`}>
              <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-violet-300 whitespace-nowrap flex-shrink-0">
                <TypeIcon size={10} />
                {entry.category === "movie" ? "Film" : entry.type === "anime" ? "Anime" : "Série"}
              </span>
              {showEnProduction ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-indigo-400/15 text-indigo-300 whitespace-nowrap">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse flex-shrink-0" />En production
                </span>
              ) : (
                <span className={`inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-white/5 whitespace-nowrap ${s.text}`}>
                  <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${s.dot}`} />{s.label}
                </span>
              )}
            </div>

            {/* Ligne 2 : titre */}
            <h3 className={`font-semibold text-[15px] text-violet-50 leading-tight truncate pr-14 ${dimmed}`}
              style={{ fontFamily: "'Space Grotesk',sans-serif" }} title={entry.title}>{entry.title}</h3>

            {/* Ligne 3 : épisodes */}
            <div className={`flex items-center gap-1.5 min-w-0 text-[11px] ${isAbandoned ? dimmed : ""}`}>
              <span className="w-4 h-4 rounded-full bg-sky-400/25 flex items-center justify-center flex-shrink-0">
                <Play size={8} fill="currentColor" strokeWidth={0} className="text-sky-300 ml-px" />
              </span>
              <span className="font-semibold text-sky-300 whitespace-nowrap">{epMain}</span>
              <span className="text-violet-400 truncate">{epSub}{extraTxt}</span>
              {canFinish && !isAbandoned && (
                <button onClick={e => { e.stopPropagation(); markDone(entry.id); }}
                  title="Série principale terminée"
                  className="ml-auto flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-400/15 text-teal-300 text-[10px] font-medium hover:bg-teal-400/25 active:scale-95 transition-transform motion-reduce:transition-none">
                  <Check size={11} />Terminer
                </button>
              )}
            </div>

            {/* Ligne 4 : genres + prochaine diffusion */}
            {(genres.length > 0 || cd) && (
              <div className={`flex items-center justify-between gap-2 min-w-0 ${dimmed}`}>
                <div className="flex gap-1 overflow-hidden min-w-0">
                  {genres.map(g => (
                    <span key={g} className="px-2 py-px rounded-full bg-violet-500/15 border border-violet-400/20 text-[10px] text-violet-200 whitespace-nowrap">{g}</span>
                  ))}
                </div>
                {cd && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-sky-300 flex-shrink-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse flex-shrink-0" />
                    {nextAiring.season ? `S${nextAiring.season} · ` : ""}Ép.{nextAiring.episode}
                    <span className="hidden sm:inline">{cd}</span>
                  </span>
                )}
              </div>
            )}

            {/* Barre de progression */}
            <div className={`h-1.5 rounded-full overflow-hidden mt-0.5 ${progressTotal ? "bg-white/10" : "bg-white/[0.04]"} ${isAbandoned ? dimmed : ""}`}>
              <div className="h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${pct}%`, background: s.color, boxShadow: pct > 0 ? `0 0 8px ${s.color}70` : undefined }} />
            </div>
          </div>

          {/* Note */}
          <div className={`absolute top-2.5 right-2.5 z-10 ${dimmed}`}>
            {entry.rating > 0 ? (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/30">
                <Star size={11} fill="#fbbf24" strokeWidth={0} className="flex-shrink-0" />
                <span className="text-sm font-bold text-amber-300 tabular-nums leading-none py-0.5"
                  style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{formatRating(entry.rating)}</span>
              </span>
            ) : (
              <span className="flex items-center justify-center w-9 h-6 rounded-full border border-violet-400/25 bg-white/[0.03]">
                <Star size={11} className="text-violet-400/70" />
              </span>
            )}
          </div>

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
        </div>

        {/* ── Menu long-press (compact : tient dans la hauteur de la carte) ── */}
        <AnimatePresence>
        {longPressMenu && (
          <motion.div
            key="long-press-menu"
            variants={CARD_OVERLAY_VARIANTS}
            initial="initial" animate="animate" exit="exit"
            transition={CARD_OVERLAY_TRANSITION}
            className="absolute inset-0 z-30 rounded-2xl bg-violet-950/80 backdrop-blur-xl flex flex-col items-center justify-center gap-1.5 px-3 py-2"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={(e) => { e.stopPropagation(); haptics.tap(); setLongPressMenu(false); gesturedRef.current = false; }}
              aria-label="Fermer le menu"
              className="absolute top-1.5 right-1.5 p-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 active:scale-90 transition-all"
            ><X size={13} /></button>

            <p className="font-mono text-[10px] uppercase tracking-widest text-white/80 truncate max-w-full px-6 text-center">{entry.title}</p>

            <div className="grid grid-cols-5 gap-1.5 w-full">
              <button
                onClick={(e) => { e.stopPropagation(); haptics.tap(); handleRefresh(e); }}
                disabled={refreshing || !!refreshResult}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl border text-[9px] font-mono text-white leading-tight text-center transition-all active:scale-95 disabled:cursor-default ${
                  refreshResult?.status === "new"
                    ? "bg-teal-500/20 border-teal-400/40"
                    : refreshResult?.status === "error"
                    ? "bg-rose-500/20 border-rose-400/40"
                    : refreshResult?.status === "ok"
                    ? "bg-white/10 border-white/20"
                    : "bg-white/15 border-white/25 hover:bg-white/20 disabled:opacity-60"
                }`}
              >
                <RefreshCw size={15} className={`flex-shrink-0 transition-colors ${
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
                className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl bg-white/15 border border-white/25 hover:bg-white/20 active:scale-95 text-[9px] font-mono text-white leading-tight text-center transition-all"
              >
                <ListPlus size={15} className="text-white flex-shrink-0" />
                <span>Liste</span>
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); haptics.tap(); setLongPressMenu(false); gesturedRef.current = false; setShowTitlePicker(true); }}
                className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl bg-white/15 border border-white/25 hover:bg-white/20 active:scale-95 text-[9px] font-mono text-white leading-tight text-center transition-all"
              >
                <Languages size={15} className="text-white flex-shrink-0" />
                <span>Titre</span>
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); haptics.tap(); setLongPressMenu(false); gesturedRef.current = false; onEdit(entry); }}
                className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl bg-white/15 border border-white/25 hover:bg-white/20 active:scale-95 text-[9px] font-mono text-white leading-tight text-center transition-all"
              >
                <Pencil size={15} className="text-white flex-shrink-0" />
                <span>Modifier</span>
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); haptics.medium(); setLongPressMenu(false); gesturedRef.current = false; setShowDel(true); }}
                className="flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl bg-rose-500/25 border border-rose-400/40 hover:bg-rose-500/35 active:scale-95 text-[9px] font-mono text-rose-100 leading-tight text-center transition-all"
              >
                <Trash2 size={15} className="text-rose-200 flex-shrink-0" />
                <span>Suppr.</span>
              </button>
            </div>
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
        {showTitlePicker && (
          <TitlePickerModal key="title-picker" entry={entry} onClose={() => setShowTitlePicker(false)} />
        )}
      </AnimatePresence>
    </>
  );
});