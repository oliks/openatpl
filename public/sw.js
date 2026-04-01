const SHELL_CACHE = "openatpl-shell-v1";
const OFFLINE_CACHE = "openatpl-offline-v1";

const APP_SHELL = [
  "/",
  "/create-test",
  "/logo.png",
  "/favicon.ico",
  "/manifest.json",
];

// Install: pre-cache app shell only
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean up old versioned caches
self.addEventListener("activate", (event) => {
  const keep = new Set([SHELL_CACHE, OFFLINE_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Static assets (_next): cache-first from shell
  if (url.pathname.startsWith("/_next/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // API + attachments: offline cache first, then network, cache on success
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/attachments/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok && event.request.method === "GET") {
            const clone = response.clone();
            caches.open(OFFLINE_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // RSC flight requests (Next.js client navigation): cache for offline
  const isRsc = event.request.headers.get("rsc") === "1"
    || url.searchParams.has("_rsc");
  if (isRsc && url.pathname.match(/^\/tests\/\d+\/run/)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(OFFLINE_CACHE).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Test runner pages (/tests/*/run): network-first, cache response for offline
  if (url.pathname.match(/^\/tests\/\d+\/run/)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(OFFLINE_CACHE).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match("/"))
        )
    );
    return;
  }

  // Other pages: network-first, fallback to cache, then home
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  // Everything else: network with cache fallback
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
