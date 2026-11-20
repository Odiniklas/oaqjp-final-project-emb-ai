/* Lebenshub – Finanzen: Konten, Depots, Positionen, Vermögensverlauf.
   Daten in S.fin = { accounts:[{id,name,broker,kind,cash,asOf}], positions:[{id,acc,name,isin,qty,buy,price,date}], history:[{d,total,depot,cash,acc:{id:wert}}] }
   Kurse kommen wöchentlich über einen Claude-Job (Abo) oder per Hand/Assistent. Alle Beträge in EUR. */
'use strict';
const ACC_KINDS = ['Depot', 'Girokonto', 'Tagesgeld', 'Verrechnungskonto'];
function fin() {
  if (!S.fin) S.fin = { accounts: [], positions: [], history: [], plans: [] };
  ['accounts', 'positions', 'history', 'plans'].forEach(k => { if (!Array.isArray(S.fin[k])) S.fin[k] = []; });
  return S.fin;
}
const num = v => { const n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')); return isFinite(n) ? n : null; };
const eur = (v, d) => v == null ? '–' : v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: d == null ? 2 : d });
const pct = v => v == null || !isFinite(v) ? '' : (v > 0 ? '+' : '') + v.toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + ' %';
function posValue(p) { return p.qty != null && p.price != null ? p.qty * p.price : (p.value != null ? p.value : null); }
function posCost(p) { return p.qty != null && p.buy != null ? p.qty * p.buy : (p.cost != null ? p.cost : null); }
function posPL(p) { const v = posValue(p), c = posCost(p); return v != null && c ? { abs: v - c, rel: (v / c - 1) * 100 } : null; }
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
  F.history = F.history.filter(h => h.d !== day && !(h.total === 0 && t.total > 0)).concat([{ d: day, total: Math.round(t.total * 100) / 100, depot: Math.round(t.depot * 100) / 100, cash: Math.round(t.cash * 100) / 100, acc: t.acc }])
    .sort((a, b) => a.d.localeCompare(b.d)).slice(-260);
}
function findAcc(name) {
  const F = fin(), q = String(name || '').toLowerCase().trim();
  return F.accounts.find(a => a.id === name) || F.accounts.find(a => a.name.toLowerCase() === q) || F.accounts.find(a => q && (a.name.toLowerCase().includes(q) || q.includes(a.name.toLowerCase())));
}
function findPos(accId, key) {
  const q = String(key || '').toLowerCase().trim();
  const P = fin().positions.filter(p => !accId || p.acc === accId);
  return P.find(p => p.id === key) || P.find(p => (p.isin && p.isin.toLowerCase() === q) || (p.wkn && p.wkn.toLowerCase() === q)) || P.find(p => p.name.toLowerCase() === q);
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
    let p = (x.id && findPos(a.id, x.id)) || (x.isin && findPos(a.id, x.isin)) || (x.wkn && findPos(a.id, x.wkn)) || findPos(a.id, x.name);
    if (!p) { p = { id: uid(), acc: a.id, name: String(x.name || x.isin || 'Position').trim(), isin: '', qty: null, buy: null, price: null, date: '' }; F.positions.push(p); }
    if (x.name) p.name = String(x.name).trim();
    if (x.isin) p.isin = String(x.isin).toUpperCase();
    ['qty', 'buy', 'price'].forEach(k => { const src = k === 'buy' ? x.buyPrice : x[k]; if (src != null && num(src) != null) p[k] = num(src); });
    if (x.wkn) p.wkn = String(x.wkn).toUpperCase();
    if (x.value != null && num(x.value) != null && (p.qty == null || p.price == null)) p.value = num(x.value);
    if (x.cost != null && num(x.cost) != null) p.cost = num(x.cost);
    else if (x.returnPct != null && num(x.returnPct) != null && posValue(p) != null && (p.qty == null || p.buy == null)) p.cost = Math.round(posValue(p) / (1 + num(x.returnPct) / 100) * 100) / 100;
    if (x.price != null || x.value != null) p.date = date(x.priceDate || x.date);
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
      const pr = num(e.price), val = num(e.value), chg = num(e.changePct); if (pr == null && val == null && chg == null) return;
      fin().positions.filter(p => p.id === e.id || (e.isin && p.isin && p.isin.toUpperCase() === String(e.isin).toUpperCase()) || (e.wkn && p.wkn && p.wkn === String(e.wkn).toUpperCase()) || (e.name && p.name.toLowerCase() === String(e.name).toLowerCase()))
        .forEach(p => {
          if (pr != null && p.qty != null) p.price = pr;
          else if (val != null) p.value = val;
          else if (chg != null) { if (p.qty != null && p.price != null) p.price = Math.round(p.price * (1 + chg / 100) * 100) / 100; else if (p.value != null) p.value = Math.round(p.value * (1 + chg / 100) * 100) / 100; }
          else return;
          p.date = date(e.date); d = p.date > d ? p.date : d; n++; });
    });
    finSnapshot(d || H.today());
    return { label: '💹 Kurse aktualisiert: ' + n + ' Position(en), Vermögen ' + eur(finTotals().total, 0), result: n + ' aktualisiert' };
  }
  if (name === 'set_series') {
    const a = findAcc(x.account); if (!a) throw new Error('Konto nicht gefunden');
    const pts = (Array.isArray(x.points) ? x.points : []).map(q => Array.isArray(q) ? q : [q.d || q.date, q.v != null ? q.v : q.value]).filter(q => /^\d{4}-\d{2}-\d{2}$/.test(q[0] || '') && num(q[1]) != null).map(q => [q[0], num(q[1])]).sort((m, n) => m[0].localeCompare(n[0]));
    if (pts.length < 2) throw new Error('Zu wenige Punkte');
    F.series = F.series || {}; F.series[a.id] = { kind: x.kind === 'pct' ? 'pct' : 'value', pts, src: String(x.source || ''), at: H.today() };
    return { label: '📉 Verlauf ' + a.name + ': ' + pts.length + ' Punkte ab ' + H.fdy(pts[0][0]), result: 'gespeichert' };
  }
  if (name === 'set_saving_plan') {
    const a = findAcc(x.account); if (!a) throw new Error('Konto nicht gefunden');
    const q = String(x.name || '').toLowerCase().trim();
    let pl = F.plans.find(y => y.acc === a.id && y.name.toLowerCase() === q);
    if (x.remove) { F.plans = F.plans.filter(y => y !== pl); return { label: '− Sparplan ' + (x.name || ''), result: 'entfernt' }; }
    if (!pl) { pl = { id: uid(), acc: a.id, name: String(x.name || 'Sparplan').trim(), amount: 0, every: 'monatlich', next: '' }; F.plans.push(pl); }
    if (num(x.amount) != null) pl.amount = num(x.amount);
    if (x.every) pl.every = String(x.every);
    if (/^\d{4}-\d{2}-\d{2}$/.test(x.next || '')) pl.next = x.next;
    return { label: '🔁 Sparplan ' + pl.name + ': ' + eur(pl.amount, 0) + ' ' + pl.every, result: 'gespeichert' };
  }
  return null;
}
const FIN_TOOLS = [
  { name: 'set_saving_plan', description: 'Sparplan anlegen/ändern (Betrag in EUR, Rhythmus, nächste Ausführung) oder mit remove=true entfernen.',
    input_schema: { type: 'object', additionalProperties: false, required: ['account', 'name'], properties: { account: { type: 'string' }, name: { type: 'string' }, amount: { type: 'number' }, every: { type: 'string' }, next: { type: 'string', description: 'JJJJ-MM-TT' }, remove: { type: 'boolean' } } } },
  { name: 'set_account', description: 'Konto oder Depot anlegen/ändern (z. B. Trade Republic Depot, comdirect Girokonto). cash = Kontostand bzw. Depot-Guthaben in EUR, asOf = Stichtag.',
    input_schema: { type: 'object', additionalProperties: false, required: ['name'], properties: { name: { type: 'string' }, broker: { type: 'string' }, kind: { type: 'string', enum: ACC_KINDS }, cash: { type: 'number' }, asOf: { type: 'string', description: 'JJJJ-MM-TT' } } } },
  { name: 'set_position', description: 'Wertpapier-Position in einem Depot anlegen/ändern: Stückzahl, Einstandskurs (buyPrice), aktueller Kurs (price) in EUR. Ohne Stückzahl (z. B. Trade-Republic-Übersicht): value = aktueller Positionswert, returnPct = Rendite seit Kauf in % (oder cost = Einstand gesamt).',
    input_schema: { type: 'object', additionalProperties: false, required: ['account', 'name'], properties: { account: { type: 'string', description: 'Name des Depots' }, name: { type: 'string' }, isin: { type: 'string' }, wkn: { type: 'string' }, qty: { type: 'number' }, buyPrice: { type: 'number' }, price: { type: 'number' }, value: { type: 'number' }, cost: { type: 'number' }, returnPct: { type: 'number' }, priceDate: { type: 'string', description: 'JJJJ-MM-TT' } } } },
  { name: 'remove_position', description: 'Position aus einem Depot entfernen (nur auf ausdrücklichen Wunsch oder bei Verkauf).',
    input_schema: { type: 'object', additionalProperties: false, required: ['account', 'name'], properties: { account: { type: 'string' }, name: { type: 'string' } } } },
  { name: 'set_prices', description: 'Kurse aktualisieren; speichert automatisch einen Depotstand für den Verlauf. Je Position price (EUR je Stück, wenn Stückzahl bekannt) ODER value (Positionswert) ODER changePct (Veränderung in % seit letztem Stand).',
    input_schema: { type: 'object', additionalProperties: false, required: ['prices'], properties: { prices: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, isin: { type: 'string' }, wkn: { type: 'string' }, price: { type: 'number' }, value: { type: 'number' }, changePct: { type: 'number' }, date: { type: 'string' } } } } } } }
];
function finSnapshotText() {
  const F = fin();
  if (!F.accounts.length) return 'keine Konten erfasst';
  return JSON.stringify({ konten: F.accounts.map(a => [a.name, a.kind, a.cash, a.asOf]), positionen: F.positions.map(p => [(findAcc(p.acc) || {}).name, p.name, p.isin || p.wkn || '', p.qty, p.buy, p.price, p.date, posValue(p) != null ? Math.round(posValue(p)) : null, posPL(p) ? Math.round(posPL(p).rel * 10) / 10 + '%' : '']),
    sparplaene: F.plans.map(x => [(findAcc(x.acc) || {}).name, x.name, x.amount, x.every, x.next]),
    gesamt: Math.round(finTotals().total), verlauf: F.history.slice(-6).map(h => [h.d, Math.round(h.total)]) });
}

