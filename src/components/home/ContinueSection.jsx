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
    <span className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/50 backdrop-blur-md text-[10px] font-mono font-semibold text-white">
      <Star size={11} className="text-amber-400" fill="currentColor" strokeWidth={0} />{formatRating(rating)}
    </span>
  );
}

export function ContinueSection({ entries, onSeeAll }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { incrementEpisode } = useLibrary();
  if (!entries.length) return null;

  const open = (e) => navigate(`/details/${e.id}`, { state: { backgroundLocation: location } });
  const [hero, ...rest] = entries;
  const heroNext = getNext(hero);
  const hp = heroNext?.season?.totalEpisodes ? Math.min(100, (heroNext.season.watchedEpisodes / heroNext.season.totalEpisodes) * 100) : 0;
  const HeroFallback = hero.type === "anime" ? Film : Tv;

  return (
    <section className="mb-4 animate-fadeIn">
      <SectionTitle
        icon={<span className="w-6 h-6 rounded-full bg-pink-400 flex items-center justify-center text-violet-950"><Play size={11} fill="currentColor" /></span>}
        title="Continuer de regarder" actionLabel="Tout voir" onAction={onSeeAll} />

      <div className="flex gap-3">
        {/* Titre principal */}
        <div role="button" tabIndex={0} onClick={() => open(hero)} onKeyDown={(e) => e.key === "Enter" && open(hero)}
          className="relative flex-1 min-w-0 h-[116px] rounded-2xl overflow-hidden border border-white/15 cursor-pointer active:scale-[0.98] transition-transform">
          {hero.coverImage
            ? <LazyImage src={hero.coverImage} alt={hero.title} className="absolute inset-0 w-full h-full [&_img]:object-[center_25%]" />
            : <div className="absolute inset-0 flex items-center justify-center bg-violet-900"><HeroFallback size={28} className="text-violet-600" /></div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
          <Rate rating={hero.rating} />
          <div className="absolute inset-x-0 bottom-0 p-2.5 flex items-end gap-2">
            {heroNext?.canAdvance && (
              <button onClick={(e) => { e.stopPropagation(); haptics.success(); incrementEpisode(hero.id, heroNext.seasonIndex); }}
                aria-label="Marquer l'épisode suivant comme vu"
                className="w-8 h-8 rounded-full bg-amber-400 text-violet-950 flex items-center justify-center flex-shrink-0 shadow-lg active:scale-90 transition-transform">
                <Check size={15} strokeWidth={3} />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white leading-tight truncate" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{hero.title}</p>
              {heroNext && <p className="text-[10px] text-violet-200">S{heroNext.season.number ?? heroNext.seasonIndex + 1} • EP {heroNext.ep}</p>}
              <div className="flex items-center gap-2 mt-1">
                <span className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden"><span className="block h-full bg-amber-400 rounded-full" style={{ width: `${hp}%` }} /></span>
                {heroNext && <span className="font-mono text-[9px] text-white/90 flex-shrink-0">{heroNext.season.watchedEpisodes}/{heroNext.season.totalEpisodes ?? "?"}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* Deux suivants */}
        {rest.length > 0 && (
          <div className="flex flex-col gap-2 w-[46%] flex-shrink-0">
            {rest.slice(0, 2).map((e) => {
              const n = getNext(e);
              return (
                <button key={e.id} onClick={() => open(e)}
                  className="relative flex h-[54px] rounded-2xl overflow-hidden border border-white/15 bg-violet-900/40 text-left active:scale-[0.98] transition-transform">
                  <div className="w-[38%] flex-shrink-0 relative">
                    {e.coverImage ? <LazyImage src={e.coverImage} alt={e.title} className="absolute inset-0 w-full h-full" /> : <div className="absolute inset-0 bg-violet-950" />}
                  </div>
                  <div className="flex-1 min-w-0 px-2 py-1 flex flex-col justify-center">
                    <p className="text-[11px] font-semibold text-white leading-tight line-clamp-2" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>{e.title}</p>
                    {n && <p className="text-[9px] text-violet-300 mt-0.5">S{n.season.number ?? n.seasonIndex + 1} • EP {n.ep}</p>}
                  </div>
                  {e.rating > 0 && (
                    <span className="absolute top-1 right-1 flex items-center gap-0.5 px-1 rounded-full bg-black/40 text-[8px] font-mono font-semibold text-white">
                      <Star size={9} className="text-amber-400" fill="currentColor" strokeWidth={0} />{formatRating(e.rating)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
