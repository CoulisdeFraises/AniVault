export const STATUS = {
  "en-cours":  { label: "En cours",  dot: "bg-amber-400", text: "text-amber-300", border: "border-amber-400", bar: "bg-amber-400", color: "#fbbf24" },
  "termine":   { label: "Terminé",   dot: "bg-teal-400",  text: "text-teal-300",  border: "border-teal-400",  bar: "bg-teal-400",  color: "#2dd4bf" },
  "a-voir":    { label: "À voir",    dot: "bg-sky-400",   text: "text-sky-300",   border: "border-sky-400",   bar: "bg-sky-400",   color: "#38bdf8" },
  "abandonne": { label: "Abandonné", dot: "bg-rose-400",  text: "text-rose-300",  border: "border-rose-400",  bar: "bg-rose-400",  color: "#fb7185" },
};
export const STATUS_ORDER = ["en-cours", "termine", "a-voir", "abandonne"];

export function seasonTotals(seasons) {
  if (!seasons?.length) return { watched: 0, total: 0 };
  const hasUnknown = seasons.some((s) => s.totalEpisodes == null);
  const watched    = seasons.reduce((sum, s) => sum + (s.watchedEpisodes || 0), 0);
  const total      = hasUnknown ? null : seasons.reduce((sum, s) => sum + (s.totalEpisodes || 0), 0);
  return { watched, total };
}

function isTVSeason(s) { const f = s.format; return !f || f === "TV" || f === "TV_SHORT"; }

export function autoStatus(entry, updatedSeasons) {
  const tvS  = updatedSeasons.filter(isTVSeason);
  const ref  = tvS.length ? tvS : updatedSeasons;
  const { watched: tvW, total: tvT } = seasonTotals(ref);
  const { watched }                  = seasonTotals(updatedSeasons);
  if (tvT != null && tvT > 0 && tvW >= tvT) return "termine";
  if (entry.status === "termine") return watched > 0 ? "en-cours" : "a-voir";
  if (watched > 0 && entry.status === "a-voir") return "en-cours";
  if (watched === 0 && entry.status === "en-cours") return "a-voir";
  return entry.status;
}

export function formatCountdown(airingAt) {
  const diff = airingAt - Date.now(); if (diff <= 0) return null;
  const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), m = Math.floor((diff % 3600000) / 60000);
  if (d >= 1) return `dans ${d}j${h > 0 ? ` ${h}h` : ""}`;
  if (h >= 1) return `dans ${h}h${m > 0 ? ` ${m}min` : ""}`;
  return `dans ${m}min`;
}

export function getRatingEmoji(r) {
  if (!r) return null;
  if (r <= 2) return "😭"; if (r <= 4) return "😞"; if (r === 5) return "😐";
  if (r <= 7) return "😊"; if (r <= 9) return "😁"; return "🤩";
}
