import { withCache } from "../services/cache";

// TMDB — Jeton d'accès en lecture (themoviedb.org → Paramètres → API)
// Défini dans .env.local (jamais commité sur git, voir .env.example)
const TMDB_BEARER_TOKEN = import.meta.env.VITE_TMDB_TOKEN || "";

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function tmdbHeaders() {
  return { Authorization: `Bearer ${TMDB_BEARER_TOKEN}`, Accept: "application/json" };
}

export function hasTMDB() {
  return Boolean(TMDB_BEARER_TOKEN);
}

// Recherche une fiche série/anime sur TMDB (langue fr-FR).
// Retourne le titre FR, l'id TMDB et le résumé FR.
// Le résultat est mis en cache 30 min pour éviter les appels dupliqués
// (ex : plusieurs épisodes du même anime ouverts dans le calendrier).
export async function searchTMDBShow(title) {
  if (!TMDB_BEARER_TOKEN) return null;
  return withCache(`tmdb:search:${title.toLowerCase()}`, CACHE_TTL, async () => {
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
      return {
        id:       result.id,
        name:     result.name?.trim()  || null,           // titre localisé (fr-FR)
        overview: overview && overview.length > 10 ? overview : null,
      };
    } catch {
      return null;
    }
  });
}

// Récupère le nom français d'un épisode via TMDB.
// Pour les animes en cours de diffusion, on essaie la saison 1 en premier
// (c'est le mapping le plus courant), puis la saison "absolue" si besoin.
// Résultat mis en cache 30 min.
export async function fetchTMDBEpisodeFR(tmdbId, episodeNumber) {
  if (!TMDB_BEARER_TOKEN || !tmdbId || !episodeNumber) return null;
  return withCache(`tmdb:ep:${tmdbId}:${episodeNumber}`, CACHE_TTL, async () => {
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/tv/${tmdbId}/season/1/episode/${episodeNumber}?language=fr-FR`,
        { headers: tmdbHeaders() }
      );
      if (!res.ok) return null;
      const json = await res.json();
      const name = json.name?.trim();
      // Ignorer les noms génériques type "Épisode 3" ou vides
      if (!name || name.length < 2 || /^[eé]pisode\s+\d+$/i.test(name)) return null;
      return name;
    } catch {
      return null;
    }
  });
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