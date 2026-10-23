// -----------------------------------------------------------------------------
// AniVault - Service Worker
//
// Objectif : une app utilisable hors ligne pour tout ce qui a déjà été consulté
// au moins une fois (bibliothèque, fiches, affiches, polices, recherches).
//
// La bibliothèque elle-meme vit dans le localStorage et dans Supabase : ce
// Service Worker ne s'occupe que du reste (shell de l'app, fichiers buildés,
// images distantes, polices, réponses JSON des API publiques).
//
// Stratégies :
//   - Navigation            : réseau d'abord (avec délai maximum), repli sur le
//                             shell /index.html en cache
//   - /assets/* (hashés)    : cache d'abord (contenu immuable)
//   - Polices Google        : CSS en stale-while-revalidate, fichiers en cache
//                             d'abord
//   - Images (toute origine): cache d'abord, purge des plus anciennes
//   - API publiques         : stale-while-revalidate avec âge maximum ; les
//                             requêtes "force" et le calendrier hebdomadaire
//                             passent par le réseau d'abord
//   - Reste du même domaine : réseau d'abord
//   - Tout le reste (Supabase auth/rest/realtime, GraphQL AniList en POST...) :
//     non intercepté. On ne met jamais en cache une réponse liée à une session.
// -----------------------------------------------------------------------------

const SW_VERSION = "v12";

const STATIC_CACHE  = `anivault-static-${SW_VERSION}`;   // précache + shell
const ASSETS_CACHE  = `anivault-assets-${SW_VERSION}`;   // JS/CSS hashés
const IMAGES_CACHE  = `anivault-images-${SW_VERSION}`;
const API_CACHE     = `anivault-api-${SW_VERSION}`;
const FONTS_CACHE   = `anivault-fonts-${SW_VERSION}`;
const RUNTIME_CACHE = `anivault-runtime-${SW_VERSION}`;  // autres fichiers du domaine

const ALL_CACHES = [STATIC_CACHE, ASSETS_CACHE, IMAGES_CACHE, API_CACHE, FONTS_CACHE, RUNTIME_CACHE];

// Nombre maximal d'entrées par cache dynamique (le Cache Storage n'a pas de TTL).
// STATIC_CACHE n'est jamais purgé : il contient le shell et le précache.
const MAX_ENTRIES = {
  [ASSETS_CACHE]: 80,
  [IMAGES_CACHE]: 400,
  [API_CACHE]: 200,
  [FONTS_CACHE]: 40,
  [RUNTIME_CACHE]: 60,
};

const SHELL_URL = "/index.html";

// Fichiers connus à l'avance, mis en cache à l'installation. Les fichiers
// JS/CSS buildés sont hashés : ils rejoignent ASSETS_CACHE au premier chargement.
const PRECACHE = [
  "/",
  SHELL_URL,
  "/site.webmanifest",
  "/logo.webp",
  "/splash-poster.webp",
  "/splash-anim.webp",
  "/favicon.svg",
  "/favicon-96x96.png",
  "/web-app-manifest-192x192.png",
];

// Icône des notifications système (PNG obligatoire côté OS) et badge.
const NOTIF_ICON  = "/web-app-manifest-192x192.png";
const NOTIF_BADGE = "/favicon-96x96.png";

// Hôtes d'API publiques, sans donnée utilisateur.
const CACHEABLE_API_HOSTS = new Set(["api.themoviedb.org", "api.tvmaze.com", "api.tenrai.org"]);

// Fonction Edge Supabase servant les fiches média et le calendrier hebdomadaire
// (contenu public). Rien d'autre côté Supabase n'est mis en cache.
const MEDIA_PROXY_PATH = "/functions/v1/smooth-task";

const FONT_CSS_HOST  = "fonts.googleapis.com";
const FONT_FILE_HOST = "fonts.gstatic.com";

// Âges maximaux : au-delà, le réseau est préféré et le cache ne sert qu'hors ligne.
const API_MAX_AGE_MS     = 6 * 60 * 60 * 1000;
const RUNTIME_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const FONT_CSS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Délai avant de servir le shell en cache quand le réseau répond trop lentement.
const NAVIGATION_TIMEOUT_MS = 4000;

function isCacheableApiRequest(url) {
  if (CACHEABLE_API_HOSTS.has(url.hostname)) return true;
  return url.hostname.endsWith(".supabase.co") && url.pathname.includes(MEDIA_PROXY_PATH);
}

// Requêtes qui doivent toujours tenter le réseau en premier : rafraîchissement
// force (synchro, tirer-pour-rafraichir) et calendrier hebdomadaire, dont les
// horaires changent. Sans cela, un "force" pouvait être servi depuis le cache.
function wantsFreshData(url) {
  return url.searchParams.get("force") === "1" || url.searchParams.get("mode") === "schedule";
}

