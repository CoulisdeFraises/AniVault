// ── Waifinity : fragments & cosmétiques ─────────────────────────────────────
//
// Chaque doublon récupéré donne des FRAGMENTS (en plus de l'Anigold, voir
// coinValue dans utils/waifinity.js : l'économie en pièces n'est pas touchée).
//
// Les fragments s'échangent, à l'Atelier, contre des cosmétiques. Un cosmétique
// est un CONSOMMABLE : on l'achète (il rejoint le stock), puis on l'applique à
// UNE carte précise — l'objet est alors consommé et reste sur cette carte.
// Pour décorer une autre carte, il faut en racheter un. Appliquer un objet sur
// un emplacement déjà occupé remplace (et détruit) l'ancien.
//
// Ce fichier ne dépend d'aucun autre module du jeu (utils/waifinity.js
// l'importe) : les paliers y sont donc désignés par leur clé normalisée.

/** Fragments par doublon, selon la rareté de la carte. */
export const FRAGMENT_VALUE = {
  common: 3, uncommon: 5, rare: 10, epic: 20, legendary: 50, secret: 120,
};

export function fragmentsForDuplicate(tier) {
  return FRAGMENT_VALUE[tier] ?? FRAGMENT_VALUE.common;
}

/** Stock maximum d'un même cosmétique (évite les achats par erreur en masse). */
export const MAX_COSMETIC_STOCK = 20;
/** Quantité maximale achetable d'un coup depuis l'Atelier. */
export const MAX_BUY_AT_ONCE = 5;

/** Grades d'affichage (du plus courant au plus prestigieux). */
export const COSMETIC_GRADES = {
  1: { label: "Classique" },
  2: { label: "Rare" },
  3: { label: "Épique" },
  4: { label: "Légendaire" },
};

/**
 * slot "frame"  : remplace la bordure de la carte (couleur + halo).
 * slot "effect" : calque animé par-dessus l'illustration (voir .cos-fx-* dans
 *                 styles/animations.css).
 * `cost` = prix d'UNE unité (un cosmétique = une carte).
 */
export const COSMETICS = [
  // ── Cadres ──
  { id: "frame_emerald",  slot: "frame",  grade: 1, name: "Cadre émeraude",   desc: "Vert profond et coins ornés.",       cost: 40,
    color: "#34d399", glow: "rgba(52,211,153,0.65)", accent: "#a7f3d0", corners: true },
  { id: "frame_gold",     slot: "frame",  grade: 1, name: "Cadre doré",       desc: "Bordure or et coins ornés.",         cost: 45,
    color: "#fbbf24", glow: "rgba(251,191,36,0.75)", accent: "#fde68a", corners: true },
  { id: "frame_sakura",   slot: "frame",  grade: 1, name: "Cadre sakura",     desc: "Rose pâle, doux halo de pétales.",   cost: 50,
    color: "#f9a8d4", glow: "rgba(249,168,212,0.70)", accent: "#fff1f2" },
  { id: "frame_crimson",  slot: "frame",  grade: 2, name: "Cadre cramoisi",   desc: "Rouge intense, coins ornés.",        cost: 55,
    color: "#f43f5e", glow: "rgba(244,63,94,0.70)", accent: "#fecdd3", corners: true },
  { id: "frame_neon",     slot: "frame",  grade: 2, name: "Cadre néon",       desc: "Cyan électrique qui pulse.",         cost: 65,
    color: "#22d3ee", glow: "rgba(34,211,238,0.80)", accent: "#f0abfc", className: "cos-neon" },
  { id: "frame_frost",    slot: "frame",  grade: 2, name: "Cadre givré",      desc: "Bleu glacé, halo de givre.",         cost: 75,
    color: "#7dd3fc", glow: "rgba(125,211,252,0.70)", accent: "#e0f2fe", className: "cos-frost" },
  { id: "frame_obsidian", slot: "frame",  grade: 3, name: "Cadre obsidienne", desc: "Noir profond, liseré violet.",       cost: 85,
    color: "#312e81", glow: "rgba(167,139,250,0.65)", accent: "#a78bfa", corners: true },
  { id: "frame_inferno",  slot: "frame",  grade: 3, name: "Cadre infernal",   desc: "Braise orangée qui vacille.",        cost: 95,
    color: "#fb923c", glow: "rgba(251,146,60,0.80)", accent: "#fde68a", corners: true, className: "cos-inferno" },
  { id: "frame_prism",    slot: "frame",  grade: 4, name: "Cadre prisme",     desc: "Toutes les couleurs, en boucle.",    cost: 130,
    color: "#f0abfc", glow: "rgba(240,171,252,0.80)", accent: "#ffffff", corners: true, className: "cos-prism" },

  // ── Effets ──
  { id: "fx_shine",       slot: "effect", grade: 1, name: "Reflet",           desc: "Un éclat qui traverse la carte.",    cost: 45,  className: "cos-fx-shine" },
  { id: "fx_petals",      slot: "effect", grade: 2, name: "Pétales",          desc: "Pétales de sakura qui tombent.",     cost: 70,  className: "cos-fx-petals" },
  { id: "fx_sparkle",     slot: "effect", grade: 2, name: "Étincelles",       desc: "Petites étoiles qui scintillent.",   cost: 80,  className: "cos-fx-sparkle" },
  { id: "fx_scan",        slot: "effect", grade: 2, name: "Rétro",            desc: "Lignes de balayage façon écran CRT.", cost: 80, className: "cos-fx-scan" },
  { id: "fx_holo",        slot: "effect", grade: 3, name: "Holographique",    desc: "Reflet arc-en-ciel qui glisse.",     cost: 100, className: "cos-fx-holo" },
  { id: "fx_embers",      slot: "effect", grade: 3, name: "Braises",          desc: "Des braises montent de la carte.",   cost: 110, className: "cos-fx-embers" },
  { id: "fx_pulse",       slot: "effect", grade: 3, name: "Aura vivante",     desc: "Lueur intérieure qui respire.",      cost: 120, className: "cos-fx-pulse" },
  { id: "fx_aurora",      slot: "effect", grade: 4, name: "Aurore",           desc: "Rideaux de lumière boréale.",        cost: 150, className: "cos-fx-aurora" },
];

