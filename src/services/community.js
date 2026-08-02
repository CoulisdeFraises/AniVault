import { supabase } from "../lib/supabase";

// ── Profil ────────────────────────────────────────────────────────────────────

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
    user_id:      user.id,
    username,
    avatar_color: user.user_metadata?.avatar_color || "#7c3aed",
  });
}

export async function fetchMyProfile(userId) {
  const { data } = await supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  return data;
}

export async function updateProfileMeta(userId, { description, avatar_color, avatar_url, companion }) {
  const updates = { updated_at: new Date().toISOString() };
  if (description  !== undefined) updates.description  = description;
  if (avatar_color !== undefined) updates.avatar_color = avatar_color;
  if (avatar_url   !== undefined) updates.avatar_url   = avatar_url;
  if (companion    !== undefined) updates.companion    = companion;
  const { error } = await supabase.from("profiles").update(updates).eq("user_id", userId);
  if (error) throw error;
}

/**
 * Upload une photo de profil dans le bucket "avatars" (dossier = user_id,
 * conformément aux policies RLS) et retourne l'URL publique.
 */
export async function uploadAvatarPhoto(userId, file) {
  const ext  = file.name.split(".").pop() || "jpg";
  const path = `${userId}/avatar.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  // Casse le cache navigateur/CDN après un remplacement de photo.
  const bustedUrl = `${data.publicUrl}?v=${Date.now()}`;
  await updateProfileMeta(userId, { avatar_url: bustedUrl });
  return bustedUrl;
}

export async function removeAvatarPhoto(userId) {
  await updateProfileMeta(userId, { avatar_url: null });
}

export async function changeUsername(userId, username) {
  const { data: clash } = await supabase.from("profiles").select("user_id").ilike("username", username).maybeSingle();
  if (clash && clash.user_id !== userId) throw new Error("Ce pseudo est déjà pris.");

  const { error } = await supabase.from("profiles").update({
    username,
    username_last_changed: new Date().toISOString(),
    updated_at:            new Date().toISOString(),
  }).eq("user_id", userId);
  if (error) throw error;
}

export async function syncProfileStats(userId, { entriesCount, episodesWatched, achievements }) {
  await supabase.from("profiles").update({
    entries_count:    entriesCount,
    episodes_watched: episodesWatched,
    achievements,
    updated_at:       new Date().toISOString(),
  }).eq("user_id", userId);
}

// ── Recherche ─────────────────────────────────────────────────────────────────

/** Recherche par pseudo (exact, insensible à la casse) */
export async function searchUserByUsername(username) {
  const { data } = await supabase.from("profiles")
    .select("user_id, username, avatar_color, description")
    .ilike("username", username.trim())
    .maybeSingle();
  return data;
}

/**
 * Recherche par identifiant OU pseudo.
 * Si l'entrée ressemble à un UUID → cherche d'abord par user_id (ID unique).
 * Sinon → cherche par pseudo.
 * Utilisé pour l'ajout d'amis afin d'éviter les confusions entre homonymes.
 */
export async function searchUserByIdentifier(identifier) {
  const trimmed = identifier.trim();
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (uuidPattern.test(trimmed)) {
    const { data } = await supabase.from("profiles")
      .select("user_id, username, avatar_color, description")
      .eq("user_id", trimmed)
      .maybeSingle();
    if (data) return data;
  }

  // Fallback : recherche par pseudo
  const { data } = await supabase.from("profiles")
    .select("user_id, username, avatar_color, description")
    .ilike("username", trimmed)
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
    .select("user_id, username, avatar_color, description")
    .in("user_id", ids);
  return (profiles || []).map(p => ({
    ...p,
    friendshipId: rows.find(r => r.requester_id === p.user_id)?.id,
  }));
}

export async function fetchFriendFavorites(userId) {
  const { data } = await supabase
    .from("libraries")
    .select("lists")
    .eq("user_id", userId)
    .maybeSingle();
  const lists   = Array.isArray(data?.lists) ? data.lists : [];
  const favList = lists.find(l => l.isFavorites);
  return Array.isArray(favList?.entries) ? favList.entries : [];
}