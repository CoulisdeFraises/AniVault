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
      className={`relative overflow-hidden rounded-2xl border border-white/15 text-left active:scale-[0.98] transition-transform group flex-shrink-0 h-[128px] ${wide ? "w-[58%]" : "w-[38%]"} min-w-[150px]`}>
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
        <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-4 px-4 snap-x">
          {items.map((it, i) => (
            <div key={`${it.entry.id}-${it.episode}`} className="contents">
              <TodayCard item={it} nextAiring={nextAiringByEntry.get(it.entry.id)} wide={items.length === 1 || i === 0} onOpen={open} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
