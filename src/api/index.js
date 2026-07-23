import { searchTMDBShow, fetchTMDBSeason } from "./tmdb";
import {
  searchAniList, fetchAniListAllSeasons, fetchAniListNextSeason, fetchAniListEpisodeTotal,
  fetchAniListEpisodesBySeasonId, fetchAniListDescription, fetchNextAiringAniList,
} from "./anilist";
import {
  searchTVMaze, fetchTVMazeSeasons, fetchTVMazeSeasonTotal, fetchTVMazeNextSeason,
  fetchTVMazeEpisodesBySeason, fetchTVMazeDescription, fetchNextAiringTVMaze,
} from "./tvmaze";
import { withCache } from "../services/cache";
import { translateGenres } from "../utils/genres";
import { FORMAT_TO_CATEGORY } from "../utils/entry";

export function search(type, query) {
  return type === "anime" ? searchAniList(query) : searchTVMaze(query);
}

// ── Import d'un résultat de recherche ─────────────────────────────────────────
// importAllSeasons : true  → suit la chaîne TV de séquelles (AoT S1→S2→S3)
//                   false → importe uniquement le titre sélectionné (Naruto seul)
export async function importResult(result, importAllSeasons = true) {
  const tmdb = await searchTMDBShow(result.title);

  // Catégorie déduite du format AniList (tv / ova / movie)
  const category = FORMAT_TO_CATEGORY[result.format] ?? "tv";

  if (result.source === "anilist") {
    try {
      const [seasonsData, description] = await Promise.all([
        // On suit la chaîne uniquement pour les séries TV et si le toggle est ON
        importAllSeasons && category === "tv"
          ? fetchAniListAllSeasons(result.id)
          : Promise.resolve({
              seasons:   [{ number: 1, totalEpisodes: result.episodes ?? null, watchedEpisodes: 0, coverImage: result.image || null }],
              anilistIds: [result.id],
            }),
        tmdb?.overview
          ? Promise.resolve(tmdb.overview)
          : fetchAniListDescription(result.id),
      ]);

      return {
        title:       result.title,
        category,
        genres:      translateGenres(result.genres).slice(0, 5),
        coverImage:  result.image || null,
        seasons:     seasonsData.seasons.length
          ? seasonsData.seasons
          : [{ number: 1, totalEpisodes: result.episodes ?? null, watchedEpisodes: 0, coverImage: result.image || null }],
        source:      "anilist",
        anilistIds:  seasonsData.anilistIds,
        tmdbId:      tmdb?.id ?? null,
        description: description || null,
      };
    } catch {
      return {
        title:       result.title,
        category,
        genres:      translateGenres(result.genres).slice(0, 5),
        coverImage:  result.image || null,
        seasons:     [{ number: 1, totalEpisodes: result.episodes ?? null, watchedEpisodes: 0, coverImage: result.image || null }],
        source:      "anilist",
        anilistIds:  [result.id],
        tmdbId:      tmdb?.id ?? null,
        description: null,
      };
    }
  }

  // ── TVmaze → toujours "tv" ────────────────────────────────────────────────
  try {
    const [seasons, description] = await Promise.all([
      fetchTVMazeSeasons(result.id),
      tmdb?.overview ? Promise.resolve(tmdb.overview) : fetchTVMazeDescription(result.id),
    ]);
    return {
      title:       result.title,
      category:    "tv",
      genres:      translateGenres(result.genres).slice(0, 5),
      coverImage:  result.image || null,
      seasons:     seasons.length ? seasons : [{ number: 1, totalEpisodes: null, watchedEpisodes: 0 }],
      source:      "tvmaze",
      tvmazeId:    result.id,
      tmdbId:      tmdb?.id ?? null,
      description: description || null,
    };
  } catch {
    return {
      title:       result.title,
      category:    "tv",
      genres:      translateGenres(result.genres).slice(0, 5),
      coverImage:  result.image || null,
      source:      "tvmaze",
      tvmazeId:    result.id,
      tmdbId:      tmdb?.id ?? null,
    };
  }
}

// ── Épisodes + total pour une saison ─────────────────────────────────────────
// Résultat mis en cache 1h pour éviter de re-fetcher à chaque ouverture de fiche.
// TMDB utilisé uniquement pour les séries (tvmaze) : son découpage en saisons
// est incompatible avec la structure AniList des animes.
const SEASON_INFO_TTL = 60 * 60 * 1000; // 1 heure

export async function fetchSeasonInfo(entry, seasonIndex) {
  const seasonNumber = entry.seasons[seasonIndex]?.number ?? seasonIndex + 1;
  const cacheKey = `season-info:${entry.source}:${entry.id}:s${seasonIndex}`;

  return withCache(cacheKey, SEASON_INFO_TTL, async () => {
    // TMDB en priorité pour les séries uniquement
    if (entry.source === "tvmaze" && entry.tmdbId) {
      const tmdb = await fetchTMDBSeason(entry.tmdbId, seasonNumber);
      if (tmdb) return tmdb;
    }

    if (entry.source === "tvmaze" && entry.tvmazeId) {
      const [epsBySeason, totalEpisodes] = await Promise.all([
        fetchTVMazeEpisodesBySeason(entry.tvmazeId),
        fetchTVMazeSeasonTotal(entry.tvmazeId, seasonNumber),
      ]);
      return { episodes: epsBySeason[seasonNumber] || [], totalEpisodes };
    }

    if (entry.source === "anilist" && entry.anilistIds?.[seasonIndex]) {
      const anilistId = entry.anilistIds[seasonIndex];
      const [episodes, totalEpisodes] = await Promise.all([
        fetchAniListEpisodesBySeasonId(anilistId),
        fetchAniListEpisodeTotal(anilistId),
      ]);
      return { episodes, totalEpisodes };
    }

    return { episodes: [], totalEpisodes: null };
  });
}

// ── Saison suivante ───────────────────────────────────────────────────────────
export async function findNextSeason(entry) {
  if (entry.source === "anilist" && entry.anilistIds?.length) {
    const rootId = entry.anilistIds[0];
    const next = await fetchAniListNextSeason(rootId, entry.seasons.length);
    return next
      ? { totalEpisodes: next.episodes, anilistId: next.id, coverImage: next.coverImage }
      : null;
  }
  if (entry.source === "tvmaze" && entry.tvmazeId) {
    const nextSeasonNum = entry.seasons.length + 1;
    const next = await fetchTVMazeNextSeason(entry.tvmazeId, nextSeasonNum);
    return next ? { totalEpisodes: next.episodeCount, coverImage: next.coverImage } : null;
  }
  return null;
}

// ── Prochain épisode à diffuser ───────────────────────────────────────────────
const NEXT_AIRING_TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchNextAiring(entry) {
  const key =
    entry.source === "anilist"
      ? `next-airing:anilist:${entry.anilistIds?.[entry.anilistIds.length - 1]}`
      : entry.source === "tvmaze"
      ? `next-airing:tvmaze:${entry.tvmazeId}`
      : null;
  if (!key) return null;

  return withCache(key, NEXT_AIRING_TTL, () =>
    entry.source === "anilist"
      ? fetchNextAiringAniList(entry.anilistIds[entry.anilistIds.length - 1])
      : fetchNextAiringTVMaze(entry.tvmazeId)
  );
}