import { supabase } from "../lib/supabase";

// ── Annonces / messages au démarrage ────────────────────────────────────────
//
// Table Supabase `announcements` : une ligne = un message à faire passer.
// On affiche toujours la ligne la plus récente ; la popup ne se réaffiche
// que quand un NOUVEL id apparaît. Le suivi "déjà vu" est stocké par
// compte, dans profiles.seen_announcement_id (cf. AnnouncementLayer côté
// App.jsx) — donc valable sur tous les appareils de l'utilisateur.
//
// Pour publier un message : ajouter une ligne dans la table `announcements`
// depuis le Table Editor de Supabase (colonne `message`, le reste se
// remplit tout seul). C'est tout — pas besoin de toucher au code.

export async function fetchLatestAnnouncement() {
  const { data, error } = await supabase
    .from("announcements")
    .select("id, message, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function fetchSeenAnnouncementId(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("seen_announcement_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return data?.seen_announcement_id ?? null;
}

export async function markAnnouncementSeen(userId, announcementId) {
  await supabase
    .from("profiles")
    .update({ seen_announcement_id: announcementId })
    .eq("user_id", userId);
}
