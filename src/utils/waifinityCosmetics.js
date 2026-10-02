// ── Waifinity : fragments & cosmétiques ─────────────────────────────────────
//
// Chaque doublon récupéré donne des FRAGMENTS (en plus de l'Anigold, voir
// coinValue dans utils/waifinity.js : l'économie en pièces n'est pas touchée).
// Les fragments s'échangent, à l'Atelier, contre des cosmétiques : des cadres
// et des effets qui s'équipent sur UN personnage possédé. Un cosmétique
// acheté est débloqué pour toute la collection (on peut l'équiper sur
// plusieurs personnages).
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

/**
 * slot "frame"  : remplace la bordure de la carte (couleur + halo).
 * slot "effect" : calque animé par-dessus l'illustration (voir .cos-fx-* dans
 *                 styles/animations.css).
 */
export const COSMETICS = [
  { id: "frame_gold",     slot: "frame",  name: "Cadre doré",       desc: "Bordure or et coins ornés.",       cost: 120,
    color: "#fbbf24", glow: "rgba(251,191,36,0.75)", accent: "#fde68a", corners: true },
  { id: "frame_sakura",   slot: "frame",  name: "Cadre sakura",     desc: "Rose pâle, doux halo de pétales.", cost: 150,
    color: "#f9a8d4", glow: "rgba(249,168,212,0.70)", accent: "#fff1f2" },
  { id: "frame_neon",     slot: "frame",  name: "Cadre néon",       desc: "Cyan électrique qui pulse.",       cost: 180,
    color: "#22d3ee", glow: "rgba(34,211,238,0.80)", accent: "#f0abfc", className: "cos-neon" },
  { id: "frame_obsidian", slot: "frame",  name: "Cadre obsidienne", desc: "Noir profond, liseré violet.",     cost: 250,
    color: "#312e81", glow: "rgba(167,139,250,0.65)", accent: "#a78bfa", corners: true },
  { id: "fx_holo",        slot: "effect", name: "Holographique",    desc: "Reflet arc-en-ciel qui glisse.",   cost: 200, className: "cos-fx-holo" },
  { id: "fx_sparkle",     slot: "effect", name: "Étincelles",       desc: "Petites étoiles qui scintillent.", cost: 300, className: "cos-fx-sparkle" },
  { id: "fx_pulse",       slot: "effect", name: "Aura vivante",     desc: "Lueur intérieure qui respire.",    cost: 350, className: "cos-fx-pulse" },
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
  return { owned: [], equipped: {} };
}
