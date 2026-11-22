/* Lebenshub – Aktienradar-Ampel (Bereich Finanzen).
   Der zweiwöchentliche Claude-Job „Globaler Aktienradar“ schreibt seine Einordnung mit set_radar nach S.fin.radar:
   { asOf, at, doc, items:[{ name, ticker, cat, val, price, cur, zoneLo, zoneHi, target, pe, why, risk, next, held, spec, url, date }] }
   Kategorien: kaufen · kurz (kurz warten) · warten · beobachten · nein (keine Kaufempfehlung).
   Keine Anlageberatung: bedingte Einschätzungen aus dem Radar, Kauf entscheidest du selbst. */
'use strict';
const RAD_CATS = [
  ['kaufen', 'Kaufen prüfenswert', '🟢', 'Einstiegszone erreicht, Bewertung und These passen – gestaffelt prüfen'],
  ['kurz', 'Kurz warten', '🟡', 'Zone fast erreicht oder ein Ereignis steht kurz bevor'],
  ['warten', 'Warten', '🟠', 'auf Rücksetzer oder Klärung warten'],
  ['beobachten', 'Beobachten', '🔵', 'gutes Unternehmen, Preis oder Daten passen noch nicht'],
  ['nein', 'Keine Kaufempfehlung', '⚪', 'meiden: Wertfalle, zu spekulativ oder zu teuer']];
