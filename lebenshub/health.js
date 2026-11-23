/* Lebenshub – Gesundheits-Cockpit: Erholung, Schlaf, Aktivität, Ernährung, Befinden.
   S.health = { days: { 'JJJJ-MM-TT': { sleep, hrv, rhr, steps, active, stress, spo2, weight, mood, energy, sore, note, src, meals:[{id,time,desc,kcal,p,c,f}] } },
                goals: { kcal, protein, steps, sleep } }
   Quellen: Check-in von Hand, Screenshots (Mi Fitness, Garmin) und Essensfotos über den Assistenten, automatisch über einen Claude-Job (athletedata).
   Alle Werte sind Orientierung, keine medizinische Diagnose. */
'use strict';
const HGOALS = { kcal: 2400, protein: 140, steps: 10000, sleep: 8 };
const HFIELDS = { sleep: 'Schlaf (h)', hrv: 'HRV (ms)', rhr: 'Ruhepuls', steps: 'Schritte', active: 'Aktiv-kcal', stress: 'Stress (1–100)', spo2: 'SpO₂ (%)', weight: 'Gewicht (kg)' };
function hl() {
  if (!S.health) S.health = { days: {}, goals: Object.assign({}, HGOALS) };
  if (!S.health.days) S.health.days = {};
  S.health.goals = Object.assign({}, HGOALS, S.health.goals || {});
  return S.health;
}
function hday(d) { const H0 = hl(), k = /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : H.today(); if (!H0.days[k]) H0.days[k] = { meals: [] }; if (!H0.days[k].meals) H0.days[k].meals = []; return H0.days[k]; }
const nz = v => { const n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : null; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function lastDays(n, from) { const t = from || H.today(), out = []; for (let i = n - 1; i >= 0; i--) out.push(H.add(t, -i)); return out; }
function avgOf(field, days) { const v = days.map(d => (hl().days[d] || {})[field]).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; }

/* Eigene Scores 0–100 (Orientierung): Erholung aus HRV/Ruhepuls gegen den 30-Tage-Schnitt, Schlaf und Befinden */
function scores(d) {
  const raw = hl().days[d] || {}, day = Object.assign({}, raw, { meals: Array.isArray(raw.meals) ? raw.meals : [] }), G = hl().goals, base = lastDays(30, H.add(d, -1));
  const parts = [];
  const hb = avgOf('hrv', base), rb = avgOf('rhr', base);
  if (day.hrv != null && hb) parts.push(clamp(60 + (day.hrv / hb - 1) * 200, 0, 100));
  if (day.rhr != null && rb) parts.push(clamp(60 - (day.rhr - rb) * 6, 0, 100));
  if (day.sleep != null) parts.push(clamp(day.sleep / G.sleep * 100, 0, 100));
  const feel = [day.mood, day.energy].filter(x => x != null);
  if (feel.length) parts.push(clamp((feel.reduce((a, b) => a + b, 0) / feel.length - 1) / 4 * 100, 0, 100));
  if (day.sore != null) parts.push(clamp(100 - (day.sore - 1) * 25, 0, 100));
  const rec = parts.length ? Math.round(parts.reduce((a, b) => a + b, 0) / parts.length) : null;
  const sleep = day.sleep != null ? Math.round(clamp(day.sleep / G.sleep * 100, 0, 100)) : null;
  const act = day.steps != null || day.active != null ? Math.round(clamp(Math.max(day.steps != null ? day.steps / G.steps * 100 : 0, day.active != null ? day.active / 600 * 100 : 0), 0, 100)) : null;
  const kcal = day.meals.reduce((s, m) => s + (m.kcal || 0), 0), prot = day.meals.reduce((s, m) => s + (m.p || 0), 0);
  return { rec, sleep, act, kcal, prot, carbs: day.meals.reduce((s, m) => s + (m.c || 0), 0), fat: day.meals.reduce((s, m) => s + (m.f || 0), 0), n: parts.length };
}
const band = v => v == null ? '' : v >= 67 ? 'good' : v >= 34 ? 'warn' : 'bad';

/* ---------- Werkzeuge (Assistent, Abo-Modus, Claude-Jobs) ---------- */
function healthTool(name, x) {
  if (name === 'set_health_day') {
    const d = hday(x.date), set = [];
    Object.keys(HFIELDS).concat(['mood', 'energy', 'sore']).forEach(k => { const v = nz(x[k]); if (v != null) { d[k] = k === 'steps' ? Math.round(v) : Math.round(v * 10) / 10; set.push(k); } });
    if (x.note) d.note = String(x.note).slice(0, 500);
    if (x.source) d.src = String(x.source).slice(0, 40);
    return { label: '❤️ Gesundheit ' + H.fd(x.date && /^\d{4}/.test(x.date) ? x.date : H.today()) + ': ' + set.map(k => (HFIELDS[k] || k).replace(/ \(.*\)/, '') + ' ' + d[k]).join(', '), result: 'gespeichert: ' + set.join(',') };
  }
  if (name === 'add_meal') {
    const d = hday(x.date), m = { id: uid(), time: /^\d{2}:\d{2}$/.test(x.time || '') ? x.time : new Date().toTimeString().slice(0, 5), desc: String(x.description || 'Mahlzeit').slice(0, 200),
      kcal: Math.round(nz(x.kcal) || 0), p: Math.round(nz(x.protein) || 0), c: Math.round(nz(x.carbs) || 0), f: Math.round(nz(x.fat) || 0) };
    d.meals.push(m);
    return { label: '🍽 ' + m.desc + ' · ' + m.kcal + ' kcal, ' + m.p + ' g Eiweiß', result: 'gespeichert, Tagessumme ' + scores(x.date || H.today()).kcal + ' kcal' };
  }
  if (name === 'set_health_goals') {
    const G = hl().goals; ['kcal', 'protein', 'steps', 'sleep'].forEach(k => { const v = nz(x[k]); if (v != null) G[k] = v; });
    return { label: '🎯 Ziele: ' + G.kcal + ' kcal, ' + G.protein + ' g Eiweiß, ' + G.steps + ' Schritte, ' + G.sleep + ' h Schlaf', result: 'ok' };
  }
  return null;
}
const HEALTH_TOOLS = [
  { name: 'set_health_day', description: 'Gesundheitswerte eines Tages speichern – aus Uhr-/App-Screenshots (Mi Fitness, Garmin), aus dem Check-in oder aus Daten von athletedata. Nur Felder angeben, die bekannt sind.',
    input_schema: { type: 'object', additionalProperties: false, properties: { date: { type: 'string', description: 'JJJJ-MM-TT (Aufwachtag); Standard heute' },
      sleep: { type: 'number', description: 'Schlafdauer in Stunden' }, hrv: { type: 'number' }, rhr: { type: 'number', description: 'Ruhepuls' }, steps: { type: 'number' }, active: { type: 'number', description: 'aktive kcal' },
      stress: { type: 'number', description: '1–100' }, spo2: { type: 'number' }, weight: { type: 'number' }, mood: { type: 'number', description: 'Stimmung 1–5' }, energy: { type: 'number', description: 'Energie 1–5' },
      sore: { type: 'number', description: 'Muskelkater/Schmerz 1–5' }, note: { type: 'string' }, source: { type: 'string', description: 'z. B. Mi Fitness, Garmin, Check-in' } } } },
  { name: 'add_meal', description: 'Mahlzeit ins Ernährungstagebuch – z. B. aus einem Essensfoto. Nährwerte sind Schätzungen; Portion realistisch annehmen.',
    input_schema: { type: 'object', additionalProperties: false, required: ['description', 'kcal'], properties: { date: { type: 'string' }, time: { type: 'string', description: 'HH:MM' }, description: { type: 'string' },
      kcal: { type: 'number' }, protein: { type: 'number' }, carbs: { type: 'number' }, fat: { type: 'number' } } } },
  { name: 'set_health_goals', description: 'Tagesziele setzen: kcal, Eiweiß (g), Schritte, Schlaf (h).',
    input_schema: { type: 'object', additionalProperties: false, properties: { kcal: { type: 'number' }, protein: { type: 'number' }, steps: { type: 'number' }, sleep: { type: 'number' } } } }
];
function healthSnapshotText() {
  const H0 = hl(), out = {};
  lastDays(7).forEach(d => { const x = H0.days[d]; if (x) { const s = scores(d); out[d] = { schlaf: x.sleep, hrv: x.hrv, rp: x.rhr, schritte: x.steps, stimmung: x.mood, energie: x.energy, kcal: s.kcal, eiweiss: s.prot, erholung: s.rec, essen: x.meals.map(m => m.desc).slice(0, 6) }; } });
  return JSON.stringify({ ziele: H0.goals, tage: out });
}

/* ---------- Ansicht ---------- */
function ring(v, label, sub) {
  const r = 34, c = 2 * Math.PI * r, p = v == null ? 0 : v / 100;
  return `<div class="ring ${band(v)}"><svg viewBox="0 0 84 84"><circle class="bg" cx="42" cy="42" r="${r}"/><circle class="fg" cx="42" cy="42" r="${r}" stroke-dasharray="${(c * p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 42 42)"/></svg>
    <div class="rv">${v == null ? '–' : v + '<small>%</small>'}</div><div class="rl">${label}</div>${sub ? `<div class="rs">${sub}</div>` : ''}</div>`;
}
function spark(vals, cls) {
  const pts = vals.map((v, i) => [i, v]).filter(p => p[1] != null);
  if (pts.length < 2) return '<span class="hint">zu wenig Daten</span>';
  const W = 140, Hh = 32, mn = Math.min(...pts.map(p => p[1])), mx = Math.max(...pts.map(p => p[1])), rg = mx - mn || 1;
  const d = pts.map((p, j) => (j ? 'L' : 'M') + (p[0] / (vals.length - 1) * W).toFixed(1) + ' ' + (Hh - 3 - (p[1] - mn) / rg * (Hh - 6)).toFixed(1)).join(' ');
  return `<svg class="spark ${cls || ''}" viewBox="0 0 ${W} ${Hh}" preserveAspectRatio="none"><path d="${d}"/></svg>`;
}
function bar(v, goal, label, unit) {
  const p = goal ? clamp(v / goal * 100, 0, 100) : 0;
  return `<div class="hbar"><div class="hbl"><span>${label}</span><span>${Math.round(v)} / ${Math.round(goal)} ${unit}</span></div><div class="bar"><i style="width:${p}%"></i></div></div>`;
}
function healthTips(t) {
  const tips = [], G = hl().goals, L7 = lastDays(7, t), H0 = hl();
  const shortSleep = L7.filter(d => (H0.days[d] || {}).sleep != null && H0.days[d].sleep < 7).length;
  if (shortSleep >= 3) tips.push(`An ${shortSleep} der letzten 7 Nächte unter 7 h Schlaf – heute früher ins Bett.`);
  const s = scores(t);
  if (s.rec != null && s.rec < 34) tips.push('Erholung niedrig: heute locker bewegen statt hart trainieren.');
  if (s.kcal && s.prot < G.protein * 0.6 && new Date().getHours() >= 15) tips.push(`Erst ${s.prot} g Eiweiß – eine eiweißreiche Mahlzeit einplanen (Ziel ${G.protein} g).`);
  const st = avgOf('steps', L7); if (st != null && st < G.steps * 0.6) tips.push(`Ø ${Math.round(st)} Schritte diese Woche – ein täglicher Spaziergang bringt viel.`);
  if (!H0.days[t] || (H0.days[t].mood == null && H0.days[t].sleep == null)) tips.push('Heute noch kein Check-in – 20 Sekunden für Schlaf und Befinden.');
  return tips.slice(0, 3);
}
function healthView() {
  const t = H.today(), d = Object.assign({ meals: [] }, hl().days[t] || {}), s = scores(t), G = hl().goals, L14 = lastDays(14);
  const recs = L14.map(x => scores(x).rec);
  const tips = healthTips(t);
  return `<section class="card wide hc">
    <h2>Gesundheit heute<small>${d.src ? 'Quelle: ' + esc(d.src) : 'Check-in, Uhr-Screenshots oder athletedata'}</small></h2>
    <div class="rings">${ring(s.rec, 'Erholung', d.hrv != null ? 'HRV ' + d.hrv + ' ms' : d.rhr != null ? 'Ruhepuls ' + d.rhr : '')}${ring(s.sleep, 'Schlaf', d.sleep != null ? d.sleep.toLocaleString('de-DE') + ' h' : '')}${ring(s.act, 'Aktivität', d.steps != null ? d.steps.toLocaleString('de-DE') + ' Schritte' : '')}</div>
    ${tips.length ? `<ul class="tips">${tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    <div class="btns"><button class="btn" data-act="hcheck">Check-in</button><button class="btn ghost" data-act="hmeal">+ Mahlzeit (Foto)</button><button class="btn ghost" data-act="hshot">Uhr-Screenshot</button>${ART.mcp ? `<button class="btn ghost" data-act="hdrive">${S.settings.driveHealth ? 'Apple Health abrufen' : 'Apple Health verbinden'}</button>` : ''}${ART.sample || (typeof getKey === 'function' && getKey()) ? '<button class="btn ghost" data-act="hana">Analyse</button>' : ''}</div></section>
  <section class="card"><h2>Ernährung heute<small>${d.meals.length} Mahlzeit(en)</small></h2>
    ${bar(s.kcal, G.kcal, 'Kalorien', 'kcal')}${bar(s.prot, G.protein, 'Eiweiß', 'g')}
    <div class="macro"><span>Kohlenhydrate <b>${s.carbs} g</b></span><span>Fett <b>${s.fat} g</b></span></div>
    ${d.meals.map(m => `<div class="row"><button class="t" data-act="hmedit" data-id="${m.id}">${esc(m.desc)}<small>${esc(m.time)} · ${m.p} g E · ${m.c} g KH · ${m.f} g F</small></button><span class="fin-v">${m.kcal} kcal</span></div>`).join('') || '<div class="empty">Noch nichts erfasst. Fotografier dein Essen – Claude schätzt die Nährwerte.</div>'}
    <div class="hint">Nährwerte aus Fotos sind Schätzungen (±30 %).</div></section>
  <section class="card"><h2>Verlauf 14 Tage</h2>
    <div class="kv"><span>Erholung</span><span>${spark(recs, 'ok')}</span></div>
    <div class="kv"><span>Schlaf</span><span>${spark(L14.map(x => (hl().days[x] || {}).sleep))}</span></div>
    <div class="kv"><span>Ruhepuls</span><span>${spark(L14.map(x => (hl().days[x] || {}).rhr), 'bad')}</span></div>
    <div class="kv"><span>Schritte</span><span>${spark(L14.map(x => (hl().days[x] || {}).steps))}</span></div>
    <div class="kv"><span>Kalorien</span><span>${spark(L14.map(x => scores(x).kcal || null))}</span></div>
    <div class="btns"><button class="btn ghost" data-act="hgoals">Ziele</button></div></section>`;
}
function checkIn() {
  const d = hday(H.today()), sel = (n, v) => `<select name="${n}"><option value="">–</option>${[1, 2, 3, 4, 5].map(i => `<option ${v === i ? 'selected' : ''}>${i}</option>`).join('')}</select>`;
  openDlg(`<h3>Check-in ${H.fd(H.today())}</h3>
    <div class="f2"><label class="f">Schlaf (h)<input type="text" inputmode="decimal" name="sleep" value="${d.sleep != null ? String(d.sleep).replace('.', ',') : ''}"></label>
    <label class="f">Ruhepuls<input type="text" inputmode="numeric" name="rhr" value="${d.rhr != null ? d.rhr : ''}"></label></div>
    <div class="f2"><label class="f">Stimmung 1–5${sel('mood', d.mood)}</label><label class="f">Energie 1–5${sel('energy', d.energy)}</label><label class="f">Schmerz 1–5${sel('sore', d.sore)}</label></div>
    <div class="f2"><label class="f">Schritte<input type="text" inputmode="numeric" name="steps" value="${d.steps != null ? d.steps : ''}"></label>
    <label class="f">Gewicht (kg)<input type="text" inputmode="decimal" name="weight" value="${d.weight != null ? String(d.weight).replace('.', ',') : ''}"></label></div>
    <label class="f">Notiz<input type="text" name="note" value="${esc(d.note || '')}" placeholder="z. B. Knie zwickt, gut geschlafen"></label>
    <div class="hint">5 = sehr gut (bei Schmerz: 5 = stark).</div>${dlgBtns(false)}`, (v, f) => {
    healthTool('set_health_day', { sleep: f.sleep.value, rhr: f.rhr.value, mood: f.mood.value, energy: f.energy.value, sore: f.sore.value, steps: f.steps.value, weight: f.weight.value, note: f.note.value, source: d.src || 'Check-in' });
    save('Check-in gespeichert');
  });
}
function editMeal(id) {
  const d = hday(H.today()), m = d.meals.find(x => x.id === id);
  if (!m) return;
  openDlg(`<h3>Mahlzeit</h3><label class="f">Beschreibung<input type="text" name="desc" value="${esc(m.desc)}"></label>
    <div class="f2"><label class="f">kcal<input type="text" inputmode="numeric" name="kcal" value="${m.kcal}"></label><label class="f">Eiweiß g<input type="text" inputmode="numeric" name="p" value="${m.p}"></label></div>
    <div class="f2"><label class="f">KH g<input type="text" inputmode="numeric" name="c" value="${m.c}"></label><label class="f">Fett g<input type="text" inputmode="numeric" name="f" value="${m.f}"></label></div>${dlgBtns(true)}`, (v, f) => {
    if (v === 'del') { d.meals = d.meals.filter(x => x !== m); return save('Gelöscht'); }
    m.desc = f.desc.value; ['kcal', 'p', 'c', 'f'].forEach(k => { m[k] = Math.round(nz(f[k].value) || 0); }); save('Gespeichert');
  });
}
function editGoals() {
  const G = hl().goals;
  openDlg(`<h3>Tagesziele</h3><div class="f2"><label class="f">kcal<input type="text" inputmode="numeric" name="kcal" value="${G.kcal}"></label><label class="f">Eiweiß g<input type="text" inputmode="numeric" name="protein" value="${G.protein}"></label></div>
    <div class="f2"><label class="f">Schritte<input type="text" inputmode="numeric" name="steps" value="${G.steps}"></label><label class="f">Schlaf h<input type="text" inputmode="decimal" name="sleep" value="${String(G.sleep).replace('.', ',')}"></label></div>
    <div class="hint">Richtwerte, keine medizinische Empfehlung.</div>${dlgBtns(false)}`, (v, f) => { healthTool('set_health_goals', { kcal: f.kcal.value, protein: f.protein.value, steps: f.steps.value, sleep: f.sleep.value }); save('Ziele gespeichert'); });
}
async function healthAnalysis() {
  busy(true);
  try {
    const out = await askJson('Du bist ein sachlicher Gesundheits- und Ernährungscoach (keine Diagnose). Werte meine Daten der letzten 7 Tage aus und antworte nur mit JSON {"kurz":"2–3 Sätze Gesamtbild","staerken":["…"],"hinweise":["konkreter Tipp", "…"],"rezeptideen":["gesundes Gericht passend zu meinen Lücken (Thermomix-tauglich, wenn möglich)", "…"]}. Höchstens je 3 Punkte. Bei Warnzeichen zum Arzt raten.\n\n' + healthSnapshotText());
    openDlg(`<h3>Gesundheits-Analyse</h3><div class="hint">${esc(out.kurz || '')}</div>
      ${['staerken', 'hinweise', 'rezeptideen'].map(k => Array.isArray(out[k]) && out[k].length ? `<div class="hint" style="margin-top:6px"><b>${{ staerken: 'Gut läuft', hinweise: 'Tipps', rezeptideen: 'Rezeptideen' }[k]}</b><ul class="acts">${out[k].map(x => `<li>• ${esc(x)}</li>`).join('')}</ul></div>` : '').join('')}
      <div class="btns"><button class="btn ghost" value="cancel">Schließen</button></div>`, () => {});
  } catch (e) { toast(e.message || 'Analyse nicht möglich'); } finally { busy(false); }
}
function healthAct(act, b) {
  if (act === 'hcheck') { checkIn(); return true; }
  if (act === 'hgoals') { editGoals(); return true; }
  if (act === 'hmedit') { editMeal(b.dataset.id); return true; }
  if (act === 'hana') { healthAnalysis(); return true; }
  if (act === 'hdrive') { S.settings.driveHealth = true; driveHealthImport(true); return true; }
  if (act === 'hmeal' || act === 'hshot') {
    TAB = 'chat'; chatDraft = act === 'hmeal' ? 'Das habe ich gerade gegessen – bitte ins Ernährungstagebuch eintragen und mir sagen, was mir heute noch fehlt.' : 'Hier ist mein Uhr-Screenshot – bitte die Werte für heute übernehmen.';
    render(); const fi = $('chatFile'); if (fi) fi.click();
    return true;
  }
  return false;
}

/* ---------- Apple Health über Google Drive (iPhone-Kurzbefehl legt täglich „lebenshub-gesundheit-JJJJ-MM-TT“ ab) ----------
   Der Hub liest die Dateien über den Google-Drive-Connector des Nutzers (Capability „mcp“), ohne Job und ohne Zusatzkosten. */
const DRIVE = 'Google Drive';
function collect(o, pick, out) { // durchläuft beliebige Antwortformen
  if (o == null) return out;
  if (Array.isArray(o)) { o.forEach(x => collect(x, pick, out)); return out; }
  if (typeof o === 'object') { pick(o, out); Object.keys(o).forEach(k => collect(o[k], pick, out)); }
  return out;
}
function parseHealthText(txt, fallbackDate) {
  const get = re => { const m = txt.match(re); if (!m) return null; let v = m[1].replace(/[.,]$/, ''); if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(v) || v.includes(',')) v = v.replace(/\./g, '').replace(',', '.'); const n = parseFloat(v); return isFinite(n) ? n : null; };
  const dm = txt.match(/datum\s*[:=]\s*(\d{4}-\d{2}-\d{2})/i) || txt.match(/(\d{4}-\d{2}-\d{2})/);
  const out = { date: dm ? dm[1] : fallbackDate, source: 'Apple Health' };
  let sl = get(/schlaf[^:\n]*[:=]\s*([\d.,]+)/i);
  if (sl != null) { if (sl > 1440) sl /= 3600; else if (sl > 24) sl /= 60; if (sl >= 2 && sl <= 14) out.sleep = Math.round(sl * 10) / 10; }
  const rng = (k, re, a, b) => { const v = get(re); if (v != null && v >= a && v <= b) out[k] = v; };
  rng('rhr', /ruhepuls[^:\n]*[:=]\s*([\d.,]+)/i, 30, 110);
  rng('hrv', /hrv[^:\n]*[:=]\s*([\d.,]+)/i, 5, 250);
  rng('steps', /schritte[^:\n]*[:=]\s*([\d.,]+)/i, 0, 80000);
  rng('active', /aktiv[^:\n]*[:=]\s*([\d.,]+)/i, 0, 6000);
  rng('weight', /gewicht[^:\n]*[:=]\s*([\d.,]+)/i, 35, 250);
  return out;
}
async function driveHealthImport(manual) {
  const mcp = ART.mcp;
  if (!mcp) { if (manual) toast('Google Drive ist hier nicht verfügbar – bitte den Lebenshub in Claude öffnen.'); return; }
  const H0 = hl(); H0.imported = H0.imported || {};
  try {
    if (manual) toast('Suche neue Apple-Health-Daten in Google Drive …');
    const since = new Date(Date.now() - 8 * 864e5).toISOString().slice(0, 19) + 'Z';
    const r = await mcp.callTool(DRIVE, 'search_files', { query: "title contains 'lebenshub-gesundheit' and trashed = false and modifiedTime > '" + since + "'", orderBy: 'modifiedTime desc', pageSize: 8, excludeContentSnippets: true }, { cache: false });
    const files = collect(r.payload != null ? r.payload : r, (o, out) => { const t = o.title || o.name; if (o.id && t && /lebenshub-gesundheit/i.test(t)) out.push({ id: String(o.id), title: String(t), mod: o.modifiedTime || '' }); }, [])
      .filter((f, i, a) => a.findIndex(x => x.id === f.id) === i);
    let n = 0; const labels = [];
    for (const f of files.slice(0, 8)) {
      const fd = (f.title.match(/(\d{4}-\d{2}-\d{2})/) || [])[1] || H.today();
      if (H0.imported[f.id] && H0.imported[f.id] === f.mod) continue;
      const c = await mcp.callTool(DRIVE, 'read_file_content', { fileId: f.id }, { cache: false });
      const txt = collect(c, (o, out) => { Object.keys(o).forEach(k => { if (typeof o[k] === 'string' && o[k].length > 5) out.push(o[k]); }); }, []).join('\n');
      const vals = parseHealthText(txt, fd);
      if (Object.keys(vals).length > 2) { labels.push(healthTool('set_health_day', vals).label); n++; }
      H0.imported[f.id] = f.mod || 'x';
    }
    S.settings.lastDriveHealth = H.today();
    if (n) { S.jobLog = [{ source: 'Apple Health (Google Drive)', at: new Date().toISOString(), summary: n + ' Tag(e) übernommen', labels }].concat(S.jobLog || []).slice(0, 30); }
    save(n ? 'Apple Health: ' + n + ' Tag(e) übernommen' : (manual ? (files.length ? 'Keine neuen Werte.' : 'Noch keine Datei „lebenshub-gesundheit-…“ in Google Drive gefunden.') : undefined));
  } catch (e) {
    const code = e && e.code;
    if (manual || code === 'needs_reauth') toast(code === 'needs_reauth' ? 'Google Drive bitte in den Claude-Einstellungen neu verbinden.' : code === 'server_not_connected' ? 'Google Drive ist in Claude nicht verbunden (Einstellungen → Connectors).' : code === 'not_in_manifest' ? 'Zugriff auf Google Drive wurde für den Hub nicht erlaubt.' : 'Import nicht möglich (' + (code || e.message || '?') + ').');
  }
}
/* Einmal täglich beim Öffnen, wenn eingeschaltet */
function driveHealthAuto() { if (S.settings && S.settings.driveHealth && ART.mcp && S.settings.lastDriveHealth !== H.today()) driveHealthImport(false); }
