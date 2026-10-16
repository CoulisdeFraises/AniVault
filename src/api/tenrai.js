// ── Tenrai : successeur de Jikan (API MyAnimeList, schéma Jikan v4) ─────────
//
// Remplace api.jikan.moe. Même schéma de réponse : seule l'URL de base change.
// CORS ouvert, sans clé. Limites publiques : 4 requêtes/s et 120/min par IP —
// tout passe donc par une file qui espace les appels (voir tenraiFetch).
// Doc : https://api.tenrai.org/documentation

export const TENRAI_BASE = "https://api.tenrai.org/v1";

const MIN_GAP_MS = 350; // ≈ 2,8 req/s : sous la limite de 4/s, avec de la marge
let _chain = Promise.resolve();

/**
 * Fetch vers Tenrai, sérialisé et espacé. Renvoie la Response brute (comme
 * fetch) pour que les appelants gèrent eux-mêmes `ok` / 404 / 429.
 */
export function tenraiFetch(path, params) {
  const qs = params
    ? "?" + Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== false)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v === true ? "" : v)}`)
        .join("&")
    : "";
  const url = `${TENRAI_BASE}${path}${qs}`;
  const request = _chain.then(async () => {
    const res = await fetch(url);
    await new Promise((r) => setTimeout(r, MIN_GAP_MS));
    return res;
  });
  _chain = request.then(() => {}).catch(() => {});
  return request;
}

/** GET JSON avec un unique nouvel essai sur 429 (respecte Retry-After). Lève une erreur sinon. */
export async function tenraiGet(path, params) {
  let res = await tenraiFetch(path, params);
  if (res.status === 429) {
    const wait = Math.min(10, Number(res.headers.get("Retry-After")) || 2);
    await new Promise((r) => setTimeout(r, wait * 1000));
    res = await tenraiFetch(path, params);
  }
  if (!res.ok) throw new Error(`Tenrai a répondu avec une erreur (${res.status}).`);
  return res.json();
}
