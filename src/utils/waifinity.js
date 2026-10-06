import { purgeStaleCaches } from "../lib/cache.js";
import { fragmentsForDuplicate, defaultCosmetics } from "./waifinityCosmetics.js";

// ── Waifinity : règles du jeu ────────────────────────────────────────────────
//
// Rareté : 6 paliers, calculés par RANG de popularité (favoris AniList) au
// sein du bassin de personnages — voir api/waifu.js. Le découpage se fait en
// parts du bassin (TIER_CUTOFFS), donc la pyramide reste identique quelle que
// soit la taille du bassin (snapshot complet ou bassin de secours).
//
// Genre : AniList expose un champ `gender` (texte libre : Female, Male,
// Non-binary…). On le normalise en "female" | "male" | "other" | null.
//
// Sauvegarde : en local (localStorage), par compte. La collection ne se
// synchronise donc pas encore entre appareils.

// ── Raretés ──────────────────────────────────────────────────────────────────
//
// coinValue (doublon → Anigold) : volontairement bas. Les 10 cartes d'un booster
// sont toutes conservées, donc les doublons sont fréquents et le recyclage
// doit rester un complément, pas une source d'enrichissement : même à 100 % de
// collection, un booster recycle ~60 Anigold pour 200 de prix en boutique. La
// boutique reste ainsi un vrai puits d'Anigold et le revenu évolue en douceur
// (voir NEW_CARD_COINS, DAILY_REWARDS et seriesCompletionBonus).

export const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary", "secret"];

// tint : dégradé de fond de carte · ornate : cadre ("none" | "double" bordure |
// "corners" = double bordure + coins ornés) · accent : couleur de ces ornements ·
// flashPeak : intensité du flash plein écran à la révélation (0 = aucun).
export const RARITY = {
  common:    { label: "Common",    emoji: "⚪", desc: "Personnages secondaires",      coinValue: 3,  shine: false, grad: "from-slate-400 to-slate-500",     text: "text-slate-200",   border: "border-slate-300/50",  glow: "rgba(203,213,225,0.30)", auraDuration: 3.4, auraPeak: 0.20, tint: "from-slate-500/25 to-violet-950", ornate: "none", accent: "border-slate-300", flashPeak: 0 },
  uncommon:  { label: "Uncommon",  emoji: "🟢", desc: "Personnages connus",           coinValue: 5,  shine: false, grad: "from-emerald-400 to-green-600",   text: "text-emerald-300", border: "border-emerald-400/60", glow: "rgba(52,211,153,0.40)",  auraDuration: 3.1, auraPeak: 0.26, tint: "from-emerald-500/25 to-violet-950", ornate: "none", accent: "border-emerald-300", flashPeak: 0 },
  rare:      { label: "Rare",      emoji: "🔵", desc: "Personnages populaires",       coinValue: 10,  shine: false, grad: "from-sky-400 to-blue-600",        text: "text-sky-300",     border: "border-sky-400/60",     glow: "rgba(56,189,248,0.45)",  auraDuration: 2.7, auraPeak: 0.34, tint: "from-sky-500/30 to-violet-950", ornate: "none", accent: "border-sky-300", flashPeak: 0 },
  epic:      { label: "Epic",      emoji: "🟣", desc: "Personnages très populaires",  coinValue: 25,  shine: false, grad: "from-fuchsia-400 to-purple-600",  text: "text-fuchsia-300", border: "border-fuchsia-400/60", glow: "rgba(217,70,239,0.50)",  auraDuration: 2.3, auraPeak: 0.44, tint: "from-fuchsia-500/35 to-violet-950", ornate: "double", accent: "border-fuchsia-300", flashPeak: 0.22 },
  legendary: { label: "Legendary", emoji: "🟡", desc: "Personnages iconiques",        coinValue: 60, shine: true,  grad: "from-amber-300 to-orange-500",    text: "text-amber-300",   border: "border-amber-400/70",   glow: "rgba(251,191,36,0.60)",  auraDuration: 1.8, auraPeak: 0.60, tint: "from-amber-400/40 to-violet-950", ornate: "corners", accent: "border-amber-300", flashPeak: 0.38 },
  secret:    { label: "Secret",    emoji: "🔴", desc: "Extrêmement rares",            coinValue: 200, shine: true,  grad: "from-rose-500 to-red-700",        text: "text-rose-300",    border: "border-rose-500/80",    glow: "rgba(244,63,94,0.70)",   auraDuration: 1.3, auraPeak: 0.78, tint: "from-rose-500/45 to-violet-950", ornate: "corners", accent: "border-rose-300", flashPeak: 0.55 },
};

