import { RARITY_ORDER, normalizeTier } from "./waifinity";
import { seasonLabel } from "../api/waifuBanner";
import { normalizeForSearch } from "./fuzzy";

// ── Bannière saisonnière ────────────────────────────────────────────────────
//
// Un booster « de saison » coûte un peu plus qu'un booster normal. Les
// raretés sont tirées exactement comme d'habitude (mêmes chances) ; ce qui
// change, c'est que chaque carte a BANNER_RATE chances d'être choisie parmi
// les personnages de la saison (de la rareté tirée) plutôt que dans tout le
// bassin. Aucun palier n'est donc avantagé : on ne fait que concentrer le
// tirage sur les séries du moment.
//
// Un personnage est « à l'honneur » si sa série correspond à un anime à
// l'affiche, par l'une de ces deux voies :
//   1. id MAL : l'anime lui-même, ou un anime lié (préquelle, suite…) ;
//   2. nom : titre de la série comparé aux titres/synonymes des animes à
//      l'affiche, sans les mentions de saison (« 2nd Season », « Part 2 »…).
//      Rattrape les animes sans idMal et les suites rattachées à une autre
//      entrée MAL que celle de la saison 1.

export const BANNER_COST = 350;
export const BANNER_RATE = 0.35;
// En dessous, la bannière n'a pas assez de matière pour être intéressante.
export const BANNER_MIN_FEATURED = 6;

const RANK = Object.fromEntries(RARITY_ORDER.map((t, i) => [t, i]));

// Un nom plus court que ça n'est jamais utilisé en correspondance « préfixe ».
const MIN_PREFIX_LEN = 9;
// ... ni en correspondance exacte (évite « one », « ai »…).
const MIN_KEY_LEN = 4;

const ROMAN = "(?:ii|iii|iv|v|vi|vii|viii)";
const SEASON_NOISE = [
  /\b(?:\d+(?:st|nd|rd|th)|first|second|third|fourth|fifth|final|last)\s+(?:season|cour)\b/g,
  /\b(?:season|saison|cour|part|partie|arc)\s+\d+\b/g,
  /\b\d+(?:e|eme|eme)\s+saison\b/g,
  /\bs\d{1,2}\b/g,
  new RegExp(`\\s${ROMAN}$`),
  /\b(?:the\s+)?final\s+(?:season|chapters?)\b/g,
];

/** Titre → clé de comparaison : normalisé, sans mention de saison/partie. */
export function seriesKey(title) {
  let k = normalizeForSearch(title);
  if (!k) return "";
  for (const re of SEASON_NOISE) k = k.replace(re, " ");
  return k.replace(/\s+/g, " ").trim();
}

/** Clés d'un titre : titre complet, plus la partie avant « : » / « - » (sous-titre ôté). */
function keysOf(title) {
  const out = new Set();
  const full = seriesKey(title);
  if (full.length >= MIN_KEY_LEN) out.add(full);
  const head = typeof title === "string" ? title.split(/\s*[:\-–—]\s+/)[0] : "";
  if (head && head !== title) {
    const k = seriesKey(head);
    // La tête seule est plus risquée : on exige un nom d'au moins 6 caractères (« bleach », « naruto »…).
    if (k.length >= 6) out.add(k);
  }
  return out;
}

/** Deux clés désignent-elles la même franchise ? (égalité, ou l'une préfixe l'autre au mot près) */
function keysMatch(a, b) {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= MIN_PREFIX_LEN && long.startsWith(short + " ");
}

/**
 * Construit la bannière du moment à partir du bassin et des animes à l'affiche
 * ([{ malId, titles, related }], voir api/waifuBanner.js). Renvoie null s'il y
 * a trop peu de personnages. `featured` : personnages mis en avant, du plus
 * rare au plus courant.
 */
export function buildSeasonBanner(pool, seasonAnime, seasonInfo) {
  if (!pool?.length || !seasonAnime?.length) return null;

  // 1. ids MAL : animes à l'affiche + animes liés.
  const ids = new Set();
  const seasonKeys = new Set();
  for (const a of seasonAnime) {
    if (a.malId != null) ids.add(a.malId);
    (a.related || []).forEach((id) => ids.add(id));
    (a.titles || []).forEach((t) => keysOf(t).forEach((k) => seasonKeys.add(k)));
  }
  const seasonKeyList = [...seasonKeys];

  // 2. noms : une décision par série (pas par personnage), mise en cache le temps du calcul.
  const verdict = new Map();
  const nameMatches = (series) => {
    if (!series || series === "Série inconnue") return false;
    if (verdict.has(series)) return verdict.get(series);
    let hit = false;
    for (const k of keysOf(series)) {
      if (seasonKeys.has(k) || seasonKeyList.some((s) => keysMatch(k, s))) { hit = true; break; }
    }
    verdict.set(series, hit);
    return hit;
  };

  const featured = pool
    .filter((c) => (c.seriesId != null && ids.has(c.seriesId)) || nameMatches(c.series))
    .sort((a, b) => RANK[normalizeTier(b.tier)] - RANK[normalizeTier(a.tier)] || b.favourites - a.favourites);
  if (featured.length < BANNER_MIN_FEATURED) return null;
  return {
    id: `season-${seasonInfo.year}-${seasonInfo.season}`,
    label: seasonLabel(seasonInfo),
    rate: BANNER_RATE,
    cost: BANNER_COST,
    featured,
    featuredIds: new Set(featured.map((c) => c.id)),
    seriesCount: new Set(featured.map((c) => c.seriesId ?? c.series)).size,
  };
}
