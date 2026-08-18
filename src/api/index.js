import { searchTMDBShow, fetchTMDBSeason, searchTMDBMovies } from "./tmdb";
import {
  searchAniList, fetchAniListFranchise, fetchAniListNextSeason,
  fetchAniListSeasonData, fetchAniListEpisodesBySeasonId,
  fetchAniListDescription, fetchNextAiringAniList,
} from "./anilist";
import {
  searchTVMaze, fetchTVMazeSeasons, fetchTVMazeSeasonTotal, fetchTVMazeNextSeason,
  fetchTVMazeEpisodesBySeason, fetchTVMazeDescription, fetchNextAiringTVMaze,
} from "./tvmaze";
import { withCache }       from "../services/cache";
import { translateGenres } from "../utils/genres";
import { getFormatGroup }  from "../utils/format";
import { findAniListMovieId } from "./crossRef";

// Détermine la catégorie d'une entrée AniList à partir de ses saisons :
// un film (ou une franchise 100% films) doit être classé "movie", pas "tv"
// (sinon il apparaît dans l'onglet Série/pastille "Série" au lieu de "Film").
function categoryFromSeasons(seasons) {
  return seasons.length && seasons.every((s) => getFormatGroup(s.format) === "movie")
    ? "movie"
    : "tv";
}

// Mapping IDs genres TMDB → labels français
const TMDB_MOVIE_GENRES = {
  28: "Action", 12: "Aventure", 16: "Animation", 35: "Comédie",
  80: "Crime", 99: "Documentaire", 18: "Drame", 10751: "Famille",
  14: "Fantastique", 36: "Histoire", 27: "Horreur", 10402: "Musique",
  9648: "Mystère", 10749: "Romance", 878: "Science-Fiction",
  53: "Thriller", 10752: "Guerre", 37: "Western",
};

export function search(type, query) {
  if (type === "film")  return searchTMDBMovies(query);
  if (type === "anime") return searchAniList(query);
  return searchTVMaze(query);
}

