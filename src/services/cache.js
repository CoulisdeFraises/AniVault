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

export async function withCache(key, ttlMs, fetcher) {
  const cached = cacheGet(key, ttlMs);
  if (cached !== undefined) return cached;
  const data = await fetcher();
  cacheSet(key, data);
  return data;
}