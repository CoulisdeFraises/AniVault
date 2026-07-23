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
  const json = await anilistQuery(query, { search: q });
  const media = json.data?.Page?.media || [];
  return media.slice(0, 6).map((m) => ({
    source: "anilist",
    id: m.id,
    title: m.title.english || m.title.romaji,
    year: m.seasonYear,
    image: m.coverImage?.large,
    episodes: m.episodes,
    genres: m.genres || [],
  }));
}

export async function fetchAniListAllSeasons(startId) {
  async function findRoot(id, visited = new Set()) {
    if (visited.has(id)) return id;
    visited.add(id);
    const query = `query ($id: Int) { Media(id: $id, type: ANIME) { id relations { edges { relationType node { id type } } } } }`;
    try {
      const json = await anilistQuery(query, { id });
      const prequel = json.data?.Media?.relations?.edges?.find(
        (e) => e.relationType === "PREQUEL" && e.node.type === "ANIME"
      );
      return prequel ? findRoot(prequel.node.id, visited) : id;
    } catch {
      return id;
    }
  }

  async function followSequels(id, visited = new Set()) {
    if (!id || visited.has(id)) return [];
    visited.add(id);
    const query = `query ($id: Int) { Media(id: $id, type: ANIME) { id episodes nextAiringEpisode { episode } coverImage { large } relations { edges { relationType node { id type } } } } }`;
    let json;
    try {
      json = await anilistQuery(query, { id });
    } catch {
      return [];
    }
    const media = json.data?.Media;
    if (!media) return [];
    const sequel = media.relations?.edges?.find(
      (e) => e.relationType === "SEQUEL" && e.node.type === "ANIME"
    );
    const rest = await followSequels(sequel?.node?.id ?? null, visited);
    const totalEpisodes =
      media.episodes ??
      (media.nextAiringEpisode?.episode != null
        ? media.nextAiringEpisode.episode - 1
        : null);
    return [
      {
        anilistId: id,
        totalEpisodes,
        watchedEpisodes: 0,
        coverImage: media.coverImage?.large ?? null,
      },
      ...rest,
    ];
  }

  const rootId = await findRoot(startId);
  const raw = await followSequels(rootId);
  return {
    seasons: raw.map((s, i) => ({
      number: i + 1,
      totalEpisodes: s.totalEpisodes,
      watchedEpisodes: 0,
      coverImage: s.coverImage ?? null,
    })),
    anilistIds: raw.map((s) => s.anilistId),
  };
}

export async function fetchAniListNextSeason(rootId, currentSeasonCount) {
  const visited = new Set();
  const allEntries = [];
  let currentId = rootId;

  while (
    currentId &&
    !visited.has(currentId) &&
    allEntries.length <= currentSeasonCount
  ) {
    visited.add(currentId);
    const query = `query ($id: Int) { Media(id: $id, type: ANIME) { id episodes coverImage { large } relations { edges { relationType node { id type } } } } }`;
    let json;
    try {
      json = await anilistQuery(query, { id: currentId });
    } catch {
      break;
    }
    const media = json.data?.Media;
    if (!media) break;
    allEntries.push({
      id: currentId,
      episodes: media.episodes ?? null,
      coverImage: media.coverImage?.large ?? null,
    });
    const sequel = (media.relations?.edges || []).find(
      (e) => e.relationType === "SEQUEL" && e.node.type === "ANIME"
    );
    if (!sequel) break;
    currentId = sequel.node.id;
  }

  const next = allEntries[currentSeasonCount];
  return next
    ? { id: next.id, episodes: next.episodes ?? null, coverImage: next.coverImage ?? null }
    : null;
}

export async function fetchAniListEpisodeTotal(anilistId) {
  const query = `query ($id: Int) { Media(id: $id) { episodes nextAiringEpisode { episode } } }`;
  try {
    const json = await anilistQuery(query, { id: anilistId });
    const media = json.data?.Media;
    // episodes = total confirmé (séries terminées)
    // nextAiringEpisode.episode - 1 = nombre d'épisodes déjà diffusés (en cours)
    return (
      media?.episodes ??
      (media?.nextAiringEpisode?.episode != null
        ? media.nextAiringEpisode.episode - 1
        : null)
    );
  } catch {
    return null;
  }
}

// ── MAL ID (pont AniList → Jikan) ────────────────────────────────────────────
async function fetchAniListIdMal(anilistId) {
  const query = `query ($id: Int) { Media(id: $id) { idMal } }`;
  const json = await anilistQuery(query, { id: anilistId });
  return json.data?.Media?.idMal ?? null;
}

