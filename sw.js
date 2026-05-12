const CACHE = 'dfg-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/school.html',
  '/logo.jpg',
  '/banner.jpg',
  '/banner 2.jpg',
  '/school.jpeg',
  '/featured school.jpeg',
  '/how the school started.jpeg',
  '/learners.jpeg',
  '/kids in class.jpeg',
  '/Rabbi Mwandu teaching torah.jpeg',
  '/Rabbi mwandu and brother sam teaching torah.jpeg',
  '/Rabbi Edson Mwandu the director.jpeg',
  '/Mrs Mwandu the director.jpeg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }))
  );
});
