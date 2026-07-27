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
  const cultureMode = localStorage.getItem("pref_culture_mode") === "true";
  const query = `query ($search: String) { Page(perPage: 20) { media(search: $search, type: ANIME, sort: POPULARITY_DESC) { id title { romaji english } episodes genres coverImage { large } seasonYear format relations { edges { relationType node { id type } } } } } }`;
  const json  = await anilistQuery(query, { search: q });
  return (json.data?.Page?.media || [])
    .filter(m => cultureMode || !m.genres?.includes("Hentai"))
    .slice(0, 6)
    .map((m) => ({ source: "anilist", id: m.id, title: m.title.english || m.title.romaji,
      year: m.seasonYear, image: m.coverImage?.large, episodes: m.episodes,
      genres: m.genres || [], format: m.format ?? null }));
}

// -----------------------------------------------------------------------------
// fetchAniListFranchise — récupère la franchise complète.
//
// CORRECTIF BUG FILMS PARASITES :
//   Avant : collectExtras() suivait récursivement les relations des extras eux-mêmes
//   (OVA → ses propres relations → autres franchises via ALTERNATIVE/SPIN_OFF...).
//   En quelques sauts dans le graphe AniList on pouvait arriver sur des œuvres
//   totalement non liées (ex: Mayonaka Punch → Professeur Layton).
//
//   Maintenant :
//   1. EXTRAS_REL ne contient plus SPIN_OFF / ALTERNATIVE_SETTING / ALTERNATIVE
//      (ces types relient des franchises DIFFÉRENTES, pas des extras du même titre).
//   2. La phase récursive est supprimée : on ne parcourt que les relations directes
//      depuis la chaîne TV principale, sans suivre les relations des extras trouvés.
// -----------------------------------------------------------------------------
export async function fetchAniListFranchise(startId) {
  const NON_TV     = new Set(["OVA", "ONA", "MOVIE", "SPECIAL", "MUSIC"]);
  const TV_FORMATS = new Set(["TV", "TV_SHORT"]);

  // Relations valides pour rattacher un extra (OVA/Film/Spécial) à la franchise.
  // SPIN_OFF, ALTERNATIVE_SETTING, ALTERNATIVE volontairement exclus :
  // ils désignent des œuvres DISTINCTES, pas des contenus annexes du même titre.
  const EXTRAS_REL = new Set(["SIDE_STORY", "OTHER", "SUMMARY", "PREQUEL", "SEQUEL"]);

  const MAX_EXTRAS = 30; // réduit pour éviter les graphes trop larges

  const FULL_QUERY = `query ($id: Int) { Media(id: $id, type: ANIME) {
    id format episodes title { english romaji }
    nextAiringEpisode { episode }
    coverImage { large }
    relations { edges { relationType node { id type format } } }
  } }`;

  function parseEps(m) {
    return m.episodes ?? (m.nextAiringEpisode?.episode != null ? m.nextAiringEpisode.episode - 1 : null);
  }
  function parseTitle(m) { return m.title?.english || m.title?.romaji || null; }
  function isTVFormat(fmt) { return fmt == null || TV_FORMATS.has(fmt); }

  async function findRoot(id, visited = new Set()) {
    if (visited.has(id)) return id; visited.add(id);
    try {
      const json = await anilistQuery(FULL_QUERY, { id });
      const m = json.data?.Media; if (!m) return id;
      const prequel = m.relations?.edges?.find(
        (e) => e.relationType === "PREQUEL" && e.node.type === "ANIME" && isTVFormat(e.node.format)
      );
      return prequel ? findRoot(prequel.node.id, visited) : id;
    } catch { return id; }
  }

  async function followTVChain(id, visited = new Set()) {
    if (!id || visited.has(id)) return []; visited.add(id);
    let json;
    try { json = await anilistQuery(FULL_QUERY, { id }); } catch { return []; }
    const m = json.data?.Media; if (!m) return [];
    const fmt  = m.format ?? "TV";
    const isTV = TV_FORMATS.has(fmt);
    const edges = m.relations?.edges || [];
    const sequel =
      edges.find((e) => e.relationType === "SEQUEL" && e.node.type === "ANIME" && isTVFormat(e.node.format)) ??
      edges.find((e) => e.relationType === "SEQUEL" && e.node.type === "ANIME");
    const rest = await followTVChain(sequel?.node?.id ?? null, visited);
    if (isTV) {
      return [{ anilistId: id, format: fmt, title: parseTitle(m), totalEpisodes: parseEps(m),
                coverImage: m.coverImage?.large ?? null, edges }, ...rest];
    }
    return rest;
  }

  const extrasMap = new Map();
  async function fetchOneExtra(id, formatHint) {
    if (extrasMap.has(id)) return;
    try {
      const json = await anilistQuery(FULL_QUERY, { id });
      const m = json.data?.Media; if (!m) return;
      extrasMap.set(id, {
        anilistId: id, format: m.format ?? formatHint, title: parseTitle(m),
        totalEpisodes: parseEps(m), coverImage: m.coverImage?.large ?? null,
      });
    } catch {}
  }

  /**
   * collectExtras — récupère OVA / Films / Spéciaux directement liés à la chaîne TV.
   *
   * CORRECTIF : on ne parcourt QUE les relations directes des nœuds de la chaîne TV.
   * On ne suit PAS les relations des extras entre eux (suppression de la récursion)
   * pour éviter de dériver vers des franchises non liées via des chaînes de relations
   * AniList indirectes.
   */
  async function collectExtras(tvChain, tvIds) {
    const toFetch = [];
    const queued  = new Set();

    // Seeding uniquement depuis la chaîne TV principale — pas de récursion ensuite
    for (const node of tvChain) {
      for (const edge of node.edges) {
        if (edge.node.type !== "ANIME") continue;
        if (edge.node.format != null && !NON_TV.has(edge.node.format)) continue;
        if (!EXTRAS_REL.has(edge.relationType)) continue;
        const id = edge.node.id;
        if (!id || tvIds.has(id) || queued.has(id)) continue;
        queued.add(id);
        toFetch.push({ id, formatHint: edge.node.format });
        if (toFetch.length >= MAX_EXTRAS) break;
      }
      if (toFetch.length >= MAX_EXTRAS) break;
    }

    // Fetch en batches — sans re-parcourir les edges des extras
    for (let i = 0; i < toFetch.length; i += 5) {
      const batch = toFetch.slice(i, i + 5);
      await Promise.all(batch.map(({ id, formatHint }) => fetchOneExtra(id, formatHint)));
    }
  }

  const rootId  = await findRoot(startId);
  const tvChain = await followTVChain(rootId);
  const tvIds   = new Set(tvChain.map((n) => n.anilistId));
  await collectExtras(tvChain, tvIds);

  const extras = [...extrasMap.values()].filter((m) => m != null && NON_TV.has(m.format));
  const ovas   = extras.filter((m) => m.format !== "MOVIE");
  const movies = extras.filter((m) => m.format === "MOVIE");
  const tvOnlyChain = tvChain.filter((m) => m.format !== "TV_SHORT");
  const tvShorts    = tvChain.filter((m) => m.format === "TV_SHORT");

  let tvN = 0, ovaN = 0, movieN = 0;
  const seasons = [
    ...tvOnlyChain.map((m) => ({ number: ++tvN, format: m.format ?? "TV",
      title: tvOnlyChain.length > 1 ? m.title : null, totalEpisodes: m.totalEpisodes,
      watchedEpisodes: 0, coverImage: m.coverImage ?? null, anilistId: m.anilistId })),
    ...tvShorts.map((m) => ({ number: ++ovaN, format: m.format, title: m.title,
      totalEpisodes: m.totalEpisodes, watchedEpisodes: 0, coverImage: m.coverImage ?? null,
      anilistId: m.anilistId })),
    ...ovas.map((m) => ({ number: ++ovaN, format: m.format, title: m.title,
      totalEpisodes: m.totalEpisodes, watchedEpisodes: 0, coverImage: m.coverImage ?? null,
      anilistId: m.anilistId })),
    ...movies.map((m) => ({ number: ++movieN, format: m.format, title: m.title,
      totalEpisodes: m.totalEpisodes, watchedEpisodes: 0, coverImage: m.coverImage ?? null,
      anilistId: m.anilistId })),
  ];

  const anilistIds = tvOnlyChain.map((m) => m.anilistId);
  return { seasons, anilistIds };
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

export async function fetchAniListSeasonData(anilistId) {
  const q = `query ($id: Int) {
    Media(id: $id) {
      idMal
      episodes
      nextAiringEpisode { episode }
    }
  }`;
  try {
    const j = await anilistQuery(q, { id: anilistId });
    const m = j.data?.Media;
    if (!m) return { malId: null, totalEpisodes: null };
    return {
      malId:         m.idMal ?? null,
      totalEpisodes: m.episodes ?? (m.nextAiringEpisode?.episode != null
        ? m.nextAiringEpisode.episode - 1
        : null),
    };
  } catch {
    return { malId: null, totalEpisodes: null };
  }
}

// ── File d'attente Jikan ─────────────────────────────────────────────────────
let _jikanChain = Promise.resolve();

function jikanFetch(url) {
  const request = _jikanChain.then(async () => {
    const res = await fetch(url);
    await new Promise((r) => setTimeout(r, 500));
    return res;
  });
  _jikanChain = request.then(() => {}).catch(() => {});
  return request;
}

async function fetchJikanEpisodes(malId) {
  const eps = []; let page = 1, hasNext = true;
  while (hasNext && page <= 10) {
    try {
      const res = await jikanFetch(`https://api.jikan.moe/v4/anime/${malId}/episodes?page=${page}`);
      if (res.status === 429) { await new Promise((r) => setTimeout(r, 2000)); continue; }
      if (!res.ok) break;
      const j = await res.json();
      (j.data || []).forEach((e) => eps.push({ number: e.mal_id, name: e.title || e.title_romanji || null }));
      hasNext = Boolean(j.pagination?.has_next_page); page++;
    } catch { break; }
  }
  return eps;
}

async function fetchAniListIdMal(id) {
  const q = `query ($id: Int) { Media(id: $id) { idMal } }`;
  const j = await anilistQuery(q, { id }); return j.data?.Media?.idMal ?? null;
}

export async function fetchAniListEpisodesBySeasonId(anilistId) {
  try {
    const malId = await fetchAniListIdMal(anilistId);
    if (malId) { const e = await fetchJikanEpisodes(malId); if (e.length) return e; }
  } catch {}
  return [];
}

export async function fetchAniListDescription(anilistId) {
  const q = `query ($id: Int) { Media(id: $id) { description(asHtml: false) } }`;
  try { const j = await anilistQuery(q, { id: anilistId }); return j.data?.Media?.description?.trim() || null; }
  catch { return null; }
}

export async function fetchNextAiringAniList(anilistId) {
  const q = `query ($id: Int) { Media(id: $id, type: ANIME) { nextAiringEpisode { airingAt episode } } }`;
  try {
    const j = await anilistQuery(q, { id: anilistId }); const n = j.data?.Media?.nextAiringEpisode;
    return n ? { episode: n.episode, airingAt: n.airingAt * 1000 } : null;
  } catch { return null; }
}

function getWeekBounds(o = 0) {
  const now = new Date(), dow = now.getDay(), toMon = dow === 0 ? -6 : 1 - dow;
  const mon = new Date(now); mon.setDate(now.getDate() + toMon + o * 7); mon.setHours(0,0,0,0);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 7); sun.setHours(0,0,0,0);
  return { start: Math.floor(mon.getTime()/1000), end: Math.floor(sun.getTime()/1000), monday: mon };
}

