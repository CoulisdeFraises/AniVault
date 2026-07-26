export const GENRE_SUGGESTIONS = ["Action", "Aventure", "Comédie", "Drame", "Fantasy", "Romance", "Thriller", "Horreur", "Sci-Fi", "Slice of Life", "Mystère", "Sport"];

const GENRE_TRANSLATIONS = {
  "Action": "Action",
  "Adventure": "Aventure",
  "Comedy": "Comédie",
  "Drama": "Drame",
  "Fantasy": "Fantasy",
  "Romance": "Romance",
  "Thriller": "Thriller",
  "Horror": "Horreur",
  "Science Fiction": "Sci-Fi",
  "Sci-Fi": "Sci-Fi",
  "Mystery": "Mystère",
  "Sports": "Sport",
  "Sport": "Sport",
  "Slice of Life": "Slice of Life",
  "Supernatural": "Surnaturel",
  "Psychological": "Psychologique",
  "Mecha": "Mecha",
  "Music": "Musique",
  "Historical": "Historique",
  "Military": "Militaire",
  "School": "École",
  "Isekai": "Isekai",
  "Parody": "Parodie",
  "Samurai": "Samouraï",
  "Space": "Espace",
  "Super Power": "Super-Pouvoirs",
  "Vampire": "Vampire",
  "Demons": "Démons",
  "Magic": "Magie",
  "Martial Arts": "Arts Martiaux",
  "Harem": "Harem",
  "Police": "Police",
  "Crime": "Crime",
  "War & Politics": "Guerre & Politique",
  "War": "Guerre",
  "Politics": "Politique",
  "Western": "Western",
  "Family": "Famille",
  "Documentary": "Documentaire",
  "Animation": "Animation",
  "Cooking": "Cuisine",
  "Food": "Gastronomie",
  "Survival": "Survie",
  "Tragedy": "Tragédie",
  "Cyberpunk": "Cyberpunk",
  "Steampunk": "Steampunk",
  "Time Travel": "Voyage temporel",
  "Post-Apocalyptic": "Post-Apocalyptique",
  "Kids": "Enfants",
  "Shounen": "Shōnen",
  "Shoujo": "Shōjo",
  "Seinen": "Seinen",
  "Josei": "Josei",
};

// ── Mapping inverse : Français → Anglais ──────────────────────────────────────
// Construit automatiquement depuis GENRE_TRANSLATIONS.
// Utilisé pour renvoyer les genres en anglais aux APIs (AniList attend de l'anglais).
const GENRE_TRANSLATIONS_REVERSE = Object.fromEntries(
  Object.entries(GENRE_TRANSLATIONS).map(([en, fr]) => [fr, en])
);

/** Traduit des genres anglais en français pour l'affichage. */
export function translateGenres(genres) {
  return genres.map((g) => GENRE_TRANSLATIONS[g] || g);
}

/**
 * Reconvertit des genres stockés en français vers l'anglais,
 * pour les envoyer correctement aux APIs comme AniList.
 * Les genres déjà en anglais (ou sans traduction connue) sont retournés tels quels.
 */
export function toEnglishGenres(genres) {
  return genres.map((g) => GENRE_TRANSLATIONS_REVERSE[g] || g);
}