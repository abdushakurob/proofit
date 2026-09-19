/* ─────────────────────────────────────────────────────────────
   ProofIt Offline-First PWA Service Worker (sw.js - v4)
   Automatic Background Cache Warmer & Stale-While-Revalidate
   ───────────────────────────────────────────────────────────── */

const CACHE_NAME = "proofit-v4";
const ROUTES_TO_CACHE = [
  "/",
  "/workspace",
  "/login",
  "/oin",
  "/oin/docs",
  "/verify",
  "/docs",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png"
];

async function warmCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(ROUTES_TO_CACHE);

    // Warm Next.js static JS/CSS assets by parsing script and link tags from cached HTML
    for (const route of ["/", "/workspace", "/verify", "/login", "/oin"]) {
      try {
        const response = await fetch(route);
        if (response && response.status === 200) {
          await cache.put(route, response.clone());
          const html = await response.text();
          const matches = html.match(/(?:src|href)="(\/_next\/static\/[^"]+)"/g);
          if (matches) {
            for (const match of matches) {
              const url = match.replace(/^(?:src|href)="/, "").replace(/"$/, "");
              if (url) {
                cache.add(url).catch(() => {});
              }
            }
          }
        }
      } catch (err) {
        // Ignore single route warming failure
      }
    }
  } catch (err) {
    console.warn("PWA cache warming notice:", err);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ROUTES_TO_CACHE);
    }).then(() => {
      self.skipWaiting();
      return warmCache();
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      self.clients.claim();
      return warmCache();
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "WARM_CACHE") {
    warmCache();
  }
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (event.request.url.includes("/api/")) return;

  // Stale-While-Revalidate Strategy for all HTML, JS, CSS, and Image requests
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          return cachedResponse || caches.match("/workspace") || caches.match("/");
        });

      return cachedResponse || fetchPromise;
    })
  );
});
