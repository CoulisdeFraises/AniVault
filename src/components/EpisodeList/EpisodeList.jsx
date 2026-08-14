import { Check } from "lucide-react";
import { haptics } from "../../utils/haptics";

export function EpisodeList({ episodes, totalEpisodes, watched, statusColor, onSetEpisode, unknownReason }) {
  // Jikan (source de la liste détaillée) est souvent en retard ou incomplet
  // pour les séries récentes/peu suivies — sa liste peut être plus courte que
  // le nombre d'épisodes réellement sortis (donné par AniList/totalEpisodes).
  // On complète avec des entrées génériques plutôt que de tronquer l'affichage
  // à ce que Jikan connaît déjà.
  const rowCount = Math.max(episodes.length, totalEpisodes || 0);

  if (rowCount > 0) {
    return (
      <ul className="space-y-1">
        {Array.from({ length: rowCount }, (_, idx) => {
          const ep = episodes[idx];
          const isWatched = idx < watched;
          return (
            <li
              key={idx}
              onClick={() => { if (!onSetEpisode) return; haptics.tap(); onSetEpisode(isWatched ? idx : idx + 1); }}
              className={`flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer hover:bg-white/10 ${isWatched ? "bg-white/5" : ""}`}
            >
              <span className="flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-colors"
                style={{ borderColor: isWatched ? statusColor : "rgba(255,255,255,0.45)", backgroundColor: isWatched ? `${statusColor}20` : "transparent" }}>
                {isWatched && <Check size={10} style={{ color: statusColor }} />}
              </span>
              <span className="font-mono text-[11px] text-violet-500 flex-shrink-0">
                {String(ep?.number ?? idx + 1).padStart(2, "0")}
              </span>
              <span className={`text-sm truncate ${isWatched ? "text-violet-100" : "text-violet-300"}`}>
                {ep?.name || `Épisode ${ep?.number ?? idx + 1}`}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="space-y-1">
      {unknownReason === "lost-link" ? (
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