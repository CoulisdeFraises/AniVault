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

export const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary", "secret"];

export const RARITY = {
  common:    { label: "Common",    emoji: "⚪", desc: "Personnages secondaires",      coinValue: 5,   shine: false, grad: "from-slate-400 to-slate-500",     text: "text-slate-200",   border: "border-slate-300/50",  glow: "rgba(203,213,225,0.30)" },
  uncommon:  { label: "Uncommon",  emoji: "🟢", desc: "Personnages connus",           coinValue: 10,  shine: false, grad: "from-emerald-400 to-green-600",   text: "text-emerald-300", border: "border-emerald-400/60", glow: "rgba(52,211,153,0.40)" },
  rare:      { label: "Rare",      emoji: "🔵", desc: "Personnages populaires",       coinValue: 20,  shine: false, grad: "from-sky-400 to-blue-600",        text: "text-sky-300",     border: "border-sky-400/60",     glow: "rgba(56,189,248,0.45)" },
  epic:      { label: "Epic",      emoji: "🟣", desc: "Personnages très populaires",  coinValue: 50,  shine: false, grad: "from-fuchsia-400 to-purple-600",  text: "text-fuchsia-300", border: "border-fuchsia-400/60", glow: "rgba(217,70,239,0.50)" },
  legendary: { label: "Legendary", emoji: "🟡", desc: "Personnages iconiques",        coinValue: 150, shine: true,  grad: "from-amber-300 to-orange-500",    text: "text-amber-300",   border: "border-amber-400/70",   glow: "rgba(251,191,36,0.60)" },
  secret:    { label: "Secret",    emoji: "🔴", desc: "Extrêmement rares",            coinValue: 500, shine: true,  grad: "from-rose-500 to-red-700",        text: "text-rose-300",    border: "border-rose-500/80",    glow: "rgba(244,63,94,0.70)" },
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

// ── Probabilités de tirage ───────────────────────────────────────────────────
// PAR CARTE, indépendantes de la composition du bassin (chaque ligne = 1).
// C'est ce qui rend un booster "plus chanceux" qu'un autre.
export const PACK_WEIGHTS = {
  free:   { common: 0.550, uncommon: 0.280, rare: 0.120, epic: 0.040, legendary: 0.009, secret: 0.001 },
  chance: { common: 0.250, uncommon: 0.330, rare: 0.250, epic: 0.130, legendary: 0.035, secret: 0.005 },
};

export const BOOSTER_SIZE      = 10;
export const FREE_COOLDOWN_MS  = 60 * 60 * 1000; // 1 booster gratuit par heure
export const SHOP_CHANCE_COST  = 150;
export const SHOP_TARGET_COST  = 250;

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

// Préférence de tirage (boosters) — "other"/inconnu ne sont tirés qu'en mode "all".
export const GENDER_PREFS = ["all", "female", "male"];
export const GENDER_PREF_LABEL = { all: "Tous", female: "Waifus", male: "Husbandos" };

// Filtre de la collection.
export const GENDER_FILTER_LABEL = { all: "Tous", female: "♀ Waifus", male: "♂ Husbandos", other: "Autres" };

export function matchesGender(card, filter) {
  if (filter === "all") return true;
  if (filter === "other") return card.gender !== "female" && card.gender !== "male";
  return card.gender === filter;
}

export function filterPoolByGender(pool, pref) {
  return pref === "all" ? pool : pool.filter((c) => c.gender === pref);
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
export function generatePack(pool, weights, count = BOOSTER_SIZE) {
  if (!pool.length) return [];
  const byTier = Object.fromEntries(RARITY_ORDER.map((t) => [t, pool.filter((c) => c.tier === t)]));

  const used = new Set();
  const pack = [];
  for (let i = 0; i < count; i++) {
    let tier = pickTier(weights);
    if (!byTier[tier].length) tier = nearestTier(byTier, tier);

    const candidates = byTier[tier].filter((c) => !used.has(c.id));
    const card = pickRandom(candidates.length ? candidates : byTier[tier]);
    used.add(card.id);
    pack.push({ ...card, tier, packSlot: i });
  }
  return pack;
}

// ── Sauvegarde locale ────────────────────────────────────────────────────────

const STORAGE_KEY = (uid) => `av_waifinity_${uid}`;

export function defaultState() {
  return {
    coins:              0,
    lastFreeOpenedAt:   0,       // 0 = jamais ouvert → booster dispo immédiatement
    genderPref:         "all",   // "all" | "female" | "male" — filtre les boosters
    collection:         {},      // { [characterId]: { id, count, tier, gender, name, image, series, firstObtainedAt } }
    pendingPack:        null,    // { source: "free"|"chance"|"targeted", cards: [...10], openedAt }
    stats:              { opened: 0, obtained: 0, duplicates: 0 },
  };
}

// Anciennes sauvegardes : paliers en français (commune/epique/legendaire).
function migrateState(s) {
  const collection = {};
  for (const [id, e] of Object.entries(s.collection || {})) {
    collection[id] = { ...e, tier: normalizeTier(e.tier) };
  }
  const pendingPack = s.pendingPack
    ? { ...s.pendingPack, cards: (s.pendingPack.cards || []).map((c) => ({ ...c, tier: normalizeTier(c.tier) })) }
    : null;
  return {
    ...s,
    collection,
    pendingPack,
    genderPref: GENDER_PREFS.includes(s.genderPref) ? s.genderPref : "all",
  };
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

export function saveState(uid, state) {
  if (!uid) return;
  try { localStorage.setItem(STORAGE_KEY(uid), JSON.stringify(state)); }
  catch { /* localStorage plein ou indisponible — on ignore, cohérent avec le reste de l'app */ }
}

export function coinsForDuplicate(tier) {
  return RARITY[normalizeTier(tier)].coinValue;
}

/** Millisecondes avant le prochain booster gratuit (0 = disponible maintenant). */
export function msUntilFreeBooster(lastFreeOpenedAt) {
  if (!lastFreeOpenedAt) return 0;
  return Math.max(0, lastFreeOpenedAt + FREE_COOLDOWN_MS - Date.now());
}

export function formatCountdown(ms) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60), s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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
