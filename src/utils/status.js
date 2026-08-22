export const STATUS = {
  "en-cours":  { label: "En cours",  dot: "bg-amber-400", text: "text-amber-300", border: "border-amber-400", bar: "bg-amber-400", color: "#fbbf24" },
  "a-jour":    { label: "À jour",    dot: "bg-lime-400",  text: "text-lime-300",  border: "border-lime-400",  bar: "bg-lime-400",  color: "#a3e635" },
  "termine":   { label: "Terminé",   dot: "bg-teal-400",  text: "text-teal-300",  border: "border-teal-400",  bar: "bg-teal-400",  color: "#2dd4bf" },
  "a-voir":    { label: "À voir",    dot: "bg-sky-400",   text: "text-sky-300",   border: "border-sky-400",   bar: "bg-sky-400",   color: "#38bdf8" },
  "abandonne": { label: "Abandonné", dot: "bg-rose-400",  text: "text-rose-300",  border: "border-rose-400",  bar: "bg-rose-400",  color: "#fb7185" },
};
// Statuts persistés/éditables manuellement (formulaire d'édition, sanitize
// de LibraryContext, achievements, sync, notifs...) — INCHANGÉ à dessein.
// "à jour" n'y figure PAS : ce n'est pas un statut stocké mais un affichage
// dérivé (voir getDisplayStatus ci-dessous), calculé à la volée à partir du
// statut "en-cours" + de la prochaine diffusion connue. Le stocker tel quel
// casserait toute la logique qui teste `entry.status === "en-cours"`
// ailleurs dans l'app (sync, notifications, achievements...).
export const STATUS_ORDER = ["en-cours", "termine", "a-voir", "abandonne"];
// Ordre utilisé UNIQUEMENT pour les puces de filtre (FilterPanel), qui elles
// doivent pouvoir cibler "à jour" séparément de "en-cours".
export const FILTER_STATUS_ORDER = ["en-cours", "a-jour", "termine", "a-voir", "abandonne"];

export function seasonTotals(seasons) {
  if (!seasons?.length) return { watched: 0, total: 0 };
  const hasUnknown = seasons.some((s) => s.totalEpisodes == null);
  const watched    = seasons.reduce((sum, s) => sum + (s.watchedEpisodes || 0), 0);
  const total      = hasUnknown ? null : seasons.reduce((sum, s) => sum + (s.totalEpisodes || 0), 0);
  return { watched, total };
}

function isTVSeason(s) { const f = s.format; return !f || f === "TV" || f === "TV_SHORT"; }

/**
 * getActiveTVSeason — la saison TV "en cours de diffusion" : la première
 * saison pas encore complète, sinon la dernière saison TV de la fiche.
 * C'est cette même saison que vise `fetchNextAiring` (dernier anilistId /
 * tvmazeId), donc c'est la seule dont le nombre d'épisodes vus doit être
 * comparé au seuil `nextAiring.episode`.
 */
function getActiveTVSeason(seasons) {
  const tv = (seasons || []).filter(isTVSeason);
  if (!tv.length) return null;
  const i = tv.findIndex((s) => s.totalEpisodes == null || s.watchedEpisodes < s.totalEpisodes);
  return i === -1 ? tv[tv.length - 1] : tv[i];
}

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

/**
 * isCaughtUp — un titre "en-cours" est-il "à jour" ? C'est-à-dire : tous
 * les épisodes déjà sortis de la saison actuellement diffusée ont été vus,
 * mais la diffusion continue (un prochain épisode est déjà annoncé).
 *
 * `nextAiring` est la donnée { episode, airingAt } déjà récupérée par
 * ailleurs (Card.jsx / Details.jsx font déjà cet appel pour le compte à
 * rebours et l'auto-correction d'un statut "Terminé" resté figé) — cette
 * fonction ne fait AUCUN appel réseau, elle ne fait que la lecture.
 *
 * `nextAiring.episode` est le numéro du PROCHAIN épisode (pas encore
 * diffusé) : episode - 1 est donc le nombre d'épisodes déjà sortis.
 *
 * FIX : on ne compare plus au total tous-saisons-confondues (`entry.seasons`),
 * qui restait artificiellement élevé sur une fiche multi-saisons (saisons
 * précédentes déjà vues) et empêchait le chip de redescendre — même après
 * un -1 sur la saison en cours, ou quand un nouvel épisode sortait. On ne
 * compare désormais qu'à la saison TV active elle-même.
 */
export function isCaughtUp(entry, nextAiring) {
  if (entry.status !== "en-cours") return false;
  if (!nextAiring?.airingAt || nextAiring.episode == null) return false;
  const active = getActiveTVSeason(entry.seasons);
  const watched = active?.watchedEpisodes || 0;
  return watched >= nextAiring.episode - 1;
}

/**
 * getDisplayStatus — statut à AFFICHER (puce/chip), distinct du statut
 * STOCKÉ (`entry.status`). Ne jamais utiliser cette valeur pour de la
 * logique métier (sync, notifs, achievements...) : ces derniers doivent
 * continuer à tester `entry.status` directement.
 */
export function getDisplayStatus(entry, nextAiring) {
  return isCaughtUp(entry, nextAiring) ? "a-jour" : entry.status;
}

export function formatCountdown(airingAt) {
  const diff = airingAt - Date.now(); if (diff <= 0) return null;
  const d = Math.floor(diff / 86400000), h = Math.floor((diff % 86400000) / 3600000), m = Math.floor((diff % 3600000) / 60000);
  if (d >= 1) return `dans ${d}j${h > 0 ? ` ${h}h` : ""}`;
  if (h >= 1) return `dans ${h}h${m > 0 ? ` ${m}min` : ""}`;
  return `dans ${m}min`;
}

/**
 * computeOverallRating — calcule la note globale d'un titre à partir des
 * notes données saison par saison. Moyenne arrondie au dixième des saisons
 * notées (rating > 0) ; retourne 0 si aucune saison n'a encore été notée.
 */
export function computeOverallRating(seasons) {
  if (!seasons?.length) return 0;
  const rated = seasons.filter((s) => s.rating > 0);
  if (!rated.length) return 0;
  const avg = rated.reduce((sum, s) => sum + s.rating, 0) / rated.length;
  return Math.round(avg * 10) / 10;
}

/** formatRating — "8" reste "8", "7.5" reste "7.5" (pas de zéro superflu). */
export function formatRating(r) {
  if (!r) return null;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

export function getRatingEmoji(r) {
  if (!r) return null;
  if (r <= 2) return "😭"; if (r <= 4) return "😞"; if (r === 5) return "😐";
  if (r <= 7) return "😊"; if (r <= 9) return "😁"; return "🤩";
}