/** URL « normale » (sans `force`) équivalente à une requête force=1 — ou null. */
function forceAsNormalRequest(url) {
  if (url.searchParams.get("force") !== "1") return null;
  const normal = new URL(url.href);
  normal.searchParams.delete("force");
  return normal.href;
}

// -- Installation : précache du shell ------------------------------------------
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      Promise.all(
        PRECACHE.map((url) =>
          // cache: "reload" contourne le cache HTTP pour obtenir la dernière version.
          fetch(url, { cache: "reload" })
            .then((res) => (res.ok ? cache.put(url, res) : null))
            .catch(() => null) // un fichier manquant ne doit pas bloquer l'installation
        )
      )
    )
  );
  self.skipWaiting();
});

// -- Activation : purge des anciennes versions, précharge de navigation ---------
self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith("anivault-") && !ALL_CACHES.includes(k)).map((k) => caches.delete(k))
      );
      // Démarre la requête réseau de navigation en parallèle du démarrage du SW.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable().catch(() => {});
      }
      await self.clients.claim();
    })()
  );
});

// -- Utilitaires ----------------------------------------------------------------

/** Supprime les entrées les plus anciennes d'un cache au-delà de `max`. */
async function trimCache(cacheName, max) {
  if (!max) return;
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

/** Met une réponse en cache. Ignore silencieusement les échecs (quota, réponse opaque). */
async function putInCache(cacheName, request, response) {
  if (!response || !response.ok) return;
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
    trimCache(cacheName, MAX_ENTRIES[cacheName]);
  } catch {
    // Cache plein ou réponse non cachable : non critique.
  }
}

/** Vrai si la réponse en cache a moins de `maxAgeMs` (d'après son en-tête Date). */
function isFresh(response, maxAgeMs) {
  const date = Date.parse(response.headers.get("date") || "");
  return Number.isFinite(date) && Date.now() - date < maxAgeMs;
}

// Hôtes tiers dont le CDN n'a pas répondu en CORS : inutile de réessayer.
const corsBlockedHosts = new Set();

/**
 * Récupère une ressource tierce. Une balise <img> ou <link> envoie une requête
 * "no-cors" dont la réponse est opaque, donc impossible à mettre en cache de
 * facon fiable. On retente donc d'abord en CORS : si le CDN l'autorise, la
 * réponse est lisible et cachable ; sinon on retombe sur la requête d'origine.
 */
async function fetchCorsFirst(request) {
  const url = new URL(request.url);
  if (request.mode === "no-cors" && url.origin !== location.origin && !corsBlockedHosts.has(url.hostname)) {
    try {
      const res = await fetch(request.url, { mode: "cors", credentials: "omit" });
      if (res.ok) return res;
    } catch {
      corsBlockedHosts.add(url.hostname);
    }
  }
  return fetch(request);
}

/** Cache d'abord : sert le cache s'il existe, sinon va au réseau et met en cache. */
async function cacheFirst(request, cacheName, fetcher = fetch) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const fresh = await fetcher(request);
  putInCache(cacheName, request, fresh.clone());
  return fresh;
}

/**
 * Réseau d'abord : repli sur le cache uniquement si le réseau est injoignable.
 * `alsoCacheAs` : seconde clé de cache alimentée avec la même réponse (voir
 * l'usage pour les requêtes "force" : la donnée fraîche remplace aussi la version
 * « normale » en cache, sinon celle-ci restait périmée jusqu'à 6 h).
 */
async function networkFirst(request, cacheName, alsoCacheAs = null) {
  try {
    const fresh = await fetch(request);
    putInCache(cacheName, request, fresh.clone());
    if (alsoCacheAs) putInCache(cacheName, alsoCacheAs, fresh.clone());
    return fresh;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error("network-first: ni réseau ni cache");
  }
}

/**
 * Stale-while-revalidate avec âge maximum. Une réponse en cache récente est
 * servie immédiatement pendant qu'une mise à jour part en arrière-plan. Une
 * réponse trop ancienne n'est servie que si le réseau échoue.
 */
async function staleWhileRevalidate(event, request, cacheName, maxAgeMs, fetcher = fetch, { revalidateFresh = true } = {}) {
  const cached = await caches.match(request);

  // revalidateFresh: false → une réponse en cache encore valable est servie TELLE QUELLE, sans
  // relancer de requête réseau. Avant, la requête de mise à jour partait systématiquement, même
  // pour une réponse toute fraîche : chaque lecture « en cache » de la fonction Edge Supabase
  // déclenchait quand même une invocation (+ du trafic sortant + une ligne de log).
  if (cached && !revalidateFresh && isFresh(cached, maxAgeMs)) return cached;

  const update = fetcher(request)
    .then((fresh) => {
      putInCache(cacheName, request, fresh.clone());
      return fresh;
    })
    .catch(() => null);

  if (cached && isFresh(cached, maxAgeMs)) {
    event.waitUntil(update); // garde le SW en vie jusqu'à la fin de la mise à jour
    return cached;
  }

  const fresh = await update;
  if (fresh && fresh.ok) return fresh;
  if (cached) return cached;
  if (fresh) return fresh;
  throw new Error("stale-while-revalidate: ni cache ni réseau");
}

