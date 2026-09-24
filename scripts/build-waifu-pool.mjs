#!/usr/bin/env node
// ── Génère le snapshot du bassin Waifinity ──────────────────────────────────
//
//   npm run pool                       → 3 000 personnages
//   npm run pool -- --count 5000       → bassin plus grand
//   npm run pool -- --out autre.json   → autre destination
//
// Interroge AniList (personnages triés par favoris, avec genre et série
// principale) et écrit public/data/waifinity-pool.json, que l'app charge
// en priorité (voir src/api/waifu.js). À relancer de temps en temps pour
// rafraîchir le classement ; pense à commiter le fichier généré.
//
// AniList limite à ~30 requêtes/min : compte ~2 min pour 3 000 personnages.
// Nécessite Node 18+ (fetch intégré).

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const COUNT    = Math.max(50, Number(arg("count", 3000)) || 3000);
const OUT      = arg("out", "public/data/waifinity-pool.json");
const PER_PAGE = 50;
const DELAY_MS = 2300; // ≈ 26 req/min, sous la limite de 30

const ENDPOINT = "https://graphql.anilist.co";
const QUERY = `
  query ($page: Int, $perPage: Int) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { hasNextPage }
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchPage(page, attempt = 0) {
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { page, perPage: PER_PAGE } }),
    });
  } catch (e) {
    if (attempt >= 3) throw e;
    await sleep(3000);
    return fetchPage(page, attempt + 1);
  }

  if (res.status === 429) {
    if (attempt >= 5) throw new Error("AniList répond 429 en boucle — réessaie dans quelques minutes.");
    const wait = (Number(res.headers.get("retry-after")) || 60) * 1000;
    console.log(`  ⏳ limite atteinte, pause de ${Math.round(wait / 1000)} s…`);
    await sleep(wait);
    return fetchPage(page, attempt + 1);
  }
  if (res.status >= 500 && attempt < 3) {
    await sleep(3000);
    return fetchPage(page, attempt + 1);
  }
  if (!res.ok) throw new Error(`AniList a répondu ${res.status}.`);

  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message || "Erreur GraphQL AniList.");
  return json.data.Page;
}

const DEFAULT_IMAGE = /\/default\.(jpg|png|webp)$/i;

async function main() {
  const pages = Math.ceil(COUNT / PER_PAGE);
  const byId = new Map();
  let skipped = 0;

  console.log(`Récupération de ~${COUNT} personnages AniList (${pages} pages)…`);
  for (let page = 1; page <= pages; page++) {
    const data = await fetchPage(page);
    const chars = data?.characters || [];
    if (!chars.length) break;

    for (const c of chars) {
      const media = c.media?.nodes?.[0] || null;
      const image = c.image?.large || null;
      // On écarte : sans image, ou série principale classée « adulte ».
      if (!image || DEFAULT_IMAGE.test(image) || media?.isAdult) { skipped++; continue; }
      byId.set(c.id, {
        id: c.id,
        name: c.name?.full || c.name?.native || "???",
        image,
        gender: c.gender || null,             // texte libre AniList, normalisé côté app
        favourites: c.favourites || 0,
        seriesId: media?.id ?? null,
        series: media?.title?.romaji || media?.title?.english || null,
      });
    }

    process.stdout.write(`\r  page ${page}/${pages} — ${byId.size} personnages retenus`);
    if (!data?.pageInfo?.hasNextPage) break;
    if (page < pages) await sleep(DELAY_MS);
  }
  process.stdout.write("\n");

  const characters = [...byId.values()].sort((a, b) => b.favourites - a.favourites);
  if (characters.length < 100) throw new Error(`Seulement ${characters.length} personnages récupérés — fichier non écrit.`);

  const withGender = characters.filter((c) => c.gender).length;
  const out = { version: 1, source: "anilist", generatedAt: new Date().toISOString(), count: characters.length, characters };

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(out));

  console.log(`✔ ${characters.length} personnages écrits dans ${OUT}`);
  console.log(`  genre renseigné : ${withGender} (${Math.round((withGender / characters.length) * 100)} %) · écartés : ${skipped}`);
}

main().catch((e) => { console.error("\n✖", e.message); process.exit(1); });
