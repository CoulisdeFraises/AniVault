#!/usr/bin/env node
// ── Synchronise le bassin Waifinity dans Supabase ───────────────────────────
//
//   npm run pool                          → top 3000 MAL, dictionnaire AniList
//                                            de 5000 personnages (son maximum,
//                                            voir plus bas), écrit dans
//                                            Supabase (table waifinity_characters)
//   npm run pool -- --count 5000          → bassin MAL plus grand
//   npm run pool -- --anilist-count 2000  → dictionnaire de genres plus petit
//                                            (plus rapide à construire, utile
//                                            pour un test — 5000 est déjà le
//                                            maximum qu'AniList autorise)
//   npm run pool -- --no-anime            → saute la récupération de la série
//                                            (beaucoup plus rapide, utile pour tester)
//   npm run pool -- --dry                 → calcule tout mais n'écrit rien
//                                            dans Supabase (juste les stats)
//   npm run pool -- --fresh               → ignore le cache local et repart de zéro
//   npm run pool -- --exclude-adult       → écarte les personnages de séries
//                                            taguées "adulte" (gardés par défaut)
//
// ── Pourquoi hybride MAL + AniList ? ────────────────────────────────────────
//
// Le classement de référence (https://myanimelist.net/character.php) et les
// images viennent de MyAnimeList, via Tenrai (API non officielle, gratuite,
// qui reproduit le schéma de Jikan v4 — voir plus bas pourquoi Jikan lui-même
// n'est plus utilisé). MAL lui-même n'a pas d'API publique, et scraper le
// HTML directement serait fragile et contraire à ses conditions d'usage.
//
// Tenrai n'expose PAS le genre des personnages (Jikan non plus, avant lui).
// Comme les boosters Waifu / Husbando du jeu (voir src/utils/waifinity.js)
// reposent dessus, ce script construit d'abord un dictionnaire nom → genre à
// partir d'AniList (qui, lui, expose ce champ), puis fait correspondre chaque
// personnage MAL par son nom. Les personnages sans correspondance gardent un
// genre "inconnu" (ils restent jouables, juste absents des boosters filtrés
// par genre — voir GENDER_BOOSTERS / matchesGender dans utils/waifinity.js).
//
// ── Pourquoi Tenrai et pas Jikan ? ───────────────────────────────────────────
// Jikan (api.jikan.moe) ferme définitivement le 1er octobre 2026 (annoncé par
// ses mainteneurs : maintenance seule depuis juin 2026, dégradé depuis le
// 1er septembre, arrêt total au 1er octobre). Tenrai (api.tenrai.org) est le
// successeur adopté par l'écosystème : même schéma de réponse que Jikan v4
// (mêmes noms de champs — mal_id, images.jpg.*, etc.), gratuit, sans clé pour
// l'usage qu'on en fait ici. Si Tenrai devait à son tour devenir indisponible,
// change TENRAI_BASE ci-dessous — le reste du script n'a pas à changer tant
// que la nouvelle source respecte le même schéma.
//
// ── Contenu adulte ───────────────────────────────────────────────────────────
// Les images de personnages MAL sont des portraits (jamais de contenu
// explicite hébergé sur les pages de personnages), donc par défaut ce script
// GARDE les personnages dont la série principale est taguée "adulte" par
// AniList. Utilise --exclude-adult si tu préfères les écarter — comme pour
// le genre, ce filtrage ne s'applique de toute façon que lorsqu'une
// correspondance AniList a été trouvée pour le personnage ; un personnage MAL
// sans correspondance n'est jamais filtré automatiquement. Pour exclure un
// personnage précis quel que soit ce réglage, ajoute son mal_id à
// MANUAL_EXCLUDE_MAL_IDS ci-dessous et relance le script.
//
// ── Résilience réseau ────────────────────────────────────────────────────────
// Tenrai est encore en bêta ("there will likely be some downtime here and
// there" — doc officielle) : des erreurs transitoires (429, 502, 504…) restent
// possibles. Ce script gère ça sur deux plans :
//   1. Retry avec backoff exponentiel (jusqu'à ~8 tentatives, quelques
//      minutes de patience cumulée) sur chaque appel réseau.
//   2. Cache local dans .waifu-pool-cache/ (ajouté au .gitignore) : le
//      dictionnaire AniList et la liste MAL sont sauvegardés une fois
//      terminés, et la récupération des séries (la partie la plus longue,
//      ~1 appel/perso) sauvegarde sa progression en continu. Si le script
//      s'arrête (erreur, Ctrl+C, coupure réseau), le relancer REPREND là où
//      il s'était arrêté au lieu de tout refaire. Utilise --fresh pour forcer
//      un recalcul complet (ex : si tu veux des données vraiment à jour).
//
// Prérequis : Node 18+ (fetch intégré), et un fichier ".env.pool" à la racine
// (jamais commité) avec :
//   SUPABASE_URL=...
//   SUPABASE_SERVICE_ROLE_KEY=...
// (PAS les variables VITE_SUPABASE_*, qui sont la clé anon publique côté
// client — ici il faut la clé service_role, qui contourne le RLS pour écrire).

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { normalizeGender } from "../src/utils/waifinity.js";

