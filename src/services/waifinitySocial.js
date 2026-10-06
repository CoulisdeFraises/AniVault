import { supabase } from "../lib/supabase";

// ── Miroir de collection (classement + doublons visibles par les amis) ──────
//
// Le jeu reste piloté par l'état local (voir utils/waifinity.js) — ces
// fonctions tiennent juste à jour un miroir public dans Supabase, utilisé
// pour le classement entre amis et l'écran d'échange. Voir
// supabase/waifinity_social.sql pour le schéma et les policies RLS.

/**
 * Pousse UN personnage (nouvellement obtenu, ou dont le compteur a changé).
 * Ne pas envoyer `first_obtained_at` ici : PostgREST ne met à jour QUE les
 * colonnes présentes dans le payload sur un conflit, donc l'omettre revient à
 * ne jamais l'écraser après l'INSERT initial (où sa valeur par défaut
 * s'applique). Renvoie true/false — voir useWaifinity : ce miroir sert de
 * filet de sécurité si la sauvegarde locale échoue (quota localStorage).
 */
export async function syncWaifinityItem(userId, item) {
  if (!userId || !item) return false;

  // Une carte à 0 n'est plus un élément de collection.
  // On la supprime plutôt que de conserver une ligne fantôme.
  if (Number(item.count) <= 0) {
    return deleteWaifinityItem(userId, item.id);
  }

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
  if (error) { console.error("Sync Waifinity (item) :", error.message); return false; }
  return true;
}

/**
 * Toute MA collection, telle que connue de Supabase — utilisée au chargement
 * pour réparer l'état local si une sauvegarde localStorage a échoué (voir
 * useWaifinity : le local et ce miroir se réconcilient dans les deux sens).
 */
export async function fetchMyWaifinityCollection(userId) {
  if (!userId) return {};
  const { data, error } = await supabase
    .from("waifinity_collection_items")
    .select("character_id, count, tier, name, series, gender, first_obtained_at")
    .eq("user_id", userId);
  if (error) { console.error("Fetch ma collection Waifinity :", error.message); return null; }
  const byId = {};
  for (const row of data || []) {
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
  const { data, error } = await supabase
    .from("waifinity_collection_items")
    .select("character_id, count, tier, name, image, series, gender")
    .eq("user_id", userId);
  if (error) { console.error("Fetch Waifinity items :", error.message); return []; }
  return data || [];
}

/** Items de plusieurs utilisateurs à la fois (classement). */
export async function fetchWaifinityItemsBulk(userIds) {
  if (!userIds?.length) return {};
  const { data, error } = await supabase
    .from("waifinity_collection_items")
    .select("user_id, character_id, count, tier, name, image, series, gender")
    .in("user_id", userIds);
  if (error) { console.error("Fetch Waifinity items (bulk) :", error.message); return {}; }
  const byUser = {};
  for (const row of data || []) (byUser[row.user_id] ||= []).push(row);
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
