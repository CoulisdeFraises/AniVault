// ─────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────
// AniVault — Service Worker
//
// Objectif : app pleinement utilisable hors ligne pour tout ce qui a déjà
// été consulté au moins une fois en ligne (bibliothèque, fiches détails,
// affiches, recherches récentes...).
//
// La bibliothèque elle-même (entrées, progression) vit déjà dans
// localStorage (services/storage.js) — elle est donc hors ligne "gratuitement".
// Ce Service Worker s'occupe de tout le reste : le shell de l'app (JS/CSS),
// les affiches/images distantes, et les réponses JSON des API publiques
// consultées en cours de navigation.
//
// Stratégies utilisées (classiques, façon Workbox, réécrites à la main pour
// ne pas ajouter de dépendance de build) :
//   • Navigation (changement de page / F5 sur une route SPA)
//       → network-first, repli sur le shell mis en cache (index.html)
//   • Fichiers buildés hashés (/assets/*.js, *.css)
//       → cache-first (le hash garantit l'immutabilité du contenu)
//   • Images (affiches AniList / TMDB / TVmaze, logos...)
//       → cache-first avec purge des entrées les plus anciennes
//   • Endpoints API publics et sans donnée utilisateur (fiche média,
//     TMDB, TVmaze) → stale-while-revalidate : réponse immédiate depuis le
//     cache si dispo, requête réseau en tâche de fond pour la fois suivante
//   • Reste du même-origine (icônes, manifest...) → network-first classique
//   • Tout le reste (Supabase auth/rest, GraphQL AniList en POST...) → non
//     intercepté, comportement natif du navigateur (on ne veut surtout pas
//     mettre en cache des réponses liées à une session utilisateur)
// ─────────────────────────────────────────────────────────────────────────

const SW_VERSION = "v7";

const STATIC_CACHE = `anivault-static-${SW_VERSION}`;
const ASSETS_CACHE = `anivault-assets-${SW_VERSION}`;
const IMAGES_CACHE = `anivault-images-${SW_VERSION}`;
const API_CACHE    = `anivault-api-${SW_VERSION}`;

const ALL_CACHES = [STATIC_CACHE, ASSETS_CACHE, IMAGES_CACHE, API_CACHE];

// Nombre maximum d'entrées conservées par cache "dynamique" (évite une
// croissance illimitée — les Cache Storage n'ont pas de TTL natif).
const MAX_ENTRIES = {
  [ASSETS_CACHE]: 80,
  [IMAGES_CACHE]: 400,
  [API_CACHE]: 200,
};

// Assets statiques connus à l'avance à mettre en cache immédiatement.
// (Les fichiers JS/CSS buildés sont hashés et inconnus à l'écriture de ce
// fichier — ils rejoignent ASSETS_CACHE dynamiquement au premier chargement.)
const PRECACHE = [
  "/",
  "/index.html",
  "/site.webmanifest",
  "/logo.png",
  "/logo-wide.png",
  "/splash-poster.png",
  "/splash-anim.gif",
  "/favicon.svg",
  "/favicon-96x96.png",
  "/apple-touch-icon.png",
  "/web-app-manifest-192x192.png",
  "/web-app-manifest-512x512.png",
];

// Domaines d'API publiques (pas de donnée utilisateur) que l'on peut se
// permettre de mettre en cache pour une consultation hors ligne.
const CACHEABLE_API_HOSTS = new Set(["api.themoviedb.org", "api.tvmaze.com", "api.jikan.moe"]);

// Chemin de la fonction Edge Supabase servant les fiches média (AniList /
// TMDB / Jikan) — contenu public, identique pour tout le monde, idéal pour
// le cache. On ne cache RIEN d'autre côté Supabase (auth, rest, realtime)
// pour ne jamais mélanger de données propres à une session utilisateur.
const MEDIA_PROXY_PATH = "/functions/v1/smooth-task";

function isCacheableApiRequest(url) {
  if (CACHEABLE_API_HOSTS.has(url.hostname)) return true;
  if (url.hostname.endsWith(".supabase.co") && url.pathname.includes(MEDIA_PROXY_PATH)) return true;
  return false;
}

// ── Installation : précache du shell ───────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // { cache: "reload" } pour contourner le cache HTTP du navigateur et
      // être sûr de récupérer les toutes dernières versions au moment de l'install.
      Promise.all(
        PRECACHE.map((url) =>
          fetch(url, { cache: "reload" })
            .then((res) => (res.ok ? cache.put(url, res) : null))
            .catch(() => null) // un asset manquant ne doit pas bloquer l'install
        )
      )
    )
  );
  self.skipWaiting();
});

// ── Activation : purge des anciennes versions de cache ─────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("anivault-") && !ALL_CACHES.includes(k))
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Utilitaires ──────────────────────────────────────────────────────────

/** Supprime les entrées les plus anciennes d'un cache au-delà de `max`. */
async function trimCache(cacheName, max) {
  if (!max) return;
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  const excess = keys.length - max;
  for (let i = 0; i < excess; i++) await cache.delete(keys[i]);
}

