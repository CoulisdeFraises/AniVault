export const STATUS = {
  "en-cours":  { label: "En cours",   dot: "bg-amber-400", text: "text-amber-300", border: "border-amber-400", bar: "bg-amber-400", color: "#fbbf24" },
  "termine":   { label: "Terminé",    dot: "bg-teal-400",  text: "text-teal-300",  border: "border-teal-400",  bar: "bg-teal-400",  color: "#2dd4bf" },
  "a-voir":    { label: "À voir",     dot: "bg-sky-400",   text: "text-sky-300",   border: "border-sky-400",   bar: "bg-sky-400",   color: "#38bdf8" },
  "abandonne": { label: "Abandonné",  dot: "bg-rose-400",  text: "text-rose-300",  border: "border-rose-400",  bar: "bg-rose-400",  color: "#fb7185" },
};

export const STATUS_ORDER = ["en-cours", "termine", "a-voir", "abandonne"];

export function seasonTotals(seasons) {
  const hasUnknown = seasons.some((s) => s.totalEpisodes == null);
  const watched = seasons.reduce((sum, s) => sum + (s.watchedEpisodes || 0), 0);
  const total = hasUnknown ? null : seasons.reduce((sum, s) => sum + (s.totalEpisodes || 0), 0);
  return { watched, total };
}

// Une saison est "TV" si elle n'a pas de format renseigné (données existantes)
// ou si son format est TV ou TV_SHORT.
function isTVSeason(season) {
  const fmt = season.format;
  return !fmt || fmt === "TV" || fmt === "TV_SHORT";
}

/**
 * Calcule le statut automatique d'une entrée.
 * Règle : "terminé" = toutes les saisons TV (série principale) sont vues.
 * Les OVA/ONA/Films non vus ne bloquent PAS le passage à "terminé".
 */
export function autoStatus(entry, updatedSeasons) {
  const tvSeasons  = updatedSeasons.filter(isTVSeason);
  // Fallback : si pas de saison TV (franchise 100 % OVA/Films), on compte tout
  const refSeasons = tvSeasons.length ? tvSeasons : updatedSeasons;

  const { watched: tvWatched, total: tvTotal } = seasonTotals(refSeasons);
  const { watched }                             = seasonTotals(updatedSeasons);

  if (tvTotal != null && tvTotal > 0 && tvWatched >= tvTotal) return "termine";
  if (entry.status === "termine") return watched > 0 ? "en-cours" : "a-voir";
  if (watched > 0 && entry.status === "a-voir") return "en-cours";
  if (watched === 0 && entry.status === "en-cours") return "a-voir";
  return entry.status;
}

export function formatCountdown(airingAt) {
  const diff = airingAt - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  if (days >= 1) return `dans ${days}j${hours > 0 ? ` ${hours}h` : ""}`;
  if (hours >= 1) return `dans ${hours}h${minutes > 0 ? ` ${minutes}min` : ""}`;
  return `dans ${minutes}min`;
}

export function getRatingEmoji(rating) {
  if (!rating) return null;
  if (rating <= 2) return "😭";
  if (rating <= 4) return "😞";
  if (rating === 5) return "😐";
  if (rating <= 7) return "😊";
  if (rating <= 9) return "😁";
  return "🤩";
}
