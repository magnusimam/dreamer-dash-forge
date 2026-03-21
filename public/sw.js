const CACHE_NAME = 'dreamer-dash-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only cache same-origin GET requests for static assets
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;
  if (event.request.url.includes('/functions/')) return;
  if (event.request.mode === 'navigate') return; // Never cache HTML navigations

  const url = new URL(event.request.url);
  // Only cache assets (js, css, images)
  if (!url.pathname.startsWith('/assets/')) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        const fetched = fetch(event.request).then((response) => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        });
        return cached || fetched;
      })
    )
  );
});
