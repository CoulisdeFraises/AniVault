import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { addNotification } from "./useNotificationStore";
import { loadState, msUntilFreeBooster, WAIFINITY_SAVED_EVENT } from "../utils/waifinity";

const TRADES_LINK  = "/games/waifinity?tab=social&view=trades";
const BOOSTER_LINK = "/games/waifinity?tab=boosters";
const DAY_MS       = 24 * 60 * 60 * 1000;

// ── Notification système (hors app au premier plan) ─────────────────────────
// En plus du store in-app (toast + badge + panel), on affiche une notification
// du navigateur quand l'onglet est masqué/en arrière-plan. Ne fonctionne que
// tant que l'app tourne ; voir la note sur le push serveur dans le README.

function showSystemNotification({ title, body, tag, link }) {
  try {
    if (typeof document === "undefined" || document.visibilityState === "visible") return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    if (localStorage.getItem("pref_notifications") === "false") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready
      .then((reg) => reg.showNotification(title, {
        body, tag,
        icon: "/logo.png",
        badge: "/favicon-96x96.png",
        data: { link },
      }))
      .catch(() => {});
  } catch {}
}

function notify({ title, body, icon, link, dedupeKey }) {
  addNotification({ title, body, icon, link, dedupeKey });
  showSystemNotification({ title, body, tag: dedupeKey, link });
}

// ═══════════════════════════════════════════════════════════════════════════
// Échanges
// ═══════════════════════════════════════════════════════════════════════════

// Évènements déjà notifiés, mémorisés par compte : permet le « rattrapage » au
// démarrage (échanges reçus app fermée) sans jamais renotifier deux fois.
const seenKey = (uid) => `anivault:waifinity-trade-notifs:${uid}`;
const MAX_SEEN = 200;

function loadSeen(uid) {
  try { return JSON.parse(localStorage.getItem(seenKey(uid)) || "[]"); } catch { return []; }
}

/** Marque un évènement comme notifié. Renvoie false s'il l'était déjà. */
export function markTradeEventSeen(uid, key) {
  if (!uid) return true;
  const seen = loadSeen(uid);
  if (seen.includes(key)) return false;
  try { localStorage.setItem(seenKey(uid), JSON.stringify([...seen, key].slice(-MAX_SEEN))); } catch {}
  return true;
}

/**
 * Déduit de l'état ACTUEL d'un échange ce qui est une nouvelle pour moi.
 * Le même calcul sert au temps réel et au rattrapage du démarrage.
 * Renvoie { key, otherId, build(name) } ou null.
 */
function tradeNewsFor(trade, me) {
  if (!trade || (trade.from_user !== me && trade.to_user !== me)) return null;
  const isFrom  = trade.from_user === me;
  const otherId = isFrom ? trade.to_user : trade.from_user;
  const stamp   = trade.countered_at || trade.created_at;

  switch (trade.status) {
    case "offered":
      if (isFrom) return null;
      return {
        key: `${trade.id}:offered`, otherId,
        build: (n) => ({
          title: "Échange proposé",
          body: `@${n} te propose ${trade.offer_name}. Choisis une carte en retour !`,
        }),
      };

    case "countered": {
      const myConfirmed    = isFrom ? trade.from_confirmed : trade.to_confirmed;
      const theirConfirmed = isFrom ? trade.to_confirmed : trade.from_confirmed;
      if (myConfirmed) return null;
      if (theirConfirmed) {
        return {
          key: `${trade.id}:confirmed:${stamp}`, otherId,
          build: (n) => ({
            title: "Échange prêt à valider",
            body: `@${n} a validé l'échange ${trade.offer_name} ⇄ ${trade.request_name}. À toi de valider !`,
          }),
        };
      }
      if (isFrom) {
        return {
          key: `${trade.id}:countered:${stamp}`, otherId,
          build: (n) => ({
            title: "Carte proposée en retour",
            body: `@${n} te propose ${trade.request_name} contre ${trade.offer_name}. Valide si ça te va !`,
          }),
        };
      }
      return null;
    }

    case "accepted":
      return {
        key: `${trade.id}:accepted`, otherId, terminal: true,
        build: (n) => ({
          title: "Échange réalisé",
          body: `Échange avec @${n} terminé : tu as reçu ${isFrom ? trade.request_name : trade.offer_name}.`,
        }),
      };

    case "declined":
      if (!isFrom) return null;
      return {
        key: `${trade.id}:declined`, otherId, terminal: true,
        build: (n) => ({ title: "Échange refusé", body: `@${n} a refusé ton échange.` }),
      };

    case "cancelled":
      if (isFrom) return null;
      return {
        key: `${trade.id}:cancelled`, otherId, terminal: true,
        build: (n) => ({ title: "Échange annulé", body: `@${n} a annulé son échange.` }),
      };

    default:
      return null;
  }
}

