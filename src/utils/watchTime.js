// Durée moyenne par épisode (en minutes)
const AVG_DURATION = { anime: 24, serie: 45 };

export function calcWatchMinutes(entries) {
  return entries.reduce((sum, entry) => {
    const duration = AVG_DURATION[entry.type] ?? 24;
    const eps = entry.seasons.reduce((s, season) => s + (season.watchedEpisodes || 0), 0);
    return sum + eps * duration;
  }, 0);
}

// unit : "auto" (jours/heures/minutes, par défaut) | "months" | "years"
export function formatWatchTime(totalMinutes, unit = "auto") {
  if (unit === "years") {
    const years = totalMinutes / (60 * 24 * 365.25);
    return years >= 0.1 ? `${years.toFixed(1)} an${years >= 1.95 ? "s" : ""}` : "< 1 mois";
  }
  if (unit === "months") {
    const months = totalMinutes / (60 * 24 * 30.44);
    return months >= 0.1 ? `${months.toFixed(1)} mois` : `${totalMinutes}min`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const days  = Math.floor(hours / 24);
  const mins  = totalMinutes % 60;

  if (days >= 1)  return `${days}j ${hours % 24}h`;
  if (hours >= 1) return `${hours}h ${mins}min`;
  return `${totalMinutes}min`;
}

export function calcWatchTime(entries, unit = "auto") {
  return formatWatchTime(calcWatchMinutes(entries), unit);
}

// Série de jours consécutifs (streak) en cours : nombre de jours d'affilée
// jusqu'à aujourd'hui, avec au moins un épisode vu chaque jour. Si rien n'a
// encore été vu aujourd'hui, on démarre le décompte à hier (la journée en
// cours n'est "cassée" qu'à minuit, pas avant).
export function calcCurrentStreak(entries) {
  const days = new Set();
  entries.forEach((entry) => {
    (entry.watchHistory || []).forEach((h) => {
      if (!h.watchedAt) return;
      const d = new Date(h.watchedAt);
      d.setHours(0, 0, 0, 0);
      days.add(d.getTime());
    });
  });
  if (!days.size) return 0;

  const DAY   = 86400000;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let cursor  = today.getTime();
  if (!days.has(cursor)) cursor -= DAY;

  let streak = 0;
  while (days.has(cursor)) { streak++; cursor -= DAY; }
  return streak;
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