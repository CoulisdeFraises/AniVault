import { countByTier, collectionScore } from "./waifinity.js";

// ── Niveau de joueur ─────────────────────────────────────────────────────────
//
// Calculé à la volée à partir du MÊME score que le classement entre amis
// (personnages distincts pondérés par rareté, voir collectionScore) : rien à
// sauvegarder, rien à synchroniser, et le niveau ne peut jamais diverger de
// ce que voient les amis.
//
// Le seuil du niveau n est 6 × (n − 1)² points : les premiers niveaux tombent
// vite (on se sent progresser dès les premiers boosters), puis ça ralentit.
// Avec les 3 000 personnages du bassin (≈ 8 900 points) on atteint le niveau 39.

const STEP = 6;

const TITLES = [
  { from: 1,  label: "Novice" },
  { from: 3,  label: "Apprenti" },
  { from: 6,  label: "Collectionneur" },
  { from: 10, label: "Expert" },
  { from: 16, label: "Maître" },
  { from: 25, label: "Légende" },
];

export function titleForLevel(level) {
  let current = TITLES[0].label;
  for (const t of TITLES) if (level >= t.from) current = t.label;
  return current;
}

/**
 * @param collectionList  liste des personnages possédés (avec .tier)
 * @returns { level, title, score, pct, toNext, nextLevel }
 *   pct = progression (0–100) vers le niveau suivant
 */
export function playerRank(collectionList = []) {
  const score = collectionScore(countByTier(collectionList));
  const level = 1 + Math.floor(Math.sqrt(score / STEP));
  const floor = STEP * (level - 1) ** 2;
  const ceil = STEP * level ** 2;
  return {
    level,
    title: titleForLevel(level),
    score,
    pct: Math.max(0, Math.min(100, ((score - floor) / (ceil - floor)) * 100)),
    toNext: ceil - score,
    nextLevel: level + 1,
  };
}
