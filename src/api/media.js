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

const MEDIA_FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/media`;

// Déduplication des requêtes en vol : si Card.jsx, Details.jsx et les Favoris
// demandent la même fiche au même moment, une seule requête réseau part ;
// tout le monde reçoit la même promesse (succès ou échec).
const inFlight = new Map();

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
