// ── Waifinity : règles du jeu ────────────────────────────────────────────────
//
// Rareté : calculée par RANG au sein du bassin de 300 personnages (voir
// api/waifu.js), pas sur une échelle absolue de favoris — le bassin change
// d'une actualisation à l'autre, le découpage en paliers reste stable.
//
// Sauvegarde : en local (localStorage), par compte. Contrairement au reste de
// la bibliothèque (Supabase), Waifinity ne nécessite pas de table côté
// serveur pour cette première version : la collection ne se synchronise donc
// pas encore entre appareils.

export const RARITY_ORDER = ["commune", "rare", "epique", "legendaire"];

export const RARITY = {
  commune:    { label: "Commune",    coinValue: 5,   grad: "from-slate-400 to-slate-500",   text: "text-slate-300",   border: "border-slate-400/50",   glow: "rgba(148,163,184,0.35)" },
  rare:       { label: "Rare",       coinValue: 15,  grad: "from-sky-400 to-blue-500",       text: "text-sky-300",     border: "border-sky-400/60",      glow: "rgba(56,189,248,0.45)" },
  epique:     { label: "Épique",     coinValue: 40,  grad: "from-fuchsia-400 to-purple-600", text: "text-fuchsia-300", border: "border-fuchsia-400/60",  glow: "rgba(217,70,239,0.5)" },
  legendaire: { label: "Légendaire", coinValue: 120, grad: "from-amber-300 to-orange-500",   text: "text-amber-300",   border: "border-amber-400/70",    glow: "rgba(251,191,36,0.6)" },
};

// Répartition du bassin par rang (les 300 personnages les plus favorisés
// d'AniList) — proportions volontairement pyramidales.
const TIER_CUTOFFS = [
  { tier: "legendaire", share: 0.03 },
  { tier: "epique",     share: 0.12 },
  { tier: "rare",       share: 0.35 },
  { tier: "commune",    share: 1.00 }, // reste
];

/** Attribue une rareté à chaque personnage selon son rang dans le tableau (déjà trié par favoris desc). */
export function computeTiers(sortedPool) {
  const n = sortedPool.length;
  let cursor = 0;
  const bounds = TIER_CUTOFFS.map(({ tier, share }) => {
    const end = Math.round(n * share);
    const b = { tier, start: cursor, end: Math.max(cursor, end) };
    cursor = b.end;
    return b;
  });
  return sortedPool.map((c, i) => ({
    ...c,
    tier: bounds.find((b) => i >= b.start && i < b.end)?.tier || "commune",
  }));
}

// Probabilités de tirage PAR CARTE (indépendantes de la composition réelle du
// bassin) — c'est ce qui rend un booster "plus chanceux" qu'un autre.
export const PACK_WEIGHTS = {
  free:   { commune: 0.60, rare: 0.30, epique: 0.08, legendaire: 0.02 },
  chance: { commune: 0.35, rare: 0.40, epique: 0.20, legendaire: 0.05 },
};

export const BOOSTER_SIZE      = 10;
export const FREE_COOLDOWN_MS  = 60 * 60 * 1000; // 1 booster gratuit par heure
export const SHOP_CHANCE_COST  = 150;
export const SHOP_TARGET_COST  = 250;

function pickTier(weights) {
  const r = Math.random();
  let acc = 0;
  for (const tier of RARITY_ORDER) {
    acc += weights[tier] || 0;
    if (r < acc) return tier;
  }
  return "commune";
}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/**
 * generatePack — tire `count` personnages (avec remise) depuis `pool`,
 * pondérés par `weights`. Si le palier tiré est vide dans le bassin fourni
 * (bassin filtré trop petit), retombe sur le palier le plus proche disponible.
 */
export function generatePack(pool, weights, count = BOOSTER_SIZE) {
  if (!pool.length) return [];
  const byTier = RARITY_ORDER.reduce((m, t) => {
    m[t] = pool.filter((c) => c.tier === t);
    return m;
  }, {});

  const pack = [];
  for (let i = 0; i < count; i++) {
    let tier = pickTier(weights);
    if (!byTier[tier].length) {
      tier = RARITY_ORDER.find((t) => byTier[t].length) || "commune";
    }
    pack.push({ ...pickRandom(byTier[tier]), tier, packSlot: i });
  }
  return pack;
}

// ── Sauvegarde locale ────────────────────────────────────────────────────────

const STORAGE_KEY = (uid) => `av_waifinity_${uid}`;

export function defaultState() {
  return {
    coins:              0,
    lastFreeOpenedAt:   0,       // 0 = jamais ouvert → booster dispo immédiatement
    collection:         {},      // { [characterId]: { count, tier, name, image, series, firstObtainedAt } }
    pendingPack:        null,    // { source: "free"|"chance"|"targeted", cards: [...10], openedAt }
    stats:              { opened: 0, obtained: 0, duplicates: 0 },
  };
}

export function loadState(uid) {
  if (!uid) return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY(uid));
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
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
  return RARITY[tier]?.coinValue ?? RARITY.commune.coinValue;
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

/** Les N séries les mieux représentées du bassin (pour le booster ciblé). */
export function topSeries(pool, limit = 24) {
  const counts = new Map();
  pool.forEach((c) => {
    if (c.seriesId == null) return;
    const cur = counts.get(c.seriesId) || { seriesId: c.seriesId, series: c.series, count: 0 };
    cur.count++;
    counts.set(c.seriesId, cur);
  });
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}
