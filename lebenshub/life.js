/* Lebenshub – Leben: Wohnen, Mobilität, Versicherungen, Vorsorge, Verträge & Abos in Clustern.
   Daten: S.life = { income: Netto/Monat, items:[{id, cat, name, provider, cost, per, start, end, notice, next, status, note}] }
   Kosten werden auf den Monat umgerechnet und fließen in die Finanzen (Fixkosten, freies Budget). */
'use strict';
const LIFE_CATS = [
  ['wohnen', 'Wohnen', '🏠', ['Miete/Kaltmiete', 'Nebenkosten', 'Strom', 'Internet', 'Rundfunkbeitrag', 'Hausratversicherung']],
  ['mobil', 'Mobilität', '🚗', ['Kfz-Versicherung', 'Kfz-Steuer', 'Tanken/Laden', 'Wartung/TÜV', 'Dienstrad', 'ÖPNV/Deutschlandticket']],
  ['vers', 'Versicherungen', '🛡️', ['Privathaftpflicht', 'Hausrat', 'Berufsunfähigkeit', 'Unfall', 'Krankenzusatz', 'Auslandsreise-Kranken']],
  ['vorsorge', 'Vorsorge & Rente', '🌱', ['Betriebsrente (bAV)', 'Private Rente/ETF', 'Notgroschen']],
  ['vertrag', 'Verträge & Abos', '📄', ['Handy', 'Streaming', 'Fitnessstudio', 'Software/Cloud', 'Zeitungen']],
];
const LIFE_ST = ['aktiv', 'Angebot', 'prüfen', 'fehlt', 'gekündigt'];
const LIFE_PER = [['monat', 'monatlich', 1], ['quartal', 'vierteljährlich', 1 / 3], ['halbjahr', 'halbjährlich', 1 / 6], ['jahr', 'jährlich', 1 / 12], ['einmalig', 'einmalig', 0]];
let lifeOpen = '';
function life() { S.life = Object.assign({ income: null, items: [] }, S.life || {}); if (!Array.isArray(S.life.items)) S.life.items = []; return S.life; }
const lifeMonthly = it => { const c = Number(it.cost); if (!isFinite(c) || it.status === 'gekündigt' || it.status === 'Angebot' || it.status === 'fehlt') return 0; return c * ((LIFE_PER.find(p => p[0] === it.per) || LIFE_PER[0])[2]); };
function lifeTotals() {
  const L = life(), by = {}; let m = 0, missing = 0;
  L.items.forEach(it => { const v = lifeMonthly(it); m += v; by[it.cat] = (by[it.cat] || 0) + v; if (it.status === 'aktiv' && !(Number(it.cost) > 0) && it.per !== 'einmalig') missing++; });
  return { month: m, year: m * 12, by, missing, n: L.items.filter(x => x.status === 'aktiv').length };
}
function lifeDue(days) {
  const t = H.today(), lim = H.add(t, days || 60);
  return life().items.filter(it => it.next && it.next <= lim && it.status !== 'gekündigt').sort((a, b) => a.next.localeCompare(b.next));
}
/* Werkzeug für Odi und Claude-Jobs */
function lifeTool(name, x) {
  if (name === 'set_contract') {
    const L = life(), q = String(x.name || '').trim().toLowerCase();
    if (!q) throw new Error('Name fehlt');
    let it = L.items.find(y => y.id === x.id) || L.items.find(y => y.name.toLowerCase() === q);
    const isNew = !it;
    if (!it) { it = { id: uid(), cat: 'vertrag', name: String(x.name).trim(), provider: '', cost: null, per: 'monat', start: '', end: '', notice: '', next: '', status: 'aktiv', note: '' }; L.items.push(it); }
    if (LIFE_CATS.some(c => c[0] === x.cat)) it.cat = x.cat;
    ['provider', 'notice', 'note'].forEach(f => { if (x[f] != null) it[f] = String(x[f]).slice(0, 300); });
    if (x.cost != null && isFinite(Number(String(x.cost).replace(',', '.')))) it.cost = Number(String(x.cost).replace(',', '.'));
    if (LIFE_PER.some(p => p[0] === x.per)) it.per = x.per;
    ['start', 'end', 'next'].forEach(f => { if (/^\d{4}-\d{2}-\d{2}$/.test(x[f] || '')) it[f] = x[f]; });
    if (LIFE_ST.includes(x.status)) it.status = x.status;
    return { label: (isNew ? '🏠 Neu: ' : '🏠 Aktualisiert: ') + it.name + (it.cost ? ' · ' + eur(it.cost) + ' ' + (LIFE_PER.find(p => p[0] === it.per) || [, ''])[1] : ''), result: 'gespeichert, id=' + it.id };
  }
  if (name === 'set_income') { const v = Number(String(x.net).replace(',', '.')); if (!isFinite(v)) throw new Error('Betrag fehlt'); life().income = v; return { label: '💶 Nettoeinkommen ' + eur(v, 0) + '/Monat', result: 'ok' }; }
  return null;
}
const LIFE_TOOLS = [
  { name: 'set_contract', description: 'Vertrag/Versicherung/Abo im Bereich Leben anlegen oder ändern (Miete, Nebenkosten, Strom, Kfz, Versicherungen, Handy, Abos, Vorsorge). Keine Vertrags-, Policen- oder Kundennummern speichern.',
    input_schema: { type: 'object', additionalProperties: false, required: ['name'], properties: { id: { type: 'string' }, name: { type: 'string' }, cat: { type: 'string', enum: LIFE_CATS.map(c => c[0]) }, provider: { type: 'string' }, cost: { type: 'number', description: 'Betrag in EUR je Zahlungsrhythmus' }, per: { type: 'string', enum: LIFE_PER.map(p => p[0]) }, start: { type: 'string' }, end: { type: 'string' }, next: { type: 'string', description: 'nächste Fälligkeit oder Kündigungs-/Prüffrist JJJJ-MM-TT' }, notice: { type: 'string', description: 'Kündigungsfrist, z. B. 3 Monate zum Jahresende' }, status: { type: 'string', enum: LIFE_ST }, note: { type: 'string' } } } },
  { name: 'set_income', description: 'Monatliches Nettoeinkommen in EUR für das Budget setzen.', input_schema: { type: 'object', additionalProperties: false, required: ['net'], properties: { net: { type: 'number' } } } }
];
function lifeSnapshotText() { const L = life(), T = lifeTotals(); return JSON.stringify({ netto: L.income, fixkostenMonat: Math.round(T.month), vertraege: L.items.map(i => [i.id, i.cat, i.name, i.provider, i.cost, i.per, i.status, i.next, i.notice]) }); }

