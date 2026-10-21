import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { haptics } from "../../utils/haptics";

// autoScroll : à l'ouverture, centre la liste sur le prochain épisode à voir (utile sur les longues séries).
export function EpisodeList({ episodes, totalEpisodes, watched, statusColor, onSetEpisode, unknownReason, autoScroll = false }) {
  const nextRef = useRef(null);
  useEffect(() => {
    if (autoScroll && watched > 4 && nextRef.current) nextRef.current.scrollIntoView({ block: "center" });
  }, []); // eslint-disable-line — une seule fois par montage (le parent remonte la liste à chaque saison)

  // Tenrai (source de la liste détaillée) est souvent en retard ou incomplet
  // pour les séries récentes/peu suivies — sa liste peut être plus courte que
  // le nombre d'épisodes réellement sortis (donné par AniList/totalEpisodes).
  // On complète avec des entrées génériques plutôt que de tronquer l'affichage
  // à ce que Tenrai connaît déjà.
  const rowCount = Math.max(episodes.length, totalEpisodes || 0);

  if (rowCount > 0) {
    return (
      <ul className="space-y-1">
        {Array.from({ length: rowCount }, (_, idx) => {
          const ep = episodes[idx];
          const isWatched = idx < watched;
          const isNext = idx === watched;
          return (
            <li
              key={idx}
              ref={isNext ? nextRef : undefined}
              onClick={() => { if (!onSetEpisode) return; haptics.tap(); onSetEpisode(isWatched ? idx : idx + 1); }}
              className={`flex items-center gap-3 px-2 min-h-[46px] rounded-lg transition-colors cursor-pointer hover:bg-white/10 active:bg-white/15 ${isWatched ? "bg-white/5" : ""} ${isNext ? "ring-1" : ""}`}
              style={isNext ? { "--tw-ring-color": `${statusColor}80` } : undefined}
            >
              <span className="flex-shrink-0 w-6 h-6 rounded-full border flex items-center justify-center transition-colors"
                style={{ borderColor: isWatched ? statusColor : "rgba(255,255,255,0.45)", backgroundColor: isWatched ? `${statusColor}20` : "transparent" }}>
                {isWatched && <Check size={12} style={{ color: statusColor }} />}
              </span>
              <span className="font-mono text-[11px] text-violet-500 flex-shrink-0">
                {String(ep?.number ?? idx + 1).padStart(2, "0")}
              </span>
              <span className={`text-sm truncate ${isWatched ? "text-violet-100" : "text-violet-300"}`}>
                {ep?.name || `Épisode ${ep?.number ?? idx + 1}`}
              </span>
              {isNext && <span className="ml-auto flex-shrink-0 font-mono text-[9px] uppercase tracking-wider" style={{ color: statusColor }}>Prochain</span>}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="space-y-1">
      {unknownReason === "not-released" ? (
        <p className="text-sm text-violet-500 py-6 text-center leading-relaxed">
          Cette saison n'est pas encore sortie.<br />
          Les épisodes apparaîtront à l'approche de la diffusion.
        </p>
      ) : unknownReason === "lost-link" ? (
        <p className="text-sm text-violet-500 py-6 text-center leading-relaxed">
          Ce titre a perdu son lien vers AniList (probablement suite à un ancien souci de synchronisation).<br />
          Supprime-le puis rajoute-le depuis la recherche pour le relier à nouveau.
        </p>
      ) : (
        <p className="text-sm text-violet-500 py-6 text-center">Nombre d'épisodes inconnu pour cette saison.</p>
      )}
    </ul>
  );
}