/**
 * Navigation. Le réseau est tenté en premier (précharge de navigation incluse).
 * Si la réponse tarde trop ou si l'appareil est hors ligne, le shell en cache
 * est servi. Toutes les routes sont la même page : on ne garde qu'une copie.
 */
async function handleNavigation(event) {
  const network = (async () => (await event.preloadResponse) || fetch(event.request))().then((res) => {
    if (res.ok && !res.redirected) putInCache(STATIC_CACHE, SHELL_URL, res.clone());
    return res;
  });
  event.waitUntil(network.catch(() => {}));

  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("navigation-timeout")), NAVIGATION_TIMEOUT_MS)
    );
    return await Promise.race([network, timeout]);
  } catch {
    const shell = await caches.match(SHELL_URL);
    if (shell) return shell;
    return network; // pas de shell en cache : on attend le réseau jusqu'au bout
  }
}

// -- Interception des requêtes ----------------------------------------------------
self.addEventListener("fetch", (e) => {
  const { request } = e;

  // Jamais d'interception des écritures (GraphQL AniList, Supabase, abonnements push...).
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // 1. Navigation
  if (request.mode === "navigate") {
    e.respondWith(handleNavigation(e));
    return;
  }

  // 2. Fichiers buildés hashés
  if (url.origin === location.origin && url.pathname.startsWith("/assets/")) {
    e.respondWith(cacheFirst(request, ASSETS_CACHE));
    return;
  }

  // 3. Polices Google : feuille de style puis fichiers
  if (url.hostname === FONT_CSS_HOST) {
    e.respondWith(staleWhileRevalidate(e, request, FONTS_CACHE, FONT_CSS_MAX_AGE_MS, fetchCorsFirst));
    return;
  }
  if (url.hostname === FONT_FILE_HOST) {
    e.respondWith(cacheFirst(request, FONTS_CACHE));
    return;
  }

  // 4. Images, toute origine confondue
  if (request.destination === "image") {
    e.respondWith(cacheFirst(request, IMAGES_CACHE, fetchCorsFirst));
    return;
  }

  // 5. API publiques sans donnée utilisateur
  if (isCacheableApiRequest(url)) {
    e.respondWith(
      wantsFreshData(url)
        ? networkFirst(request, API_CACHE, forceAsNormalRequest(url))
        : staleWhileRevalidate(e, request, API_CACHE, API_MAX_AGE_MS, fetch, { revalidateFresh: false })
    );
    return;
  }

  // 6. Autres fichiers du même domaine (manifest, icônes, donnees statiques)
  if (url.origin === location.origin) {
    e.respondWith(staleWhileRevalidate(e, request, RUNTIME_CACHE, RUNTIME_MAX_AGE_MS));
    return;
  }

  // 7. Tout le reste : comportement natif du navigateur.
});

// -- Notifications push ------------------------------------------------------------
// Envoyées par la fonction Edge planifiée (supabase/functions/notify-episodes),
// même application fermée.
self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data?.json() ?? {};
  } catch {
    // Charge utile illisible : on affiche une notification générique.
  }

  const tag = data.tag || (data.entryId ? `anivault-${data.entryId}-${data.episode ?? ""}` : "anivault");

  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      const isAppOpen = list.some((client) => client.visibilityState === "visible");
      const tasks = [];

      // Application fermée ou en arrière-plan : notification système.
      if (!isAppOpen) {
        tasks.push(
          self.registration.showNotification(data.title || "AniVault", {
            body: data.body || "",
            icon: NOTIF_ICON,
            badge: NOTIF_BADGE,
            tag,
            data: { entryId: data.entryId ?? null, link: data.link ?? null, iconKey: data.icon || "sparkles" },
          })
        );
      }

      // Dans tous les cas, on prévient les fenêtres ouvertes (store et panneau de notifications).
      list.forEach((client) =>
        client.postMessage({
          type: "PUSH_RECEIVED",
          title: data.title || "AniVault",
          body: data.body || "",
          entryId: data.entryId ?? null,
          episode: data.episode ?? null,
          icon: data.icon || "sparkles",
          link: data.link ?? null,
          tag, // identifiant stable : déduplication live / rattrapage (voir App.jsx)
        })
      );

      return Promise.all(tasks);
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const { entryId, link } = e.notification.data || {};
  // L'application ne gère que le message OPEN_LINK : un entryId seul est
  // converti en lien vers la fiche.
  const target = link || (entryId ? `/details/${entryId}` : null);

  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(location.origin)) {
          if (target) client.postMessage({ type: "OPEN_LINK", link: target });
          return client.focus();
        }
      }
      return self.clients.openWindow(target || "/");
    })
  );
});
