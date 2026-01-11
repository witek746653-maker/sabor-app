const PRECACHE = 'precache-v9';
const RUNTIME_CACHE = 'runtime-v9';
const PRECACHE_MANIFEST_URL = 'precache-files.json';

async function precacheAssets() {
  const cache = await caches.open(PRECACHE);
  let manifest = [];

  try {
    const response = await fetch(PRECACHE_MANIFEST_URL, { cache: 'no-store' });
    if (response.ok) {
      manifest = await response.json();
    } else {
      console.warn('[sw] Не удалось получить манифест ресурсов', response.status);
    }
  } catch (error) {
    console.error('[sw] Ошибка при загрузке манифеста ресурсов', error);
  }

  const urls = new Set(['/','index.html', PRECACHE_MANIFEST_URL, ...manifest]);

  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok || response.type === 'opaque') {
        await cache.put(url, response.clone());
      } else {
        console.warn(`[sw] Пропуск кэширования ${url}: статус ${response.status}`);
      }
    } catch (error) {
      console.error(`[sw] Не удалось кэшировать ${url}`, error);
    }
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    await precacheAssets();
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.filter((name) => ![PRECACHE, RUNTIME_CACHE].includes(name)).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin === location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith((async () => {
        try {
          const networkResponse = await fetch(request, { cache: 'no-store' });
          const runtime = await caches.open(RUNTIME_CACHE);
          await runtime.put(request, networkResponse.clone());
          return networkResponse;
        } catch (error) {
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;
          const fallback = await caches.match('index.html');
          if (fallback) return fallback;
          throw error;
        }
      })());
      return;
    }

    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) {
        return cached;
      }

      try {
        const networkResponse = await fetch(request, { cache: 'no-store' });
        const runtime = await caches.open(RUNTIME_CACHE);
        if (networkResponse.ok || networkResponse.type === 'opaque') {
          await runtime.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        const fallback = await caches.match('index.html');
        if (fallback && request.destination === 'document') {
          return fallback;
        }
        const cachedResponse = await caches.match(request);
        if (cachedResponse) return cachedResponse;
        return Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    try {
      return await fetch(request);
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;
      throw error;
    }
  })());
});


