const CACHE_NAME = "anivault-v1";

// Assets statiques à mettre en cache immédiatement
const PRECACHE = [
  "/",
  "/index.html",
  "/logo.png",
  "/logo-wide.png",
  "/favicon-96x96.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Stratégie : Network first → Cache fallback
self.addEventListener("fetch", (e) => {
  // Ne pas intercepter les requêtes API externes
  const url = new URL(e.request.url);
  if (
    url.origin !== location.origin ||
    e.request.method !== "GET"
  ) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // Mettre à jour le cache avec la réponse fraîche
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Réception de notifications push (via useNotifications)
self.addEventListener("push", (e) => {
  const data = e.data?.json() ?? {};
  e.waitUntil(
    self.registration.showNotification(data.title || "🎌 AniVault", {
      body:  data.body  || "",
      icon:  data.icon  || "/logo.png",
      badge: data.badge || "/favicon-96x96.png",
      tag:   data.tag   || "anivault",
      data:  data.data  || {},
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const entryId = e.notification.data?.entryId;
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(location.origin)) {
          if (entryId) client.postMessage({ type: "OPEN_ENTRY", entryId });
          return client.focus();
        }
      }
      return clients.openWindow(entryId ? `/details/${entryId}` : "/");
    })
  );
});