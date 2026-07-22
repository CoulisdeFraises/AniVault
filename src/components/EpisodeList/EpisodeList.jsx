import { Check } from "lucide-react";

export function EpisodeList({ episodes, totalEpisodes, watched, statusColor, onSetEpisode }) {
  if (episodes.length > 0) {
    return (
      <ul className="space-y-1">
        {episodes.map((ep, idx) => {
          const isWatched = idx < watched;
          const isClickable = idx === watched || idx === watched - 1;
          return (
            <li
              key={idx}
              onClick={() => { if (!isClickable || !onSetEpisode) return; onSetEpisode(isWatched ? idx : idx + 1); }}
              className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${isWatched ? "bg-white/5" : ""} ${isClickable ? "cursor-pointer hover:bg-white/10" : ""}`}
            >
              <span className="flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center transition-colors"
                style={{ borderColor: isWatched ? statusColor : isClickable ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.2)", backgroundColor: isWatched ? `${statusColor}20` : "transparent" }}>
                {isWatched && <Check size={10} style={{ color: statusColor }} />}
              </span>
              <span className="font-mono text-[11px] text-violet-500 flex-shrink-0">
                {String(ep.number).padStart(2, "0")}
              </span>
              <span className={`text-sm truncate ${isWatched ? "text-violet-100" : isClickable ? "text-violet-300" : "text-violet-400"}`}>
                {ep.name || `Épisode ${ep.number}`}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className="space-y-1">
      {Array.from({ length: totalEpisodes || 0 }, (_, i) => {
        const isWatched = i < watched;
        const isClickable = i === watched || i === watched - 1;
        return (
          <li
            key={i}
            onClick={() => { if (!isClickable || !onSetEpisode) return; onSetEpisode(isWatched ? i : i + 1); }}
            className={`flex items-center gap-3 p-2 rounded-lg ${isWatched ? "bg-white/5" : ""} ${isClickable ? "cursor-pointer hover:bg-white/10" : ""}`}
          >
            <span className="flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center"
              style={{ borderColor: isWatched ? statusColor : isClickable ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.2)", backgroundColor: isWatched ? `${statusColor}20` : "transparent" }}>
              {isWatched && <Check size={10} style={{ color: statusColor }} />}
            </span>
            <span className="font-mono text-[11px] text-violet-500 flex-shrink-0">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className={`text-sm ${isWatched ? "text-violet-100" : isClickable ? "text-violet-300" : "text-violet-400"}`}>
              Épisode {i + 1}
            </span>
          </li>
        );
      })}
      {!totalEpisodes && (
        <p className="text-sm text-violet-500 py-6 text-center">Nombre d'épisodes inconnu pour cette saison.</p>
      )}
    </ul>
  );
}