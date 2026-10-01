import { useCallback, useEffect, useRef } from "react";
import { useCompanion } from "../context/CompanionContext";
import { RARITY, normalizeTier, DAILY_REWARDS, MAX_FAVORITES } from "../utils/waifinity";

// ── useWaifinityCompanion ────────────────────────────────────────────────
//
// Branche le compagnon (voir CompanionContext / Companion.jsx) sur les
// événements du jeu Waifinity. Les répliques vivent dans
// utils/companionLines.js (catégories préfixées « wf », avec une version
// générique et une version propre à Chlo).
//
// Le hook ne modifie pas useWaifinity : il enveloppe les actions dont la
// page a besoin et renvoie des versions « avec réaction » :
//   - onPackClosed(results)  → à appeler à la fermeture du récap de booster
//                              (la bulle est plein écran : on la montre APRÈS
//                              le récap, pas par-dessus) ;
//   - claimDaily()           → récompense quotidienne ;
//   - toggleFavorite(id)     → ajout d'un favori ;
//   - et, tout seul, un rappel quand le booster gratuit est disponible.
//
// Une seule réplique par booster, la plus marquante (vœu > série complétée
// > Legendary/Secret > Epic > que des doublons > booster ordinaire). Les
// cas marquants s'affichent toujours ; les boosters ordinaires seulement
// une fois sur deux environ, pour ne pas bloquer l'écran à chaque tirage
// quand on enchaîne les boosters.

// Chances d'afficher une réaction sur un booster « sans histoire ».
const CHANCE_ORDINARY = 0.35;
const CHANCE_DUPES    = 0.7;
// Au-delà de ce nombre de doublons, le booster est jugé décevant.
const DUPES_THRESHOLD = 8;
// Laisse le temps au récap de se fermer avant de lancer la bulle.
const REACTION_DELAY_MS = 350;

const TIER_LABEL = (tier) => RARITY[normalizeTier(tier)].label;

/** Choisit la réaction d'un booster. Renvoie { category, vars, always } ou null. */
export function chooseReaction(results) {
  if (!results?.length) return null;

  const newOnes = results.filter((r) => !r.isDuplicate);
  const dups = results.filter((r) => r.isDuplicate);

  // 1. Le personnage visé par un vœu est dans le booster.
  const wished = results.find((r) => r.card.wish);
  if (wished) {
    return { category: "wfWish", vars: { name: wished.card.name }, always: true };
  }

  // 2. Une série vient d'être complétée.
  const bonus = results.map((r) => r.seriesBonus).find(Boolean);
  if (bonus) {
    return { category: "wfSeriesComplete", vars: { series: bonus.series, coins: bonus.coins }, always: true };
  }

  // 3. Nouvelle Legendary / Secret (la plus haute d'abord), puis nouvelle Epic.
  const best = (tiers) => newOnes
    .filter((r) => tiers.includes(normalizeTier(r.card.tier)))
    .sort((a, b) => (normalizeTier(b.card.tier) === "secret") - (normalizeTier(a.card.tier) === "secret"))[0];

  const top = best(["legendary", "secret"]);
  if (top) {
    return { category: "wfPackTop", vars: { name: top.card.name, tier: TIER_LABEL(top.card.tier) }, always: true };
  }
  const epic = best(["epic"]);
  if (epic) {
    return { category: "wfPackRare", vars: { name: epic.card.name }, always: true };
  }

  // 4. Booster décevant (presque que des doublons).
  const coins = results.reduce((sum, r) => sum + r.coinsGained, 0);
  if (dups.length >= DUPES_THRESHOLD) {
    return { category: "wfPackDupes", vars: { coins }, chance: CHANCE_DUPES };
  }

  // 5. Booster ordinaire.
  if (newOnes.length > 0) {
    return { category: "wfPackNew", vars: { newCount: newOnes.length }, chance: CHANCE_ORDINARY };
  }
  return { category: "wfPackDupes", vars: { coins }, chance: CHANCE_DUPES };
}

export function useWaifinityCompanion(game) {
  const { triggerCompanion } = useCompanion();

  // Dernières valeurs du jeu, lues par des callbacks stables.
  const gameRef = useRef(game);
  gameRef.current = game;

  const timerRef = useRef(null);
  const favoritedRef = useRef(new Set()); // un favori ne déclenche la bulle qu'une fois par session
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const react = useCallback((category, vars, delay = 0) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => triggerCompanion(category, vars, { allowRepeat: true }), delay);
  }, [triggerCompanion]);

  // ── Rappel : le booster gratuit est disponible (une fois par session) ──
  useEffect(() => {
    if (!game.canOpenFree) return;
    const t = setTimeout(() => triggerCompanion("wfFreeReady"), 900);
    return () => clearTimeout(t);
  }, [game.canOpenFree, triggerCompanion]);

  // ── Booster récupéré : à appeler quand le récap se ferme ──
  const onPackClosed = useCallback((results) => {
    const r = chooseReaction(results);
    if (!r) return;
    if (!r.always && Math.random() > r.chance) return;
    react(r.category, r.vars, REACTION_DELAY_MS);
  }, [react]);

  // ── Récompense quotidienne ──
  const claimDaily = useCallback(async (...args) => {
    const res = await gameRef.current.claimDaily(...args);
    if (res) {
      const isMax = res.streak >= DAILY_REWARDS.length;
      react(isMax ? "wfDailyMax" : "wfDaily", { coins: res.reward, day: res.streak });
    }
    return res;
  }, [react]);

  // ── Favori ajouté ──
  const toggleFavorite = useCallback((id) => {
    const g = gameRef.current;
    const adding = !g.favorites.includes(id) && g.favorites.length < MAX_FAVORITES && !!g.collection[id];
    g.toggleFavorite(id);
    if (adding && !favoritedRef.current.has(id)) {
      favoritedRef.current.add(id);
      const name = g.collection[id]?.name || g.pool.find((c) => c.id === id)?.name;
      if (name) react("wfFavorite", { name }, 250);
    }
  }, [react]);

  return { onPackClosed, claimDaily, toggleFavorite };
}
