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
    console.log('9) Aktienradar-Ampel in den Finanzen');
    {
      const { p, errs, ctx } = await page(browser, url, FIX);
      const r = await p.evaluate(() => { TAB = 'money'; render(); const empty = !!document.querySelector('.radar');
        const res = runTool('set_radar', { asOf: '2026-11-20', items: [{ name: 'Testaktie A', ticker: 'TA', cat: 'kaufen', val: 'günstig', price: 100, cur: 'EUR', zoneLo: 90, zoneHi: 102, target: 130, pe: 'KGV 12' }, { name: 'Testaktie B', cat: 'nein', val: 'teuer', price: 50, cur: 'USD' }, { name: 'Testaktie C', cat: 'warten', val: 'fair', price: 80, zoneHi: 70, cur: 'EUR' }, { name: 'X', cat: 'unsinn' }] });
        render(); const rows = [...document.querySelectorAll('.radar .rad-row')].map(x => x.textContent);
        document.querySelector('[data-act=radCheap]').click(); const cheap = document.querySelectorAll('.radar .rad-row').length;
        document.querySelector('[data-act=radCat][data-v=""]').click(); document.querySelector('[data-act=radCat][data-v=nein]').click(); const nein = document.querySelectorAll('.radar .rad-row').length;
        return { empty, n: S.fin.radar.items.length, cats: S.fin.radar.items.map(i => i.cat), first: rows[0] || '', inzone: rows.some(t => t.includes('in der Zone')), over: rows.some(t => t.includes('über Zone')), up: rows.some(t => t.includes('+30,0')), cheap, nein }; });
      ok(r.empty && r.n === 4 && r.cats[3] === 'beobachten', 'set_radar speichert, unbekannte Kategorie wird „beobachten“', r);
      ok(r.first.includes('Testaktie A') && r.inzone && r.over && r.up, 'Sortierung kaufen zuerst, Zone und Analystenpotenzial berechnet', r);
      ok(r.cheap === 1 && r.nein === 1, 'Filter „günstig bewertet“ und Kategorie', r);
      ok(errs.length === 0, 'keine JavaScript-Fehler', errs.slice(0, 3));
      await ctx.close();
    }
    console.log('10) Odi: Wissenssuche, Gedächtnis, Sprache');
    {
      const fx = JSON.parse(JSON.stringify(FIX));
      fx.know.push({ id: 'kh', title: 'Heideck · Speicherauslegung und Betreibermodelle', kind: 'Notiz', url: 'https://example.org/doc', source: 'Test', summary: 'Gemeinsamer Speicher 200–300 kWh technisch sinnvoll; Mehrzweckspeicher 1 MW kostet 530–770 Tsd. Euro.', points: ['Energiemanagement-Dienst zuerst'], tags: ['Heideck', 'BESS'], status: 'Gelesen', added: '2026-11-21' },
        { id: 'km', title: 'Mikroökonomie – Zusammenfassung', kind: 'Notiz', url: '', source: 'Uni', summary: 'Angebot, Nachfrage, Preisbildung.', points: [], tags: ['Uni'], status: 'Gelesen', added: '2020-01-01' });
      const { p, errs, ctx } = await page(browser, url, fx);
      const r = await p.evaluate(() => {
        const hits = hubSearch('Was kostet der Speicher in Heideck?', 5), rel = relevantContext('Was kostet der Speicher in Heideck?');
        const none = hubSearch('xyzqwv blubb', 5).length;
        return { first: hits[0] && hits[0].title, n: hits.length, rel: rel.text.includes('<relevant') && rel.text.includes('530'), refs: rel.refs.length, none,
          tierA: chooseTier('Bewerte bitte, welche Förderung für mein Startup sinnvoll ist', false), tierV: chooseTier('Bewerte bitte, welche Förderung für mein Startup sinnvoll ist', true), tierQ: chooseTier('Hallo', true) };
      });
      ok(r.first && r.first.startsWith('Heideck') && r.rel && r.none === 0, 'Wissenssuche findet den passenden Eintrag zuerst und liefert Kontext', r);
      ok(r.tierA === 'complex' && r.tierV === 'default' && r.tierQ === 'quick', 'Modellstufe passt sich der Frage an', r);
      const t = await p.evaluate(() => ({
        a: ttsText('Kosten: 1.400 € bzw. 11 % am 2026-11-22, z. B. 2 MW / 4 MWh – siehe https://x.de 🚀'),
        b: spokenPart('Erster Satz. Zweiter Satz! Dritter?\n\nDetails, die nicht vorgelesen werden.'),
        c: spokenPart('- Punkt eins ohne Absatz')
      }));
      ok(/1\.400 Euro/.test(t.a) && /11 Prozent/.test(t.a) && /22\. November 2026/.test(t.a) && /zum Beispiel/.test(t.a) && /Megawatt/.test(t.a) && !/https|🚀|€|%/.test(t.a), 'Sprachtext: Euro, Prozent, Datum, Abkürzungen, keine Links/Emojis', t.a);
      ok(t.b === 'Erster Satz. Zweiter Satz! Dritter?' && t.c === 'Punkt eins ohne Absatz', 'Vorgelesen wird nur die Kurzantwort', t);
      const m = await p.evaluate(() => {
        runTool('remember', { text: 'Ich will bei Heideck Initiator und Betriebsführer werden.', kind: 'Entscheidung' });
        runTool('remember', { text: 'Ich will bei Heideck Initiator und Betriebsführer werden.', kind: 'Entscheidung' });
        const f = S.brain.facts.length, snap = factsSnapshot().includes('Betriebsführer'), found = hubSearch('Heideck Betriebsführer Entscheidung', 3).some(h => h.type === 'Gemerkt');
        TAB = 'files'; render(); const shown = !!document.querySelector('.br-fact');
        return { f, snap, found, shown, inHub: hubSnapshot().includes('Gemerkt') };
      });
      ok(m.f === 1 && m.snap && m.found && m.shown && m.inHub, 'Gedächtnis: speichert ohne Dubletten, durchsuchbar, im Gehirn sichtbar, im Kontext', m);
      const v = await p.evaluate(async () => {
        window.__spoken = []; window.__cap = null;
        speakOnce = txt => { window.__spoken.push(txt); return Promise.resolve(); };
        const full = 'Dein Speicher in Heideck kostet etwa 530 bis 770 Tausend Euro. Zuerst kommt der Energiemanagement-Dienst.\n\nDetails: Rechnung mit 1 MW / 2 MWh.';
        const fake = async (input, opts) => { window.__cap = { input, tier: opts.modelTier, tools: (opts.tools || []).map(x => x.name) };
          opts.onText({ text: 'Dein Speicher in Heideck kostet etwa 530 bis 770 Tausend Euro.' }); opts.onText({ text: full });
          await opts.tools.find(x => x.name === 'remember').execute({ text: 'Heideck-Speicher erst nach Gate 2 bauen.', kind: 'Entscheidung' });
          return { text: full, truncated: false }; };
        fake.json = ART.sample.json; fake.limits = ART.sample.limits; ART.sample = fake;
        viaVoice = true; TAB = 'chat'; render();
        await sendChat('Was kostet der Speicher in Heideck und was mache ich zuerst?');
        await new Promise(r => setTimeout(r, 300));
        const last = CHAT[CHAT.length - 1], userMsg = window.__cap.input[window.__cap.input.length - 1].content;
        return { rel: userMsg.includes('<relevant') && userMsg.includes('Heideck · Speicherauslegung'), voiceHint: userMsg.includes('erste Absatz wird vorgelesen'), tier: window.__cap.tier,
          tools: window.__cap.tools.includes('remember') && window.__cap.tools.includes('search_hub'), spoken: window.__spoken, refs: last.refs || [], fact: S.brain.facts.some(f => /Gate 2/.test(f.text)), act: (last.actions || []).some(a => /Gemerkt/.test(a)) };
      });
      ok(v.rel && v.voiceHint && v.tools, 'Anfrage enthält passenden Hub-Kontext, Sprachhinweis und Such-/Gedächtnis-Werkzeuge', v);
      ok(v.spoken.length >= 2 && v.spoken.join(' ').includes('530 bis 770 Tausend Euro') && !v.spoken.join(' ').includes('Details') && new Set(v.spoken).size === v.spoken.length, 'Sprache: liest satzweise schon beim Schreiben, keine Details, keine Wiederholung', v.spoken);
      ok(v.fact && v.act && v.refs.length > 0, 'Gemerktes und Quellen werden am Gespräch angezeigt', v);
      const sg = await p.evaluate(() => { CHAT = []; TAB = 'chat'; render(); return document.querySelectorAll('[data-act=csugg]').length; });
      ok(sg >= 4, 'leerer Chat zeigt Fragevorschläge', sg);
      ok(errs.filter(e => !/Vorlesen|speech/i.test(e)).length === 0, 'keine JavaScript-Fehler', errs.slice(0, 3));
      await ctx.close();
    }
    console.log('11) Girokonto: Sparkassen-CSV-Import ohne sensible Daten');
    {
      const { p, errs, ctx } = await page(browser, url, FIX);
      const r = await p.evaluate(async () => {
        const head = '"Auftragskonto";"Buchungstag";"Valutadatum";"Buchungstext";"Verwendungszweck";"Glaeubiger ID";"Mandatsreferenz";"Kundenreferenz (End-to-End)";"Sammlerreferenz";"Lastschrift Ursprungsbetrag";"Auslagenersatz Ruecklastschrift";"Beguenstigter/Zahlungspflichtiger";"Kontonummer/IBAN";"BIC (SWIFT-Code)";"Betrag";"Waehrung";"Info"';
        const row = (d, bt, vz, who, iban, amt) => ['DE00TESTKONTO', d, d, bt, vz, 'DE98ZZZ09999999999', 'MANDAT123', '', '', '', '', who, iban, 'TESTDEFFXXX', amt, 'EUR', 'Umsatz gebucht'].map(x => '"' + x + '"').join(';');
        const csv = [head,
          row('28.10.26', 'LOHN GEHALT', 'Gehalt Oktober', 'Beispiel Energie GmbH', 'DE11111111111111111111', '3.100,00'),
          row('02.10.26', 'LASTSCHRIFT', 'Miete Wohnung', 'Hausverwaltung Muster GmbH', 'DE22222222222222222222', '-780,00'),
          row('02.11.26', 'LASTSCHRIFT', 'Miete Wohnung', 'Hausverwaltung Muster GmbH', 'DE22222222222222222222', '-780,00'),
          row('05.10.26', 'KARTENZAHLUNG', 'REWE SAGT DANKE 1234', 'REWE Markt GmbH', 'DE33333333333333333333', '-54,20'),
          row('10.10.26', 'FOLGELASTSCHRIFT', 'Netflix Abo', 'NETFLIX INTERNATIONAL B.V.', 'NL44444444444444444444', '-13,99'),
          row('10.11.26', 'FOLGELASTSCHRIFT', 'Netflix Abo', 'NETFLIX INTERNATIONAL B.V.', 'NL44444444444444444444', '-13,99'),
          row('12.10.26', 'ONLINE-UEBERWEISUNG', 'Danke fuers Essen', 'Mustermann, Max', 'DE55555555555555555555', '-25,00'),
          row('15.10.26', 'DAUERAUFTRAG', 'Sparplan', 'Trade Republic Bank GmbH', 'DE66666666666666666666', '-200,00')].join('\r\n');
        const buf = new TextEncoder().encode(csv), f = new File([buf], 'umsaetze.csv', { type: 'text/csv' });
        const n1 = await bankImportFiles([f]), n2 = await bankImportFiles([f]);
        const json = JSON.stringify(S.fin.tx);
        TAB = 'money'; render();
        const st = bankStats('2026-10');
        return { n1, n2, noIban: !/DE\d{20}|NL\d{20}|MANDAT|DE98ZZZ|TESTKONTO|Gehalt Oktober|Danke fuers/.test(json), privat: S.fin.tx.some(t => t.p === 'Privat') && !/Mustermann/.test(json),
          cats: Object.fromEntries(S.fin.tx.map(t => [t.p, t.c])), inc: st.inc, save: st.save, rec: bankRecurring().map(x => x.p), card: !!document.querySelector('.bank'), w: document.documentElement.scrollWidth <= innerWidth + 1, ctx: finSnapshotText().includes('Girokonto') };
      });
      ok(r.n1 === 8 && r.n2 === 0, 'importiert alle Umsätze, erkennt Doppelimport', r);
      ok(r.noIban && r.privat, 'speichert keine IBAN, Referenzen, Verwendungszwecke oder Privatnamen', r);
      ok(r.cats['REWE Markt GmbH'] === 'lebensmittel' && r.cats['Trade Republic Bank GmbH'] === 'sparen' && r.inc === 3100 && r.save === 200, 'Kategorien und Monatswerte stimmen', r);
      ok(r.rec.some(x => /NETFLIX/.test(x)) && r.rec.some(x => /Hausverwaltung/.test(x)), 'wiederkehrende Abbuchungen erkannt', r.rec);
      ok(r.card && r.w && r.ctx, 'Girokonto-Karte in Finanzen, kein seitliches Scrollen, Odi sieht die Monatsübersicht', r);
      ok(errs.length === 0, 'keine JavaScript-Fehler', errs.slice(0, 3));
      await ctx.close();
    }
  } finally { await browser.close(); server.close(); }
  console.log(failed ? '\n' + failed + ' Test(s) fehlgeschlagen.' : '\nAlle Tests bestanden.');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
