import { supabase } from "../lib/supabase";

function requireAuthUser(userId) {
  if (!userId) throw new Error("Utilisateur non connecté");
}

/**
 * Initialise le wallet une seule fois.
 * p_initial_balance sert uniquement à migrer l'ancien solde local lors du
 * premier lancement après déploiement. Si le wallet existe déjà, Supabase
 * garde son solde et ignore cette valeur.
 */
export async function ensureWaifinityWallet(userId, initialBalance = 0) {
  requireAuthUser(userId);
  const safeInitial = Math.max(0, Math.floor(Number(initialBalance) || 0));
  const { data, error } = await supabase.rpc("ensure_waifinity_wallet", {
    p_initial_balance: safeInitial,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

/**
 * Applique un mouvement AniGold côté serveur.
 * Le RPC est atomique et idempotent : répéter la même clé ne crée pas un
 * second mouvement.
 */
export async function adjustWaifinityBalance(userId, amount, reason, idempotencyKey) {
  requireAuthUser(userId);
  const { data, error } = await supabase.rpc("adjust_waifinity_balance", {
    p_amount: Math.trunc(amount),
    p_reason: reason,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function fetchWaifinityWallet(userId) {
  requireAuthUser(userId);
  const { data, error } = await supabase
    .from("waifinity_wallets")
    .select("user_id, balance, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function newWalletOperationKey(prefix = "op") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}:${crypto.randomUUID()}`;
  }
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}
