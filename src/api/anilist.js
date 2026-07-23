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
  return (json.data?.Page?.media || []).slice(0, 6).map((m) => ({
    source: "anilist", id: m.id,
    title:  m.title.english || m.title.romaji,
    year:   m.seasonYear, image: m.coverImage?.large,
    episodes: m.episodes, genres: m.genres || [], format: m.format ?? null,
  }));
}

// -----------------------------------------------------------------------------
// fetchAniListFranchise
//
// Recupere la franchise complete : saisons TV + OVA/ONA/Specials + Films.
//
// Phase 1  findRoot     : remonte les PREQUELs TV pour trouver la vraie
//                         racine. On ignore les PREQUELs OVA/film qui
//                         n auraient pas de SEQUEL retour vers la TV.
//
// Phase 2  followTVChain: suit la chaine SEQUEL depuis la racine en
//                         privilegiant les SEQUELs TV/TV_SHORT. Les noeuds
//                         non-TV intercales (ex. film Mugen Train) font
//                         continuer la chaine sans etre comptes comme TV.
//
// Phase 3  collectExtras: BFS sur les edges de chaque noeud TV pour
//                         collecter OVA/ONA/Films/Specials.
//
// BUG CORRIGE : enqueue utilisait extrasMap.set(id, null) pour reserver
// les IDs AVANT que fetchOneExtra ne soit appele. fetchOneExtra verifiait
// extrasMap.has(id) => true => retournait immediatement sans rien fetcher.
// Tous les extras restaient null, filtres par .filter(Boolean) => 0 extras.
// Fix : on utilise un Set "queued" separe pour tracker les IDs en attente.
// extrasMap ne recoit une entree que lorsque la donnee est reellement fetchee.
// -----------------------------------------------------------------------------
export async function fetchAniListFranchise(startId) {
  const NON_TV     = new Set(["OVA", "ONA", "MOVIE", "SPECIAL", "MUSIC"]);
  const TV_FORMATS = new Set(["TV", "TV_SHORT"]);
  const EXTRAS_REL = new Set(["SEQUEL", "SIDE_STORY", "PREQUEL", "OTHER", "SUMMARY", "SPIN_OFF", "ALTERNATIVE_SETTING", "ALTERNATIVE"]);
  const MAX_EXTRAS = 100; // ← était 60

  const FULL_QUERY = `query ($id: Int) { Media(id: $id, type: ANIME) {
    id format episodes title { english romaji }
    nextAiringEpisode { episode }
    coverImage { large }
    relations { edges { relationType node { id type format } } }
  } }`;

  function parseEps(m) {
    return m.episodes ?? (m.nextAiringEpisode?.episode != null ? m.nextAiringEpisode.episode - 1 : null);
  }
  function parseTitle(m) {
    return m.title?.english || m.title?.romaji || null;
  }
  function isTVFormat(fmt) {
    return fmt == null || TV_FORMATS.has(fmt);
  }

  // -- Phase 1 : racine -------------------------------------------------------
  async function findRoot(id, visited = new Set()) {
    if (visited.has(id)) return id;
    visited.add(id);
    try {
      const json = await anilistQuery(FULL_QUERY, { id });
      const m    = json.data?.Media;
      if (!m) return id;
      const prequel = m.relations?.edges?.find(
        (e) => e.relationType === "PREQUEL" &&
               e.node.type   === "ANIME"   &&
               isTVFormat(e.node.format)
      );
      return prequel ? findRoot(prequel.node.id, visited) : id;
    } catch { return id; }
  }

  // -- Phase 2 : chaine TV recursive -----------------------------------------
  async function followTVChain(id, visited = new Set()) {
    if (!id || visited.has(id)) return [];
    visited.add(id);

    let json;
    try { json = await anilistQuery(FULL_QUERY, { id }); } catch { return []; }

    const m = json.data?.Media;
    if (!m) return [];

    const fmt  = m.format ?? "TV";
    const isTV = TV_FORMATS.has(fmt);
    const edges = m.relations?.edges || [];

    const sequel =
      edges.find((e) => e.relationType === "SEQUEL" && e.node.type === "ANIME" && isTVFormat(e.node.format)) ??
      edges.find((e) => e.relationType === "SEQUEL" && e.node.type === "ANIME");

    const rest = await followTVChain(sequel?.node?.id ?? null, visited);

    if (isTV) {
      return [{ anilistId: id, format: fmt, title: parseTitle(m), totalEpisodes: parseEps(m), coverImage: m.coverImage?.large ?? null, edges }, ...rest];
    } else {
      return rest;
    }
  }

  // -- Phase 3 : BFS extras --------------------------------------------------
  const extrasMap = new Map();

  async function fetchOneExtra(id, formatHint) {
    if (extrasMap.has(id)) return;
    try {
      const json = await anilistQuery(FULL_QUERY, { id });
      const m    = json.data?.Media;
      if (!m) return;
      extrasMap.set(id, {
        anilistId:     id,
        format:        m.format ?? formatHint,
        title:         parseTitle(m),
        totalEpisodes: parseEps(m),
        coverImage:    m.coverImage?.large ?? null,
        edges:         m.relations?.edges || [],
      });
    } catch { /* ignoré */ }
  }

  async function collectExtras(tvChain, tvIds) {
    const queue  = [];
    const queued = new Set();

    function enqueue(id, formatHint) {
      if (!id || tvIds.has(id) || extrasMap.has(id) || queued.has(id)) return;
      queued.add(id);
      queue.push({ id, formatHint });
    }

    // Seed : edges de chaque noeud TV
    for (const node of tvChain) {
      for (const edge of node.edges) {
        if (edge.node.type !== "ANIME") continue;
        if (edge.node.format != null && !NON_TV.has(edge.node.format)) continue;
        if (!EXTRAS_REL.has(edge.relationType)) continue;
        enqueue(edge.node.id, edge.node.format);
      }
    }

    // BFS — CORRECTIF : on compare queued.size seul (plus de double-comptage extrasMap+queued)
    while (queue.length > 0 && queued.size <= MAX_EXTRAS) {
      const batch = queue.splice(0, 5);
      await Promise.all(batch.map(({ id, formatHint }) => fetchOneExtra(id, formatHint)));

      for (const { id } of batch) {
        const data = extrasMap.get(id);
        if (!data) continue;
        for (const edge of data.edges) {
          if (edge.node.type !== "ANIME") continue;
          if (edge.node.format != null && !NON_TV.has(edge.node.format)) continue;
          if (!EXTRAS_REL.has(edge.relationType)) continue;
          enqueue(edge.node.id, edge.node.format);
        }
      }
    }
  }

  // -- Execution --------------------------------------------------------------
  const rootId  = await findRoot(startId);
  const tvChain = await followTVChain(rootId);
  const tvIds   = new Set(tvChain.map((n) => n.anilistId));

  await collectExtras(tvChain, tvIds);

  const extras = [...extrasMap.values()].filter((m) => m != null && NON_TV.has(m.format));
  const ovas   = extras.filter((m) => m.format !== "MOVIE");
  const movies = extras.filter((m) => m.format === "MOVIE");

  // CORRECTIF classification : TV_SHORT va dans OVA/Specials, pas dans Série principale
  const tvOnlyChain = tvChain.filter((m) => m.format !== "TV_SHORT");
  const tvShorts    = tvChain.filter((m) => m.format === "TV_SHORT");

  let tvN = 0, ovaN = 0, movieN = 0;
  const seasons = [
    ...tvOnlyChain.map((m) => ({
      number:          ++tvN,
      format:          m.format ?? "TV",
      title:           tvOnlyChain.length > 1 ? m.title : null,
      totalEpisodes:   m.totalEpisodes,
      watchedEpisodes: 0,
      coverImage:      m.coverImage ?? null,
      anilistId:       m.anilistId,
    })),
    ...tvShorts.map((m) => ({
      number:          ++ovaN,
      format:          m.format,          // "TV_SHORT"
      title:           m.title,
      totalEpisodes:   m.totalEpisodes,
      watchedEpisodes: 0,
      coverImage:      m.coverImage ?? null,
      anilistId:       m.anilistId,
    })),
    ...ovas.map((m) => ({
      number:          ++ovaN,
      format:          m.format,
      title:           m.title,
      totalEpisodes:   m.totalEpisodes,
      watchedEpisodes: 0,
      coverImage:      m.coverImage ?? null,
      anilistId:       m.anilistId,
    })),
    ...movies.map((m) => ({
      number:          ++movieN,
      format:          m.format,
      title:           m.title,
      totalEpisodes:   m.totalEpisodes,
      watchedEpisodes: 0,
      coverImage:      m.coverImage ?? null,
      anilistId:       m.anilistId,
    })),
  ];

  const anilistIds = tvOnlyChain.map((m) => m.anilistId);
  return { seasons, anilistIds };
}

