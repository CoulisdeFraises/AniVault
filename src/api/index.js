import { searchTMDBShow, fetchTMDBSeason } from "./tmdb";
import {
  searchAniList, fetchAniListFranchise, fetchAniListNextSeason,
  fetchAniListEpisodeTotal, fetchAniListEpisodesBySeasonId,
  fetchAniListDescription, fetchNextAiringAniList,
} from "./anilist";
import {
  searchTVMaze, fetchTVMazeSeasons, fetchTVMazeSeasonTotal, fetchTVMazeNextSeason,
  fetchTVMazeEpisodesBySeason, fetchTVMazeDescription, fetchNextAiringTVMaze,
} from "./tvmaze";
import { withCache }       from "../services/cache";
import { translateGenres } from "../utils/genres";

export function search(type, query) {
  return type === "anime" ? searchAniList(query) : searchTVMaze(query);
}

export async function importResult(result) {
  const tmdb = await searchTMDBShow(result.title);

  if (result.source === "anilist") {
    try {
      const [franchiseData, description] = await Promise.all([
        fetchAniListFranchise(result.id),
        tmdb?.overview ? Promise.resolve(tmdb.overview) : fetchAniListDescription(result.id),
      ]);
      return {
        title: result.title, category: "tv",
        genres: translateGenres(result.genres).slice(0, 5),
        coverImage: result.image || null,
        seasons: franchiseData.seasons.length
          ? franchiseData.seasons
          : [{ number: 1, format: "TV", totalEpisodes: result.episodes ?? null, watchedEpisodes: 0, coverImage: result.image || null }],
        source: "anilist", anilistIds: franchiseData.anilistIds,
        tmdbId: tmdb?.id ?? null, description: description || null,
      };
    } catch {
      return {
        title: result.title, category: "tv",
        genres: translateGenres(result.genres).slice(0, 5),
        coverImage: result.image || null,
        seasons: [{ number: 1, format: "TV", totalEpisodes: result.episodes ?? null, watchedEpisodes: 0, coverImage: result.image || null }],
        source: "anilist", anilistIds: [result.id],
        tmdbId: tmdb?.id ?? null, description: null,
      };
    }
  }

  try {
    const [seasons, description] = await Promise.all([
      fetchTVMazeSeasons(result.id),
      tmdb?.overview ? Promise.resolve(tmdb.overview) : fetchTVMazeDescription(result.id),
    ]);
    const tvSeasons = seasons.map((s) => ({ ...s, format: "TV" }));
    return {
      title: result.title, category: "tv",
      genres: translateGenres(result.genres).slice(0, 5),
      coverImage: result.image || null,
      seasons: tvSeasons.length ? tvSeasons : [{ number: 1, format: "TV", totalEpisodes: null, watchedEpisodes: 0 }],
      source: "tvmaze", tvmazeId: result.id,
      tmdbId: tmdb?.id ?? null, description: description || null,
    };
  } catch {
    return {
      title: result.title, category: "tv",
      genres: translateGenres(result.genres).slice(0, 5),
      coverImage: result.image || null,
      seasons: [{ number: 1, format: "TV", totalEpisodes: null, watchedEpisodes: 0 }],
      source: "tvmaze", tvmazeId: result.id, tmdbId: tmdb?.id ?? null,
    };
  }
}

const SEASON_INFO_TTL = 60 * 60 * 1000;
export async function fetchSeasonInfo(entry, seasonIndex) {
  const seasonNumber = entry.seasons[seasonIndex]?.number ?? seasonIndex + 1;
  const cacheKey = `season-info:${entry.source}:${entry.id}:s${seasonIndex}`;
  return withCache(cacheKey, SEASON_INFO_TTL, async () => {
    if (entry.source === "tvmaze" && entry.tmdbId) { const tmdb = await fetchTMDBSeason(entry.tmdbId, seasonNumber); if (tmdb) return tmdb; }
    if (entry.source === "tvmaze" && entry.tvmazeId) {
      const [epsBySeason, totalEpisodes] = await Promise.all([fetchTVMazeEpisodesBySeason(entry.tvmazeId), fetchTVMazeSeasonTotal(entry.tvmazeId, seasonNumber)]);
      return { episodes: epsBySeason[seasonNumber] || [], totalEpisodes };
    }
    if (entry.source === "anilist" && entry.anilistIds?.[seasonIndex]) {
      const anilistId = entry.anilistIds[seasonIndex];
      const [episodes, totalEpisodes] = await Promise.all([fetchAniListEpisodesBySeasonId(anilistId), fetchAniListEpisodeTotal(anilistId)]);
      return { episodes, totalEpisodes };
    }
    return { episodes: [], totalEpisodes: null };
  });
}

export async function findNextSeason(entry) {
  if (entry.source === "anilist" && entry.anilistIds?.length) {
    const next = await fetchAniListNextSeason(entry.anilistIds[0], entry.seasons.length);
    return next ? { totalEpisodes: next.episodes, anilistId: next.id, coverImage: next.coverImage } : null;
  }
  if (entry.source === "tvmaze" && entry.tvmazeId) {
    const next = await fetchTVMazeNextSeason(entry.tvmazeId, entry.seasons.length + 1);
    return next ? { totalEpisodes: next.episodeCount, coverImage: next.coverImage } : null;
  }
  return null;
}

const NEXT_AIRING_TTL = 5 * 60 * 1000;
export async function fetchNextAiring(entry) {
  const key = entry.source === "anilist"
    ? `next-airing:anilist:${entry.anilistIds?.[entry.anilistIds.length - 1]}`
    : entry.source === "tvmaze" ? `next-airing:tvmaze:${entry.tvmazeId}` : null;
  if (!key) return null;
  return withCache(key, NEXT_AIRING_TTL, () =>
    entry.source === "anilist"
      ? fetchNextAiringAniList(entry.anilistIds[entry.anilistIds.length - 1])
      : fetchNextAiringTVMaze(entry.tvmazeId)
  );
}
