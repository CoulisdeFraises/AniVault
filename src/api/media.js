// Proxy + cache partagé pour les fiches média (AniList / TMDB / Jikan).
// Tourne sur une fonction Edge Supabase (Deno Deploy) — voir supabase/functions/media.
//
// Route : /functions/v1/media?source=<anilist|tmdb|jikan>&id=<id>[&force=1]
//
// IMPORTANT : contrairement à une version précédente, cette fonction NE
// AVALE PAS les erreurs — elle les laisse remonter (throw). C'est nécessaire
// car des appelants comme la construction de chaîne de saisons (anilist.js)
// doivent savoir distinguer "vraiment introuvable" (peut être ignoré) d'un
// échec réseau/429 (doit interrompre l'opération plutôt que la tronquer en
// silence). Les appelants qui veulent un simple null-si-échec font leur
// propre try/catch, comme le reste de l'app le fait déjà.

const MEDIA_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smooth-task`;

// Déduplication des requêtes en vol : si Card.jsx, Details.jsx et les Favoris
// demandent la même fiche au même moment, une seule requête réseau part ;
// tout le monde reçoit la même promesse (succès ou échec).
const inFlight = new Map();

// ── Prochaine diffusion, GROUPÉE ────────────────────────────────────────────
// Avant : un appel à la fonction Edge PAR TITRE (≈100 à chaque ouverture de l'app), chacun
// renvoyant la fiche complète (~16 Ko) pour n'en lire que `nextAiringEpisode`. Ici les demandes
// arrivées à quelques centaines de ms d'intervalle partent dans UNE requête (?mode=airing&ids=…).
// Si la fonction Edge n'a pas encore le mode « airing », la requête échoue et l'appelant
// (fetchNextAiringAniList) retombe sur la lecture unitaire : rien ne casse pendant le déploiement.
const AIRING_WINDOW_MS       = 300;  // attente pour regrouper (les cartes s'étalent sur ~800 ms)
const AIRING_WINDOW_FORCE_MS = 50;   // relecture forcée (juste après une diffusion) : on n'attend presque pas
const AIRING_MAX_BATCH       = 40;

function makeAiringQueue(force) {
  let pending = new Map(); // id -> { promise, resolve, reject }
  let timer = null;

  async function flush() {
    timer = null;
    const batch = pending; pending = new Map();
    const ids = [...batch.keys()];
    try {
      const qs = new URLSearchParams({ mode: "airing", ids: ids.join(",") });
      if (force) qs.set("force", "1");
      const res = await fetch(`${MEDIA_FN_URL}?${qs.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { next } = await res.json();
      for (const id of ids) {
        const h = batch.get(id);
        if (next && Object.prototype.hasOwnProperty.call(next, String(id))) h.resolve(next[String(id)]);
        else h.reject(new Error("airing: id absent de la réponse"));
      }
    } catch (e) {
      for (const h of batch.values()) h.reject(e);
    }
  }

  return function enqueue(id) {
    const key = Number(id);
    const hit = pending.get(key);
    if (hit) return hit.promise;
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    pending.set(key, { promise, resolve, reject });
    if (pending.size >= AIRING_MAX_BATCH) { clearTimeout(timer); flush(); }
    else if (!timer) timer = setTimeout(flush, force ? AIRING_WINDOW_FORCE_MS : AIRING_WINDOW_MS);
    return promise;
  };
}

const airingQueues = { normal: makeAiringQueue(false), force: makeAiringQueue(true) };

/** Prochaine diffusion AniList { episode, airingAt (secondes) } ou null. Lève une erreur si indisponible. */
export function getNextAiringBatched(anilistId, { force = false } = {}) {
  return (force ? airingQueues.force : airingQueues.normal)(anilistId);
}

export async function getMediaDetails(source, id, { force = false } = {}) {
  const key = `${source}:${id}:${force ? "force" : "cached"}`;

  if (inFlight.has(key)) return inFlight.get(key);

  const promise = (async () => {
    const qs = new URLSearchParams({ source, id: String(id) });
    if (force) qs.set("force", "1");

    let response;
    try {
      response = await fetch(`${MEDIA_FN_URL}?${qs.toString()}`);
    } catch {
      throw new Error("Impossible de joindre le service AniVault. Vérifie ta connexion.");
    }

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || `Erreur HTTP: ${response.status}`);
    }

    return await response.json();
  })();

  inFlight.set(key, promise);
  // Que la requête réussisse ou échoue, on libère la clé une fois terminée —
  // seuls les appels VRAIMENT simultanés partagent la même promesse.
  promise.finally(() => inFlight.delete(key));

  return promise;
}