// -- fetchAniListAllSeasons (conserve pour la vue Details) -------------------
export async function fetchAniListAllSeasons(startId) {
  async function findRoot(id, v = new Set()) {
    if (v.has(id)) return id; v.add(id);
    const q = `query ($id: Int) { Media(id: $id, type: ANIME) { id relations { edges { relationType node { id type } } } } }`;
    try { const j = await anilistQuery(q, { id }); const p = j.data?.Media?.relations?.edges?.find((e) => e.relationType === "PREQUEL" && e.node.type === "ANIME"); return p ? findRoot(p.node.id, v) : id; } catch { return id; }
  }
  async function followSeq(id, v = new Set()) {
    if (!id || v.has(id)) return []; v.add(id);
    const q = `query ($id: Int) { Media(id: $id, type: ANIME) { id format episodes nextAiringEpisode { episode } coverImage { large } relations { edges { relationType node { id type } } } } }`;
    let j; try { j = await anilistQuery(q, { id }); } catch { return []; }
    const m = j.data?.Media; if (!m) return [];
    const isTV = m.format === "TV" || m.format === "TV_SHORT" || m.format == null;
    const seq  = m.relations?.edges?.find((e) => e.relationType === "SEQUEL" && e.node.type === "ANIME");
    const rest = await followSeq(seq?.node?.id ?? null, v);
    if (!isTV) return rest;
    const eps = m.episodes ?? (m.nextAiringEpisode?.episode != null ? m.nextAiringEpisode.episode - 1 : null);
    return [{ anilistId: id, totalEpisodes: eps, watchedEpisodes: 0, coverImage: m.coverImage?.large ?? null }, ...rest];
  }
  const rootId = await findRoot(startId); const raw = await followSeq(rootId);
  return { seasons: raw.map((s, i) => ({ number: i + 1, format: "TV", totalEpisodes: s.totalEpisodes, watchedEpisodes: 0, coverImage: s.coverImage ?? null })), anilistIds: raw.map((s) => s.anilistId) };
}

