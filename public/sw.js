// RefStudio Progressive Web App Service Worker
const CACHE_NAME = 'refstudio-cache-v1.0.3';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon.svg',
  '/icons/apple-touch-icon.png',
  '/favicon.svg'
];

// Helper per iniettare l'header di bypass ngrok su tutte le chiamate di rete
function makeNgrokSafeRequest(request) {
  try {
    const headers = new Headers(request.headers);
    if (!headers.has('ngrok-skip-browser-warning')) {
      headers.set('ngrok-skip-browser-warning', 'true');
    }
    return new Request(request, { headers });
  } catch (e) {
    return request;
  }
}

// Verifica che la risposta sia valida e non un blocco o avviso ngrok ERR_NGROK_6024
function isValidCacheableResponse(response) {
  if (!response || response.status !== 200) return false;
  if (response.headers && response.headers.has('ngrok-error-code')) return false;
  return true;
}

// Install Event - Pre-cache core shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Non-critical precache failure:', err);
      });
    })
  );
  // Force immediate activation
  self.skipWaiting();
});

// Activate Event - Clean old caches (rimuove cache corrotte o obsolete)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network first with fallback for offline support
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests and browser extensions
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  const safeRequest = makeNgrokSafeRequest(request);

  // API calls and Supabase Realtime/REST: Network ONLY / Network First without caching stale data
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(safeRequest).catch(() => {
        return new Response(JSON.stringify({ error: 'Connessione offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    return;
  }

  // Next.js RSC requests (_rsc query) o chunks dinamici: Network First con bypass ngrok, MAI fallback a '/'
  if (url.searchParams.has('_rsc') || url.pathname.includes('/_next/data/')) {
    event.respondWith(
      fetch(safeRequest).then((networkResponse) => {
        if (isValidCacheableResponse(networkResponse)) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response('', { status: 503 });
      })
    );
    return;
  }

  // Static Assets / Images: Cache First, then Network
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse && isValidCacheableResponse(cachedResponse)) {
          return cachedResponse;
        }
        return fetch(safeRequest).then((networkResponse) => {
          if (isValidCacheableResponse(networkResponse)) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Navigation (HTML pages): Network first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(safeRequest)
        .then((networkResponse) => {
          if (isValidCacheableResponse(networkResponse)) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const rootCached = await caches.match('/');
          if (rootCached) return rootCached;
          return new Response('Modalità offline attiva.', {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        })
    );
    return;
  }

  // Default: Stale-while-revalidate for other requests
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(safeRequest)
        .then((networkResponse) => {
          if (isValidCacheableResponse(networkResponse)) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return (cachedResponse && isValidCacheableResponse(cachedResponse)) ? cachedResponse : fetchPromise;
    })
  );
});
