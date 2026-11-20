/* Lebenshub – Rentenrechner: gesetzliche Rente (Entgeltpunkte), Betriebsrente (bAV), private Vorsorge (Depot) vs. Bedarf.
   Alle Ergebnisse in heutiger Kaufkraft. Annahmen in S.life.pension, jederzeit änderbar. */
'use strict';
const RV = { rw: 42.52, rwAb: '01.07.2026', de: 51944, deJahr: 2026, bbg: 101400 }; // aktueller Rentenwert, vorläufiges Durchschnittsentgelt, BBG RV 2026
function pens() {
  const L = life(), sal = L.salary || {};
  L.pension = Object.assign({ birth: null, age: 67, epBefore: 1.0, start: '2025-04-01', gross: sal.gross ? Math.round(sal.gross * 12) : null, growth: 1, bav: 100, bavAg: 0, bavRate: 2.5, depotRate: 5, infl: 2, needPct: 80, withdraw: 4 }, L.pension || {});
  return L.pension;
}
function pensCalc() {
  const P = pens(), F = typeof fin === 'function' ? fin() : { plans: [] }, now = new Date(), y0 = now.getFullYear() + now.getMonth() / 12;
  if (!P.birth || !P.gross) return null;
  const yR = P.birth + P.age, years = Math.max(0, yR - y0);
  // Gesetzlich: Entgeltpunkte pro Jahr = beitragspflichtiges Entgelt / Durchschnittsentgelt (bAV-Umwandlung bis 4 % BBG beitragsfrei)
  const rvPay = Math.min(RV.bbg, Math.max(0, P.gross - Math.min(P.bav * 12, RV.bbg * 0.04)));
  let ep = P.epBefore, epYear = rvPay / RV.de, epList = [];
  const startY = Math.max(y0, 0);
  for (let t = 0; t < years; t += 1) { const share = Math.min(1, years - t), e = Math.min(RV.bbg / RV.de, epYear * Math.pow(1 + P.growth / 100, t)); ep += e * share; epList.push(e); }
  const gross = ep * RV.rw; // heutige Kaufkraft (Rentenwert wächst ungefähr mit den Löhnen)
  const netGov = gross * 0.81; // grob: KV/PV ~ 11 %, Steuer ~ 8 % → ca. 81 % netto
  // bAV: Beiträge real verzinst, Auszahlung 25 Jahre als Rente
  const rBav = (P.bavRate - P.infl) / 100 / 12, n = years * 12, pmtB = P.bav + P.bavAg;
  const capB = rBav ? pmtB * (Math.pow(1 + rBav, n) - 1) / rBav : pmtB * n;
  const ann = (cap, yrs, r) => { const i = r / 100 / 12, m = yrs * 12; return i ? cap * i / (1 - Math.pow(1 + i, -m)) : cap / m; };
  const bavMonth = ann(capB, 25, 0) * 0.82; // Auszahlung über 25 Jahre real, ca. 18 % KV/Steuer
  // Depot: heutiges Vermögen + Sparrate (real), Entnahme nach x-%-Regel
  const tot = typeof finTotals === 'function' ? finTotals().total : 0, save = (typeof lifeTotals === 'function' && lifeTotals().save) || F.plans.reduce((s, x) => s + (x.amount || 0), 0);
  const rD = (P.depotRate - P.infl) / 100 / 12, capD = tot * Math.pow(1 + rD, n) + (rD ? save * (Math.pow(1 + rD, n) - 1) / rD : save * n);
  const depMonth = capD * P.withdraw / 100 / 12 * 0.85; // ca. 15 % Steuer auf Entnahmen (grob)
  const need = (life().salary && life().salary.net ? life().salary.net : (life().income || 0)) * P.needPct / 100;
  return { yR: Math.floor(yR), years, ep, epYear, gross, netGov, capB, bavMonth, capD, depMonth, total: netGov + bavMonth + depMonth, need, save, tot };
}
function pensCard() {
  const P = pens(), R = pensCalc();
  if (!R) return `<section class="card wide"><h2>🧓 Rente</h2><div class="hint">Für die Rentenrechnung fehlen Geburtsjahr oder Bruttogehalt.</div><div class="btns"><button class="btn" data-act="pensEdit">Angaben eintragen</button></div></section>`;
  const parts = [['Gesetzlich (netto, grob)', R.netGov], ['Betriebsrente (bAV)', R.bavMonth], ['Depot-Entnahme', R.depMonth]], gap = R.need - R.total;
  return `<section class="card wide pens"><h2>🧓 Rente mit ${P.age} (${R.yR})<small>in heutiger Kaufkraft</small></h2>
    <div class="fin-total sm">${eur(R.total, 0)}<small class="life-sub"> / Monat</small></div>
    <div class="fin-pills">${gap > 0 ? `<span class="fin-pill neg"><b>Lücke ${eur(gap, 0)}</b><small>zum Ziel ${P.needPct} % vom Netto (${eur(R.need, 0)})</small></span>` : `<span class="fin-pill pos"><b>Ziel erreicht</b><small>+${eur(-gap, 0)} über ${P.needPct} % vom Netto</small></span>`}</div>
    ${finBar(parts.map(p => ({ n: p[0], v: Math.max(0, p[1]) })), R.total || 1)}
    ${finKpis([['Rentenpunkte bis ' + R.yR, R.ep.toFixed(1).replace('.', ',')], ['gesetzl. brutto', eur(R.gross, 0)], ['bAV-Kapital', eur(R.capB, 0)], ['Depot dann', eur(R.capD, 0)]])}
    <div class="hint">Gesetzlich: ${R.epYear.toFixed(2).replace('.', ',')} Punkte pro Jahr (Bruttogehalt ${eur(P.gross, 0)}/Jahr ÷ Durchschnittsentgelt ${RV.deJahr} ${eur(RV.de, 0)}), +${P.growth} % Karriere p. a., bisher ${String(P.epBefore).replace('.', ',')} Punkte · Rentenwert ${RV.rw.toLocaleString('de-DE')} € (ab ${RV.rwAb}).<br>
      bAV: ${eur(P.bav, 0)}${P.bavAg ? ' + ' + eur(P.bavAg, 0) + ' AG' : ''}/Monat zu ${P.bavRate} % p. a. · Depot: ${eur(R.tot, 0)} + ${eur(R.save, 0)}/Monat zu ${P.depotRate} % p. a., Entnahme ${P.withdraw} %/Jahr · Inflation ${P.infl} %.<br>
      Grobe Schätzung, keine Rentenberatung. Genaue Punkte stehen in deiner <b>Renteninformation</b> der Deutschen Rentenversicherung – Foto an Odi schicken, dann rechne ich exakt.</div>
    <div class="btns"><button class="btn ghost" data-act="pensEdit">Annahmen ändern</button></div></section>`;
}
function pensEdit() {
  const P = pens(), f2 = v => (v == null ? '' : String(v).replace('.', ','));
  const fld = (n, l, v, h) => `<label class="f">${l}<input name="${n}" inputmode="decimal" value="${f2(v)}"${h ? ` placeholder="${h}"` : ''}></label>`;
  openDlg(`<h3>Rente – Annahmen</h3>
    <div class="f2">${fld('birth', 'Geburtsjahr', P.birth, 'z. B. 1998')}${fld('age', 'Rentenalter', P.age)}</div>
    <div class="f2">${fld('gross', 'Bruttogehalt/Jahr (€)', P.gross)}${fld('growth', 'Karriere-Plus % p. a.', P.growth)}</div>
    <div class="f2">${fld('epBefore', 'Rentenpunkte bisher', P.epBefore, 'aus Renteninfo')}${fld('needPct', 'Ziel: % vom Netto', P.needPct)}</div>
    <div class="f2">${fld('bav', 'bAV €/Monat', P.bav)}${fld('bavAg', 'AG-Zuschuss €/Monat', P.bavAg)}</div>
    <div class="f2">${fld('bavRate', 'bAV-Verzinsung %', P.bavRate)}${fld('depotRate', 'Depot-Rendite %', P.depotRate)}</div>
    <div class="f2">${fld('infl', 'Inflation %', P.infl)}${fld('withdraw', 'Entnahme %/Jahr', P.withdraw)}</div>
    <div class="hint">„Rentenpunkte bisher“: Werkstudenten-/Minijobs und Praktika vor dem Berufseinstieg – genau steht es in der Renteninformation.</div>
    <div class="btns"><button class="btn" value="go">Speichern</button><button class="btn ghost" value="cancel" formnovalidate>Abbrechen</button></div>`, (v, f) => {
    ['birth', 'age', 'gross', 'growth', 'epBefore', 'needPct', 'bav', 'bavAg', 'bavRate', 'depotRate', 'infl', 'withdraw'].forEach(k => { const x = num(f[k].value); if (x != null) P[k] = x; });
    save('Gespeichert');
  });
}
function pensTool(name, x) {
  if (name !== 'set_pension') return null;
  const P = pens(); ['birth', 'age', 'gross', 'growth', 'epBefore', 'needPct', 'bav', 'bavAg', 'bavRate', 'depotRate', 'infl', 'withdraw'].forEach(k => { if (x[k] != null && num(x[k]) != null) P[k] = num(x[k]); });
  const R = pensCalc(); return { label: '🧓 Rente aktualisiert' + (R ? ': ca. ' + eur(R.total, 0) + '/Monat' : ''), result: 'ok' };
}
const PENS_TOOLS = [{ name: 'set_pension', description: 'Annahmen der Rentenrechnung ändern (z. B. aus der DRV-Renteninformation: epBefore = bisherige Entgeltpunkte; Geburtsjahr, Rentenalter, Brutto/Jahr, bAV-Beitrag, Renditen).',
  input_schema: { type: 'object', additionalProperties: false, properties: { birth: { type: 'number' }, age: { type: 'number' }, gross: { type: 'number' }, growth: { type: 'number' }, epBefore: { type: 'number' }, needPct: { type: 'number' }, bav: { type: 'number' }, bavAg: { type: 'number' }, bavRate: { type: 'number' }, depotRate: { type: 'number' }, infl: { type: 'number' }, withdraw: { type: 'number' } } } }];
function pensAct(act) { if (act === 'pensEdit') { pensEdit(); return true; } return false; }
