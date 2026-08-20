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

/**
 * Lire une entrée du cache.
 * Retourne null si absente ou expirée.
 */
export function getCached(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { data, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) return null; // expiré
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
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const { data } = JSON.parse(raw);
    return data ?? null;
  } catch {
    return null;
  }
}

/**
 * Écrire dans le cache avec un TTL en millisecondes.
 */
export function setCached(key, data, ttlMs) {
  try {
    localStorage.setItem(
      PREFIX + key,
      JSON.stringify({ data, expiresAt: Date.now() + ttlMs, cachedAt: Date.now() })
    );
  } catch {
    // localStorage plein — on purge les vieilles entrées et on réessaie
    try {
      purgeStaleCaches();
      localStorage.setItem(
        PREFIX + key,
        JSON.stringify({ data, expiresAt: Date.now() + ttlMs, cachedAt: Date.now() })
      );
    } catch { /* abandon silencieux */ }
  }
}

/**
 * Supprimer une entrée du cache.
 */
export function removeCached(key) {
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