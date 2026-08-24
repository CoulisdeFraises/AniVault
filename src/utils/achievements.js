// Icônes des succès et catégories — plus d'emoji. Choisies dans le
// sous-ensemble d'icônes lucide-react déjà utilisées ailleurs dans
// l'app (donc garanties compatibles avec la version installée).
import {
  AlertTriangle,
  Calendar,
  CalendarClock,
  CalendarDays,
  Camera,
  CheckCheck,
  CheckCircle2,
  Clapperboard,
  Clock,
  Copy,
  Database,
  Dices,
  Disc2,
  Eye,
  EyeOff,
  Film,
  Globe,
  Heart,
  KeyRound,
  ListPlus,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Tv,
  X,
  XCircle,
} from "lucide-react";

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

// ── Helpers supplémentaires (nouveaux succès) ───────────────────────────────
const allWatchedAt = (entries) =>
  entries.flatMap((e) => (e.watchHistory || []).map((h) => h.watchedAt)).filter(Boolean);

const dayKey = (ts) => new Date(ts).toDateString();

/** Nombre de jours distincts (toutes entrées confondues) avec au moins un épisode regardé */
const distinctWatchDays = (entries) => new Set(allWatchedAt(entries).map(dayKey)).size;

/** Plus longue série de jours consécutifs avec au moins un épisode regardé */
const longestDayStreak = (entries) => {
  const days = [...new Set(allWatchedAt(entries).map((ts) => {
    const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime();
  }))].sort((a, b) => a - b);
  if (!days.length) return 0;
  let best = 1, cur = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = Math.round((days[i] - days[i - 1]) / 86400000);
    if (diff === 1) { cur++; best = Math.max(best, cur); }
    else if (diff > 1) cur = 1;
  }
  return best;
};

/** Compte les épisodes regardés dans une plage horaire [startHour, endHour) */
const epsInHourRange = (entries, startHour, endHour) =>
  allWatchedAt(entries).filter((ts) => {
    const h = new Date(ts).getHours();
    return h >= startHour && h < endHour;
  }).length;

/** Compte les épisodes regardés le week-end (samedi/dimanche) */
const weekendEpsCount = (entries) =>
  allWatchedAt(entries).filter((ts) => [0, 6].includes(new Date(ts).getDay())).length;

/** Nombre de mois calendaires distincts (année+mois) où au moins un épisode a été regardé */
const distinctActiveMonths = (entries) =>
  new Set(allWatchedAt(entries).map((ts) => {
    const d = new Date(ts); return `${d.getFullYear()}-${d.getMonth()}`;
  })).size;

/** Un titre entièrement regardé (tous les watchHistory) sur une seule journée */
const hasSingleDayFullFinish = (entries) =>
  entries.some((e) => {
    if (e.status !== "termine") return false;
    const hist = e.watchHistory || [];
    if (hist.length < 3) return false; // évite les faux positifs sur les mini-formats
    return new Set(hist.map((h) => dayKey(h.watchedAt))).size === 1;
  });

/** Nombre max de titres terminés le même jour civil (via updatedAt) */
const maxFinishesSameDay = (entries) => {
  const counts = {};
  entries.filter((e) => e.status === "termine" && e.updatedAt).forEach((e) => {
    const k = dayKey(e.updatedAt);
    counts[k] = (counts[k] || 0) + 1;
  });
  return Math.max(0, ...Object.values(counts));
};

/** Écart le plus large entre la meilleure et la pire saison notée d'un même titre (≥3 saisons notées) */
const maxSeasonRatingSpread = (entries) =>
  entries.reduce((max, e) => {
    const rated = (e.seasons || []).filter((s) => s.rating > 0).map((s) => s.rating);
    if (rated.length < 3) return max;
    return Math.max(max, Math.max(...rated) - Math.min(...rated));
  }, 0);

/** Un titre d'au moins 5 saisons dont toutes les saisons sont notées ≥ 8 */
const hasLoyalMasterpiece = (entries) =>
  entries.some((e) => {
    const seasons = e.seasons || [];
    return seasons.length >= 5 && seasons.every((s) => s.rating >= 8);
  });

