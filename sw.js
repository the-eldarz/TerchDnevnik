/* ============================================================
   Service Worker для PWA «Расписание»
   Стратегия: сеть в приоритете, кэш — как резерв.
   Это значит, что пользователь всегда получает свежую версию,
   а если интернета нет — открывается из кэша.
   ============================================================ */

const CACHE_NAME = 'schedule-v1';

/* Файлы, которые кэшируем сразу при установке */
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

/* --- Установка: кэшируем статику --- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE).catch(() => {
        /* Если какой-то файл не нашёлся — не критично */
      });
    })
  );
  self.skipWaiting();
});

/* --- Активация: чистим старые кэши --- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

/* --- Перехват запросов --- */
self.addEventListener('fetch', (event) => {
  const req = event.request;

  /* Кэшируем только GET */
  if (req.method !== 'GET') return;

  /* Запросы к API (jsonbin) не кэшируем — там всегда нужны свежие данные */
  if (req.url.includes('api.jsonbin.io')) return;

  /* Telegram-скрипт тоже пропускаем мимо кэша */
  if (req.url.includes('telegram.org')) return;

  event.respondWith(
    fetch(req)
      .then((response) => {
        /* Кладём свежий ответ в кэш */
        if (response && response.status === 200 && response.type === 'basic'){
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return response;
      })
      .catch(() => {
        /* Нет сети — отдаём из кэша */
        return caches.match(req).then((cached) => {
          if (cached) return cached;
          /* Если это переход по ссылке — отдаём index.html */
          if (req.mode === 'navigate') return caches.match('./index.html');
        });
      })
  );
});