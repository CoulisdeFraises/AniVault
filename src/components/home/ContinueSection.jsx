import { Play, Check, Star, Tv, Film } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { LazyImage } from "../common/LazyImage";
import { SectionTitle } from "./SectionTitle";
import { useLibrary } from "../../context/LibraryContext";
import { haptics } from "../../utils/haptics";
import { formatRating } from "../../utils/status";
import { getFormatGroup } from "../../utils/format";

// Saison TV active + numéro du prochain épisode à voir
function getNext(entry) {
  const seasons = entry.seasons || [];
  const tv = seasons.map((s, i) => ({ s, i })).filter(({ s }) => getFormatGroup(s.format) === "tv");
  const pool = tv.length ? tv : seasons.map((s, i) => ({ s, i }));
  const active = pool.find(({ s }) => s.totalEpisodes == null || s.watchedEpisodes < s.totalEpisodes) ?? pool[pool.length - 1];
  if (!active) return null;
  const { s, i } = active;
  const done = s.totalEpisodes != null && s.watchedEpisodes >= s.totalEpisodes;
  return { seasonIndex: i, season: s, ep: done ? s.watchedEpisodes : s.watchedEpisodes + 1, canAdvance: !done };
}

function Rate({ rating }) {
  if (!rating) return null;
  return (
    <span className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-1 rounded-full bg-black/55 backdrop-blur-md border border-white/10 text-[11px] font-mono font-semibold text-white">
      <Star size={11} className="text-amber-400" fill="currentColor" strokeWidth={0} />{formatRating(rating)}
    </span>
  );
}

const seasonLabel = (n) => `S${n.season.number ?? n.seasonIndex + 1} · ÉP ${n.ep}`;
const progressOf = (n) => (n?.season?.totalEpisodes ? Math.min(100, (n.season.watchedEpisodes / n.season.totalEpisodes) * 100) : 0);

export function ContinueSection({ entries, onSeeAll }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { incrementEpisode } = useLibrary();
  if (!entries.length) return null;

  const open = (e) => navigate(`/details/${e.id}`, { state: { backgroundLocation: location } });
  const [hero, ...rest] = entries;
  const heroNext = getNext(hero);
  const hp = progressOf(heroNext);
  const HeroFallback = hero.type === "anime" ? Film : Tv;

  return (
    <section className="mb-4 animate-fadeIn">
      <SectionTitle
        icon={<span className="w-7 h-7 rounded-xl bg-pink-400/15 border border-pink-400/30 flex items-center justify-center text-pink-300"><Play size={13} fill="currentColor" strokeWidth={0} /></span>}
        title="Continuer de regarder" actionLabel="Tout voir" onAction={onSeeAll} />

      <div className="flex gap-3">
        {/* Titre principal */}
        <div role="button" tabIndex={0} onClick={() => open(hero)} onKeyDown={(e) => e.key === "Enter" && open(hero)}
          className="relative flex-1 min-w-0 h-[148px] rounded-3xl overflow-hidden border border-white/15 cursor-pointer active:scale-[0.98] transition-transform motion-reduce:transition-none shadow-lg shadow-black/30">
          {hero.coverImage
            ? <LazyImage src={hero.coverImage} alt={hero.title} className="absolute inset-0 w-full h-full [&_img]:object-[center_25%]" />
            : <div className="absolute inset-0 flex items-center justify-center bg-violet-900"><HeroFallback size={28} className="text-violet-600" /></div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/10" />
          <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/45 to-transparent" />
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-pink-400 text-violet-950 text-[10px] font-mono font-bold uppercase tracking-wide shadow-md">
            <Play size={8} fill="currentColor" strokeWidth={0} />À reprendre
          </span>
          <Rate rating={hero.rating} />
          <div className="absolute inset-x-0 bottom-0 p-3 flex items-end gap-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-bold text-white leading-tight truncate [text-shadow:0_1px_8px_rgba(0,0,0,0.6)]" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{hero.title}</p>
              {heroNext && <p className="text-[11px] text-violet-200 mt-0.5">{seasonLabel(heroNext)}</p>}
              <div className="flex items-center gap-2 mt-1.5">
                <span className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden"><span className="block h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full" style={{ width: `${hp}%` }} /></span>
                {heroNext && <span className="font-mono text-[10px] text-white/90 flex-shrink-0 tabular-nums">{heroNext.season.watchedEpisodes}/{heroNext.season.totalEpisodes ?? "?"}</span>}
              </div>
            </div>
            {heroNext?.canAdvance && (
              <button onClick={(e) => { e.stopPropagation(); haptics.success(); incrementEpisode(hero.id, heroNext.seasonIndex); }}
                aria-label="Marquer l'épisode suivant comme vu"
                className="w-10 h-10 rounded-full bg-amber-400 text-violet-950 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/30 ring-4 ring-amber-400/20 active:scale-90 transition-transform motion-reduce:transition-none">
                <Check size={18} strokeWidth={3} />
              </button>
            )}
          </div>
        </div>

        {/* Deux suivants : image collée à gauche, fondue vers la droite (comme la bibliothèque) */}
        {rest.length > 0 && (
          <div className="flex flex-col gap-2 w-[46%] flex-shrink-0">
            {rest.slice(0, 2).map((e) => {
              const n = getNext(e);
              const p = progressOf(n);
              return (
                <button key={e.id} onClick={() => open(e)}
                  className="relative h-[70px] rounded-2xl overflow-hidden border border-white/15 bg-violet-900/40 text-left active:scale-[0.98] transition-transform motion-reduce:transition-none">
                  <div className="absolute inset-y-0 left-0 w-[76px] pointer-events-none"
                    style={{ WebkitMaskImage: "linear-gradient(to right, #000 0%, #000 35%, transparent 100%)", maskImage: "linear-gradient(to right, #000 0%, #000 35%, transparent 100%)" }}>
                    {e.coverImage ? <LazyImage src={e.coverImage} alt="" className="absolute inset-0 w-full h-full" /> : <div className="absolute inset-0 bg-violet-950" />}
                  </div>
                  <div className="relative h-full pl-[56px] pr-2 pt-2 pb-2.5 flex flex-col justify-center min-w-0">
                    <p className="text-[12px] font-semibold text-white leading-tight line-clamp-2" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{e.title}</p>
                    {n && <p className="text-[10px] text-violet-300 mt-0.5 truncate">{seasonLabel(n)}</p>}
                  </div>
                  {e.rating > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/50 text-[9px] font-mono font-semibold text-white">
                      <Star size={9} className="text-amber-400" fill="currentColor" strokeWidth={0} />{formatRating(e.rating)}
                    </span>
                  )}
                  <span className="absolute bottom-0 inset-x-0 h-[3px] bg-white/10">
                    <span className="block h-full bg-gradient-to-r from-amber-500 to-amber-300" style={{ width: `${p}%` }} />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
