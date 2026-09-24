// ── Waifinity : bassin de personnages (source : AniList) ────────────────────
//
// AniList (GraphQL, public, CORS ouvert — déjà intégré à l'app) expose pour
// chaque personnage : image, nom, nombre de favoris ET genre (`gender`).
// Jikan (MyAnimeList) n'a pas de champ de genre pour les personnages, d'où le
// choix d'AniList comme source unique.
//
// Deux sources, dans cet ordre :
//
//  1. SNAPSHOT STATIQUE  /data/waifinity-pool.json  (public/data/)
//     Généré une fois par `npm run pool` (scripts/build-waifu-pool.mjs) :
//     plusieurs milliers de personnages, sans limite de débit côté visiteur
//     (AniList plafonne à ~30 requêtes/min : impossible de construire un gros
//     bassin en direct à chaque première visite). Servi comme un fichier
//     statique, il est mis en cache par le navigateur et le Service Worker.
//
//  2. REPLI EN DIRECT (AniList, LIVE_PAGES × 50 personnages)
//     Utilisé si le snapshot est absent ou illisible, pour que le jeu reste
//     jouable. Mis en cache 24 h.
//
// La rareté de chaque personnage (voir utils/waifinity.js) est calculée par
// rang de favoris au sein du bassin chargé.
//
// Les personnages dont la série principale est classée « adulte » par AniList
// sont exclus du bassin (dans le snapshot comme en direct).

import { anilistQuery } from "./anilist";
import { getCached, setCached, removeCached, TTL } from "../lib/cache";
import { computeTiers, normalizeGender } from "../utils/waifinity";

const SNAPSHOT_URL   = "/data/waifinity-pool.json";
const LIVE_CACHE_KEY = "waifinity_pool_live_v2";
const LIVE_PAGES     = 8;   // 8 × 50 = 400 personnages max en repli
const PER_PAGE       = 50;
const MIN_SNAPSHOT   = 100; // en dessous, on considère le fichier invalide

const CHAR_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      characters(sort: FAVOURITES_DESC) {
        id
        name { full native }
        image { large }
        gender
        favourites
        media(perPage: 1, sort: POPULARITY_DESC) {
          nodes { id isAdult title { romaji english } }
        }
      }
    }
  }
`;

// AniList sert « default.jpg » quand un personnage n'a pas d'image.
const DEFAULT_IMAGE = /\/default\.(jpg|png|webp)$/i;

/** Réponse AniList → entrée du bassin (ou null si le personnage est inutilisable). */
function mapCharacter(c) {
  const media = c.media?.nodes?.[0] || null;
  const image = c.image?.large || null;
  if (c?.id == null || !image || DEFAULT_IMAGE.test(image)) return null;
  if (media?.isAdult) return null;
  return {
    id:         c.id,
    name:       c.name?.full || c.name?.native || "???",
    image,
    gender:     normalizeGender(c.gender),
    favourites: c.favourites || 0,
    seriesId:   media?.id ?? null,
    series:     media?.title?.romaji || media?.title?.english || "Série inconnue",
  };
}

/** Entrée du snapshot (déjà filtrée par le script) → entrée du bassin. */
function mapSnapshotEntry(e) {
  if (e?.id == null || !e.name || !e.image) return null;
  return {
    id:         e.id,
    name:       e.name,
    image:      e.image,
    gender:     normalizeGender(e.gender),
    favourites: e.favourites || 0,
    seriesId:   e.seriesId ?? null,
    series:     e.series || "Série inconnue",
  };
}

async function fetchSnapshot(force) {
  const res = await fetch(SNAPSHOT_URL, force ? { cache: "reload" } : undefined);
  if (!res.ok) throw new Error(`Snapshot indisponible (${res.status})`);
  // Si le fichier n'existe pas, le fallback SPA (/* → index.html) répond en
  // 200 avec du HTML : res.json() lève alors, et on passe au repli en direct.
  const json = await res.json();
  const list = Array.isArray(json) ? json : json?.characters;
  if (!Array.isArray(list) || list.length < MIN_SNAPSHOT) throw new Error("Snapshot invalide");
  return {
    list: list.map(mapSnapshotEntry).filter(Boolean),
    meta: { source: "snapshot", generatedAt: json?.generatedAt || null },
  };
}

async function fetchLive(force) {
  if (!force) {
    const cached = getCached(LIVE_CACHE_KEY);
    if (cached?.length) return { list: cached, meta: { source: "live", generatedAt: null } };
  }

  const byId = new Map();
  let complete = true;
  for (let page = 1; page <= LIVE_PAGES; page++) {
    try {
      const json = await anilistQuery(CHAR_QUERY, { page, perPage: PER_PAGE });
      const chars = json?.data?.Page?.characters || [];
      if (!chars.length) break;
      chars.forEach((c) => { const m = mapCharacter(c); if (m) byId.set(m.id, m); });
    } catch (e) {
      if (!byId.size) throw e;   // rien de chargé : on remonte l'erreur
      complete = false;          // bassin partiel : jouable, mais pas mis en cache
      break;
    }
  }

  const list = [...byId.values()];
  if (list.length && complete) setCached(LIVE_CACHE_KEY, list, TTL.WAIFU_POOL);
  return { list, meta: { source: "live", generatedAt: null } };
}

let memory   = null;  // { pool, meta } — bassin déjà calculé pendant la session
let inflight = null;

/**
 * fetchWaifuPool — renvoie { pool, meta } : le bassin de personnages (rareté
 * déjà calculée) et sa provenance ({ source: "snapshot" | "live", generatedAt }).
 * `force` ignore les caches (bouton « Actualiser le bassin »).
 */
export function fetchWaifuPool({ force = false } = {}) {
  if (!force && memory) return Promise.resolve(memory);
  if (!force && inflight) return inflight;

  if (force) { memory = null; removeCached(LIVE_CACHE_KEY); }

  inflight = (async () => {
    let result;
    try { result = await fetchSnapshot(force); }
    catch { result = await fetchLive(force); }

    const sorted = result.list.sort((a, b) => b.favourites - a.favourites);
    const pool = computeTiers(sorted);
    const out = { pool, meta: { ...result.meta, count: pool.length } };
    if (pool.length) memory = out;
    return out;
  })().finally(() => { inflight = null; });

  return inflight;
}
