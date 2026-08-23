// Normalise un titre pour la détection de doublons "flexibles" : on retire
// les suffixes de saison/partie (Season 2, Saison 2, Part 2, Cour 2, 2nd
// Season, S2…) et les chiffres finaux isolés, afin que « Blue Box » et
// « Blue Box Season 2 » soient reconnus comme la même œuvre.
//
// S'appuie sur normalizeForSearch (accents, casse, ponctuation → espace) en
// base, pour que les variantes purement typographiques d'un même titre
// alternatif (« Spy x Family » / « SPY×FAMILY », « Fruits Basket: The
// Final » / « Fruits Basket - The Final », accents…) matchent aussi —
// avant, seule la casse était normalisée, donc ces variantes passaient à
// travers la détection de doublons.
import { normalizeForSearch } from "./fuzzy";

// stripBareNumber désactivable pour les films : un numéro final y désigne un
// épisode distinct de la franchise (Toy Story 4 ≠ Toy Story 5), alors que
// pour une série/anime c'est souvent une saison numérotée sans mot-clé
// (Attack on Titan 2 = Attack on Titan Season 2). Sans cette distinction,
// « Toy Story 5 » était normalisé en « Toy Story » et confondu avec les
// films 1 à 4 déjà en bibliothèque.
export function normalizeSeriesTitle(title, stripBareNumber = true) {
  const base = normalizeForSearch(title)
    .replace(/\s*(season|saison|part|cour)\s*\d+/gi, "")
    .replace(/\s+\d+(st|nd|rd|th)\s+season/gi, "")
    .replace(/\s+s\d+$/i, "");
  return (stripBareNumber ? base.replace(/\s+\d+$/, "") : base).trim();
}