// Anciennes clés (v1 du jeu, 4 paliers en français) — pour migrer les sauvegardes.
const LEGACY_TIERS = { commune: "common", epique: "epic", legendaire: "legendary" };

export function normalizeTier(tier) {
  if (RARITY[tier]) return tier;
  return LEGACY_TIERS[tier] || "common";
}

// Découpage du bassin, du plus rare au plus courant. `share` = part CUMULÉE
// du classement (triés par favoris décroissants) : les 0,5 % premiers sont
// Secret, jusqu'à 3,5 % Legendary, etc. Exemple sur 3 000 personnages :
// 15 Secret · 90 Legendary · 195 Epic · 450 Rare · 750 Uncommon · 1 500 Common.
const TIER_CUTOFFS = [
  { tier: "secret",    share: 0.005 },
  { tier: "legendary", share: 0.035 },
  { tier: "epic",      share: 0.10  },
  { tier: "rare",      share: 0.25  },
  { tier: "uncommon",  share: 0.50  },
  { tier: "common",    share: 1.00  }, // reste
];

/** Attribue une rareté à chaque personnage selon son rang dans le tableau (déjà trié par favoris desc). */
export function computeTiers(sortedPool) {
  const n = sortedPool.length;
  let cursor = 0;
  const bounds = TIER_CUTOFFS.map(({ tier, share }) => {
    const end = Math.max(cursor, Math.round(n * share));
    const b = { tier, start: cursor, end };
    cursor = end;
    return b;
  });
  return sortedPool.map((c, i) => ({
    ...c,
    tier: bounds.find((b) => i >= b.start && i < b.end)?.tier || "common",
  }));
}

/** Nombre de personnages par palier dans une liste. */
export function countByTier(list) {
  const counts = Object.fromEntries(RARITY_ORDER.map((t) => [t, 0]));
  list.forEach((c) => { counts[normalizeTier(c.tier)]++; });
  return counts;
}

/**
 * Score du classement entre amis (voir SocialTab) : pondère les personnages
 * DISTINCTS possédés par palier — les doublons ne gonflent pas le score,
 * pour que ce soit la diversité de la collection qui compte, pas le farm.
 * Prend un résultat de countByTier(), pas une liste brute.
 */
export const SCORE_WEIGHT = { common: 1, uncommon: 2, rare: 4, epic: 8, legendary: 20, secret: 50 };
export function collectionScore(tierCounts) {
  return RARITY_ORDER.reduce((sum, t) => sum + (tierCounts[t] || 0) * SCORE_WEIGHT[t], 0);
}

/**
 * Clé de regroupement par série : l'id MAL de la série si on l'a (fiable),
 * sinon son nom (repli si la série n'a pas pu être déterminée lors de la
 * synchro — voir scripts/sync-waifu-pool.mjs). Partagée par groupPoolBySeries
 * et par la détection de complétion de série (claimPackCards) pour
 * qu'elles s'accordent toujours sur ce qui constitue "la même série".
 */
export function seriesKeyOf(c) {
  return c.seriesId != null ? `id:${c.seriesId}` : `name:${(c.series || "").toLowerCase()}`;
}

