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

// ── Recherche de films ────────────────────────────────────────────────────────
export async function searchTMDBMovies(query) {
  if (!TMDB_BEARER_TOKEN) return [];
  return withCache(`tmdb:movies:${query.toLowerCase()}`, CACHE_TTL, async () => {
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}&language=fr-FR&page=1`,
        { headers: tmdbHeaders() }
      );
      if (!res.ok) return [];
      const json = await res.json();
      return (json.results || []).map((m) => ({
        source: "tmdb_movie",
        id:       m.id,
        title:    m.title || m.original_title,
        year:     m.release_date ? parseInt(m.release_date.slice(0, 4)) : null,
        image:    m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : null,
        overview: m.overview?.trim() || null,
        genreIds: m.genre_ids || [],
        format:   "MOVIE",
      }));
    } catch {
      return [];
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

// ── Mappings nom de genre → ID TMDB ──────────────────────────────────────────
export const GENRE_TO_TMDB_MOVIE_ID = {
  action: 28, adventure: 12, aventure: 12, animation: 16,
  comedy: 35, "comédie": 35, comedie: 35, crime: 80, policier: 80,
  documentary: 99, documentaire: 99, drama: 18, drame: 18,
  family: 10751, famille: 10751, fantasy: 14, fantastique: 14,
  history: 36, histoire: 36, horror: 27, horreur: 27,
  music: 10402, musique: 10402, mystery: 9648, "mystère": 9648,
  romance: 10749, "science fiction": 878, "science-fiction": 878,
  "sci-fi": 878, thriller: 53, war: 10752, guerre: 10752,
  western: 37, psychological: 53, psychologique: 53, supernatural: 14,
};

export const GENRE_TO_TMDB_TV_ID = {
  action: 10759, adventure: 10759, aventure: 10759, animation: 16,
  comedy: 35, "comédie": 35, comedie: 35, crime: 80, policier: 80,
  documentary: 99, documentaire: 99, drama: 18, drame: 18,
  family: 10751, famille: 10751, fantasy: 10765, fantastique: 10765,
  history: 36, histoire: 36, mystery: 9648, "mystère": 9648,
  romance: 10749, "science fiction": 10765, "science-fiction": 10765,
  "sci-fi": 10765, thriller: 53, war: 10768, guerre: 10768,
  western: 37, supernatural: 10765,
};

// ── Discover films par genres ─────────────────────────────────────────────────
export async function fetchTMDBDiscoverMovies(genreIds = [], excludeTmdbIds = []) {
  if (!TMDB_BEARER_TOKEN || !genreIds.length) return [];
  const cacheKey = `tmdb:disc:mv:${[...genreIds].sort().join(",")}`;
  return withCache(cacheKey, CACHE_TTL, async () => {
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/discover/movie?with_genres=${genreIds.join("|")}&language=fr-FR&sort_by=popularity.desc&page=1&include_adult=false&vote_count.gte=100`,
        { headers: tmdbHeaders() }
      );
      if (!res.ok) return [];
      const json = await res.json();
      return (json.results || [])
        .filter((m) => !excludeTmdbIds.includes(m.id))
        .slice(0, 24)
        .map((m) => ({
          source:      "tmdb_movie",
          id:          m.id,
          title:       m.title || m.original_title,
          image:       m.poster_path ? `https://image.tmdb.org/t/p/w342${m.poster_path}` : null,
          year:        m.release_date ? parseInt(m.release_date.slice(0, 4)) : null,
          score:       m.vote_average ? Math.round(m.vote_average * 10) : 0,
          description: m.overview?.trim() || null,
          genres:      [],
          format:      "MOVIE",
        }));
    } catch {
      return [];
    }
  });
}

// ── Discover séries TV par genres ─────────────────────────────────────────────
export async function fetchTMDBDiscoverSeries(genreIds = [], excludeTmdbIds = []) {
  if (!TMDB_BEARER_TOKEN || !genreIds.length) return [];
  const cacheKey = `tmdb:disc:tv:${[...genreIds].sort().join(",")}`;
  return withCache(cacheKey, CACHE_TTL, async () => {
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/discover/tv?with_genres=${genreIds.join("|")}&language=fr-FR&sort_by=popularity.desc&page=1&vote_count.gte=50`,
        { headers: tmdbHeaders() }
      );
      if (!res.ok) return [];
      const json = await res.json();
      return (json.results || [])
        .filter((s) => !excludeTmdbIds.includes(s.id))
        .slice(0, 24)
        .map((s) => ({
          source:      "tmdb_tv",
          id:          s.id,
          title:       s.name || s.original_name,
          image:       s.poster_path ? `https://image.tmdb.org/t/p/w342${s.poster_path}` : null,
          year:        s.first_air_date ? parseInt(s.first_air_date.slice(0, 4)) : null,
          score:       s.vote_average ? Math.round(s.vote_average * 10) : 0,
          description: s.overview?.trim() || null,
          genres:      [],
          format:      "TV",
        }));
    } catch {
      return [];
    }
  });
}