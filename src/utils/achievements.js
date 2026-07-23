// ── Helpers ───────────────────────────────────────────────────────────────────
const totalEps = (entries) =>
  entries.reduce(
    (sum, e) => sum + e.seasons.reduce((s2, s) => s2 + (s.watchedEpisodes || 0), 0),
    0
  );

const finishedCount = (entries) =>
  entries.filter((e) => e.status === "termine").length;

const ratedCount = (entries) =>
  entries.filter((e) => e.rating > 0).length;

const abandonedCount = (entries) =>
  entries.filter((e) => e.status === "abandonne").length;

/** Vérifie si au moins un épisode a été regardé entre minuit et 4h du matin */
const hasNightOwlEp = (entries) =>
  entries.some((e) =>
    (e.watchHistory || []).some((h) => {
      const hour = new Date(h.watchedAt).getHours();
      return hour >= 0 && hour < 4;
    })
  );

/** Nombre max d'épisodes regardés sur une seule journée (toutes entrées confondues) */
const maxEpsInOneDay = (entries) => {
  const counts = {};
  entries.forEach((e) =>
    (e.watchHistory || []).forEach((h) => {
      const day = new Date(h.watchedAt).toDateString();
      counts[day] = (counts[day] || 0) + 1;
    })
  );
  return Math.max(0, ...Object.values(counts));
};

/** Nombre de saisons distinctes dans toute la bibliothèque */
const totalSeasons = (entries) =>
  entries.reduce((sum, e) => sum + (e.seasons?.length || 0), 0);

/** Nombre max de saisons sur un même titre */
const maxSeasonsOnEntry = (entries) =>
  entries.reduce((max, e) => Math.max(max, e.seasons?.length || 0), 0);

// ── Catégories ────────────────────────────────────────────────────────────────
// Utilisées par l'UI pour grouper les succès en accordéon
export const ACHIEVEMENT_CATEGORIES = [
  { id: "library",   label: "Bibliothèque",      icon: "📚" },
  { id: "episodes",  label: "Épisodes",           icon: "🎬" },
  { id: "finished",  label: "Titres terminés",    icon: "🏆" },
  { id: "ratings",   label: "Notes & Avis",       icon: "⭐" },
  { id: "abandoned", label: "Abandons",           icon: "💔" },
  { id: "watching",  label: "En cours & Backlog", icon: "📺" },
  { id: "diversity", label: "Diversité",          icon: "🎭" },
  { id: "seasons",   label: "Saisons",            icon: "🗓️" },
  { id: "habits",    label: "Habitudes",          icon: "🦉" },
  { id: "special",   label: "Spéciaux",           icon: "🎲" },
];