/**
 * Regroupe le bassin par série (anime). Dans chaque groupe, les personnages
 * sont triés du plus rare au plus courant. Sert à l'onglet "Explorer"
 * (silhouettes des non-obtenus) et au bonus de complétion par série.
 */
export function groupPoolBySeries(pool) {
  const order = Object.fromEntries(RARITY_ORDER.map((t, i) => [t, i]));
  const map = new Map();
  for (const c of pool) {
    const key = seriesKeyOf(c);
    if (!map.has(key)) map.set(key, { key, seriesId: c.seriesId ?? null, series: c.series || "Série inconnue", characters: [] });
    map.get(key).characters.push(c);
  }
  for (const g of map.values()) {
    g.characters.sort((a, b) =>
      order[normalizeTier(b.tier)] - order[normalizeTier(a.tier)] || b.favourites - a.favourites);
  }
  return [...map.values()];
}

// ── Probabilités de tirage ───────────────────────────────────────────────────
// PAR CARTE, indépendantes de la composition du bassin (chaque ligne = 1).
// Une seule table : tous les boosters (gratuit, normal, Waifus/Husbandos,
// ciblé, vœu) tirent avec les mêmes chances. Ce qui change, c'est le bassin
// (tout, un genre, une série) et le prix.
export const PACK_WEIGHTS = {
  standard: { common: 0.550, uncommon: 0.280, rare: 0.120, epic: 0.040, legendary: 0.009, secret: 0.001 },
};

// Monnaie du jeu : l'Anigold. `coins` reste une copie locale/cache ; la source de vérité est le wallet Supabase.
//
// Prix de la boutique, pensés pour des boosters dont les 10 cartes sont
// conservées : un booster normal vaut ce que vaut un booster gratuit (qu'on
// obtient toutes les 3 h), donc on paie surtout pour ne pas attendre. Les
// autres boosters se positionnent par rapport à lui :
//   normal 200 · Waifus/Husbandos 260 (×1,3, pool filtré) · ciblé 500 (×2,5,
//   un booster de série peut déclencher le bonus de complétion) · vœu =
//   booster normal + une prime qui grimpe avec la rareté.
// Simulation sur 120 jours : un joueur qui dépense tout en boosters normaux à
// 200 gagne ~52 000 Anigold et en dépense ~52 000 — l'économie ne gonfle pas.
export const BOOSTER_SIZE         = 10;
export const FREE_COOLDOWN_HOURS  = 3;
export const FREE_COOLDOWN_MS     = FREE_COOLDOWN_HOURS * 60 * 60 * 1000; // 1 booster gratuit toutes les 3 h
export const SHOP_BOOSTER_COST    = 200;
export const SHOP_GENDER_COST     = 260; // booster réservé aux waifus OU aux husbandos
export const SHOP_TARGET_COST     = 500; // booster limité à une série

// Vœu : garantit un personnage PRÉCIS (pas juste une série) dans le prochain
// booster de 10 — bien plus fort qu'un booster ciblé. Toujours plus cher
// qu'un booster normal (le vœu en est un, avec 9 autres cartes), et scalé par
// palier : garantir un Secret vaut nettement plus qu'un Common.
export const WISH_COST = {
  common: 250, uncommon: 300, rare: 450, epic: 800, legendary: 1600, secret: 3500,
};
export function wishCost(tier) {
  return WISH_COST[normalizeTier(tier)];
}

// ── Genre ────────────────────────────────────────────────────────────────────

/** Normalise le texte libre d'AniList → "female" | "male" | "other" | null (inconnu). */
export function normalizeGender(raw) {
  if (typeof raw !== "string") return null;
  const g = raw.trim().toLowerCase();
  if (!g) return null;
  if (g === "f" || g.startsWith("female")) return "female";
  if (g === "m" || g.startsWith("male"))   return "male";
  return "other";
}

