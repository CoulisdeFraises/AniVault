import { fuzzyRank, buildFallbackQueries, mergeById } from "../utils/fuzzy";
import { withCache } from "../services/cache";

const SCHEDULE_CACHE_TTL = 3 * 60 * 60 * 1000; // 3 heures

// Plateformes/chaînes principales — le planning brut TVmaze (réseau US + web)
// remonte énormément de chaînes locales et de petits services de streaming
// obscurs. On limite donc aux diffuseurs qu'on suit réellement, en France
// comme aux US (comparaison insensible à la casse/accents).
const MAJOR_PLATFORMS = new Set([
  // Streaming SVOD
  "netflix", "disney+", "disney plus", "amazon", "prime video", "amazon prime video",
  "apple tv+", "apple tv plus", "hbo", "hbo max", "max", "paramount+", "paramount plus",
  "peacock", "hulu", "crunchyroll",
  // Chaînes FR
  "canal+", "canal +", "mycanal", "ocs", "arte", "tf1", "france 2", "france 3", "m6",
  // Networks US majeurs
  "abc", "nbc", "cbs", "fox", "the cw", "cw", "amc", "fx", "starz", "showtime",
]);

function normalizePlatform(name) {
  return (name || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // retire les accents
}

function isMajorPlatform(name) {
  return MAJOR_PLATFORMS.has(normalizePlatform(name));
}

function stripHtml(html) { return (html || "").replace(/<[^>]*>/g, "").trim(); }

export async function searchTVMaze(q) {
  async function rawSearch(term) {
    const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(term)}`);
    if (!res.ok) throw new Error("tvmaze error");
    const json = await res.json();
    return json.map((r) => ({
      source: "tvmaze",
      id: r.show.id,
      title: r.show.name,
      year: r.show.premiered ? r.show.premiered.slice(0, 4) : null,
      image: r.show.image?.medium,
      genres: r.show.genres || [],
    }));
  }

  let results = await rawSearch(q);

  // TVmaze coupe vite en cas de faute de frappe (recherche assez littérale) :
  // on élargit avec des variantes de la requête si le premier essai est pauvre.
  if (results.length < 3) {
    for (const fallback of buildFallbackQueries(q)) {
      try {
        results = mergeById(results, await rawSearch(fallback));
      } catch { /* on garde ce qu'on a déjà */ }
    }
  }

  return fuzzyRank(results, q, (r) => r.title, { limit: 8 });
}

export async function fetchTVMazeSeasons(id) {
  const [epsRes, seasonsRes] = await Promise.all([
    fetch(`https://api.tvmaze.com/shows/${id}?embed=episodes`),
    fetch(`https://api.tvmaze.com/shows/${id}/seasons`),
  ]);
  if (!epsRes.ok) throw new Error("tvmaze detail error");
  const epsJson = await epsRes.json();
  const eps = epsJson._embedded?.episodes || [];
  const seasonImages = {};
  if (seasonsRes.ok) {
    const seasonsJson = await seasonsRes.json();
    seasonsJson.forEach((s) => { seasonImages[s.number] = s.image?.medium ?? null; });
  }
  const bySeason = {};
  eps.forEach((e) => { if (e.season > 0) bySeason[e.season] = (bySeason[e.season] || 0) + 1; });
  const numbers = Object.keys(bySeason).map(Number).sort((a, b) => a - b);
  return numbers.map((n) => ({ number: n, totalEpisodes: bySeason[n], watchedEpisodes: 0, coverImage: seasonImages[n] ?? null }));
}

export async function fetchTVMazeEpisodesBySeason(tvmazeId) {
  const res = await fetch(`https://api.tvmaze.com/shows/${tvmazeId}/episodes`);
  if (!res.ok) return {};
  const eps = await res.json();
  const bySeason = {};
  eps.forEach((e) => {
    if (!bySeason[e.season]) bySeason[e.season] = [];
    bySeason[e.season].push({ number: e.number, name: e.name });
  });
  return bySeason;
}

export async function fetchTVMazeSeasonTotal(tvmazeId, seasonNumber) {
  const res = await fetch(`https://api.tvmaze.com/shows/${tvmazeId}/seasons`);
  if (!res.ok) return null;
  const seasons = await res.json();
  const match = seasons.find((s) => s.number === seasonNumber);
  return match?.episodeCount ?? null;
}

export async function fetchTVMazeNextSeason(tvmazeId, seasonNum) {
  const res = await fetch(`https://api.tvmaze.com/shows/${tvmazeId}/seasons`);
  if (!res.ok) return null;
  const seasons = await res.json();
  const season = seasons.find((s) => s.number === seasonNum);
  return season ? { episodeCount: season.episodeCount ?? null, coverImage: season.image?.medium ?? null } : null;
}

