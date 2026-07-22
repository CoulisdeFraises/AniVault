// TMDB — Jeton d'accès en lecture (themoviedb.org → Paramètres → API)
// Défini dans .env.local (jamais commité sur git, voir .env.example)
const TMDB_BEARER_TOKEN = import.meta.env.VITE_TMDB_TOKEN || "";

function tmdbHeaders() {
  return { Authorization: `Bearer ${TMDB_BEARER_TOKEN}`, Accept: "application/json" };
}

export function hasTMDB() {
  return Boolean(TMDB_BEARER_TOKEN);
}

// Recherche une fiche série/anime sur TMDB. Renvoie l'id TMDB (réutilisé
// ensuite pour aller chercher chaque saison précisément) et un résumé FR.
export async function searchTMDBShow(title) {
  if (!TMDB_BEARER_TOKEN) return null;
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(title)}&language=fr-FR&page=1`,
      { headers: tmdbHeaders() }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const result = json.results?.[0];
    if (!result) return null;
    const overview = result.overview?.trim();
    return { id: result.id, overview: overview && overview.length > 10 ? overview : null };
  } catch {
    return null;
  }
}

// Détail d'une saison précise : noms d'épisodes + total, mis à jour par TMDB
// au fil de la diffusion — c'est la source la plus fiable pour une saison
// en cours de parution.
export async function fetchTMDBSeason(tmdbId, seasonNumber) {
  if (!TMDB_BEARER_TOKEN || !tmdbId || !seasonNumber) return null;
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}?language=fr-FR`,
      { headers: tmdbHeaders() }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const episodes = (json.episodes || []).map((e) => ({ number: e.episode_number, name: e.name || null }));
    if (!episodes.length) return null;
    return { episodes, totalEpisodes: episodes.length };
  } catch {
    return null;
  }
}