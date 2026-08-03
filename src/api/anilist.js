import { cacheGet, cacheSet } from "../services/cache";
import { getMediaDetails } from "./media";

const ANILIST_QUERY_TTL = 10 * 60 * 1000; // 10 min — assez pour éviter les doublons dans une session, sans figer les données trop longtemps

// Petit hash stable (djb2) pour garder des clés de cache compactes
function hashKey(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

async function anilistFetch(query, variables, attempt = 0) {
  let res;
  try {
    res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new Error("Impossible de joindre AniList. Vérifie ta connexion.");
  }
  if (res.status === 429) {
    if (attempt >= 4) throw new Error("AniList est temporairement saturé. Réessaie dans quelques instants.");
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    return anilistFetch(query, variables, attempt + 1);
  }
  if (!res.ok) throw new Error(`AniList a répondu avec une erreur (${res.status}).`);
  const j = await res.json();
  if (j.errors?.length) throw new Error(j.errors[0].message || "Erreur GraphQL AniList.");
  return j;
}

/**
 * anilistQuery — point d'entrée unique pour toutes les requêtes AniList de l'app.
 *
 * Ajoute un cache partagé (mémoire + localStorage, via services/cache.js) par
 * couple (query, variables) : deux appels identiques dans la fenêtre de TTL
 * ne déclenchent qu'une seule requête réseau. Utile car un même titre est
 * souvent refetché depuis plusieurs endroits (chaîne de saisons, extras,
 * recommandations similaires…) au cours d'une même session.
 *
 * N'est jamais mis en cache en cas d'erreur : le prochain appel retentera.
 */
export async function anilistQuery(query, variables) {
  const key = "anilist_q_" + hashKey(query + JSON.stringify(variables || {}));
  const cached = cacheGet(key, ANILIST_QUERY_TTL);
  if (cached !== undefined) return cached;
  const json = await anilistFetch(query, variables);
  cacheSet(key, json);
  return json;
}

export async function searchAniList(q) {
  const cultureMode = localStorage.getItem("pref_culture_mode") === "true";
  const query = `query ($search: String) { Page(perPage: 20) { media(search: $search, type: ANIME, sort: POPULARITY_DESC) { id title { romaji english } episodes genres coverImage { large } seasonYear format relations { edges { relationType node { id type } } } } } }`;
  const json  = await anilistQuery(query, { search: q });
  return (json.data?.Page?.media || [])
    .filter(m => cultureMode || !m.genres?.includes("Hentai"))
    .slice(0, 6)
    .map((m) => ({ source: "anilist", id: m.id, title: m.title.english || m.title.romaji,
      titleRomaji: m.title.romaji || null, titleEnglish: m.title.english || null,
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
export async function fetchAniListFranchise(startId, { force = false } = {}) {
  const NON_TV     = new Set(["OVA", "ONA", "MOVIE", "SPECIAL", "MUSIC"]);
  const TV_FORMATS = new Set(["TV", "TV_SHORT"]);

  // Relations valides pour rattacher un extra (OVA/Film/Spécial) à la franchise.
  // SPIN_OFF, ALTERNATIVE_SETTING, ALTERNATIVE volontairement exclus :
  // ils désignent des œuvres DISTINCTES, pas des contenus annexes du même titre.
  const EXTRAS_REL = new Set(["SIDE_STORY", "OTHER", "SUMMARY", "PREQUEL", "SEQUEL"]);

  const MAX_EXTRAS = 30; // réduit pour éviter les graphes trop larges

  // Les lookups par ID passent maintenant par la fonction Edge Supabase
  // (cache "catalogue" partagé entre tous les utilisateurs). `force` — réservé
  // au bouton "Actualiser" — court-circuite le TTL pour garantir une donnée
  // vraiment fraîche plutôt qu'une version en cache jusqu'à 6-24h.
  // getMediaDetails lève une erreur en cas d'échec réel (429, réseau…) —
  // elle n'est jamais avalée ici, pour ne pas reproduire le bug de saisons
  // silencieusement vidées qu'on a corrigé plus tôt.
  async function fetchMedia(id) {
    return getMediaDetails("anilist", id, { force });
  }

  function parseEps(m) {
    const explicit   = m.episodes ?? null;
    const fromAiring = m.nextAiringEpisode?.episode != null
      ? m.nextAiringEpisode.episode - 1   // épisodes déjà diffusés = prochain - 1
      : null;
    // Tant que la série est EN COURS de diffusion, le nombre d'épisodes
    // réellement disponibles est celui déjà diffusé — jamais le total annoncé
    // à l'avance (ex : AniList sait déjà que la saison fera 12 épisodes, mais
    // seuls 5 sont sortis pour l'instant : il faut afficher 5, pas 12).
    // Une fois la série terminée (ou tout autre statut sans diffusion active),
    // le total explicite d'AniList est fiable et définitif.
    if (m.status === "RELEASING") return fromAiring ?? explicit ?? null;
    return explicit ?? fromAiring ?? null;
  }
  function parseTitle(m) { return m.title?.english || m.title?.romaji || null; }
  function isTVFormat(fmt) { return fmt == null || TV_FORMATS.has(fmt); }

  async function findRoot(id, visited = new Set()) {
    if (visited.has(id)) return id; visited.add(id);
    try {
      const m = await fetchMedia(id);
      const prequel = m.relations?.edges?.find(
        (e) => e.relationType === "PREQUEL" && e.node.type === "ANIME" && isTVFormat(e.node.format)
      );
      return prequel ? findRoot(prequel.node.id, visited) : id;
    } catch { return id; }
  }

  async function followTVChain(id, visited = new Set()) {
    if (!id || visited.has(id)) return []; visited.add(id);
    const m = await fetchMedia(id); // laisse remonter les erreurs (429, réseau…)
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
    const m = await fetchMedia(id); // laisse remonter les erreurs (429, réseau…)
    extrasMap.set(id, {
      anilistId: id, format: m.format ?? formatHint, title: parseTitle(m),
      totalEpisodes: parseEps(m), coverImage: m.coverImage?.large ?? null,
    });
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

  let anilistIds = tvOnlyChain.map((m) => m.anilistId);

  // ── Fallback ONA/OVA/MOVIE ────────────────────────────────────────────────
  // Si la traversal TV n'a rien produit (ex: anime au format ONA standalone),
  // on inclut l'ID de départ directement comme saison unique plutôt que de
  // retourner un objet vide qui ferait croire à une "source non reconnue".
  // fetchMedia(startId) est déjà en cache (appelé dans findRoot) → pas de
  // requête réseau supplémentaire.
  if (seasons.length === 0) {
    try {
      const m   = await fetchMedia(startId);
      const fmt = m.format ?? "ONA";
      seasons.push({
        number:        1,
        format:        fmt,
        title:         parseTitle(m),
        totalEpisodes: parseEps(m),
        watchedEpisodes: 0,
        coverImage:    m.coverImage?.large ?? null,
        anilistId:     startId,
      });
      anilistIds = [startId];
    } catch { /* réseau indisponible — on retourne ce qu'on a */ }
  }
  return { seasons, anilistIds };
}

export async function fetchAniListNextSeason(rootId, currentSeasonCount) {
  const v = new Set(); const all = []; let cur = rootId;
  while (cur && !v.has(cur) && all.length <= currentSeasonCount) {
    v.add(cur);
    let m; try { m = await getMediaDetails("anilist", cur); } catch { break; }
    if (!m) break;
    all.push({ id: cur, episodes: m.episodes ?? null, coverImage: m.coverImage?.large ?? null });
    const seq = (m.relations?.edges || []).find((e) => e.relationType === "SEQUEL" && e.node.type === "ANIME");
    if (!seq) break; cur = seq.node.id;
  }
  const next = all[currentSeasonCount];
  return next ? { id: next.id, episodes: next.episodes ?? null, coverImage: next.coverImage ?? null } : null;
}

export async function fetchAniListSeasonData(anilistId) {
  try {
    const m = await getMediaDetails("anilist", anilistId);
    if (!m) return { malId: null, totalEpisodes: null };
    const fromAiring = m.nextAiringEpisode?.episode != null ? m.nextAiringEpisode.episode - 1 : null;
    // Tant que la diffusion est en cours, seul le nombre d'épisodes déjà
    // sortis compte — jamais le total annoncé à l'avance par AniList
    // (voir le même correctif dans fetchAniListFranchise/parseEps).
    const totalEpisodes = m.status === "RELEASING"
      ? (fromAiring ?? m.episodes ?? null)
      : (m.episodes ?? fromAiring ?? null);
    return { malId: m.idMal ?? null, totalEpisodes };
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
  const m = await getMediaDetails("anilist", id);
  return m?.idMal ?? null;
}

export async function fetchAniListEpisodesBySeasonId(anilistId) {
  try {
    const malId = await fetchAniListIdMal(anilistId);
    if (malId) { const e = await fetchJikanEpisodes(malId); if (e.length) return e; }
  } catch {}
  return [];
}

export async function fetchAniListDescription(anilistId) {
  try {
    const m = await getMediaDetails("anilist", anilistId);
    return m?.description?.trim() || null;
  } catch { return null; }
}

export async function fetchNextAiringAniList(anilistId) {
  try {
    const m = await getMediaDetails("anilist", anilistId);
    const n = m?.nextAiringEpisode;
    return n ? { episode: n.episode, airingAt: n.airingAt * 1000 } : null;
  } catch { return null; }
}

const FR_SITES = new Set(["ADN","Wakanim","Anime Digital Network"]);
const FR_URLS  = ["animedigitalnetwork.fr","wakanim.tv/fr","adn."];

export function hasFrenchVersion(media) {
  return (media.externalLinks||[]).some((l) =>
    FR_SITES.has(l.site) || (l.language==="French"||l.language==="fr") ||
    (l.url && FR_URLS.some((p)=>l.url.includes(p))));
}

export async function fetchWeeklySchedule(o = 0, { force = false } = {}) {
  const qs = new URLSearchParams({ mode: "schedule", offset: String(o) });
  if (force) qs.set("force", "1");

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smooth-task?${qs.toString()}`;
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("Impossible de joindre le service AniVault. Vérifie ta connexion.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Erreur HTTP: ${response.status}`);
  }
  const data = await response.json();
  return { schedules: data.schedules || [], monday: new Date(data.monday) };
}

export function isReturningSeries(media) {
  return (media.relations?.edges||[]).some(
    (e) => e.relationType==="PREQUEL" && e.node?.type==="ANIME");
}