/* ---------- Ansicht ---------- */
const lifeStCls = s => s === 'aktiv' ? 'good' : s === 'gekündigt' ? 'd' : s === 'fehlt' ? 'bad' : 'warn';
function lifeRow(it) {
  const m = lifeMonthly(it), per = (LIFE_PER.find(p => p[0] === it.per) || LIFE_PER[0]);
  const t = H.today(), soon = it.next && it.next <= H.add(t, 30);
  return `<div class="row life-row"><button class="t" data-act="lifeEdit" data-id="${it.id}">${esc(it.name)}<small>${esc([it.provider, it.notice ? 'Kündigung: ' + it.notice : '', it.note].filter(Boolean).join(' · '))}</small></button>
    ${it.next ? `<span class="chip ${soon ? 'due' : 'd'}">${esc(H.fd(it.next))}</span>` : ''}
    <span class="life-cost">${Number(it.cost) > 0 ? eur(it.cost, 2) + `<small>${per[1]}${per[0] !== 'monat' && m ? ' · ' + eur(m, 0) + '/Mon.' : ''}</small>` : (it.status === 'aktiv' && it.per !== 'einmalig' ? '<small class="warn-t">Betrag fehlt</small>' : '')}</span>
    <span class="chip ${lifeStCls(it.status)}">${esc(it.status)}</span></div>`;
}
function lifeView() {
  const L = life(), T = lifeTotals(), due = lifeDue(60), plans = (typeof fin === 'function' ? fin().plans : []).reduce((s, x) => s + (x.amount || 0), 0);
  const free = L.income != null ? L.income - T.month - plans : null;
  let h = `<section class="card wide life-hero"><div class="fin-label">Leben · Fixkosten</div>
    <div class="fin-total">${T.month ? eur(T.month, 0) : '–'}<small class="life-sub"> / Monat</small></div>
    ${finKpis([['Pro Jahr', T.year ? eur(T.year, 0) : '–'], ['Aktive Verträge', String(T.n)], ['Beträge fehlen', String(T.missing), T.missing ? 'neg' : ''], ['Fristen (60 T.)', String(due.length)]])}
    <div class="fin-label sm">Monatsbudget</div>
    <div class="life-budget">${L.income != null ? `<span>Netto <b>${eur(L.income, 0)}</b></span><span>− Fixkosten <b>${eur(T.month, 0)}</b></span><span>− Sparpläne <b>${eur(plans, 0)}</b></span><span class="${free >= 0 ? 'pos' : 'neg'}">= frei <b>${eur(free, 0)}</b></span>` : `<span class="hint">Nettoeinkommen fehlt – <button class="chip" data-act="lifeIncome">eintragen</button>, dann rechnet der Hub dein freies Budget.</span>`}</div>
    ${T.month ? `<div class="fin-label sm">Fixkosten nach Bereich</div>${finBar(LIFE_CATS.map(c => ({ n: c[1], v: T.by[c[0]] || 0 })), T.month || 1)}` : ''}
    ${due.length ? `<div class="fin-label sm">Nächste Fristen</div>${due.slice(0, 5).map(lifeRow).join('')}` : ''}
    <div class="btns"><button class="btn" data-act="lifeEdit" data-id="">+ Vertrag / Versicherung</button>${L.income != null ? '<button class="btn ghost" data-act="lifeIncome">Einkommen ändern</button>' : ''}</div>
    <div class="hint">Tipp: Screenshot von Police, Mietvertrag oder Kontoauszug an Odi schicken – Beträge, Fristen und Anbieter werden eingetragen (ohne Vertragsnummern).</div></section>`;
  LIFE_CATS.forEach(([k, title, icon, must]) => {
    const its = L.items.filter(i => i.cat === k).sort((a, b) => LIFE_ST.indexOf(a.status) - LIFE_ST.indexOf(b.status));
    const match = (i, m) => (i.name + ' ' + i.note).toLowerCase().includes(m.toLowerCase().split(/[\/ (]/)[0].slice(0, 9));
    const have = must.filter(m => its.some(i => i.status === 'aktiv' && match(i, m))), pend = must.filter(m => !have.includes(m) && its.some(i => match(i, m)));
    const cov = must.length ? Math.round(have.length / must.length * 100) : 100;
    const docs = k === 'wohnen' ? (S.lists.dw || []) : k === 'mobil' ? (S.lists.dm || []) : [];
    const dc = k === 'wohnen' ? C.find(c => c.k === 'dw') : k === 'mobil' ? C.find(c => c.k === 'dm') : null;
    h += `<section class="card life-card"><h2>${icon} ${title}<small>${T.by[k] ? eur(T.by[k], 0) + '/Mon.' : its.length + ' Einträge'}</small></h2>
      ${its.map(lifeRow).join('') || '<div class="empty">Noch nichts eingetragen.</div>'}
      <details class="life-check"><summary>Checkliste · ${have.length}/${must.length} erfasst<span class="life-cov"><i style="width:${cov}%"></i></span></summary>
        ${must.map(m => { const ok = have.includes(m), pe = pend.includes(m); return `<div class="life-ck ${ok ? 'ok' : ''}">${ok ? '✓' : pe ? '◐' : '○'} ${esc(m)}${pe ? ' <small>(Angebot/offen)</small>' : ''}${ok || pe ? '' : ` <button class="chip d" data-act="lifeEdit" data-id="" data-cat="${k}" data-name="${esc(m)}">+</button>`}</div>`; }).join('')}</details>
      ${docs.length ? `<div class="fin-label sm">Unterlagen</div>${docs.map(it => `<div class="row"><button class="t" data-act="iedit" data-k="${dc.k}" data-id="${it.id}">${esc(it.n)}</button><button class="chip ${stClass(dc.st[it.s] || dc.st[0])}" data-act="cycle" data-k="${dc.k}" data-id="${it.id}">${esc(dc.st[it.s] || dc.st[0])}</button></div>`).join('')}` : ''}
      <div class="btns"><button class="btn ghost" data-act="lifeEdit" data-id="" data-cat="${k}">+ ${title}</button></div></section>`;
  });
  if (typeof docsCard === 'function') h += docsCard('life');
  return h;
}
function lifeEdit(id, cat, name) {
  const L = life(), it = id ? L.items.find(x => x.id === id) : null;
  const v = it || { cat: cat || 'vertrag', name: name || '', provider: '', cost: '', per: 'monat', start: '', end: '', notice: '', next: '', status: 'aktiv', note: '' };
  openDlg(`<h3>${it ? esc(it.name) : 'Neuer Vertrag'}</h3>
    <label class="f">Bezeichnung<input name="n" required value="${esc(v.name)}" placeholder="z. B. Privathaftpflicht"></label>
    <div class="f2"><label class="f">Bereich<select name="c">${LIFE_CATS.map(c => `<option value="${c[0]}" ${v.cat === c[0] ? 'selected' : ''}>${c[2]} ${c[1]}</option>`).join('')}</select></label>
    <label class="f">Anbieter<input name="p" value="${esc(v.provider)}" placeholder="z. B. Allianz"></label></div>
    <div class="f2"><label class="f">Betrag (€)<input name="k" inputmode="decimal" value="${v.cost != null && v.cost !== '' ? String(v.cost).replace('.', ',') : ''}"></label>
    <label class="f">Rhythmus<select name="r">${LIFE_PER.map(p => `<option value="${p[0]}" ${v.per === p[0] ? 'selected' : ''}>${p[1]}</option>`).join('')}</select></label></div>
    <div class="f2"><label class="f">Status<select name="s">${LIFE_ST.map(s => `<option ${v.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
    <label class="f">Nächste Frist / Fälligkeit<input type="date" name="x" value="${esc(v.next)}"></label></div>
    <div class="f2"><label class="f">Beginn<input type="date" name="b" value="${esc(v.start)}"></label><label class="f">Ende<input type="date" name="e" value="${esc(v.end)}"></label></div>
    <label class="f">Kündigungsfrist<input name="kf" value="${esc(v.notice)}" placeholder="z. B. 3 Monate zum Jahresende"></label>
    <label class="f">Notiz<input name="o" value="${esc(v.note)}"></label>
    <div class="hint">Keine Vertrags-, Policen- oder Kundennummern eintragen.</div>
    <div class="btns"><button class="btn" value="go">Speichern</button>${it ? '<button class="btn ghost" value="del" formnovalidate>Löschen</button>' : ''}<button class="btn ghost" value="cancel" formnovalidate>Abbrechen</button></div>`, (val, f) => {
    if (val === 'del') { askConfirm('„' + it.name + '“ löschen?', 'Löschen').then(ok => { if (ok) { L.items = L.items.filter(x => x !== it); save('Gelöscht'); } }); return; }
    lifeTool('set_contract', { id: it && it.id, name: f.n.value, cat: f.c.value, provider: f.p.value, cost: f.k.value.trim() === '' ? null : f.k.value, per: f.r.value, status: f.s.value, next: f.x.value, start: f.b.value, end: f.e.value, notice: f.kf.value, note: f.o.value });
    const x = L.items.find(y => y.name.toLowerCase() === f.n.value.trim().toLowerCase());
    if (x) { if (f.k.value.trim() === '') x.cost = null; ['next', 'start', 'end'].forEach((k2, i) => { if (![f.x, f.b, f.e][i].value) x[k2] = ''; }); }
    save('Gespeichert');
  });
}
function lifeIncome() {
  openDlg(`<h3>Nettoeinkommen</h3><label class="f">Netto pro Monat (€)<input name="n" inputmode="decimal" value="${life().income != null ? String(life().income).replace('.', ',') : ''}"></label>
    <div class="hint">Nur für deine Budgetrechnung im Hub.</div><div class="btns"><button class="btn" value="go">Speichern</button><button class="btn ghost" value="cancel" formnovalidate>Abbrechen</button></div>`, (v, f) => {
    const n = Number(f.n.value.replace(/\./g, '').replace(',', '.')); life().income = f.n.value.trim() === '' ? null : (isFinite(n) ? n : null); save('Gespeichert');
  });
}
function lifeAct(act, b) {
  if (act === 'lifeEdit') { lifeEdit(b.dataset.id, b.dataset.cat, b.dataset.name); return true; }
  if (act === 'lifeIncome') { lifeIncome(); return true; }
  return false;
}
