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

// Message handler for explicit offline download
self.addEventListener("message", (event) => {
  if (event.data?.type === "CACHE_URLS") {
    const urls = event.data.urls || [];
    event.waitUntil(
      caches.open(OFFLINE_CACHE).then(async (cache) => {
        let done = 0;
        for (const url of urls) {
          try {
            await cache.add(url);
          } catch {
            // Skip failed URLs
          }
          done++;
          // Report progress back
          if (event.source) {
            event.source.postMessage({ type: "CACHE_PROGRESS", done, total: urls.length });
          }
        }
        if (event.source) {
          event.source.postMessage({ type: "CACHE_COMPLETE", total: urls.length });
        }
      })
    );
  }

  if (event.data?.type === "DELETE_CACHE") {
    const key = event.data.key;
    if (key) {
      event.waitUntil(
        caches.open(OFFLINE_CACHE).then(async (cache) => {
          const requests = await cache.keys();
          for (const req of requests) {
            if (req.url.includes(key)) await cache.delete(req);
          }
        })
      );
    }
  }
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

  // API + attachments: check offline cache first, then network
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/attachments/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request);
      })
    );
    return;
  }

  // Pages: network-first, fallback to cache, then home
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
