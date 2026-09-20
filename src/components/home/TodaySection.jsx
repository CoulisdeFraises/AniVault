import { useEffect, useRef, useState } from "react";
import { CalendarClock, Clock, Tv, Film } from "lucide-react";
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
      className={`relative overflow-hidden rounded-2xl border border-white/15 text-left active:scale-[0.98] transition-transform group w-full h-[128px]`}>
      {cover
        ? <LazyImage src={cover} alt={entry.title} className="absolute inset-0 w-full h-full [&_img]:object-[center_22%] group-hover:scale-105 transition-transform duration-300" />
        : <div className="absolute inset-0 flex items-center justify-center bg-violet-900"><Fallback size={28} className="text-violet-600" /></div>}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10" />

      {/* Une seule rangée pour les deux badges : ils se partagent la largeur au lieu de se chevaucher */}
      <div className="absolute top-1.5 inset-x-1.5 flex items-center justify-between gap-1">
        <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold backdrop-blur-md border flex-shrink-0 ${
          aired ? "bg-teal-500/60 border-teal-300/40 text-white" : "bg-black/50 border-amber-400/40 text-amber-300"}`}>
          <Clock size={10} />{aired ? "Sorti" : time}
        </span>
        <span className="min-w-0 truncate px-1.5 py-0.5 rounded-md text-[9px] font-mono font-semibold bg-violet-950/70 backdrop-blur-md text-white border border-white/10">
          S{number} • EP {episode}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-2.5">
        <p className={`${wide ? "text-base" : "text-[13px]"} font-bold text-white leading-tight line-clamp-1`} style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{entry.title}</p>
        <p className="text-[11px] text-violet-200/90 truncate">{altTitle(entry) || `Saison ${number}`}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[8px] font-bold uppercase tracking-wide flex-shrink-0 ${st.border} ${st.text} bg-black/40`}>
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />{st.label}
          </span>
          <span className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden"><span className="block h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} /></span>
          <span className="font-mono text-[9px] text-white/90 flex-shrink-0">{watched}/{total ?? "?"}</span>
        </div>
      </div>
    </button>
  );
}

const CARD_W   = "min(68vw, 300px)";
const MIN_SCALE = 0.86;   // taille de la carte "loin" du centre
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
  }, [items.length]);

  return (
    <>
      <div ref={scrollerRef}
        className="flex gap-3 overflow-x-auto scrollbar-none -mx-4 snap-x snap-mandatory py-1"
        style={{ paddingInline: `calc((100% - ${CARD_W}) / 2)`, scrollbarWidth: "none" }}>
        {items.map((it, i) => (
          <div key={`${it.entry.id}-${it.episode}`} ref={(n) => (cardRefs.current[i] = n)}
            className="flex-shrink-0 snap-center will-change-transform" style={{ width: CARD_W }}>
            <TodayCard item={it} nextAiring={nextAiringByEntry.get(it.entry.id)} wide onOpen={onOpen} />
          </div>
        ))}
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
        icon={<span className="w-6 h-6 rounded-md border border-amber-400/60 flex items-center justify-center text-amber-400"><CalendarClock size={13} /></span>}
        title="Aujourd'hui"
        actionLabel={items.length ? `${items.length} épisode${items.length > 1 ? "s" : ""}` : "Agenda"}
        onAction={() => navigate("/calendar")} />
      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-violet-900/20 py-4 text-center">
          <p className="text-sm text-violet-200">Rien ne sort aujourd'hui parmi tes titres</p>
          <p className="text-[11px] text-violet-400 mt-1">Repose-toi, ou rattrape ton retard ✨</p>
        </div>
      ) : (
        items.length === 1
          ? <TodayCard item={items[0]} nextAiring={nextAiringByEntry.get(items[0].entry.id)} wide onOpen={open} />
          : <TodayCarousel items={items} nextAiringByEntry={nextAiringByEntry} onOpen={open} />
      )}
    </section>
  );
}
