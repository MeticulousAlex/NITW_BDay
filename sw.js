// Кэш ресурсов игры (GitHub Pages: кэш браузера всего 10 мин, сеть медленная). Картинки, звуки, json — из кэша, если
// уже скачивались (в том числе фоном — prefetch.ts); страница — всегда из сети. Версия — время сборки
// (tools/pages-postbuild.mjs): новый деплой — новый кэш, старый удаляется.
const V = 'nitw-1792262539099';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(caches.keys()
  .then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const q = e.request;
  const u = new URL(q.url);
  // чужие адреса, не GET, страница, частичные запросы (звук <audio> — Range) — как обычно
  if (q.method !== 'GET' || u.origin !== location.origin || u.pathname.endsWith('/') || u.pathname.endsWith('.html')
    || q.headers.has('range') || u.pathname.endsWith('/sw.js')) return;
  e.respondWith(caches.open(V).then(async (c) => {
    const hit = await c.match(q);
    if (hit) return hit;
    const r = await fetch(q);
    if (r.status === 200) c.put(q, r.clone()).catch(() => {});
    return r;
  }));
});