// ── Épisodes depuis Jikan (MyAnimeList) ──────────────────────────────────────
// - Numérotation exacte via e.mal_id (pas l'index positionnel)
// - Gestion du rate-limit 429 : retry automatique après 1s
// - Délai de 350ms entre pages pour rester sous les 3 req/s
// - Max 10 pages (~250 épisodes) : couvre 99% des animes.
//   Pour les très longues séries (One Piece…), le reste s'affiche en "Épisode N".
async function fetchJikanEpisodes(malId) {
  const episodes = [];
  let page = 1;
  let hasNext = true;
  const MAX_PAGES = 10;

  while (hasNext && page <= MAX_PAGES) {
    try {
      const res = await fetch(
        `https://api.jikan.moe/v4/anime/${malId}/episodes?page=${page}`
      );

      // Rate-limit : on attend 1s et on retente la même page
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      if (!res.ok) break;

      const json = await res.json();
      (json.data || []).forEach((e) =>
        episodes.push({
          number: e.mal_id,                          // vrai numéro MAL
          name:   e.title || e.title_romanji || null, // nom propre, sans préfixe
        })
      );

      hasNext = Boolean(json.pagination?.has_next_page);
      page++;

      // Délai inter-pages pour respecter le rate-limit Jikan
      if (hasNext) await new Promise((r) => setTimeout(r, 350));
    } catch {
      break;
    }
  }

  return episodes;
}

// ── Épisodes d'une saison (par ID AniList) ────────────────────────────────────
// Jikan est la seule source utilisée : numéros et noms fiables.
// fetchAniListStreamingEpisodes supprimé : numérotation positionnelle incorrecte
// et titres mal formatés ("Episode N - Titre").
export async function fetchAniListEpisodesBySeasonId(anilistId) {
  try {
    const malId = await fetchAniListIdMal(anilistId);
    if (malId) {
      const episodes = await fetchJikanEpisodes(malId);
      if (episodes.length) return episodes;
    }
  } catch {}
  return [];
}

export async function fetchAniListDescription(anilistId) {
  const query = `query ($id: Int) { Media(id: $id) { description(asHtml: false) } }`;
  try {
    const json = await anilistQuery(query, { id: anilistId });
    return json.data?.Media?.description?.trim() || null;
  } catch {
    return null;
  }
}

export async function fetchNextAiringAniList(anilistId) {
  const query = `query ($id: Int) { Media(id: $id, type: ANIME) { nextAiringEpisode { airingAt episode } } }`;
  try {
    const json = await anilistQuery(query, { id: anilistId });
    const nae = json.data?.Media?.nextAiringEpisode;
    return nae ? { episode: nae.episode, airingAt: nae.airingAt * 1000 } : null;
  } catch {
    return null;
  }
}

function getWeekBounds(offsetWeeks = 0) {
  const now   = new Date();
  const dow   = now.getDay();
  const toMon = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(now);
  monday.setDate(now.getDate() + toMon + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 7);
  sunday.setHours(0, 0, 0, 0);

  return {
    start:  Math.floor(monday.getTime() / 1000),
    end:    Math.floor(sunday.getTime()  / 1000),
    monday,
  };
}

const FR_ONLY_SITES    = new Set(["ADN", "Wakanim", "Anime Digital Network"]);
const FR_URL_PATTERNS  = ["animedigitalnetwork.fr", "wakanim.tv/fr", "adn."];

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

  const query = `
    query ($start: Int, $end: Int, $page: Int) {
      Page(page: $page, perPage: 50) {
        pageInfo { hasNextPage }
        airingSchedules(
          airingAt_greater: $start
          airingAt_lesser:  $end
          sort: TIME
        ) {
          id
          airingAt
          episode
          media {
            id
            idMal
            title { romaji english }
            description(asHtml: false)
            coverImage { medium large }
            externalLinks { site language type url }
            countryOfOrigin
            isAdult
            format
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
    const res = await fetch("https://graphql.anilist.co", {
      method:  "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body:    JSON.stringify({ query, variables: { start, end, page } }),
    });
    if (!res.ok) break;
    const json     = await res.json();
    const pageData = json.data?.Page;
    if (!pageData) break;

    all.push(
      ...(pageData.airingSchedules || []).filter(
        (s) => !s.media?.isAdult && s.media?.countryOfOrigin === "JP"
      )
    );

    hasNext = pageData.pageInfo?.hasNextPage;
    page++;
  }

  return { schedules: all, monday };
}

export function isReturningSeries(media) {
  return (media.relations?.edges || []).some(
    (e) => e.relationType === "PREQUEL" && e.node?.type === "ANIME"
  );
}