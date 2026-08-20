import { anilistQuery } from "./anilist";
import { getMediaDetails } from "./media";
import {
  fetchTMDBDiscoverMovies,
  fetchTMDBDiscoverSeries,
  hasTMDB,
  GENRE_TO_TMDB_MOVIE_ID,
  GENRE_TO_TMDB_TV_ID,
} from "./tmdb";

function isCultureModeOn() {
  return localStorage.getItem("pref_culture_mode") === "true";
}

function mapMedia(m) {
  return {
    source:      "anilist",
    id:          m.id,
    title:       m.title.english || m.title.romaji,
    titleAlt:    [m.title.romaji, m.title.english].filter(Boolean), // ← pour le matching anti-doublons
    image:       m.coverImage?.large,
    genres:      m.genres || [],
    episodes:    m.episodes,
    year:        m.seasonYear,
    score:       m.averageScore,
    description: m.description,
    isAdult:     m.isAdult || false,
    format:      m.format || null, // ← pour repérer les films (rattachement croisé anti-doublons)
  };
}

// Récupère des recommandations AniList basées sur les genres fournis
// et exclut les IDs déjà dans la bibliothèque.
// Utilisé pour les recommandations générales (basées sur les goûts globaux).
// `page` permet au pull-to-refresh de demander un lot différent.
//
// IMPORTANT : `genre_in` côté API AniList fonctionne en ET, pas en OU — un
// média doit posséder TOUS les genres listés pour matcher. Passer d'un coup
// les 5 genres préférés d'un profil (souvent variés : Action + Romance +
// Slice of Life...) ne renvoie donc presque jamais rien, puisque très peu
// d'animes cochent simultanément 5 genres différents. On interroge donc
// CHAQUE genre séparément (en parallèle) puis on fusionne en entrelaçant les
// résultats, pour un vrai comportement "au moins un des genres préférés".
export async function fetchAniListRecommendations(genres = [], excludeAnilistIds = [], { page = 1 } = {}) {
  if (!genres.length) return [];
  const cultureMode = isCultureModeOn();

  const query = `
    query ($genre: String, $page: Int) {
      Page(page: $page, perPage: 20) {
        media(
          genre_in: [$genre]
          type: ANIME
          sort: POPULARITY_DESC
          status_in: [FINISHED, RELEASING, HIATUS]
          format_in: [TV, TV_SHORT, OVA, ONA, MOVIE]
        ) {
          id
          title { english romaji }
          coverImage { large }
          genres
          episodes
          description(asHtml: false)
          seasonYear
          averageScore
          isAdult
          format
        }
      }
    }
  `;

  try {
    const settled = await Promise.allSettled(
      genres.map((genre) => anilistQuery(query, { genre, page }))
    );
    const perGenreLists = settled.map((r) =>
      r.status === "fulfilled" ? (r.value.data?.Page?.media || []) : []
    );

    // Entrelace les listes par genre (round-robin) plutôt que de les mettre
    // bout à bout — évite qu'un seul genre écrase tous les autres en tête.
    const merged = [];
    const seen = new Set();
    const maxLen = Math.max(0, ...perGenreLists.map((l) => l.length));
    for (let i = 0; i < maxLen; i++) {
      for (const list of perGenreLists) {
        const m = list[i];
        if (m && !seen.has(m.id)) { seen.add(m.id); merged.push(m); }
      }
    }

    return merged
      .filter((m) => !excludeAnilistIds.includes(m.id))
      .filter((m) => cultureMode || !m.isAdult)
      .slice(0, 40)
      .map(mapMedia);
  } catch {
    return [];
  }
}

