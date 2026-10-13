import { supabase } from "../lib/supabase";
import { fetchFriends } from "./community";

export async function saveAniDleBest(userId, bestScore) {
  if (!userId) return;
  const { error } = await supabase.from("anidle_scores").upsert({
    user_id: userId, best_score: bestScore, updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function fetchAniDleLeaderboard(userId) {
  const friends = await fetchFriends(userId);
  const profiles = [{ user_id: userId, username: "Vous" }, ...friends];
  const ids = [...new Set(profiles.map((p) => p.user_id))];
  const { data, error } = await supabase.from("anidle_scores")
    .select("user_id,best_score,updated_at").in("user_id", ids);
  if (error) throw error;
  const scores = new Map((data || []).map((row) => [row.user_id, row]));
  return profiles.map((p) => ({
    user_id: p.user_id,
    username: p.user_id === userId ? (p.username === "Vous" ? "Vous" : p.username) : p.username,
    avatar_color: p.avatar_color,
    avatar_url: p.avatar_url,
    best_score: Number(scores.get(p.user_id)?.best_score || 0),
    updated_at: scores.get(p.user_id)?.updated_at || null,
  })).sort((a, b) => b.best_score - a.best_score || a.username.localeCompare(b.username, "fr"));
}
