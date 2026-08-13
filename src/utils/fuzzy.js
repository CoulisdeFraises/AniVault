// src/utils/fuzzy.js
// Petite couche de recherche tolérante aux fautes de frappe, appliquée
// par-dessus les résultats bruts d'AniList / TVmaze / TMDB. Ces APIs
// gèrent chacune la tolérance aux fautes différemment (AniList assez bien,
// TVmaze correctement mais coupe vite le nombre de résultats, TMDB assez
// strictement) : on uniformise ça côté client plutôt que de dépendre de
// chacune, avec deux mécanismes complémentaires :
//   1. Un re-classement par similarité au texte tapé (aucun appel réseau
//      supplémentaire) — remonte le bon résultat s'il est présent mais mal
//      classé (ex: AniList trie par popularité, pas par pertinence).
//   2. Une relance élargie si la recherche initiale ne renvoie presque
//      rien — mot en moins / derniers caractères en moins, pour retomber
//      sur le titre malgré une faute en fin de mot.

/** Normalise pour comparaison : minuscules, sans accents, ponctuation → espace. */
export function normalizeForSearch(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Distance de Levenshtein classique (DP). Suffisant pour des titres courts. */
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let cur  = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n];
}

function ratio(a, b) {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/**
 * titleSimilarity — score 0..1 de proximité entre ce que l'utilisateur a
 * tapé et un titre candidat. Combine :
 * - substring : le candidat contient la requête (ou l'inverse) → score fort
 * - ratio global (Levenshtein sur la chaîne entière)
 * - ratio par mot (meilleur appariement mot à mot, tolère un ordre différent
 *   ou un mot manquant/en trop)
 */
export function titleSimilarity(query, candidate) {
  const q = normalizeForSearch(query);
  const c = normalizeForSearch(candidate);
  if (!q || !c) return 0;
  if (c === q) return 1;
  if (c.includes(q) || q.includes(c)) {
    return 0.9 + 0.1 * (Math.min(q.length, c.length) / Math.max(q.length, c.length));
  }

  const whole = ratio(q, c);

  const qWords = q.split(" ").filter(Boolean);
  const cWords = c.split(" ").filter(Boolean);
  let tokenScore = 0;
  if (qWords.length && cWords.length) {
    const best = qWords.map((qw) => Math.max(...cWords.map((cw) => ratio(qw, cw))));
    tokenScore = best.reduce((s, v) => s + v, 0) / best.length;
  }

  return Math.max(whole, tokenScore);
}

/**
 * fuzzyRank — trie une liste de résultats par proximité au texte tapé,
 * en gardant l'ordre d'origine (popularité/pertinence API) comme
 * départage entre scores très proches. Filtre le bruit trop éloigné.
 */
export function fuzzyRank(items, query, getTitle, { minScore = 0.32, limit = 24 } = {}) {
  return items
    .map((item, index) => ({ item, index, score: titleSimilarity(query, getTitle(item)) }))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => (b.score - a.score) || (a.index - b.index))
    .slice(0, limit)
    .map((r) => r.item);
}

/**
 * buildFallbackQueries — variantes élargies d'une requête, utilisées
 * uniquement quand la recherche initiale renvoie peu/pas de résultats
 * (ex: faute en fin de mot que l'API n'a pas su tolérer).
 */
export function buildFallbackQueries(query) {
  const trimmed = query.trim();
  const out = new Set();

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > 1) out.add(words.slice(0, -1).join(" ")); // sans le dernier mot

  if (trimmed.length > 5) {
    out.add(trimmed.slice(0, -1)); // sans le dernier caractère
    out.add(trimmed.slice(0, -2)); // sans les deux derniers
  }

  out.delete(trimmed);
  return [...out].filter((q) => q.length >= 2).slice(0, 2);
}

/** Fusionne deux listes de résultats en dédupliquant par id (garde le 1er vu). */
export function mergeById(a, b) {
  const seen = new Set(a.map((r) => r.id));
  return [...a, ...b.filter((r) => !seen.has(r.id))];
}
