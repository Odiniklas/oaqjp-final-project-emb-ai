/* Lebenshub – Finanzen: Konten, Depots, Positionen, Vermögensverlauf.
   Daten in S.fin = { accounts:[{id,name,broker,kind,cash,asOf}], positions:[{id,acc,name,isin,qty,buy,price,date}], history:[{d,total,depot,cash,acc:{id:wert}}] }
   Kurse kommen wöchentlich über einen Claude-Job (Abo) oder per Hand/Assistent. Alle Beträge in EUR. */
'use strict';
const ACC_KINDS = ['Depot', 'Girokonto', 'Tagesgeld', 'Verrechnungskonto'];
function fin() {
  if (!S.fin) S.fin = { accounts: [], positions: [], history: [] };
  ['accounts', 'positions', 'history'].forEach(k => { if (!Array.isArray(S.fin[k])) S.fin[k] = []; });
  return S.fin;
}
const num = v => { const n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isFinite(n) ? n : null; };
const eur = (v, d) => v == null ? '–' : v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: d == null ? 2 : d });
const pct = v => v == null || !isFinite(v) ? '' : (v > 0 ? '+' : '') + v.toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + ' %';
function posValue(p) { return p.qty != null && p.price != null ? p.qty * p.price : null; }
function posPL(p) { const v = posValue(p); return v != null && p.buy != null && p.qty ? { abs: v - p.qty * p.buy, rel: (p.price / p.buy - 1) * 100 } : null; }
function accValue(a) {
  const ps = fin().positions.filter(p => p.acc === a.id);
  const dep = ps.reduce((s, p) => s + (posValue(p) || 0), 0);
  return { depot: dep, cash: num(a.cash) || 0, total: dep + (num(a.cash) || 0), n: ps.length };
}
function finTotals() {
  const F = fin(), acc = {};
  let depot = 0, cash = 0;
  F.accounts.forEach(a => { const v = accValue(a); acc[a.id] = Math.round(v.total * 100) / 100; depot += v.depot; cash += v.cash; });
  return { total: depot + cash, depot, cash, acc };
}
/* Tagesstand festhalten (ein Eintrag pro Tag, der jüngste gewinnt) */
function finSnapshot(d) {
  const F = fin(), t = finTotals(), day = /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : H.today();
  if (!F.accounts.length) return;
  F.history = F.history.filter(h => h.d !== day).concat([{ d: day, total: Math.round(t.total * 100) / 100, depot: Math.round(t.depot * 100) / 100, cash: Math.round(t.cash * 100) / 100, acc: t.acc }])
    .sort((a, b) => a.d.localeCompare(b.d)).slice(-260);
}
function findAcc(name) {
  const F = fin(), q = String(name || '').toLowerCase().trim();
  return F.accounts.find(a => a.id === name) || F.accounts.find(a => a.name.toLowerCase() === q) || F.accounts.find(a => q && (a.name.toLowerCase().includes(q) || q.includes(a.name.toLowerCase())));
}
function findPos(accId, key) {
  const q = String(key || '').toLowerCase().trim();
  return fin().positions.find(p => (!accId || p.acc === accId) && (p.id === key || (p.isin && p.isin.toLowerCase() === q) || p.name.toLowerCase() === q));
}

