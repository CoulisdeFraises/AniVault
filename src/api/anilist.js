async function anilistQuery(query, variables) {
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error("anilist error");
  return res.json();
}

export async function searchAniList(q) {
  const query = `query ($search: String) { Page(perPage: 20) { media(search: $search, type: ANIME, sort: POPULARITY_DESC) { id title { romaji english } episodes genres coverImage { large } seasonYear format relations { edges { relationType node { id type } } } } } }`;
  const json  = await anilistQuery(query, { search: q });
  const media = json.data?.Page?.media || [];
  return media.slice(0, 6).map((m) => ({
    source: "anilist", id: m.id,
    title:  m.title.english || m.title.romaji,
    year:   m.seasonYear, image: m.coverImage?.large,
    episodes: m.episodes, genres: m.genres || [], format: m.format ?? null,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// fetchAniListFranchise
//
// Récupère la franchise complète : saisons TV + OVA/ONA + Films en un seul appel.
//
// Algorithme (récursif, identique à l'ancienne logique TV mais étendu) :
//   1. Remonter jusqu'à la racine via les liens PREQUEL.
//   2. Suivre la chaîne SEQUEL nœud par nœud :
//      - Nœud TV    → ajouté à tvChain.
//      - Nœud non-TV (film, OVA…) dans la chaîne → ajouté aux extras,
//        mais la chaîne CONTINUE au nœud suivant (cas Demon Slayer : film Mugen Train
//        est entre S1 et l'arc TV Mugen Ressha).
//   3. À chaque nœud, collecter aussi les entrées non-TV liées en SIDE_STORY /
//      PREQUEL (non-TV) / OTHER → extras.
//   4. Résultat : seasons[] avec format par entrée + anilistIds (TV only).
// ─────────────────────────────────────────────────────────────────────────────
export async function fetchAniListFranchise(startId) {
  const NON_TV   = new Set(["OVA", "ONA", "MOVIE", "SPECIAL", "MUSIC"]);
  const SIDE_REL = new Set(["SIDE_STORY", "PREQUEL", "OTHER", "SUMMARY"]);

  const CHAIN_QUERY = `query ($id: Int) { Media(id: $id, type: ANIME) {
    id format episodes nextAiringEpisode { episode }
    coverImage { large }
    relations { edges { relationType node { id type format } } }
  } }`;

  const LIGHT_QUERY = `query ($id: Int) { Media(id: $id, type: ANIME) {
    id format episodes nextAiringEpisode { episode } coverImage { large }
  } }`;

  // ── 1. Racine ───────────────────────────────────────────────────────────────
  async function findRoot(id, visited = new Set()) {
    if (visited.has(id)) return id;
    visited.add(id);
    try {
      const json    = await anilistQuery(CHAIN_QUERY, { id });
      const prequel = json.data?.Media?.relations?.edges?.find(
        (e) => e.relationType === "PREQUEL" && e.node.type === "ANIME"
      );
      return prequel ? findRoot(prequel.node.id, visited) : id;
    } catch { return id; }
  }

  // ── 2. Collecte des extras (OVA/ONA/Films) ─────────────────────────────────
  const extrasMap = new Map(); // id → data  (évite les doublons)

  async function fetchExtra(id, formatHint) {
    if (extrasMap.has(id)) return;
    extrasMap.set(id, null); // réservation
    try {
      const json = await anilistQuery(LIGHT_QUERY, { id });
      const m    = json.data?.Media;
      if (!m) return;
      extrasMap.set(id, {
        anilistId:     id,
        format:        m.format ?? formatHint,
        totalEpisodes: m.episodes ?? (m.nextAiringEpisode?.episode != null ? m.nextAiringEpisode.episode - 1 : null),
        coverImage:    m.coverImage?.large ?? null,
      });
    } catch { extrasMap.delete(id); }
  }

  // ── 3. Traversée récursive de la chaîne ────────────────────────────────────
  async function followChain(id, visited = new Set()) {
    if (!id || visited.has(id)) return [];
    visited.add(id);

    let json;
    try { json = await anilistQuery(CHAIN_QUERY, { id }); } catch { return []; }

    const media = json.data?.Media;
    if (!media) return [];

    const format = media.format ?? "TV";
    const isTV   = format === "TV" || format === "TV_SHORT";
    const totalEpisodes =
      media.episodes ??
      (media.nextAiringEpisode?.episode != null ? media.nextAiringEpisode.episode - 1 : null);
    const coverImage = media.coverImage?.large ?? null;
    const edges      = media.relations?.edges || [];

    // Trouver le sequel (peut être TV ou non-TV)
    const sequelEdge = edges.find((e) => e.relationType === "SEQUEL" && e.node.type === "ANIME");

    // Collecter les extras liés à ce nœud (SIDE_STORY, PREQUEL non-TV, etc.)
    const sidePromises = [];
    for (const edge of edges) {
      if (edge.node.type !== "ANIME") continue;
      if (!NON_TV.has(edge.node.format)) continue;
      if (!SIDE_REL.has(edge.relationType)) continue;
      if (!visited.has(edge.node.id)) {
        visited.add(edge.node.id); // marquer avant fetch pour éviter doublons
        sidePromises.push(fetchExtra(edge.node.id, edge.node.format));
      }
    }
    await Promise.all(sidePromises);

    // Continuer la chaîne
    const rest = await followChain(sequelEdge?.node?.id ?? null, visited);

    if (isTV) {
      // Nœud TV → ajouté à la chaîne principale
      return [{ anilistId: id, format, totalEpisodes, coverImage }, ...rest];
    } else {
      // Nœud non-TV dans la chaîne (ex : film Mugen Train entre S1 et l'arc TV)
      // → extras, mais la chaîne continue
      if (!extrasMap.has(id)) {
        extrasMap.set(id, { anilistId: id, format, totalEpisodes, coverImage });
      }
      return rest;
    }
  }

  // ── Exécution ───────────────────────────────────────────────────────────────
  const rootId  = await findRoot(startId);
  const tvChain = await followChain(rootId);

  // Séparer OVA/ONA/Specials et Films dans les extras
  const extras = [...extrasMap.values()].filter(Boolean);
  const ovas   = extras.filter((m) => m.format !== "MOVIE");
  const movies = extras.filter((m) => m.format === "MOVIE");

  let tvN = 0, ovaN = 0, movieN = 0;
  const seasons = [
    ...tvChain.map((m) => ({ number: ++tvN,    format: m.format ?? "TV", totalEpisodes: m.totalEpisodes, watchedEpisodes: 0, coverImage: m.coverImage ?? null, anilistId: m.anilistId })),
    ...ovas.map((m)    => ({ number: ++ovaN,   format: m.format,         totalEpisodes: m.totalEpisodes, watchedEpisodes: 0, coverImage: m.coverImage ?? null, anilistId: m.anilistId })),
    ...movies.map((m)  => ({ number: ++movieN, format: m.format,         totalEpisodes: m.totalEpisodes, watchedEpisodes: 0, coverImage: m.coverImage ?? null, anilistId: m.anilistId })),
  ];

  // anilistIds = TV uniquement (pour nextAiring / fetchSeasonInfo – rétrocompat)
  const anilistIds = tvChain.map((m) => m.anilistId);

  return { seasons, anilistIds };
}

// ── fetchAniListAllSeasons (conservé pour la vue Détails) ────────────────────
export async function fetchAniListAllSeasons(startId) {
  async function findRoot(id, visited = new Set()) {
    if (visited.has(id)) return id;
    visited.add(id);
    const q = `query ($id: Int) { Media(id: $id, type: ANIME) { id relations { edges { relationType node { id type } } } } }`;
    try {
      const json    = await anilistQuery(q, { id });
      const prequel = json.data?.Media?.relations?.edges?.find(
        (e) => e.relationType === "PREQUEL" && e.node.type === "ANIME"
      );
      return prequel ? findRoot(prequel.node.id, visited) : id;
    } catch { return id; }
  }

  async function followSequels(id, visited = new Set()) {
    if (!id || visited.has(id)) return [];
    visited.add(id);
    const q = `query ($id: Int) { Media(id: $id, type: ANIME) { id format episodes nextAiringEpisode { episode } coverImage { large } relations { edges { relationType node { id type } } } } }`;
    let json;
    try { json = await anilistQuery(q, { id }); } catch { return []; }
    const media  = json.data?.Media;
    if (!media) return [];
    const isTV   = media.format === "TV" || media.format === "TV_SHORT" || media.format == null;
    const sequel = media.relations?.edges?.find((e) => e.relationType === "SEQUEL" && e.node.type === "ANIME");
    const rest   = await followSequels(sequel?.node?.id ?? null, visited);
    if (!isTV) return rest;
    const totalEpisodes = media.episodes ?? (media.nextAiringEpisode?.episode != null ? media.nextAiringEpisode.episode - 1 : null);
    return [{ anilistId: id, totalEpisodes, watchedEpisodes: 0, coverImage: media.coverImage?.large ?? null }, ...rest];
  }

  const rootId = await findRoot(startId);
  const raw    = await followSequels(rootId);
  return {
    seasons:    raw.map((s, i) => ({ number: i + 1, format: "TV", totalEpisodes: s.totalEpisodes, watchedEpisodes: 0, coverImage: s.coverImage ?? null })),
    anilistIds: raw.map((s) => s.anilistId),
  };
}

export async function fetchAniListNextSeason(rootId, currentSeasonCount) {
  const visited = new Set(); const allEntries = []; let currentId = rootId;
  while (currentId && !visited.has(currentId) && allEntries.length <= currentSeasonCount) {
    visited.add(currentId);
    const q = `query ($id: Int) { Media(id: $id, type: ANIME) { id episodes coverImage { large } relations { edges { relationType node { id type } } } } }`;
    let json; try { json = await anilistQuery(q, { id: currentId }); } catch { break; }
    const media = json.data?.Media; if (!media) break;
    allEntries.push({ id: currentId, episodes: media.episodes ?? null, coverImage: media.coverImage?.large ?? null });
    const sequel = (media.relations?.edges || []).find((e) => e.relationType === "SEQUEL" && e.node.type === "ANIME");
    if (!sequel) break; currentId = sequel.node.id;
  }
  const next = allEntries[currentSeasonCount];
  return next ? { id: next.id, episodes: next.episodes ?? null, coverImage: next.coverImage ?? null } : null;
}

export async function fetchAniListEpisodeTotal(anilistId) {
  const q = `query ($id: Int) { Media(id: $id) { episodes nextAiringEpisode { episode } } }`;
  try {
    const json = await anilistQuery(q, { id: anilistId }); const media = json.data?.Media;
    return media?.episodes ?? (media?.nextAiringEpisode?.episode != null ? media.nextAiringEpisode.episode - 1 : null);
  } catch { return null; }
}

async function fetchAniListIdMal(anilistId) {
  const q    = `query ($id: Int) { Media(id: $id) { idMal } }`;
  const json = await anilistQuery(q, { id: anilistId });
  return json.data?.Media?.idMal ?? null;
}

async function fetchJikanEpisodes(malId) {
  const episodes = []; let page = 1, hasNext = true;
  while (hasNext && page <= 10) {
    try {
      const res = await fetch(`https://api.jikan.moe/v4/anime/${malId}/episodes?page=${page}`);
      if (res.status === 429) { await new Promise((r) => setTimeout(r, 1000)); continue; }
      if (!res.ok) break;
      const json = await res.json();
      (json.data || []).forEach((e) => episodes.push({ number: e.mal_id, name: e.title || e.title_romanji || null }));
      hasNext = Boolean(json.pagination?.has_next_page); page++;
      if (hasNext) await new Promise((r) => setTimeout(r, 350));
    } catch { break; }
  }
  return episodes;
}

export async function fetchAniListEpisodesBySeasonId(anilistId) {
  try {
    const malId = await fetchAniListIdMal(anilistId);
    if (malId) { const eps = await fetchJikanEpisodes(malId); if (eps.length) return eps; }
  } catch {} return [];
}

export async function fetchAniListDescription(anilistId) {
  const q = `query ($id: Int) { Media(id: $id) { description(asHtml: false) } }`;
  try { const json = await anilistQuery(q, { id: anilistId }); return json.data?.Media?.description?.trim() || null; } catch { return null; }
}

export async function fetchNextAiringAniList(anilistId) {
  const q = `query ($id: Int) { Media(id: $id, type: ANIME) { nextAiringEpisode { airingAt episode } } }`;
  try { const json = await anilistQuery(q, { id: anilistId }); const nae = json.data?.Media?.nextAiringEpisode; return nae ? { episode: nae.episode, airingAt: nae.airingAt * 1000 } : null; } catch { return null; }
}

function getWeekBounds(offsetWeeks = 0) {
  const now = new Date(); const dow = now.getDay(); const toMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now); monday.setDate(now.getDate() + toMon + offsetWeeks * 7); monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 7); sunday.setHours(0, 0, 0, 0);
  return { start: Math.floor(monday.getTime() / 1000), end: Math.floor(sunday.getTime() / 1000), monday };
}

const FR_ONLY_SITES   = new Set(["ADN", "Wakanim", "Anime Digital Network"]);
const FR_URL_PATTERNS = ["animedigitalnetwork.fr", "wakanim.tv/fr", "adn."];
export function hasFrenchVersion(media) {
  return (media.externalLinks || []).some((l) => {
    if (FR_ONLY_SITES.has(l.site)) return true;
    if (l.language === "French" || l.language === "fr") return true;
    if (l.url && FR_URL_PATTERNS.some((p) => l.url.includes(p))) return true;
    return false;
  });
}

export async function fetchWeeklySchedule(offsetWeeks = 0) {
  const { start, end, monday } = getWeekBounds(offsetWeeks);
  const query = `query ($start: Int, $end: Int, $page: Int) { Page(page: $page, perPage: 50) { pageInfo { hasNextPage } airingSchedules(airingAt_greater: $start airingAt_lesser: $end sort: TIME) { id airingAt episode media { id idMal title { romaji english } description(asHtml: false) coverImage { medium large } externalLinks { site language type url } countryOfOrigin isAdult format relations { edges { relationType node { type } } } } } } }`;
  const all = []; let page = 1, hasNext = true;
  while (hasNext && page <= 6) {
    const res = await fetch("https://graphql.anilist.co", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ query, variables: { start, end, page } }) });
    if (!res.ok) break;
    const json = await res.json(); const pageData = json.data?.Page; if (!pageData) break;
    all.push(...(pageData.airingSchedules || []).filter((s) => !s.media?.isAdult && s.media?.countryOfOrigin === "JP"));
    hasNext = pageData.pageInfo?.hasNextPage; page++;
  }
  return { schedules: all, monday };
}

export function isReturningSeries(media) {
  return (media.relations?.edges || []).some((e) => e.relationType === "PREQUEL" && e.node?.type === "ANIME");
}
