import { useEffect, useRef, useState } from "react";
import { CalendarClock, CalendarCheck, Clock, Check, Play, Tv, Film } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { LazyImage } from "../common/LazyImage";
import { SectionTitle } from "./SectionTitle";
import { STATUS, getDisplayStatus } from "../../utils/status";
import { getFormatGroup } from "../../utils/format";

// Saison correspondant à l'épisode diffusé : via anilistId de la saison,
// sinon la saison TV active.
function resolveSeason(entry, anilistId) {
  const seasons = entry.seasons || [];
  let idx = seasons.findIndex((s) => s.anilistId != null && String(s.anilistId) === String(anilistId));
  if (idx === -1) {
    const tv = seasons.map((s, i) => ({ s, i })).filter(({ s }) => getFormatGroup(s.format) === "tv");
    idx = (tv.find(({ s }) => s.totalEpisodes == null || s.watchedEpisodes < s.totalEpisodes) ?? tv[tv.length - 1])?.i ?? 0;
  }
  return { season: seasons[idx], number: seasons[idx]?.number ?? idx + 1 };
}

function altTitle(entry) {
  const norm = (t) => (t || "").trim().toLowerCase();
  return [entry.titleRomaji, entry.titleEnglish, entry.titleFrench].find((t) => t && norm(t) !== norm(entry.title)) || null;
}

function TodayCard({ item, nextAiring, wide, onOpen }) {
  const { entry, episode, airingAt, cover } = item;
  const { season, number } = resolveSeason(entry, item.anilistId);
  const time = new Date(airingAt * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const aired = Date.now() >= airingAt * 1000;
  const st = STATUS[getDisplayStatus(entry, nextAiring)] ?? STATUS["a-voir"];
  const watched = season?.watchedEpisodes ?? 0;
  const total = season?.totalEpisodes ?? null;
  const pct = total ? Math.min(100, (watched / total) * 100) : 0;
  const Fallback = entry.type === "anime" ? Film : Tv;

  return (
    <button onClick={() => onOpen(entry)}
      className="relative overflow-hidden rounded-3xl border border-white/15 text-left active:scale-[0.98] transition-transform motion-reduce:transition-none group w-full h-[140px] shadow-lg shadow-black/30">
      {cover
        ? <LazyImage src={cover} alt={entry.title} className="absolute inset-0 w-full h-full [&_img]:object-[center_22%] group-hover:scale-105 transition-transform duration-500 motion-reduce:transition-none" />
        : <div className="absolute inset-0 flex items-center justify-center bg-violet-900"><Fallback size={28} className="text-violet-600" /></div>}
      {/* Voiles : bas pour le texte, haut pour les badges, gauche pour l'ambiance */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10" />
      <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/45 to-transparent" />

      <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-1.5">
        <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-mono font-semibold backdrop-blur-md border flex-shrink-0 ${
          aired ? "bg-teal-500/70 border-teal-300/50 text-white shadow-[0_0_12px_-2px_rgba(45,212,191,0.7)]"
                : "bg-black/55 border-amber-400/50 text-amber-300"}`}>
          {aired ? <Check size={11} strokeWidth={3} /> : <Clock size={11} />}{aired ? "Sorti" : time}
        </span>
        <span className="min-w-0 truncate inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-mono font-bold bg-amber-400 text-violet-950 shadow-md">
          <Play size={8} fill="currentColor" strokeWidth={0} className="flex-shrink-0" />S{number} · ÉP {episode}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className={`${wide ? "text-[17px]" : "text-sm"} font-bold text-white leading-tight line-clamp-1 [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]`} style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{entry.title}</p>
        <p className="text-[11px] text-violet-200/90 truncate mt-0.5">{altTitle(entry) || `Saison ${number}`}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wide flex-shrink-0 ${st.border} ${st.text} bg-black/45 backdrop-blur-sm`}>
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}
          </span>
          <span className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden"><span className="block h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300" style={{ width: `${pct}%` }} /></span>
          <span className="font-mono text-[10px] text-white/90 flex-shrink-0 tabular-nums">{watched}/{total ?? "?"}</span>
        </div>
      </div>
    </button>
  );
}

const PEEK      = 40;     // marge de chaque côté de la carte de devant (laisse deviner la voisine)
const GAP       = 12;     // espace entre les cartes (gap-3)
const MAX_CARD_W = 560;   // largeur max de la carte de devant (grands écrans)
const MIN_SCALE = 0.92;   // taille de la carte "loin" du centre
const MIN_ALPHA = 0.6;

/**
 * Carrousel : la carte au centre est pleine taille, les voisines rétrécissent
 * et s'estompent selon leur distance au centre (mise à jour directe du DOM à
 * chaque frame de scroll, sans re-render React). Désactivé si l'utilisateur
 * préfère réduire les animations.
 */