const RAD_VALS = { 'günstig': 'pos', fair: '', teuer: 'neg', unklar: 'd' };
let RADCAT = '', RADCHEAP = false;
function radar() { const F = fin(); F.radar = Object.assign({ items: [], asOf: '', at: '', doc: '' }, F.radar || {}); return F.radar; }
const radCat = c => RAD_CATS.find(x => x[0] === c) || RAD_CATS[3];
const radFmt = (v, cur) => v == null ? '' : v.toLocaleString('de-DE', { maximumFractionDigits: v >= 1000 ? 0 : 2 }) + (cur ? ' ' + cur : '');
function radCalc(it) {
  const up = it.target && it.price ? (it.target / it.price - 1) * 100 : null;
  const dist = it.zoneHi && it.price ? (it.price / it.zoneHi - 1) * 100 : null; // > 0: Kurs liegt noch über der Zone
  const inZone = it.price != null && it.zoneHi != null && it.price <= it.zoneHi * 1.005 && (it.zoneLo == null || it.price >= it.zoneLo * 0.95);
  return { up, dist, inZone };
}
function radarCard() {
  const R = radar(), all = R.items.slice();
  if (!all.length) return `<section class="card wide radar"><h2>📡 Aktienradar<small>noch leer</small></h2><div class="hint">Der Aktienradar (am 1. und 15. des Monats) trägt hier seine Einordnung ein: kaufen, kurz warten, warten, beobachten, keine Empfehlung.</div></section>`;
  const age = R.asOf ? Math.round((Date.now() - Date.parse(R.asOf)) / 864e5) : null;
  const order = c => RAD_CATS.findIndex(x => x[0] === c);
  const L = all.filter(it => (!RADCAT || it.cat === RADCAT) && (!RADCHEAP || it.val === 'günstig'))
    .sort((a, b) => order(a.cat) - order(b.cat) || ((radCalc(b).up || -99) - (radCalc(a).up || -99)));
  const counts = RAD_CATS.map(c => [c, all.filter(it => it.cat === c[0]).length]);
  const cheap = all.filter(it => it.val === 'günstig').length;
  const bar = counts.filter(x => x[1]).map(([c, n]) => `<i class="rc-${c[0]}" style="flex:${n}" title="${esc(c[1])}: ${n}"></i>`).join('');
  return `<section class="card wide radar"><h2>📡 Aktienradar – Ampel<small>${all.length} Aktien${R.asOf ? ' · Stand ' + esc(H.fd(R.asOf.slice(0, 10))) : ''}</small></h2>
    ${age != null && age > 20 ? `<div class="hint warn">Stand ist ${age} Tage alt – Kurse und Zonen können sich verschoben haben.</div>` : ''}
    <div class="rad-bar">${bar}</div>
    <div class="chips"><button class="chip${RADCAT || RADCHEAP ? ' d' : ''}" data-act="radCat" data-v="">Alle</button>${counts.map(([c, n]) => `<button class="chip${RADCAT === c[0] ? '' : ' d'}" data-act="radCat" data-v="${c[0]}">${c[2]} ${esc(c[1])} ${n}</button>`).join('')}<button class="chip${RADCHEAP ? '' : ' d'}" data-act="radCheap">💶 günstig bewertet ${cheap}</button></div>
    ${RADCAT ? `<div class="hint">${esc(radCat(RADCAT)[3])}</div>` : ''}
    ${L.map(it => { const c = radCat(it.cat), k = radCalc(it), i = all.indexOf(it);
      const zone = it.zoneLo != null || it.zoneHi != null ? `Zone ${radFmt(it.zoneLo)}${it.zoneHi != null ? '–' + radFmt(it.zoneHi, it.cur) : ' ' + (it.cur || '')}` : '';
      const pos = k.dist == null ? '' : k.inZone ? '<span class="rad-in">in der Zone</span>' : k.dist > 0 ? `noch ${pct(k.dist).replace('+', '')} über Zone` : '';
      return `<div class="row rad-row"><button class="t" data-act="radOpen" data-i="${i}"><span class="rad-dot">${c[2]}</span><b>${esc(it.name)}</b>${it.ticker ? ` <span class="rad-tk">${esc(it.ticker)}</span>` : ''}${it.held ? ' <span class="chip">im Depot</span>' : ''}${it.spec ? ' <span class="chip d">spekulativ</span>' : ''}
        <small>${[[it.price != null ? radFmt(it.price, it.cur) : '', zone, pos].filter(Boolean).join(' · '), it.why ? esc(it.why) : ''].filter(Boolean).join('<br>')}</small></button>
        <span class="rad-side">${it.val ? `<span class="fin-pill ${RAD_VALS[it.val] || ''}"><b>${esc(it.val)}</b>${it.pe ? `<small>${esc(it.pe)}</small>` : ''}</span>` : ''}${k.up != null ? `<small class="rad-up">Analysten ${pct(k.up)}</small>` : ''}</span></div>`; }).join('') || '<div class="empty">Keine Aktie in dieser Auswahl.</div>'}
    <div class="btns">${R.doc ? `<a class="btn ghost" href="${esc(R.doc)}" target="_blank" rel="noopener">Ganzer Radar-Bericht</a>` : ''}<button class="btn ghost" data-act="radAsk">Mit Odi besprechen</button></div>
    <div class="hint">Einordnung des Claude-Aktienradars, keine Anlageberatung. Zonen und Analystenziele sind bedingte Einschätzungen; kaufe gestaffelt und nur, was zu deinem Plan passt.</div></section>`;
}
function radarDlg(i) {
  const it = radar().items[i]; if (!it) return;
  const c = radCat(it.cat), k = radCalc(it);
  const rows = [['Einordnung', c[2] + ' ' + c[1]], ['Bewertung', [it.val, it.pe].filter(Boolean).join(' · ')], ['Kurs', it.price != null ? radFmt(it.price, it.cur) + (it.date ? ' (' + H.fd(it.date) + ')' : '') : ''],
    ['Einstiegszone', it.zoneLo != null || it.zoneHi != null ? radFmt(it.zoneLo) + '–' + radFmt(it.zoneHi, it.cur) + (k.dist != null ? (k.inZone ? ' · Kurs in der Zone' : ' · Kurs ' + pct(k.dist) + ' zur Obergrenze') : '') : ''],
    ['Analysten-Ziel', it.target ? radFmt(it.target, it.cur) + (k.up != null ? ' · Potenzial ' + pct(k.up) : '') : ''], ['These', it.why], ['Größtes Risiko', it.risk], ['Nächstes Ereignis', it.next]].filter(r => r[1]);
  openDlg(`<h3>${esc(it.name)}${it.ticker ? ' · ' + esc(it.ticker) : ''}</h3>
    ${rows.map(r => `<p><b>${r[0]}:</b> ${esc(r[1])}</p>`).join('')}
    ${it.url ? `<p><a href="${esc(it.url)}" target="_blank" rel="noopener">Quelle / Radar-Bericht</a></p>` : ''}
    <div class="hint">${esc(c[3])}. Keine Anlageberatung.</div>
    <div class="btns"><button class="btn" value="odi">Mit Odi prüfen</button><button class="btn ghost" value="cancel" formnovalidate>Schließen</button></div>`, v => {
    if (v !== 'odi') return;
    chatDraft = `Prüfe bitte ${it.name}${it.ticker ? ' (' + it.ticker + ')' : ''} für mich: Passt die Radar-Einordnung „${c[1]}“ noch zum aktuellen Kurs, wie gestaffelt würde ein Einstieg zu meinem Depot passen (Klumpenrisiko Tech), und was spricht dagegen? Keine Käufe ausführen.`;
    TAB = 'chat'; render(); const el = $('chatIn'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
  });
}
function radarAct(act, b) {
  if (act === 'radCat') { RADCAT = b.dataset.v || ''; if (!RADCAT) RADCHEAP = false; render(); return true; }
  if (act === 'radCheap') { RADCHEAP = !RADCHEAP; render(); return true; }
  if (act === 'radOpen') { radarDlg(Number(b.dataset.i)); return true; }
  if (act === 'radAsk') { chatDraft = 'Welche Aktien aus meinem Radar sind gerade am attraktivsten, und wie würde ein gestaffelter Einstieg zu meinem Depot passen? '; TAB = 'chat'; render(); const el = $('chatIn'); if (el) el.focus(); return true; }
  return false;
}
/* Werkzeug für Claude-Jobs und Odi */
function radarTool(name, x) {
  if (name !== 'set_radar') return null;
  const items = Array.isArray(x.items) ? x.items : [];
  if (!items.length) throw new Error('items fehlt');
  const cats = RAD_CATS.map(c => c[0]), n = v => (v == null || v === '' ? null : num(v));
  const clean = items.slice(0, 40).map(it => ({ name: String(it.name || '').slice(0, 60), ticker: String(it.ticker || '').slice(0, 20), cat: cats.includes(it.cat) ? it.cat : 'beobachten',
    val: RAD_VALS.hasOwnProperty(it.val) ? it.val : (it.val ? 'unklar' : ''), price: n(it.price), cur: String(it.cur || '').slice(0, 4), zoneLo: n(it.zoneLo), zoneHi: n(it.zoneHi), target: n(it.target),
    pe: String(it.pe || '').slice(0, 40), why: String(it.why || '').slice(0, 220), risk: String(it.risk || '').slice(0, 160), next: String(it.next || '').slice(0, 100),
    held: !!it.held, spec: !!it.spec, url: String(it.url || '').slice(0, 300), date: /^\d{4}-\d{2}-\d{2}$/.test(it.date || '') ? it.date : '' })).filter(it => it.name);
  const R = radar();
  if (x.replace === false) clean.forEach(it => { const j = R.items.findIndex(o => o.name.toLowerCase() === it.name.toLowerCase()); if (j >= 0) R.items[j] = it; else R.items.push(it); });
  else R.items = clean;
  R.asOf = /^\d{4}-\d{2}-\d{2}/.test(x.asOf || '') ? x.asOf.slice(0, 10) : H.today(); R.at = new Date().toISOString(); if (x.doc) R.doc = String(x.doc).slice(0, 300);
  return { label: '📡 Aktienradar: ' + clean.length + ' Aktien eingeordnet', result: 'gespeichert' };
}
const RADAR_TOOLS = [{ name: 'set_radar', description: 'Aktienradar-Ampel in den Finanzen setzen: je Aktie Kategorie (kaufen | kurz | warten | beobachten | nein), Bewertung (günstig | fair | teuer | unklar), Kurs, Einstiegszone, Analysten-Kursziel. replace=false ergänzt statt ersetzt.',
  input_schema: { type: 'object', additionalProperties: false, required: ['items'], properties: { asOf: { type: 'string', description: 'Kursdatenstand JJJJ-MM-TT' }, doc: { type: 'string', description: 'Link zum Radar-Bericht' }, replace: { type: 'boolean' },
    items: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'cat'], properties: { name: { type: 'string' }, ticker: { type: 'string' }, cat: { type: 'string', enum: ['kaufen', 'kurz', 'warten', 'beobachten', 'nein'] }, val: { type: 'string', enum: ['günstig', 'fair', 'teuer', 'unklar'] },
      price: { type: 'number' }, cur: { type: 'string' }, zoneLo: { type: 'number' }, zoneHi: { type: 'number' }, target: { type: 'number', description: 'mittleres Analysten-Kursziel, gleiche Währung' }, pe: { type: 'string', description: 'z. B. „Fwd-KGV 16,9“' },
      why: { type: 'string' }, risk: { type: 'string' }, next: { type: 'string' }, held: { type: 'boolean' }, spec: { type: 'boolean' }, url: { type: 'string' }, date: { type: 'string' } } } } } } }];
function radarSnapshotText() { const R = radar(); return R.items.length ? JSON.stringify({ stand: R.asOf, aktien: R.items.map(it => [it.name, radCat(it.cat)[1], it.val, it.price != null ? radFmt(it.price, it.cur) : '', it.zoneHi != null ? 'Zone bis ' + radFmt(it.zoneHi, it.cur) : '']) }) : '{}'; }