// Boosters réservés à un genre (payants, voir la boutique). Les personnages
// « autres » / de genre inconnu ne sortent que des boosters non filtrés.
export const GENDER_BOOSTERS = {
  female: { label: "Waifus",    source: "waifu" },
  male:   { label: "Husbandos", source: "husbando" },
};

// Filtre de la collection.
export const GENDER_FILTER_LABEL = { all: "Tous", female: "♀ Waifus", male: "♂ Husbandos", other: "Autres" };

export function matchesGender(card, filter) {
  if (filter === "all") return true;
  if (filter === "other") return card.gender !== "female" && card.gender !== "male";
  return card.gender === filter;
}

export function filterPoolByGender(pool, gender) {
  return gender === "all" ? pool : pool.filter((c) => c.gender === gender);
}

// ── Tirage ───────────────────────────────────────────────────────────────────

function pickTier(weights) {
  const r = Math.random();
  let acc = 0;
  for (const tier of RARITY_ORDER) {
    acc += weights[tier] || 0;
    if (r < acc) return tier;
  }
  return "common";
}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Palier vide dans le bassin fourni (filtre genre/série serré) → palier non
// vide le plus proche, en préférant le palier inférieur à distance égale.
function nearestTier(byTier, tier) {
  const i = RARITY_ORDER.indexOf(tier);
  for (let d = 1; d < RARITY_ORDER.length; d++) {
    const lo = RARITY_ORDER[i - d];
    const hi = RARITY_ORDER[i + d];
    if (lo && byTier[lo].length) return lo;
    if (hi && byTier[hi].length) return hi;
  }
  return tier;
}

/**
 * generatePack — tire `count` personnages depuis `pool`, pondérés par
 * `weights`. Un même personnage n'apparaît qu'une fois par booster tant que
 * le palier tiré contient d'autres candidats.
 */
function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * `forcedCard` (booster vœu) : garanti dans les `count` cartes, à une
 * position mélangée parmi les autres (pas toujours en premier, sinon il se
 * repère trop vite au tirage). Le reste du booster est tiré normalement,
 * sans jamais retirer une 2e fois ce personnage par hasard.
 */
export function generatePack(pool, weights, count = BOOSTER_SIZE, forcedCard = null, banner = null) {
  if (!pool.length) return [];
  const byTier = Object.fromEntries(RARITY_ORDER.map((t) => [t, pool.filter((c) => c.tier === t)]));
  // Bannière : sous-ensemble « mis en avant » de chaque palier (voir utils/waifinityBanners.js).
  const featuredByTier = banner
    ? Object.fromEntries(RARITY_ORDER.map((t) => [t, byTier[t].filter((c) => banner.featuredIds.has(c.id))]))
    : null;

  const used = new Set();
  const cards = [];

  if (forcedCard) {
    used.add(forcedCard.id);
    cards.push({ ...forcedCard, tier: normalizeTier(forcedCard.tier), wish: true });
  }

  while (cards.length < count) {
    let tier = pickTier(weights);
    if (!byTier[tier].length) tier = nearestTier(byTier, tier);

    let candidates = byTier[tier].filter((c) => !used.has(c.id));
    let fromBanner = false;
    if (featuredByTier && Math.random() < banner.rate) {
      const featured = featuredByTier[tier].filter((c) => !used.has(c.id));
      if (featured.length) { candidates = featured; fromBanner = true; }
    }
    const card = pickRandom(candidates.length ? candidates : byTier[tier]);
    used.add(card.id);
    cards.push({ ...card, tier, ...(fromBanner ? { banner: true } : {}) });
  }

  return shuffled(cards).map((c, i) => ({ ...c, packSlot: i }));
}

// ── Sauvegarde locale ────────────────────────────────────────────────────────

const STORAGE_KEY = (uid) => `av_waifinity_${uid}`;

