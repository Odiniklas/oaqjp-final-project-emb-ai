/* Lebenshub Service Worker: Offline-Betrieb + Erinnerungen im Hintergrund */
importScripts('sched.js');
const V = 'lebenshub-shell-v2';
const ASSETS = ['./', 'index.html', 'styles.css', 'app.js', 'sched.js', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== V && k !== LH.DC).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* Netz zuerst (damit Updates ankommen), Cache als Offline-Rückfall */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(V).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});

/* Android/Chrome: regelmäßige Prüfung im Hintergrund, wenn die App installiert ist */
self.addEventListener('periodicsync', e => {
  if (e.tag === 'lebenshub-check') e.waitUntil(LH.notifyDue(self.registration));
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'check') e.waitUntil(LH.notifyDue(self.registration));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