/* ---------- Ansicht (im Stil einer Broker-App) ---------- */
let finRange = 'max';
const FIN_RANGES = [['1m', '1M', 31], ['6m', '6M', 183], ['1j', '1J', 366], ['3j', '3J', 1096], ['max', 'Max', 1e5]];
const FIN_COLORS = ['#0e7c66', '#2f8fdd', '#7c5cff', '#e67e22', '#e0457b', '#16a085', '#c0392b', '#8a8f98'];
function finChart(pts, cost, label, isPct) {
  const hasBase = cost != null && (cost || isPct);
  pts = pts.filter(p => p.v != null);
  if (pts.length < 2) return `<div class="fin-empty-chart"><svg viewBox="0 0 600 70" preserveAspectRatio="none" class="chart flat"><path d="M6 50 L594 50" class="ln"/></svg><div class="hint">Der Verlauf startet mit diesem Stand und wächst mit jedem Kurs-Update (jeden Samstag automatisch).</div></div>`;
  const W = 600, Hh = 150, pad = 6, ys = pts.map(p => p.v).concat(hasBase ? [cost] : []), mn = Math.min(...ys), mx = Math.max(...ys), rng = mx - mn || 1;
  const t0 = H.P(pts[0].d).getTime(), t1 = H.P(pts[pts.length - 1].d).getTime() || t0 + 1;
  const X = d => pad + (W - 2 * pad) * ((H.P(d).getTime() - t0) / ((t1 - t0) || 1)), Y = v => pad + (Hh - 2 * pad) * (1 - (v - mn) / rng);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + X(p.d).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join(' ');
  const last = pts[pts.length - 1], up = last.v >= (isPct ? 0 : cost || pts[0].v);
  return `<svg class="chart ${up ? 'up' : 'down'}" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" role="img" aria-label="${esc(label || 'Verlauf')}">
    <path class="area" d="${line} L ${X(last.d).toFixed(1)} ${Hh} L ${X(pts[0].d).toFixed(1)} ${Hh} Z"/>${hasBase ? `<path class="cost" d="M ${pad} ${Y(cost).toFixed(1)} L ${W - pad} ${Y(cost).toFixed(1)}"/>` : ''}<path class="ln" d="${line}"/>
    <circle cx="${X(last.d).toFixed(1)}" cy="${Y(last.v).toFixed(1)}" r="4"/></svg>
    <div class="axis"><span>${H.fdy(pts[0].d)}</span><span>${isPct ? pct(mn) + ' … ' + pct(mx) + ' · gestrichelt: 0 %' : cost ? 'gestrichelt: Einstand' : eur(mn, 0) + ' – ' + eur(mx, 0)}</span><span>${H.fdy(last.d)}</span></div>`;
}
function finRangeOf(pts) { const days = (FIN_RANGES.find(r => r[0] === finRange) || FIN_RANGES[3])[2], from = H.add(H.today(), -days); return pts.filter(p => p.d >= from); }
function finRangeChips() { return `<div class="fin-range">${FIN_RANGES.map(r => `<button class="chip ${finRange === r[0] ? '' : 'd'}" data-act="frange" data-v="${r[0]}">${r[1]}</button>`).join('')}</div>`; }
function finPL(ps) { return ps.reduce((s, p) => { const q = posPL(p); return q ? { abs: s.abs + q.abs, cost: s.cost + posCost(p) } : s; }, { abs: 0, cost: 0 }); }
function plChip(abs, base, label) { if (!base) return ''; const up = abs >= 0; return `<span class="fin-pill ${up ? 'pos' : 'neg'}"><b>${up ? '▲' : '▼'} ${pct(abs / base * 100).replace(/^[+-]/, '')}</b><small>${up ? '+' : '−'}${eur(Math.abs(abs))} · ${label}</small></span>`; }
/* Thema einer Position (für die Aufteilung) */
const FIN_THEMES = [['Krypto', /bitcoin|ethereum|cardano|\bxrp\b|solana|krypto|crypto|\bbtc\b|\beth\b/i], ['Technologie & KI', /tech|informat|ai\b|künstl|disrupt|digital|robot|semicond/i], ['Schwellenländer', /\bem\b|emerging|schwellen/i], ['Gold & Rohstoffe', /gold|silber|rohstoff|commod/i], ['Wasser & Umwelt', /water|wasser|clean|umwelt|energy/i], ['Welt (breit)', /world|welt|acwi|all.?country/i]];
const finTheme = p => (FIN_THEMES.find(t => t[1].test(p.name)) || ['Sonstiges'])[0];
function finBar(parts, total) {
  const ps = parts.filter(x => x.v > 0).sort((a, b) => b.v - a.v);
  return `<div class="fin-alloc">${ps.map((x, i) => `<i style="width:${(x.v / total * 100).toFixed(1)}%;background:${FIN_COLORS[i % FIN_COLORS.length]}"></i>`).join('')}</div>
    <div class="fin-leg">${ps.map((x, i) => `<span><i style="background:${FIN_COLORS[i % FIN_COLORS.length]}"></i>${esc(x.n)} <b>${Math.round(x.v / total * 100)} %</b></span>`).join('')}</div>`;
}
function finKpis(list) { return `<div class="fin-kpis">${list.filter(Boolean).map(k => `<div><small>${k[0]}</small><b class="${k[2] || ''}">${k[1]}</b></div>`).join('')}</div>`; }
function finView() {
  const F = fin(), t = finTotals(), h = F.history, allPL = finPL(F.positions);
  const pts = finRangeOf(h.map(x => ({ d: x.d, v: x.total })));
  const prev = h.length > 1 ? h[h.length - 2] : null, last = h[h.length - 1];
  const plans = F.plans.reduce((s2, x) => s2 + (x.amount || 0), 0);
  const accs = F.accounts.filter(a => F.positions.some(p => p.acc === a.id) || a.cash != null);
  const missing = F.accounts.filter(a => !accs.includes(a));
  const byTheme = {}; F.positions.forEach(p => { const v = posValue(p) || 0; byTheme[finTheme(p)] = (byTheme[finTheme(p)] || 0) + v; });
  let out = `<section class="card wide fin-hero"><div class="fin-label">Gesamtvermögen</div>
    <div class="fin-total">${accs.length ? eur(t.total) : '–'}</div>
    <div class="fin-pills">${plChip(allPL.abs, allPL.cost, 'seit Kauf')}${prev && last && prev.total ? plChip(last.total - prev.total, prev.total, 'seit ' + H.fdy(prev.d)) : ''}</div>
    ${pts.length >= 3 ? finChart(pts, null, 'Vermögensverlauf') + finRangeChips() : ''}
    ${accs.length ? finKpis([['Investiert', eur(allPL.cost, 0)], ['Gewinn', (allPL.abs >= 0 ? '+' : '−') + eur(Math.abs(allPL.abs), 0), allPL.abs >= 0 ? 'pos' : 'neg'], ['Sparpläne', eur(plans, 0) + '/Mon.'], ['Positionen', String(F.positions.length)], t.cash ? ['Guthaben', eur(t.cash, 0)] : null]) : ''}
    ${accs.length > 1 ? `<div class="fin-label sm">Aufteilung nach Depot</div>${finBar(accs.map(a => ({ n: a.name.replace(/ Depot$/, ''), v: accValue(a).total })), t.total || 1)}` : ''}
    ${F.positions.length > 2 ? `<div class="fin-label sm">Aufteilung nach Thema</div>${finBar(Object.entries(byTheme).map(([n, v]) => ({ n, v })), t.depot || 1)}` : ''}
    ${!F.accounts.length ? '<div class="hint">Noch keine Konten. Schick Odi Screenshots deiner Depot- und Kontoübersicht – er trägt alles ein.</div>' : ''}
    ${missing.length ? `<div class="hint">Ohne Stand (ausgeblendet): ${missing.map(a => `<button class="chip d" data-act="facc" data-id="${a.id}">${esc(a.name)}</button>`).join(' ')}</div>` : ''}
    <div class="btns"><button class="btn ghost" data-act="facc">+ Konto / Depot</button></div></section>`;
  accs.forEach(a => {
    const v = accValue(a), ps = F.positions.filter(p => p.acc === a.id).sort((x, y) => (posValue(y) || 0) - (posValue(x) || 0)), pl = finPL(ps);
    const ah = h.filter(x => x.acc && x.acc[a.id] > 0).map(x => ({ d: x.d, v: x.acc[a.id] }));
    const ap = ah.length > 1 ? ah[ah.length - 2] : null, al = ah[ah.length - 1];
    const aplans = F.plans.filter(x => x.acc === a.id), asum = aplans.reduce((s2, x) => s2 + (x.amount || 0), 0);
    const nextPlan = aplans.map(x => x.next).filter(Boolean).sort()[0];
    const tot = ps.reduce((s2, p) => s2 + (posValue(p) || 0), 0) || 1;
    const se = F.series && F.series[a.id];
    let chart = '';
    if (se && se.kind === 'pct') chart = `<div class="fin-label sm">Rendite seit Start (zeitgewichtet)</div>${finChart(finRangeOf(se.pts.map(q => ({ d: q[0], v: q[1] }))), 0, a.name, true)}${finRangeChips()}`;
    else if (se) { const sp = se.pts.map(q => ({ d: q[0], v: q[1] })), lastD = sp[sp.length - 1].d; chart = finChart(finRangeOf(sp.concat(ah.filter(q => q.d > lastD))), null, a.name) + finRangeChips(); }
    else if (ah.length >= 3) chart = finChart(finRangeOf(ah), null, a.name) + finRangeChips();
    const plansNamed = aplans.filter(x => !/^Sparplan Nr\./i.test(x.name));
    out += `<section class="card fin-accc"><h2><button class="t" data-act="facc" data-id="${a.id}">${esc(a.name)}<small>${esc(a.broker || a.kind)}${(ps.find(p => p.date) || {}).date ? ' · Stand ' + H.fdy(ps.map(p => p.date).filter(Boolean).sort().pop()) : ''}</small></button></h2>
      <div class="fin-total sm">${eur(v.total)}</div>
      <div class="fin-pills">${plChip(pl.abs, pl.cost, 'seit Kauf')}${ap && al ? plChip(al.v - ap.v, ap.v, 'seit ' + H.fdy(ap.d)) : ''}</div>
      ${chart}
      ${ps.length ? finKpis([['Investiert', eur(pl.cost, 0)], ['Gewinn', (pl.abs >= 0 ? '+' : '−') + eur(Math.abs(pl.abs), 0), pl.abs >= 0 ? 'pos' : 'neg'], asum ? ['Sparplan', eur(asum, 0) + '/Mon.'] : null, a.cash != null ? ['Guthaben', eur(num(a.cash), 0)] : null]) : ''}
      ${ps.length > 1 ? `<div class="fin-alloc">${ps.map((p, i) => `<i style="width:${((posValue(p) || 0) / tot * 100).toFixed(1)}%;background:${FIN_COLORS[i % FIN_COLORS.length]}"></i>`).join('')}</div>` : ''}
      ${ps.map((p, i) => { const q = posPL(p), val = posValue(p), plan = aplans.find(x => x.name.toLowerCase() === p.name.toLowerCase());
        const sub = [Math.round((val || 0) / tot * 100) + ' %', p.qty != null ? p.qty.toLocaleString('de-DE') + ' Stk.' : '', p.buy != null && p.price != null ? eur(p.buy) + ' → ' + eur(p.price) : '', plan ? '🔁 ' + eur(plan.amount, 0) + '/Mon.' : ''].filter(Boolean).join(' · ');
        return `<div class="row fin-pos"><span class="fin-dot" style="background:${FIN_COLORS[i % FIN_COLORS.length]}"></span><button class="t" data-act="fpos" data-id="${p.id}">${esc(p.name)}<small>${sub}</small></button><span class="fin-v">${eur(val)}${q ? `<small class="${q.rel >= 0 ? 'pos' : 'neg'}">${q.rel >= 0 ? '▲' : '▼'} ${pct(q.rel).replace(/^[+-]/, '')} · ${q.abs >= 0 ? '+' : '−'}${eur(Math.abs(q.abs), 0)}</small>` : ''}</span></div>`; }).join('')}
      ${aplans.length ? `<div class="hint fin-planline">🔁 Sparpläne ${eur(asum, 0)}/Monat${nextPlan ? ' · nächste Ausführung ' + H.fd(nextPlan) : ''}${aplans.length > plansNamed.length ? ` · ${aplans.length - plansNamed.length}× ohne Angabe des Wertpapiers` : ''}</div>` : ''}
      ${se ? `<div class="hint">Verlauf ${se.kind === 'pct' ? '' : 'bis ' + H.fdy(se.pts[se.pts.length - 1][0]) + ' '}aus ${esc(se.src || 'Screenshot')}, danach wöchentliche Kurs-Updates.</div>` : ''}
      <div class="btns"><button class="btn ghost" data-act="fpos" data-acc="${a.id}">+ Position</button></div></section>`;
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
    <label class="f">Kursdatum<input type="date" name="d" value="${esc(p && p.date || H.today())}"></label></div>
    <div class="hint">Ohne Stückzahl: Positionswert und Einstand gesamt reichen.</div>
    <div class="f2"><label class="f">Wert gesamt (€)<input type="text" inputmode="decimal" name="vv" value="${n2(p && p.value)}"></label>
    <label class="f">Einstand gesamt (€)<input type="text" inputmode="decimal" name="cc" value="${n2(p && p.cost)}"></label></div>${dlgBtns(!!p)}`, (v, f) => {
    if (v === 'del') { askConfirm('„' + p.name + '“ entfernen?', 'Entfernen').then(ok => { if (ok) { F.positions = F.positions.filter(x => x !== p); finSnapshot(); save('Entfernt'); } }); return; }
    if (p) { p.name = f.n.value.trim() || p.name; p.isin = f.i.value.trim().toUpperCase(); p.qty = num(f.q.value); p.buy = num(f.b.value); p.price = num(f.p.value); p.value = num(f.vv.value); p.cost = num(f.cc.value); p.date = f.d.value; finSnapshot(); }
    else finTool('set_position', { account: acc.id, name: f.n.value, isin: f.i.value, qty: f.q.value, buyPrice: f.b.value, price: f.p.value || null, value: f.vv.value || null, cost: f.cc.value || null, priceDate: f.d.value });
    save('Gespeichert');
  });
}
function finAct(act, b) {
  if (act === 'facc') { editAccount(b.dataset.id); return true; }
  if (act === 'fpos') { editPosition(b.dataset.id, b.dataset.acc); return true; }
  if (act === 'frange') { finRange = b.dataset.v; render(); return true; }
  if (act === 'fsnap') { finSnapshot(); save('Stand vom ' + H.fd(H.today()) + ' gespeichert'); return true; }
  return false;
}