function TodayCarousel({ items, nextAiringByEntry, onOpen }) {
  const scrollerRef = useRef(null);
  const cardRefs    = useRef([]);
  const [active, setActive] = useState(0);
  // Largeur disponible → la carte de devant occupe toute la largeur (moins l'aperçu des voisines)
  const [boxW, setBoxW] = useState(0);
  const cardW = boxW ? Math.min(MAX_CARD_W, boxW - PEEK * 2) : 0;

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => setBoxW(el.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;

    const update = () => {
      raf = 0;
      const center = el.scrollLeft + el.clientWidth / 2;
      let best = 0, bestD = Infinity;
      cardRefs.current.forEach((card, i) => {
        if (!card) return;
        const d = Math.abs(card.offsetLeft + card.offsetWidth / 2 - center);
        if (d < bestD) { bestD = d; best = i; }
        if (reduce) return;
        const t = Math.min(1, d / (card.offsetWidth * 0.9));
        card.style.transform = `scale(${1 - (1 - MIN_SCALE) * t})`;
        card.style.opacity   = String(1 - (1 - MIN_ALPHA) * t);
      });
      setActive((prev) => (prev === best ? prev : best));
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };

    update();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [items.length, cardW]);

  // Pas de voisine à gauche (1re carte) ou à droite (dernière) : on laisse un « vide »
  // sombre à la place, pour que la carte de devant reste toujours encadrée.
  const ghostBase = "pointer-events-none absolute top-1 rounded-3xl border border-dashed border-white/10 bg-black/35 shadow-[inset_0_0_24px_rgba(0,0,0,0.5)] transition-opacity duration-300 motion-reduce:transition-none";
  const ghostStyle = (left, show) => ({
    left, width: cardW, height: 140, opacity: show ? 0.55 : 0, transform: `scale(${MIN_SCALE})`,
  });

  return (
    <>
      <div className="relative -mx-4 overflow-hidden">
        {cardW > 0 && (
          <>
            <div aria-hidden="true" className={ghostBase}
              style={ghostStyle((boxW - cardW) / 2 - GAP - cardW, active === 0)} />
            <div aria-hidden="true" className={ghostBase}
              style={ghostStyle((boxW + cardW) / 2 + GAP, active === items.length - 1)} />
          </>
        )}
        <div ref={scrollerRef}
          className="relative flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory py-1"
          style={{ paddingInline: cardW ? (boxW - cardW) / 2 : 0, scrollbarWidth: "none", visibility: cardW ? "visible" : "hidden" }}>
          {items.map((it, i) => (
            <div key={`${it.entry.id}-${it.episode}`} ref={(n) => (cardRefs.current[i] = n)}
              className="flex-shrink-0 snap-center will-change-transform" style={{ width: cardW || undefined }}>
              <TodayCard item={it} nextAiring={nextAiringByEntry.get(it.entry.id)} wide onOpen={onOpen} />
            </div>
          ))}
        </div>
        {/* Voile flouté sur les bords pour suggérer la continuité du scroll */}
        <div
          className="pointer-events-none absolute inset-y-1 left-0 w-4 sm:w-8 z-10 backdrop-blur-sm"
          style={{
            WebkitMaskImage: "linear-gradient(to right, black 0%, transparent 100%)",
            maskImage: "linear-gradient(to right, black 0%, transparent 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-y-1 right-0 w-4 sm:w-8 z-10 backdrop-blur-sm"
          style={{
            WebkitMaskImage: "linear-gradient(to left, black 0%, transparent 100%)",
            maskImage: "linear-gradient(to left, black 0%, transparent 100%)",
          }}
        />
      </div>
      <div className="flex justify-center gap-1.5 mt-1.5" aria-hidden="true">
        {items.map((it, i) => (
          <span key={`${it.entry.id}-${it.episode}`}
            className={`h-1.5 rounded-full transition-all duration-300 motion-reduce:transition-none ${i === active ? "w-4 bg-amber-400" : "w-1.5 bg-white/25"}`} />
        ))}
      </div>
    </>
  );
}

export function TodaySection({ items, nextAiringByEntry }) {
  const navigate = useNavigate();
  const location = useLocation();
  const open = (entry) => navigate(`/details/${entry.id}`, { state: { backgroundLocation: location } });

  return (
    <section className="mb-4 animate-fadeIn">
      <SectionTitle
        icon={<span className="w-7 h-7 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-300"><CalendarClock size={15} /></span>}
        title="Aujourd'hui"
        actionLabel={items.length ? `${items.length} épisode${items.length > 1 ? "s" : ""}` : "Agenda"}
        onAction={() => navigate("/calendar")} />
      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/15 bg-gradient-to-br from-violet-900/30 to-violet-950/20 py-5 px-4 flex flex-col items-center text-center gap-1.5">
          <span className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-violet-300"><CalendarCheck size={17} /></span>
          <p className="text-sm font-medium text-violet-100">Rien ne sort aujourd'hui parmi tes titres</p>
          <p className="text-[11px] text-violet-400">Repose-toi, ou rattrape ton retard.</p>
        </div>
      ) : (
        items.length === 1
          ? <TodayCard item={items[0]} nextAiring={nextAiringByEntry.get(items[0].entry.id)} wide onOpen={open} />
          : <TodayCarousel items={items} nextAiringByEntry={nextAiringByEntry} onOpen={open} />
      )}
    </section>
  );
}
