// ── Waifinity : bassin de personnages (source : AniList) ────────────────────
//
// MyWaifuList n'a pas d'API publique exploitable directement depuis un
// navigateur : son accès API est un palier de don non garanti, sans clé
// disponible pour un usage grand public, et de toute façon inutilisable en
// appel direct côté client (pas de CORS, clé exposée). On réutilise donc
// l'API AniList déjà intégrée à l'app (GraphQL, publique, CORS ouvert) : elle
// expose un catalogue de personnages avec image, nom et nombre de favoris,
// suffisant pour construire un gacha. AniList n'expose pas le genre d'un
// personnage : le jeu ne distingue donc pas waifu / mari, tous les
// personnages sont piochés dans le même bassin.
//
// Le bassin est un instantané (300 personnages les plus favorisés d'AniList,
// tous titres confondus) mis en cache 24h : la rareté de chaque personnage
// (voir utils/waifinity.js) est calculée par rang au sein de CE bassin, pas
// sur l'ensemble d'AniList — c'est un système de rareté auto-référentiel,
// propre au jeu.

import { anilistQuery } from "./anilist";
import { getCached, setCached, TTL } from "../lib/cache";
import { computeTiers } from "../utils/waifinity";

const POOL_CACHE_KEY = "waifinity_pool_v1";
const PAGES          = 6;   // 6 × 50 = 300 personnages
const PER_PAGE        = 50;

const CHAR_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      characters(sort: FAVOURITES_DESC) {
        id
        name { full native }
        image { large }
        favourites
        media(perPage: 1, sort: POPULARITY_DESC) {
          nodes { id title { romaji english } }
        }
      }
    }
  }
`;

function mapCharacter(c) {
  const media = c.media?.nodes?.[0] || null;
  return {
    id:        c.id,
    name:      c.name?.full || c.name?.native || "???",
    image:     c.image?.large || null,
    favourites: c.favourites || 0,
    seriesId:   media?.id ?? null,
    series:     media?.title?.romaji || media?.title?.english || "Série inconnue",
  };
}

/**
 * fetchWaifuPool — renvoie le bassin de personnages (avec rareté déjà
 * calculée), en cache 24h. `force` ignore le cache (bouton "Actualiser le
 * bassin" côté boutique, par exemple).
 */
export async function fetchWaifuPool({ force = false } = {}) {
  if (!force) {
    const cached = getCached(POOL_CACHE_KEY);
    if (cached?.length) return cached;
  }

  const byId = new Map();
  for (let page = 1; page <= PAGES; page++) {
    const json = await anilistQuery(CHAR_QUERY, { page, perPage: PER_PAGE });
    const chars = json?.data?.Page?.characters || [];
    if (!chars.length) break;
    chars.forEach((c) => { if (c?.id != null) byId.set(c.id, mapCharacter(c)); });
  }

  const pool = computeTiers([...byId.values()].sort((a, b) => b.favourites - a.favourites));
  if (pool.length) setCached(POOL_CACHE_KEY, pool, TTL.WAIFU_POOL);
  return pool;
}
