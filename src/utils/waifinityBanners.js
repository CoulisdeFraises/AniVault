import { RARITY_ORDER, normalizeTier } from "./waifinity";
import { seasonLabel } from "../api/waifuBanner";

// ── Bannière saisonnière ────────────────────────────────────────────────────
//
// Un booster « de saison » coûte un peu plus qu'un booster normal. Les
// raretés sont tirées exactement comme d'habitude (mêmes chances) ; ce qui
// change, c'est que chaque carte a BANNER_RATE chances d'être choisie parmi
// les personnages de la saison (de la rareté tirée) plutôt que dans tout le
// bassin. Aucun palier n'est donc avantagé : on ne fait que concentrer le
// tirage sur les séries du moment.

export const BANNER_COST = 350;
export const BANNER_RATE = 0.35;
// En dessous, la bannière n'a pas assez de matière pour être intéressante.
export const BANNER_MIN_FEATURED = 6;

const RANK = Object.fromEntries(RARITY_ORDER.map((t, i) => [t, i]));

/**
 * Construit la bannière du moment à partir du bassin et des ids MAL des
 * animes de la saison. Renvoie null s'il y a trop peu de personnages.
 * `featured` : personnages mis en avant, du plus rare au plus courant.
 */
export function buildSeasonBanner(pool, malIds, seasonInfo) {
  if (!pool?.length || !malIds?.length) return null;
  const ids = new Set(malIds);
  const featured = pool
    .filter((c) => c.seriesId != null && ids.has(c.seriesId))
    .sort((a, b) => RANK[normalizeTier(b.tier)] - RANK[normalizeTier(a.tier)] || b.favourites - a.favourites);
  if (featured.length < BANNER_MIN_FEATURED) return null;
  return {
    id: `season-${seasonInfo.year}-${seasonInfo.season}`,
    label: seasonLabel(seasonInfo),
    rate: BANNER_RATE,
    cost: BANNER_COST,
    featured,
    featuredIds: new Set(featured.map((c) => c.id)),
    seriesCount: new Set(featured.map((c) => c.seriesId)).size,
  };
}
