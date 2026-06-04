// Service Worker — Portal Ujian SMPN 1 Kaliwedi
// Membuat app bisa diinstall sebagai PWA dan bekerja offline (halaman dasar)

const CACHE_NAME = 'ujian-smpn1-v1';
const CACHE_URLS = [
  '/',
  '/index.html',
];

// Install: cache file utama
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: hapus cache lama
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: utamakan network, fallback ke cache
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