const FR_SITES = new Set(["ADN","Wakanim","Anime Digital Network"]);
const FR_URLS  = ["animedigitalnetwork.fr","wakanim.tv/fr","adn."];

export function hasFrenchVersion(media) {
  return (media.externalLinks||[]).some((l) =>
    FR_SITES.has(l.site) || (l.language==="French"||l.language==="fr") ||
    (l.url && FR_URLS.some((p)=>l.url.includes(p))));
}

export async function fetchWeeklySchedule(o = 0) {
  const { start, end, monday } = getWeekBounds(o);
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
            relations { edges { relationType node { type } } }
          }
        }
      }
    }
  `;
  const all = []; let page = 1, hasNext = true;
  while (hasNext && page <= 6) {
    let res;
    try {
      res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: q, variables: { start, end, page } }),
      });
    } catch { throw new Error("Impossible de joindre AniList. Vérifie ta connexion."); }
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 2500)); continue; }
    if (!res.ok) throw new Error(`AniList a répondu avec une erreur (${res.status}).`);
    const j = await res.json();
    if (j.errors?.length) throw new Error(j.errors[0].message || "Erreur GraphQL AniList.");
    const pd = j.data?.Page; if (!pd) break;
    all.push(...(pd.airingSchedules || []).filter((s) => {
      if (s.media?.isAdult) return false;
      const co = s.media?.countryOfOrigin; return !co || co === "JP";
    }));
    hasNext = pd.pageInfo?.hasNextPage; page++;
  }
  return { schedules: all, monday };
}

export function isReturningSeries(media) {
  return (media.relations?.edges||[]).some(
    (e) => e.relationType==="PREQUEL" && e.node?.type==="ANIME");
}