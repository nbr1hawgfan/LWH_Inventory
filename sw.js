/* ============================================================
   LWH Inventory — Service Worker
   Caches the app shell for instant loading on repeat visits.
   Data always fetches live from GAS — never cached.
============================================================ */

var CACHE_NAME = 'lwh-inventory-v1';

var SHELL_FILES = [
  '/LWH_Inventory/',
  '/LWH_Inventory/index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.5/JsBarcode.all.min.js',
  'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js'
];

/* Install — cache the app shell */
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      /* Cache what we can — don't fail install if CDN files miss */
      return cache.addAll([
        '/LWH_Inventory/',
        '/LWH_Inventory/index.html'
      ]).then(function() {
        /* Try CDN files separately — non-fatal if they fail */
        return Promise.allSettled(
          SHELL_FILES.slice(2).map(function(url) {
            return cache.add(url).catch(function(){});
          })
        );
      });
    })
  );
  self.skipWaiting();
});

/* Activate — clean up old caches */
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE_NAME; })
            .map(function(k){ return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

/* Fetch strategy:
   - GAS API calls (script.google.com): always network, never cache
   - CDN scripts: cache-first (they don't change)
   - App shell (index.html): network-first, fall back to cache
*/
self.addEventListener('fetch', function(e) {
  var url = e.request.url;

  /* GAS API — always live, never intercept */
  if (url.indexOf('script.google.com') >= 0) {
    return;
  }

  /* CDN scripts — cache first */
  if (url.indexOf('cdnjs.cloudflare.com') >= 0 ||
      url.indexOf('cdn.jsdelivr.net') >= 0 ||
      url.indexOf('unpkg.com') >= 0) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        return cached || fetch(e.request).then(function(response) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache){
            cache.put(e.request, clone);
          });
          return response;
        }).catch(function(){ return cached; });
      })
    );
    return;
  }

  /* App shell — network first, cache fallback */
  e.respondWith(
    fetch(e.request).then(function(response) {
      var clone = response.clone();
      caches.open(CACHE_NAME).then(function(cache){
        cache.put(e.request, clone);
      });
      return response;
    }).catch(function() {
      return caches.match(e.request);
    })
  );
});