/** Nombre de formats de saison distincts rencontrés (TV, MOVIE, OVA, ONA, SPECIAL...) */
const distinctSeasonFormats = (entries) =>
  new Set(entries.flatMap((e) => (e.seasons || []).map((s) => s.format).filter(Boolean))).size;

/** Deux titres (ou plus) partageant exactement le même nom (remake, doublon...) */
const hasDuplicateTitle = (entries) => {
  const counts = {};
  entries.forEach((e) => {
    const t = (e.title || "").trim().toLowerCase();
    if (!t) return;
    counts[t] = (counts[t] || 0) + 1;
  });
  return Object.values(counts).some((c) => c >= 2);
};

/** Tous les titres notés partagent exactement la même note (min. N titres notés) */
const allRatingsIdentical = (entries, min) => {
  const rated = entries.filter((e) => e.rating > 0);
  if (rated.length < min) return false;
  return rated.every((e) => e.rating === rated[0].rating);
};

/** Titre terminé en 1 épisode (format court/spécial) */
const hasOneEpisodeFinish = (entries) =>
  entries.some((e) =>
    e.status === "termine" &&
    (e.seasons || []).reduce((s, se) => s + (se.totalEpisodes ?? 0), 0) === 1
  );

/** Un titre entièrement regardé (≥24 épisodes) en moins de 48h entre 1er et dernier visionnage */
const hasFastBinge = (entries) =>
  entries.some((e) => {
    const hist = e.watchHistory || [];
    if (hist.length < 24) return false;
    const ts = hist.map((h) => h.watchedAt).filter(Boolean).sort((a, b) => a - b);
    return ts.length >= 24 && (ts[ts.length - 1] - ts[0]) <= 48 * 3600 * 1000;
  });

/** Retour après une pause d'au moins 90 jours sur un même titre */
const hasComeback = (entries) =>
  entries.some((e) => {
    const ts = (e.watchHistory || []).map((h) => h.watchedAt).filter(Boolean).sort((a, b) => a - b);
    return ts.some((t, i) => i > 0 && t - ts[i - 1] >= 90 * 86400000);
  });

/** Au moins un épisode regardé un 24 ou 25 décembre */
const hasChristmasEp = (entries) =>
  allWatchedAt(entries).some((ts) => {
    const d = new Date(ts);
    return d.getMonth() === 11 && (d.getDate() === 24 || d.getDate() === 25);
  });

/** Au moins un épisode regardé dans la demi-heure suivant minuit le 1er janvier */
const hasNewYearEp = (entries) =>
  allWatchedAt(entries).some((ts) => {
    const d = new Date(ts);
    return d.getMonth() === 0 && d.getDate() === 1 && d.getHours() === 0 && d.getMinutes() < 30;
  });

// ── Catégories ────────────────────────────────────────────────────────────────
// Utilisées par l'UI pour grouper les succès en accordéon
export const ACHIEVEMENT_CATEGORIES = [
  { id: "library",   label: "Bibliothèque",      icon: Database },
  { id: "episodes",  label: "Épisodes",           icon: Film },
  { id: "finished",  label: "Titres terminés",    icon: Trophy },
  { id: "ratings",   label: "Notes & Avis",       icon: Star },
  { id: "abandoned", label: "Abandons",           icon: XCircle },
  { id: "watching",  label: "En cours & Backlog", icon: Tv },
  { id: "diversity", label: "Diversité",          icon: Globe },
  { id: "seasons",   label: "Saisons",            icon: CalendarDays },
  { id: "habits",    label: "Habitudes",          icon: Clock },
  { id: "special",   label: "Spéciaux",           icon: Dices },
  { id: "meta",      label: "Insolite",           icon: SlidersHorizontal },
];

