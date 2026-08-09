const CACHE_NAME = 'homemap-shell-v2';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/icons/icon-192.svg', '/icons/icon-512.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  // Admin Console (/admin.html, /src/admin/*, y cualquier futura ruta
  // /admin*) nunca debe pasar por este Service Worker: ni cache-first ni
  // el fallback a /index.html en fallo de red (más abajo) son aceptables
  // para un panel administrativo — siempre debe ir directo a red y pedir
  // la versión más fresca. Este SW tiene scope "/" (se registra desde
  // /sw.js), así que sin este guard interceptaría también /admin* aunque
  // src/admin/main.jsx no lo registre.
  if (requestUrl.pathname.startsWith('/admin')) {
    return;
  }

  const isSameOrigin = requestUrl.origin === self.location.origin;
  if (!isSameOrigin) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          return response;
        })
        .catch(() => caches.match('/index.html'));
    })
  );
});
