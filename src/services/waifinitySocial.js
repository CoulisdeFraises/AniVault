import { supabase } from "../lib/supabase";

// ── Miroir de collection (classement + doublons visibles par les amis) ──────
//
// Le jeu reste piloté par l'état local (voir utils/waifinity.js) — ces
// fonctions tiennent juste à jour un miroir public dans Supabase, utilisé
// pour le classement entre amis et l'écran d'échange. Voir
// supabase/waifinity_social.sql pour le schéma et les policies RLS.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RETRY_DELAYS_MS = [0, 600, 1800]; // 1 essai + 2 réessais (réseau mobile instable)

// File d'attente locale des envois définitivement échoués : rejouée au chargement
// suivant (voir flushWaifinitySyncQueue). Sans elle, une carte jamais arrivée sur
// le serveur disparaissait de la collection ET du classement au prochain chargement,
// puisque le serveur est la source de vérité.
const queueKey = (uid) => `anivault:waifinity-sync-queue:${uid}`;
function loadQueue(uid) {
  try { return JSON.parse(localStorage.getItem(queueKey(uid)) || "{}"); } catch { return {}; }
}
function saveQueue(uid, q) {
  try {
    if (Object.keys(q).length) localStorage.setItem(queueKey(uid), JSON.stringify(q));
    else localStorage.removeItem(queueKey(uid));
  } catch { /* quota : tant pis, le prochain envoi réussi suffira */ }
}
function enqueue(uid, item) {
  const q = loadQueue(uid);
  q[item.id] = {
    id: item.id, count: item.count, tier: item.tier, name: item.name,
    image: item.image, series: item.series, gender: item.gender ?? null,
  };
  saveQueue(uid, q);
}
function dequeue(uid, id) {
  const q = loadQueue(uid);
  if (q[id] !== undefined) { delete q[id]; saveQueue(uid, q); }
}

async function upsertItem(userId, item) {
  const { error } = await supabase.from("waifinity_collection_items").upsert({
    user_id:      userId,
    character_id: item.id,
    count:        item.count,
    tier:         item.tier,
    name:         item.name,
    image:        item.image,
    series:       item.series,
    gender:       item.gender ?? null,
    updated_at:   new Date().toISOString(),
  });
  return error || null;
}

/**
 * Pousse UN personnage (nouvellement obtenu, ou dont le compteur a changé).
 * Ne pas envoyer `first_obtained_at` ici : PostgREST ne met à jour QUE les
 * colonnes présentes dans le payload sur un conflit, donc l'omettre revient à
 * ne jamais l'écraser après l'INSERT initial (où sa valeur par défaut
 * s'applique). Renvoie true/false — voir useWaifinity : ce miroir sert de
 * filet de sécurité si la sauvegarde locale échoue (quota localStorage).
 *
 * En cas d'échec, l'envoi est retenté 2 fois puis mis en file d'attente locale
 * pour être rejoué au prochain chargement.
 */
export async function syncWaifinityItem(userId, item) {
  if (!userId || !item) return false;

  // Une carte à 0 n'est plus un élément de collection.
  // On la supprime plutôt que de conserver une ligne fantôme.
  if (Number(item.count) <= 0) {
    dequeue(userId, item.id);
    return deleteWaifinityItem(userId, item.id);
  }

  let lastError = null;
  for (const wait of RETRY_DELAYS_MS) {
    if (wait) await sleep(wait);
    lastError = await upsertItem(userId, item);
    if (!lastError) { dequeue(userId, item.id); return true; }
  }
  console.error("Sync Waifinity (item) :", lastError?.message);
  enqueue(userId, item);
  return false;
}

/**
 * Rejoue les envois restés en file d'attente. À appeler AVANT de relire la
 * collection serveur. Un élément n'est renvoyé que si le serveur en a moins
 * (jamais arrivé, ou arrivé en retard) : on ne réécrit pas un compteur que
 * l'autre côté d'un échange aurait fait baisser entre-temps.
 */
export async function flushWaifinitySyncQueue(userId) {
  if (!userId) return;
  const q = loadQueue(userId);
  const ids = Object.keys(q);
  if (!ids.length) return;

  const { data, error } = await supabase
    .from("waifinity_collection_items")
    .select("character_id, count")
    .eq("user_id", userId)
    .in("character_id", ids);
  if (error) return; // réseau : on réessaiera au prochain chargement

  const serverCount = new Map((data || []).map((r) => [String(r.character_id), Number(r.count) || 0]));
  for (const id of ids) {
    const item = q[id];
    if ((serverCount.get(String(id)) ?? 0) >= item.count) { delete q[id]; continue; }
    if (!(await upsertItem(userId, item))) delete q[id];
  }
  saveQueue(userId, q);
}

// ── Lectures paginées ────────────────────────────────────────────────────────
// PostgREST plafonne chaque réponse (1 000 lignes par défaut sur Supabase) SANS
// renvoyer d'erreur : une grosse collection, ou le classement de plusieurs amis,
// était silencieusement tronqué — scores faux, différents selon qui regarde, et
// collection locale remplacée par une version incomplète. On lit donc page par
// page (ordre stable) jusqu'à épuisement ; on avance du nombre de lignes
// RÉELLEMENT reçues, donc même un plafond serveur plus bas est géré.
const PAGE_SIZE = 1000;

async function fetchAllRows(buildQuery) {
  const rows = [];
  for (let from = 0; ; ) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (!data?.length) return rows;
    rows.push(...data);
    from += data.length;
  }
}