/* ---------- Werkzeuge für Assistent, Abo-Modus und Claude-Jobs ---------- */
function finTool(name, x) {
  const F = fin(), date = d => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : H.today());
  if (name === 'set_account') {
    let a = findAcc(x.id || x.name);
    if (!a) { a = { id: uid(), name: String(x.name || 'Konto').trim(), broker: '', kind: 'Depot', cash: null, asOf: '' }; F.accounts.push(a); }
    if (x.name) a.name = String(x.name).trim();
    if (x.broker != null) a.broker = String(x.broker);
    if (ACC_KINDS.includes(x.kind)) a.kind = x.kind;
    if (x.cash != null && num(x.cash) != null) { a.cash = num(x.cash); a.asOf = date(x.asOf); }
    finSnapshot(x.asOf);
    return { label: '🏦 ' + a.name + (a.cash != null ? ': ' + eur(a.cash) : ''), result: 'Konto gespeichert, id=' + a.id };
  }
  if (name === 'set_position') {
    const a = findAcc(x.account);
    if (!a) throw new Error('Konto „' + (x.account || '') + '“ nicht gefunden – zuerst set_account');
    let p = findPos(a.id, x.isin || x.name) || (x.id && findPos(a.id, x.id));
    if (!p) { p = { id: uid(), acc: a.id, name: String(x.name || x.isin || 'Position').trim(), isin: '', qty: null, buy: null, price: null, date: '' }; F.positions.push(p); }
    if (x.name) p.name = String(x.name).trim();
    if (x.isin) p.isin = String(x.isin).toUpperCase();
    ['qty', 'buy', 'price'].forEach(k => { const src = k === 'buy' ? x.buyPrice : x[k]; if (src != null && num(src) != null) p[k] = num(src); });
    if (x.price != null) p.date = date(x.priceDate || x.date);
    finSnapshot(x.priceDate || x.date);
    return { label: '📈 ' + p.name + ' (' + a.name + ')' + (posValue(p) != null ? ': ' + eur(posValue(p)) : ''), result: 'Position gespeichert, id=' + p.id };
  }
  if (name === 'remove_position') {
    const a = findAcc(x.account), p = findPos(a && a.id, x.id || x.isin || x.name);
    if (!p) throw new Error('Position nicht gefunden');
    F.positions = F.positions.filter(y => y !== p); finSnapshot();
    return { label: '− ' + p.name, result: 'entfernt' };
  }
  if (name === 'set_prices') {
    const list = Array.isArray(x.prices) ? x.prices : [];
    let n = 0, d = '';
    list.forEach(e => {
      const pr = num(e.price); if (pr == null) return;
      fin().positions.filter(p => p.id === e.id || (e.isin && p.isin && p.isin.toUpperCase() === String(e.isin).toUpperCase()) || (e.name && p.name.toLowerCase() === String(e.name).toLowerCase()))
        .forEach(p => { p.price = pr; p.date = date(e.date); d = p.date > d ? p.date : d; n++; });
    });
    finSnapshot(d || H.today());
    return { label: '💹 Kurse aktualisiert: ' + n + ' Position(en), Vermögen ' + eur(finTotals().total, 0), result: n + ' aktualisiert' };
  }
  return null;
}
const FIN_TOOLS = [
  { name: 'set_account', description: 'Konto oder Depot anlegen/ändern (z. B. Trade Republic Depot, comdirect Girokonto). cash = Kontostand bzw. Depot-Guthaben in EUR, asOf = Stichtag.',
    input_schema: { type: 'object', additionalProperties: false, required: ['name'], properties: { name: { type: 'string' }, broker: { type: 'string' }, kind: { type: 'string', enum: ACC_KINDS }, cash: { type: 'number' }, asOf: { type: 'string', description: 'JJJJ-MM-TT' } } } },
  { name: 'set_position', description: 'Wertpapier-Position in einem Depot anlegen/ändern: Stückzahl, Einstandskurs (buyPrice), aktueller Kurs (price) in EUR.',
    input_schema: { type: 'object', additionalProperties: false, required: ['account', 'name'], properties: { account: { type: 'string', description: 'Name des Depots' }, name: { type: 'string' }, isin: { type: 'string' }, qty: { type: 'number' }, buyPrice: { type: 'number' }, price: { type: 'number' }, priceDate: { type: 'string', description: 'JJJJ-MM-TT' } } } },
  { name: 'remove_position', description: 'Position aus einem Depot entfernen (nur auf ausdrücklichen Wunsch oder bei Verkauf).',
    input_schema: { type: 'object', additionalProperties: false, required: ['account', 'name'], properties: { account: { type: 'string' }, name: { type: 'string' } } } },
  { name: 'set_prices', description: 'Aktuelle Kurse (EUR) für Positionen eintragen; speichert automatisch einen Depotstand für den Verlauf.',
    input_schema: { type: 'object', additionalProperties: false, required: ['prices'], properties: { prices: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, isin: { type: 'string' }, price: { type: 'number' }, date: { type: 'string' } }, required: ['price'] } } } } }
];
function finSnapshotText() {
  const F = fin();
  if (!F.accounts.length) return 'keine Konten erfasst';
  return JSON.stringify({ konten: F.accounts.map(a => [a.name, a.kind, a.cash, a.asOf]), positionen: F.positions.map(p => [(findAcc(p.acc) || {}).name, p.name, p.isin, p.qty, p.buy, p.price, p.date]),
    gesamt: Math.round(finTotals().total), verlauf: F.history.slice(-6).map(h => [h.d, Math.round(h.total)]) });
}

