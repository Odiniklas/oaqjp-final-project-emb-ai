/* Lebenshub – Dokumente: lokal speichern (IndexedDB) und mit Claude analysieren.
   Nutzt Globals aus app.js (S, H, C, esc, uid, openDlg, save, toast, render, TAB). */
'use strict';
const SDK_URL = './vendor/anthropic-sdk-1.5.0.mjs'; // offizielles SDK (MIT), lokal gebündelt
const KEY_STORE = 'lebenshub-apikey';
const AREA = { work: 'Arbeit', money: 'Finanzen', health: 'Gesundheit' };
let DOCS = []; // Metadaten ohne Dateiinhalt
let docArea = 'work';

const DB_IDB = (() => {
  let p;
  const open = () => p || (p = new Promise((res, rej) => {
    const r = indexedDB.open('lebenshub-files', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('docs', { keyPath: 'id' });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const t = db.transaction('docs', mode), r = fn(t.objectStore('docs'));
      t.oncomplete = () => res(r && r.result);
      t.onerror = () => rej(t.error);
    });
  };
  return { all: () => tx('readonly', s => s.getAll()), get: id => tx('readonly', s => s.get(id)),
    put: d => tx('readwrite', s => s.put(d)), del: id => tx('readwrite', s => s.delete(id)) };
})();
const DB = {
  all: () => (ART.db ? Promise.resolve(DOCS) : DB_IDB.all()),
  get: id => (ART.db ? artGetDoc(id) : DB_IDB.get(id)),
  put: d => (ART.db ? artPutDoc(d) : DB_IDB.put(d)),
  del: id => (ART.db ? artDelDoc(id) : DB_IDB.del(id))
};
const canAnalyze = () => !!(ART.sample || getKey());
const meta = d => { const m = Object.assign({}, d); delete m.blob; return m; };
async function loadDocs() { try { DOCS = (await DB.all()).map(meta); } catch (e) { DOCS = []; } }

function getKey() { try { return localStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; } }
function setKey(k) { try { k ? localStorage.setItem(KEY_STORE, k) : localStorage.removeItem(KEY_STORE); } catch (e) { /* egal */ } }
const fsize = n => n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB';

/* ---------- Ansicht ---------- */
function docsCard(area) {
  const L = DOCS.filter(d => d.area === area).sort((a, b) => b.added.localeCompare(a.added));
  const rows = L.map(d => `<div class="row"><button class="t" data-act="dopen" data-id="${d.id}">${esc(d.analysis && d.analysis.title ? d.analysis.title : d.name)}<small>${esc(d.name)} · ${H.fdy(d.added)} · ${fsize(d.size)}</small></button>${d.analysis ? '<span class="chip">analysiert</span>' : ''}</div>`).join('')
    || '<div class="empty">Noch keine Dokumente.</div>';
  return `<section class="card"><h2>Dokumente<small>${L.length}</small></h2><div class="hint">PDFs, Fotos oder Textdateien. ${ART.db ? 'Privat bei Claude gespeichert, lesbar für deine Claude-Jobs' : 'Werden nur auf diesem Gerät gespeichert'}${canAnalyze() ? ' – Claude kann sie analysieren' : ''}.</div>${rows}
    <div class="btns"><button class="btn" data-act="dadd" data-v="${area}">+ Dokumente / ZIP</button>${canAnalyze() && L.some(d => !d.analysis) ? `<button class="btn ghost" data-act="dall" data-v="${area}">Alle analysieren &amp; eintragen (${L.filter(d => !d.analysis).length})</button>` : ''}</div></section>`;
}
function keyCard() {
  const k = getKey();
  return `<section class="card"><h2>KI-Analyse von Dokumenten</h2>
    <div class="hint">Für die Analyse brauchst du einen eigenen API-Schlüssel von <b>console.anthropic.com</b> (wird separat von deinem Claude-Abo abgerechnet, meist wenige Cent pro Dokument). Der Schlüssel bleibt nur auf diesem Gerät. Zur Analyse wird das jeweilige Dokument an Anthropic gesendet – nur wenn du auf „Analysieren“ tippst.</div>
    ${k ? `<div class="kv"><span>API-Schlüssel</span><span>hinterlegt (…${esc(k.slice(-4))})</span></div><div class="btns"><button class="btn ghost" data-act="keydel">Schlüssel entfernen</button></div>`
      : `<div class="add-row"><input type="password" id="apikey" placeholder="sk-ant-…" autocomplete="off"><button class="btn" data-act="keysave">Speichern</button></div>`}
    <label class="f" style="margin-top:8px">Modell<select id="modelSel">${Object.keys(MODELS).map(m => `<option value="${m}" ${m === model() ? 'selected' : ''}>${MODELS[m].label}</option>`).join('')}</select></label>
    <div class="kv"><span>Verbrauch diesen Monat (ca.)</span><span>${fusd(usageMonth().usd)} · ${usageMonth().n} Anfragen</span></div></section>`;
}

/* ---------- Dateien hinzufügen ---------- */
async function normImage(file) {
  const ok = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const s = Math.min(1, 1568 / Math.max(img.naturalWidth, img.naturalHeight));
    if (ok.includes(file.type) && s === 1 && file.size < 4e6) return file;
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
    return blob ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch (e) { return file; } finally { URL.revokeObjectURL(url); }
}
async function addFiles(files, areaDefault) {
  let n = 0, last = null;
  const ex = await expandFiles(files, m => toast(m));
  for (const it of ex.items) {
    const f0 = it.file;
    const f = f0.type.startsWith('image/') || /\.hei[cf]$/i.test(f0.name) ? await normImage(f0) : f0;
    const d = { id: uid(), name: f.name || 'Dokument', type: f.type || '', size: f.size, area: (a0 => a0 === 'auto' ? (typeof guessArea === 'function' ? guessArea((it.from || '') + '/' + (f0.name || '')) : 'work') : a0)(it.from ? (it.area || docArea) : (areaDefault || docArea)), added: H.today(), blob: f, ...(it.from ? { from: it.from } : {}) };
    if (ex.items.length > 3) toast('Speichere ' + (n + 1) + '/' + ex.items.length + ' …');
    try { await DB.put(d); if (!ART.db) DOCS.push(meta(d)); else DOCS = DOCS.filter(x => x.id !== d.id).concat([Object.assign(meta(d), { id: d.id })]); n++; last = d.id; } catch (e) { toast(e.message || 'Speichern fehlgeschlagen'); }
  }
  render();
  if (n || ex.skipped.length) toast((n ? (n === 1 ? 'Dokument gespeichert' : n + ' Dokumente gespeichert') : 'Nichts gespeichert') + (ex.skipped.length ? ' · übersprungen: ' + ex.skipped.slice(0, 4).join(', ') + (ex.skipped.length > 4 ? ' …' : '') : ''));
  if (n === 1) openDoc(last);
  return n;
}
/* Alle noch nicht analysierten Dokumente nacheinander auswerten und Vorschläge eintragen (ohne Dubletten) */
let batchRun = false;
async function analyzeAll(area) {
  if (batchRun) return;
  const todo = DOCS.filter(d => !d.analysis && (!area || d.area === area));
  if (!todo.length) return toast('Alles ist schon analysiert.');
  batchRun = true; busy(true);
  const snap = JSON.stringify(S), labels = []; let done = 0;
  try {
    for (const m of todo) {
      toast('Analysiere ' + (done + 1) + '/' + todo.length + ': ' + m.name);
      let full;
      try { full = await DB.get(m.id); } catch (e) { labels.push('⚠︎ ' + m.name + ': ' + e.message); continue; }
      let a;
      try { a = await analyzeDoc(full); } catch (e) { labels.push('⚠︎ ' + m.name + ': ' + e.message); if (/Nutzungslimit|zu viele|nicht erlaubt/i.test(e.message)) break; continue; }
      a.entries.forEach(e => {
        const L = S.lists[e.list] || [];
        if (L.some(x => x.n.trim().toLowerCase() === e.title.trim().toLowerCase())) { e.done = true; return; }
        try { labels.push(runTool('add_entry', { list: e.list, title: e.title, note: e.note, date: e.date }, { files: [] }).label); e.done = true; } catch (er) { /* egal */ }
      });
      full.analysis = a; m.analysis = a; await persistMeta(m); done++;
    }
  } finally { batchRun = false; busy(false); }
  S.jobLog = [{ source: 'Dokument-Analyse', at: new Date().toISOString(), summary: done + ' von ' + todo.length + ' Dokument(en) ausgewertet', labels }].concat(S.jobLog || []).slice(0, 30);
  if (typeof undoSnap !== 'undefined') undoSnap = null;
  save(done + ' Dokument(e) ausgewertet, ' + labels.filter(l => !l.startsWith('⚠')).length + ' Einträge übernommen');
}

/* ---------- Analyse mit Claude ---------- */
function b64(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
}
async function toBlock(d) {
  const t = d.type, name = d.name.toLowerCase();
  if (t === 'application/pdf' || name.endsWith('.pdf')) return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: await b64(d.blob) } };
  if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(t)) return { type: 'image', source: { type: 'base64', media_type: t, data: await b64(d.blob) } };
  if (t.startsWith('text/') || /json|csv|xml/.test(t) || /\.(txt|csv|md|json|xml)$/.test(name)) {
    const text = await d.blob.text();
    if (text.length > 600000) throw new Error('Die Textdatei ist zu groß für eine Analyse.');
    return { type: 'text', text: '<dokument>\n' + text + '\n</dokument>' };
  }
  throw new Error('Dieses Format kann nicht analysiert werden. Bitte als PDF exportieren oder ein Foto/Screenshot hinzufügen.');
}
async function analyzeDoc(d) {
  const lists = C.filter(c => c.tab === d.area || c.tab === 'today');
  const schema = {
    type: 'object', additionalProperties: false, required: ['title', 'summary', 'facts', 'entries'],
    properties: {
      title: { type: 'string' },
      summary: { type: 'string' },
      facts: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['label', 'value'], properties: { label: { type: 'string' }, value: { type: 'string' } } } },
      entries: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['list', 'title', 'note', 'date'],
        properties: { list: { type: 'string', enum: lists.map(c => c.k) }, title: { type: 'string' }, note: { type: 'string' }, date: { type: 'string' } } } }
    }
  };
  const system = `Du hilfst, einen persönlichen Lebens-Hub zu pflegen (Bereich: ${AREA[d.area]}). Analysiere das Dokument sachlich und auf Deutsch.
- title: kurzer, aussagekräftiger Titel des Dokuments.
- summary: 2–5 Sätze, worum es geht und was zu tun ist.
- facts: die wichtigsten Fakten (Beträge mit Währung und Stichtag, Daten, Fristen, Diagnosen, Behandlungen, Ansprechpartner).
- entries: konkrete Vorschläge für diese Listen des Hubs:
${lists.map(c => `  ${c.k} = ${c.title}`).join('\n')}
  Für Kontostände/Depotwerte: Liste „Konten & Depots“, Wert und Stichtag in note. Für Fristen und Termine ein Datum setzen.
Regeln: Nur übernehmen, was im Dokument steht – nichts erfinden. Datum als JJJJ-MM-TT, sonst leerer String. Keine IBAN, Konto-, Depot-, Versicherungs- oder Kundennummern übernehmen. Leere Listen, wenn nichts passt. Heute ist der ${H.today()}.`;

  if (ART.sample) { // über das Claude-Abo
    const c = await artContent(d);
    const prompt = system + '\n\nAntworte nur mit einem JSON-Objekt dieser Form: {"title":"…","summary":"…","facts":[{"label":"…","value":"…"}],"entries":[{"list":"' + lists[0].k + '","title":"…","note":"…","date":"JJJJ-MM-TT oder leer"}]}\n\n' +
      (c.text ? '<dokument name="' + d.name + '">\n' + c.text + '\n</dokument>' : 'Das Dokument „' + d.name + '“ ist als Bild angehängt.');
    let out;
    try { out = await ART.sample.json(prompt, Object.assign({ modelTier: 'default', effort: 'medium', cache: false }, c.images ? { images: c.images.slice(0, ART.imgMax) } : {})); }
    catch (e) { throw new Error(sampleErr(e)); }
    return finishAnalysis(out, lists);
  }
  if (!getKey()) throw new Error('Bitte zuerst unter ⚙︎ einen API-Schlüssel hinterlegen.');
  const block = await toBlock(d);
  const { client, A } = await apiClient();
  let res;
  try {
    res = await client.beta.messages.create({
      ...baseParams(),
      max_tokens: 16000,
      output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
      system,
      messages: [{ role: 'user', content: [block, { type: 'text', text: 'Dateiname: ' + d.name + '\nBitte analysieren.' }] }]
    });
  } catch (e) { throw new Error(errText(e, A)); }
  track(res);
  if (res.stop_reason === 'refusal') throw new Error('Claude hat die Analyse dieses Dokuments abgelehnt.');
  if (res.stop_reason === 'max_tokens') throw new Error('Die Antwort war zu lang – bitte das Dokument aufteilen.');
  const txt = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
  return finishAnalysis(JSON.parse(txt), lists);
}
function finishAnalysis(o, lists) {
  const out = o && typeof o === 'object' ? o : {};
  out.title = String(out.title || ''); out.summary = String(out.summary || '');
  out.facts = (Array.isArray(out.facts) ? out.facts : []).map(f => ({ label: String(f.label || ''), value: String(f.value || '') }));
  out.entries = (Array.isArray(out.entries) ? out.entries : []).filter(x => x && lists.some(c => c.k === x.list))
    .map(x => ({ list: x.list, title: String(x.title || ''), note: String(x.note || ''), date: /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') ? x.date : '' }));
  out.at = new Date().toISOString();
  return out;
}

/* Gemeinsamer Claude-Zugang für Dokumente und Assistent */
const MODELS = {
  'claude-opus-5-5': { label: 'Opus 5.5 – beste Qualität', p: [4, 20, 0.2, 5], fb: true },
  'claude-sonnet-5-5': { label: 'Sonnet 5.5 – halber Preis', p: [2, 10, 0.1, 2.5], fb: true },
  'claude-haiku-5-5': { label: 'Haiku 5.5 – sehr günstig', p: [0.1, 0.5, 0.01, 0.125], fb: false }
};
function model() { let m = ''; try { m = localStorage.getItem('lebenshub-model') || ''; } catch (e) { /* egal */ } return MODELS[m] ? m : 'claude-opus-5-5'; }
/* Basis-Parameter je Modell; Fallback bei Ablehnungen nur, wo der Server ihn anbietet */
function baseParams() {
  const m = model();
  return MODELS[m].fb ? { model: m, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } : { model: m };
}
let sdkP = null;
function loadSdk() { return sdkP || (sdkP = import(SDK_URL).catch(e => { sdkP = null; throw e; })); }
async function apiClient() {
  const key = getKey();
  if (!key) throw new Error('Bitte zuerst unter ⚙︎ einen API-Schlüssel hinterlegen.');
  const { default: A } = await loadSdk();
  return { client: new A({ apiKey: key, dangerouslyAllowBrowser: true }), A };
}
/* Ungefähre Kosten (USD) aus der Token-Nutzung, Monatssumme lokal */
function track(res) {
  const u = res.usage || {}, p = (MODELS[res.model] || MODELS[model()]).p;
  const usd = ((u.input_tokens || 0) * p[0] + (u.output_tokens || 0) * p[1] + (u.cache_read_input_tokens || 0) * p[2] + (u.cache_creation_input_tokens || 0) * p[3]) / 1e6;
  try {
    const k = 'lebenshub-usage', mo = H.today().slice(0, 7);
    let o = JSON.parse(localStorage.getItem(k) || '{}'); if (o.m !== mo) o = { m: mo, usd: 0, n: 0 };
    o.usd += usd; o.n++; localStorage.setItem(k, JSON.stringify(o));
  } catch (e) { /* egal */ }
  return usd;
}
function usageMonth() { try { const o = JSON.parse(localStorage.getItem('lebenshub-usage') || '{}'); return o.m === H.today().slice(0, 7) ? o : { usd: 0, n: 0 }; } catch (e) { return { usd: 0, n: 0 }; } }
const fusd = v => v < 0.01 ? (v * 100).toFixed(2).replace('.', ',') + ' ct' : v.toFixed(2).replace('.', ',') + ' $';
function errText(e, A) {
  if (e instanceof A.AuthenticationError) return 'Der API-Schlüssel ist ungültig.';
  if (e instanceof A.PermissionDeniedError) return 'Der API-Schlüssel hat keine Berechtigung (Guthaben/Abrechnung in der Console prüfen).';
  if (e instanceof A.RateLimitError) return 'Zu viele Anfragen – bitte gleich noch einmal versuchen.';
  if (e instanceof A.BadRequestError) return 'Anfrage abgelehnt: ' + (e.message || 'unbekannter Fehler');
  if (e instanceof A.APIConnectionError) return 'Keine Verbindung zu Claude. Bist du online?';
  if (e instanceof A.APIError) return 'Claude ist gerade nicht erreichbar (' + (e.status || '?') + ').';
  return e && e.message ? e.message : String(e);
}

/* ---------- Dokument-Dialog ---------- */
async function openDoc(id) {
  const d = DOCS.find(x => x.id === id);
  if (!d) return;
  const a = d.analysis;
  const listName = k => (C.find(c => c.k === k) || {}).title || k;
  const ana = a ? `<div class="hint"><b>Zusammenfassung:</b> ${esc(a.summary)}</div>
      ${a.facts && a.facts.length ? a.facts.map(f => `<div class="kv"><span>${esc(f.label)}</span><span>${esc(f.value)}</span></div>`).join('') : ''}
      ${a.entries && a.entries.length ? `<div class="hint" style="margin-top:6px"><b>Vorschläge für deinen Hub</b> – auswählen und übernehmen:</div>
        ${a.entries.map((e, i) => `<label class="sug"><input type="checkbox" name="e${i}" ${e.done ? 'disabled' : 'checked'}><span>${esc(e.title)}<small>${esc(listName(e.list))}${e.date ? ' · ' + H.fdy(e.date) : ''}${e.note ? ' · ' + esc(e.note) : ''}${e.done ? ' · übernommen' : ''}</small></span></label>`).join('')}` : ''}`
    : `<div class="hint">${canAnalyze() ? 'Noch nicht analysiert.' : 'Für die Analyse unter ⚙︎ einen API-Schlüssel hinterlegen.'}</div>`;
  const canApply = a && a.entries && a.entries.some(e => !e.done);
  openDlg(`<h3>${esc(a && a.title ? a.title : d.name)}</h3>
    ${ART.db && d.assetId ? (/^image\//.test(d.type || '') ? `<img class="preview" src="/_blob/${esc(d.assetId)}" alt="${esc(d.name)}">` : `<a href="/_blob/${esc(d.assetId)}" target="_blank" rel="noopener">Datei öffnen</a>`) : ''}
    <div class="hint">${esc(d.name)} · ${AREA[d.area]} · ${H.fdy(d.added)} · ${fsize(d.size)}</div>
    ${ana}
    <div class="btns">${canApply ? '<button class="btn" value="apply">Ausgewählte übernehmen</button>' : ''}
      ${canAnalyze() ? `<button class="btn ${canApply ? 'ghost' : ''}" value="analyze" formnovalidate>${a ? 'Neu analysieren' : 'Analysieren'}</button>` : ''}
      ${a ? '<button class="btn ghost" value="know" formnovalidate>Ins Wissen</button>' : ''}
      ${ART.db ? '' : '<button class="btn ghost" value="open" formnovalidate>Öffnen</button>'}
      <button class="btn warn" value="del" formnovalidate>Löschen</button>
      <button class="btn ghost" value="cancel" formnovalidate>Schließen</button></div>`, async (v, f) => {
    if (v === 'open') return showDoc(d.id);
    if (v === 'know') return docToKnow(d);
    if (v === 'del') {
      if (!(await askConfirm('„' + d.name + '“ löschen?', 'Löschen'))) return;
      try { await DB.del(d.id); } catch (e) { return toast(e.message || 'Löschen fehlgeschlagen'); }
      DOCS = DOCS.filter(x => x.id !== d.id); render(); return toast('Gelöscht');
    }
    if (v === 'apply') {
      let n = 0;
      a.entries.forEach((e, i) => {
        if (e.done || !f['e' + i] || !f['e' + i].checked) return;
        S.lists[e.list].push({ id: uid(), n: e.title, s: 0, d: e.date || '', t: e.note || '' });
        e.done = true; n++;
      });
      await persistMeta(d);
      return save(n + ' Einträge übernommen');
    }
    if (v === 'analyze') {
      toast('Claude analysiert „' + d.name + '“ …');
      busy(true);
      try {
        const full = await DB.get(d.id);
        d.analysis = await analyzeDoc(full);
        await persistMeta(d);
        DOCS = DOCS.map(x => (x.id === d.id ? Object.assign({}, x, { analysis: d.analysis }) : x));
        render(); openDoc(d.id);
      } catch (e) { toast(e.message || String(e)); } finally { busy(false); }
    }
  });
}
async function persistMeta(d) { const full = await DB.get(d.id); if (full) { full.analysis = d.analysis; await DB.put(full); } }
async function showDoc(id) {
  const full = await DB.get(id);
  if (!full) return;
  const url = URL.createObjectURL(full.blob);
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noopener';
  if (!/^(application\/pdf|image\/|text\/)/.test(full.type)) a.download = full.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
function busy(on) { document.body.classList.toggle('busy', on); }

/* ---------- Ereignisse ---------- */
function docAct(act, b) {
  if (act === 'dup') {
    openDlg(`<h3>Dokumente hochladen</h3><div class="hint">PDFs, Fotos, Screenshots, Word/Excel/PowerPoint oder ZIP – auch mehrere auf einmal. Danach kann Claude sie analysieren und eintragen.</div>
      <div class="up-grid"><button class="btn" value="auto">🪄 Automatisch einsortieren</button><button class="btn ghost" value="work">💼 Arbeit</button><button class="btn ghost" value="money">€ Finanzen</button><button class="btn ghost" value="health">❤️ Gesundheit</button></div>
      <div class="hint">Termine auf Fotos? Dafür im Kalender „Termine aus Fotos“ nutzen. Depot-Screenshots am besten an Odi schicken.</div>
      <div class="btns"><button class="btn ghost" value="cancel" formnovalidate>Abbrechen</button></div>`, v => { if (!v || v === 'cancel') return; docArea = v; $('docFile').click(); });
    return true;
  }
  if (act === 'dadd') { docArea = b.dataset.v; $('docFile').click(); return true; }
  if (act === 'dopen') { openDoc(b.dataset.id); return true; }
  if (act === 'dall') { analyzeAll(b.dataset.v); return true; }
  if (act === 'keysave') {
    const v = ($('apikey').value || '').trim();
    if (!/^sk-ant-/.test(v)) { toast('Das sieht nicht nach einem Anthropic-API-Schlüssel aus (beginnt mit „sk-ant-“).'); return true; }
    setKey(v); render(); toast('API-Schlüssel gespeichert'); return true;
  }
  if (act === 'keydel') { askConfirm('API-Schlüssel von diesem Gerät entfernen?', 'Entfernen').then(ok => { if (ok) { setKey(''); render(); } }); return true; }
  return false;
}
document.addEventListener('change', e => {
  if (e.target.id === 'modelSel') { try { localStorage.setItem('lebenshub-model', e.target.value); } catch (er) { /* egal */ } toast('Modell: ' + MODELS[e.target.value].label); }
  if (e.target.id === 'docFile' && e.target.files.length) { const fl = Array.from(e.target.files); e.target.value = ''; addFiles(fl); }
});
