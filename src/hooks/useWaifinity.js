import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { ensureWaifinityWallet, adjustWaifinityBalance, fetchWaifinityWallet, newWalletOperationKey } from "../services/waifinityWallet";
import { fetchWaifuPool } from "../api/waifu";
import { currentSeason, fetchSeasonMalIds } from "../api/waifuBanner";
import { buildSeasonBanner, BANNER_COST } from "../utils/waifinityBanners";
import { COSMETICS_BY_ID } from "../utils/waifinityCosmetics";
import {
  ensureMissionDay, applyMissionEvents, packMissionEvents, describeMissions, getMission, MISSION_BONUS,
} from "../utils/waifinityMissions";
import { fetchMyShowcase, pushShowcase } from "../services/waifinityShowcase";
import {
  loadState, saveState, defaultState, generatePack, coinsForDuplicate,
  msUntilFreeBooster, filterPoolByGender, GENDER_BOOSTERS, PACK_WEIGHTS,
  SHOP_BOOSTER_COST, SHOP_TARGET_COST, SHOP_GENDER_COST, wishCost, MAX_FAVORITES, claimPackCards, dailyStatus,
} from "../utils/waifinity";
import {
  syncWaifinityItem, fetchMyTrades, fetchMyWaifinityCollection,
  proposeTrade as proposeTradeService, counterTradeServer, confirmTradeServer, closeTradeServer,
} from "../services/waifinitySocial";
import { supabase } from "../lib/supabase";
import { markTradeEventSeen } from "./useWaifinityNotifications";

