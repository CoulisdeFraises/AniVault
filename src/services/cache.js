const store = new Map();

export function cacheGet(key, ttlMs) {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.ts > ttlMs) {
    store.delete(key);
    return undefined;
  }
  return hit.data;
}

export function cacheSet(key, data) {
  store.set(key, { data, ts: Date.now() });
}

/**
 * withCache — exécute `fetcher` et met le résultat en cache.
 *
 * @param {string}   key        Clé de cache
 * @param {number}   ttlMs      Durée de vie en ms
 * @param {Function} fetcher    Fonction async qui retourne la donnée
 * @param {Function} [shouldCache]  Prédicat optionnel : si fourni et retourne
 *                              false, le résultat n'est PAS mis en cache
 *                              (le prochain appel retentera le fetcher).
 *                              Ex : (data) => data.episodes.length > 0 || data.totalEpisodes != null
 */
export async function withCache(key, ttlMs, fetcher, shouldCache) {
  const cached = cacheGet(key, ttlMs);
  if (cached !== undefined) return cached;
  const data = await fetcher();
  if (!shouldCache || shouldCache(data)) {
    cacheSet(key, data);
  }
  return data;
}