export async function fetchTVMazeDescription(tvmazeId) {
  try {
    const res = await fetch(`https://api.tvmaze.com/shows/${tvmazeId}`);
    if (!res.ok) return null;
    const json = await res.json();
    return (json.summary || "").replace(/<[^>]*>/g, "").trim() || null;
  } catch {
    return null;
  }
}

// ── Épisodes diffusés dans une plage de dates ─────────────────────────────────
// Utilisé par le calendrier de sorties (onglet Séries) : contrairement à
// fetchNextAiringTVMaze (un seul épisode, le tout prochain), renvoie TOUS les
// épisodes de la série dont la diffusion tombe dans [startMs, endMs) — utile
// pour les séries qui diffusent plusieurs épisodes par semaine.
export async function fetchTVMazeEpisodesInRange(tvmazeId, startMs, endMs) {
  try {
    const res = await fetch(`https://api.tvmaze.com/shows/${tvmazeId}?embed=episodes`);
    if (!res.ok) return [];
    const json = await res.json();
    const eps = json._embedded?.episodes || [];
    return eps
      .filter((e) => e.airstamp)
      .map((e) => ({ season: e.season, episode: e.number, name: e.name || null, airingAt: new Date(e.airstamp).getTime() }))
      .filter((e) => e.airingAt >= startMs && e.airingAt < endMs);
  } catch {
    return [];
  }
}

// ── Planning de diffusion global — pour le calendrier de sorties ─────────────
// Contrairement à fetchTVMazeEpisodesInRange (scopé à une série précise de la
// bibliothèque), ceci interroge le planning TV global de TVmaze, indépendamment
// de la bibliothèque de l'utilisateur — équivalent, pour les séries, du flux
// global AniList utilisé par l'onglet Animes.
//
// NB : `country=FR` seul est bien trop pauvre chez TVmaze (couverture très
// partielle des diffusions françaises) — on combine donc le planning réseau
// US (le plus complet chez TVmaze, référence pour la date de diffusion
// officielle) et le planning streaming/web (Netflix, Prime, Disney+…, sans
// notion de pays), qui à eux deux couvrent la quasi-totalité des séries
// suivies dans l'app. Filtré aux séries "Scripted" (fiction) pour exclure
// JT, talk-shows, jeux…
export async function fetchTVMazeScheduleForDate(dateStr) {
  return withCache(`tvmaze:schedule:v2:${dateStr}`, SCHEDULE_CACHE_TTL, async () => {
    function mapItem(e, show) {
      return {
        tvmazeId:    show.id,
        title:       show.name,
        image:       show.image?.medium || show.image?.original || null,
        genres:      show.genres || [],
        season:      e.season,
        episode:     e.number,
        episodeName: e.name || null,
        summary:     stripHtml(e.summary || show.summary),
        airingAt:    new Date(e.airstamp).getTime(),
        network:     show.network?.name || show.webChannel?.name || null,
      };
    }

    try {
      const [networkRes, webRes] = await Promise.all([
        fetch(`https://api.tvmaze.com/schedule?country=US&date=${dateStr}`),
        fetch(`https://api.tvmaze.com/schedule/web?date=${dateStr}`),
      ]);
      const networkJson = networkRes.ok ? await networkRes.json() : [];
      const webJson     = webRes.ok    ? await webRes.json()     : [];

      const network = networkJson
        .filter((e) => e.show?.type === "Scripted" && e.airstamp && e.number != null)
        .map((e) => mapItem(e, e.show))
        .filter((item) => isMajorPlatform(item.network));

      const web = webJson
        .filter((e) => e._embedded?.show?.type === "Scripted" && e.airstamp && e.number != null)
        .map((e) => mapItem(e, e._embedded.show))
        .filter((item) => isMajorPlatform(item.network));

      // Un même épisode peut apparaître dans les deux flux (diffusion + rattrapage web) → dédoublonnage
      const seen = new Set();
      return [...network, ...web].filter((item) => {
        const k = `${item.tvmazeId}-${item.season}-${item.episode}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    } catch {
      return [];
    }
  });
}

export async function fetchNextAiringTVMaze(tvmazeId) {
  try {
    const res = await fetch(`https://api.tvmaze.com/shows/${tvmazeId}?embed=nextepisode`);
    if (!res.ok) return null;
    const json = await res.json();
    const next = json._embedded?.nextepisode;
    if (!next || !next.airstamp) return null;
    return { episode: next.number, season: next.season, airingAt: new Date(next.airstamp).getTime() };
  } catch {
    return null;
  }
}