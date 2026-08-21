// ── Cache localStorage avec TTL et fallback hors-ligne ──────────────────────
//
//  TTL recommandés :
//    Recommandations  → 7j   — volontairement long : les recos affichées
//                              doivent rester identiques après un refresh de
//                              page ou une réouverture de l'app. Elles ne
//                              changent que via une action explicite
//                              (pull-to-refresh, "Surprends-moi", ou goûts
//                              modifiés → clé de cache différente).
//    Calendrier       → 30min (30 * 60 * 1000)

const PREFIX = "av_cache_";

// ── Repli mémoire (process JS) ──────────────────────────────────────────────
// Filet de sécurité en plus de localStorage : sur certains navigateurs/
// configurations (mode privé, restrictions de stockage tierces, quota...),
// l'écriture dans localStorage peut échouer silencieusement (le try/catch
// ci-dessous l'avale), donnant l'impression que le cache "ne retient rien" —
// symptôme : on retrouve d'anciennes recos après avoir quitté la page puis
// être revenu dessus. `memCache` vit tant que l'app JS tourne (navigation
// interne, changement de page) : même si localStorage est indisponible, la
// donnée reste donc valable pour la session en cours.
const memCache = new Map();

/**
 * Lire une entrée du cache.
 * Retourne null si absente ou expirée.
 */
export function getCached(key) {
  const mem = memCache.get(key);
  if (mem) return Date.now() > mem.expiresAt ? null : mem.data;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { data, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) return null; // expiré
    memCache.set(key, { data, expiresAt }); // resynchronise le repli mémoire
    return data;
  } catch {
    return null;
  }
}

/**
 * Lire une entrée du cache même si expirée (fallback hors-ligne).
 * Retourne null si absente.
 */
export function getStaleCached(key) {
  const mem = memCache.get(key);
  if (mem) return mem.data;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { data, expiresAt } = JSON.parse(raw);
    memCache.set(key, { data, expiresAt });
    return data ?? null;
  } catch {
    return null;
  }
}

/**
 * Écrire dans le cache avec un TTL en millisecondes.
 */
export function setCached(key, data, ttlMs) {
  const expiresAt = Date.now() + ttlMs;
  memCache.set(key, { data, expiresAt }); // toujours écrit, même si localStorage échoue plus bas
  try {
    localStorage.setItem(
      PREFIX + key,
      JSON.stringify({ data, expiresAt, cachedAt: Date.now() })
    );
  } catch {
    // localStorage plein — on purge les vieilles entrées et on réessaie
    try {
      purgeStaleCaches();
      localStorage.setItem(
        PREFIX + key,
        JSON.stringify({ data, expiresAt, cachedAt: Date.now() })
      );
    } catch { /* le repli mémoire ci-dessus reste actif malgré tout */ }
  }
}

/**
 * Supprimer une entrée du cache.
 */
export function removeCached(key) {
  memCache.delete(key);
  try { localStorage.removeItem(PREFIX + key); } catch { /* */ }
}

/**
 * Purger toutes les entrées expirées du cache AniVault.
 */
export function purgeStaleCaches() {
  try {
    const now = Date.now();
    Object.keys(localStorage)
      .filter(k => k.startsWith(PREFIX))
      .forEach(k => {
        try {
          const { expiresAt } = JSON.parse(localStorage.getItem(k) || "{}");
          if (expiresAt && now > expiresAt) localStorage.removeItem(k);
        } catch { localStorage.removeItem(k); }
      });
  } catch { /* */ }
}

// TTL constants
export const TTL = {
  RECOMMENDATIONS: 7  * 24 * 60 * 60 * 1000, //  7 jours — persistance entre sessions
  CALENDAR:        30 * 60 * 1000,       // 30 minutes
  TMDB_TITLES:     24 * 60 * 60 * 1000,  // 24 heures
  SERIES_CALENDAR: 3  * 60 * 60 * 1000,  //  3 heures — planning TV, change peu dans la journée
  FILMS_CALENDAR:  6  * 60 * 60 * 1000,  //  6 heures — sorties cinéma, quasi statique
};