/** Applique des événements de mission (jour courant) à un état — voir utils/waifinityMissions.js. */
function withMissionEvents(state, uid, events) {
  return { ...state, missions: applyMissionEvents(ensureMissionDay(state.missions, uid), events) };
}

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
  const refreshBusyRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
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

  // Index du bassin par id : calculé une seule fois par bassin chargé, et
  // partagé par la resynchronisation ci-dessous et par collectionList (sans
  // lui, chaque changement de collection reconstruisait une Map de ~3000 entrées).
  const poolById = useMemo(() => new Map(pool.map((c) => [c.id, c])), [pool]);

  // ── Bannière de saison : ids MAL des animes de la saison (cache 12 h), puis
  // croisement avec le bassin. Pas de bannière si AniList est injoignable ou
  // si la saison compte trop peu de personnages dans le bassin.
  const [seasonMal, setSeasonMal] = useState(null); // { ids, info }
  useEffect(() => {
    if (!withPool) return;
    let cancelled = false;
    const info = currentSeason();
    fetchSeasonMalIds(info)
      .then((ids) => { if (!cancelled) setSeasonMal({ ids, info }); })
      .catch((e) => console.error("Waifinity bannière de saison :", e?.message || e));
    return () => { cancelled = true; };
  }, [withPool]);
  const banner = useMemo(
    () => (seasonMal && pool.length ? buildSeasonBanner(pool, seasonMal.ids, seasonMal.info) : null),
    [pool, seasonMal]
  );

  // ── Resynchronise la collection avec le bassin ────────────────────────────
  // Rareté et genre d'un personnage déjà possédé suivent le bassin courant
  // (nouveau découpage en 6 paliers, genre ajouté après coup, classement mis
  // à jour…). Sans effet si rien ne change.
  useEffect(() => {
    if (!poolById.size) return;
    persist((prev) => {
      let changed = false;
      const collection = {};
      for (const [id, e] of Object.entries(prev.collection)) {
        const p = poolById.get(e.id);
        if (p && (p.tier !== e.tier || (p.gender ?? null) !== (e.gender ?? null))) {
          collection[id] = { ...e, tier: p.tier, gender: p.gender ?? null };
          changed = true;
        } else {
          collection[id] = e;
        }
      }
      return changed ? { ...prev, collection } : prev;
    });
  }, [poolById, state.collection, persist]);

  // ── Synchronisation de la collection depuis Supabase ─────────────────────
  // Supabase est la source de vérité pour la collection. Le localStorage sert
  // uniquement de cache UI/offline ; il ne doit jamais réécrire une collection
  // serveur plus récente, ni faire revenir une ligne supprimée.
  const reconciledRef = useRef(null);
  useEffect(() => {
    if (!uid || reconciledRef.current === uid) return;
    reconciledRef.current = uid;
    (async () => {
      const server = await fetchMyWaifinityCollection(uid);
      if (!server) return;
      persist((prev) => ({ ...prev, collection: server }));
    })();
  }, [uid, persist]);

  const cooldownMs = msUntilFreeBooster(state.lastFreeOpenedAt);
  const canOpenFree = cooldownMs <= 0 && !state.pendingPack && pool.length > 0;

  // ── Ouverture d'un booster gratuit (1 toutes les 3 h, tout le bassin) ────
  const openFreeBooster = useCallback(() => {
    if (!canOpenFree) return;
    const cards = generatePack(pool, PACK_WEIGHTS.standard);
    persist((prev) => ({
      ...prev,
      lastFreeOpenedAt: Date.now(),
      pendingPack: { source: "free", cards, openedAt: Date.now(), claimId: newWalletOperationKey("claim") },
      stats: { ...prev.stats, opened: prev.stats.opened + 1 },
    }));
  }, [canOpenFree, pool, persist]);

  // ── Boutique : booster normal (mêmes chances que le gratuit, sans attendre) ──
  const openStandardBooster = useCallback(async () => {
    if (!walletReady || walletBusyRef.current || state.pendingPack || pool.length === 0 || state.coins < SHOP_BOOSTER_COST) return;
    walletBusyRef.current = true;
    setWalletBusy(true);
    setWalletIssue(null);
    try {
      const wallet = await adjustWaifinityBalance(uid, -SHOP_BOOSTER_COST, "booster_standard", newWalletOperationKey("purchase"));
      const cards = generatePack(pool, PACK_WEIGHTS.standard);
      const openedAt = Date.now();
      persist((prev) => ({
        ...prev,
        coins: Number(wallet.balance),
        pendingPack: { source: "standard", cards, openedAt, claimId: newWalletOperationKey("claim"), purchaseBalance: Number(wallet.balance) },
        stats: { ...prev.stats, opened: prev.stats.opened + 1 },
      }));
    } catch (e) {
      console.error("Waifinity achat booster :", e);
      setWalletIssue(e?.message || "Achat impossible pour le moment.");
    } finally {
      walletBusyRef.current = false;
      setWalletBusy(false);
    }
  }, [uid, walletReady, state.pendingPack, state.coins, pool, persist]);

  // ── Boutique : booster réservé aux waifus OU aux husbandos ──
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
      const cards = generatePack(filtered, PACK_WEIGHTS.standard);
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

  // ── Boutique : booster ciblé sur une série ──
  const openTargetedBooster = useCallback(async (seriesId) => {
    if (!walletReady || walletBusyRef.current || state.pendingPack || state.coins < SHOP_TARGET_COST) return;
    const filtered = pool.filter((c) => c.seriesId === seriesId);
    if (!filtered.length) return;
    walletBusyRef.current = true;
    setWalletBusy(true);
    setWalletIssue(null);
    try {
      const wallet = await adjustWaifinityBalance(uid, -SHOP_TARGET_COST, "booster_targeted", newWalletOperationKey("purchase"));
      const cards = generatePack(filtered, PACK_WEIGHTS.standard);
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
      const cards = generatePack(pool, PACK_WEIGHTS.standard, undefined, character);
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

  // ── Booster de saison : mêmes chances de rareté, mais une part des cartes
  // est tirée parmi les personnages des animes de la saison (voir
  // utils/waifinityBanners.js).
  const openBannerBooster = useCallback(async () => {
    if (!banner || !walletReady || walletBusyRef.current || state.pendingPack || pool.length === 0 || state.coins < BANNER_COST) return;
    walletBusyRef.current = true;
    setWalletBusy(true);
    setWalletIssue(null);
    try {
      const wallet = await adjustWaifinityBalance(uid, -BANNER_COST, "booster_banner", newWalletOperationKey("purchase"));
      const cards = generatePack(pool, PACK_WEIGHTS.standard, undefined, null, banner);
      const openedAt = Date.now();
      persist((prev) => ({
        ...prev,
        coins: Number(wallet.balance),
        pendingPack: { source: "banner", cards, openedAt, claimId: newWalletOperationKey("claim"), purchaseBalance: Number(wallet.balance) },
        stats: { ...prev.stats, opened: prev.stats.opened + 1 },
      }));
    } catch (e) {
      console.error("Waifinity booster de saison :", e);
      setWalletIssue(e?.message || "Achat impossible pour le moment.");
    } finally {
      walletBusyRef.current = false;
      setWalletBusy(false);
    }
  }, [uid, banner, walletReady, state.pendingPack, state.coins, pool, persist]);

  // ── Récompense quotidienne ────────────────────────────────────────────────
  // La clé d'idempotence est liée au jour ET au compte : récupérer la même
  // journée depuis deux appareils ne crédite qu'une fois côté Supabase.
  const claimDaily = useCallback(async () => {
    const st = dailyStatus(stateRef.current);
    if (st.claimed || !uid || !walletReady || walletBusyRef.current) return null;
    walletBusyRef.current = true;
    setWalletBusy(true);
    setWalletIssue(null);
    try {
      const wallet = await adjustWaifinityBalance(uid, st.reward, "daily_bonus", `daily:${uid}:${st.todayKey}`);
      persist((prev) => withMissionEvents({ ...prev, coins: Number(wallet.balance), dailyStreak: st.nextStreak, lastDailyKey: st.todayKey }, uid, [{ type: "daily", amount: 1 }]));
      return { reward: st.reward, streak: st.nextStreak };
    } catch (e) {
      console.error("Waifinity récompense quotidienne :", e);
      setWalletIssue(e?.message || "Impossible de récupérer la récompense quotidienne.");
      return null;
    } finally {
      walletBusyRef.current = false;
      setWalletBusy(false);
    }
  }, [uid, walletReady, persist]);

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
        return withMissionEvents({ ...next, coins: serverBalance }, uid, packMissionEvents(results, pack.source));
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

  // Rafraîchissement complet de Waifinity (bouton de l'en-tête ET pull-to-refresh) :
  // Supabase est la source de vérité pour la collection et le solde. Chaque
  // source est indépendante (allSettled) : si les échanges échouent, la
  // collection et le solde sont quand même mis à jour. Un solde récupéré avec
  // succès lève aussi le blocage « wallet indisponible » d'un premier chargement raté.
  // Ignoré pendant un achat ou la récupération d'un booster, pour ne pas
  // écraser un état en cours d'écriture.
  const refreshWaifinity = useCallback(async () => {
    if (!uid || refreshBusyRef.current || walletBusyRef.current) return;
    refreshBusyRef.current = true;
    setRefreshing(true);
    setWalletIssue(null);
    try {
      const [collectionR, walletR, tradesR] = await Promise.allSettled([
        fetchMyWaifinityCollection(uid),
        fetchWaifinityWallet(uid),
        fetchMyTrades(uid),
        withPool ? loadPool(true) : Promise.resolve(),
      ]);

      let wallet = walletR.status === "fulfilled" ? walletR.value : null;
      if (!wallet && walletR.status === "fulfilled") {
        // Aucun wallet encore créé pour ce compte : on l'initialise.
        try { wallet = await ensureWaifinityWallet(uid, stateRef.current.coins); } catch (e) { console.error("Waifinity wallet :", e); }
      }

      const collection = collectionR.status === "fulfilled" ? collectionR.value : null;
      const balance = wallet ? Number(wallet.balance) || 0 : null;
      if (collection || balance != null) {
        persist((prev) => ({
          ...prev,
          ...(collection ? { collection } : {}),
          ...(balance != null ? { coins: balance } : {}),
        }));
      }
      if (balance != null) setWalletReady(true);
      else setWalletIssue(walletR.status === "rejected" ? (walletR.reason?.message || "Impossible de rafraîchir le solde.") : "Impossible de rafraîchir le solde.");
      if (tradesR.status === "fulfilled") setTrades(tradesR.value || []);
    } catch (e) {
      console.error("Rafraîchissement Waifinity :", e);
      setWalletIssue(e?.message || "Impossible de rafraîchir Waifinity.");
    } finally {
      refreshBusyRef.current = false;
      setRefreshing(false);
    }
  }, [uid, withPool, loadPool, persist]);

  // Après un échange, le RPC a déjà modifié waifinity_collection_items.
  // On ne réapplique donc surtout pas le swap dans le localStorage : cela
  // provoquerait des doublons et pourrait ensuite réécrire de mauvais compteurs
  // dans Supabase. On recharge simplement l'état serveur exact.
  const reloadCollectionFromServer = useCallback(async () => {
    if (!uid) return {};
    const server = await fetchMyWaifinityCollection(uid);
    if (server) persist((prev) => ({ ...prev, collection: server }));
    return server || {};
  }, [uid, persist]);

  const applyResolvedTrades = useCallback(async () => {
    if (!uid) return;
    await reloadCollectionFromServer();
    await refreshTrades();
  }, [uid, reloadCollectionFromServer, refreshTrades]);

  useEffect(() => { applyResolvedTrades(); }, [applyResolvedTrades]);

  // Échange terminé par l'AUTRE ami pendant que j'ai l'écran ouvert : exposé
  // pour que l'UI joue l'animation (voir SocialTab).
  const [completedTrade, setCompletedTrade] = useState(null);
  const animatedTradesRef = useRef(new Set());

  // 1. Je propose une carte à un ami.
  const proposeTrade = useCallback(async (toUser, offer) => {
    await proposeTradeService({ toUser, offer });
    persist((prev) => withMissionEvents(prev, uid, [{ type: "trade", amount: 1 }]));
    await refreshTrades();
  }, [uid, refreshTrades, persist]);

  // 2. Je choisis (ou change) la carte que je donne en retour.
  const counterTrade = useCallback(async (trade, card) => {
    await counterTradeServer(trade.id, card);
    await refreshTrades();
  }, [refreshTrades]);

  // 3. Je valide. La 2e validation exécute l'échange côté serveur.
  //    Renvoie { status: "countered" | "accepted" | "failed", trade }.
  const confirmTrade = useCallback(async (trade) => {
    const status = await confirmTradeServer(trade.id);
    if (status === "accepted") {
      animatedTradesRef.current.add(trade.id);
      markTradeEventSeen(uid, `${trade.id}:accepted`); // pas de notif pour celui qui vient de valider
      await applyResolvedTrades();
    } else {
      await refreshTrades();
      if (status === "failed") await reloadCollectionFromServer();
    }
    return { status, trade };
  }, [uid, applyResolvedTrades, refreshTrades, reloadCollectionFromServer]);

  const declineTrade = useCallback(async (tradeId) => {
    await closeTradeServer(tradeId);
    await refreshTrades();
  }, [refreshTrades]);

  const cancelTrade = declineTrade; // le serveur distingue refus / annulation selon qui appelle

  // ── Temps réel : l'écran se met à jour quand l'autre agit ────────────────
  useEffect(() => {
    if (!uid || !withPool) return;
    const onChange = async (payload) => {
      const row = payload.new;
      await refreshTrades();
      if (row?.status === "accepted" && !animatedTradesRef.current.has(row.id)) {
        animatedTradesRef.current.add(row.id);
        await reloadCollectionFromServer();
        setCompletedTrade(row);
      }
    };
    const channel = supabase
      .channel(`waifinity-trades-ui-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "waifinity_trades", filter: `to_user=eq.${uid}` }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "waifinity_trades", filter: `from_user=eq.${uid}` }, onChange)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [uid, withPool, refreshTrades, reloadCollectionFromServer]);

  // ── Favoris : jusqu'à MAX_FAVORITES personnages épinglés en tête de collection ──
  const toggleFavorite = useCallback((id) => {
    persist((prev) => {
      const cur = prev.favorites || [];
      if (cur.includes(id)) return { ...prev, favorites: cur.filter((x) => x !== id) };
      if (cur.length >= MAX_FAVORITES || !prev.collection[id]) return prev;
      return withMissionEvents({ ...prev, favorites: [...cur, id] }, uid, [{ type: "favorite", amount: 1 }]);
    });
  }, [persist, uid]);

  // ── Ordre des favoris ─────────────────────────────────────────────────────
  // `favorites` est un tableau ordonné : l'ordre = celui du carrousel (et de la
  // vitrine vue par les amis). Il est synchronisé comme le reste des extras
  // (voir extrasSig plus bas), aucune autre écriture à prévoir.

  /** Déplace un favori à la position `toIndex` (0 = premier). */
  const moveFavorite = useCallback((id, toIndex) => {
    persist((prev) => {
      const cur = prev.favorites || [];
      const from = cur.indexOf(id);
      if (from < 0) return prev;
      const to = Math.max(0, Math.min(cur.length - 1, toIndex));
      if (to === from) return prev;
      const next = [...cur];
      next.splice(from, 1);
      next.splice(to, 0, id);
      return { ...prev, favorites: next };
    });
  }, [persist]);

  /** Applique un nouvel ordre complet (glisser-déposer). Ne peut ni ajouter ni retirer de favori. */
  const setFavoritesOrder = useCallback((ids) => {
    persist((prev) => {
      const cur = prev.favorites || [];
      const next = ids.filter((id, i) => cur.includes(id) && ids.indexOf(id) === i);
      for (const id of cur) if (!next.includes(id)) next.push(id);
      if (next.length === cur.length && next.every((id, i) => id === cur[i])) return prev;
      return { ...prev, favorites: next };
    });
  }, [persist]);

  // ── Atelier : cosmétiques achetés avec des fragments ──────────────────────
  const buyCosmetic = useCallback((id) => {
    const item = COSMETICS_BY_ID[id];
    const s = stateRef.current;
    if (!item || s.cosmetics.owned.includes(id) || (s.fragments || 0) < item.cost) return false;
    persist((prev) => {
      if (prev.cosmetics.owned.includes(id) || (prev.fragments || 0) < item.cost) return prev;
      return {
        ...prev,
        fragments: prev.fragments - item.cost,
        cosmetics: { ...prev.cosmetics, owned: [...prev.cosmetics.owned, id] },
      };
    });
    return true;
  }, [persist]);

  /** Équipe (ou retire, avec id = null) le cadre ou l'effet d'UN personnage possédé. */
  const equipCosmetic = useCallback((characterId, slot, id) => {
    persist((prev) => {
      if (!prev.collection[characterId]) return prev;
      if (id && !prev.cosmetics.owned.includes(id)) return prev;
      const next = { ...(prev.cosmetics.equipped[characterId] || {}), [slot]: id || null };
      const equipped = { ...prev.cosmetics.equipped };
      if (!next.frame && !next.effect) delete equipped[characterId];
      else equipped[characterId] = next;
      const out = { ...prev, cosmetics: { ...prev.cosmetics, equipped } };
      return id ? withMissionEvents(out, uid, [{ type: "equip", amount: 1 }]) : out;
    });
  }, [persist, uid]);

  // ── Missions quotidiennes : récompense en Anigold, versée une seule fois ──
  const claimMission = useCallback(async (missionId) => {
    const today = ensureMissionDay(stateRef.current.missions, uid);
    const mission = today.list.find((m) => m.id === missionId);
    const def = getMission(missionId);
    if (!mission || !def || mission.claimed || mission.progress < def.target) return null;
    if (!uid || !walletReady || walletBusyRef.current) return null;
    walletBusyRef.current = true;
    setWalletBusy(true);
    setWalletIssue(null);
    try {
      const wallet = await adjustWaifinityBalance(uid, def.reward, "mission_reward", `mission:${uid}:${today.dayKey}:${missionId}`);
      persist((prev) => {
        const cur = ensureMissionDay(prev.missions, uid);
        const missions = cur.dayKey === today.dayKey
          ? { ...cur, list: cur.list.map((m) => (m.id === missionId ? { ...m, claimed: true } : m)) }
          : cur;
        return { ...prev, coins: Number(wallet.balance), missions };
      });
      return { reward: def.reward, label: def.label };
    } catch (e) {
      console.error("Waifinity mission :", e);
      setWalletIssue(e?.message || "Impossible de récupérer la récompense de la mission.");
      return null;
    } finally {
      walletBusyRef.current = false;
      setWalletBusy(false);
    }
  }, [uid, walletReady, persist]);

  const claimMissionBonus = useCallback(async () => {
    const today = ensureMissionDay(stateRef.current.missions, uid);
    if (today.bonusClaimed || !today.list.length || !today.list.every((m) => m.claimed)) return null;
    if (!uid || !walletReady || walletBusyRef.current) return null;
    walletBusyRef.current = true;
    setWalletBusy(true);
    setWalletIssue(null);
    try {
      const wallet = await adjustWaifinityBalance(uid, MISSION_BONUS.coins, "mission_bonus", `mission_bonus:${uid}:${today.dayKey}`);
      persist((prev) => {
        const cur = ensureMissionDay(prev.missions, uid);
        if (cur.dayKey !== today.dayKey) return { ...prev, coins: Number(wallet.balance) };
        return {
          ...prev,
          coins: Number(wallet.balance),
          fragments: (prev.fragments || 0) + MISSION_BONUS.fragments,
          missions: { ...cur, bonusClaimed: true },
        };
      });
      return { ...MISSION_BONUS };
    } catch (e) {
      console.error("Waifinity bonus de missions :", e);
      setWalletIssue(e?.message || "Impossible de récupérer le bonus des missions.");
      return null;
    } finally {
      walletBusyRef.current = false;
      setWalletBusy(false);
    }
  }, [uid, walletReady, persist]);

  // ── Vitrine / fragments / cosmétiques : miroir Supabase (best effort) ─────
  // Au chargement, on adopte la version serveur si elle est plus récente que
  // la dernière synchro locale ; ensuite, chaque changement est poussé après
  // un court délai (dernier écrit gagnant). showcase_visible n'est jamais
  // écrit ici (voir services/waifinityShowcase.js).
  const [extrasReady, setExtrasReady] = useState(false);
  const lastExtrasSigRef = useRef(null);

  useEffect(() => {
    setExtrasReady(false);
    lastExtrasSigRef.current = null;
    if (!uid || !withPool) return;
    let cancelled = false;
    (async () => {
      const row = await fetchMyShowcase(uid);
      if (cancelled) return;
      const serverAt = row?.updated_at ? Date.parse(row.updated_at) : 0;
      if (row && serverAt > (stateRef.current.extrasUpdatedAt || 0)) {
        persist((prev) => ({
          ...prev,
          favorites: Array.isArray(row.favorites) ? row.favorites : prev.favorites,
          fragments: Number.isFinite(row.fragments) ? row.fragments : prev.fragments,
          cosmetics: row.cosmetics?.owned ? { owned: row.cosmetics.owned, equipped: row.cosmetics.equipped || {} } : prev.cosmetics,
          extrasUpdatedAt: serverAt,
        }));
      }
      setExtrasReady(true);
    })();
    return () => { cancelled = true; };
  }, [uid, withPool, persist]);

  const extrasSig = useMemo(
    () => JSON.stringify([state.favorites, state.fragments, state.cosmetics]),
    [state.favorites, state.fragments, state.cosmetics]
  );
  useEffect(() => {
    if (!uid || !extrasReady || lastExtrasSigRef.current === extrasSig) return;
    const t = setTimeout(async () => {
      const s = stateRef.current;
      const ok = await pushShowcase(uid, { favorites: s.favorites, fragments: s.fragments, cosmetics: s.cosmetics });
      if (ok) {
        lastExtrasSigRef.current = extrasSig;
        persist((prev) => ({ ...prev, extrasUpdatedAt: Date.now() }));
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [uid, extrasReady, extrasSig, persist]);

  return {
    coins: state.coins,
    stats: state.stats,
    collection: state.collection,
    completedSeries: state.completedSeries,
    collectionList,
    pendingPack: state.pendingPack,
    pool, poolMeta, poolLoading, poolError, reloadPool: () => loadPool(true),
    canOpenFree, cooldownMs, now,
    openFreeBooster, openStandardBooster, openTargetedBooster, openGenderBooster, openWishBooster, claimPack,
    daily: dailyStatus(state), claimDaily,
    // Fragments, cosmétiques, missions, bannière de saison
    fragments: state.fragments || 0,
    ownedCosmetics: state.cosmetics?.owned || [],
    equipped: state.cosmetics?.equipped || {},
    buyCosmetic, equipCosmetic,
    missions: describeMissions(ensureMissionDay(state.missions, uid)), claimMission, claimMissionBonus,
    banner, openBannerBooster, canAffordBanner: state.coins >= BANNER_COST,
    canAffordBooster: state.coins >= SHOP_BOOSTER_COST,
    canAffordTarget:  state.coins >= SHOP_TARGET_COST,
    canAffordGender:  state.coins >= SHOP_GENDER_COST,
    canAffordWish:    (tier) => state.coins >= wishCost(tier),
    trades, refreshTrades, refreshWaifinity, refreshing,
    proposeTrade, counterTrade, confirmTrade, declineTrade, cancelTrade,
    completedTrade, clearCompletedTrade: () => setCompletedTrade(null),
    saveIssue, syncIssue, walletIssue, walletBusy, walletReady,
    favorites: state.favorites || [], toggleFavorite, moveFavorite, setFavoritesOrder,
  };
}
