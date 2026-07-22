import { withCache } from "../services/cache";

const TMDB_BEARER_TOKEN = import.meta.env.VITE_TMDB_TOKEN || "";
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

function tmdbHeaders() {
  return { Authorization: `Bearer ${TMDB_BEARER_TOKEN}`, Accept: "application/json" };
}

export function hasTMDB() {
  return Boolean(TMDB_BEARER_TOKEN);
}

// ── Recherche + titre FR ──────────────────────────────────────────────────────
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
        name:     result.name?.trim() || null,
        overview: overview && overview.length > 10 ? overview : null,
      };
    } catch {
      return null;
    }
  });
}

// ── Disponibilité sur les plateformes françaises ──────────────────────────────
// Endpoint TMDB : GET /tv/{id}/watch/providers
// results.FR contient les offres streaming disponibles en France
// (flatrate = abonnement, free = gratuit, ads = avec pub).
// C'est la source la plus fiable pour savoir si un anime est
// streamable en VF/VOSTFR en France (ADN, Crunchyroll FR, Netflix FR…).
export async function fetchTMDBWatchProvidersFR(tmdbId) {
  if (!TMDB_BEARER_TOKEN || !tmdbId) return false;
  return withCache(`tmdb:providers:fr:${tmdbId}`, CACHE_TTL, async () => {
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/tv/${tmdbId}/watch/providers`,
        { headers: tmdbHeaders() }
      );
      if (!res.ok) return false;
      const json = await res.json();
      const fr = json.results?.FR;
      if (!fr) return false;
      // On considère disponible si au moins une offre streaming existe
      return !!(fr.flatrate?.length || fr.free?.length || fr.ads?.length);
    } catch {
      return false;
    }
  });
}

// ── Nom d'épisode en français ─────────────────────────────────────────────────
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
      if (!name || name.length < 2 || /^[eé]pisode\s+\d+$/i.test(name)) return null;
      return name;
    } catch {
      return null;
    }
  });
}

// ── Saison complète (noms d'épisodes + total) ─────────────────────────────────
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