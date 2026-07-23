// Durée moyenne par épisode (en minutes)
const AVG_DURATION = { anime: 24, serie: 45 };

export function calcWatchTime(entries) {
  const totalMinutes = entries.reduce((sum, entry) => {
    const duration = AVG_DURATION[entry.type] ?? 24;
    const eps = entry.seasons.reduce((s, season) => s + (season.watchedEpisodes || 0), 0);
    return sum + eps * duration;
  }, 0);

  const hours = Math.floor(totalMinutes / 60);
  const days  = Math.floor(hours / 24);
  const mins  = totalMinutes % 60;

  if (days >= 1)  return `${days}j ${hours % 24}h`;
  if (hours >= 1) return `${hours}h ${mins}min`;
  return `${totalMinutes}min`;
}

// Regroupe le watchHistory par mois sur les N derniers mois
export function groupHistoryByMonth(entries, months = 6) {
  const now    = new Date();
  const result = [];

  for (let i = months - 1; i >= 0; i--) {
    const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year  = d.getFullYear();
    const month = d.getMonth();
    const label = d.toLocaleDateString("fr-FR", { month: "short" });

    const count = entries.reduce((sum, entry) => {
      return sum + (entry.watchHistory || []).filter((h) => {
        const hd = new Date(h.watchedAt);
        return hd.getFullYear() === year && hd.getMonth() === month;
      }).length;
    }, 0);

    result.push({ label, count, year, month });
  }
  return result;
}

// Liste les N derniers épisodes regardés toutes entrées confondues
export function getRecentHistory(entries, limit = 30) {
  const all = entries.flatMap((entry) =>
    (entry.watchHistory || []).map((h) => ({ ...h, entry }))
  );
  return all
    .sort((a, b) => b.watchedAt - a.watchedAt)
    .slice(0, limit);
}