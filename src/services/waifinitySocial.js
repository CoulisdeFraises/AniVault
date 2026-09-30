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

/** Propose un échange : `offer`/`request` = { id, name, image, tier, series, gender }. */
export async function proposeTrade({ fromUser, toUser, offer, request }) {
  const { error } = await supabase.from("waifinity_trades").insert({
    from_user: fromUser, to_user: toUser,
    offer_character_id: offer.id, offer_name: offer.name, offer_image: offer.image,
    offer_tier: offer.tier, offer_series: offer.series, offer_gender: offer.gender ?? null,
    request_character_id: request.id, request_name: request.name, request_image: request.image,
    request_tier: request.tier, request_series: request.series, request_gender: request.gender ?? null,
  });
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

/** Refuser (côté to_user) ou annuler (côté from_user) une proposition en attente. */
export async function closeTrade(tradeId, status) {
  const { error } = await supabase.from("waifinity_trades")
    .update({ status, resolved_at: new Date().toISOString() })
    .eq("id", tradeId);
  if (error) throw error;
}

/** Accepte : exécute le swap atomique côté serveur (voir accept_waifinity_trade). */
export async function acceptTradeServer(tradeId) {
  const { error } = await supabase.rpc("accept_waifinity_trade", { p_trade_id: tradeId });
  if (error) throw error;
}

/** Marque MON côté comme répercuté dans mon état local (voir useWaifinity). */
export async function markTradeApplied(tradeId, side) {
  const { error } = await supabase
    .from("waifinity_trades")
    .update({ [side]: true })
    .eq("id", tradeId);
  if (error) throw error;
}