// ── Définition des succès ─────────────────────────────────────────────────────
// tier : "bronze" | "silver" | "gold"
export const ACHIEVEMENTS = [

  // ── Bibliothèque ─────────────────────────────────────────────────────────
  {
    id: "first_title",
    category: "library",
    icon: Plus,
    name: "Premier pas",
    description: "Ajouter ton premier titre",
    tier: "bronze",
    check: (e) => e.length >= 1,
  },
  {
    id: "library_10",
    category: "library",
    icon: Database,
    name: "Débutant",
    description: "10 titres dans ta bibliothèque",
    tier: "silver",
    check: (e) => e.length >= 10,
  },
  {
    id: "library_50",
    category: "library",
    icon: Database,
    name: "Collectionneur",
    description: "50 titres dans ta bibliothèque",
    tier: "gold",
    check: (e) => e.length >= 50,
  },
  {
    id: "library_100",
    category: "library",
    icon: Sparkles,
    name: "Libraire",
    description: "100 titres dans ta bibliothèque - Ta collection grandit bien !",
    tier: "gold",
    check: (e) => e.length >= 100,
  },
  {
    id: "library_500",
    category: "library",
    icon: Star,
    name: "Archiviste",
    description: "500 titres dans ta bibliothèque — Ce n'est plus une collection, c'est une réserve !",
    tier: "gold",
    check: (e) => e.length >= 500,
  },
    {
    id: "library_1000",
    category: "library",
    icon: Star,
    name: "Datacenter",
    description: "1000 titres dans ta bibliothèque — On va a voir besoinde plus de serveurs à cause de toi !",
    tier: "gold",
    check: (e) => e.length >= 1000,
  },
      {
    id: "library_2000",
    category: "library",
    icon: Star,
    name: "Bibliothèque d'Alexandrie",
    description: "2000 titres dans ta bibliothèque — T'as combien de temps devant toi pour regarder tout ça ?",
    tier: "gold",
    check: (e) => e.length >= 1000,
  },

  // ── Épisodes ─────────────────────────────────────────────────────────────
  {
    id: "eps_100",
    category: "episodes",
    icon: Film,
    name: "Amateur",
    description: "100 épisodes visionnés",
    tier: "bronze",
    check: (e) => totalEps(e) >= 100,
  },
  {
    id: "eps_500",
    category: "episodes",
    icon: Film,
    name: "Marathon",
    description: "500 épisodes visionnés",
    tier: "bronze",
    check: (e) => totalEps(e) >= 500,
  },
  {
    id: "eps_1000",
    category: "episodes",
    icon: Film,
    name: "Légende",
    description: "1 000 épisodes visionnés",
    tier: "silver",
    check: (e) => totalEps(e) >= 1000,
  },
  {
    id: "eps_2500",
    category: "episodes",
    icon: Sparkles,
    name: "Transcendance",
    description: "2 500 épisodes visionnés",
    tier: "gold",
    check: (e) => totalEps(e) >= 2500,
  },
  {
    id: "eps_5000",
    category: "episodes",
    icon: Star,
    name: "No-life",
    description: "5 000 épisodes visionnés — vraiment ?",
    tier: "gold",
    check: (e) => totalEps(e) >= 5000,
  },
  {
    id: "eps_10000",
    category: "episodes",
    icon: Eye,
    name: "L'Éveillé",
    description: "10 000 épisodes visionnés. Tu es au-delà.",
    tier: "gold",
    check: (e) => totalEps(e) >= 10000,
  },
  {
    id: "binge_10",
    category: "episodes",
    icon: Tv,
    name: "Soirée Netflix",
    description: "10 épisodes regardés en une seule journée",
    tier: "bronze",
    check: (e) => maxEpsInOneDay(e) >= 10,
  },
  {
    id: "binge_25",
    category: "episodes",
    icon: Tv,
    name: "Canapé world-class",
    description: "25 épisodes regardés en une seule journée",
    tier: "silver",
    check: (e) => maxEpsInOneDay(e) >= 25,
  },
  {
    id: "binge_50",
    category: "episodes",
    icon: AlertTriangle,
    name: "Appelle un médecin",
    description: "50 épisodes regardés en une seule journée",
    tier: "gold",
    check: (e) => maxEpsInOneDay(e) >= 50,
  },
  {
    id: "fast_binge",
    category: "episodes",
    icon: Clock,
    name: "Rush total",
    description: "Regarder un titre entier (24 épisodes ou plus) en moins de 48h",
    tier: "gold",
    check: (e) => hasFastBinge(e),
  },
  {
    id: "streak_7",
    category: "episodes",
    icon: RefreshCw,
    name: "Sur ma lancée",
    description: "7 jours d'affilée avec au moins un épisode regardé",
    tier: "silver",
    check: (e) => longestDayStreak(e) >= 7,
  },
  {
    id: "streak_30",
    category: "episodes",
    icon: RefreshCw,
    name: "Rituel quotidien",
    description: "30 jours d'affilée avec au moins un épisode regardé",
    tier: "gold",
    check: (e) => longestDayStreak(e) >= 30,
  },

  // ── Titres terminés ───────────────────────────────────────────────────────
  {
    id: "first_finish",
    category: "finished",
    icon: Trophy,
    name: "Première victoire",
    description: "Terminer un titre",
    tier: "bronze",
    check: (e) => finishedCount(e) >= 1,
  },
  {
    id: "finish_10",
    category: "finished",
    icon: Trophy,
    name: "Sur ma lancée",
    description: "Terminer 10 titres",
    tier: "bronze",
    check: (e) => finishedCount(e) >= 10,
  },
  {
    id: "finish_50",
    category: "finished",
    icon: Star,
    name: "Finisher",
    description: "Terminer 50 titres",
    tier: "silver",
    check: (e) => finishedCount(e) >= 50,
  },
  {
    id: "finish_100",
    category: "finished",
    icon: Trophy,
    name: "Persévérance à toute épreuve",
    description: "Terminer 100 titres - C'est fort.",
    tier: "silver",
    check: (e) => finishedCount(e) >= 100,
  },
  {
    id: "finish_300",
    category: "finished",
    icon: Trophy,
    name: "Volonté inflexible",
    description: "Terminer 300 titres - Bon là, tu m'inpressionnes.",
    tier: "gold",
    check: (e) => finishedCount(e) >= 300,
  },
  {
    id: "finish_500",
    category: "finished",
    icon: Trophy,
    name: "Completionniste",
    description: "Terminer 500 titres - Jamais vu quelqu'un d'aussi obstiné.",
    tier: "gold",
    check: (e) => finishedCount(e) >= 500,
  },
  {
    id: "one_ep_finish",
    category: "finished",
    icon: CheckCircle2,
    name: "Court mais efficace",
    description: "Terminer un titre en un seul épisode",
    tier: "bronze",
    check: (e) => hasOneEpisodeFinish(e),
  },
  {
    id: "single_day_finish",
    category: "finished",
    icon: CheckCheck,
    name: "Tout d'un coup",
    description: "Regarder un titre entier (3 épisodes ou plus) en une seule journée",
    tier: "silver",
    check: (e) => hasSingleDayFullFinish(e),
  },
  {
    id: "finish_spree_3",
    category: "finished",
    icon: Sparkles,
    name: "Journée productive",
    description: "Terminer 3 titres le même jour",
    tier: "silver",
    check: (e) => maxFinishesSameDay(e) >= 3,
  },
  {
    id: "finish_spree_5",
    category: "finished",
    icon: Sparkles,
    name: "Marathon de fins",
    description: "Terminer 5 titres le même jour",
    tier: "gold",
    check: (e) => maxFinishesSameDay(e) >= 5,
  },
  {
    id: "comeback",
    category: "finished",
    icon: RotateCcw,
    name: "Le retour du héros",
    description: "Reprendre un titre après plus de 90 jours de pause",
    tier: "silver",
    check: (e) => hasComeback(e),
  },

  // ── Notes & Avis ──────────────────────────────────────────────────────────
  {
    id: "first_rating",
    category: "ratings",
    icon: Star,
    name: "Critique en herbe",
    description: "Noter un premier titre",
    tier: "bronze",
    check: (e) => e.some((x) => x.rating > 0),
  },
  {
    id: "rated_50",
    category: "ratings",
    icon: Star,
    name: "Juré",
    description: "Noter 50 titres",
    tier: "silver",
    check: (e) => ratedCount(e) >= 50,
  },
  {
    id: "rated_200",
    category: "ratings",
    icon: Star,
    name: "Grand Critique",
    description: "Noter 200 titres",
    tier: "gold",
    check: (e) => ratedCount(e) >= 200,
  },
  {
    id: "rated_500",
    category: "ratings",
    icon: Star,
    name: "Anatole France",
    description: "Noter 500 titres - C'est toi le plus grand critique.",
    tier: "gold",
    check: (e) => ratedCount(e) >= 500,
  },
  {
    id: "perfect_score",
    category: "ratings",
    icon: Sparkles,
    name: "Chef-d'œuvre",
    description: "Donner un 10/10 à un titre",
    tier: "gold",
    check: (e) => e.some((x) => x.rating === 10),
  },
  {
    id: "perfect_10",
    category: "ratings",
    icon: Sparkles,
    name: "Perfectionniste",
    description: "Donner un 10/10 à 10 titres",
    tier: "gold",
    check: (e) => e.filter((x) => x.rating === 10).length >= 10,
  },
  {
    id: "low_rater",
    category: "ratings",
    icon: X,
    name: "Difficile à satisfaire",
    description: "Donner un 1/10 à un titre",
    tier: "bronze",
    check: (e) => e.some((x) => x.rating === 1),
  },
  {
    id: "harsh_jury",
    category: "ratings",
    icon: XCircle,
    name: "Impitoyable",
    description: "Donner un 1/10 à 10 titres",
    tier: "silver",
    check: (e) => e.filter((x) => x.rating === 1).length >= 10,
  },
  {
    id: "no_rating",
    category: "ratings",
    icon: EyeOff,
    name: "La flemme",
    description: "10 titres sans jamais avoir noté quoi que ce soit",
    tier: "Silver",
    check: (e) => e.length >= 10 && e.every((x) => !x.rating || x.rating === 0),
  },
  {
    id: "no_rating",
    category: "ratings",
    icon: EyeOff,
    name: "A quoi ça sert les notes ?",
    description: "100 titres sans jamais avoir noté quoi que ce soit",
    tier: "Gold",
    check: (e) => e.length >= 100 && e.every((x) => !x.rating || x.rating === 0),
  },
  {
    id: "average_joe",
    category: "ratings",
    icon: Eye,
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
    icon: Pencil,
    name: "Journaliste",
    description: "Écrire une note sur un titre",
    tier: "bronze",
    check: (e) => e.some((x) => x.notes && x.notes.trim().length > 0),
  },
  {
    id: "notes_10",
    category: "ratings",
    icon: Pencil,
    name: "Chroniqueur",
    description: "Écrire des notes sur 10 titres",
    tier: "silver",
    check: (e) =>
      e.filter((x) => x.notes && x.notes.trim().length > 0).length >= 10,
  },
  {
    id: "notes_essayist",
    category: "ratings",
    icon: Pencil,
    name: "Essayiste",
    description: "Écrire une note de plus de 300 caractères",
    tier: "silver",
    check: (e) => e.some((x) => x.notes && x.notes.trim().length > 300),
  },
  {
    id: "notes_thesis",
    category: "ratings",
    icon: Pencil,
    name: "Thèse universitaire",
    description: "Écrire une note de plus de 1 000 caractères sur un seul titre",
    tier: "gold",
    check: (e) => e.some((x) => x.notes && x.notes.trim().length > 1000),
  },
  {
    id: "monotone",
    category: "ratings",
    icon: Disc2,
    name: "Monotone",
    description: "Donner exactement la même note à 10 titres notés",
    tier: "silver",
    check: (e) => allRatingsIdentical(e, 10),
  },
  {
    id: "roller_coaster",
    category: "ratings",
    icon: AlertTriangle,
    name: "Montagnes russes",
    description: "Sur un même titre, un écart de 6 points ou plus entre la meilleure et la pire saison notée",
    tier: "gold",
    check: (e) => maxSeasonRatingSpread(e) >= 6,
  },
  {
    id: "loyal_masterpiece",
    category: "ratings",
    icon: Heart,
    name: "Sans fausse note",
    description: "Un titre d'au moins 5 saisons, toutes notées 8/10 ou plus",
    tier: "gold",
    check: (e) => hasLoyalMasterpiece(e),
  },

  // ── Abandons ──────────────────────────────────────────────────────────────
  {
    id: "abandoned_3",
    category: "abandoned",
    icon: XCircle,
    name: "Pas pour moi",
    description: "Abandonner 3 titres",
    tier: "bronze",
    check: (e) => abandonedCount(e) >= 3,
  },
  {
    id: "abandoned_10",
    category: "abandoned",
    icon: Trash2,
    name: "Sans pitié",
    description: "Abandonner 10 titres",
    tier: "silver",
    check: (e) => abandonedCount(e) >= 10,
  },
  {
    id: "abandoned_25",
    category: "abandoned",
    icon: Trash2,
    name: "Bourreau de séries",
    description: "Abandonner 25 titres",
    tier: "gold",
    check: (e) => abandonedCount(e) >= 25,
  },
  {
    id: "abandon_more_than_finish",
    category: "abandoned",
    icon: AlertTriangle,
    name: "Quel gâchis",
    description: "Plus d'abandons que de titres terminés (min. 3 abandons)",
    tier: "silver",
    check: (e) => abandonedCount(e) >= 3 && abandonedCount(e) > finishedCount(e),
  },

  // ── En cours & Backlog ────────────────────────────────────────────────────
  {
    id: "watching_5",
    category: "watching",
    icon: Tv,
    name: "Jongleur",
    description: "5 titres en cours simultanément",
    tier: "silver",
    check: (e) => e.filter((x) => x.status === "en-cours").length >= 5,
  },
  {
    id: "watching_10",
    category: "watching",
    icon: Tv,
    name: "Chaos organisé",
    description: "10 titres en cours simultanément",
    tier: "gold",
    check: (e) => e.filter((x) => x.status === "en-cours").length >= 10,
  },
  {
    id: "watchlist_5",
    category: "watching",
    icon: ListPlus,
    name: "Liste d'attente",
    description: "5 titres « À voir »",
    tier: "bronze",
    check: (e) => e.filter((x) => x.status === "a-voir").length >= 5,
  },
  {
    id: "watchlist_20",
    category: "watching",
    icon: ListPlus,
    name: "La liste sans fin",
    description: "20 titres « À voir »",
    tier: "silver",
    check: (e) => e.filter((x) => x.status === "a-voir").length >= 20,
  },
  {
    id: "watchlist_50",
    category: "watching",
    icon: AlertTriangle,
    name: "Panique de backlog",
    description: "50 titres « À voir » — tu n'y arriveras jamais",
    tier: "gold",
    check: (e) => e.filter((x) => x.status === "a-voir").length >= 50,
  },

  // ── Diversité ─────────────────────────────────────────────────────────────
  {
    id: "eclectic",
    category: "diversity",
    icon: Globe,
    name: "Éclectique",
    description: "Avoir des animes et des séries",
    tier: "bronze",
    check: (e) =>
      e.some((x) => x.type === "anime") && e.some((x) => x.type === "serie"),
  },
  {
    id: "genres_5",
    category: "diversity",
    icon: Globe,
    name: "Touche-à-tout",
    description: "Explorer 5 genres différents",
    tier: "silver",
    check: (e) => new Set(e.flatMap((x) => x.genres)).size >= 5,
  },
  {
    id: "genres_10",
    category: "diversity",
    icon: Globe,
    name: "Explorateur",
    description: "Explorer 10 genres différents",
    tier: "gold",
    check: (e) => new Set(e.flatMap((x) => x.genres)).size >= 10,
  },
  {
    id: "genres_15",
    category: "diversity",
    icon: Globe,
    name: "Cartographe du divertissement",
    description: "Explorer 15 genres différents",
    tier: "gold",
    check: (e) => new Set(e.flatMap((x) => x.genres)).size >= 15,
  },
  {
    id: "anime_50",
    category: "diversity",
    icon: Sparkles,
    name: "Weeb assumé",
    description: "50 animes dans ta bibliothèque",
    tier: "gold",
    check: (e) => e.filter((x) => x.type === "anime").length >= 50,
  },
  {
    id: "ova_collector",
    category: "diversity",
    icon: Disc2,
    name: "Collectionneur de OAV",
    description: "10 OAV / ONA / Specials dans ta bibliothèque",
    tier: "silver",
    check: (e) =>
      e.filter((x) => x.type === "anime" && x.category === "ova").length >= 10,
  },
  {
    id: "movie_buff",
    category: "diversity",
    icon: Clapperboard,
    name: "Cinéphile",
    description: "10 films d'animation dans ta bibliothèque",
    tier: "silver",
    check: (e) =>
      e.filter((x) => x.type === "anime" && x.category === "movie").length >= 10,
  },
  {
    id: "movie_buff_25",
    category: "diversity",
    icon: Clapperboard,
    name: "Grand Cinéphile",
    description: "25 films d'animation dans ta bibliothèque",
    tier: "gold",
    check: (e) =>
      e.filter((x) => x.type === "anime" && x.category === "movie").length >= 25,
  },
  {
    id: "series_buff",
    category: "diversity",
    icon: Tv,
    name: "Sériephile",
    description: "50 séries dans ta bibliothèque",
    tier: "gold",
    check: (e) => e.filter((x) => x.type === "serie").length >= 50,
  },

  // ── Saisons ───────────────────────────────────────────────────────────────
  {
    id: "seasons_50",
    category: "seasons",
    icon: CalendarDays,
    name: "Marathonien des saisons",
    description: "50 saisons au total dans ta bibliothèque",
    tier: "silver",
    check: (e) => totalSeasons(e) >= 50,
  },
  {
    id: "seasons_100",
    category: "seasons",
    icon: CalendarDays,
    name: "Encyclopédie des saisons",
    description: "100 saisons au total dans ta bibliothèque",
    tier: "gold",
    check: (e) => totalSeasons(e) >= 100,
  },
  {
    id: "long_runner",
    category: "seasons",
    icon: CalendarClock,
    name: "Long-courrier",
    description: "Un titre avec au moins 5 saisons",
    tier: "silver",
    check: (e) => maxSeasonsOnEntry(e) >= 5,
  },
  {
    id: "ultra_long_runner",
    category: "seasons",
    icon: CalendarClock,
    name: "Saga sans fin",
    description: "Un titre avec au moins 10 saisons",
    tier: "gold",
    check: (e) => maxSeasonsOnEntry(e) >= 10,
  },
  {
    id: "format_collector",
    category: "seasons",
    icon: SlidersHorizontal,
    name: "Collectionneur de formats",
    description: "Avoir des saisons d'au moins 4 formats différents (TV, Film, OAV...)",
    tier: "silver",
    check: (e) => distinctSeasonFormats(e) >= 4,
  },

  // ── Habitudes ─────────────────────────────────────────────────────────────
  {
    id: "night_owl",
    category: "habits",
    icon: Clock,
    name: "Hibou",
    description: "Regarder un épisode entre minuit et 4h du matin",
    tier: "bronze",
    check: (e) => hasNightOwlEp(e),
  },
  {
    id: "binge_night",
    category: "habits",
    icon: Clock,
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
  {
    id: "chronic_owl",
    category: "habits",
    icon: Clock,
    name: "Insomniaque chronique",
    description: "Regarder au moins un épisode entre minuit et 4h, sur 7 jours différents",
    tier: "gold",
    check: (e) => {
      const days = new Set(
        allWatchedAt(e)
          .filter((ts) => { const h = new Date(ts).getHours(); return h >= 0 && h < 4; })
          .map(dayKey)
      );
      return days.size >= 7;
    },
  },
  {
    id: "early_bird",
    category: "habits",
    icon: Clock,
    name: "Lève-tôt",
    description: "Regarder un épisode entre 5h et 7h du matin",
    tier: "bronze",
    check: (e) => epsInHourRange(e, 5, 7) >= 1,
  },
  {
    id: "lunch_break",
    category: "habits",
    icon: Clock,
    name: "Pause déjeuner",
    description: "20 épisodes regardés entre 12h et 13h",
    tier: "silver",
    check: (e) => epsInHourRange(e, 12, 13) >= 20,
  },
  {
    id: "weekend_warrior",
    category: "habits",
    icon: Calendar,
    name: "Guerrier du week-end",
    description: "50 épisodes regardés le week-end (samedi ou dimanche)",
    tier: "silver",
    check: (e) => weekendEpsCount(e) >= 50,
  },
  {
    id: "full_year",
    category: "habits",
    icon: CalendarDays,
    name: "Fidèle toute l'année",
    description: "Avoir regardé au moins un épisode chaque mois sur 12 mois différents",
    tier: "gold",
    check: (e) => distinctActiveMonths(e) >= 12,
  },
  {
    id: "christmas_watch",
    category: "habits",
    icon: Sparkles,
    name: "Marathon de Noël",
    description: "Regarder un épisode le 24 ou le 25 décembre",
    tier: "bronze",
    check: (e) => hasChristmasEp(e),
  },
  {
    id: "new_year_watch",
    category: "habits",
    icon: Sparkles,
    name: "Premier réflexe de l'année",
    description: "Regarder un épisode dans la demi-heure suivant minuit le 1er janvier",
    tier: "gold",
    check: (e) => hasNewYearEp(e),
  },

  // ── Spéciaux / Easter eggs ────────────────────────────────────────────────
  {
    id: "the_one",
    category: "special",
    icon: Star,
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
    icon: SlidersHorizontal,
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
    icon: Dices,
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
    icon: Shield,
    name: "Sans faiblesse",
    description: "Terminer 10 titres sans jamais en avoir abandonné",
    tier: "gold",
    check: (e) => finishedCount(e) >= 10 && abandonedCount(e) === 0,
  },
  {
    id: "cover_collector",
    category: "special",
    icon: Camera,
    name: "Galerie d'art",
    description: "25 titres avec une image de couverture",
    tier: "bronze",
    check: (e) => e.filter((x) => x.coverImage).length >= 25,
  },
  {
    id: "anilist_fan",
    category: "special",
    icon: Heart,
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
    icon: Tv,
    name: "Fan de TVmaze",
    description: "10 titres importés depuis TVmaze",
    tier: "silver",
    check: (e) => e.filter((x) => x.tvmazeId != null).length >= 10,
  },
  {
    id: "pure_manual",
    category: "special",
    icon: KeyRound,
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

  // ── Insolite (comportements étranges dans les données) ──────────────────────
  {
    id: "short_title",
    category: "meta",
    icon: Pencil,
    name: "Minimaliste",
    description: "Un titre dont le nom fait 3 caractères ou moins",
    tier: "bronze",
    check: (e) => e.some((x) => (x.title || "").trim().length > 0 && (x.title || "").trim().length <= 3),
  },
  {
    id: "long_title",
    category: "meta",
    icon: Pencil,
    name: "Le titre ne tient pas sur une ligne",
    description: "Un titre dont le nom fait plus de 60 caractères",
    tier: "bronze",
    check: (e) => e.some((x) => (x.title || "").trim().length > 60),
  },
  {
    id: "duplicate_title",
    category: "meta",
    icon: Copy,
    name: "Effet miroir",
    description: "Deux titres portant exactement le même nom dans ta bibliothèque",
    tier: "silver",
    check: (e) => hasDuplicateTitle(e),
  },
  {
    id: "mystery_titles",
    category: "meta",
    icon: EyeOff,
    name: "Mystère total",
    description: "10 titres sans aucun genre renseigné",
    tier: "silver",
    check: (e) => e.filter((x) => !x.genres || x.genres.length === 0).length >= 10,
  },
  {
    id: "no_cover_10",
    category: "meta",
    icon: EyeOff,
    name: "Minimalisme visuel",
    description: "10 titres sans image de couverture",
    tier: "bronze",
    check: (e) => e.filter((x) => !x.coverImage).length >= 10,
  },
  {
    id: "gargantuan_show",
    category: "meta",
    icon: Film,
    name: "Le jamais fini",
    description: "Un titre prévu pour plus de 500 épisodes au total",
    tier: "gold",
    check: (e) =>
      e.some((x) => (x.seasons || []).reduce((s, se) => s + (se.totalEpisodes ?? 0), 0) > 500),
  },
  {
    id: "contradictory",
    category: "meta",
    icon: AlertTriangle,
    name: "Contradictoire",
    description: "Un titre noté 10/10 alors qu'une de ses saisons est notée 1/10",
    tier: "gold",
    check: (e) =>
      e.some((x) => x.rating === 10 && (x.seasons || []).some((s) => s.rating === 1)),
  },
  {
    id: "sadist",
    category: "meta",
    icon: AlertTriangle,
    name: "Sadique",
    description: "Noter 3 films ou OAV à 1/10",
    tier: "silver",
    check: (e) => e.filter((x) => x.category !== "tv" && x.rating === 1).length >= 3,
  },
];

// ── Retourne les succès actuellement débloqués ────────────────────────────────
export function computeUnlocked(entries) {
  return ACHIEVEMENTS.filter((a) => a.check(entries));
}
