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

/** Événement window émis quand une synchro vient de rafraîchir les prochaines diffusions
 *  (cartes et accueil relisent alors leur donnée — voir hooks/useSync.js). */
export const AIRING_REFRESH_EVENT = "anivault:airing-refreshed";

/**
 * Une saison TV est-elle « prévue mais pas encore sortie » ?
 *  - AniList le dit explicitement : `releaseStatus === "NOT_YET_RELEASED"` (champ
 *    enregistré à l'ajout / à l'actualisation d'un titre) ;
 *  - sinon (données plus anciennes, sans ce champ, ou source TVmaze) : c'est la
 *    DERNIÈRE saison, sans nombre d'épisodes connu (« 0 / ? ») et sans diffusion
 *    annoncée — elle ne peut rien avoir de disponible à regarder.
 */
function isUnreleasedSeason(season, hasUpcoming) {
  if (season.releaseStatus === "NOT_YET_RELEASED") return true;
  return season.releaseStatus == null && !hasUpcoming
    && (season.totalEpisodes == null || season.totalEpisodes === 0);
}

/**
 * isEnProduction — le titre a-t-il une saison TV encore en production ? (dernière
 * saison TV sans nombre d'épisodes connu, ou prévue mais pas encore sortie).
 * C'est une SURCOUCHE d'affichage (puce « En production »), qui s'ajoute au statut
 * normal du titre au lieu de le remplacer. Source unique : Card.jsx et useSync.js.
 */
export function isEnProduction(entry) {
  if (entry.status === "termine" || entry.status === "abandonne") return false;
  const tv = (entry.seasons || []).filter(isTVSeason);
  if (!tv.length) return false;
  const last = tv[tv.length - 1];
  return last.releaseStatus === "NOT_YET_RELEASED" || last.totalEpisodes == null || last.totalEpisodes === 0;
}

/**
 * isCaughtUp — un titre "en-cours" est-il "à jour" ? C'est-à-dire : TOUT ce qui est
 * déjà sorti a été vu. Trois situations :
 *  1. une saison diffuse et un prochain épisode est annoncé → il reste à voir
 *     uniquement s'il y a des épisodes sortis non vus ;
 *  2. la dernière saison est prévue mais pas sortie (ex. « Saison 3 — 0 / ? ») →
 *     « à jour » dès que les saisons déjà sorties sont terminées, même sans
 *     prochaine diffusion connue (c'était le cas qui restait bloqué en « en cours ») ;
 *  3. la diffusion est marquée en cours sans prochain épisode connu (pause) → on
 *     compare au nombre d'épisodes déjà sortis.
 *
 * `nextAiring` = { episode, airingAt } déjà récupéré ailleurs (aucun appel réseau ici).
 * `nextAiring.episode` est le numéro du PROCHAIN épisode annoncé. Si son heure de
 * diffusion est PASSÉE (donnée en cache pas encore renouvelée), cet épisode est
 * sorti : `now` permet de le prendre en compte tout de suite — sinon le statut
 * « à jour » restait affiché alors qu'un épisode était disponible.
 */
export function isCaughtUp(entry, nextAiring, now = Date.now()) {
  if (entry.status !== "en-cours") return false;
  const tv = (entry.seasons || []).filter(isTVSeason);
  if (!tv.length) return false;

  const hasUpcoming = !!nextAiring?.airingAt && nextAiring.episode != null;
  const last = tv[tv.length - 1];
  const lastUnreleased = isUnreleasedSeason(last, hasUpcoming);

  // Saisons dont des épisodes peuvent déjà être regardés.
  const watchable = lastUnreleased ? tv.slice(0, -1) : tv;
  if (!watchable.length) return false;

  // Toute saison antérieure doit être terminée (total connu et atteint).
  for (const s of watchable.slice(0, -1)) {
    if (s.totalEpisodes == null || (s.watchedEpisodes || 0) < s.totalEpisodes) return false;
  }

  const cur = watchable[watchable.length - 1];
  const watched = cur.watchedEpisodes || 0;

  if (!lastUnreleased && hasUpcoming) {
    const released = nextAiring.airingAt <= now ? nextAiring.episode : nextAiring.episode - 1;
    return watched >= released;
  }
  if (lastUnreleased) return cur.totalEpisodes != null && watched >= cur.totalEpisodes;
  if (cur.releaseStatus === "RELEASING" && cur.totalEpisodes != null) return watched >= cur.totalEpisodes;
  return false;
}

/**
 * getDisplayStatus — statut à AFFICHER (puce/chip), distinct du statut
 * STOCKÉ (`entry.status`). Ne jamais utiliser cette valeur pour de la
 * logique métier (sync, notifs, achievements...) : ces derniers doivent
 * continuer à tester `entry.status` directement.
 */
export function getDisplayStatus(entry, nextAiring, now = Date.now()) {
  return isCaughtUp(entry, nextAiring, now) ? "a-jour" : entry.status;
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
