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
            data:  { entryId: data.entryId ?? null, iconKey: data.icon || "sparkles" },
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