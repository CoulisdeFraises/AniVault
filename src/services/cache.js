/**
 * Cache deux niveaux :
 *   1. localStorage — persiste entre les sessions (survit au rechargement).
 *   2. Map en mémoire  — fallback si localStorage est plein ou indisponible.
 *
 * Les résultats d'épisodes Jikan et AniList sont ainsi réutilisés sans
 * refetcher à chaque ouverture de la page Détails.
 */

const MEM  = new Map();
const LS_PREFIX = "anivault_cache_";

function lsKey(key) { return LS_PREFIX + key; }

export function cacheGet(key, ttlMs) {
  // 1. localStorage
  try {
    const raw = localStorage.getItem(lsKey(key));
    if (raw) {
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts <= ttlMs) return data;
      localStorage.removeItem(lsKey(key));
    }
  } catch {}

  // 2. Mémoire (fallback)
  const hit = MEM.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.ts > ttlMs) { MEM.delete(key); return undefined; }
  return hit.data;
}

export function cacheSet(key, data) {
  try {
    localStorage.setItem(lsKey(key), JSON.stringify({ data, ts: Date.now() }));
    return;
  } catch {}
  // Si localStorage est plein → mémoire
  MEM.set(key, { data, ts: Date.now() });
}

/** Vide toutes les entrées de cache AniVault dans localStorage */
export function cacheClear() {
  Object.keys(localStorage)
    .filter(k => k.startsWith(LS_PREFIX))
    .forEach(k => localStorage.removeItem(k));
  MEM.clear();
}

/**
 * withCache — exécute `fetcher` et met le résultat en cache.
 *
 * @param {string}    key          Clé unique
 * @param {number}    ttlMs        TTL en millisecondes
 * @param {Function}  fetcher      Fonction async retournant la donnée
 * @param {Function}  [shouldCache] Prédicat : si false, le résultat n'est pas
 *                                 mis en cache (le prochain appel retentera).
 *                                 Ex : (d) => d.episodes.length > 0 || d.totalEpisodes != null
 */
export async function withCache(key, ttlMs, fetcher, shouldCache) {
  const cached = cacheGet(key, ttlMs);
  if (cached !== undefined) return cached;
  const data = await fetcher();
  if (!shouldCache || shouldCache(data)) cacheSet(key, data);
  return data;
}