export async function fetchAniListNextSeason(rootId, currentSeasonCount) {
  const v = new Set(); const all = []; let cur = rootId;
  while (cur && !v.has(cur) && all.length <= currentSeasonCount) {
    v.add(cur);
    const q = `query ($id: Int) { Media(id: $id, type: ANIME) { id episodes coverImage { large } relations { edges { relationType node { id type } } } } }`;
    let j; try { j = await anilistQuery(q, { id: cur }); } catch { break; }
    const m = j.data?.Media; if (!m) break;
    all.push({ id: cur, episodes: m.episodes ?? null, coverImage: m.coverImage?.large ?? null });
    const seq = (m.relations?.edges || []).find((e) => e.relationType === "SEQUEL" && e.node.type === "ANIME");
    if (!seq) break; cur = seq.node.id;
  }
  const next = all[currentSeasonCount];
  return next ? { id: next.id, episodes: next.episodes ?? null, coverImage: next.coverImage ?? null } : null;
}

export async function fetchAniListEpisodeTotal(anilistId) {
  const q = `query ($id: Int) { Media(id: $id) { episodes nextAiringEpisode { episode } } }`;
  try { const j = await anilistQuery(q, { id: anilistId }); const m = j.data?.Media; return m?.episodes ?? (m?.nextAiringEpisode?.episode != null ? m.nextAiringEpisode.episode - 1 : null); } catch { return null; }
}

async function fetchAniListIdMal(id) { const q = `query ($id: Int) { Media(id: $id) { idMal } }`; const j = await anilistQuery(q, { id }); return j.data?.Media?.idMal ?? null; }

