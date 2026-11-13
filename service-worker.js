/* RiftVault v1.16: Offline app shell only. Inventory always remains in browser localStorage. */
const CACHE = 'riftvault-shell-v1.25';
const SHELL = ['./', './index.html', './app.js', './styles.css', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './set-origins.png', './set-spiritforged.png', './set-unleashed.png', './set-vendetta.png', './set-radiance.png', './riftvault-blue-logo.png', './features-v121.js', './features-v121.css', './official-updates.json'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('riftvault-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never intercept OCR CDN or catalogue fetches
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }
  // Prefer fresh scripts/styles after a GitHub Pages update; fall back to cache offline.
  event.respondWith(fetch(req).then(res => { if (res.ok && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.json'))) { const copy = res.clone(); caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {}); } return res; }).catch(() => caches.match(req)));
});
