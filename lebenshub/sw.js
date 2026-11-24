/* Lebenshub Service Worker: Offline-Betrieb + Erinnerungen im Hintergrund */
importScripts('sched.js');
const V = 'lebenshub-shell-v37';
const ASSETS = ['./', 'index.html', 'styles.css', 'app.js', 'unpack.js', 'docs.js', 'fin.js', 'radar.js', 'finplan.js', 'life.js', 'pension.js', 'know.js', 'tiktok.js', 'prompts_data.js', 'prompts.js', 'research.js', 'work.js', 'projects.js', 'agents.js', 'brain.js', 'health.js', 'mail.js', 'weather.js', 'live.js', 'music.js', 'photos.js', 'cal.js', 'chat.js', 'mind.js', 'voice.js', 'store.js', 'vendor/anthropic-sdk-1.5.0.mjs', 'sched.js', 'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== V && k !== LH.DC).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

/* Sofort aus dem Cache starten, im Hintergrund aktualisieren (Änderungen gelten beim nächsten Öffnen) */
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(V).then(async c => {
    const hit = await c.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await c.match('index.html') : null);
    const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }
    return (await net) || Response.error();
  }));
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
