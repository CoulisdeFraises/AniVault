import { supabase } from "../lib/supabase";

// ── Profil ────────────────────────────────────────────────────────────────────

/** Crée le profil public si inexistant (appelé au login) */
export async function initProfile(user) {
  const { data: existing } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return;

  const base =
    user.user_metadata?.username ||
    user.user_metadata?.full_name?.split(" ")[0] ||
    user.email?.split("@")[0] ||
    "user";

  // Génère un username unique en cas de collision
  let username = base.slice(0, 20).replace(/\s+/g, "_");
  let suffix = 0;
  while (true) {
    const candidate = suffix === 0 ? username : `${username}${suffix}`;
    const { data: clash } = await supabase
      .from("profiles").select("user_id").ilike("username", candidate).maybeSingle();
    if (!clash) { username = candidate; break; }
    suffix++;
  }

  await supabase.from("profiles").insert({
    user_id:     user.id,
    username,
    avatar_color: user.user_metadata?.avatar_color || "#7c3aed",
  });
}

export async function fetchMyProfile(userId) {
  const { data } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  return data;
}

/**
 * Met à jour le profil (description, couleur).
 * Le username est géré séparément pour appliquer la limite 1x/semaine.
 */
export async function updateProfileMeta(userId, { description, avatar_color }) {
  const updates = { updated_at: new Date().toISOString() };
  if (description  !== undefined) updates.description  = description;
  if (avatar_color !== undefined) updates.avatar_color = avatar_color;
  const { error } = await supabase.from("profiles").update(updates).eq("user_id", userId);
  if (error) throw error;
}

/** Change le username (vérifie la limite 1x/semaine côté client) */
export async function changeUsername(userId, username) {
  // Vérifie unicité
  const { data: clash } = await supabase.from("profiles").select("user_id").ilike("username", username).maybeSingle();
  if (clash && clash.user_id !== userId) throw new Error("Ce pseudo est déjà pris.");

  const { error } = await supabase.from("profiles").update({
    username,
    username_last_changed: new Date().toISOString(),
    updated_at:            new Date().toISOString(),
  }).eq("user_id", userId);
  if (error) throw error;
}

/** Synchronise les stats de la librairie + succès dans le profil public */
export async function syncProfileStats(userId, { entriesCount, episodesWatched, achievements }) {
  await supabase.from("profiles").update({
    entries_count:    entriesCount,
    episodes_watched: episodesWatched,
    achievements,
    updated_at:       new Date().toISOString(),
  }).eq("user_id", userId);
}

// ── Recherche ─────────────────────────────────────────────────────────────────

export async function searchUserByUsername(username) {
  const { data } = await supabase.from("profiles")
    .select("user_id, username, avatar_color, description")
    .ilike("username", username.trim())
    .maybeSingle();
  return data;
}

// ── Amitiés ───────────────────────────────────────────────────────────────────

export async function sendFriendRequest(myId, targetId) {
  const { data: existing } = await supabase.from("friendships").select("id, status")
    .or(`and(requester_id.eq.${myId},target_id.eq.${targetId}),and(requester_id.eq.${targetId},target_id.eq.${myId})`)
    .maybeSingle();
  if (existing) throw new Error(existing.status === "accepted" ? "Déjà amis" : "Demande déjà envoyée");
  const { error } = await supabase.from("friendships").insert({ requester_id: myId, target_id: targetId });
  if (error) throw error;
}

export async function acceptFriendRequest(friendshipId) {
  const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", friendshipId);
  if (error) throw error;
}

export async function removeFriend(friendshipId) {
  const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
  if (error) throw error;
}

export async function fetchFriends(myId) {
  const { data: rows } = await supabase.from("friendships")
    .select("id, requester_id, target_id")
    .eq("status", "accepted")
    .or(`requester_id.eq.${myId},target_id.eq.${myId}`);
  if (!rows?.length) return [];

  const ids = rows.map(r => r.requester_id === myId ? r.target_id : r.requester_id);
  const { data: profiles } = await supabase.from("profiles")
    .select("user_id, username, avatar_color, description, entries_count, episodes_watched, achievements")
    .in("user_id", ids);
  return (profiles || []).map(p => ({
    ...p,
    friendshipId: rows.find(r => r.requester_id === p.user_id || r.target_id === p.user_id)?.id,
  }));
}

export async function fetchPendingRequests(myId) {
  const { data: rows } = await supabase.from("friendships")
    .select("id, requester_id")
    .eq("target_id", myId).eq("status", "pending");
  if (!rows?.length) return [];

  const ids = rows.map(r => r.requester_id);
  const { data: profiles } = await supabase.from("profiles")
    .select("user_id, username, avatar_color").in("user_id", ids);
  return (profiles || []).map(p => ({
    ...p,
    friendshipId: rows.find(r => r.requester_id === p.user_id)?.id,
  }));
}