// ── Personnages à exclure manuellement (contenu adulte passé entre les mailles) ──
const MANUAL_EXCLUDE_MAL_IDS = new Set([
  // 12345,
]);

// ── Args CLI ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const MAL_COUNT       = Math.max(50, Number(opt("count", 3000)) || 3000);
const ANILIST_MAX     = 5000; // limite dure d'AniList : "Page depth exceeds maximum allowed (5000 entries)"
const ANILIST_REQUESTED = Math.max(500, Number(opt("anilist-count", ANILIST_MAX)) || ANILIST_MAX);
const ANILIST_COUNT   = Math.min(ANILIST_MAX, ANILIST_REQUESTED);
const FETCH_ANIME     = !flag("no-anime");
const DRY_RUN         = flag("dry");
const FRESH           = flag("fresh");
const EXCLUDE_ADULT   = flag("exclude-adult"); // désactivé par défaut : les images MAL restent des portraits SFW

if (ANILIST_REQUESTED > ANILIST_MAX) {
  console.log(`⚠ --anilist-count ${ANILIST_REQUESTED} demandé, mais AniList refuse toute pagination au-delà de ${ANILIST_MAX} résultats — ramené à ${ANILIST_MAX}.`);
}

const MAL_PAGE_SIZE      = 50;   // Tenrai autorise jusqu'à 50/page (Jikan plafonnait à 25)
const ANILIST_PAGE_SIZE  = 50;
const TENRAI_BASE        = "https://api.tenrai.org/v1";
const TENRAI_DELAY_MS    = 600;  // Tenrai (public) : 120 req/min, 4 req/s max — on reste large
const ANILIST_DELAY_MS   = 2300;  // AniList limite à ~30 req/min sans clé

const MAX_ATTEMPTS  = 8;      // par appel réseau, avant d'abandonner pour de bon
const BASE_DELAY_MS = 2000;   // backoff exponentiel : 2s, 4s, 8s, 16s… plafonné
const MAX_DELAY_MS  = 45000;

// ── .env.pool (fichier séparé, jamais commité, jamais chargé par Vite) ──────
function loadPoolEnv() {
  const file = path.resolve(process.cwd(), ".env.pool");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const [, key, rawVal] = m;
    const val = rawVal.replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadPoolEnv();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function backoff(attempt) {
  const base = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
  return Math.round(base + base * 0.25 * Math.random());
}

// ── Requête HTTP avec retry générique (429 / 5xx / réseau) ─────────────────
async function fetchWithRetry(url, init, label) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, init);
    } catch (e) {
      if (attempt >= MAX_ATTEMPTS - 1) throw new Error(`${label} : échec réseau après ${MAX_ATTEMPTS} tentatives (${e.message})`);
      const wait = backoff(attempt);
      console.log(`\n  ⏳ ${label} : réseau indisponible — pause ${Math.round(wait / 1000)} s (tentative ${attempt + 2}/${MAX_ATTEMPTS})…`);
      await sleep(wait);
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt >= MAX_ATTEMPTS - 1) throw new Error(`${label} a répondu ${res.status} après ${MAX_ATTEMPTS} tentatives.`);
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait = retryAfter ? retryAfter * 1000 : backoff(attempt);
      console.log(`\n  ⏳ ${label} : ${res.status} — pause ${Math.round(wait / 1000)} s (tentative ${attempt + 2}/${MAX_ATTEMPTS})…`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`${label} a répondu ${res.status}.`);
    return res;
  }
}

