/* Lebenshub – Girokonto: CSV-Export der Sparkasse (CSV-CAMT / CSV-MT940) und ähnlicher Banken importieren.
   Läuft komplett im Browser: kein Upload an Claude, keine Tokens.
   Datenschutz: IBAN, BIC, Kontonummer, Mandats-/Gläubiger-Referenzen und Verwendungszweck werden NICHT gespeichert.
   Gegenüber nur, wenn er wie ein Unternehmen/Händler aussieht – Namen von Privatpersonen werden zu „Privat“.
   S.fin.tx = [{h, d, a, c, p, k}]  (h = Prüfsumme gegen Doppelimporte, d = Datum, a = Betrag €, c = Kategorie, p = Gegenüber, k = Buchungsart) */
'use strict';
const BANK_MAX = 900;
const BANK_CATS = [
  ['einkommen', 'Einkommen', '#0e9f6e'], ['wohnen', 'Wohnen & Energie', '#2f8fdd'], ['lebensmittel', 'Lebensmittel', '#67b26f'],
  ['mobil', 'Mobilität', '#e67e22'], ['vers', 'Versicherungen', '#8e44ad'], ['abo', 'Abos & Verträge', '#e0457b'],
  ['shopping', 'Shopping', '#f1c40f'], ['essen', 'Essen & Freizeit', '#16a085'], ['gesundheit', 'Gesundheit & Sport', '#c0392b'],
  ['sparen', 'Sparen & Anlage', '#0e7c66'], ['bar', 'Bargeld', '#7f8c8d'], ['transfer', 'Umbuchung', '#95a5a6'], ['sonst', 'Sonstiges', '#bdc3c7']
];
const BANK_RULES = [
  ['einkommen', /\b(lohn|gehalt|bez(ü|ue)ge|entgelt|verg(ü|ue)tung|kindergeld|erstattung finanzamt|steuererstattung)\b/i],
  ['sparen', /trade republic|comdirect|trading ?212|scalable|consorsbank|flatex|ing-?diba|depot|sparplan|wertpapier|tagesgeld|bausparkasse|bausparen/i],
  ['vers', /versicherung|allianz|huk|ergo\b|debeka|axa|signal iduna|devk|r\+v|generali|barmenia|haftpflicht|krankenkasse|aok|techniker|tk\b|barmer|dak\b/i],
  ['abo', /netflix|spotify|disney|dazn|sky\b|prime video|amazon prime|apple\.com|itunes|google \*|youtube|microsoft|adobe|chatgpt|openai|anthropic|claude|icloud|mobilfunk|telekom|vodafone|o2\b|telefonica|1&1|congstar|rundfunk|gez|beitragsservice|fitx|mcfit|urban sports|fitnessstudio|clever fit|zeitung|abo\b/i],
  ['wohnen', /miete|hausverwaltung|wohnungsbau|stadtwerke|strom|gas\b|energie|n-ergie|e\.on|eon\b|enbw|vattenfall|wasser|nebenkosten|grundsteuer|ikea|baumarkt|obi\b|hornbach|bauhaus/i],
  ['lebensmittel', /rewe|edeka|aldi|lidl|netto|kaufland|penny|norma|tegut|globus|real\b|denns|alnatura|metzgerei|b(ä|ae)ckerei|backhaus|getr(ä|ae)nke/i],
  ['mobil', /aral|shell|esso|jet\b|total(energies)?|agip|avia|tankstelle|tank|deutsche bahn|db vertrieb|db fernverkehr|bahn\b|vgn|mvg|flixbus|deutschlandticket|parken|parkhaus|kfz|autohaus|werkst|t(ü|ue)v|dekra|adac|sixt|uber\b|bolt\b|ladestation|enbw mobility|ionity/i],
  ['gesundheit', /apotheke|arzt|(ä|ae)rzt|praxis|physio|zahnarzt|klinik|krankenhaus|optik|fielmann|dm-?drogerie|dm\b|rossmann|m(ü|ue)ller drog|sport|decathlon|intersport/i],
  ['essen', /restaurant|lieferando|wolt|mcdonald|burger king|kfc|subway|starbucks|caf(e|é)|bar\b|pizza|imbiss|kino|cinema|eventim|ticket|bistro|gasthof|gasthaus|biergarten/i],
  ['shopping', /amazon|zalando|otto\b|mediamarkt|saturn|ebay|paypal|klarna|h&m|zara|primark|about you|apple store|galaxus|cyberport|notebooksbilliger|kleinanzeigen/i],
  ['bar', /bargeld|geldautomat|auszahlung|\bga\b|bargeldauszahlung|cash/i],
  ['transfer', /umbuchung|übertrag|uebertrag|eigene(s)? konto|dauerauftrag an mich/i]
];
const BANK_CO = /\b(gmbh|mbh|ag|se|kg|ohg|ug|e\.? ?v\.?|ltd|inc|llc|b\.?v\.?|s\.?a\.?|sarl|plc|bank|sparkasse|volksbank|raiffeisen|versicherung|stadtwerke|apotheke|markt|tankstelle|verlag|service|services|europe|deutschland|online|shop|store|holding|group)\b/i;
function bank() { const F = fin(); if (!Array.isArray(F.tx)) F.tx = []; if (!Array.isArray(F.txImports)) F.txImports = []; return F; }
const bankCat = k => BANK_CATS.find(c => c[0] === k) || BANK_CATS[BANK_CATS.length - 1];
function bankHash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); }
function bankDecode(buf) {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch (e) { return new TextDecoder('windows-1252').decode(buf); }
}
function bankRows(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const hi = lines.findIndex(l => /buchung|datum/i.test(l) && /betrag|umsatz/i.test(l));
  if (hi < 0) return null;
  const sep = (lines[hi].match(/;/g) || []).length >= (lines[hi].match(/,/g) || []).length ? ';' : ',';
  const parse = l => { const out = []; let cur = '', q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (q) { if (ch === '"') { if (l[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; } else if (ch === '"') q = true; else if (ch === sep) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map(s => s.trim()); };
  const head = parse(lines[hi]).map(s => s.toLowerCase());
  const col = re => head.findIndex(h => re.test(h));
  const c = { d: col(/^buchungs(tag|datum)$|^datum$|buchungstag/), a: col(/^betrag|umsatz in|^betrag \(|^umsatz$/), p: col(/beg(ü|ue)nstigter|zahlungspflichtiger|empf(ä|ae)nger|auftraggeber|^name/), t: col(/verwendungszweck/), k: col(/buchungstext|umsatzart|vorgang/), info: col(/^info$/) };
  if (c.d < 0 || c.a < 0) return null;
  const rows = [];
  for (const l of lines.slice(hi + 1)) {
    if (!l.trim()) continue;
    const f = parse(l); if (f.length < 2) continue;
    if (c.info >= 0 && /vorgemerkt|nicht ausgef/i.test(f[c.info] || '')) continue;
    rows.push({ d: f[c.d] || '', a: f[c.a] || '', p: c.p >= 0 ? f[c.p] || '' : '', t: c.t >= 0 ? f[c.t] || '' : '', k: c.k >= 0 ? f[c.k] || '' : '' });
  }
  return rows;
}
function bankDate(s) {
  let m = String(s).match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'); }
  m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : '';
}
function bankAmt(s) { const v = parseFloat(String(s).replace(/[^\d,.\-+]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isFinite(v) ? Math.round(v * 100) / 100 : null; }
function bankPayee(raw, cat) {
  let p = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!p) return '';
  p = p.replace(/\b(sagt danke|danke|\/\/.*$|\d{3,}.*$)/gi, '').replace(/\s+/g, ' ').trim();
  const companyLike = BANK_CO.test(p) || (p === p.toUpperCase() && /[A-Z]{3,}/.test(p) && !/,/.test(raw)) || BANK_RULES.some(r => r[1].test(p));
  if (!companyLike) return cat === 'einkommen' ? 'Arbeitgeber/Zahler' : 'Privat';
  return p.slice(0, 40);
}
function bankCategorize(r, amt) {
  const all = r.p + ' ' + r.k + ' ' + r.t;
  for (const [k, re] of BANK_RULES) { if (re.test(all)) { if (k === 'einkommen' && amt < 0) continue; return k; } }
  return amt > 0 ? 'einkommen' : 'sonst';
}
function bankImportText(text) {
  const rows = bankRows(text);
  if (!rows) throw new Error('Keine Umsatz-CSV erkannt (Spalten „Buchungstag“ und „Betrag“ fehlen).');
  const F = bank(), have = new Set(F.tx.map(t => t.h));
  let n = 0, dup = 0, from = '', to = '';
  for (const r of rows) {
    const d = bankDate(r.d), a = bankAmt(r.a); if (!d || a == null) continue;
    const h = bankHash(d + '|' + a + '|' + r.p + '|' + r.t + '|' + r.k);
    if (have.has(h)) { dup++; continue; }
    const c = bankCategorize(r, a);
    F.tx.push({ h, d, a, c, p: bankPayee(r.p, c), k: String(r.k || '').replace(/\s+/g, ' ').slice(0, 30) });
    have.add(h); n++; from = !from || d < from ? d : from; to = d > to ? d : to;
  }
  F.tx.sort((x, y) => y.d.localeCompare(x.d)); F.tx = F.tx.slice(0, BANK_MAX);
  F.txImports.unshift({ at: new Date().toISOString(), n, dup, from, to }); F.txImports = F.txImports.slice(0, 12);
  return { n, dup, from, to };
}
async function bankImportFiles(files) {
  let tot = 0, dup = 0, err = '';
  for (const f of files) {
    try { const r = bankImportText(bankDecode(await f.arrayBuffer())); tot += r.n; dup += r.dup; }
    catch (e) { err = f.name + ': ' + e.message; }
  }
  if (tot || dup) { bankMonth = ''; save(tot + ' Umsätze importiert' + (dup ? ', ' + dup + ' schon vorhanden' : '') + ' – ohne IBAN und Verwendungszweck.'); }
  else toast(err || 'Keine Umsätze gefunden.');
  return tot;
}
function bankLooksLike(f) { return /\.csv$/i.test(f.name) || /csv/.test(f.type || ''); }
/* ---------- Auswertung ---------- */
let bankMonth = '';
function bankMonths() { return [...new Set(bank().tx.map(t => t.d.slice(0, 7)))].sort().reverse(); }
function bankStats(m) {
  const T = bank().tx.filter(t => t.d.startsWith(m) && t.c !== 'transfer');
  const inc = T.filter(t => t.a > 0 && t.c !== 'sparen').reduce((s, t) => s + t.a, 0);
  const save_ = -T.filter(t => t.c === 'sparen').reduce((s, t) => s + t.a, 0);
  const out = -T.filter(t => t.a < 0 && t.c !== 'sparen').reduce((s, t) => s + t.a, 0);
  const byCat = {}; T.filter(t => t.a < 0 && t.c !== 'sparen').forEach(t => { byCat[t.c] = (byCat[t.c] || 0) - t.a; });
  const byP = {}; T.filter(t => t.a < 0 && t.p && t.p !== 'Privat').forEach(t => { byP[t.p] = (byP[t.p] || 0) - t.a; });
  return { inc, out, save: save_, net: inc - out - save_, rate: inc ? (inc - out) / inc * 100 : null, byCat, byP, n: T.length };
}
function bankRecurring() {
  const G = {};
  bank().tx.filter(t => t.a < 0 && t.p && t.p !== 'Privat' && !['lebensmittel', 'shopping', 'essen', 'bar', 'transfer', 'mobil'].includes(t.c)).forEach(t => { (G[t.p] = G[t.p] || []).push(t); });
  const items = (typeof life === 'function' ? life().items : []).map(i => i.name.toLowerCase());
  return Object.entries(G).map(([p, L]) => {
    const months = new Set(L.map(t => t.d.slice(0, 7))); if (months.size < 2) return null;
    const amts = L.map(t => -t.a).sort((x, y) => x - y), med = amts[Math.floor(amts.length / 2)];
    if (amts.filter(v => Math.abs(v - med) <= med * 0.15).length < 2) return null;
    return { p, amt: Math.round(med * 100) / 100, c: L[0].c, months: months.size, known: items.some(n => n.includes(p.toLowerCase().split(' ')[0]) || p.toLowerCase().includes(n.split(' ')[0])) };
  }).filter(Boolean).sort((x, y) => y.amt - x.amt).slice(0, 12);
}
function bankSummaryText() {
  const M = bankMonths(); if (!M.length) return '';
  const s = bankStats(M[0]);
  return JSON.stringify({ girokonto_monat: M[0], einnahmen: Math.round(s.inc), ausgaben: Math.round(s.out), sparen_anlage: Math.round(s.save), sparquote: s.rate == null ? null : Math.round(s.rate), kategorien: Object.fromEntries(Object.entries(s.byCat).map(([k, v]) => [bankCat(k)[1], Math.round(v)])), wiederkehrend: bankRecurring().slice(0, 8).map(r => [r.p, r.amt]) });
}
function bankCard() {
  const M = bankMonths(), F = bank();
  const imp = `<div class="btns"><button class="btn" data-act="bankImp">📥 Sparkassen-CSV importieren</button>${M.length ? '<button class="btn ghost warn" data-act="bankClear">Umsätze löschen</button>' : ''}</div>`;
  if (!M.length) return `<section class="card wide bank"><h2>Girokonto · Umsätze</h2><div class="hint">Sparkassen-App oder Online-Banking → Umsätze → Export „CSV-CAMT“ (oder CSV-MT940) → hier importieren. Alles bleibt in deinem Hub; IBAN, Kontonummern und Verwendungszwecke werden nicht gespeichert, Privatpersonen erscheinen als „Privat“.</div>${imp}</section>`;
  const m = M.includes(bankMonth) ? bankMonth : M[0], s = bankStats(m);
  const cats = Object.entries(s.byCat).sort((a, b) => b[1] - a[1]), max = cats.length ? cats[0][1] : 1;
  const top = Object.entries(s.byP).sort((a, b) => b[1] - a[1]).slice(0, 5), rec = bankRecurring(), last = F.txImports[0];
  const mName = x => new Date(x + '-01T12:00:00').toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
  return `<section class="card wide bank"><h2>Girokonto · Umsätze<small>${last ? 'Import ' + H.fdy(last.at.slice(0, 10)) : ''}</small></h2>
    <div class="fin-range">${M.slice(0, 6).map(x => `<button class="chip ${x === m ? '' : 'd'}" data-act="bankM" data-v="${x}">${esc(mName(x))}</button>`).join('')}</div>
    ${finKpis([['Einnahmen', eur(s.inc, 0), 'pos'], ['Ausgaben', eur(s.out, 0), 'neg'], ['Sparen & Anlage', eur(s.save, 0)], ['Sparquote', s.rate == null ? '–' : Math.round(s.rate) + ' %', s.rate != null && s.rate >= 0 ? 'pos' : 'neg']])}
    <div class="bank-cats">${cats.map(([k, v]) => { const c = bankCat(k); return `<div class="bank-c"><span>${esc(c[1])}</span><i style="width:${(v / max * 100).toFixed(1)}%;background:${c[2]}"></i><b>${eur(v, 0)}</b></div>`; }).join('')}</div>
    ${top.length ? `<h3 class="cal-h">Größte Empfänger</h3>${top.map(([p, v]) => `<div class="row"><span>${esc(p)}</span><span class="fin-v">${eur(v, 0)}</span></div>`).join('')}` : ''}
    ${rec.length ? `<h3 class="cal-h">Wiederkehrende Abbuchungen</h3>${rec.map(r => `<div class="row"><span>${esc(r.p)}<small> · ${esc(bankCat(r.c)[1])} · ${r.months} Monate</small></span><span class="fin-v">${eur(r.amt)}${r.known ? ' <small>✓ erfasst</small>' : ` <button class="chip" data-act="bankRec" data-v="${esc(r.p)}" data-a="${r.amt}" data-c="${r.c}">→ Fixkosten</button>`}</span></div>`).join('')}` : ''}
    <div class="hint">${F.tx.length} Umsätze gespeichert (ohne IBAN/Verwendungszweck). Neue CSV einfach erneut importieren – Doppelte werden erkannt.</div>${imp}</section>`;
}
function bankAct(act, b) {
  if (act === 'bankImp') { const i = document.getElementById('bankFile'); if (i) i.click(); return true; }
  if (act === 'bankM') { bankMonth = b.dataset.v; render(); return true; }
  if (act === 'bankRec') {
    const cat = { vers: 'vers', wohnen: 'wohnen', mobil: 'mobil', sparen: 'vorsorge' }[b.dataset.c] || 'vertrag';
    if (typeof lifeTool === 'function') { lifeTool('set_contract', { name: b.dataset.v, provider: b.dataset.v, cost: +b.dataset.a, per: 'monat', cat, status: 'aktiv', note: 'Aus Kontoumsätzen erkannt' }); save('„' + b.dataset.v + '“ unter Fixkosten & Abos eingetragen'); }
    return true;
  }
  if (act === 'bankClear') { if (confirm('Alle importierten Kontoumsätze aus dem Hub löschen?')) { const F = bank(); F.tx = []; F.txImports = []; save('Umsätze gelöscht'); } return true; }
  return false;
}
document.addEventListener('change', e => {
  if (e.target.id === 'bankFile' && e.target.files.length) { const fl = Array.from(e.target.files); e.target.value = ''; bankImportFiles(fl); }
});