// Récupère les "titres similaires" à une œuvre précise via le graphe de
// recommandations AniList (votes communautaires "si tu as aimé X, tu aimeras Y").
// Beaucoup plus pertinent qu'un simple filtre par genre car spécifique au titre,
// et fonctionne aussi bien pour du contenu adulte (hentai) puisqu'on part du
// titre lui-même plutôt que d'une liste de genres génériques.
//
// Passe par le cache partagé (fonction Edge Supabase) : la fiche de `anilistId`
// est très probablement déjà en cache (consultée via Details.jsx), donc cet
// appel ne déclenche souvent aucune requête réseau supplémentaire.
export async function fetchSimilarTitles(anilistId, excludeAnilistIds = []) {
  if (!anilistId) return [];
  const cultureMode = isCultureModeOn();

  try {
    const media = await getMediaDetails("anilist", anilistId);
    const nodes = media?.recommendations?.nodes || [];
    const similar = nodes
      .map((n) => n.mediaRecommendation)
      .filter(Boolean)
      .filter((m) => !excludeAnilistIds.includes(m.id))
      .filter((m) => cultureMode || !m.isAdult);

    // Filet de sécurité : si le titre est trop récent/confidentiel pour avoir
    // des recommandations communautaires, on complète avec ses propres genres.
    if (similar.length < 6 && media?.genres?.length) {
      const fallback = await fetchAniListRecommendations(
        media.genres,
        [...excludeAnilistIds, anilistId, ...similar.map((m) => m.id)]
      );
      return [...similar.map(mapMedia), ...fallback].slice(0, 20);
    }

    return similar.slice(0, 20).map(mapMedia);
  } catch {
    return [];
  }
}

// ── Culture Zone ───────────────────────────────────────────────────────────
// Section additionnelle de l'onglet Animes, visible uniquement quand le
// Mode Culture est activé. Basée sur un pool de genres fixe (modifiable
// ci-dessous) plutôt que sur les goûts du profil — un vrai bonus éditorial,
// pas une recommandation personnalisée.
//
// `genre_in` côté AniList fonctionne en ET, pas en OU — un titre doit
// posséder TOUS les genres listés pour matcher. On veut ici « au moins un
// des genres » : chaque genre est donc interrogé séparément (en parallèle),
// puis les listes sont fusionnées en entrelaçant les résultats (round-robin)
// pour qu'aucun genre n'écrase les autres en tête de liste.
export const CULTURE_ZONE_GENRES = ["Hentai"];
const CULTURE_ZONE_MAX = 10;

export async function fetchCultureZoneRecommendations(excludeAnilistIds = [], { page = 1 } = {}) {
  // Garde-fou : cette section ne doit jamais être interrogée si le Mode
  // Culture est désactivé, même en cas d'appel direct hors du composant.
  if (!isCultureModeOn()) return [];

  const query = `
    query ($genre: String, $page: Int) {
      Page(page: $page, perPage: 20) {
        media(
          genre_in: [$genre]
          type: ANIME
          sort: POPULARITY_DESC
          status_in: [FINISHED, RELEASING, HIATUS]
          format_in: [TV, TV_SHORT, OVA, ONA, MOVIE]
        ) {
          id
          title { english romaji }
          coverImage { large }
          genres
          episodes
          description(asHtml: false)
          seasonYear
          averageScore
          isAdult
          format
        }
      }
    }
  `;

  try {
    const settled = await Promise.allSettled(
      CULTURE_ZONE_GENRES.map((genre) => anilistQuery(query, { genre, page }))
    );
    const perGenreLists = settled.map((r) =>
      r.status === "fulfilled" ? (r.value.data?.Page?.media || []) : []
    );

    const merged = [];
    const seen = new Set();
    const maxLen = Math.max(0, ...perGenreLists.map((l) => l.length));
    for (let i = 0; i < maxLen; i++) {
      for (const list of perGenreLists) {
        const m = list[i];
        if (m && !seen.has(m.id)) { seen.add(m.id); merged.push(m); }
      }
    }

    return merged
      .filter((m) => !excludeAnilistIds.includes(m.id))
      .slice(0, CULTURE_ZONE_MAX)
      .map(mapMedia);
  } catch {
    return [];
  }
}