/* ---------- Ansicht ---------- */
function finChart(hist) {
  const pts = hist.filter(h => h.total != null);
  if (pts.length < 2) return '<div class="hint">Der Verlauf erscheint, sobald mindestens zwei Stände gespeichert sind (z. B. nach dem wöchentlichen Kurs-Update).</div>';
  const W = 600, Hh = 150, pad = 6, ys = pts.map(p => p.total), mn = Math.min(...ys), mx = Math.max(...ys), rng = mx - mn || 1;
  const t0 = H.P(pts[0].d).getTime(), t1 = H.P(pts[pts.length - 1].d).getTime() || t0 + 1;
  const X = d => pad + (W - 2 * pad) * ((H.P(d).getTime() - t0) / ((t1 - t0) || 1)), Y = v => pad + (Hh - 2 * pad) * (1 - (v - mn) / rng);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + X(p.d).toFixed(1) + ' ' + Y(p.total).toFixed(1)).join(' ');
  const last = pts[pts.length - 1], up = last.total >= pts[0].total;
  return `<svg class="chart ${up ? 'up' : 'down'}" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" role="img" aria-label="Vermögensverlauf">
    <path class="area" d="${line} L ${X(last.d).toFixed(1)} ${Hh} L ${X(pts[0].d).toFixed(1)} ${Hh} Z"/><path class="ln" d="${line}"/>
    <circle cx="${X(last.d).toFixed(1)}" cy="${Y(last.total).toFixed(1)}" r="4"/></svg>
    <div class="axis"><span>${H.fdy(pts[0].d)}</span><span>${eur(mn, 0)} – ${eur(mx, 0)}</span><span>${H.fdy(last.d)}</span></div>`;
}
function finView() {
  const F = fin(), t = finTotals(), h = F.history;
  const prev = h.length > 1 ? h[h.length - 2] : null, last = h[h.length - 1];
  const delta = prev && last ? last.total - prev.total : null;
  let out = `<section class="card wide fin-hero"><div class="fin-label">Gesamtvermögen</div>
    <div class="fin-total">${F.accounts.length ? eur(t.total) : '–'}</div>
    ${delta != null ? `<div class="fin-delta ${delta >= 0 ? 'pos' : 'neg'}">${delta >= 0 ? '▲' : '▼'} ${eur(Math.abs(delta))} (${pct(prev.total ? delta / prev.total * 100 : null)}) seit ${H.fdy(prev.d)}</div>` : ''}
    ${finChart(h)}
    <div class="fin-split"><span>Wertpapiere <b>${eur(t.depot, 0)}</b></span><span>Guthaben <b>${eur(t.cash, 0)}</b></span></div>
    ${!F.accounts.length ? '<div class="hint">Noch keine Konten. Leg Trade Republic und comdirect an – oder schick dem Assistenten Screenshots deiner Depot- und Kontoübersicht, er trägt alles ein.</div>' : ''}
    <div class="btns"><button class="btn ghost" data-act="facc">+ Konto / Depot</button>${F.accounts.length ? '<button class="btn ghost" data-act="fsnap">Stand speichern</button>' : ''}</div></section>`;
  F.accounts.forEach(a => {
    const v = accValue(a), ps = F.positions.filter(p => p.acc === a.id).sort((x, y) => (posValue(y) || 0) - (posValue(x) || 0));
    const pl = ps.reduce((s, p) => { const q = posPL(p); return q ? { abs: s.abs + q.abs, cost: s.cost + p.qty * p.buy } : s; }, { abs: 0, cost: 0 });
    out += `<section class="card"><h2><button class="t" data-act="facc" data-id="${a.id}">${esc(a.name)}<small>${esc([a.kind, a.broker].filter(Boolean).join(' · '))}</small></button><span class="fin-acc">${eur(v.total)}</span></h2>
      ${pl.cost ? `<div class="fin-delta ${pl.abs >= 0 ? 'pos' : 'neg'}">${pl.abs >= 0 ? '+' : '−'}${eur(Math.abs(pl.abs))} (${pct(pl.abs / pl.cost * 100)}) seit Kauf</div>` : ''}
      ${ps.map(p => { const q = posPL(p); return `<div class="row"><button class="t" data-act="fpos" data-id="${p.id}">${esc(p.name)}<small>${p.qty != null ? p.qty.toLocaleString('de-DE') + ' Stk.' : 'Stückzahl fehlt'}${p.price != null ? ' · ' + eur(p.price) : ''}${p.date ? ' · ' + H.fd(p.date) : ''}</small></button><span class="fin-v">${eur(posValue(p))}${q ? `<small class="${q.rel >= 0 ? 'pos' : 'neg'}">${pct(q.rel)}</small>` : ''}</span></div>`; }).join('')}
      ${a.kind === 'Depot' || ps.length ? `<div class="kv"><span>Guthaben</span><span>${eur(num(a.cash))}</span></div>` : `<div class="kv"><span>Stand</span><span>${a.asOf ? H.fdy(a.asOf) : '–'}</span></div>`}
      ${a.kind === 'Depot' ? `<div class="btns"><button class="btn ghost" data-act="fpos" data-acc="${a.id}">+ Position</button></div>` : ''}</section>`;
  });
  return out;
}
function editAccount(id) {
  const F = fin(), a = id ? F.accounts.find(x => x.id === id) : null, isNew = !a;
  openDlg(`<h3>${isNew ? 'Neues Konto / Depot' : esc(a.name)}</h3>
    <label class="f">Name<input type="text" name="n" value="${esc(a ? a.name : '')}" required placeholder="z. B. Trade Republic Depot"></label>
    <div class="f2"><label class="f">Art<select name="k">${ACC_KINDS.map(k => `<option ${a && a.kind === k ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
    <label class="f">Anbieter<input type="text" name="b" value="${esc(a ? a.broker : '')}" placeholder="Trade Republic"></label></div>
    <div class="f2"><label class="f">Guthaben (€)<input type="text" inputmode="decimal" name="c" value="${a && a.cash != null ? String(a.cash).replace('.', ',') : ''}"></label>
    <label class="f">Stichtag<input type="date" name="d" value="${esc(a && a.asOf || H.today())}"></label></div>
    <div class="hint">Keine IBAN oder Kontonummern eintragen.</div>${dlgBtns(!isNew)}`, (v, f) => {
    if (v === 'del') { askConfirm('„' + a.name + '“ samt Positionen löschen?', 'Löschen').then(ok => { if (ok) { F.accounts = F.accounts.filter(x => x !== a); F.positions = F.positions.filter(p => p.acc !== a.id); finSnapshot(); save('Gelöscht'); } }); return; }
    finTool('set_account', { id: a && a.id, name: f.n.value, kind: f.k.value, broker: f.b.value, cash: f.c.value === '' ? null : f.c.value, asOf: f.d.value });
    if (a && f.c.value === '') a.cash = null;
    save('Gespeichert');
  });
}
function editPosition(id, accId) {
  const F = fin(), p = id ? F.positions.find(x => x.id === id) : null, acc = F.accounts.find(a => a.id === (p ? p.acc : accId));
  if (!acc) return;
  const n2 = v => (v == null ? '' : String(v).replace('.', ','));
  openDlg(`<h3>${p ? esc(p.name) : 'Neue Position'}</h3><div class="hint">${esc(acc.name)}</div>
    <label class="f">Wertpapier<input type="text" name="n" value="${esc(p ? p.name : '')}" required placeholder="z. B. MSCI World ETF"></label>
    <label class="f">ISIN (optional)<input type="text" name="i" value="${esc(p ? p.isin : '')}" autocapitalize="characters"></label>
    <div class="f2"><label class="f">Stückzahl<input type="text" inputmode="decimal" name="q" value="${n2(p && p.qty)}"></label>
    <label class="f">Einstand (€/Stk.)<input type="text" inputmode="decimal" name="b" value="${n2(p && p.buy)}"></label></div>
    <div class="f2"><label class="f">Kurs (€)<input type="text" inputmode="decimal" name="p" value="${n2(p && p.price)}"></label>
    <label class="f">Kursdatum<input type="date" name="d" value="${esc(p && p.date || H.today())}"></label></div>${dlgBtns(!!p)}`, (v, f) => {
    if (v === 'del') { askConfirm('„' + p.name + '“ entfernen?', 'Entfernen').then(ok => { if (ok) { F.positions = F.positions.filter(x => x !== p); finSnapshot(); save('Entfernt'); } }); return; }
    if (p) { p.name = f.n.value.trim() || p.name; p.isin = f.i.value.trim().toUpperCase(); p.qty = num(f.q.value); p.buy = num(f.b.value); p.price = num(f.p.value); p.date = f.d.value; finSnapshot(); }
    else finTool('set_position', { account: acc.id, name: f.n.value, isin: f.i.value, qty: f.q.value, buyPrice: f.b.value, price: f.p.value || null, priceDate: f.d.value });
    save('Gespeichert');
  });
}
function finAct(act, b) {
  if (act === 'facc') { editAccount(b.dataset.id); return true; }
  if (act === 'fpos') { editPosition(b.dataset.id, b.dataset.acc); return true; }
  if (act === 'fsnap') { finSnapshot(); save('Stand vom ' + H.fd(H.today()) + ' gespeichert'); return true; }
  return false;
}
