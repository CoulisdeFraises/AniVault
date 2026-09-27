import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { fetchWaifuPool } from "../api/waifu";
import {
  loadState, saveState, defaultState, generatePack, coinsForDuplicate,
  msUntilFreeBooster, filterPoolByGender, GENDER_BOOSTERS, PACK_WEIGHTS,
  SHOP_CHANCE_COST, SHOP_TARGET_COST, SHOP_GENDER_COST, seriesKeyOf, seriesCompletionBonus, wishCost,
} from "../utils/waifinity";

/**
 * useWaifinity — état complet du mini-jeu (bassin de personnages, pièces,
 * collection, cooldown du booster gratuit, pack en cours d'ouverture).
 * Autonome : ne dépend d'aucun Provider, s'utilise directement dans la page
 * du jeu (comme useSync ailleurs dans l'app).
 *
 * `withPool: false` → ne charge pas le bassin de personnages (utile pour un
 * simple aperçu : pièces, taille de la collection…).
 */
export function useWaifinity({ withPool = true } = {}) {
  const { user } = useAuth();
  const uid = user?.id || null;

  const [state, setState]       = useState(defaultState);
  const [pool, setPool]         = useState([]);
  const [poolMeta, setPoolMeta] = useState(null);
  const [poolLoading, setPoolLoading] = useState(withPool);
  const [poolError, setPoolError]     = useState(null);
  const [now, setNow]           = useState(Date.now()); // tick pour le décompte
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Chargement de la sauvegarde locale (par compte) ──────────────────────
  useEffect(() => { setState(loadState(uid)); }, [uid]);

  // ── Chargement du bassin de personnages (Supabase, sinon repli AniList en direct) ──
  const loadPool = useCallback(async (force = false) => {
    setPoolLoading(true);
    setPoolError(null);
    try {
      const { pool: p, meta } = await fetchWaifuPool({ force });
      setPool(p);
      setPoolMeta(meta);
      if (!p.length) setPoolError("Le bassin de personnages est vide pour le moment.");
    } catch (e) {
      setPoolError(e?.message || "Impossible de charger les personnages pour le moment.");
    } finally {
      setPoolLoading(false);
    }
  }, []);
  useEffect(() => { if (withPool) loadPool(); }, [withPool, loadPool]);

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
      if (next !== prev) saveState(uid, next);
      return next;
    });
  }, [uid]);

  // ── Resynchronise la collection avec le bassin ────────────────────────────
  // Rareté et genre d'un personnage déjà possédé suivent le bassin courant
  // (nouveau découpage en 6 paliers, genre ajouté après coup, classement mis
  // à jour…). Sans effet si rien ne change.
  useEffect(() => {
    if (!pool.length) return;
    const byId = new Map(pool.map((c) => [c.id, c]));
    persist((prev) => {
      let changed = false;
      const collection = {};
      for (const [id, e] of Object.entries(prev.collection)) {
        const p = byId.get(e.id);
        if (p && (p.tier !== e.tier || (p.gender ?? null) !== (e.gender ?? null))) {
          collection[id] = { ...e, tier: p.tier, gender: p.gender ?? null };
          changed = true;
        } else {
          collection[id] = e;
        }
      }
      return changed ? { ...prev, collection } : prev;
    });
  }, [pool, state.collection, persist]);

  const cooldownMs = msUntilFreeBooster(state.lastFreeOpenedAt);
  const canOpenFree = cooldownMs <= 0 && !state.pendingPack && pool.length > 0;

  // ── Ouverture d'un booster gratuit (1 toutes les 3 h, tout le bassin) ────
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

  // ── Boutique : booster réservé aux waifus OU aux husbandos (chances du gratuit) ──
  const openGenderBooster = useCallback((gender) => {
    const cfg = GENDER_BOOSTERS[gender];
    if (!cfg || state.pendingPack || state.coins < SHOP_GENDER_COST) return;
    const filtered = filterPoolByGender(pool, gender);
    if (!filtered.length) return;
    const cards = generatePack(filtered, PACK_WEIGHTS.free);
    persist((prev) => ({
      ...prev,
      coins: prev.coins - SHOP_GENDER_COST,
      pendingPack: { source: cfg.source, cards, openedAt: Date.now() },
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

  // ── Vœu : garantit UN personnage précis dans les 10 cartes du prochain booster ──
  // Coût scalé par palier (voir WISH_COST) — bien plus cher qu'un booster
  // ciblé, puisque bien plus fort (résultat garanti, pas juste la série).
  const openWishBooster = useCallback((character) => {
    const cost = wishCost(character?.tier);
    if (!character || state.pendingPack || state.coins < cost) return;
    const cards = generatePack(pool, PACK_WEIGHTS.chance, undefined, character);
    persist((prev) => ({
      ...prev,
      coins: prev.coins - cost,
      pendingPack: { source: "wish", cards, openedAt: Date.now() },
      stats: { ...prev.stats, opened: prev.stats.opened + 1 },
    }));
  }, [state.pendingPack, state.coins, pool, persist]);

  // ── Choix d'une carte parmi les 10 révélées → collection ou pièces ───────
  const pickCard = useCallback((packSlot) => {
    const pack = stateRef.current.pendingPack;
    if (!pack) return null;
    const card = pack.cards.find((c) => c.packSlot === packSlot);
    if (!card) return null;

    // Résultat calculé à partir de l'état courant (et non dans l'updater, dont
    // l'exécution peut être différée par React) ; l'updater refait le même
    // calcul sur l'état le plus récent pour la sauvegarde.
    const owned = stateRef.current.collection[card.id];
    const isDuplicate = !!owned;
    const coinsGained = isDuplicate ? coinsForDuplicate(card.tier) : 0;

    // Un personnage inédit peut compléter sa série — jamais récompensé deux
    // fois pour la même série, quel que soit le nombre de fois où on repasse
    // par ici (voir prev.completedSeries dans l'updater ci-dessous).
    let seriesBonus = null;
    if (!isDuplicate) {
      const key = seriesKeyOf(card);
      if (!stateRef.current.completedSeries[key]) {
        const seriesChars = pool.filter((c) => seriesKeyOf(c) === key);
        const stillMissing = seriesChars.some((c) => c.id !== card.id && !stateRef.current.collection[c.id]);
        if (seriesChars.length > 0 && !stillMissing) {
          seriesBonus = { key, series: card.series, coins: seriesCompletionBonus(seriesChars.length) };
        }
      }
    }

    const result = { card, isDuplicate, coinsGained, seriesBonus };

    persist((prev) => {
      const existing = prev.collection[card.id];
      const dup = !!existing;
      const gain = dup ? coinsForDuplicate(card.tier) : 0;

      let bonusCoins = 0;
      let completedSeries = prev.completedSeries;
      if (seriesBonus && !prev.completedSeries[seriesBonus.key]) {
        bonusCoins = seriesBonus.coins;
        completedSeries = {
          ...prev.completedSeries,
          [seriesBonus.key]: { series: seriesBonus.series, coins: seriesBonus.coins, completedAt: Date.now() },
        };
      }

      return {
        ...prev,
        coins: prev.coins + gain + bonusCoins,
        pendingPack: null,
        collection: {
          ...prev.collection,
          [card.id]: existing
            ? { ...existing, count: existing.count + 1 }
            : {
                id: card.id, name: card.name, image: card.image, series: card.series,
                tier: card.tier, gender: card.gender ?? null, count: 1, firstObtainedAt: Date.now(),
              },
        },
        completedSeries,
        stats: {
          ...prev.stats,
          obtained:   prev.stats.obtained + (dup ? 0 : 1),
          duplicates: prev.stats.duplicates + (dup ? 1 : 0),
        },
      };
    });
    return result;
  }, [persist, pool]);

  const collectionList = useMemo(
    () => Object.values(state.collection).sort((a, b) => b.firstObtainedAt - a.firstObtainedAt),
    [state.collection]
  );

  return {
    coins: state.coins,
    stats: state.stats,
    collection: state.collection,
    completedSeries: state.completedSeries,
    collectionList,
    pendingPack: state.pendingPack,
    pool, poolMeta, poolLoading, poolError, reloadPool: () => loadPool(true),
    canOpenFree, cooldownMs, now,
    openFreeBooster, openChanceBooster, openTargetedBooster, openGenderBooster, openWishBooster, pickCard,
    canAffordChance:  state.coins >= SHOP_CHANCE_COST,
    canAffordTarget:  state.coins >= SHOP_TARGET_COST,
    canAffordGender:  state.coins >= SHOP_GENDER_COST,
    canAffordWish:    (tier) => state.coins >= wishCost(tier),
  };
}
