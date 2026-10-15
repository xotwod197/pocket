// Offline support: the app shell is cached so Pocket opens without signal.
// Code files are fetched fresh when online (network first) so updates show up right away.
// Firebase handles offline data separately (it caches your data on the device).
const CACHE = "pocket-v3";
const SHELL = ["./", "index.html", "css/app.css", "css/ios.css", "css/motion.css", "js/app.js", "js/motion.js", "js/finance.js", "js/store.js", "js/charts.js", "js/firebase-config.js",
  "manifest.webmanifest", "icons/icon-192.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/__/")) return; // leave Firebase/Google traffic alone
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request).then((r) => r || caches.match("index.html")))
  );
});
