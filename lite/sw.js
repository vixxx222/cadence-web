// Cadence Lite service worker — installable + openable offline.
// Network-FIRST for the page so a deploy is never stuck behind a cached copy;
// cache is the offline fallback. Supabase is never cached (always live).
const CACHE = "cadence-lite-v1";
const SHELL = [
  "./", "./index.html", "./manifest.webmanifest",
  "./icon-192.png", "./icon-512.png",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
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
  if (url.hostname.endsWith("supabase.co")) return;          // always live

  const accept = req.headers.get("accept") || "";
  const isHTML = req.mode === "navigate" || accept.indexOf("text/html") >= 0;

  if (isHTML) {
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
