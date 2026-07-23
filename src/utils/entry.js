export const emptyForm = {
  title: "", type: "anime", category: "tv", genres: [], status: "a-voir",
  seasons: [{ number: 1, format: "TV", totalEpisodes: null, watchedEpisodes: 0 }],
  rating: 0, notes: "", coverImage: null,
  source: null, anilistIds: [], tvmazeId: null, tmdbId: null, description: null,
};

export const FORMAT_TO_CATEGORY = {
  TV: "tv", TV_SHORT: "tv", MOVIE: "movie",
  OVA: "ova", ONA: "ova", SPECIAL: "ova", MUSIC: "ova",
};

export const CATEGORY_LABELS = { tv: "Série principale", ova: "OAV", movie: "Film" };
export const CATEGORY_ICONS  = { tv: "📺", ova: "📼", movie: "🎬" };