// ── Définition des succès ─────────────────────────────────────────────────────
// tier : "bronze" | "silver" | "gold"
export const ACHIEVEMENTS = [

  // ── Bibliothèque ─────────────────────────────────────────────────────────
  {
    id: "first_title",
    category: "library",
    icon: "🎬",
    name: "Premier pas",
    description: "Ajouter ton premier titre",
    tier: "bronze",
    check: (e) => e.length >= 1,
  },
  {
    id: "library_10",
    category: "library",
    icon: "📚",
    name: "Bibliophile",
    description: "10 titres dans ta bibliothèque",
    tier: "silver",
    check: (e) => e.length >= 10,
  },
  {
    id: "library_25",
    category: "library",
    icon: "📖",
    name: "Collectionneur",
    description: "25 titres dans ta bibliothèque",
    tier: "gold",
    check: (e) => e.length >= 25,
  },
  {
    id: "library_50",
    category: "library",
    icon: "🏛️",
    name: "Archiviste",
    description: "50 titres dans ta bibliothèque",
    tier: "gold",
    check: (e) => e.length >= 50,
  },
  {
    id: "library_100",
    category: "library",
    icon: "🗂️",
    name: "Encyclopédiste",
    description: "100 titres dans ta bibliothèque",
    tier: "gold",
    check: (e) => e.length >= 100,
  },
  {
    id: "library_200",
    category: "library",
    icon: "🏰",
    name: "Seigneur des archives",
    description: "200 titres dans ta bibliothèque",
    tier: "gold",
    check: (e) => e.length >= 200,
  },

  // ── Épisodes ─────────────────────────────────────────────────────────────
  {
    id: "eps_100",
    category: "episodes",
    icon: "🎯",
    name: "Centurion",
    description: "100 épisodes visionnés",
    tier: "bronze",
    check: (e) => totalEps(e) >= 100,
  },
  {
    id: "eps_500",
    category: "episodes",
    icon: "🚀",
    name: "Marathon",
    description: "500 épisodes visionnés",
    tier: "silver",
    check: (e) => totalEps(e) >= 500,
  },
  {
    id: "eps_1000",
    category: "episodes",
    icon: "🔥",
    name: "Légende",
    description: "1 000 épisodes visionnés",
    tier: "gold",
    check: (e) => totalEps(e) >= 1000,
  },
  {
    id: "eps_2500",
    category: "episodes",
    icon: "🌌",
    name: "Transcendance",
    description: "2 500 épisodes visionnés",
    tier: "gold",
    check: (e) => totalEps(e) >= 2500,
  },
  {
    id: "eps_5000",
    category: "episodes",
    icon: "💀",
    name: "Tu n'as plus de vie",
    description: "5 000 épisodes visionnés — vraiment ?",
    tier: "gold",
    check: (e) => totalEps(e) >= 5000,
  },
  {
    id: "eps_10000",
    category: "episodes",
    icon: "👁️",
    name: "L'Éveillé",
    description: "10 000 épisodes visionnés. Tu es au-delà.",
    tier: "gold",
    check: (e) => totalEps(e) >= 10000,
  },
  {
    id: "binge_10",
    category: "episodes",
    icon: "🍿",
    name: "Soirée Netflix",
    description: "10 épisodes regardés en une seule journée",
    tier: "bronze",
    check: (e) => maxEpsInOneDay(e) >= 10,
  },
  {
    id: "binge_25",
    category: "episodes",
    icon: "🛋️",
    name: "Canapé world-class",
    description: "25 épisodes regardés en une seule journée",
    tier: "silver",
    check: (e) => maxEpsInOneDay(e) >= 25,
  },
  {
    id: "binge_50",
    category: "episodes",
    icon: "🚑",
    name: "Appelle un médecin",
    description: "50 épisodes regardés en une seule journée",
    tier: "gold",
    check: (e) => maxEpsInOneDay(e) >= 50,
  },

  // ── Titres terminés ───────────────────────────────────────────────────────
  {
    id: "first_finish",
    category: "finished",
    icon: "🏆",
    name: "Première victoire",
    description: "Terminer un titre",
    tier: "bronze",
    check: (e) => finishedCount(e) >= 1,
  },
  {
    id: "finish_5",
    category: "finished",
    icon: "💪",
    name: "Persévérant",
    description: "Terminer 5 titres",
    tier: "silver",
    check: (e) => finishedCount(e) >= 5,
  },
  {
    id: "finish_10",
    category: "finished",
    icon: "🌟",
    name: "Expert",
    description: "Terminer 10 titres",
    tier: "gold",
    check: (e) => finishedCount(e) >= 10,
  },
  {
    id: "finish_25",
    category: "finished",
    icon: "🎓",
    name: "Maître",
    description: "Terminer 25 titres",
    tier: "gold",
    check: (e) => finishedCount(e) >= 25,
  },
  {
    id: "finish_50",
    category: "finished",
    icon: "🧙",
    name: "Grand Maître",
    description: "Terminer 50 titres",
    tier: "gold",
    check: (e) => finishedCount(e) >= 50,
  },
  {
    id: "finish_100",
    category: "finished",
    icon: "👑",
    name: "Centurion du Finish",
    description: "Terminer 100 titres",
    tier: "gold",
    check: (e) => finishedCount(e) >= 100,
  },

  // ── Notes & Avis ──────────────────────────────────────────────────────────
  {
    id: "first_rating",
    category: "ratings",
    icon: "⭐",
    name: "Critique",
    description: "Noter un premier titre",
    tier: "bronze",
    check: (e) => e.some((x) => x.rating > 0),
  },
  {
    id: "rated_10",
    category: "ratings",
    icon: "🎖️",
    name: "Juré",
    description: "Noter 10 titres",
    tier: "silver",
    check: (e) => ratedCount(e) >= 10,
  },
  {
    id: "rated_25",
    category: "ratings",
    icon: "🏅",
    name: "Grand Critique",
    description: "Noter 25 titres",
    tier: "gold",
    check: (e) => ratedCount(e) >= 25,
  },
  {
    id: "rated_50",
    category: "ratings",
    icon: "📝",
    name: "Ebert",
    description: "Noter 50 titres",
    tier: "gold",
    check: (e) => ratedCount(e) >= 50,
  },
  {
    id: "perfect_score",
    category: "ratings",
    icon: "🤩",
    name: "Chef-d'œuvre",
    description: "Donner un 10/10 à un titre",
    tier: "gold",
    check: (e) => e.some((x) => x.rating === 10),
  },
  {
    id: "perfect_5",
    category: "ratings",
    icon: "✨",
    name: "Perfectionniste",
    description: "Donner un 10/10 à 5 titres",
    tier: "gold",
    check: (e) => e.filter((x) => x.rating === 10).length >= 5,
  },
  {
    id: "low_rater",
    category: "ratings",
    icon: "💩",
    name: "Difficile à satisfaire",
    description: "Donner un 1/10 à un titre",
    tier: "bronze",
    check: (e) => e.some((x) => x.rating === 1),
  },
  {
    id: "harsh_jury",
    category: "ratings",
    icon: "🔪",
    name: "Impitoyable",
    description: "Donner un 1/10 à 5 titres",
    tier: "silver",
    check: (e) => e.filter((x) => x.rating === 1).length >= 5,
  },
  {
    id: "no_rating",
    category: "ratings",
    icon: "🙈",
    name: "Je juge pas",
    description: "50 titres sans jamais avoir noté quoi que ce soit",
    tier: "silver",
    check: (e) => e.length >= 50 && e.every((x) => !x.rating || x.rating === 0),
  },
  {
    id: "average_joe",
    category: "ratings",
    icon: "😐",
    name: "Monsieur Moyen",
    description: "Moyenne de bibliothèque à 5/10 (sur ≥ 10 titres notés)",
    tier: "silver",
    check: (e) => {
      const rated = e.filter((x) => x.rating > 0);
      if (rated.length < 10) return false;
      const avg = rated.reduce((s, x) => s + x.rating, 0) / rated.length;
      return avg >= 4.95 && avg <= 5.05;
    },
  },
  {
    id: "first_note",
    category: "ratings",
    icon: "📓",
    name: "Journaliste",
    description: "Écrire une note sur un titre",
    tier: "bronze",
    check: (e) => e.some((x) => x.notes && x.notes.trim().length > 0),
  },
  {
    id: "notes_10",
    category: "ratings",
    icon: "📔",
    name: "Chroniqueur",
    description: "Écrire des notes sur 10 titres",
    tier: "silver",
    check: (e) =>
      e.filter((x) => x.notes && x.notes.trim().length > 0).length >= 10,
  },
  {
    id: "notes_essayist",
    category: "ratings",
    icon: "✍️",
    name: "Essayiste",
    description: "Écrire une note de plus de 300 caractères",
    tier: "silver",
    check: (e) => e.some((x) => x.notes && x.notes.trim().length > 300),
  },

  // ── Abandons ──────────────────────────────────────────────────────────────
  {
    id: "abandoned_3",
    category: "abandoned",
    icon: "💔",
    name: "Pas pour moi",
    description: "Abandonner 3 titres",
    tier: "bronze",
    check: (e) => abandonedCount(e) >= 3,
  },
  {
    id: "abandoned_10",
    category: "abandoned",
    icon: "🚮",
    name: "Sans pitié",
    description: "Abandonner 10 titres",
    tier: "silver",
    check: (e) => abandonedCount(e) >= 10,
  },
  {
    id: "abandoned_25",
    category: "abandoned",
    icon: "☠️",
    name: "Bourreau de séries",
    description: "Abandonner 25 titres",
    tier: "gold",
    check: (e) => abandonedCount(e) >= 25,
  },
  {
    id: "abandon_more_than_finish",
    category: "abandoned",
    icon: "🤡",
    name: "Quel gâchis",
    description: "Plus d'abandons que de titres terminés (min. 3 abandons)",
    tier: "silver",
    check: (e) => abandonedCount(e) >= 3 && abandonedCount(e) > finishedCount(e),
  },

  // ── En cours & Backlog ────────────────────────────────────────────────────
  {
    id: "watching_5",
    category: "watching",
    icon: "📺",
    name: "Jongleur",
    description: "5 titres en cours simultanément",
    tier: "silver",
    check: (e) => e.filter((x) => x.status === "en-cours").length >= 5,
  },
  {
    id: "watching_10",
    category: "watching",
    icon: "🌀",
    name: "Chaos organisé",
    description: "10 titres en cours simultanément",
    tier: "gold",
    check: (e) => e.filter((x) => x.status === "en-cours").length >= 10,
  },
  {
    id: "watchlist_5",
    category: "watching",
    icon: "⚡",
    name: "Liste d'attente",
    description: "5 titres « À voir »",
    tier: "bronze",
    check: (e) => e.filter((x) => x.status === "a-voir").length >= 5,
  },
  {
    id: "watchlist_20",
    category: "watching",
    icon: "📋",
    name: "La liste sans fin",
    description: "20 titres « À voir »",
    tier: "silver",
    check: (e) => e.filter((x) => x.status === "a-voir").length >= 20,
  },
  {
    id: "watchlist_50",
    category: "watching",
    icon: "😰",
    name: "Panique de backlog",
    description: "50 titres « À voir » — tu n'y arriveras jamais",
    tier: "gold",
    check: (e) => e.filter((x) => x.status === "a-voir").length >= 50,
  },

  // ── Diversité ─────────────────────────────────────────────────────────────
  {
    id: "eclectic",
    category: "diversity",
    icon: "🎭",
    name: "Éclectique",
    description: "Avoir des animes et des séries",
    tier: "bronze",
    check: (e) =>
      e.some((x) => x.type === "anime") && e.some((x) => x.type === "serie"),
  },
  {
    id: "genres_5",
    category: "diversity",
    icon: "🌈",
    name: "Touche-à-tout",
    description: "Explorer 5 genres différents",
    tier: "silver",
    check: (e) => new Set(e.flatMap((x) => x.genres)).size >= 5,
  },
  {
    id: "genres_10",
    category: "diversity",
    icon: "🔭",
    name: "Explorateur",
    description: "Explorer 10 genres différents",
    tier: "gold",
    check: (e) => new Set(e.flatMap((x) => x.genres)).size >= 10,
  },
  {
    id: "genres_15",
    category: "diversity",
    icon: "🗺️",
    name: "Cartographe du divertissement",
    description: "Explorer 15 genres différents",
    tier: "gold",
    check: (e) => new Set(e.flatMap((x) => x.genres)).size >= 15,
  },
  {
    id: "anime_50",
    category: "diversity",
    icon: "🇯🇵",
    name: "Weeb assumé",
    description: "50 animes dans ta bibliothèque",
    tier: "gold",
    check: (e) => e.filter((x) => x.type === "anime").length >= 50,
  },
  {
    id: "ova_collector",
    category: "diversity",
    icon: "📼",
    name: "Collectionneur de OAV",
    description: "10 OAV / ONA / Specials dans ta bibliothèque",
    tier: "silver",
    check: (e) =>
      e.filter((x) => x.type === "anime" && x.category === "ova").length >= 10,
  },
  {
    id: "movie_buff",
    category: "diversity",
    icon: "🎥",
    name: "Cinéphile",
    description: "10 films d'animation dans ta bibliothèque",
    tier: "silver",
    check: (e) =>
      e.filter((x) => x.type === "anime" && x.category === "movie").length >= 10,
  },
  {
    id: "movie_buff_25",
    category: "diversity",
    icon: "🎞️",
    name: "Grand Cinéphile",
    description: "25 films d'animation dans ta bibliothèque",
    tier: "gold",
    check: (e) =>
      e.filter((x) => x.type === "anime" && x.category === "movie").length >= 25,
  },
  {
    id: "series_buff",
    category: "diversity",
    icon: "📡",
    name: "Sériephile",
    description: "50 séries dans ta bibliothèque",
    tier: "gold",
    check: (e) => e.filter((x) => x.type === "serie").length >= 50,
  },

  // ── Saisons ───────────────────────────────────────────────────────────────
  {
    id: "seasons_50",
    category: "seasons",
    icon: "🗓️",
    name: "Marathonien des saisons",
    description: "50 saisons au total dans ta bibliothèque",
    tier: "silver",
    check: (e) => totalSeasons(e) >= 50,
  },
  {
    id: "seasons_100",
    category: "seasons",
    icon: "📆",
    name: "Encyclopédie des saisons",
    description: "100 saisons au total dans ta bibliothèque",
    tier: "gold",
    check: (e) => totalSeasons(e) >= 100,
  },
  {
    id: "long_runner",
    category: "seasons",
    icon: "🏗️",
    name: "Long-courrier",
    description: "Un titre avec au moins 5 saisons",
    tier: "silver",
    check: (e) => maxSeasonsOnEntry(e) >= 5,
  },
  {
    id: "ultra_long_runner",
    category: "seasons",
    icon: "⛰️",
    name: "Saga sans fin",
    description: "Un titre avec au moins 10 saisons",
    tier: "gold",
    check: (e) => maxSeasonsOnEntry(e) >= 10,
  },

  // ── Habitudes ─────────────────────────────────────────────────────────────
  {
    id: "night_owl",
    category: "habits",
    icon: "🦉",
    name: "Hibou",
    description: "Regarder un épisode entre minuit et 4h du matin",
    tier: "bronze",
    check: (e) => hasNightOwlEp(e),
  },
  {
    id: "binge_night",
    category: "habits",
    icon: "🌙",
    name: "Nuit blanche",
    description: "10 épisodes regardés lors d'une même nuit (0h–4h)",
    tier: "silver",
    check: (e) => {
      const counts = {};
      e.forEach((entry) =>
        (entry.watchHistory || []).forEach((h) => {
          const d = new Date(h.watchedAt);
          if (d.getHours() >= 0 && d.getHours() < 4) {
            const day = d.toDateString();
            counts[day] = (counts[day] || 0) + 1;
          }
        })
      );
      return Object.values(counts).some((c) => c >= 10);
    },
  },

  // ── Spéciaux / Easter eggs ────────────────────────────────────────────────
  {
    id: "the_one",
    category: "special",
    icon: "🕶️",
    name: "L'Élu",
    description: "Exactement 1 titre noté 10/10 et 1 noté 1/10",
    tier: "silver",
    check: (e) =>
      e.filter((x) => x.rating === 10).length === 1 &&
      e.filter((x) => x.rating === 1).length === 1,
  },
  {
    id: "symmetric_library",
    category: "special",
    icon: "⚖️",
    name: "Équilibriste",
    description: "Autant d'animes que de séries (min. 5 de chaque)",
    tier: "silver",
    check: (e) => {
      const animes = e.filter((x) => x.type === "anime").length;
      const series = e.filter((x) => x.type === "serie").length;
      return animes >= 5 && animes === series;
    },
  },
  {
    id: "all_statuses",
    category: "special",
    icon: "🎲",
    name: "Touche à tout",
    description: "Avoir au moins 1 titre dans chaque statut",
    tier: "silver",
    check: (e) =>
      ["a-voir", "en-cours", "termine", "abandonne"].every((s) =>
        e.some((x) => x.status === s)
      ),
  },
  {
    id: "no_abandon",
    category: "special",
    icon: "🛡️",
    name: "Sans faiblesse",
    description: "Terminer 10 titres sans jamais en avoir abandonné",
    tier: "gold",
    check: (e) => finishedCount(e) >= 10 && abandonedCount(e) === 0,
  },
  {
    id: "cover_collector",
    category: "special",
    icon: "🖼️",
    name: "Galerie d'art",
    description: "25 titres avec une image de couverture",
    tier: "bronze",
    check: (e) => e.filter((x) => x.coverImage).length >= 25,
  },
  {
    id: "anilist_fan",
    category: "special",
    icon: "🔗",
    name: "Fan d'AniList",
    description: "10 titres importés depuis AniList",
    tier: "silver",
    check: (e) =>
      e.filter(
        (x) => x.source === "anilist" || (x.anilistIds && x.anilistIds.length > 0)
      ).length >= 10,
  },
  {
    id: "tvmaze_fan",
    category: "special",
    icon: "📻",
    name: "Fan de TVmaze",
    description: "10 titres importés depuis TVmaze",
    tier: "silver",
    check: (e) => e.filter((x) => x.tvmazeId != null).length >= 10,
  },
  {
    id: "pure_manual",
    category: "special",
    icon: "⌨️",
    name: "À l'ancienne",
    description: "10 titres ajoutés manuellement (sans import)",
    tier: "bronze",
    check: (e) =>
      e.filter(
        (x) =>
          !x.source &&
          (!x.anilistIds || x.anilistIds.length === 0) &&
          x.tvmazeId == null &&
          x.tmdbId == null
      ).length >= 10,
  },
];

// ── Retourne les succès actuellement débloqués ────────────────────────────────
export function computeUnlocked(entries) {
  return ACHIEVEMENTS.filter((a) => a.check(entries));
}