async function putInCache(cacheName, request, response) {
  if (!response || !response.ok) return;
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
    trimCache(cacheName, MAX_ENTRIES[cacheName]);
  } catch {
    // Cache Storage plein ou requête non cachable (ex: réponse opaque
    // volumineuse) — on abandonne silencieusement, ce n'est pas critique.
  }
}

/** Cache-first : sert le cache s'il existe, sinon va au réseau et cache le résultat. */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const fresh = await fetch(request);
    putInCache(cacheName, request, fresh.clone());
    return fresh;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

/** Network-first : tente le réseau, retombe sur le cache en cas d'échec. */
async function networkFirst(request, cacheName) {
  try {
    const fresh = await fetch(request);
    putInCache(cacheName, request, fresh.clone());
    return fresh;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error("network-first: aucune ressource disponible (réseau + cache)");
  }
}

/** Network-first spécial navigation : repli sur le shell (index.html) si tout échoue. */
async function networkFirstNavigate(request) {
  try {
    const fresh = await fetch(request);
    putInCache(STATIC_CACHE, request, fresh.clone());
    return fresh;
  } catch {
    const cachedExact = await caches.match(request);
    if (cachedExact) return cachedExact;
    const shell = await caches.match("/index.html");
    if (shell) return shell;
    throw new Error("navigate: aucun shell en cache");
  }
}

/**
 * Stale-while-revalidate : répond instantanément avec le cache si présent
 * (parfait pour une fiche déjà consultée), tout en rafraîchissant en tâche
 * de fond pour la prochaine visite. Si rien en cache, attend le réseau.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cached = await caches.match(request);

  const networkUpdate = fetch(request)
    .then((fresh) => {
      putInCache(cacheName, request, fresh.clone());
      return fresh;
    })
    .catch(() => null);

  if (cached) {
    networkUpdate; // rafraîchissement en tâche de fond, on n'attend pas
    return cached;
  }

  const fresh = await networkUpdate;
  if (fresh) return fresh;
  throw new Error("stale-while-revalidate: ni cache ni réseau disponibles");
}

// ── Interception des requêtes ───────────────────────────────────────────────
self.addEventListener("fetch", (e) => {
  const { request } = e;

  // On ne touche jamais aux écritures (POST/PUT/DELETE...) : GraphQL AniList,
  // Supabase auth/insert/update, envoi de push subscription, etc.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // 1. Navigation (chargement de page / F5 sur une route SPA) ────────────
  if (request.mode === "navigate") {
    e.respondWith(networkFirstNavigate(request));
    return;
  }

  // 2. Fichiers buildés hashés (immutables) ───────────────────────────────
  if (url.origin === location.origin && url.pathname.startsWith("/assets/")) {
    e.respondWith(cacheFirst(request, ASSETS_CACHE));
    return;
  }

  // 3. Images (affiches, logos...), toute origine confondue ──────────────
  if (request.destination === "image") {
    e.respondWith(cacheFirst(request, IMAGES_CACHE));
    return;
  }

  // 4. APIs publiques sans donnée utilisateur (fiches média, TMDB, TVmaze) ─
  if (isCacheableApiRequest(url)) {
    e.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  // 5. Reste du même-origine (manifest, icônes non précachées...) ────────
  if (url.origin === location.origin) {
    e.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // 6. Tout le reste (Supabase auth/rest/realtime, GraphQL AniList, polices
  //    Google...) : on laisse le navigateur gérer nativement, pas d'interception.
});

// Réception de notifications push envoyées par la fonction Edge planifiée
// (supabase/functions/notify-episodes). Fonctionne même onglet fermé.
self.addEventListener("push", (e) => {
  const data = e.data?.json() ?? {};
  const tag  = data.tag || (data.entryId ? `anivault-${data.entryId}-${data.episode ?? ""}` : "anivault");

  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // Vérifie si au moins un onglet/fenêtre est actuellement ouvert et visible
      const isAppOpen = list.some((client) => client.visibilityState === "visible");

      const tasks = [];

      // 1. Si l'app est FERMÉE ou en ARRIÈRE-PLAN : on affiche la notif système OS
      if (!isAppOpen) {
        tasks.push(
          self.registration.showNotification(data.title || "AniVault", {
            body:  data.body  || "",
            icon:  "/logo.png",
            badge: "/favicon-96x96.png",
            tag,
            data:  { entryId: data.entryId ?? null, link: data.link ?? null, iconKey: data.icon || "sparkles" },
          })
        );
      }

      // 2. Dans tous les cas, on prévient les clients ouverts pour mettre à jour le store/panel
      tasks.push(
        Promise.all(
          list.map((client) => client.postMessage({
            type: "PUSH_RECEIVED",
            title: data.title || "AniVault",
            body: data.body || "",
            entryId: data.entryId ?? null,
            episode: data.episode ?? null,
            icon: data.icon || "sparkles",
            link: data.link ?? null,
          }))
        )
      );

      return Promise.all(tasks);
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const entryId = e.notification.data?.entryId;
  const link    = e.notification.data?.link;
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(location.origin)) {
          if (link) client.postMessage({ type: "OPEN_LINK", link });
          else if (entryId) client.postMessage({ type: "OPEN_ENTRY", entryId });
          return client.focus();
        }
      }
      return clients.openWindow(link || (entryId ? `/details/${entryId}` : "/"));
    })
  );
});

