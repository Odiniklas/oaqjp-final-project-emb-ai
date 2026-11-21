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

    console.log('6) Prompt-Bibliothek');
    {
      const { p, errs, ctx } = await page(browser, url, FIX);
      const r = await p.evaluate(() => { TAB = 'files'; render(); const closed = !!document.querySelector('.prompts [data-act=prOpen][data-n="1"]');
        PROPEN = true; render(); const rows = document.querySelectorAll('.prompts .row').length;
        PRAREA = 'Startup & Marketing'; render(); const filtered = document.querySelectorAll('.prompts .row').length; PRAREA = '';
        return { n: PROMPTS.length, closed, rows, filtered, noPrivate: !/@[a-z0-9-]+\.[a-z]{2,}|\bDE\d{2} ?\d{4}|sk-ant-/i.test(JSON.stringify(PROMPTS)) && PROMPTS.every(p => !/\[PRIVAT|NUR_PRIVAT/.test(p.body)) }; });
      ok(r.n === 32 && r.rows === 32 && r.filtered === 7 && r.closed, '32 Prompts, Kurzansicht, Filter nach Bereich', r);
      ok(r.noPrivate, 'keine E-Mail-Adressen, IBANs oder Schlüssel in den mitgelieferten Prompts', r);
      await p.evaluate(() => promptDlg(1));
      await p.fill('#dlgf textarea[name=task]', 'Notiz: Testgespräch');
      await p.click('#dlgf button[value=odi]');
      await p.waitForTimeout(200);
      const r2 = await p.evaluate(() => ({ tab: TAB, draft: chatDraft.length, hasTask: chatDraft.endsWith('Notiz: Testgespräch'), sent: (window.__calls || []).length, hint: /übernehmen/.test(chatDraft) }));
      ok(r2.tab === 'chat' && r2.hasTask && r2.hint && r2.sent === 0, '„Mit Odi nutzen“ füllt nur das Eingabefeld, sendet nichts', r2);
      ok(errs.length === 0, 'keine JavaScript-Fehler', errs.slice(0, 3));
      await ctx.close();
    }

    console.log('7) Promotion-Forschungsstand und Job-Feedback');
    {
      const fx = JSON.parse(JSON.stringify(FIX));
      fx.know.push({ id: 'k9', title: 'Testpaper Dispatch', kind: 'Paper', url: '', source: 'Test', summary: '', points: [], tags: ['Promotion', 'AP3'], status: 'Zu lesen', added: '2026-11-20' });
      fx.jobLog = [{ source: 'Wissensagent', at: '2026-11-20T08:00:00Z', summary: 'Test', labels: [] }];
      const { p, errs, ctx } = await page(browser, url, fx);
      const r = await p.evaluate(() => { TAB = 'files'; render(); const rows = [...document.querySelectorAll('.promo .aprow')]; const ap3 = rows.find(x => x.dataset.v === 'AP3');
        ap3.click(); const filtered = document.querySelectorAll('.know .row').length;
        return { rows: rows.length, ap3: ap3.querySelector('.apc').textContent, tag: KNOWTAG, filtered }; });
      ok(r.rows === 8 && r.ap3 === '1' && r.tag === 'AP3' && r.filtered === 1, 'AP1–AP8 gezählt, Tippen filtert das Wissen', r);
      const r2 = await p.evaluate(() => { TAB = 'today'; render(); const b = document.querySelector('[data-act=jobfb][data-v=up]'); if (!b) return { found: false }; b.click(); return { found: true, fb: S.jobLog[0].fb }; });
      ok(r2.found && r2.fb === 'up', '👍 an einem Job-Ergebnis wird gespeichert', r2);
      ok(errs.length === 0, 'keine JavaScript-Fehler', errs.slice(0, 3));
      await ctx.close();
    }
    console.log('8) Arbeitskontexte & Hightech, Gehirn-Erkenntnisse');
    {
      const fx = JSON.parse(JSON.stringify(FIX));
      fx.lists.a = [{ id: 'a1', n: 'MOSB-Billing', t: '', d: '', s: 0 }];
      fx.know.push({ id: 'h1', title: 'Hightech-Idee · Testprüfung', kind: 'Idee', url: '', source: 'Test', summary: 'Synthetische Idee', points: ['P1'], tags: ['Arbeit', 'Hightech-Idee', 'MOSB'], status: 'Gelesen', added: '2026-11-21' });
      fx.brain = { links: [], topics: {}, questions: [], grown: '', insights: Array.from({ length: 8 }, (_, i) => ({ id: 'i' + i, text: 'Erkenntnis ' + i, refs: i === 0 ? ['know:h1'] : [], at: '2026-11-21' })) };
      const { p, errs, ctx } = await page(browser, url, fx);
      const r = await p.evaluate(() => { TAB = 'work'; render(); const c = document.querySelector('.work'); document.querySelector('[data-act=wkCtx][data-v=MOSB]').click();
        const idea = document.querySelectorAll('.work .wk-idea').length, item = !!document.querySelector('.work [data-act=wkItem][data-id=a1]');
        document.querySelector('[data-act=wkPilot][data-id=h1]').click(); const pilot = S.work.pilot, shown = !!document.querySelector('.work .wk-pilot');
        document.querySelector('.wk-pilot [data-act=wkStep]').click(); const steps = S.lists.n.length;
        return { card: !!c, idea, item, pilot, shown, steps }; });
      ok(r.card && r.idea === 1 && r.item, 'Arbeitskontext zeigt Idee und passenden Arbeitseintrag', r);
      ok(r.pilot === 'h1' && r.shown && r.steps === 2, 'Pilot wählen und als nächsten Schritt übernehmen', r);
      const r2 = await p.evaluate(() => { document.querySelector('[data-act=wkOdi][data-id=h1]').click(); return { tab: TAB, draft: chatDraft.includes('Testprüfung') && chatDraft.includes('übernehmen'), sent: CHAT.length }; });
      ok(r2.tab === 'chat' && r2.draft && r2.sent === 0, '1-Seiter füllt nur das Odi-Feld', r2);
      const r3 = await p.evaluate(() => { TAB = 'files'; render(); const n0 = document.querySelectorAll('.br-ins').length; document.querySelector('[data-act=bins]').click(); const n1 = document.querySelectorAll('.br-ins').length;
        const ref = document.querySelector('.br-refs [data-act=bnode]'); ref.click(); const n2 = document.querySelectorAll('.br-ins').length; return { n0, n1, n2, sel: brSel }; });
      ok(r3.n0 === 6 && r3.n1 === 8 && r3.n2 === 1 && r3.sel === 'know:h1', 'Erkenntnisse aufklappbar, Bezug antippen filtert', r3);
      ok(errs.length === 0, 'keine JavaScript-Fehler', errs.slice(0, 3));
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(failed ? '\n' + failed + ' Test(s) fehlgeschlagen.' : '\nAlle Tests bestanden.');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