/**
 * useWaifinityTradeNotifications — prévient quand :
 *  - un ami me propose une carte,
 *  - on me propose une carte en retour de la mienne,
 *  - l'autre a validé et attend ma validation,
 *  - un échange est réalisé / refusé / annulé.
 *
 * Temps réel (Supabase Realtime sur `waifinity_trades`) + rattrapage au
 * démarrage. Prérequis : supabase/waifinity_trades_v2.sql (publication realtime
 * + REPLICA IDENTITY FULL).
 */
export function useWaifinityTradeNotifications(userId) {
  const namesRef = useRef(new Map());

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function usernameOf(id) {
      if (namesRef.current.has(id)) return namesRef.current.get(id);
      const { data } = await supabase.from("profiles").select("username").eq("user_id", id).maybeSingle();
      const name = data?.username || "Quelqu'un";
      namesRef.current.set(id, name);
      return name;
    }

    async function handleTrade(trade, { catchUp = false } = {}) {
      const news = tradeNewsFor(trade, userId);
      if (!news) return;
      // Rattrapage : on ignore les issues anciennes (refus, annulation…).
      if (catchUp && news.terminal) {
        const at = Date.parse(trade.resolved_at || trade.created_at);
        if (!Number.isFinite(at) || Date.now() - at > DAY_MS) return;
      }
      if (!markTradeEventSeen(userId, news.key)) return;
      const name = await usernameOf(news.otherId);
      if (cancelled) return;
      notify({ ...news.build(name), icon: "arrow-left-right", link: TRADES_LINK, dedupeKey: `trade-${news.key}` });
    }

    // ── Rattrapage : échanges reçus pendant que l'app était fermée ─────────
    (async () => {
      const { data, error } = await supabase
        .from("waifinity_trades")
        .select("*")
        .or(`from_user.eq.${userId},to_user.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error || cancelled) return;
      for (const t of (data || []).reverse()) await handleTrade(t, { catchUp: true });
    })();

    // ── Temps réel ───────────────────────────────────────────────────────
    const onChange = (payload) => handleTrade(payload.new);
    const channel = supabase
      .channel(`waifinity-trades-notif-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "waifinity_trades", filter: `to_user=eq.${userId}` }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "waifinity_trades", filter: `from_user=eq.${userId}` }, onChange)
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [userId]);
}

// ═══════════════════════════════════════════════════════════════════════════
// Booster gratuit
// ═══════════════════════════════════════════════════════════════════════════

const MAX_TIMEOUT = 2 ** 31 - 1;

/**
 * useFreeBoosterNotification — notifie quand le booster gratuit (1 toutes les
 * 3 h) redevient disponible. L'heure de dernière ouverture vient de la
 * sauvegarde locale du jeu ; elle est relue quand le jeu sauvegarde (évènement
 * WAIFINITY_SAVED_EVENT) et au retour au premier plan de l'app.
 * Une seule notification par « cycle » : mémorisée par lastFreeOpenedAt.
 */
export function useFreeBoosterNotification(userId) {
  useEffect(() => {
    if (!userId) return;
    const notifiedKey = `anivault:waifinity-free-notified:${userId}`;
    let timer = null;

    function check(lastFreeOpenedAt) {
      clearTimeout(timer);
      const last = Number.isFinite(lastFreeOpenedAt) ? lastFreeOpenedAt : (loadState(userId).lastFreeOpenedAt || 0);

      const remaining = msUntilFreeBooster(last);
      if (remaining > 0) {
        timer = setTimeout(() => check(), Math.min(remaining + 300, MAX_TIMEOUT));
        return;
      }

      let notifiedFor = null;
      try { notifiedFor = localStorage.getItem(notifiedKey); } catch {}
      if (notifiedFor === String(last)) return; // déjà prévenu pour ce cycle
      try { localStorage.setItem(notifiedKey, String(last)); } catch {}

      notify({
        title: "Booster gratuit disponible",
        body: "Ton booster Waifinity est prêt, viens l'ouvrir !",
        icon: "gift",
        link: BOOSTER_LINK,
        dedupeKey: `free-booster-${last}`,
      });
    }

    const onSaved   = (e) => { if (e.detail?.uid === userId) check(e.detail.lastFreeOpenedAt); };
    const onVisible = () => { if (document.visibilityState === "visible") check(); };

    check();
    window.addEventListener(WAIFINITY_SAVED_EVENT, onSaved);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(WAIFINITY_SAVED_EVENT, onSaved);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId]);
}
