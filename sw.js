// Cadence service worker — makes the app installable and openable offline.
// Strategy: network-FIRST for the page (so new deploys always show when online,
// never stuck on a cached version), cache as the offline fallback. The Supabase
// API is never cached (always live); the supabase-js library is cache-first.
const CACHE = "cadence-shell-v2";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }

  // Supabase auth/data/storage: always go to the network, never cache.
  if (url.hostname.endsWith("supabase.co")) return;

  const accept = req.headers.get("accept") || "";
  const isHTML = req.mode === "navigate" || accept.indexOf("text/html") >= 0;

  if (isHTML) {
    // network-first: fresh page when online, cached page when offline
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match(req)))
    );
    return;
  }

  if (req.method === "GET") {
    // static assets (icons, the supabase-js lib): cache-first, then network
    e.respondWith(
      caches.match(req).then((cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        }).catch(() => cached)
      )
    );
  }
});
