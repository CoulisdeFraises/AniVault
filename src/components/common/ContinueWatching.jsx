import { useNavigate, useLocation } from "react-router-dom";
import { CalendarClock, Tv, Film, ChevronRight } from "lucide-react";
import { LazyImage } from "./LazyImage";

/**
 * Anciennement "Continuer à regarder" (prochain épisode non vu) — devenu un
 * carrousel des épisodes qui sortent AUJOURD'HUI parmi les titres suivis,
 * jugé plus utile au quotidien. Même emplacement, même style visuel.
 */
export function ContinueWatching({ todayAiring = [] }) {
  const navigate = useNavigate();
  const location = useLocation();

  if (!todayAiring.length) return null;

  return (
    <section className="mb-6 animate-fadeIn">
      {/* Titre de section */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CalendarClock size={12} className="text-amber-400" />
          <p className="font-mono text-[10px] uppercase tracking-widest text-violet-400">
            Sort aujourd'hui
          </p>
        </div>
        <span className="font-mono text-[10px] text-violet-600">
          {todayAiring.length} épisode{todayAiring.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* Carrousel horizontal */}
      <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
        {todayAiring.map(({ entry, episode, airingAt, cover }) => {
          const time = new Date(airingAt * 1000);
          const hasAired = Date.now() >= airingAt * 1000;
          const timeLabel = time.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

          return (
            <button
              key={`${entry.id}-${episode}`}
              onClick={() =>
                navigate(`/details/${entry.id}`, {
                  state: { backgroundLocation: location },
                })
              }
              className="flex-shrink-0 w-24 sm:w-28 rounded-xl overflow-hidden bg-violet-900/40 border border-white/5 hover:border-white/20 active:scale-[0.97] transition-all group"
            >
              <div className="relative aspect-[2/3] w-full">
                {cover ? (
                  <LazyImage
                    src={cover}
                    alt={entry.title}
                    className="absolute inset-0 w-full h-full group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-violet-950">
                    {entry.type === "anime" ? (
                      <Film size={20} className="text-violet-700" />
                    ) : (
                      <Tv size={20} className="text-violet-700" />
                    )}
                  </div>
                )}

                {/* Badge horaire */}
                <span className={`absolute top-1.5 right-1.5 font-mono text-[8px] font-semibold px-1.5 py-0.5 rounded-full ${
                  hasAired ? "bg-teal-500/80 text-white" : "bg-black/60 text-amber-300"
                }`}>
                  {hasAired ? "Sorti" : timeLabel}
                </span>

                {/* Overlay infos */}
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-2 pt-8">
                  <p
                    className="font-mono text-[9px] text-white leading-tight line-clamp-2 mb-1"
                    title={entry.title}
                  >
                    {entry.title}
                  </p>
                  <div className="flex items-center gap-0.5">
                    <ChevronRight size={8} className="text-amber-400 flex-shrink-0" />
                    <span className="font-mono text-[9px] text-amber-400 font-semibold">
                      Ép.{episode}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
