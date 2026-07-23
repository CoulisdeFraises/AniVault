async function anilistQuery(query, variables) {
  const res = await fetch("https://graphql.anilist.co", {
    method:  "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body:    JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error("anilist error");
  return res.json();
}

// Récupère des recommandations AniList basées sur les genres fournis
// et exclut les IDs déjà dans la bibliothèque
export async function fetchAniListRecommendations(genres = [], excludeAnilistIds = []) {
  if (!genres.length) return [];

  const query = `
    query ($genres: [String], $page: Int) {
      Page(page: $page, perPage: 20) {
        media(
          genre_in: $genres
          type: ANIME
          sort: POPULARITY_DESC
          status_in: [FINISHED, RELEASING]
          format_in: [TV, TV_SHORT]
        ) {
          id
          title { english romaji }
          coverImage { large }
          genres
          episodes
          description(asHtml: false)
          seasonYear
          averageScore
        }
      }
    }
  `;

  try {
    const json = await anilistQuery(query, { genres, page: 1 });
    const media = json.data?.Page?.media || [];
    return media
      .filter((m) => !excludeAnilistIds.includes(m.id))
      .slice(0, 12)
      .map((m) => ({
        source:      "anilist",
        id:          m.id,
        title:       m.title.english || m.title.romaji,
        image:       m.coverImage?.large,
        genres:      m.genres || [],
        episodes:    m.episodes,
        year:        m.seasonYear,
        score:       m.averageScore,
        description: m.description,
      }));
  } catch {
    return [];
  }
}