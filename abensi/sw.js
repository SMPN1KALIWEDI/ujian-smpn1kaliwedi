const CACHE_NAME = 'absensi-sholat-v1';
const ASSETS = ['./AbsensiSholat.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(()=>{})
  );
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

// Network-first untuk data (Apps Script), cache-first untuk file aplikasi sendiri
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  if (url.includes('script.google.com')) return; // jangan cache data absensi
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