export const COSMETICS_BY_ID = Object.fromEntries(COSMETICS.map((c) => [c.id, c]));
export const COSMETIC_SLOTS = [
  { key: "frame",  label: "Cadres" },
  { key: "effect", label: "Effets" },
];

/** { frame, effect } (ids) → { frame, effect } (objets du catalogue, ou null). */
export function resolveCosmetic(equipped) {
  if (!equipped) return { frame: null, effect: null };
  return {
    frame:  equipped.frame  ? COSMETICS_BY_ID[equipped.frame]  || null : null,
    effect: equipped.effect ? COSMETICS_BY_ID[equipped.effect] || null : null,
  };
}

export function defaultCosmetics() {
  return { inventory: {}, equipped: {} };
}

/**
 * Normalise l'état des cosmétiques (sauvegarde locale ou ligne Supabase).
 *
 *  - Nouveau format : { inventory: { [id]: quantité }, equipped: { [characterId]: { frame, effect } } }.
 *  - Ancien format  : { owned: [ids], equipped } — des cosmétiques « débloqués » pour toute la
 *    collection. Migration sans perte : ce qui est déjà équipé sur une carte y reste, et chaque
 *    cosmétique acheté mais équipé nulle part est converti en 1 exemplaire dans le stock.
 */
export function normalizeCosmetics(raw) {
  const equipped = {};
  for (const [charId, e] of Object.entries(raw?.equipped || {})) {
    const frame = e?.frame || null;
    const effect = e?.effect || null;
    if (frame || effect) equipped[charId] = { frame, effect };
  }

  const inventory = {};
  if (raw?.inventory && typeof raw.inventory === "object") {
    for (const [id, qty] of Object.entries(raw.inventory)) {
      const n = Math.floor(Number(qty));
      if (COSMETICS_BY_ID[id] && n > 0) inventory[id] = Math.min(n, MAX_COSMETIC_STOCK);
    }
  } else if (Array.isArray(raw?.owned)) {
    const used = new Set();
    for (const e of Object.values(equipped)) { if (e.frame) used.add(e.frame); if (e.effect) used.add(e.effect); }
    for (const id of raw.owned) {
      if (COSMETICS_BY_ID[id] && !used.has(id)) inventory[id] = 1;
    }
  }
  return { inventory, equipped };
}

/** Nombre total d'objets en stock. */
export function stockCount(inventory) {
  return Object.values(inventory || {}).reduce((sum, n) => sum + (n > 0 ? n : 0), 0);
}
