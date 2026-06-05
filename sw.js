// Service Worker — Portal Ujian SMPN 1 Kaliwedi
// Path disesuaikan untuk GitHub Pages subdirektori

const CACHE_NAME  = 'ujian-smpn1-v2';
const BASE        = '/ujian-smpn1kaliwedi/';
const CACHE_URLS  = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
];

// Install — cache file utama
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Gunakan individual try-catch agar satu gagal tidak blokir semua
        return Promise.allSettled(
          CACHE_URLS.map(url => cache.add(url).catch(err => {
            console.warn('Cache gagal untuk:', url, err);
          }))
        );
      })
  );
  self.skipWaiting();
});

// Activate — hapus cache lama
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch — network first, fallback cache
self.addEventListener('fetch', e => {
  // Lewati request non-GET
  if (e.request.method !== 'GET') return;

  // Lewati request ke Apps Script dan GitHub API (harus selalu online)
  const url = e.request.url;
  if (url.includes('script.google.com') ||
      url.includes('api.github.com') ||
      url.includes('docs.google.com')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Simpan ke cache jika berhasil
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => {
        // Network gagal — coba dari cache
        return caches.match(e.request).then(cached => {
          if (cached) return cached;
          // Fallback ke index.html untuk navigasi
          if (e.request.mode === 'navigate') {
            return caches.match(BASE + 'index.html');
          }
        });
      })
  );
});