// Tire un anime VRAIMENT au hasard dans le catalogue AniList, sans aucun
// filtre de genre — contrairement à fetchAniListRecommendations, qui reste
// ancré aux goûts du profil. Utilisé par « Surprends-moi » pour proposer
// autre chose que les recommandations habituelles.
export async function fetchAniListRandomTitle(excludeAnilistIds = []) {
  const cultureMode = isCultureModeOn();
  const page = Math.floor(Math.random() * 60) + 1; // large plage, indépendante des goûts

  const query = `
    query ($page: Int) {
      Page(page: $page, perPage: 20) {
        media(
          type: ANIME
          sort: POPULARITY_DESC
          status_in: [FINISHED, RELEASING, HIATUS]
          format_in: [TV, TV_SHORT, OVA, ONA, MOVIE]
        ) {
          id
          title { english romaji }
          coverImage { large }
          genres
          episodes
          description(asHtml: false)
          seasonYear
          averageScore
          isAdult
          format
        }
      }
    }
  `;

  try {
    const { data } = await anilistQuery(query, { page });
    const list = (data?.Page?.media || []).filter((m) => cultureMode || !m.isAdult);
    const pool = list.filter((m) => !excludeAnilistIds.includes(m.id));
    const from = pool.length ? pool : list;
    if (!from.length) return null;
    return mapMedia(from[Math.floor(Math.random() * from.length)]);
  } catch {
    return null;
  }
}

// ── Utilitaires TMDB ──────────────────────────────────────────────────────────
function genresToTmdbIds(genres, mapping) {
  const ids = new Set();
  genres.forEach((g) => {
    const id = mapping[g.toLowerCase()];
    if (id) ids.add(id);
  });
  return [...ids];
}

function topGenresFromEntries(entries, type) {
  const subset =
    type === "film"
      ? entries.filter((e) => e.category === "movie")
      : entries.filter((e) => e.type === "serie" && e.category !== "movie");
  const tally = {};
  subset.forEach((e) => {
    const w = e.status === "termine" || e.status === "en-cours" ? 2 : 1;
    (e.genres || []).forEach((g) => { tally[g] = (tally[g] || 0) + w; });
  });
  return Object.entries(tally)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([g]) => g);
}

// Recommandations de films via TMDB Discover (basé sur les genres de la biblio)
// `page` + `extraExcludeIds` permettent au pull-to-refresh de demander un lot
// différent de celui déjà affiché à l'écran.
export async function fetchTMDBMovieRecommendations(entries = [], { page = 1, extraExcludeIds = [] } = {}) {
  if (!hasTMDB()) return { recs: [], topGenres: [], noTmdb: true };

  const topGenres = topGenresFromEntries(entries, "film");
  let genreIds = genresToTmdbIds(topGenres, GENRE_TO_TMDB_MOVIE_ID);
  // Fallback générique si aucun genre mappé (Action, Drama, Comedy)
  if (!genreIds.length) genreIds = [28, 18, 35];

  const excludeIds = [
    ...entries.filter((e) => e.category === "movie" && e.source === "tmdb_movie").map((e) => e.id),
    ...extraExcludeIds,
  ];

  const recs = await fetchTMDBDiscoverMovies(genreIds, excludeIds, page);
  return { recs, topGenres };
}

// Recommandations de séries via TMDB Discover (basé sur les genres de la biblio)
export async function fetchTMDBSeriesRecommendations(entries = [], { page = 1, extraExcludeIds = [] } = {}) {
  if (!hasTMDB()) return { recs: [], topGenres: [], noTmdb: true };

  const topGenres = topGenresFromEntries(entries, "serie");
  let genreIds = genresToTmdbIds(topGenres, GENRE_TO_TMDB_TV_ID);
  // Fallback générique si aucun genre mappé (Drama, Comedy, Action)
  if (!genreIds.length) genreIds = [18, 35, 10759];

  const excludeIds = [
    ...entries.filter((e) => e.type === "serie" && e.category !== "movie" && e.tmdbId).map((e) => e.tmdbId),
    ...extraExcludeIds,
  ];

  const recs = await fetchTMDBDiscoverSeries(genreIds, excludeIds, page);
  return { recs, topGenres };
}