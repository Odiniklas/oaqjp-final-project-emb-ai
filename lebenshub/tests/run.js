/* Lebenshub – automatische Tests (Playwright + Mock von window.claude, synthetische Daten).
   Start:  node lebenshub/tests/run.js     (braucht das npm-Paket „playwright“ mit Chromium) */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium, devices } = require('playwright');
const ROOT = path.join(__dirname, '..'), MOCK = fs.readFileSync(path.join(__dirname, 'mock.js'), 'utf8');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture.json'), 'utf8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((q, r) => {
  const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
let failed = 0;
const ok = (cond, name, info) => { console.log((cond ? '  ✓ ' : '  ✗ ') + name + (cond || info === undefined ? '' : '  → ' + JSON.stringify(info))); if (!cond) failed++; };

async function page(browser, url, seed, extra) {
  const ctx = await browser.newContext(devices['iPhone 13']);
  await ctx.addInitScript({ content: MOCK + ';' + (seed ? 'window.__seed(' + JSON.stringify(seed) + ');' : '') + (extra || '') });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto(url); await p.waitForTimeout(1200);
  return { p, errs, ctx };
}

(async () => {
  await new Promise(r => server.listen(0, r));
  const url = 'http://localhost:' + server.address().port + '/';
  const browser = await chromium.launch();
  try {
    console.log('1) Alle Bereiche rendern ohne Fehler und ohne seitliches Scrollen');
    {
      const { p, errs, ctx } = await page(browser, url, FIX);
      const tabs = await p.evaluate(() => TABS.map(t => t[0]).concat(['settings']));
      for (const t of tabs) {
        const r = await p.evaluate(t => { TAB = t; render(); return { w: document.documentElement.scrollWidth, iw: innerWidth, cards: document.querySelectorAll('.card').length }; }, t);
        ok(r.cards > 0 && r.w <= r.iw + 1, 'Bereich „' + t + '“', r);
      }
      ok(errs.length === 0, 'keine JavaScript-Fehler', errs.slice(0, 5));
      await ctx.close();
    }

    console.log('2) Rechenlogik');
    {
      const { p, ctx } = await page(browser, url, FIX);
      const r = await p.evaluate(() => { const T = lifeTotals(), R = pensCalc(); return { month: T.month, save: T.save, pay: T.pay, n: T.n, rente: R && Math.round(R.total), ep: R && R.ep, fin: finTotals().total }; });
      ok(Math.abs(r.month - 605) < 0.01, 'Fixkosten/Monat ohne Gehaltsabzug, Sparen und Angebote (600 + 60/12)', r);
      ok(r.save === 300 && r.pay === 100, 'Sparen und Gehaltsabzug getrennt erfasst', r);
      ok(r.rente > 0 && r.ep > 2, 'Rentenrechnung liefert Wert und wachsende Entgeltpunkte', r);
      ok(Math.abs(r.fin - 1750) < 0.01, 'Vermögen = 10 × 100 € + 250 € + 500 € Cash', r);
      await ctx.close();
    }

    console.log('3) Odi: Werkzeugauswahl und Sprachbefehle');
    {
      const { p, ctx } = await page(browser, url, FIX);
      const r = await p.evaluate(() => ({ all: tools().length, picked: pickTools('Trag mir morgen 10 Uhr Physio ein', 20, false).length, nav: odiCommand('öffne Finanzen'), stop: odiCommand('stopp') }));
      ok(r.picked > 0 && r.picked <= 20, 'höchstens 20 Werkzeuge pro Anfrage (Grenze der Plattform)', r);
      ok(/Finanzen/.test(r.nav || ''), '„öffne Finanzen“ wird als Navigation erkannt', r);
      ok(/Sehr wohl/.test(r.stop || ''), '„stopp“ beendet das Sprechen', r);
      await ctx.close();
    }

    console.log('4) Getrennte Speicherung: Wissen und Gehirn in eigenen Dokumenten');
    {
      const { p, ctx } = await page(browser, url, FIX);
      await p.waitForTimeout(1500);
      const r = await p.evaluate(() => ({ hubKnow: 'know' in (__store['hub/state'].state || {}), hubBrain: 'brain' in (__store['hub/state'].state || {}), partKnow: __store['parts/know'] && __store['parts/know'].data.length, partBrain: __store['parts/brain'] && __store['parts/brain'].data.links.length, inApp: S.know.length }));
      ok(!r.hubKnow && !r.hubBrain, 'alter Stand wurde aus hub/state herausgelöst', r);
      ok(r.partKnow === 1 && r.partBrain === 1 && r.inApp === 1, 'Inhalte liegen in parts/know und parts/brain und sind in der App sichtbar', r);
      await p.evaluate(() => { know().unshift({ id: 'k2', title: 'Neu', kind: 'Notiz', summary: '', points: [], tags: [], status: 'Zu lesen', added: '2026-11-20' }); save(); });
      await p.waitForTimeout(1200);
      const r2 = await p.evaluate(() => ({ part: __store['parts/know'].data.length, hubKnow: 'know' in __store['hub/state'].state }));
      ok(r2.part === 2 && !r2.hubKnow, 'neuer Wissenseintrag landet in parts/know', r2);
      await ctx.close();
    }

    console.log('5) Inbox-Jobs werden übernommen und gelöscht');
    {
      const job = { source: 'Test-Job', at: '2026-11-20T10:00:00Z', summary: 'Test', actions: [{ tool: 'add_entry', list: 'n', title: 'Aus dem Job', note: 'x', date: '' }] };
      const { p, ctx } = await page(browser, url, FIX, 'window.__store["inbox/test1"]=' + JSON.stringify(job) + ';');
      await p.waitForTimeout(1500);
      const r = await p.evaluate(() => ({ inbox: 'inbox/test1' in __store, has: (S.lists.n || []).some(e => e.n === 'Aus dem Job'), log: (S.jobLog || [])[0] && S.jobLog[0].source }));
      ok(!r.inbox && r.has && r.log === 'Test-Job', 'Aktion ausgeführt, Job im Protokoll, Inbox-Dokument gelöscht', r);
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(failed ? '\n' + failed + ' Test(s) fehlgeschlagen.' : '\nAlle Tests bestanden.');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