async function fetchJikanEpisodes(malId) {
  const eps = []; let page = 1, hasNext = true;
  while (hasNext && page <= 10) {
    try {
      const res = await fetch(`https://api.jikan.moe/v4/anime/${malId}/episodes?page=${page}`);
      if (res.status === 429) { await new Promise((r) => setTimeout(r, 1000)); continue; }
      if (!res.ok) break;
      const j = await res.json();
      (j.data || []).forEach((e) => eps.push({ number: e.mal_id, name: e.title || e.title_romanji || null }));
      hasNext = Boolean(j.pagination?.has_next_page); page++;
      if (hasNext) await new Promise((r) => setTimeout(r, 350));
    } catch { break; }
  }
  return eps;
}

export async function fetchAniListEpisodesBySeasonId(anilistId) {
  try { const malId = await fetchAniListIdMal(anilistId); if (malId) { const e = await fetchJikanEpisodes(malId); if (e.length) return e; } } catch {} return [];
}

export async function fetchAniListDescription(anilistId) {
  const q = `query ($id: Int) { Media(id: $id) { description(asHtml: false) } }`;
  try { const j = await anilistQuery(q, { id: anilistId }); return j.data?.Media?.description?.trim() || null; } catch { return null; }
}

export async function fetchNextAiringAniList(anilistId) {
  const q = `query ($id: Int) { Media(id: $id, type: ANIME) { nextAiringEpisode { airingAt episode } } }`;
  try { const j = await anilistQuery(q, { id: anilistId }); const n = j.data?.Media?.nextAiringEpisode; return n ? { episode: n.episode, airingAt: n.airingAt * 1000 } : null; } catch { return null; }
}

function getWeekBounds(o = 0) {
  const now = new Date(), dow = now.getDay(), toMon = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(now); mon.setDate(now.getDate() + toMon + o * 7); mon.setHours(0,0,0,0);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 7); sun.setHours(0,0,0,0);
  return { start: Math.floor(mon.getTime()/1000), end: Math.floor(sun.getTime()/1000), monday: mon };
}
const FR_SITES = new Set(["ADN","Wakanim","Anime Digital Network"]);
const FR_URLS  = ["animedigitalnetwork.fr","wakanim.tv/fr","adn."];
export function hasFrenchVersion(media) { return (media.externalLinks||[]).some((l)=>FR_SITES.has(l.site)||(l.language==="French"||l.language==="fr")||(l.url&&FR_URLS.some((p)=>l.url.includes(p)))); }

export async function fetchWeeklySchedule(o = 0) {
  const { start, end, monday } = getWeekBounds(o);

  // Query multi-ligne : plus facile à maintenir, GraphQL ignore les espaces/retours
  const q = `
    query($start: Int, $end: Int, $page: Int) {
      Page(page: $page, perPage: 50) {
        pageInfo { hasNextPage }
        airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: TIME) {
          id airingAt episode
          media {
            id idMal
            title { romaji english }
            description(asHtml: false)
            coverImage { medium large }
            externalLinks { site language type url }
            countryOfOrigin isAdult format
            relations {
              edges {
                relationType
                node { type }
              }
            }
          }
        }
      }
    }
  `;

  const all = [];
  let page = 1, hasNext = true;

  while (hasNext && page <= 6) {
    let res;
    try {
      res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: q, variables: { start, end, page } }),
      });
    } catch {
      throw new Error("Impossible de joindre AniList. Vérifie ta connexion.");
    }

    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2500));
      continue;
    }
    if (!res.ok) throw new Error(`AniList a répondu avec une erreur (${res.status}).`);

    const j = await res.json();
    if (j.errors?.length) throw new Error(j.errors[0].message || "Erreur GraphQL AniList.");

    const pd = j.data?.Page;
    if (!pd) break;

    all.push(
      ...(pd.airingSchedules || []).filter((s) => {
        if (s.media?.isAdult) return false;
        const co = s.media?.countryOfOrigin;
        return !co || co === "JP";
      })
    );

    hasNext = pd.pageInfo?.hasNextPage;
    page++;
  }

  return { schedules: all, monday };
}
export function isReturningSeries(media){return (media.relations?.edges||[]).some((e)=>e.relationType==="PREQUEL"&&e.node?.type==="ANIME");}
