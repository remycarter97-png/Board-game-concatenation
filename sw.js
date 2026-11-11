// Service worker: makes the site installable and usable offline.
// Pages and the collection come from the network when it's there (so they stay current) and
// from the last saved copy when it isn't. Fonts and libraries are cached once. Game night events
// (Supabase) always go to the network.
const VERSION = "v18";
const SHELL = `shell-${VERSION}`, DATA = `data-${VERSION}`, LIBS = `libs-${VERSION}`;
const PAGES = ["/", "/stats", "/tools", "/tools/initiative", "/tools/game-night", "/tools/quiz", "/tools/first-player", "/tools/event", "/tools/campaigns", "/tools/goals", "/tools/table", "/tools/tournament", "/tools/compare", "/tools/shelves", "/tools/etiquette", "/tools/azul", "/tools/tacta", "/tools/inserts"];
const ASSETS = ["/manifest.webmanifest", "/pwa.js", "/safe-area.css", "/tools/gn-core.js", "/tools/campaign-templates.js", "/tools/shelf-sync.js", "/tools/tournament-core.js", "/tools/shelf-core.js", "/tools/bgstats.js", "/tools/tacta-core.js", "/tools/insert-core.js", "/powered-by-bgg.png", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png", "/icons/favicon-32.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => Promise.all([...PAGES, ...ASSETS].map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => ![SHELL, DATA, LIBS].includes(k)).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const LIB_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "cdnjs.cloudflare.com", "cdn.jsdelivr.net"];
// Pages are cached by path, so /?source=app and / share one copy.
const pageKey = (url) => url.pathname.replace(/\.html$/, "").replace(/\/index$/, "/") || "/";

async function networkFirst(req, cacheName, key) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(key || req, res.clone());
    else if (res.status >= 500) return (await cache.match(key || req)) || res; // server trouble: use the saved copy if there is one
    return res;
  } catch (err) {
    const hit = await cache.match(key || req) || (req.mode === "navigate" ? await caches.match("/", { cacheName: SHELL }) : null);
    if (hit) return hit;
    throw err;
  }
}
async function cacheFirst(req) {
  const cache = await caches.open(LIBS), hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
}
async function staleWhileRevalidate(req) {
  const cache = await caches.open(SHELL), hit = await cache.match(req);
  const fresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || fresh;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (url.pathname === "/sw.js" || url.pathname.startsWith("/api/sync") || url.pathname.startsWith("/api/party") || url.pathname.startsWith("/api/group")) return; // always live
    if (url.pathname === "/api/collection" || url.pathname === "/api/plays") return e.respondWith(networkFirst(req, DATA, url.pathname));
    if (req.mode === "navigate" || req.destination === "document") return e.respondWith(networkFirst(req, SHELL, pageKey(url)));
    return e.respondWith(staleWhileRevalidate(req));
  }
  if (LIB_HOSTS.includes(url.hostname)) return e.respondWith(cacheFirst(req));
  // Box art from BGG isn't cached (it would take a lot of space); pages show a drawing when it's missing.
});