export function defaultState() {
  return {
    coins:              0,
    lastFreeOpenedAt:   0,       // 0 = jamais ouvert → booster dispo immédiatement
    collection:         {},      // { [characterId]: { id, count, tier, gender, name, series, firstObtainedAt } } — pas d'image ici, voir collectionList dans useWaifinity
    pendingPack:        null,    // { source, cards: [...10], openedAt, claimId } — claimId rend la récompense AniGold idempotente côté Supabase
    stats:              { opened: 0, obtained: 0, duplicates: 0 },
    favorites:          [],      // ids épinglés en tête de collection (MAX_FAVORITES max)
    completedSeries:    {},      // { [seriesKey]: { series, coins, completedAt } } — bonus déjà versé, une seule fois par série
    dailyStreak:        0,       // jour (1-7) de la dernière récompense quotidienne récupérée
    lastDailyKey:       null,    // "AAAA-MM-JJ" (jour local) de cette récupération
    fragments:          0,       // gagnés sur les doublons, dépensés à l'Atelier (voir waifinityCosmetics.js)
    cosmetics:          defaultCosmetics(), // { owned: [ids], equipped: { [characterId]: { frame, effect } } }
    missions:           null,    // { dayKey, list, bonusClaimed } — créé à la demande (voir waifinityMissions.js)
    extrasUpdatedAt:    0,       // dernière synchro de favoris/fragments/cosmétiques avec Supabase (ms)
  };
}

// Anciennes sauvegardes : paliers en français (commune/epique/legendaire) et
// ancienne préférence de genre gratuite (`genderPref`, supprimée).
function migrateState({ genderPref: _legacyGenderPref, ...s }) {
  const collection = {};
  for (const [id, e] of Object.entries(s.collection || {})) {
    collection[id] = { ...e, tier: normalizeTier(e.tier) };
  }
  const pendingPack = s.pendingPack
    ? { ...s.pendingPack, cards: (s.pendingPack.cards || []).map((c) => ({ ...c, tier: normalizeTier(c.tier) })) }
    : null;
  return { ...s, collection, pendingPack };
}

export function loadState(uid) {
  if (!uid) return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY(uid));
    if (!raw) return defaultState();
    return migrateState({ ...defaultState(), ...JSON.parse(raw) });
  } catch {
    return defaultState();
  }
}

/** Évènement window émis après chaque sauvegarde réussie (voir
 *  hooks/useWaifinityNotifications.js : il suit lastFreeOpenedAt sans relire
 *  toute la sauvegarde). detail = { uid, lastFreeOpenedAt }. */
export const WAIFINITY_SAVED_EVENT = "waifinity:saved";

function emitSaved(uid, state) {
  try {
    window.dispatchEvent(new CustomEvent(WAIFINITY_SAVED_EVENT, {
      detail: { uid, lastFreeOpenedAt: state?.lastFreeOpenedAt ?? 0 },
    }));
  } catch { /* hors navigateur */ }
}

/** true si la sauvegarde a réussi — false = stockage plein/indisponible, la
 *  progression de cette action n'a PAS été conservée (voir useWaifinity.persist,
 *  qui répare via le miroir Supabase dans ce cas). */
export function saveState(uid, state) {
  if (!uid) return false;
  const payload = JSON.stringify(state);
  try { localStorage.setItem(STORAGE_KEY(uid), payload); emitSaved(uid, state); return true; }
  catch {
    // Le quota localStorage est partagé par toute l'app : souvent ce n'est
    // pas Waifinity qui est volumineux, mais d'autres caches (recos,
    // calendrier…) jamais nettoyés (voir lib/cache.js, déjà utilisé pour ce
    // même repli côté setCached). On purge, puis on retente une fois.
    try {
      purgeStaleCaches();
      localStorage.setItem(STORAGE_KEY(uid), payload);
      emitSaved(uid, state);
      return true;
    } catch { return false; }
  }
}

export const MAX_FAVORITES = 10;
export const NEW_BADGE_MS  = 24 * 60 * 60 * 1000;

