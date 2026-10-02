// ── Waifinity : bannière saisonnière ────────────────────────────────────────
//
// La bannière met en avant les personnages des animes de la saison AniList en
// cours. AniList donne l'identifiant MyAnimeList de chaque anime (idMal) ; le
// bassin Waifinity rattache chaque personnage à un anime MAL (seriesId, voir
// api/waifu.js). Les deux se croisent donc directement, sans table à
// maintenir à la main : la bannière change toute seule à chaque saison.
//
// Limite connue : un personnage est rattaché à UN seul anime (le plus
// populaire où il apparaît). Une suite (saison 2…) a son propre id MAL, donc
// ses personnages n'apparaissent dans la bannière que s'ils sont rattachés à
// cette suite dans le bassin.

import { anilistQuery } from "./anilist";
import { getCached, setCached } from "../lib/cache";

const SEASON_ORDER = ["WINTER", "SPRING", "SUMMER", "FALL"];
const SEASON_LABEL_FR = { WINTER: "Hiver", SPRING: "Printemps", SUMMER: "Été", FALL: "Automne" };
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 h
const PER_PAGE = 50;

/** Saison AniList en cours (hiver = jan-mars, printemps = avr-juin…). */
export function currentSeason(date = new Date()) {
  const m = date.getMonth() + 1;
  return { season: SEASON_ORDER[m <= 3 ? 0 : m <= 6 ? 1 : m <= 9 ? 2 : 3], year: date.getFullYear() };
}

export function seasonLabel({ season, year }) {
  return `${SEASON_LABEL_FR[season] || season} ${year}`;
}

const QUERY = `query ($season: MediaSeason, $year: Int, $perPage: Int) {
  Page(perPage: $perPage) {
    media(season: $season, seasonYear: $year, type: ANIME, sort: POPULARITY_DESC, isAdult: false, format_not_in: [MUSIC]) {
      idMal
    }
  }
}`;

/** Identifiants MAL des animes de la saison (mis en cache 12 h). Peut lever une erreur réseau. */
export async function fetchSeasonMalIds({ season, year }) {
  const key = `waifu_banner_${year}_${season}`;
  const cached = getCached(key);
  if (cached?.length) return cached;
  const json = await anilistQuery(QUERY, { season, year, perPage: PER_PAGE });
  const ids = (json?.data?.Page?.media || []).map((m) => m.idMal).filter((id) => id != null);
  if (ids.length) setCached(key, ids, CACHE_TTL);
  return ids;
}
