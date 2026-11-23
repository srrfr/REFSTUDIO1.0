// RefStudio Progressive Web App Service Worker
const CACHE_NAME = 'refstudio-cache-v1.0.4';

const STATIC_ASSETS = [
  '/',
  '/designazioni',
  '/giocatori',
  '/squadre',
  '/partite',
  '/note-video',
  '/profilo',
  '/manifest.json',
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/icon.svg',
  '/icons/apple-touch-icon.png',
  '/logo_small.png',
  '/logo_big.png',
  '/favicon.png',
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

// Install Event - Pre-cache core shell e pagine principali
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Usiamo Promise.allSettled con makeNgrokSafeRequest per pre-caricare senza blocchi
      return Promise.allSettled(
        STATIC_ASSETS.map((assetUrl) => {
          const req = makeNgrokSafeRequest(new Request(assetUrl));
          return fetch(req)
            .then((res) => {
              if (isValidCacheableResponse(res)) {
                return cache.put(assetUrl, res);
              }
            })
            .catch(() => {});
        })
      );
    })
  );
  // Forza l'attivazione immediata del nuovo Service Worker
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

// Fetch Event - Performance first con Stale-While-Revalidate per una navigazione istantanea
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignora richieste non-GET ed estensioni del browser
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  const safeRequest = makeNgrokSafeRequest(request);

  // 1. API calls e Supabase Realtime/REST: Network ONLY / Network First senza caching
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

  // 2. Next.js RSC requests (_rsc query) e route data:
  // STRATEGIA STALE-WHILE-REVALIDATE: restituisce IMMEDIATAMENTE la copia in cache (0ms lag!)
  // e aggiorna la cache in background tramite ngrok.
  if (url.searchParams.has('_rsc') || url.pathname.includes('/_next/data/')) {
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

        // Se è presente in cache ed è valido, lo restituiamo SUBITO (zero latenza al click della scheda)
        if (cachedResponse && isValidCacheableResponse(cachedResponse)) {
          return cachedResponse;
        }

        // Se non ancora in cache (primo click), attendiamo la risposta di rete
        return fetchPromise.then((res) => {
          if (res) return res;
          if (cachedResponse) return cachedResponse;
          return new Response('', { status: 503 });
        });
      })
    );
    return;
  }

  // 3. Static Assets / Scripts / CSS / Chunks Next.js / Immagini: Cache First, poi Network
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.match(/\.(png|jpg|jpeg|svg|webp|ico|woff2?|css|js)$/)
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

  // 4. Navigation (HTML pages): Stale-While-Revalidate per transizione istantanea tra le pagine
  if (request.mode === 'navigate') {
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
          .catch(async () => {
            if (cachedResponse) return cachedResponse;
            const rootCached = await caches.match('/');
            if (rootCached) return rootCached;
            return new Response('Modalità offline attiva.', {
              headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
          });

        if (cachedResponse && isValidCacheableResponse(cachedResponse)) {
          return cachedResponse;
        }

        return fetchPromise;
      })
    );
    return;
  }

  // 5. Default: Stale-while-revalidate per tutte le altre richieste
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
