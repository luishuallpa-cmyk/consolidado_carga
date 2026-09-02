/* IEM Consolidado — service worker mínimo (instalable PWA) */
var CACHE = 'iem-consolidado-v1.3.9';
var PRECACHE = [
  './',
  './index.html',
  './consolidado.js',
  './config.js',
  './manifest.json',
  './logo-iem.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(PRECACHE).catch(function () {
        // si falla algún archivo, no bloquea la instalación
        return Promise.all(
          PRECACHE.map(function (u) {
            return cache.add(u).catch(function () {});
          })
        );
      });
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE; }).map(function (k) {
          return caches.delete(k);
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  // No cachear APIs externas (Supabase, CDN, tiles)
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (cache) {
        try { cache.put(req, copy); } catch (e) {}
      });
      return res;
    }).catch(function () {
      return caches.match(req).then(function (cached) {
        return cached || caches.match('./index.html');
      });
    })
  );
});
