import { supabase } from "../lib/supabase";
import { fetchWaifinityItems } from "./waifinitySocial";

// ── Vitrine Waifinity + fragments / cosmétiques (table waifinity_profiles) ───
//
// Une ligne par joueur — voir supabase/waifinity_showcase.sql pour le schéma
// et la RLS. Tout est « best effort » : si la table n'existe pas encore ou si
// le réseau est coupé, le jeu continue en local (les fonctions renvoient
// null/false et l'erreur est seulement journalisée).

const TABLE = "waifinity_profiles";
const COLUMNS = "favorites, fragments, cosmetics, showcase_visible, updated_at";

/** Ma ligne, ou null (inexistante / erreur). */
export async function fetchMyShowcase(userId) {
  if (!userId) return null;
  const { data, error } = await supabase.from(TABLE).select(COLUMNS).eq("user_id", userId).maybeSingle();
  if (error) { console.error("Waifinity vitrine (lecture) :", error.message); return null; }
  return data || null;
}

/**
 * Pousse favoris, fragments et cosmétiques. N'envoie JAMAIS showcase_visible :
 * il n'est modifié que par setShowcaseVisible (Réglages), pour qu'une copie
 * locale périmée ne l'écrase pas.
 */
export async function pushShowcase(userId, { favorites, fragments, cosmetics }) {
  if (!userId) return false;
  const { error } = await supabase.from(TABLE).upsert({
    user_id: userId,
    favorites: favorites || [],
    fragments: Math.max(0, Math.floor(fragments || 0)),
    cosmetics: cosmetics || { owned: [], equipped: {} },
    updated_at: new Date().toISOString(),
  });
  if (error) { console.error("Waifinity vitrine (écriture) :", error.message); return false; }
  return true;
}

/** Réglage « ma vitrine est visible par les autres joueurs » (Réglages). */
export async function setShowcaseVisible(userId, visible) {
  if (!userId) return false;
  const { error } = await supabase.from(TABLE).upsert({ user_id: userId, showcase_visible: !!visible });
  if (error) { console.error("Waifinity vitrine (visibilité) :", error.message); return false; }
  return true;
}

/**
 * Vitrine d'un joueur : { items, equipped } où `items` sont ses personnages
 * favoris (dans l'ordre choisi, avec image/nom/rareté tirés du miroir public
 * de sa collection) et `equipped` ses cosmétiques par personnage.
 * Renvoie null si le joueur n'a pas de vitrine ou l'a masquée (la RLS ne
 * renvoie alors aucune ligne).
 */
export async function fetchShowcase(userId) {
  if (!userId) return null;
  const { data: row, error } = await supabase.from(TABLE).select(COLUMNS).eq("user_id", userId).maybeSingle();
  if (error) { console.error("Waifinity vitrine (lecture) :", error.message); return null; }
  if (!row) return null;

  const ids = Array.isArray(row.favorites) ? row.favorites : [];
  if (!ids.length) return { items: [], equipped: {} };

  const rows = await fetchWaifinityItems(userId);
  const byId = new Map(rows.map((r) => [r.character_id, r]));
  const items = ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((r) => ({ id: r.character_id, name: r.name, image: r.image, series: r.series, tier: r.tier, gender: r.gender ?? null }));
  return { items, equipped: row.cosmetics?.equipped || {} };
}
