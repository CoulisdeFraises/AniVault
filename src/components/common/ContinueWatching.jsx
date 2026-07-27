import { useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Play, Tv, Film, ChevronRight } from "lucide-react";
import { useLibrary } from "../../context/LibraryContext";
import { LazyImage } from "./LazyImage";

function getFormatGroup(f) {
  if (!f || f === "TV" || f === "TV_SHORT") return "tv";
  if (f === "MOVIE") return "movie";
  return "extra";
}

export function ContinueWatching() {
  const { entries } = useLibrary();
  const navigate    = useNavigate();
  const location    = useLocation();

  const items = useMemo(() => {
    return entries
      .filter((e) => e.status === "en-cours")
      .map((e) => {

        // ── Condition 1 : l'utilisateur a déjà regardé au moins 1 épisode ──
        // Sans ça, toutes les séries "en-cours" jamais commencées apparaissent
        const hasStarted = e.seasons.some((s) => (s.watchedEpisodes || 0) > 0);
        if (!hasStarted) return null;

        const tvSeasons = e.seasons.filter(
          (s) => getFormatGroup(s.format) === "tv"
        );

        // ── Condition 2 : trouver la première saison TV avec des épisodes restants ──
        const activeSeason = tvSeasons.find((s) => {
          // Exclure les saisons sans aucun épisode connu (0 ou null non commencée)
          if (!s.totalEpisodes && (s.watchedEpisodes || 0) === 0) return false;
          // Exclure les saisons avec 0 épisode total (pas encore diffusé)
          if (s.totalEpisodes === 0) return false;
          // Garder : total inconnu (en cours de diffusion) OU épisodes restants à voir
          return s.totalEpisodes == null || s.watchedEpisodes < s.totalEpisodes;
        });

        if (!activeSeason) return null;

        // Dernière activité via watchHistory
        const lastActivity = (e.watchHistory || []).reduce(
          (max, h) => (h.watchedAt > max ? h.watchedAt : max),
          0
        );

        return {
          entry: e,
          activeSeason,
          nextEpisode: (activeSeason.watchedEpisodes || 0) + 1,
          cover: activeSeason.coverImage || e.coverImage,
          lastActivity,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.lastActivity - a.lastActivity)
      .slice(0, 8);
  }, [entries]);

  if (!items.length) return null;

  return (
    <section className="mb-6 animate-fadeIn">
      {/* Titre de section */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Play size={12} className="text-amber-400 fill-amber-400" />
          <p className="font-mono text-[10px] uppercase tracking-widest text-violet-400">
            Continuer à regarder
          </p>
        </div>
        <span className="font-mono text-[10px] text-violet-600">
          {items.length} en cours
        </span>
      </div>

      {/* Carrousel horizontal */}
      <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
        {items.map(({ entry, activeSeason, nextEpisode, cover }) => (
          <button
            key={entry.id}
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
                    {activeSeason.number > 1 ? `S${activeSeason.number} · ` : ""}
                    Ép.{nextEpisode}
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}