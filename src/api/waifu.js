// ── Waifinity : bassin de personnages (classement MyAnimeList + genre AniList) ──
//
// Le bassin (top ~3000, classement réel https://myanimelist.net/character.php)
// est constitué et tenu à jour côté serveur par scripts/sync-waifu-pool.mjs,
// qui écrit dans la table Supabase `waifinity_characters`. Le genre de chaque
// personnage (utilisé par les boosters Waifu/Husbando) vient d'AniList, croisé
// par nom lors de la synchro — Jikan (MyAnimeList) n'expose pas ce champ. Voir
// l'en-tête de ce script pour le détail de la logique de correspondance.
//
// Deux sources, dans cet ordre :
//
//  1. SUPABASE (table waifinity_characters, lecture publique en RLS)
//     Source de vérité : gérée uniquement par nous, indépendante des quotas
//     AniList/Jikan côté visiteur. Mise à jour en relançant `npm run pool`.
//
//  2. REPLI EN DIRECT (AniList, LIVE_PAGES × 50 personnages)
//     Utilisé si Supabase est injoignable ou vide, pour que le jeu reste
//     jouable en dégradé. Mis en cache 24 h. Base AniList (pas MAL) : la
//     rareté et le classement seront donc temporairement différents tant que
//     ce repli est actif.
//
// La rareté de chaque personnage (voir utils/waifinity.js) est calculée par
// rang de favoris au sein du bassin chargé.

import { supabase } from "../lib/supabase";
import { anilistQuery } from "./anilist";
import { getCached, setCached, removeCached, TTL } from "../lib/cache";
import { computeTiers, normalizeGender } from "../utils/waifinity";

const TABLE           = "waifinity_characters";
const SUPABASE_PAGE   = 1000; // limite par requête côté PostgREST (voir range())
const LIVE_CACHE_KEY  = "waifinity_pool_live_v2";
const LIVE_PAGES      = 8;   // 8 × 50 = 400 personnages max en repli
const PER_PAGE        = 50;
const MIN_POOL        = 100; // en dessous, on considère la source invalide

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

/** Ligne Supabase (table waifinity_characters) → entrée du bassin. */
function mapRow(row) {
  if (row?.mal_id == null || !row.name || !row.image) return null;
  return {
    id:         row.mal_id,
    name:       row.name,
    image:      row.image,
    gender:     normalizeGender(row.gender),
    favourites: row.favourites || 0,
    seriesId:   row.anime_mal_id ?? null,
    series:     row.series || "Série inconnue",
  };
}

async function fetchSupabasePool() {
  const rows = [];
  // La table peut dépasser la limite par requête de PostgREST : on pagine.
  for (let from = 0; ; from += SUPABASE_PAGE) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("mal_id, name, image, gender, favourites, anime_mal_id, series, updated_at")
      .order("favourites", { ascending: false })
      .range(from, from + SUPABASE_PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < SUPABASE_PAGE) break;
  }
  if (rows.length < MIN_POOL) throw new Error("Bassin Supabase vide ou trop petit");
  return {
    list: rows.map(mapRow).filter(Boolean),
    meta: { source: "supabase", generatedAt: rows[0]?.updated_at || null },
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
 * déjà calculée) et sa provenance ({ source: "supabase" | "live", generatedAt }).
 * `force` ignore les caches (bouton « Actualiser le bassin »).
 */
export function fetchWaifuPool({ force = false } = {}) {
  if (!force && memory) return Promise.resolve(memory);
  if (!force && inflight) return inflight;

  if (force) { memory = null; removeCached(LIVE_CACHE_KEY); }

  inflight = (async () => {
    let result;
    try { result = await fetchSupabasePool(); }
    catch { result = await fetchLive(force); }

    const sorted = result.list.sort((a, b) => b.favourites - a.favourites);
    const pool = computeTiers(sorted);
    const out = { pool, meta: { ...result.meta, count: pool.length } };
    if (pool.length) memory = out;
    return out;
  })().finally(() => { inflight = null; });

  return inflight;
}