/**
 * Toute MA collection, telle que connue de Supabase — utilisée au chargement
 * pour réparer l'état local si une sauvegarde localStorage a échoué (voir
 * useWaifinity : le local et ce miroir se réconcilient dans les deux sens).
 */
export async function fetchMyWaifinityCollection(userId) {
  if (!userId) return {};
  let data;
  try {
    data = await fetchAllRows(() => supabase
      .from("waifinity_collection_items")
      .select("character_id, count, tier, name, series, gender, first_obtained_at")
      .eq("user_id", userId)
      .order("character_id"));
  } catch (error) {
    // null (et non {}) : l'appelant ne doit JAMAIS remplacer la collection locale par du vide.
    console.error("Fetch ma collection Waifinity :", error.message);
    return null;
  }
  const byId = {};
  for (const row of data) {
    byId[row.character_id] = {
      id: row.character_id, count: row.count, tier: row.tier, name: row.name,
      series: row.series, gender: row.gender,
      firstObtainedAt: row.first_obtained_at ? new Date(row.first_obtained_at).getTime() : Date.now(),
    };
  }
  return byId;
}

/** Items d'un seul utilisateur (écran d'échange : doublons d'un ami donné). */
/** Supprime explicitement une carte de la collection miroir. */
export async function deleteWaifinityItem(userId, characterId) {
  if (!userId || characterId == null) return false;
  const { error } = await supabase
    .from("waifinity_collection_items")
    .delete()
    .eq("user_id", userId)
    .eq("character_id", characterId);
  if (error) throw error;
  return true;
}

export async function fetchWaifinityItems(userId) {
  try {
    return await fetchAllRows(() => supabase
      .from("waifinity_collection_items")
      .select("character_id, count, tier, name, image, series, gender")
      .eq("user_id", userId)
      .order("character_id"));
  } catch (error) {
    console.error("Fetch Waifinity items :", error.message);
    return [];
  }
}

/** Seulement certains personnages d'un joueur (vitrine : ses favoris, pas toute sa collection). */
export async function fetchWaifinityItemsByIds(userId, characterIds) {
  if (!userId || !characterIds?.length) return [];
  try {
    const { data, error } = await supabase
      .from("waifinity_collection_items")
      .select("character_id, count, tier, name, image, series, gender")
      .eq("user_id", userId)
      .in("character_id", characterIds);
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Fetch Waifinity items (ids) :", error.message);
    return [];
  }
}

/**
 * Items de plusieurs utilisateurs à la fois (classement). `columns` permet de ne
 * lire que le nécessaire (le classement n'a besoin ni des noms ni des images).
 * Renvoie `null` en cas d'erreur — surtout PAS {} : un classement calculé sur des
 * données manquantes afficherait des scores faux au lieu d'un message d'erreur.
 */
export async function fetchWaifinityItemsBulk(userIds, columns = "user_id, character_id, count, tier, name, image, series, gender") {
  if (!userIds?.length) return {};
  let rows;
  try {
    rows = await fetchAllRows(() => supabase
      .from("waifinity_collection_items")
      .select(columns)
      .in("user_id", userIds)
      .order("user_id")
      .order("character_id"));
  } catch (error) {
    console.error("Fetch Waifinity items (bulk) :", error.message);
    return null;
  }
  const byUser = {};
  for (const row of rows) (byUser[row.user_id] ||= []).push(row);
  return byUser;
}

// ── Échanges ──────────────────────────────────────────────────────────────────
//
// Flux en 3 étapes (voir supabase/waifinity_trades_v2.sql) :
//   1. A propose une carte à B                    → status "offered"
//   2. B choisit une carte à lui en retour        → status "countered"
//   3. A et B valident ; la 2e validation exécute → status "accepted"
// Tout passe par des fonctions SQL : le client ne modifie jamais la table.

/** A propose UNE carte (`offer` = { id, … }) à un ami. */
export async function proposeTrade({ toUser, offer }) {
  const { error } = await supabase.rpc("propose_waifinity_trade", {
    p_to_user: toUser,
    p_character_id: String(offer.id),
  });
  if (error) throw error;
}

/** B répond avec une carte à lui (remet les deux validations à zéro). */
export async function counterTradeServer(tradeId, card) {
  const { error } = await supabase.rpc("counter_waifinity_trade", {
    p_trade_id: String(tradeId),
    p_character_id: String(card.id),
  });
  if (error) throw error;
}

/**
 * Valide l'échange de MON côté. Renvoie "countered" (l'autre n'a pas encore
 * validé), "accepted" (échange exécuté) ou "failed" (une carte n'est plus là).
 */
export async function confirmTradeServer(tradeId) {
  const { data, error } = await supabase.rpc("confirm_waifinity_trade", { p_trade_id: String(tradeId) });
  if (error) throw error;
  return data;
}

/** Refuser (destinataire) ou annuler (auteur) un échange en cours. */
export async function closeTradeServer(tradeId) {
  const { error } = await supabase.rpc("close_waifinity_trade", { p_trade_id: String(tradeId) });
  if (error) throw error;
}

/** Tous mes échanges (envoyés + reçus), les plus récents d'abord. */
export async function fetchMyTrades(myId) {
  const { data, error } = await supabase
    .from("waifinity_trades")
    .select("*")
    .or(`from_user.eq.${myId},to_user.eq.${myId}`)
    .order("created_at", { ascending: false });
  if (error) { console.error("Fetch Waifinity trades :", error.message); return []; }
  return data || [];
}