/** Personnage obtenu depuis moins de 24 h → petit badge « NEW » sur sa carte. */
export function isRecentlyObtained(entry) {
  return !!entry?.firstObtainedAt && Date.now() - entry.firstObtainedAt < NEW_BADGE_MS;
}

export function coinsForDuplicate(tier) {
  return RARITY[normalizeTier(tier)].coinValue;
}

// Prime de première obtention : petit revenu « de découverte » qui compense le
// fait que, en début de partie, presque aucune carte n'est un doublon.
export const NEW_CARD_COINS = { common: 1, uncommon: 2, rare: 4, epic: 8, legendary: 20, secret: 50 };
export function coinsForNew(tier) {
  return NEW_CARD_COINS[normalizeTier(tier)];
}

/**
 * Bonus (en une fois) pour avoir obtenu TOUS les personnages d'une série du
 * bassin. Les séries de moins de 3 personnages ne donnent rien (trop faciles
 * à finir, et elles gonflaient le revenu des débuts) ; au-delà : 40 + 8 par
 * personnage, plafonné à 400 — une grosse franchise reste bien récompensée
 * sans valoir plus qu'un vœu sur un Legendary.
 */
export const SERIES_MIN_SIZE = 3;
export const SERIES_BONUS_CAP = 400;
export function seriesCompletionBonus(characterCount) {
  if (characterCount < SERIES_MIN_SIZE) return 0;
  return Math.min(SERIES_BONUS_CAP, Math.round(40 + characterCount * 8));
}

// ── Récompense quotidienne ───────────────────────────────────────────────────
// Série de 7 jours : +10, +10, +15, +15, +20, +25, puis +50 le 7e jour. Une
// journée manquée remet la série au jour 1. Le jour est celui de l'appareil.
export const DAILY_REWARDS = [10, 10, 15, 15, 20, 25, 50];

function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** État de la récompense du jour, à partir de l'état sauvegardé. */
export function dailyStatus(state, now = new Date()) {
  const todayKey = dayKey(now);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const streak = state.dailyStreak || 0;
  const claimed = state.lastDailyKey === todayKey;
  const continuing = state.lastDailyKey === dayKey(yesterday);
  const nextStreak = claimed ? streak : (continuing ? (streak % DAILY_REWARDS.length) + 1 : 1);
  return { todayKey, claimed, streak, nextStreak, reward: DAILY_REWARDS[nextStreak - 1] };
}

/** Millisecondes avant le prochain booster gratuit (0 = disponible maintenant). */
export function msUntilFreeBooster(lastFreeOpenedAt) {
  if (!lastFreeOpenedAt) return 0;
  return Math.max(0, lastFreeOpenedAt + FREE_COOLDOWN_MS - Date.now());
}

