/* Lebenshub – Gehirn: verknüpft alle Daten (Wissen, Dokumente, Listen, Routinen, Depot) zu einem Netz.
   Verbindungen entstehen automatisch über Themen und Schlagworte; Claude lässt das Netz regelmäßig wachsen
   (neue Verknüpfungen, Themen, Erkenntnisse, offene Fragen). Daten: S.brain = { links:[{a,b,why}], insights:[{id,text,refs,at}],
   topics:{nodeId:[thema]}, questions:[], grown } */
'use strict';
const BR_TYPES = { know: ['Wissen', '#7c5cff'], doc: ['Dokument', '#2f8fdd'], item: ['Eintrag', '#16a085'], rt: ['Routine', '#e67e22'], pos: ['Depot', '#c0392b'], topic: ['Thema', '#8a8f98'] };
const BR_STOP = new Set('aber alle allem allen alles also auch beim bitte dann damit dass dein deine diese dieser dieses doch eine einem einen einer eines etwa euro für gegen haben hatte heute immer jede jeden jeder jedes kann keine machen mehr meine meinem meinen meiner mich mit nach nicht noch oder ohne schon sehr seit sein sich sind soll über unter viel vom von vor wann warum weil wenn werden wieder will wird woche zum zur zwischen zusammenfassung skript notiz eintrag termin prüfen offen erledigt'.split(' '));
let brSel = null, brBusy = false, brQ = '', brAllIns = false;
function brain() { S.brain = Object.assign({ links: [], insights: [], topics: {}, questions: [], facts: [], grown: '' }, S.brain || {}); return S.brain; }
const brWords = s => Array.from(new Set(String(s || '').toLowerCase().replace(/[^a-zäöüß0-9 -]/g, ' ').split(/[\s-]+/).filter(w => w.length >= 5 && !BR_STOP.has(w) && !/^\d+$/.test(w))));
function brNodes() {
  const N = [];
  (typeof know === 'function' ? know() : []).forEach(k => N.push({ id: 'know:' + k.id, type: 'know', label: k.title, tags: k.tags || [], text: k.title + ' ' + (k.tags || []).join(' ') + ' ' + (k.summary || '').slice(0, 300) }));
  (typeof DOCS !== 'undefined' ? DOCS : []).forEach(d => { if (S.know && Array.isArray(S.know) && d.analysis && S.know.some(k => k.title === d.analysis.title)) return; N.push({ id: 'doc:' + d.id, type: 'doc', label: (d.analysis && d.analysis.title) || d.name, tags: [], text: ((d.analysis && d.analysis.title) || d.name) + ' ' + ((d.analysis && d.analysis.summary) || '').slice(0, 300) }); });
  C.forEach(c => S.lists[c.k].forEach(it => N.push({ id: 'item:' + c.k + ':' + it.id, type: 'item', label: it.n, tags: [c.title], text: it.n + ' ' + (it.t || '') })));
  S.routines.forEach(r => N.push({ id: 'rt:' + r.id, type: 'rt', label: r.n, tags: [], text: r.n + ' ' + (r.note || '') }));
  ((S.fin && S.fin.positions) || []).forEach(p => N.push({ id: 'pos:' + p.id, type: 'pos', label: p.name, tags: ['Depot'], text: p.name }));
  const T = brain().topics; N.forEach(n => { if (T[n.id]) n.tags = Array.from(new Set(n.tags.concat(T[n.id]))); });
  return N;
}
/* Netz: Knoten + Themen-Knoten + Kanten (Themen, gemeinsame Schlagworte, von Claude gefundene Verknüpfungen) */
function brGraph() {
  const N = brNodes(), byId = {}, E = [], seen = new Set();
  N.forEach(n => { byId[n.id] = n; n.words = brWords(n.text); });
  const add = (a, b, why, kind) => { if (!byId[a] || !byId[b] || a === b) return; const k = a < b ? a + '|' + b : b + '|' + a; if (seen.has(k)) return; seen.add(k); E.push({ a, b, why, kind }); };
  const tc = {}; N.forEach(n => n.tags.forEach(t => { const k = t.toLowerCase(); (tc[k] = tc[k] || { name: t, ids: [] }).ids.push(n.id); }));
  Object.values(tc).filter(t => t.ids.length >= 2).forEach(t => { const id = 'topic:' + t.name.toLowerCase(); const n = { id, type: 'topic', label: t.name, tags: [], words: [] }; N.push(n); byId[id] = n; t.ids.forEach(x => add(id, x, 'Thema ' + t.name, 'topic')); });
  const df = {}; N.forEach(n => n.words.forEach(w => { df[w] = (df[w] || 0) + 1; }));
  const items = N.filter(n => n.type !== 'topic');
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const sh = items[i].words.filter(w => df[w] >= 2 && df[w] <= 6 && items[j].words.includes(w));
    if (sh.length >= 2 || (sh.length === 1 && sh[0].length >= 9)) add(items[i].id, items[j].id, 'gemeinsam: ' + sh.slice(0, 3).join(', '), 'word');
  }
  brain().links.forEach(l => add(l.a, l.b, l.why, 'claude'));
  const deg = {}; E.forEach(e => { deg[e.a] = (deg[e.a] || 0) + 1; deg[e.b] = (deg[e.b] || 0) + 1; });
  N.forEach(n => { n.deg = deg[n.id] || 0; });
  return { N, E, byId };
}
/* Kräfte-Layout, deterministisch (gleiche Daten → gleiches Bild) */
function brLayout(G, W, Hh) {
  const ns = G.N.filter(n => n.deg > 0).sort((a, b) => b.deg - a.deg).slice(0, 140), idx = {};
  ns.forEach((n, i) => { idx[n.id] = i; const a = i * 2.39996, r = 0.42 * Math.sqrt((i + 0.5) / ns.length); n.x = W / 2 + Math.cos(a) * r * W; n.y = Hh / 2 + Math.sin(a) * r * Hh; n.vx = 0; n.vy = 0; });
  const es = G.E.filter(e => idx[e.a] != null && idx[e.b] != null), k = 0.7 * Math.sqrt(W * Hh / Math.max(1, ns.length)), g = 0.16 * ns.length / 10;
  let temp = W / 8;
  for (let it = 0; it < 220; it++) {
    ns.forEach(n => { n.dx = 0; n.dy = 0; });
    for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
      const a = ns[i], b = ns[j]; let dx = a.x - b.x, dy = a.y - b.y; const d = Math.max(0.5, Math.sqrt(dx * dx + dy * dy)), f = k * k / d;
      dx = dx / d * f; dy = dy / d * f; a.dx += dx; a.dy += dy; b.dx -= dx; b.dy -= dy;
    }
    es.forEach(e => { const a = ns[idx[e.a]], b = ns[idx[e.b]]; let dx = a.x - b.x, dy = a.y - b.y; const d = Math.max(0.5, Math.sqrt(dx * dx + dy * dy)), f = d * d / k;
      dx = dx / d * f; dy = dy / d * f; a.dx -= dx; a.dy -= dy; b.dx += dx; b.dy += dy; });
    ns.forEach(n => { n.dx += (W / 2 - n.x) * g; n.dy += (Hh / 2 - n.y) * g;
      const d = Math.sqrt(n.dx * n.dx + n.dy * n.dy) || 1, m = Math.min(d, temp);
      n.x = Math.max(12, Math.min(W - 12, n.x + n.dx / d * m)); n.y = Math.max(14, Math.min(Hh - 10, n.y + n.dy / d * m)); });
    temp = Math.max(0.5, temp * 0.975);
  }
  return { ns, es, idx };
}
function brSvg(G) {
  const W = 360, Hh = 340, L = brLayout(G, W, Hh), q = brQ.toLowerCase();
  const hit = n => q && (n.label.toLowerCase().includes(q) || n.tags.some(t => t.toLowerCase().includes(q)));
  const big = new Set(L.ns.filter(n => n.type === 'topic').sort((a, b) => b.deg - a.deg).slice(0, 8).map(n => n.id));
  const near = new Set(); if (brSel) G.E.forEach(e => { if (e.a === brSel) near.add(e.b); if (e.b === brSel) near.add(e.a); });
  const lines = L.es.map(e => { const a = L.ns[L.idx[e.a]], b = L.ns[L.idx[e.b]], on = brSel && (e.a === brSel || e.b === brSel);
    return `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" class="br-e ${e.kind}${on ? ' on' : ''}"/>`; }).join('');
  const dots = L.ns.map(n => { const r = n.type === 'topic' ? 3.5 + Math.min(6, n.deg / 2) : 3 + Math.min(3, n.deg / 2), dim = (brSel && n.id !== brSel && !near.has(n.id)) || (q && !hit(n));
    return `<g class="br-n${dim ? ' dim' : ''}" data-act="bnode" data-id="${esc(n.id)}"><circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${r.toFixed(1)}" fill="${BR_TYPES[n.type][1]}"/>${big.has(n.id) || n.id === brSel || near.has(n.id) || hit(n) ? `<text x="${n.x.toFixed(1)}" y="${(n.y - r - 3).toFixed(1)}">${esc(n.label.slice(0, 22))}</text>` : ''}<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="12" fill="transparent"/></g>`; }).join('');
  return `<svg class="brain-svg" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Netz deines Wissens">${lines}${dots}</svg>`;
}
function brainView() {
  const G = brGraph(), B = brain(), items = G.N.filter(n => n.type !== 'topic'), linked = items.filter(n => n.deg > 0).length;
  const sel = brSel && G.byId[brSel];
  const conn = sel ? G.E.filter(e => e.a === sel.id || e.b === sel.id).map(e => ({ n: G.byId[e.a === sel.id ? e.b : e.a], why: e.why })).slice(0, 12) : [];
  return `<section class="card wide brain"><h2>Gehirn<small>${items.length} Knoten · ${G.E.length} Verbindungen · ${G.N.filter(n => n.type === 'topic').length} Themen</small></h2>
    <input type="search" id="brQ" placeholder="Im Gehirn suchen …" value="${esc(brQ)}" autocomplete="off">
    ${linked ? brSvg(G) : '<div class="hint">Noch zu wenig verknüpft. Füge Wissen, Dokumente oder Einträge hinzu – oder lass Claude das Gehirn wachsen.</div>'}
    <div class="br-legend">${Object.values(BR_TYPES).map(t => `<span><i style="background:${t[1]}"></i>${t[0]}</span>`).join('')}</div>
    ${sel ? `<div class="br-sel"><b>${esc(sel.label)}</b> <span class="chip d">${BR_TYPES[sel.type][0]}</span>${sel.type !== 'topic' ? ` <button class="chip" data-act="bopen" data-id="${esc(sel.id)}">öffnen</button>` : ''} <button class="chip d" data-act="bnode" data-id="">✕</button>
      ${conn.map(c => `<div class="row"><button class="t" data-act="bnode" data-id="${esc(c.n.id)}">${esc(c.n.label)}<small>${esc(BR_TYPES[c.n.type][0])} · ${esc(c.why || '')}</small></button></div>`).join('') || '<div class="hint">Noch keine Verbindungen.</div>'}</div>` : '<div class="hint">Punkt antippen → Verbindungen sehen und öffnen.</div>'}
    ${brInsights(G, B, sel)}
    ${(B.facts || []).length ? `<h3 class="br-h">Gemerkt<small> ${B.facts.length}</small></h3>${B.facts.slice(0, brAllIns ? 30 : 5).map(f => `<div class="br-ins br-fact"><span class="chip d">${esc(f.kind || 'Fakt')}</span> ${esc(f.text)} <button class="chip d" data-act="bfactdel" data-id="${esc(f.id)}" aria-label="Vergessen">✕</button></div>`).join('')}` : ''}
    ${B.questions.length ? `<h3 class="br-h">Offene Fragen</h3>${B.questions.slice(0, 4).map(x => `<button class="br-q" data-act="bask" data-v="${esc(x)}">❓ ${esc(x)}</button>`).join('')}` : ''}
    <div class="btns">${ART.sample || (typeof getKey === 'function' && getKey()) ? `<button class="btn" data-act="bgrow" ${brBusy ? 'disabled' : ''}>${brBusy ? 'Gehirn denkt …' : '🧠 Gehirn wachsen lassen'}</button>` : ''}<button class="btn ghost" data-act="bask" data-v="">Gehirn fragen</button></div>
    <div class="hint">${B.grown ? 'Zuletzt gewachsen: ' + esc(H.fd(B.grown.slice(0, 10))) + ' · ' : ''}Wächst von selbst alle 3 Tage beim Öffnen und mit jedem neuen Dokument, Wissen oder Eintrag.</div></section>`;
}
/* Erkenntnisse: zum gewählten Knoten bzw. zur Suche passend, mit antippbaren Bezügen */
function brInsights(G, B, sel) {
  if (!B.insights.length) return '';
  const q = brQ.trim().toLowerCase(), lab = r => G.byId[r] && G.byId[r].label;
  let L = B.insights;
  if (sel) L = L.filter(i => (i.refs || []).includes(sel.id));
  else if (q) L = L.filter(i => i.text.toLowerCase().includes(q) || (i.refs || []).some(r => String(lab(r) || '').toLowerCase().includes(q)));
  const n = brAllIns ? L.length : Math.min(L.length, 6);
  const title = sel ? 'Erkenntnisse zu „' + esc(sel.label.slice(0, 40)) + '“' : q ? 'Passende Erkenntnisse' : 'Erkenntnisse';
  if (!L.length) return '';
  return `<h3 class="br-h">${title}<small> ${L.length}</small></h3>${L.slice(0, n).map(i => `<div class="br-ins">💡 ${esc(i.text)}${(i.refs || []).filter(lab).length ? `<div class="br-refs">${(i.refs || []).filter(lab).slice(0, 4).map(r => `<button class="chip d" data-act="bnode" data-id="${esc(r)}">${esc(String(lab(r)).slice(0, 28))}</button>`).join('')}</div>` : ''}</div>`).join('')}
    ${L.length > 6 ? `<button class="btn ghost" data-act="bins">${brAllIns ? 'Weniger zeigen' : 'Alle ' + L.length + ' zeigen'}</button>` : ''}`;
}
/* Claude lässt das Gehirn wachsen */
async function brainGrow(silent) {
  if (brBusy) return; const G = brGraph(), items = G.N.filter(n => n.type !== 'topic');
  if (items.length < 4) { if (!silent) toast('Noch zu wenig Daten für das Gehirn.'); return; }
  brBusy = true; if (!silent) { busy(true); render(); }
  try {
    const list = items.slice(0, 260).map(n => [n.id, BR_TYPES[n.type][0], n.label.slice(0, 90), n.tags.slice(0, 5).join(',')]);
    const B = brain();
    const out = await askJson(`Du bist das „Gehirn“ meines Lebenshubs. Verknüpfe meine Daten sinnvoll über Bereiche hinweg (Uni-Wissen, Arbeit, Finanzen/Depot, Gesundheit, Projekte, Ideen). Knoten [id, Art, Titel, Themen]:\n${JSON.stringify(list)}\nBereits gefundene Erkenntnisse: ${JSON.stringify(B.insights.slice(0, 10).map(i => i.text))}\nGemerkte Entscheidungen, Ziele und Fakten: ${JSON.stringify((B.facts || []).slice(0, 20).map(f => f.kind + ': ' + f.text))}\nAntworte nur mit JSON {"topics":{"<id>":["Thema",…]},"links":[{"a":"<id>","b":"<id>","why":"kurzer Grund"}],"insights":[{"text":"1–2 Sätze: Zusammenhang, Chance oder Empfehlung","refs":["<id>"]}],"questions":["Frage, die mein Wissen weiterbringt"]}. Regeln: nur vorhandene ids; Themen kurz (1–2 Wörter), einheitlich, höchstens 3 pro Knoten, bevorzugt bereichsübergreifend; 5–25 neue, nicht offensichtliche Verknüpfungen; 3–5 neue Erkenntnisse (nichts wiederholen); 2–4 Fragen; nichts erfinden, was nicht aus den Titeln hervorgeht.`);
    const ids = new Set(items.map(n => n.id)); let nl = 0, ni = 0;
    if (out && out.topics && typeof out.topics === 'object') Object.entries(out.topics).forEach(([id, ts]) => { if (ids.has(id) && Array.isArray(ts)) B.topics[id] = Array.from(new Set((B.topics[id] || []).concat(ts.map(String).map(s => s.trim()).filter(Boolean)))).slice(0, 5); });
    (Array.isArray(out && out.links) ? out.links : []).forEach(l => { if (l && ids.has(l.a) && ids.has(l.b) && l.a !== l.b && !B.links.some(x => (x.a === l.a && x.b === l.b) || (x.a === l.b && x.b === l.a))) { B.links.push({ a: l.a, b: l.b, why: String(l.why || '').slice(0, 120) }); nl++; } });
    (Array.isArray(out && out.insights) ? out.insights : []).forEach(i => { if (i && i.text && !B.insights.some(x => x.text === i.text)) { B.insights.unshift({ id: uid(), text: String(i.text).slice(0, 400), refs: (i.refs || []).filter(r => ids.has(r)), at: new Date().toISOString() }); ni++; } });
    if (Array.isArray(out && out.questions) && out.questions.length) B.questions = out.questions.map(String).slice(0, 6);
    B.insights = B.insights.slice(0, 60); B.links = B.links.slice(-800); B.grown = new Date().toISOString();
    save(silent ? undefined : `Gehirn gewachsen: ${nl} neue Verbindungen, ${ni} Erkenntnisse`);
  } catch (e) { if (!silent) toast(e.message || 'Gehirn konnte nicht wachsen'); } finally { brBusy = false; if (!silent) busy(false); render(); }
}
function brainAuto() {
  if (!ART.sample) return; const g = brain().grown;
  if (!g || Date.now() - Date.parse(g) > 3 * 864e5) setTimeout(() => brainGrow(true), 4000);
}
function brOpen(id) {
  const [t, a, b] = id.split(':');
  if (t === 'know') editKnow(a); else if (t === 'doc') openDoc(a); else if (t === 'item') editItem(a, b); else if (t === 'rt') editRoutine(a); else if (t === 'pos') editPosition(a);
}
/* Werkzeuge für Assistent und Claude-Jobs */
function brainTool(name, x) {
  if (name === 'add_insight') { const B = brain(); if (!x.text) throw new Error('Text fehlt'); B.insights.unshift({ id: uid(), text: String(x.text).slice(0, 400), refs: Array.isArray(x.refs) ? x.refs.map(String) : [], at: new Date().toISOString() }); return { label: '🧠 Erkenntnis: ' + String(x.text).slice(0, 60), result: 'gespeichert' }; }
  if (name === 'link_items') { const B = brain(); if (!x.a || !x.b) throw new Error('a und b nötig'); B.links.push({ a: String(x.a), b: String(x.b), why: String(x.why || '').slice(0, 120) }); return { label: '🧠 verknüpft', result: 'ok' }; }
  return null;
}
const BRAIN_TOOLS = [
  { name: 'add_insight', description: 'Eine bereichsübergreifende Erkenntnis im Gehirn speichern (Zusammenhang, Chance, Muster).', input_schema: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string' }, refs: { type: 'array', items: { type: 'string' }, description: 'Knoten-ids wie know:<id>, doc:<id>, item:<liste>:<id>, rt:<id>, pos:<id>' } } } },
  { name: 'link_items', description: 'Zwei Dinge im Gehirn verknüpfen.', input_schema: { type: 'object', additionalProperties: false, required: ['a', 'b'], properties: { a: { type: 'string' }, b: { type: 'string' }, why: { type: 'string' } } } }
];
function brainSnapshotText() { const B = brain(); return JSON.stringify({ erkenntnisse: B.insights.slice(0, 8).map(i => i.text), verknuepfungen: B.links.slice(-12).map(l => [l.a, l.b, l.why]), fragen: (B.questions || []).slice(0, 6) }); }
function brainAct(act, b) {
  if (act === 'bnode') { brSel = b.dataset.id || null; render(); return true; }
  if (act === 'bopen') { brOpen(b.dataset.id); return true; }
  if (act === 'bgrow') { brainGrow(false); return true; }
  if (act === 'bins') { brAllIns = !brAllIns; render(); return true; }
  if (act === 'bfactdel') { const B = brain(); B.facts = (B.facts || []).filter(f => f.id !== b.dataset.id); save('Vergessen'); return true; }
  if (act === 'bask') { TAB = 'chat'; chatDraft = b.dataset.v || 'Was weiß mein Gehirn über '; render(); const i = $('chatIn'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } return true; }
  return false;
}
document.addEventListener('input', e => { if (e.target.id === 'brQ') { brQ = e.target.value; clearTimeout(brainAct.t); brainAct.t = setTimeout(() => { const p = e.target.selectionStart; render(); const i = $('brQ'); if (i) { i.focus(); i.setSelectionRange(p, p); } }, 300); } });
