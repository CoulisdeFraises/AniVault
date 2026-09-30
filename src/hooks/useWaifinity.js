import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { ensureWaifinityWallet, adjustWaifinityBalance, fetchWaifinityWallet, newWalletOperationKey } from "../services/waifinityWallet";
import { fetchWaifuPool } from "../api/waifu";
import {
  loadState, saveState, defaultState, generatePack, coinsForDuplicate,
  msUntilFreeBooster, filterPoolByGender, GENDER_BOOSTERS, PACK_WEIGHTS,
  SHOP_CHANCE_COST, SHOP_TARGET_COST, SHOP_GENDER_COST, wishCost, MAX_FAVORITES, claimPackCards,
} from "../utils/waifinity";
import {
  syncWaifinityItem, fetchMyTrades, acceptTradeServer, markTradeApplied, closeTrade, proposeTrade as proposeTradeService,
  fetchMyWaifinityCollection,
} from "../services/waifinitySocial";

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
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletReady, setWalletReady] = useState(!uid);
  const [walletIssue, setWalletIssue] = useState(null);
  const walletBusyRef = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Chargement de la sauvegarde locale (par compte) ──────────────────────
  useEffect(() => {
    const local = loadState(uid);
    setState(local);
    setWalletIssue(null);
    setWalletReady(!uid);
    if (!uid) return;

    let cancelled = false;
    (async () => {
      try {
        // Premier passage : si aucun wallet n'existe encore, le solde local
        // historique est utilisé pour migrer le compte. Ensuite, Supabase
        // devient la seule source de vérité du solde.
        const wallet = await ensureWaifinityWallet(uid, local.coins);
        if (cancelled || !wallet) return;
        const balance = Number(wallet.balance) || 0;
        setWalletReady(true);
        setState((prev) => {
          const next = { ...prev, coins: balance };
          saveState(uid, next);
          return next;
        });
      } catch (e) {
        if (!cancelled) {
          setWalletReady(false);
          console.error("Waifinity wallet :", e);
          setWalletIssue(e?.message || "Impossible de synchroniser les AniGold.");
        }
      }
    })();

    return () => { cancelled = true; };
  }, [uid]);

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

  const [saveIssue, setSaveIssue] = useState(false); // échec d'écriture LOCALE (quota…)
  const [syncIssue, setSyncIssue] = useState(false);  // échec de la synchro SERVEUR (réseau…)

  const persist = useCallback((updater) => {
    setState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (next !== prev) {
        const ok = saveState(uid, next);
        setSaveIssue(!ok);
      }
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

  // ── Réconciliation avec le miroir Supabase (filet de sécurité) ───────────
  // waifinity_collection_items est poussé à chaque récupération de booster (claimPack). S'il a
  // un compteur plus élevé qu'en local pour un personnage — typiquement parce
  // que la sauvegarde localStorage a échoué (stockage plein) — on répare le
  // local avec le serveur. À l'inverse, si le local est en avance (la synchro
  // serveur a échoué, faute de réseau), on répare le serveur avec le local.
  // Une fois par connexion : suffisant pour rattraper une désynchronisation
  // sans multiplier les allers-retours réseau à chaque montage.
  const reconciledRef = useRef(null);
  useEffect(() => {
    if (!uid || reconciledRef.current === uid) return;
    reconciledRef.current = uid;
    (async () => {
      const server = await fetchMyWaifinityCollection(uid);
      const local = stateRef.current.collection;
      const merged = { ...local };
      const toPushUp = [];
      let repaired = false;

      for (const id of new Set([...Object.keys(local), ...Object.keys(server)])) {
        const lCount = local[id]?.count || 0;
        const sCount = server[id]?.count || 0;
        if (sCount > lCount) { merged[id] = server[id]; repaired = true; }
        else if (lCount > sCount) { toPushUp.push(local[id]); }
      }

      if (repaired) {
        console.warn("Waifinity : collection locale réparée depuis le miroir Supabase (désynchronisation détectée).");
        persist((prev) => ({ ...prev, collection: merged }));
      }
      for (const item of toPushUp) await syncWaifinityItem(uid, item);
    })();
  }, [uid, persist]);

  const cooldownMs = msUntilFreeBooster(state.lastFreeOpenedAt);
  const canOpenFree = cooldownMs <= 0 && !state.pendingPack && pool.length > 0;

  // ── Ouverture d'un booster gratuit (1 toutes les 3 h, tout le bassin) ────
  const openFreeBooster = useCallback(() => {
    if (!canOpenFree) return;
    const cards = generatePack(pool, PACK_WEIGHTS.free);
    persist((prev) => ({
      ...prev,
      lastFreeOpenedAt: Date.now(),
      pendingPack: { source: "free", cards, openedAt: Date.now(), claimId: newWalletOperationKey("claim") },
      stats: { ...prev.stats, opened: prev.stats.opened + 1 },
    }));
  }, [canOpenFree, pool, persist]);

  // ── Boutique : booster "Chance+" (meilleures probabilités, tout le bassin) ──
  const openChanceBooster = useCallback(async () => {
    if (!walletReady || walletBusyRef.current || state.pendingPack || pool.length === 0 || state.coins < SHOP_CHANCE_COST) return;
    walletBusyRef.current = true;
    setWalletBusy(true);
    setWalletIssue(null);
    try {
      const wallet = await adjustWaifinityBalance(uid, -SHOP_CHANCE_COST, "booster_chance", newWalletOperationKey("purchase"));
      const cards = generatePack(pool, PACK_WEIGHTS.chance);
      const openedAt = Date.now();
      persist((prev) => ({
        ...prev,
        coins: Number(wallet.balance),
        pendingPack: { source: "chance", cards, openedAt, claimId: newWalletOperationKey("claim"), purchaseBalance: Number(wallet.balance) },
        stats: { ...prev.stats, opened: prev.stats.opened + 1 },
      }));
    } catch (e) {
      console.error("Waifinity achat Chance+ :", e);
      setWalletIssue(e?.message || "Achat impossible pour le moment.");
    } finally {
      walletBusyRef.current = false;
      setWalletBusy(false);
    }
  }, [uid, walletReady, state.pendingPack, state.coins, pool, persist]);

  // ── Boutique : booster réservé aux waifus OU aux husbandos (chances du gratuit) ──
  const openGenderBooster = useCallback(async (gender) => {
    const cfg = GENDER_BOOSTERS[gender];
    if (!cfg || !walletReady || walletBusyRef.current || state.pendingPack || state.coins < SHOP_GENDER_COST) return;
    const filtered = filterPoolByGender(pool, gender);
    if (!filtered.length) return;
    walletBusyRef.current = true;
    setWalletBusy(true);
    setWalletIssue(null);
    try {
      const wallet = await adjustWaifinityBalance(uid, -SHOP_GENDER_COST, `booster_${cfg.source}`, newWalletOperationKey("purchase"));
      const cards = generatePack(filtered, PACK_WEIGHTS.free);
      const openedAt = Date.now();
      persist((prev) => ({
        ...prev,
        coins: Number(wallet.balance),
        pendingPack: { source: cfg.source, cards, openedAt, claimId: newWalletOperationKey("claim"), purchaseBalance: Number(wallet.balance) },
        stats: { ...prev.stats, opened: prev.stats.opened + 1 },
      }));
    } catch (e) {
      console.error("Waifinity achat genre :", e);
      setWalletIssue(e?.message || "Achat impossible pour le moment.");
    } finally {
      walletBusyRef.current = false;
      setWalletBusy(false);
    }
  }, [uid, walletReady, state.pendingPack, state.coins, pool, persist]);

  // ── Boutique : booster ciblé sur une série (mêmes probabilités que "Chance+") ──
  const openTargetedBooster = useCallback(async (seriesId) => {
    if (!walletReady || walletBusyRef.current || state.pendingPack || state.coins < SHOP_TARGET_COST) return;
    const filtered = pool.filter((c) => c.seriesId === seriesId);
    if (!filtered.length) return;
    walletBusyRef.current = true;
    setWalletBusy(true);
    setWalletIssue(null);
    try {
      const wallet = await adjustWaifinityBalance(uid, -SHOP_TARGET_COST, "booster_targeted", newWalletOperationKey("purchase"));
      const cards = generatePack(filtered, PACK_WEIGHTS.chance);
      const openedAt = Date.now();
      persist((prev) => ({
        ...prev,
        coins: Number(wallet.balance),
        pendingPack: { source: "targeted", cards, openedAt, claimId: newWalletOperationKey("claim"), purchaseBalance: Number(wallet.balance) },
        stats: { ...prev.stats, opened: prev.stats.opened + 1 },
      }));
    } catch (e) {
      console.error("Waifinity achat ciblé :", e);
      setWalletIssue(e?.message || "Achat impossible pour le moment.");
    } finally {
      walletBusyRef.current = false;
      setWalletBusy(false);
    }
  }, [uid, walletReady, state.pendingPack, state.coins, pool, persist]);

  // ── Vœu : garantit UN personnage précis dans les 10 cartes du prochain booster ──
  // Coût scalé par palier (voir WISH_COST) — bien plus cher qu'un booster
  // ciblé, puisque bien plus fort (résultat garanti, pas juste la série).
  const openWishBooster = useCallback(async (character) => {
    const cost = wishCost(character?.tier);
    if (!character || !walletReady || walletBusyRef.current || state.pendingPack || state.coins < cost) return;
    walletBusyRef.current = true;
    setWalletBusy(true);
    setWalletIssue(null);
    try {
      const wallet = await adjustWaifinityBalance(uid, -cost, `booster_wish_${character.id}`, newWalletOperationKey("purchase"));
      const cards = generatePack(pool, PACK_WEIGHTS.chance, undefined, character);
      const openedAt = Date.now();
      persist((prev) => ({
        ...prev,
        coins: Number(wallet.balance),
        pendingPack: { source: "wish", cards, openedAt, claimId: newWalletOperationKey("claim"), purchaseBalance: Number(wallet.balance) },
        stats: { ...prev.stats, opened: prev.stats.opened + 1 },
      }));
    } catch (e) {
      console.error("Waifinity vœu :", e);
      setWalletIssue(e?.message || "Achat impossible pour le moment.");
    } finally {
      walletBusyRef.current = false;
      setWalletBusy(false);
    }
  }, [uid, walletReady, state.pendingPack, state.coins, pool, persist]);

  // ── Récupération du booster : les 10 cartes vont directement en collection ──
  // Plus de choix : chaque carte est ajoutée ; un doublon (déjà possédé, ou
  // apparu deux fois dans le même booster) donne des pièces à la place, et
  // chaque série complétée verse son bonus — une seule fois (voir
  // claimPackCards dans utils/waifinity.js).
  const claimPack = useCallback(async () => {
    const pack = stateRef.current.pendingPack;
    if (!pack || walletBusyRef.current) return null;

    const { state: calculatedState, results } = claimPackCards(stateRef.current, pack.cards, pool);
    const coinDelta = calculatedState.coins - stateRef.current.coins;

    walletBusyRef.current = true;
    setWalletBusy(true);
    setWalletIssue(null);

    try {
      let serverBalance = stateRef.current.coins;
      if (coinDelta !== 0) {
        const wallet = await adjustWaifinityBalance(
          uid,
          coinDelta,
          "pack_rewards",
          pack.claimId || newWalletOperationKey("claim")
        );
        serverBalance = Number(wallet.balance);
      } else {
        const wallet = await fetchWaifinityWallet(uid);
        if (wallet) serverBalance = Number(wallet.balance) || 0;
      }

      persist((prev) => {
        const next = claimPackCards(prev, pack.cards, pool).state;
        return { ...next, coins: serverBalance };
      });

      // Miroir public : un seul envoi par personnage, best effort.
      const finalByCharacter = new Map();
      for (const r of results) finalByCharacter.set(r.card.id, r);
      const oks = await Promise.all([...finalByCharacter.values()].map(({ card, count }) =>
        syncWaifinityItem(uid, {
          id: card.id, name: card.name, image: card.image, series: card.series,
          tier: card.tier, gender: card.gender ?? null, count,
        })
      ));
      setSyncIssue(oks.some((ok) => !ok));

      return results;
    } catch (e) {
      console.error("Waifinity récompense AniGold :", e);
      setWalletIssue(e?.message || "Impossible de valider la récompense AniGold. Le booster reste disponible.");
      return null;
    } finally {
      walletBusyRef.current = false;
      setWalletBusy(false);
    }
  }, [persist, pool, uid]);

  // Le bassin fournit l'image (et les infos à jour) — on ne la stocke plus en
  // local (voir claimPackCards) pour ne pas saturer le quota localStorage une fois
  // la collection grande. Sans le bassin (chargement en cours, ou personnage
  // qui en est sorti depuis), on retombe sur ce qu'on a stocké (sans image).
  const poolById = useMemo(() => new Map(pool.map((c) => [c.id, c])), [pool]);
  const collectionList = useMemo(
    () => Object.values(state.collection)
      .map((e) => {
        const p = poolById.get(e.id);
        return p ? { ...e, name: p.name, image: p.image, series: p.series, tier: p.tier, gender: p.gender ?? null, about: p.about ?? null, seriesId: p.seriesId ?? null } : e;
      })
      .sort((a, b) => b.firstObtainedAt - a.firstObtainedAt),
    [state.collection, poolById]
  );

  // ── Échanges avec des amis ─────────────────────────────────────────────────
  const [trades, setTrades] = useState([]);

  const refreshTrades = useCallback(async () => {
    if (!uid) { setTrades([]); return []; }
    const rows = await fetchMyTrades(uid);
    setTrades(rows);
    return rows;
  }, [uid]);

  /**
   * Répercute dans l'état LOCAL chaque échange accepté dont mon côté n'est
   * pas encore marqué comme appliqué (`from_applied`/`to_applied` côté
   * serveur) — couvre le cas où l'autre joueur a accepté pendant que j'étais
   * hors-jeu. Jamais deux fois pour le même échange, grâce à ce flag.
   */
  const applyResolvedTrades = useCallback(async () => {
    if (!uid) return;
    const rows = await fetchMyTrades(uid);
    setTrades(rows);

    for (const t of rows) {
      if (t.status !== "accepted") continue;
      const isFrom = t.from_user === uid;
      if (isFrom ? t.from_applied : t.to_applied) continue;

      const lostId = isFrom ? t.offer_character_id : t.request_character_id;
      const gained = isFrom
        ? { id: t.request_character_id, name: t.request_name, image: t.request_image, tier: t.request_tier, series: t.request_series, gender: t.request_gender }
        : { id: t.offer_character_id,   name: t.offer_name,   image: t.offer_image,   tier: t.offer_tier,   series: t.offer_series,   gender: t.offer_gender };

      persist((prev) => {
        const nextCollection = { ...prev.collection };
        const existingLost = nextCollection[lostId];
        if (existingLost) {
          if (existingLost.count <= 1) delete nextCollection[lostId];
          else nextCollection[lostId] = { ...existingLost, count: existingLost.count - 1 };
        }
        const existingGained = nextCollection[gained.id];
        nextCollection[gained.id] = existingGained
          ? { ...existingGained, count: existingGained.count + 1 }
          : {
              id: gained.id, name: gained.name, series: gained.series,
              tier: gained.tier, gender: gained.gender ?? null, count: 1, firstObtainedAt: Date.now(),
            };
        return { ...prev, collection: nextCollection };
      });

      await markTradeApplied(t.id, isFrom ? "from_applied" : "to_applied");
    }
  }, [uid, persist]);

  // Une fois au montage (et à chaque reconnexion) — capte les échanges
  // résolus pendant que le joueur n'était pas sur l'onglet Social.
  useEffect(() => { applyResolvedTrades(); }, [applyResolvedTrades]);

  const proposeTrade = useCallback(async (toUser, offer, request) => {
    await proposeTradeService({ fromUser: uid, toUser, offer, request });
    await refreshTrades();
  }, [uid, refreshTrades]);

  const acceptTrade = useCallback(async (trade) => {
    await acceptTradeServer(trade.id);
    await applyResolvedTrades();
    return trade;
  }, [applyResolvedTrades]);

  const declineTrade = useCallback(async (tradeId) => {
    await closeTrade(tradeId, "declined");
    await refreshTrades();
  }, [refreshTrades]);

  const cancelTrade = useCallback(async (tradeId) => {
    await closeTrade(tradeId, "cancelled");
    await refreshTrades();
  }, [refreshTrades]);

  // ── Favoris : jusqu'à MAX_FAVORITES personnages épinglés en tête de collection ──
  const toggleFavorite = useCallback((id) => {
    persist((prev) => {
      const cur = prev.favorites || [];
      if (cur.includes(id)) return { ...prev, favorites: cur.filter((x) => x !== id) };
      if (cur.length >= MAX_FAVORITES || !prev.collection[id]) return prev;
      return { ...prev, favorites: [...cur, id] };
    });
  }, [persist]);

  return {
    coins: state.coins,
    stats: state.stats,
    collection: state.collection,
    completedSeries: state.completedSeries,
    collectionList,
    pendingPack: state.pendingPack,
    pool, poolMeta, poolLoading, poolError, reloadPool: () => loadPool(true),
    canOpenFree, cooldownMs, now,
    openFreeBooster, openChanceBooster, openTargetedBooster, openGenderBooster, openWishBooster, claimPack,
    canAffordChance:  state.coins >= SHOP_CHANCE_COST,
    canAffordTarget:  state.coins >= SHOP_TARGET_COST,
    canAffordGender:  state.coins >= SHOP_GENDER_COST,
    canAffordWish:    (tier) => state.coins >= wishCost(tier),
    trades, refreshTrades, proposeTrade, acceptTrade, declineTrade, cancelTrade,
    saveIssue, syncIssue, walletIssue, walletBusy, walletReady,
    favorites: state.favorites || [], toggleFavorite,
  };
}
