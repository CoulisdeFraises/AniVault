// ── Helpers ───────────────────────────────────────────────────────────────────
const totalEps      = (entries) =>
  entries.reduce((sum, e) => sum + e.seasons.reduce((s2, s) => s2 + (s.watchedEpisodes || 0), 0), 0);

const finishedCount = (entries) =>
  entries.filter((e) => e.status === "termine").length;

// ── Définition des succès ─────────────────────────────────────────────────────
// tier : "bronze" | "silver" | "gold"
export const ACHIEVEMENTS = [
  // ── Bibliothèque ──
  {
    id: "first_title",
    icon: "🎬",
    name: "Premier pas",
    description: "Ajouter ton premier titre",
    tier: "bronze",
    check: (e) => e.length >= 1,
  },
  {
    id: "library_10",
    icon: "📚",
    name: "Bibliophile",
    description: "10 titres dans ta bibliothèque",
    tier: "silver",
    check: (e) => e.length >= 10,
  },
  {
    id: "library_25",
    icon: "📖",
    name: "Collectionneur",
    description: "25 titres dans ta bibliothèque",
    tier: "gold",
    check: (e) => e.length >= 25,
  },
  {
    id: "library_50",
    icon: "🏛️",
    name: "Archiviste",
    description: "50 titres dans ta bibliothèque",
    tier: "gold",
    check: (e) => e.length >= 50,
  },

  // ── Épisodes ──
  {
    id: "eps_100",
    icon: "🎯",
    name: "Centurion",
    description: "100 épisodes visionnés",
    tier: "bronze",
    check: (e) => totalEps(e) >= 100,
  },
  {
    id: "eps_500",
    icon: "🚀",
    name: "Marathon",
    description: "500 épisodes visionnés",
    tier: "silver",
    check: (e) => totalEps(e) >= 500,
  },
  {
    id: "eps_1000",
    icon: "🔥",
    name: "Légende",
    description: "1000 épisodes visionnés",
    tier: "gold",
    check: (e) => totalEps(e) >= 1000,
  },

  // ── Titres terminés ──
  {
    id: "first_finish",
    icon: "🏆",
    name: "Première victoire",
    description: "Terminer un titre",
    tier: "bronze",
    check: (e) => finishedCount(e) >= 1,
  },
  {
    id: "finish_5",
    icon: "💪",
    name: "Persévérant",
    description: "Terminer 5 titres",
    tier: "silver",
    check: (e) => finishedCount(e) >= 5,
  },
  {
    id: "finish_10",
    icon: "🌟",
    name: "Expert",
    description: "Terminer 10 titres",
    tier: "gold",
    check: (e) => finishedCount(e) >= 10,
  },

  // ── Notes ──
  {
    id: "first_rating",
    icon: "⭐",
    name: "Critique",
    description: "Noter un premier titre",
    tier: "bronze",
    check: (e) => e.some((x) => x.rating > 0),
  },
  {
    id: "rated_10",
    icon: "🎖️",
    name: "Juré",
    description: "Noter 10 titres",
    tier: "silver",
    check: (e) => e.filter((x) => x.rating > 0).length >= 10,
  },
  {
    id: "perfect_score",
    icon: "🤩",
    name: "Chef-d'œuvre",
    description: "Donner un 10/10 à un titre",
    tier: "gold",
    check: (e) => e.some((x) => x.rating === 10),
  },

  // ── Diversité ──
  {
    id: "eclectic",
    icon: "🎭",
    name: "Éclectique",
    description: "Avoir des animes et des séries",
    tier: "bronze",
    check: (e) =>
      e.some((x) => x.type === "anime") && e.some((x) => x.type === "serie"),
  },
  {
    id: "genres_5",
    icon: "🌈",
    name: "Touche-à-tout",
    description: "Explorer 5 genres différents",
    tier: "silver",
    check: (e) => new Set(e.flatMap((x) => x.genres)).size >= 5,
  },

  // ── Divers ──
  {
    id: "watchlist_5",
    icon: "⚡",
    name: "Liste d'attente",
    description: "5 titres « À voir »",
    tier: "bronze",
    check: (e) => e.filter((x) => x.status === "a-voir").length >= 5,
  },
  {
    id: "abandoned_3",
    icon: "💔",
    name: "Pas pour moi",
    description: "Abandonner 3 titres",
    tier: "bronze",
    check: (e) => e.filter((x) => x.status === "abandonne").length >= 3,
  },
];

// ── Retourne les succès actuellement débloqués ────────────────────────────────
export function computeUnlocked(entries) {
  return ACHIEVEMENTS.filter((a) => a.check(entries));
}