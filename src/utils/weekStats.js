// Stats "Votre semaine" — semaine calendaire lundi → dimanche (heure locale).

const DAY = 86400000;

export function getWeekStart(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dow = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - dow);
  return d.getTime();
}

function allWatchTimes(entries) {
  const out = [];
  entries.forEach((e) => (e.watchHistory || []).forEach((h) => { if (h.watchedAt) out.push(h.watchedAt); }));
  return out;
}

/**
 * Épisodes par jour pour la semaine en cours (index 0 = lundi),
 * total de la semaine, total de la semaine précédente, et titres démarrés
 * cette semaine (premier épisode vu depuis lundi).
 */
export function calcWeekStats(entries, now = new Date()) {
  const start = getWeekStart(now);
  const prevStart = start - 7 * DAY;
  const perDay = [0, 0, 0, 0, 0, 0, 0];
  let prevTotal = 0;

  allWatchTimes(entries).forEach((t) => {
    if (t >= start && t < start + 7 * DAY) perDay[Math.min(6, Math.floor((t - start) / DAY))]++;
    else if (t >= prevStart && t < start) prevTotal++;
  });

  const total = perDay.reduce((a, b) => a + b, 0);
  const startedThisWeek = entries.filter((e) => {
    const times = (e.watchHistory || []).map((h) => h.watchedAt).filter(Boolean);
    return times.length > 0 && Math.min(...times) >= start;
  }).length;

  return { perDay, total, prevTotal, startedThisWeek, todayIndex: (now.getDay() + 6) % 7 };
}

/** Plus longue série de jours consécutifs jamais atteinte. */
export function calcBestStreak(entries) {
  const days = new Set();
  allWatchTimes(entries).forEach((t) => {
    const d = new Date(t); d.setHours(0, 0, 0, 0); days.add(d.getTime());
  });
  const sorted = [...days].sort((a, b) => a - b);
  let best = 0, run = 0, prev = null;
  sorted.forEach((d) => {
    run = prev != null && Math.round((d - prev) / DAY) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  });
  return best;
}

export const WEEKLY_GOAL_KEY = "pref_weeklyGoal";
export const DEFAULT_WEEKLY_GOAL = 14;

export function getWeeklyGoal() {
  const n = parseInt(localStorage.getItem(WEEKLY_GOAL_KEY) || "", 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_WEEKLY_GOAL;
}