// ── importResult : branche anilist ───────────────────────────────────────
export async function importResult(result) {
  // ── Court-circuit : film TMDB (titre et synopsis déjà en FR) ─────────────
  if (result.source === "tmdb_movie") {
    // Tentative de rattachement à la fiche AniList correspondante — mais
    // seulement si le film est catégorisé "Animation" côté TMDB (genre id
    // 16) : sans ce garde-fou, on ferait un appel réseau inutile pour
    // chaque film live-action, avec un risque de faux positif si son titre
    // ressemble par coincidence à un titre AniList. Sans rattachement, un
    // film ajouté ici sous son titre français n'a aucun ID en commun avec
    // la même œuvre proposée plus tard en recommandation côté AniList
    // (titre anglais/romaji) — elles ne sont alors jamais reconnues comme
    // le même film. On tente le titre original en priorité (plus proche du
    // romaji/anglais qu'AniList indexe), puis les titres alternatifs
    // disponibles, puis le titre affiché en dernier recours. Best-effort,
    // silencieux en cas d'échec : ce n'est qu'un enrichissement, pas un
    // pré-requis à l'ajout.
    const isAnimatedFilm = (result.genreIds || []).includes(16);
    const anilistMatch = isAnimatedFilm
      ? await findAniListMovieId(
          result.originalTitle, ...(result.titleAlt || []), result.title
        ).catch(() => null)
      : null;

    return {
      title:      result.title,
      type:       "serie",          // classé comme série (live-action)
      category:   "movie",
      titleFrench: result.title,
      coverImage: result.image || null,
      genres:     (result.genreIds || [])
                    .map((id) => TMDB_MOVIE_GENRES[id])
                    .filter(Boolean)
                    .slice(0, 5),
      seasons: [{
        number:          1,
        format:          "MOVIE",
        totalEpisodes:   1,
        watchedEpisodes: 0,
        coverImage:      result.image || null,
      }],
      source:      "tmdb_movie",
      tmdbId:      result.id,
      anilistIds:  anilistMatch ? [anilistMatch] : [],
      // `overview` (résultat de recherche) ou `description` (reco) selon
      // l'appelant — les deux shapes sont possibles ici.
      description: result.overview || result.description || null,
    };
  }

  // ── Cas AniList & TVmaze : enrichissement TMDB optionnel ────────────────
  // IMPORTANT : searchTMDBShow ne cherche que dans /search/tv — pour un
  // FILM (result.format === "MOVIE" côté AniList), ça ne peut structurellement
  // jamais matcher, donc tmdbId restait toujours null pour les films
  // d'anime importés ici. On bascule sur /search/movie dans ce cas, pour
  // que le rattachement croisé avec les recommandations/imports côté TMDB
  // fonctionne aussi pour les films (pas seulement les séries TV).
  const isAnimeMovie = result.source === "anilist" && result.format === "MOVIE";
  const tmdb = isAnimeMovie
    ? await searchTMDBMovies(result.title).then((r) => {
        const top = r?.[0];
        return top ? { id: top.id, name: top.title || null, overview: top.overview || null } : null;
      }).catch(() => null)
    : await searchTMDBShow(result.title);
  // TMDB est interrogé en fr-FR : son "name" est donc le titre français quand
  // il existe. On l'affiche en priorité, mais on garde aussi les variantes
  // romaji/anglais/français pour que la recherche dans la bibliothèque
  // fonctionne quel que soit le nom que l'utilisateur tape.
  const titleFrench  = tmdb?.name || null;
  const displayTitle = titleFrench || result.title;

  if (result.source === "anilist") {
    try {
      const [franchiseData, description] = await Promise.all([
        fetchAniListFranchise(result.id),
        tmdb?.overview ? Promise.resolve(tmdb.overview) : fetchAniListDescription(result.id),
      ]);
      const seasons = franchiseData.seasons.length
        ? franchiseData.seasons
        : [{
            number: 1,
            format: result.format ?? "TV",     // ← format réel (ONA, OVA…)
            totalEpisodes: result.episodes ?? null,
            watchedEpisodes: 0,
            coverImage: result.image || null,
            anilistId: result.id,              // ← anilistId sur la saison de secours
          }];
      return {
        title: displayTitle, category: categoryFromSeasons(seasons),
        titleRomaji: result.titleRomaji ?? null, titleEnglish: result.titleEnglish ?? null, titleFrench,
        genres: translateGenres(result.genres).slice(0, 5),
        coverImage: result.image || null,
        seasons,
        source: "anilist",
        // ← CORRECTIF : si anilistIds est vide (ONA, format non-TV), on garde l'ID source
        anilistIds: franchiseData.anilistIds.length ? franchiseData.anilistIds : [result.id],
        tmdbId: tmdb?.id ?? null, description: description || null,
      };
    } catch {
      const seasons = [{
        number: 1,
        format: result.format ?? "TV",         // ← format réel
        totalEpisodes: result.episodes ?? null,
        watchedEpisodes: 0,
        coverImage: result.image || null,
        anilistId: result.id,                  // ← anilistId
      }];
      return {
        title: displayTitle, category: categoryFromSeasons(seasons),
        titleRomaji: result.titleRomaji ?? null, titleEnglish: result.titleEnglish ?? null, titleFrench,
        genres: translateGenres(result.genres).slice(0, 5),
        coverImage: result.image || null,
        seasons,
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
      title: displayTitle, type: "serie", category: "tv",
      titleFrench,
      genres: translateGenres(result.genres).slice(0, 5),
      coverImage: result.image || null,
      seasons: tvSeasons.length ? tvSeasons : [{ number: 1, format: "TV", totalEpisodes: null, watchedEpisodes: 0 }],
      source: "tvmaze", tvmazeId: result.id,
      tmdbId: tmdb?.id ?? null, description: description || null,
    };
  } catch {
    return {
      title: displayTitle, type: "serie", category: "tv",
      titleFrench,
      genres: translateGenres(result.genres).slice(0, 5),
      coverImage: result.image || null,
      seasons: [{ number: 1, format: "TV", totalEpisodes: null, watchedEpisodes: 0 }],
      source: "tvmaze", tvmazeId: result.id, tmdbId: tmdb?.id ?? null,
    };
  }
}

/**
 * refreshEntryCard — vérifie si de nouvelles saisons / OVA / Films sont disponibles
 * pour une entrée et retourne les données fusionnées.
 *
 * - La progression (watchedEpisodes) des saisons existantes est toujours préservée.
 * - Les nouvelles saisons détectées sont ajoutées avec watchedEpisodes: 0.
 * - Pour AniList  : compare via anilistId (identifiant unique par saison/OVA/film).
 * - Pour TVmaze   : compare les saisons TV par numéro ; les saisons non-TV sont conservées.
 *
 * Retourne { seasons, anilistIds?, hasNewContent, newCount, newItems } ou null si non supporté.
 */
export async function refreshEntryCard(entry) {
  // ── AniList ──────────────────────────────────────────────────────────────
  if (entry.source === "anilist") {
    // anilistIds[0] est la source normale ; si elle a été vidée par un bug
    // passé, on retente de repartir d'un anilistId retrouvé sur une saison.
    const seedId = entry.anilistIds?.[0] ?? entry.seasons?.find((s) => s.anilistId)?.anilistId ?? null;
    if (!seedId) {
      throw new Error("Ce titre a perdu son lien AniList. Supprime-le puis rajoute-le depuis la recherche pour le relier à nouveau.");
    }

    // force: true — un clic sur "Actualiser" doit vraiment aller chercher une
    // donnée fraîche, pas servir le cache partagé (TTL jusqu'à 24h) qui sert
    // les autres utilisateurs. Le cache est aussi republié pour tout le monde.
    const { seasons: freshSeasons, anilistIds: freshIds } = await fetchAniListFranchise(seedId, { force: true });

    // Garde-fou : si AniList ne renvoie rien alors qu'on avait déjà des
    // saisons, on n'écrase pas les données existantes — mieux vaut échouer
    // proprement (l'utilisateur peut réessayer) que de tout remettre à 0.
    if (!freshSeasons.length && entry.seasons?.length) {
      const hasProgress = entry.seasons.some(s => (s.watchedEpisodes || 0) > 0);
      if (hasProgress) {
        throw new Error("AniList n'a renvoyé aucune saison — actualisation annulée pour ne pas écraser tes données. Réessaie dans un instant.");
      }
      // Format ONA/OVA/MOVIE : franchise vide est normale, rien à mettre à jour
      return null;
    }

    const existingByAnilistId = new Map();
    entry.seasons.forEach((s, i) => {
      const id = s.anilistId ?? entry.anilistIds?.[i];
      if (id != null) existingByAnilistId.set(String(id), id === s.anilistId ? s : { ...s, anilistId: id });
    });

    const mergedSeasons = freshSeasons.map((freshSeason) => {
      const existing = existingByAnilistId.get(String(freshSeason.anilistId));
      if (existing) {
        return {
          ...freshSeason,
          watchedEpisodes: existing.watchedEpisodes,
          totalEpisodes: freshSeason.totalEpisodes ?? existing.totalEpisodes,
        };
      }
      return { ...freshSeason, watchedEpisodes: 0 };
    });

    // Garde-fou final : si on avait de la progression avant, qu'il existait
    // des saisons avec un anilistId reconnu, et qu'AUCUNE ne s'est réappariée
    // après l'actualisation, quelque chose s'est mal passé dans la correspondance
    // (ex: chaîne de saisons tronquée, IDs qui ne matchent plus). Mieux vaut
    // échouer que d'effacer silencieusement la progression de l'utilisateur.
    const prevWatchedTotal = entry.seasons.reduce((sum, s) => sum + (s.watchedEpisodes || 0), 0);
    const matchedCount     = freshSeasons.filter((s) => existingByAnilistId.has(String(s.anilistId))).length;
    if (prevWatchedTotal > 0 && freshSeasons.length > 0 && matchedCount === 0) {
      throw new Error("L'actualisation aurait effacé ta progression (incohérence de correspondance des saisons) — annulée par sécurité. Contacte le support si ça persiste.");
    }

    const newItems = freshSeasons.filter((s) => !existingByAnilistId.has(String(s.anilistId)));
    return {
      seasons: mergedSeasons,
      anilistIds: freshIds,
      hasNewContent: newItems.length > 0,
      newCount: newItems.length,
      newItems,
    };
  }

  // ── TVmaze ────────────────────────────────────────────────────────────────
  if (entry.source === "tvmaze" && entry.tvmazeId) {
    const freshTVSeasons = await fetchTVMazeSeasons(entry.tvmazeId);

    const existingNonTV = entry.seasons.filter((s) => s.format && s.format !== "TV");
    const existingTVByNumber = new Map(
      entry.seasons
        .filter((s) => !s.format || s.format === "TV")
        .map((s) => [s.number, s])
    );

    const mergedTVSeasons = freshTVSeasons.map((freshSeason) => {
      const existing = existingTVByNumber.get(freshSeason.number);
      if (existing) {
        return {
          ...existing,
          totalEpisodes: freshSeason.totalEpisodes ?? existing.totalEpisodes,
          coverImage: freshSeason.coverImage ?? existing.coverImage,
        };
      }
      return { ...freshSeason, format: "TV", watchedEpisodes: 0 };
    });

    const newTV = freshTVSeasons.filter((s) => !existingTVByNumber.has(s.number));
    return {
      seasons: [...mergedTVSeasons, ...existingNonTV],
      hasNewContent: newTV.length > 0,
      newCount: newTV.length,
      newItems: newTV,
    };
  }

  return null;
}

const SEASON_INFO_TTL = 60 * 60 * 1000;

/**
 * fetchSeasonInfo — récupère les épisodes et le total d'une saison.
 *
 * CORRECTIF : fetchAniListEpisodeTotal a été renommé fetchAniListSeasonData
 * dans anilist.js (retourne maintenant { malId, totalEpisodes }).
 * On extrait totalEpisodes depuis l'objet retourné.
 */
export async function fetchSeasonInfo(entry, seasonIndex) {
  const seasonNumber = entry.seasons[seasonIndex]?.number ?? seasonIndex + 1;
  const cacheKey = `season-info:${entry.source}:${entry.id}:s${seasonIndex}`;

  const shouldCache = (result) =>
    (result.episodes && result.episodes.length > 0) || result.totalEpisodes != null;

  return withCache(cacheKey, SEASON_INFO_TTL, async () => {
    // ── TVmaze ──────────────────────────────────────────────────────────
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

    // ── AniList ─────────────────────────────────────────────────────────
    if (entry.source === "anilist") {
      const season = entry.seasons[seasonIndex];
      const anilistId =
        entry.anilistIds?.[seasonIndex] ??
        season?.anilistId ??
        null;

      if (!anilistId) {
        // Aucun anilistId retrouvable pour cette saison : le lien vers AniList
        // est perdu (ex: séquelle d'un ancien bug de sync qui a vidé
        // anilistIds), pas juste une donnée manquante côté API.
        return { episodes: [], totalEpisodes: null, reason: "lost-link" };
      }

      // 1. AniList d'abord — source d'autorité pour le NOMBRE d'épisodes
      // (gère déjà le cas "en cours de diffusion" vs "terminé").
      const seasonData = await fetchAniListSeasonData(anilistId);
      const totalEpisodes = seasonData.totalEpisodes;

      // 2. TMDB ensuite — uniquement pour les NOMS d'épisodes (en français),
      // et en filet de sécurité pour le total si AniList ne le connaît pas.
      let tmdbEpisodes = [];
      let tmdbTotal = null;
      const seasonNumber = season?.number || 1;
      const tmdbId = entry.tmdbId ?? (await searchTMDBShow(season?.title || entry.title))?.id ?? null;
      if (tmdbId) {
        const tmdbSeason = await fetchTMDBSeason(tmdbId, seasonNumber);
        if (tmdbSeason) {
          tmdbEpisodes = tmdbSeason.episodes;
          tmdbTotal    = tmdbSeason.totalEpisodes;
        }
      }

      // 3. Jikan en dernier recours — seulement pour les numéros que ni
      // AniList ni TMDB n'ont pu nommer (évite un appel inutile si TMDB a
      // déjà tout couvert).
      const finalTotal = totalEpisodes ?? tmdbTotal ?? null;
      const namedByTMDB = new Map(tmdbEpisodes.map((e) => [e.number, e.name]).filter(([, n]) => n));

      // On tente Jikan si AniList/TMDB n'ont donné AUCUN total (fréquent pour
      // les OVA/ONA mal documentées), ou si un total est connu mais que TMDB
      // n'a pas nommé tous les épisodes attendus.
      const stillMissing = finalTotal == null || namedByTMDB.size < finalTotal;
      let jikanEpisodes = [];
      if (stillMissing) {
        jikanEpisodes = await fetchAniListEpisodesBySeasonId(anilistId);
      }
      const namedByJikan = new Map(jikanEpisodes.map((e) => [e.number, e.name]).filter(([, n]) => n));

      // Le total vient d'AniList en priorité (déjà fiable pour "en cours" vs
      // "terminé"). Si vraiment aucune des trois sources ne le connaît, on se
      // rabat sur la taille de la liste nommée obtenue plutôt que de rester
      // bloqué à "inconnu".
      const resolvedTotal = finalTotal ?? (tmdbEpisodes.length || jikanEpisodes.length || null);

      // IMPORTANT : le nombre de lignes suit le total résolu, JAMAIS un max
      // brut des tailles de liste — sinon une saison TMDB mal alignée (qui
      // regrouperait par erreur plusieurs saisons/cours AniList en une seule)
      // peut gonfler le compte à tort (ex: 49 au lieu de 24).
      const rowCount = resolvedTotal || 0;
      const episodes = rowCount > 0
        ? Array.from({ length: rowCount }, (_, i) => {
            const number = i + 1;
            return { number, name: namedByTMDB.get(number) || namedByJikan.get(number) || null };
          })
        : [];

      return { episodes, totalEpisodes: resolvedTotal };
    }

    return { episodes: [], totalEpisodes: null };
  }, shouldCache);
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
  return withCache(key, NEXT_AIRING_TTL, async () => {
    if (entry.source === "anilist") {
      const id = entry.anilistIds?.[entry.anilistIds.length - 1];
      return id ? fetchNextAiringAniList(id) : null;
    }
    if (entry.source === "tvmaze") return fetchNextAiringTVMaze(entry.tvmazeId);
    return null;
  });
}