// ── Cache local (.waifu-pool-cache/) ────────────────────────────────────────
const CACHE_DIR = path.resolve(process.cwd(), ".waifu-pool-cache");
const cacheFile = (name) => path.join(CACHE_DIR, name);

function readCache(name) {
  if (FRESH) return null;
  const file = cacheFile(name);
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, "utf8")); } catch { return null; }
}

function writeCache(name, data) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(cacheFile(name), JSON.stringify(data));
}

function clearCache(name) {
  const file = cacheFile(name);
  if (existsSync(file)) unlinkSync(file);
}

// ── Normalisation des noms pour le matching MAL ↔ AniList ──────────────────
function normalizeName(raw) {
  return String(raw || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// MAL affiche souvent "Nom, Prénom" — on indexe/recherche les deux ordres.
function nameCandidates(rawName) {
  const out = new Set();
  const base = normalizeName(rawName);
  if (base) out.add(base);
  if (rawName?.includes(",")) {
    const [last, first] = rawName.split(",").map((s) => s.trim());
    const swapped = normalizeName(`${first} ${last}`);
    if (swapped) out.add(swapped);
  }
  return [...out];
}

// ── Étape 1 : dictionnaire de genres AniList ────────────────────────────────

const ANILIST_ENDPOINT = "https://graphql.anilist.co";
const ANILIST_QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage }
      characters(sort: FAVOURITES_DESC) {
        id
        name { full native alternative }
        gender
        media(perPage: 1, sort: POPULARITY_DESC) { nodes { isAdult } }
      }
    }
  }
`;

async function fetchAniListPage(page) {
  const res = await fetchWithRetry(ANILIST_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: ANILIST_QUERY, variables: { page, perPage: ANILIST_PAGE_SIZE } }),
  }, `AniList page ${page}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message || "Erreur GraphQL AniList.");
  return json.data.Page;
}

const ANILIST_CACHE = "anilist-dict.json";

/** Map normalizedName → { gender, isAdult, anilistId } — reprend un run interrompu. */
async function buildAniListDictionary(count) {
  const pages = Math.ceil(count / ANILIST_PAGE_SIZE);
  const cached = readCache(ANILIST_CACHE);

  let dict, startPage;
  if (cached && cached.count === count) {
    dict = new Map(cached.entries);
    startPage = cached.lastPage + 1;
    if (startPage > pages) {
      console.log(`\n[1/3] Dictionnaire de genres AniList : déjà complet (cache), ${dict.size} clés.`);
      return dict;
    }
    console.log(`\n[1/3] Reprise du dictionnaire AniList à la page ${startPage}/${pages} (${dict.size} clés déjà indexées)…`);
  } else {
    dict = new Map();
    startPage = 1;
    console.log(`\n[1/3] Dictionnaire de genres AniList (~${count} personnages, ${pages} pages)…`);
  }

  for (let page = startPage; page <= pages; page++) {
    const data = await fetchAniListPage(page);
    const chars = data?.characters || [];
    if (!chars.length) break;

    for (const c of chars) {
      const gender = normalizeGender(c.gender);
      if (!gender) continue; // pas la peine d'indexer un genre inconnu
      const isAdult = !!c.media?.nodes?.[0]?.isAdult;
      const names = [c.name?.full, c.name?.native, ...(c.name?.alternative || [])].filter(Boolean);
      for (const n of names) {
        for (const key of nameCandidates(n)) {
          if (!dict.has(key)) dict.set(key, { gender, isAdult, anilistId: c.id });
        }
      }
    }
    process.stdout.write(`\r  page ${page}/${pages} — ${dict.size} clés indexées`);
    if (page % 10 === 0) writeCache(ANILIST_CACHE, { count, lastPage: page, entries: [...dict.entries()] });
    if (!data?.pageInfo?.hasNextPage) break;
    if (page < pages) await sleep(ANILIST_DELAY_MS);
  }
  process.stdout.write("\n");
  writeCache(ANILIST_CACHE, { count, lastPage: pages, entries: [...dict.entries()] });
  return dict;
}

// ── Étape 2 : top personnages MyAnimeList (via Tenrai) ──────────────────────

async function fetchTenraiJson(url, label) {
  const res = await fetchWithRetry(url, undefined, label);
  return res.json();
}

