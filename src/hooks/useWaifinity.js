import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchWaifuPool } from "../api/waifu";
import {
  loadState, saveState, defaultState, generatePack, coinsForDuplicate,
  msUntilFreeBooster, PACK_WEIGHTS, SHOP_CHANCE_COST, SHOP_TARGET_COST,
} from "../utils/waifinity";

/**
 * useWaifinity — état complet du mini-jeu (bassin de personnages, pièces,
 * collection, cooldown du booster gratuit, pack en cours d'ouverture).
 * Autonome : ne dépend d'aucun Provider, s'utilise directement dans la page
 * du jeu (comme useSync ailleurs dans l'app).
 */
export function useWaifinity() {
  const { user } = useAuth();
  const uid = user?.id || null;

  const [state, setState]       = useState(defaultState);
  const [pool, setPool]         = useState([]);
  const [poolLoading, setPoolLoading] = useState(true);
  const [poolError, setPoolError]     = useState(null);
  const [now, setNow]           = useState(Date.now()); // tick pour le décompte
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Chargement de la sauvegarde locale (par compte) ──────────────────────
  useEffect(() => { setState(loadState(uid)); }, [uid]);

  // ── Chargement du bassin de personnages (AniList, mis en cache 24h) ─────
  const loadPool = useCallback(async (force = false) => {
    setPoolLoading(true);
    setPoolError(null);
    try {
      const p = await fetchWaifuPool({ force });
      setPool(p);
      if (!p.length) setPoolError("Le bassin de personnages est vide pour le moment.");
    } catch (e) {
      setPoolError(e?.message || "Impossible de charger les personnages depuis AniList.");
    } finally {
      setPoolLoading(false);
    }
  }, []);
  useEffect(() => { loadPool(); }, [loadPool]);

  // ── Décompte du booster gratuit (tick chaque seconde tant qu'il y a une attente) ──
  useEffect(() => {
    const remaining = msUntilFreeBooster(state.lastFreeOpenedAt);
    if (remaining <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.lastFreeOpenedAt]);

  const persist = useCallback((updater) => {
    setState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveState(uid, next);
      return next;
    });
  }, [uid]);

  const cooldownMs = msUntilFreeBooster(state.lastFreeOpenedAt);
  const canOpenFree = cooldownMs <= 0 && !state.pendingPack && pool.length > 0;

  // ── Ouverture d'un booster gratuit (1/heure) ─────────────────────────────
  const openFreeBooster = useCallback(() => {
    if (!canOpenFree) return;
    const cards = generatePack(pool, PACK_WEIGHTS.free);
    persist((prev) => ({
      ...prev,
      lastFreeOpenedAt: Date.now(),
      pendingPack: { source: "free", cards, openedAt: Date.now() },
      stats: { ...prev.stats, opened: prev.stats.opened + 1 },
    }));
  }, [canOpenFree, pool, persist]);

  // ── Boutique : booster "Chance+" (meilleures probabilités, tout le bassin) ──
  const openChanceBooster = useCallback(() => {
    if (state.pendingPack || pool.length === 0 || state.coins < SHOP_CHANCE_COST) return;
    const cards = generatePack(pool, PACK_WEIGHTS.chance);
    persist((prev) => ({
      ...prev,
      coins: prev.coins - SHOP_CHANCE_COST,
      pendingPack: { source: "chance", cards, openedAt: Date.now() },
      stats: { ...prev.stats, opened: prev.stats.opened + 1 },
    }));
  }, [state.pendingPack, state.coins, pool, persist]);

  // ── Boutique : booster ciblé sur une série (mêmes probabilités que "Chance+") ──
  const openTargetedBooster = useCallback((seriesId) => {
    if (state.pendingPack || state.coins < SHOP_TARGET_COST) return;
    const filtered = pool.filter((c) => c.seriesId === seriesId);
    if (!filtered.length) return;
    const cards = generatePack(filtered, PACK_WEIGHTS.chance);
    persist((prev) => ({
      ...prev,
      coins: prev.coins - SHOP_TARGET_COST,
      pendingPack: { source: "targeted", cards, openedAt: Date.now() },
      stats: { ...prev.stats, opened: prev.stats.opened + 1 },
    }));
  }, [state.pendingPack, state.coins, pool, persist]);

  // ── Choix d'une carte parmi les 10 révélées → collection ou pièces ───────
  const pickCard = useCallback((packSlot) => {
    const pack = stateRef.current.pendingPack;
    if (!pack) return null;
    const card = pack.cards.find((c) => c.packSlot === packSlot);
    if (!card) return null;

    let result = null;
    persist((prev) => {
      const existing = prev.collection[card.id];
      const isDuplicate = !!existing;
      const gain = isDuplicate ? coinsForDuplicate(card.tier) : 0;
      result = { card, isDuplicate, coinsGained: gain };

      return {
        ...prev,
        coins: prev.coins + gain,
        pendingPack: null,
        collection: {
          ...prev.collection,
          [card.id]: existing
            ? { ...existing, count: existing.count + 1 }
            : {
                id: card.id, name: card.name, image: card.image, series: card.series,
                tier: card.tier, count: 1, firstObtainedAt: Date.now(),
              },
        },
        stats: {
          ...prev.stats,
          obtained:   prev.stats.obtained + (isDuplicate ? 0 : 1),
          duplicates: prev.stats.duplicates + (isDuplicate ? 1 : 0),
        },
      };
    });
    return result;
  }, [persist]);

  const collectionList = Object.values(state.collection).sort((a, b) => b.firstObtainedAt - a.firstObtainedAt);

  return {
    coins: state.coins,
    stats: state.stats,
    collection: state.collection,
    collectionList,
    pendingPack: state.pendingPack,
    pool, poolLoading, poolError, reloadPool: () => loadPool(true),
    canOpenFree, cooldownMs: msUntilFreeBooster(state.lastFreeOpenedAt), now,
    openFreeBooster, openChanceBooster, openTargetedBooster, pickCard,
    canAffordChance:  state.coins >= SHOP_CHANCE_COST,
    canAffordTarget:  state.coins >= SHOP_TARGET_COST,
  };
}
