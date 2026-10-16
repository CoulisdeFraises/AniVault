// ── Waifinity : bannière saisonnière ────────────────────────────────────────
//
// La bannière met en avant les personnages des animes « du moment ». Le bassin
// Waifinity rattache chaque personnage à UN anime MAL (seriesId, voir
// api/waifu.js) : on cherche donc quels animes sont à l'affiche, puis on les
// croise avec le bassin (voir utils/waifinityBanners.js).
//
// Pour que la détection soit fiable, on ne se contente plus des seuls ids MAL
// de la saison AniList (qui ratait beaucoup de séries) :
//
//   1. AniList — animes de la saison ET animes actuellement en diffusion (les
//      séries en 2 cours démarrées la saison d'avant n'apparaissent pas dans la
//      requête « saison »), avec leurs titres/synonymes et leurs animes liés
//      (préquelles, suites, histoires parallèles…). Les personnages d'une
//      saison 2 sont presque toujours rattachés à la saison 1 dans le bassin.
//   2. Tenrai — la saison courante telle que MyAnimeList la liste, y compris
//      les séries qui continuent. Ids MAL natifs, aucun décalage possible avec
//      le bassin (lui aussi basé sur MAL), et titres anglais + synonymes.
//
// Les deux sources sont indépendantes : si l'une est en panne, l'autre suffit.
// La correspondance finale se fait par id MAL ET par nom (voir
// waifinityBanners.js), pour rattraper les animes sans idMal côté AniList.

import { anilistQuery } from "./anilist";
import { tenraiGet } from "./tenrai";
import { getCached, setCached } from "../lib/cache";

const SEASON_ORDER = ["WINTER", "SPRING", "SUMMER", "FALL"];
const SEASON_LABEL_FR = { WINTER: "Hiver", SPRING: "Printemps", SUMMER: "Été", FALL: "Automne" };
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 h
const PER_PAGE = 50;
const ANILIST_PAGES = 2;  // 2 × 50 = les 100 animes les plus populaires de chaque liste
const TENRAI_PAGES = 3;   // 3 × 25 = 75 animes de la saison MAL

// Relations AniList qui partagent (en général) leurs personnages avec l'anime.
const SHARED_CAST_RELATIONS = new Set([
  "PREQUEL", "SEQUEL", "PARENT", "SIDE_STORY", "ALTERNATIVE", "SUMMARY", "SPIN_OFF",
]);

/** Saison AniList en cours (hiver = jan-mars, printemps = avr-juin…). */
export function currentSeason(date = new Date()) {
  const m = date.getMonth() + 1;
  return { season: SEASON_ORDER[m <= 3 ? 0 : m <= 6 ? 1 : m <= 9 ? 2 : 3], year: date.getFullYear() };
}

export function seasonLabel({ season, year }) {
  return `${SEASON_LABEL_FR[season] || season} ${year}`;
}

const MEDIA_FIELDS = `
  idMal
  title { romaji english }
  synonyms
  relations { edges { relationType node { idMal type title { romaji english } } } }
`;

const SEASON_QUERY = `query ($season: MediaSeason, $year: Int, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media(season: $season, seasonYear: $year, type: ANIME, sort: POPULARITY_DESC, isAdult: false, format_not_in: [MUSIC]) { ${MEDIA_FIELDS} }
  }
}`;

const AIRING_QUERY = `query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { hasNextPage }
    media(status: RELEASING, type: ANIME, sort: POPULARITY_DESC, isAdult: false, format_not_in: [MUSIC, SPECIAL]) { ${MEDIA_FIELDS} }
  }
}`;

const clean = (list) => [...new Set((list || []).filter((t) => typeof t === "string" && t.trim()).map((t) => t.trim()))];

/** Média AniList → { malId, titles, related } (ou null s'il n'apporte rien). */
function fromAniList(m) {
  const related = [];
  const titles = [m.title?.romaji, m.title?.english, ...(m.synonyms || [])];
  for (const e of m.relations?.edges || []) {
    const n = e?.node;
    if (!n || n.type !== "ANIME" || !SHARED_CAST_RELATIONS.has(e.relationType)) continue;
    if (n.idMal != null) related.push(n.idMal);
    // Même sans idMal, le titre de l'anime lié permet la correspondance par nom.
    titles.push(n.title?.romaji, n.title?.english);
  }
  const t = clean(titles);
  if (m.idMal == null && !t.length) return null;
  return { malId: m.idMal ?? null, titles: t, related: [...new Set(related)] };
}

async function fetchAniListEntries({ season, year }) {
  const out = [];
  const run = async (query, vars) => {
    for (let page = 1; page <= ANILIST_PAGES; page++) {
      const json = await anilistQuery(query, { ...vars, page, perPage: PER_PAGE });
      const data = json?.data?.Page;
      (data?.media || []).forEach((m) => { const e = fromAniList(m); if (e) out.push(e); });
      if (!data?.pageInfo?.hasNextPage) break;
    }
  };
  // Les deux requêtes passent par la file AniList ; l'une peut échouer sans bloquer l'autre.
  const results = await Promise.allSettled([
    run(SEASON_QUERY, { season, year }),
    run(AIRING_QUERY, {}),
  ]);
  if (!out.length) {
    const failed = results.find((r) => r.status === "rejected");
    if (failed) throw failed.reason;
  }
  return out;
}

/** Saison courante vue par MyAnimeList (séries qui continuent incluses), via Tenrai. */
async function fetchTenraiEntries() {
  const out = [];
  for (let page = 1; page <= TENRAI_PAGES; page++) {
    const json = await tenraiGet("/seasons/now", { continuing: "true", sfw: "true", page, limit: 25 });
    for (const a of json?.data || []) {
      if (a?.mal_id == null) continue;
      out.push({
        malId: a.mal_id,
        titles: clean([a.title, a.title_english, ...(a.title_synonyms || [])]),
        related: [],
      });
    }
    if (!json?.pagination?.has_next_page) break;
  }
  return out;
}

/** Fusionne les entrées de même id MAL (titres et animes liés cumulés). */
function mergeEntries(list) {
  const byId = new Map();
  const rest = [];
  for (const e of list) {
    if (e.malId == null) { rest.push(e); continue; }
    const cur = byId.get(e.malId);
    if (!cur) { byId.set(e.malId, { ...e, titles: [...e.titles], related: [...e.related] }); continue; }
    cur.titles = clean([...cur.titles, ...e.titles]);
    cur.related = [...new Set([...cur.related, ...e.related])];
  }
  return [...byId.values(), ...rest];
}

/**
 * Animes à l'affiche : [{ malId, titles, related }] (mis en cache 12 h).
 * Lève une erreur uniquement si AUCUNE des deux sources n'a répondu.
 */
export async function fetchSeasonAnime({ season, year }) {
  const key = `waifu_banner_v2_${year}_${season}`;
  const cached = getCached(key);
  if (cached?.length) return cached;

  const [ani, mal] = await Promise.allSettled([fetchAniListEntries({ season, year }), fetchTenraiEntries()]);
  const entries = mergeEntries([
    ...(ani.status === "fulfilled" ? ani.value : []),
    ...(mal.status === "fulfilled" ? mal.value : []),
  ]);
  if (!entries.length) throw (ani.status === "rejected" ? ani.reason : mal.reason) || new Error("Aucun anime de saison trouvé.");
  // Cache seulement si les deux sources ont répondu, sinon on retentera plus tôt.
  if (ani.status === "fulfilled" && mal.status === "fulfilled") setCached(key, entries, CACHE_TTL);
  return entries;
}
