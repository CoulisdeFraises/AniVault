import { memo, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Pencil, Trash2, Film, Tv, Disc2, Check, Star,
  RotateCcw, Heart, RefreshCw, ListPlus,
} from "lucide-react";
import { useLists }         from "../../context/ListsContext";
import { ConfirmDialog }    from "../Modal/Modal";
import { getRatingEmoji }   from "../common/Rating";
import { STATUS, seasonTotals, formatCountdown } from "../../utils/status";
import { useLibrary }       from "../../context/LibraryContext";
import { fetchNextAiring, refreshEntryCard } from "../../api";
import { getShowProgress }  from "../../context/PrefsContext";
import { AddToListModal }   from "../common/AddToListModal";
import { getFormatGroup } from "../../utils/format";

function getResumeStatus(entry) {
  const { watched, total } = seasonTotals(entry.seasons);
  if (total != null && total > 0 && watched >= total) return "termine";
  return watched > 0 ? "en-cours" : "a-voir";
}

const SWIPE_THRESHOLD = 72;
const LONG_PRESS_MS   = 500;

export const Card = memo(function Card({ entry, onEdit, index = 0 }) {
  const { markDone, deleteEntry, saveEntry } = useLibrary();
  const { isInFavorites } = useLists();
  const isFavorite = isInFavorites(entry.id);
  const navigate = useNavigate();
  const location = useLocation();
  const seasons  = entry.seasons;

  const tvSeasons    = useMemo(() => seasons.map((s, i) => ({ ...s, globalIndex: i })).filter(s => getFormatGroup(s.format) === "tv"),    [seasons]);
  const extraSeasons = useMemo(() => seasons.map((s, i) => ({ ...s, globalIndex: i })).filter(s => getFormatGroup(s.format) === "extra"), [seasons]);
  const movieSeasons = useMemo(() => seasons.map((s, i) => ({ ...s, globalIndex: i })).filter(s => getFormatGroup(s.format) === "movie"), [seasons]);

  const activeTVIdx = useMemo(() => {
    const i = tvSeasons.findIndex(s => s.totalEpisodes == null || s.watchedEpisodes < s.totalEpisodes);
    return i === -1 ? Math.max(0, tvSeasons.length - 1) : i;
  }, [tvSeasons]);

  // ── State UI ──────────────────────────────────────────────────────────────
  const [showDel,       setShowDel]       = useState(false);
  const [showAddToList, setShowAddToList] = useState(false);
  const [longPressMenu, setLongPressMenu] = useState(false);
  const [refreshing,    setRefreshing]    = useState(false);
  const [nextAiring,    setNextAiring]    = useState(null);

  // ── State swipe ──────────────────────────────────────────────────────────
  const [swipeX,    setSwipeX]    = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDir,  setSwipeDir]  = useState(null); // 'left' | 'right' | null

  const cardRef    = useRef(null);
  const gesturedRef = useRef(false);
  const ptrRef     = useRef({ id: null, startX: 0, startY: 0, timer: null, axis: null });

  const isAbandoned = entry.status === "abandonne";
  const s      = STATUS[entry.status];
  const dimmed = isAbandoned ? "opacity-50 grayscale" : "";
  const cur    = tvSeasons[Math.min(activeTVIdx, Math.max(0, tvSeasons.length - 1))] ?? null;

  const { watched: tvW,  total: tvT  } = useMemo(() => seasonTotals(tvSeasons),    [tvSeasons]);
  const { watched: totW, total: totT  } = useMemo(() => seasonTotals(seasons),      [seasons]);
  const { watched: extW, total: extT  } = useMemo(() => seasonTotals(extraSeasons), [extraSeasons]);
  const filmSeen = movieSeasons.filter(m => m.watchedEpisodes >= (m.totalEpisodes ?? 1)).length;
  const canFinish = entry.status === "en-cours" && tvT != null && tvT > 0 && tvW >= tvT;

  // Peut-on swiper à droite (+1 épisode) ?
  const canAddEp = entry.status !== "termine" && entry.status !== "abandonne"
    && cur != null
    && (cur.totalEpisodes == null || cur.watchedEpisodes < cur.totalEpisodes);

  const showEnProduction = useMemo(() => {
    if (entry.status === "termine" || entry.status === "abandonne") return false;
    if (!tvSeasons.length) return false;
    const lastTV = tvSeasons[tvSeasons.length - 1];
    return lastTV.totalEpisodes == null || lastTV.totalEpisodes === 0;
  }, [entry.status, tvSeasons]);

  // ── Actions ───────────────────────────────────────────────────────────────
  function handleResume(e) {
    e.stopPropagation();
    saveEntry({ ...entry, status: getResumeStatus(entry) }, entry.id);
  }

  function handleAddEpisode() {
    if (!cur) return;
    const gIdx = cur.globalIndex;
    const updatedSeasons = seasons.map((s, i) => {
      if (i !== gIdx) return s;
      const next = (s.watchedEpisodes || 0) + 1;
      return { ...s, watchedEpisodes: s.totalEpisodes != null ? Math.min(next, s.totalEpisodes) : next };
    });
    saveEntry({ ...entry, seasons: updatedSeasons }, entry.id);
  }

  function handleAbandon() {
    saveEntry({ ...entry, status: "abandonne" }, entry.id);
  }

  async function handleRefresh(e) {
    e?.stopPropagation();
    setLongPressMenu(false);
    setRefreshing(true);
    try {
      const result = await refreshEntryCard(entry);
      if (result) {
        saveEntry({
          ...entry,
          seasons: result.seasons,
          ...(result.anilistIds ? { anilistIds: result.anilistIds } : {}),
        }, entry.id);
      }
    } catch (_) {}
    setRefreshing(false);
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
        navigator.vibrate?.(40);
      }, LONG_PRESS_MS),
    };
  }

  function handlePointerMove(e) {
    if (ptrRef.current.id == null) return;
    const dx  = e.clientX - ptrRef.current.startX;
    const dy  = e.clientY - ptrRef.current.startY;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);

    // Détermine l'axe dominant dès qu'on a bougé de 6px
    if (!ptrRef.current.axis && (adx > 6 || ady > 6)) {
      ptrRef.current.axis = adx > ady ? "x" : "y";
    }

    // Annule le long-press si l'utilisateur bouge
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
      if (swipeDir === "right" && canAddEp) {
        handleAddEpisode();
        navigator.vibrate?.(30);
      } else if (swipeDir === "left" && entry.status === "en-cours") {
        handleAbandon();
        navigator.vibrate?.(30);
      }
      setSwipeX(0);
      setIsSwiping(false);
      setSwipeDir(null);
    }
    ptrRef.current.id = null;
  }

  function handlePointerCancel(e) {
    clearTimeout(ptrRef.current.timer);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setSwipeX(0);
    setIsSwiping(false);
    setSwipeDir(null);
    ptrRef.current.id = null;
  }

  function handleCardClick() {
    if (gesturedRef.current) { gesturedRef.current = false; return; }
    navigate(`/details/${entry.id}`, { state: { backgroundLocation: location } });
  }

  useEffect(() => {
    if (!longPressMenu) return;
    function handleOutside(e) {
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        setLongPressMenu(false);
        gesturedRef.current = false;
      }
    }
    document.addEventListener("pointerdown", handleOutside);
    return () => document.removeEventListener("pointerdown", handleOutside);
  }, [longPressMenu]);

  // ── Animations d'entrée ───────────────────────────────────────────────────
  useEffect(() => {
    const el = cardRef.current; if (!el) return;
    const d = Math.min(index * 45, 350);
    el.style.animation = `fadeInUp 0.35s ease-out ${d}ms both`;
    const t = setTimeout(() => { if (cardRef.current) cardRef.current.style.removeProperty("animation"); }, d + 380);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  useEffect(() => {
    if (entry.status === "termine" || entry.status === "abandonne") { setNextAiring(null); return; }
    if (!((entry.source === "anilist" && entry.anilistIds?.length) || (entry.source === "tvmaze" && entry.tvmazeId))) return;
    let c = false;
    const t = setTimeout(async () => {
      try { const r = await fetchNextAiring(entry); if (!c) setNextAiring(r); } catch (_) {}
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

  // ── Rendu de la cover ─────────────────────────────────────────────────────
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
      {/* ── Wrapper relatif pour les couches de swipe ── */}
      <div className="relative select-none" style={{ touchAction: "pan-y" }}>

        {/* Reveal DROITE : +1 épisode (fond vert) */}
        {canAddEp && (
          <div
            className="absolute inset-0 rounded-2xl flex items-center pl-5 pointer-events-none"
            style={{
              background: "rgb(52 211 153 / 0.18)",
              opacity: swipeX > 0 ? swipeRevealOpacity(swipeX, "right") : 0,
            }}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-2xl">▶️</span>
              <span className="font-mono text-[9px] text-emerald-300 uppercase tracking-wide">+1 épisode</span>
            </div>
          </div>
        )}

        {/* Reveal GAUCHE : Abandonner (fond rose) */}
        {entry.status === "en-cours" && (
          <div
            className="absolute inset-0 rounded-2xl flex items-center justify-end pr-5 pointer-events-none"
            style={{
              background: "rgb(244 63 94 / 0.18)",
              opacity: swipeX < 0 ? swipeRevealOpacity(swipeX, "left") : 0,
            }}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-2xl">💤</span>
              <span className="font-mono text-[9px] text-rose-300 uppercase tracking-wide">Abandonner</span>
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
          className="relative card-noise rounded-2xl overflow-hidden bg-violet-900/30 border-t border-r border-b border-white/5 p-3 sm:p-4 flex gap-2 sm:gap-3 cursor-pointer hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-950/60 hover:bg-violet-800/40"
        >
          <div className="absolute inset-y-0 left-0 w-[3px] rounded-l-2xl"
            style={{ background: `linear-gradient(to bottom,${s.color},${s.color}70,${s.color}10)` }} />

          {/* Cover */}
          {coverImg}

          {/* Contenu principal */}
          <div className="flex-1 min-w-0 flex flex-col gap-1.5 sm:gap-2 relative z-10">
            {/* En-tête : badges + titre (sans boutons) */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-violet-300 whitespace-nowrap ${dimmed}`}>
                  {entry.type === "anime" ? <Film size={10} /> : <Tv size={10} />}
                  {entry.type === "anime" ? "Anime" : "Série"}
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

            {/* Genres */}
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

            {/* Stats de progression */}
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

            {/* Bouton "Série terminée" */}
            {canFinish && !isAbandoned && (
              <button onClick={e => { e.stopPropagation(); markDone(entry.id); }}
                className="flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-lg bg-teal-400/15 text-teal-300 hover:bg-teal-400/25 active:scale-95 transition-transform motion-reduce:transition-none">
                <Check size={13} /> Série principale terminée
              </button>
            )}
          </div>

          {/* ── Colonne droite : boutons Modifier/Supprimer + Note ── */}
          <div
            className={`flex flex-col items-center gap-2 pl-2 sm:pl-3 border-l border-white/5 min-w-[40px] sm:min-w-[48px] flex-shrink-0 relative z-10 ${dimmed}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Boutons edit / delete — maintenant au-dessus de la note */}
            {!isAbandoned && (
              <div className="flex flex-col gap-0.5">
                <button onClick={() => onEdit(entry)} aria-label="Modifier"
                  className="p-1.5 rounded-lg text-violet-400 hover:bg-white/10 hover:text-violet-50 active:scale-95 transition-all motion-reduce:transition-none">
                  <Pencil size={13} />
                </button>
                <button onClick={() => setShowDel(true)} aria-label="Supprimer"
                  className="p-1.5 rounded-lg text-violet-400 hover:bg-rose-500/20 hover:text-rose-300 active:scale-95 transition-all motion-reduce:transition-none">
                  <Trash2 size={13} />
                </button>
              </div>
            )}

            {/* Note */}
            <div className="flex flex-col items-center justify-center gap-0.5 mt-auto">
              <p className="font-mono text-[9px] uppercase tracking-widest text-violet-400 hidden sm:block">Note</p>
              <div className="flex items-center gap-0.5">
                <span className="text-lg sm:text-xl font-bold text-violet-50" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>
                  {entry.rating || "—"}
                </span>
                {entry.rating > 0 && <Star size={13} fill="#fbbf24" strokeWidth={0} />}
              </div>
              {getRatingEmoji(entry.rating) && (
                <span className="text-xl sm:text-2xl">{getRatingEmoji(entry.rating)}</span>
              )}
            </div>
          </div>

          {/* Overlay "Reprendre" si abandonné */}
          {isAbandoned && (
            <div className="absolute inset-0 z-20 flex items-center justify-center rounded-2xl pointer-events-none">
              <button onClick={handleResume}
                className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-900/95 border border-violet-500/40 text-violet-100 text-sm font-semibold hover:bg-violet-700/95 hover:border-violet-400/60 active:scale-95 transition-all duration-150 motion-reduce:transition-none shadow-xl shadow-violet-950/60 animate-fadeIn">
                <RotateCcw size={14} className="text-rose-400" /> Reprendre ?
              </button>
            </div>
          )}
        </div>

        {/* ── Menu long-press ── */}
        {longPressMenu && (
          <div
            className="absolute inset-0 z-30 rounded-2xl bg-violet-950 backdrop-blur-md flex flex-col items-center justify-center gap-2 p-4 animate-fadeIn"
            onClick={e => e.stopPropagation()}
          >
            <p className="font-mono text-xs uppercase tracking-widest text-white/90 mb-1 truncate max-w-full px-2 text-center">
              {entry.title}
            </p>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/15 border border-white/25 hover:bg-white/20 text-sm font-semibold text-white transition-colors disabled:opacity-60"
            >
              <RefreshCw size={16} className={`text-white flex-shrink-0 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Actualisation…" : "Actualiser"}
            </button>

            <button
              onClick={() => { setLongPressMenu(false); setShowAddToList(true); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-white/15 border border-white/25 hover:bg-white/20 text-sm font-semibold text-white transition-colors"
            >
              <ListPlus size={16} className="text-white flex-shrink-0" />
              Ajouter à une liste
            </button>

            <button
              onClick={() => { setLongPressMenu(false); setShowDel(true); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl bg-rose-500/25 border border-rose-400/40 hover:bg-rose-500/35 text-sm font-semibold text-white transition-colors"
            >
              <Trash2 size={16} className="text-rose-200 flex-shrink-0" />
              Supprimer
            </button>

            <button
              onClick={() => { setLongPressMenu(false); gesturedRef.current = false; }}
              className="mt-1 text-xs text-white/70 hover:text-white transition-colors font-mono"
            >
              Annuler
            </button>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {showDel && (
        <ConfirmDialog
          icon={<Trash2 size={14} className="text-rose-400" />}
          title="Supprimer ce titre ?"
          description={<><span className="text-violet-50 font-medium">« {entry.title} »</span> et toute sa progression seront supprimés définitivement.</>}
          confirmLabel="Supprimer"
          onConfirm={() => { deleteEntry(entry.id); setShowDel(false); }}
          onCancel={() => setShowDel(false)}
        />
      )}
      {showAddToList && (
        <AddToListModal entryId={entry.id} onClose={() => setShowAddToList(false)} />
      )}
    </>
  );
});