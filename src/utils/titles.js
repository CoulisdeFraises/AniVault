// Normalise un titre pour la détection de doublons "flexibles" : on retire
// les suffixes de saison/partie (Season 2, Saison 2, Part 2, Cour 2, 2nd
// Season, S2…) et les chiffres finaux isolés, afin que « Blue Box » et
// « Blue Box Season 2 » soient reconnus comme la même œuvre.
export function normalizeSeriesTitle(title) {
  return (title || "")
    .replace(/\s*:?\s*(season|saison|part|cour)\s*\d+/gi, "")
    .replace(/\s+\d+(st|nd|rd|th)\s+season/gi, "")
    .replace(/\s+s\d+$/i, "")
    .replace(/\s+\d+$/, "")
    .trim()
    .toLowerCase();
}
