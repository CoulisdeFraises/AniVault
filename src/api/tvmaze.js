export async function searchTVMaze(q) {
  const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error("tvmaze error");
  const json = await res.json();
  return json.slice(0, 6).map((r) => ({
    source: "tvmaze",
    id: r.show.id,
    title: r.show.name,
    year: r.show.premiered ? r.show.premiered.slice(0, 4) : null,
    image: r.show.image?.medium,
    genres: r.show.genres || [],
  }));
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