const DEFAULT_IMAGE = /\/questionmark\.(jpg|png|webp)$/i;
const MAL_LIST_CACHE = "mal-list.json";

async function fetchMalTop(count) {
  const pages = Math.ceil(count / MAL_PAGE_SIZE);
  const cached = readCache(MAL_LIST_CACHE);

  let list, startPage;
  if (cached && cached.count === count) {
    list = cached.list;
    startPage = cached.lastPage + 1;
    if (startPage > pages || list.length >= count) {
      console.log(`\n[2/3] Top MyAnimeList : déjà complet (cache), ${list.length} personnages.`);
      return list.slice(0, count);
    }
    console.log(`\n[2/3] Reprise du top MyAnimeList à la page ${startPage}/${pages} (${list.length} personnages déjà récupérés)…`);
  } else {
    list = [];
    startPage = 1;
    console.log(`\n[2/3] Top MyAnimeList (via Tenrai, ~${count} personnages, ${pages} pages)…`);
  }

  for (let page = startPage; page <= pages; page++) {
    const url = `${TENRAI_BASE}/characters?page=${page}&limit=${MAL_PAGE_SIZE}&order_by=favorites&sort=desc`;
    const json = await fetchTenraiJson(url, `Tenrai (liste, page ${page})`);
    const chars = json?.data || [];
    if (!chars.length) break;

    for (const c of chars) {
      const image = c.images?.jpg?.image_url || c.images?.webp?.image_url || null;
      if (!c.mal_id || !image || DEFAULT_IMAGE.test(image)) continue;
      if (MANUAL_EXCLUDE_MAL_IDS.has(c.mal_id)) continue;
      list.push({ malId: c.mal_id, name: c.name, image, favourites: c.favorites || 0 });
    }
    process.stdout.write(`\r  page ${page}/${pages} — ${list.length} personnages retenus`);
    if (page % 5 === 0) writeCache(MAL_LIST_CACHE, { count, lastPage: page, list });
    if (!json?.pagination?.has_next_page) break;
    if (list.length >= count) break;
    if (page < pages) await sleep(TENRAI_DELAY_MS);
  }
  process.stdout.write("\n");
  const final = list.slice(0, count);
  writeCache(MAL_LIST_CACHE, { count, lastPage: pages, list: final });
  return final;
}

/** Série principale d'un personnage MAL, via /characters/{id}/full. */
async function fetchMalAnime(malId) {
  const json = await fetchTenraiJson(`${TENRAI_BASE}/characters/${malId}/full`, `Tenrai (perso ${malId})`);
  const anime = json?.data?.anime || [];
  const main = anime.find((a) => a.role === "Main") || anime[0] || null;
  return main?.anime ? { animeMalId: main.anime.mal_id, series: main.anime.title } : { animeMalId: null, series: null };
}

const ANIME_CACHE = "mal-anime.json";

/** Enrichit malList avec animeMalId/series, en reprenant les persos déjà faits. */
async function enrichWithAnime(malList) {
  const cached = FRESH ? {} : (readCache(ANIME_CACHE) || {});
  const done = Object.keys(cached).length;
  console.log(`\n  Récupération des séries (${malList.length} appels${done ? `, ${done} déjà en cache` : ""}, via Tenrai)…`);

  let sinceFlush = 0;
  for (let i = 0; i < malList.length; i++) {
    const c = malList[i];
    if (cached[c.malId]) {
      c.animeMalId = cached[c.malId].animeMalId;
      c.series = cached[c.malId].series;
      continue;
    }
    try {
      const { animeMalId, series } = await fetchMalAnime(c.malId);
      c.animeMalId = animeMalId;
      c.series = series;
    } catch {
      c.animeMalId = null;
      c.series = null;
    }
    cached[c.malId] = { animeMalId: c.animeMalId, series: c.series };
    sinceFlush++;
    if (sinceFlush >= 20) { writeCache(ANIME_CACHE, cached); sinceFlush = 0; }
    if (i % 25 === 0) process.stdout.write(`\r  ${i}/${malList.length}`);
    await sleep(TENRAI_DELAY_MS);
  }
  writeCache(ANIME_CACHE, cached);
  process.stdout.write(`\r  ${malList.length}/${malList.length}\n`);
}

// ── Étape 3 : fusion + écriture Supabase ────────────────────────────────────

