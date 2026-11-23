/* Lebenshub – Finanzplanung: Depot-Übersicht, Ziele, Vermögensprognose, Struktur-Check.
   Ziele in S.fin.goals = [{id, name, target, targetMax, date, saved, note}] */
'use strict';
let fpRate = 6;
function goals() { const F = fin(); if (!Array.isArray(F.goals)) F.goals = []; return F.goals; }
const monthsUntil = d => { if (!d) return null; const a = new Date(), b = new Date(d + 'T00:00:00'); return Math.max(0, (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth()); };
/* Zukunftswert: Startkapital + monatliche Sparrate, monatlich verzinst */
function futureValue(pv, pmt, ratePct, years) { const r = ratePct / 100 / 12, n = years * 12; return r ? pv * Math.pow(1 + r, n) + pmt * (Math.pow(1 + r, n) - 1) / r : pv + pmt * n; }
function goalTool(name, x) {
  if (name !== 'set_goal') return null;
  const G = goals(), q = String(x.name || '').trim().toLowerCase(); if (!q) throw new Error('Name fehlt');
  let g = G.find(y => y.id === x.id) || G.find(y => y.name.toLowerCase() === q);
  if (x.remove) { fin().goals = G.filter(y => y !== g); return { label: '− Ziel ' + x.name, result: 'entfernt' }; }
  if (!g) { g = { id: uid(), name: String(x.name).trim(), target: null, targetMax: null, date: '', saved: 0, note: '' }; G.push(g); }
  ['target', 'targetMax', 'saved'].forEach(k => { if (x[k] != null && num(x[k]) != null) g[k] = num(x[k]); });
  if (/^\d{4}-\d{2}-\d{2}$/.test(x.date || '')) g.date = x.date; if (x.note != null) g.note = String(x.note).slice(0, 200);
  return { label: '🎯 Ziel ' + g.name + (g.target ? ': ' + eur(g.target, 0) : ''), result: 'gespeichert, id=' + g.id };
}
const GOAL_TOOLS = [{ name: 'set_goal', description: 'Finanzziel anlegen/ändern (z. B. Wohnungseinrichtung, Eigenkapital Immobilie): Zielbetrag, ggf. Obergrenze, Zieldatum, bereits gespart; remove=true entfernt.',
  input_schema: { type: 'object', additionalProperties: false, required: ['name'], properties: { name: { type: 'string' }, target: { type: 'number' }, targetMax: { type: 'number' }, date: { type: 'string' }, saved: { type: 'number' }, note: { type: 'string' }, remove: { type: 'boolean' } } } }];

function fpOverview() {
  const F = fin(), t = finTotals(); if (F.accounts.length < 2) return '';
  return `<section class="card wide"><h2>Depots im Überblick<small>${F.accounts.length}</small></h2>${F.accounts.map((a, i) => { const v = accValue(a), pl = finPL(F.positions.filter(p => p.acc === a.id));
    return `<div class="row fin-pos"><span class="fin-dot" style="background:${FIN_COLORS[i % FIN_COLORS.length]}"></span><button class="t" data-act="fjump" data-id="${a.id}">${esc(a.name)}<small>${t.total ? Math.round(v.total / t.total * 100) : 0} % · ${F.positions.filter(p => p.acc === a.id).length} Positionen</small></button><span class="fin-v">${eur(v.total, 0)}${pl.cost ? `<small class="${pl.abs >= 0 ? 'pos' : 'neg'}">${pl.abs >= 0 ? '▲' : '▼'} ${pct(pl.abs / pl.cost * 100).replace(/^[+-]/, '')}</small>` : ''}</span></div>`; }).join('')}</section>`;
}
function fpGoals() {
  const G = goals(), t = finTotals();
  const rows = G.map(g => {
    const tgt = g.target || 0, saved = g.saved || 0, m = monthsUntil(g.date), rest = Math.max(0, tgt - saved), rate = m ? rest / m : null, p = tgt ? Math.min(100, saved / tgt * 100) : 0;
    return `<div class="goal"><button class="t" data-act="fgoal" data-id="${g.id}">${esc(g.name)}<small>${tgt ? eur(tgt, 0) + (g.targetMax ? '–' + eur(g.targetMax, 0) : '') : 'Betrag offen'}${g.date ? ' · bis ' + H.fdy(g.date) : ''}${g.note ? ' · ' + esc(g.note) : ''}</small></button>
      <div class="goal-bar"><i style="width:${p.toFixed(0)}%"></i></div>
      <div class="goal-kv"><span>gespart ${eur(saved, 0)} (${p.toFixed(0)} %)</span>${rate != null && rest ? `<span>nötig <b>${eur(rate, 0)}/Monat</b> (${m} Mon.)</span>` : rest && tgt ? '<span>Zieldatum fehlt</span>' : ''}</div></div>`;
  }).join('');
  return `<section class="card"><h2>Ziele<small>${G.length}</small></h2>${rows || '<div class="empty">Noch keine Ziele.</div>'}
    <div class="btns"><button class="btn ghost" data-act="fgoal" data-id="">+ Ziel</button></div>
    ${G.length ? `<div class="hint">Summe aller Ziele: ${eur(G.reduce((s, g) => s + (g.target || 0), 0), 0)} – entspricht ${t.total ? Math.round(G.reduce((s, g) => s + (g.target || 0), 0) / t.total * 100) : 0} % deines heutigen Vermögens.</div>` : ''}</section>`;
}
function fpForecast() {
  const F = fin(), t = finTotals(), pmt = F.plans.reduce((s, x) => s + (x.amount || 0), 0);
  if (!t.total && !pmt) return '';
  const yrs = [5, 10, 20], sc = [[3, 'vorsichtig'], [6, 'mittel'], [8, 'optimistisch']];
  const fv = (r, y) => futureValue(t.total, pmt, r, y), paid = y => t.total + pmt * 12 * y;
  const goal = 100000; let yGoal = null; for (let y = 0.5; y <= 40; y += 0.5) if (fv(fpRate, y) >= goal) { yGoal = y; break; }
  // kleines Diagramm: 20 Jahre, gewähltes Szenario vs. nur eingezahlt
  const W = 600, Hh = 140, pad = 6, N = 20, mx = fv(sc[2][0], N), X = y => pad + (W - 2 * pad) * y / N, Y = v => Hh - pad - (Hh - 2 * pad) * v / mx;
  const line = r => Array.from({ length: N * 2 + 1 }, (_, i) => (i ? 'L' : 'M') + X(i / 2).toFixed(1) + ' ' + Y(fv(r, i / 2)).toFixed(1)).join(' ');
  const base = Array.from({ length: N + 1 }, (_, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(paid(i)).toFixed(1)).join(' ');
  return `<section class="card wide"><h2>Vermögensprognose<small>${eur(pmt, 0)}/Monat Sparrate</small></h2>
    <svg class="chart up" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none" role="img" aria-label="Prognose"><path class="cost" d="${base}"/><path class="ln fp-lo" d="${line(sc[0][0])}"/><path class="ln fp-hi" d="${line(sc[2][0])}"/><path class="ln" d="${line(fpRate)}"/></svg>
    <div class="axis"><span>heute</span><span>gestrichelt: nur eingezahlt</span><span>+20 J.</span></div>
    <div class="fin-range">${sc.map(s => `<button class="chip ${fpRate === s[0] ? '' : 'd'}" data-act="frate" data-v="${s[0]}">${s[0]} % ${s[1]}</button>`).join('')}</div>
    <table class="fp-tab"><tr><th></th>${yrs.map(y => `<th>${y} J.</th>`).join('')}</tr>
      <tr><td>eingezahlt</td>${yrs.map(y => `<td>${eur(paid(y), 0)}</td>`).join('')}</tr>
      ${sc.map(s => `<tr class="${fpRate === s[0] ? 'on' : ''}"><td>${s[0]} % p. a.</td>${yrs.map(y => `<td>${eur(fv(s[0], y), 0)}</td>`).join('')}</tr>`).join('')}</table>
    <div class="hint">${yGoal ? `Bei ${fpRate} % p. a. erreichst du <b>100.000 €</b> nach etwa <b>${String(yGoal).replace('.', ',')} Jahren</b>. ` : ''}Rechnung: heutiges Vermögen + Sparrate, monatlich verzinst, vor Steuern, Kosten und Inflation. Keine Anlageberatung – nur ein Szenario.</div></section>`;
}
function fpCheck() {
  const F = fin(), t = finTotals(); if (!F.positions.length || !t.depot) return '';
  const val = p => posValue(p) || 0, share = f => F.positions.filter(f).reduce((s, p) => s + val(p), 0) / t.depot * 100;
  const top = F.positions.slice().sort((a, b) => val(b) - val(a))[0];
  const items = [
    ['Größte Einzelposition', top.name + ' · ' + share(p => p === top).toFixed(0) + ' %'],
    ['Technologie & KI', share(p => finTheme(p) === 'Technologie & KI').toFixed(0) + ' %'],
    ['Krypto', share(p => finTheme(p) === 'Krypto').toFixed(0) + ' %'],
    ['Hebelprodukte', share(p => /2x|3x|leverag|hebel/i.test(p.name)).toFixed(0) + ' %'],
    ['Positionen im Minus', F.positions.filter(p => { const q = posPL(p); return q && q.abs < 0; }).length + ' von ' + F.positions.length],
    ['Ohne ISIN/WKN', F.positions.filter(p => !p.isin && !p.wkn && finTheme(p) !== 'Krypto').length + ' Fonds/ETFs (Kurs-Update sucht über den Namen)'],
  ];
  return `<section class="card"><h2>Struktur-Check<small>neutral, keine Beratung</small></h2>${items.map(i => `<div class="kv"><span>${i[0]}</span><b>${esc(i[1])}</b></div>`).join('')}
    <div class="hint">Frag Odi z. B. „Wie ist mein Depot aufgestellt?“ oder „Rechne mir die Prognose mit 1.000 € Sparrate“.</div></section>`;
}
function fpEditGoal(id) {
  const g = id ? goals().find(x => x.id === id) : null, n2 = v => (v == null ? '' : String(v).replace('.', ','));
  openDlg(`<h3>${g ? esc(g.name) : 'Neues Ziel'}</h3><label class="f">Ziel<input name="n" required value="${esc(g ? g.name : '')}" placeholder="z. B. Notgroschen"></label>
    <div class="f2"><label class="f">Zielbetrag (€)<input name="t" inputmode="decimal" value="${n2(g && g.target)}"></label><label class="f">bis (optional, €)<input name="m" inputmode="decimal" value="${n2(g && g.targetMax)}"></label></div>
    <div class="f2"><label class="f">Zieldatum<input type="date" name="d" value="${esc(g ? g.date : '')}"></label><label class="f">schon gespart (€)<input name="s" inputmode="decimal" value="${n2(g && g.saved)}"></label></div>
    <label class="f">Notiz<input name="o" value="${esc(g ? g.note : '')}"></label>
    <div class="btns"><button class="btn" value="go">Speichern</button>${g ? '<button class="btn ghost" value="del" formnovalidate>Löschen</button>' : ''}<button class="btn ghost" value="cancel" formnovalidate>Abbrechen</button></div>`, (v, f) => {
    if (v === 'del') { goalTool('set_goal', { name: g.name, remove: true }); return save('Ziel gelöscht'); }
    goalTool('set_goal', { id: g && g.id, name: f.n.value, target: f.t.value || null, targetMax: f.m.value || null, date: f.d.value, saved: f.s.value || 0, note: f.o.value });
    const x = goals().find(y => y.name.toLowerCase() === f.n.value.trim().toLowerCase()); if (x) { if (!f.d.value) x.date = ''; if (!f.m.value) x.targetMax = null; }
    save('Gespeichert');
  });
}
function fpAct(act, b) {
  if (act === 'frate') { fpRate = +b.dataset.v; render(); return true; }
  if (act === 'fgoal') { fpEditGoal(b.dataset.id); return true; }
  if (act === 'fjump') { const el = document.getElementById('acc-' + b.dataset.id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return true; }
  return false;
}
