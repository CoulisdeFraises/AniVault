// ── Cache persistant IndexedDB (gros volumes) ───────────────────────────────
// localStorage plafonne à ~5 Mo, partagés avec la bibliothèque et les autres
// caches : trop juste pour le bassin Waifinity (~3000 personnages) ou les fiches
// média. IndexedDB n'a pas ce problème. Toutes les fonctions sont tolérantes :
// si IndexedDB est indisponible (mode privé…), elles renvoient null / ne font
// rien, et l'appelant retombe sur le réseau.

const DB_NAME = "anivault-cache";
const STORE   = "kv";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    } catch (e) { reject(e); }
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

/** Lit { value, savedAt } ou null. Ne vérifie aucun TTL : c'est à l'appelant. */
export async function idbGet(key) {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => resolve(null);
    });
  } catch { return null; }
}

export async function idbSet(key, value) {
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put({ value, savedAt: Date.now() }, key);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => resolve();
    });
  } catch { /* best effort */ }
}

export async function idbDelete(key) {
  try {
    const db = await openDb();
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => resolve();
    });
  } catch { /* best effort */ }
}