function buildRows(malList, dict) {
  let matched = 0, adultCount = 0, adultExcluded = 0;
  const rows = malList
    .map((c, i) => {
      let gender = null, isAdult = false;
      for (const key of nameCandidates(c.name)) {
        const hit = dict.get(key);
        if (hit) { gender = hit.gender; isAdult = hit.isAdult; matched++; break; }
      }
      if (isAdult) {
        adultCount++;
        if (EXCLUDE_ADULT) { adultExcluded++; return null; }
      }
      return {
        mal_id:       c.malId,
        name:         c.name,
        image:        c.image,
        gender,
        favourites:   c.favourites,
        rank:         i + 1,
        anime_mal_id: c.animeMalId ?? null,
        series:       c.series ?? null,
        updated_at:   new Date().toISOString(),
      };
    })
    .filter(Boolean);
  return { rows, matched, adultCount, adultExcluded };
}

async function writeToSupabase(rows) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants. Crée un fichier .env.pool " +
      "à la racine (voir .env.pool.example) — jamais les variables VITE_SUPABASE_*, " +
      "il faut la clé service_role, pas la clé anon."
    );
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log(`\n[3/3] Écriture dans Supabase (${rows.length} lignes)…`);
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from("waifinity_characters").upsert(batch, { onConflict: "mal_id" });
    if (error) throw new Error(`Upsert Supabase a échoué (lot ${i / BATCH + 1}) : ${error.message}`);
    process.stdout.write(`\r  ${Math.min(i + BATCH, rows.length)}/${rows.length} lignes envoyées`);
  }
  process.stdout.write("\n");

  // Nettoyage : on retire les personnages qui ne sont plus dans le top actuel.
  const newIds = new Set(rows.map((r) => r.mal_id));
  const { data: existing, error: listErr } = await supabase.from("waifinity_characters").select("mal_id");
  if (listErr) throw new Error(`Lecture Supabase a échoué : ${listErr.message}`);
  const staleIds = (existing || []).map((r) => r.mal_id).filter((id) => !newIds.has(id));
  for (let i = 0; i < staleIds.length; i += 200) {
    const chunk = staleIds.slice(i, i + 200);
    const { error } = await supabase.from("waifinity_characters").delete().in("mal_id", chunk);
    if (error) throw new Error(`Suppression des entrées obsolètes a échoué : ${error.message}`);
  }
  if (staleIds.length) console.log(`  🧹 ${staleIds.length} entrées obsolètes retirées`);
}

async function main() {
  const dict = await buildAniListDictionary(ANILIST_COUNT);
  const malList = await fetchMalTop(MAL_COUNT);
  if (malList.length < 100) throw new Error(`Seulement ${malList.length} personnages MAL récupérés — abandon.`);

  if (FETCH_ANIME) await enrichWithAnime(malList);

  const { rows, matched, adultCount, adultExcluded } = buildRows(malList, dict);
  const withGender = rows.filter((r) => r.gender).length;

  console.log(`\n✔ ${rows.length} personnages prêts`);
  console.log(`  genre trouvé (AniList) : ${withGender}/${rows.length} (${Math.round((matched / malList.length) * 100)} % de correspondances nom)`);
  console.log(
    EXCLUDE_ADULT
      ? `  écartés pour contenu adulte (via correspondance AniList) : ${adultExcluded}`
      : `  personnages de séries "adulte" conservés (via correspondance AniList) : ${adultCount} — relance avec --exclude-adult pour les exclure`
  );

  if (DRY_RUN) { console.log("\n(--dry) Rien écrit dans Supabase. Le cache local est conservé pour un run complet ultérieur."); return; }
  await writeToSupabase(rows);
  console.log("\n✔ Bassin synchronisé dans Supabase (table waifinity_characters).");

  // Une fois écrit avec succès, le cache n'a plus lieu d'être : un prochain
  // `npm run pool` doit repartir sur des données fraîches, pas rejouer ce run.
  clearCache(ANILIST_CACHE);
  clearCache(MAL_LIST_CACHE);
  clearCache(ANIME_CACHE);
}

main().catch((e) => {
  console.error("\n✖", e.message);
  console.error("  Le cache local (.waifu-pool-cache/) est conservé — relance simplement la même commande pour reprendre là où ça s'est arrêté.");
  process.exit(1);
});