/** "2:59:59" (h:mm:ss) — le cooldown dure plusieurs heures. */
export function formatCountdown(ms) {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** "0,1 %" / "55 %" — pourcentage lisible d'une probabilité 0-1. */
export function formatPercent(p) {
  return `${(p * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`;
}

/** Les N séries les mieux représentées du bassin (pour le booster ciblé). */
export function topSeries(pool, limit = 40) {
  const counts = new Map();
  pool.forEach((c) => {
    if (c.seriesId == null) return;
    const cur = counts.get(c.seriesId) || { seriesId: c.seriesId, series: c.series, count: 0 };
    cur.count++;
    counts.set(c.seriesId, cur);
  });
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}


// ── Stats des personnages ────────────────────────────────────────────────────
// Colonnes int2 de waifinity_characters. Échelle supposée : 0–100 — ajuste les
// seuils de STAT_GRADES si ta plage est différente.
export const STATS = [
  { key: "intelligence", short: "INT", label: "Intelligence" },
  { key: "strength",     short: "STR", label: "Strength" },
  { key: "dexterity",    short: "DEX", label: "Dexterity" },
  { key: "wisdom",       short: "WIS", label: "Wisdom" },
  { key: "luck",         short: "LCK", label: "Luck" },
  { key: "endurance",    short: "END", label: "Endurance" },
  { key: "charisma",     short: "CHA", label: "Charisma" },
];

const STAT_GRADES = [
  { min: 90, letter: "S", cls: "text-amber-300" },
  { min: 75, letter: "A", cls: "text-fuchsia-300" },
  { min: 60, letter: "B", cls: "text-sky-300" },
  { min: 45, letter: "C", cls: "text-emerald-300" },
  { min: 30, letter: "D", cls: "text-slate-200" },
  { min: 15, letter: "E", cls: "text-slate-400" },
  { min: -Infinity, letter: "F", cls: "text-slate-500" },
];

/** Valeur de stat → { letter, cls } (grade S → F). */
export function statGrade(value) {
  return STAT_GRADES.find((g) => value >= g.min);
}

/**
 * Ajoute TOUTES les cartes d'un booster à la collection (plus d'adoption : les
 * 10 cartes sont conservées). Fonction pure — renvoie le nouvel état et le
 * détail par carte pour l'écran de résultat.
 *
 * - Nouveau personnage → entrée créée + petite prime (coinsForNew) ; doublon
 *   (déjà possédé, OU déjà apparu plus tôt dans ce même booster) → compteur
 *   +1 et Anigold (coinsForDuplicate). `coinsGained` vaut l'un ou l'autre.
 * - Bonus de complétion de série : évalué carte après carte, donc une série
 *   complétée par la 7e carte du booster est bien détectée, et jamais versée
 *   deux fois (state.completedSeries).
 * - Sans pendingPack, ne fait rien (protège d'un double clic).
 */
export function claimPackCards(state, cards, pool) {
  if (!state.pendingPack) return { state, results: [] };

  const collection = { ...state.collection };
  const completedSeries = { ...state.completedSeries };
  let coins = state.coins;
  let fragments = state.fragments || 0;
  let newCount = 0;
  let dupCount = 0;
  const now = Date.now();
  const results = [];

  for (const card of cards) {
    const existing = collection[card.id];
    const isDuplicate = !!existing;
    const coinsGained = isDuplicate ? coinsForDuplicate(card.tier) : coinsForNew(card.tier);
    const fragmentsGained = isDuplicate ? fragmentsForDuplicate(normalizeTier(card.tier)) : 0;

    collection[card.id] = existing
      ? { ...existing, count: existing.count + 1 }
      : {
          id: card.id, name: card.name, series: card.series,
          tier: card.tier, gender: card.gender ?? null, count: 1, firstObtainedAt: now,
        };
    coins += coinsGained;
    fragments += fragmentsGained;
    if (isDuplicate) dupCount++; else newCount++;

    let seriesBonus = null;
    if (!isDuplicate) {
      const key = seriesKeyOf(card);
      if (!completedSeries[key]) {
        const seriesChars = pool.filter((c) => seriesKeyOf(c) === key);
        const stillMissing = seriesChars.some((c) => !collection[c.id]);
        if (seriesChars.length > 0 && !stillMissing) {
          const bonus = seriesCompletionBonus(seriesChars.length);
          completedSeries[key] = { series: card.series, coins: bonus, completedAt: now };
          if (bonus > 0) {
            seriesBonus = { key, series: card.series, coins: bonus };
            coins += bonus;
          }
        }
      }
    }

    results.push({ card, isDuplicate, coinsGained, fragmentsGained, seriesBonus, count: collection[card.id].count });
  }

  return {
    state: {
      ...state,
      coins,
      fragments,
      pendingPack: null,
      collection,
      completedSeries,
      stats: {
        ...state.stats,
        obtained:   state.stats.obtained + newCount,
        duplicates: state.stats.duplicates + dupCount,
      },
    },
    results,
  };
}
