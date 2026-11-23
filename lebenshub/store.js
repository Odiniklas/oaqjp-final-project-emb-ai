/* Lebenshub – Betrieb als Claude-Artefakt.
   Daten in der Artefakt-Datenbank (db: hub/state, docs/*, inbox/*), Dokumente als Assets,
   Claude über das Abo des Nutzers (sample), Ergebnisse geplanter Claude-Jobs aus der Sammelbox „inbox“.
   Ohne Claude-Umgebung (eigene Web-App) bleibt alles lokal wie bisher. */
'use strict';
const ART = { on: false, db: null, assets: null, sample: null, downloads: null, dictation: null, tts: null, ready: false, inbox: [], imgMax: 0,
  holder: Math.random().toString(36).slice(2) };
const BLOBS = {}; // frisch hochgeladene Dateien (spart erneutes Laden)
let artLastJson = '', artSaveT = null, artWriting = false, artAgain = false, artInboxBusy = false;

/* Gemeinsame Bestätigung (im Artefakt gibt es kein confirm()/prompt()) */
function askConfirm(msg, yes) {
  return new Promise(res => setTimeout(() => openDlg(`<h3>Bitte bestätigen</h3><div class="hint">${esc(msg)}</div>
    <div class="btns"><button class="btn warn" value="yes">${esc(yes || 'Ja')}</button><button class="btn ghost" value="cancel" formnovalidate>Abbrechen</button></div>`,
    v => res(v === 'yes'), () => res(false)), 0));
}
function askText(title, ph) {
  return new Promise(res => setTimeout(() => openDlg(`<h3>${esc(title)}</h3><textarea name="t" rows="8" placeholder="${esc(ph || '')}"></textarea>
    <div class="btns"><button class="btn" value="ok">Übernehmen</button><button class="btn ghost" value="cancel" formnovalidate>Abbrechen</button></div>`,
    (v, f) => res(v === 'ok' ? f.t.value : ''), () => res('')), 0));
}

/* Große Bereiche liegen in eigenen Datenbank-Dokumenten (parts/<name>), damit hub/state klein bleibt.
   Alter Stand mit know/brain direkt in hub/state wird beim ersten Speichern automatisch umgezogen. */
const SPLIT = ['know', 'brain'];
const artPart = { json: {}, data: {}, loaded: {} };
function artHubPart(s) { const o = Object.assign({}, s); SPLIT.forEach(k => { delete o[k]; }); return o; }
function artPartsInit() {
  SPLIT.forEach(k => ART.db.doc('parts/' + k).onSnapshot(sn => {
    if (sn.metadata && sn.metadata.hasPendingWrites) return;
    artPart.loaded[k] = true;
    if (sn.exists) {
      const d = (sn.data() || {}).data, j = JSON.stringify(d === undefined ? null : d);
      artPart.data[k] = JSON.parse(j);
      if (j !== artPart.json[k]) { artPart.json[k] = j; S[k] = JSON.parse(j); render(); }
    }
    if (ART.ready && SPLIT.every(x => artPart.loaded[x])) { artSave(); artProcessInbox(); }
  }, () => { artPart.loaded[k] = true; }));
}
async function artInit() {
  if (!(window.claude && typeof window.claude.use === 'function')) return;
  const names = ['db', 'sample', 'assets', 'downloads', 'dictation', 'tts', 'mcp'];
  const got = await Promise.all(names.map(n => window.claude.use(n).catch(() => null)));
  names.forEach((n, i) => { ART[n] = got[i]; });
  if (!ART.db && !ART.sample) return;
  ART.on = true;
  document.documentElement.classList.add('art');
  if (ART.sample) { try { const l = await ART.sample.limits(); ART.imgMax = l && l.images ? l.images.maxCount : 0; ART.toolMax = l && l.tools ? l.tools.maxCount : 0; } catch (e) { ART.imgMax = 0; ART.toolMax = 0; } }
  if (!ART.db) { render(); return; }
  if (typeof ttInit === 'function') ttInit();
  artPartsInit();
  const loadTimer = setTimeout(() => { if (!ART.ready) toast('Deine Daten bei Claude sind gerade nicht erreichbar – du siehst den zuletzt gespeicherten Stand.'); }, 10000);
  ART.db.doc('hub/state').onSnapshot(snap => {
    if (snap.metadata.hasPendingWrites) return;
    if (snap.exists) {
      const st = (snap.data() || {}).state;
      const j = st ? JSON.stringify(st) : '';
      if (j && j !== artLastJson) {
        artLastJson = j;
        const keep = S.settings;
        S = JSON.parse(j);
        SPLIT.forEach(k => { if (artPart.data[k] !== undefined) S[k] = JSON.parse(JSON.stringify(artPart.data[k])); });
        S.settings = Object.assign({ notify: false, defTime: '08:00', theme: 'auto' }, keep, S.settings || {});
        if (!S.lists) S.lists = {}; if (!Array.isArray(S.routines)) S.routines = [];
        C.forEach(c => { if (!S.lists[c.k]) S.lists[c.k] = []; });
        try { localStorage.setItem(K, JSON.stringify(S)); } catch (e) { /* egal */ }
      }
    } else if (!snap.metadata.fromCache && !isEmpty()) {
      artSaveNow(); // erster Start im Artefakt: lokalen Stand hochladen
    }
    if (!snap.metadata.fromCache) { const first = !ART.ready; ART.ready = true; clearTimeout(loadTimer); artProcessInbox(); if (first && SPLIT.every(k => artPart.loaded[k])) artSave(); if (first && typeof driveHealthAuto === 'function') setTimeout(driveHealthAuto, 1500); if (first && typeof mailAuto === 'function') setTimeout(mailAuto, 2500); if (first && typeof brainAuto === 'function') setTimeout(brainAuto, 3000); if (first && typeof calAuto === 'function') setTimeout(calAuto, 2000); }
    render();
  }, e => { clearTimeout(loadTimer); ART.ready = true; toast('Daten konnten nicht geladen werden (' + e.code + ').'); render(); });
  ART.db.collection('docs').onSnapshot(q => { DOCS = q.docs.map(d => Object.assign({}, d.data(), { id: d.id })); render(); }, () => {});
  ART.db.collection('inbox').onSnapshot(q => { ART.inbox = q.docs.map(d => d.id); artProcessInbox(); }, () => {});
}

function artSave() { if (!ART.db) return; clearTimeout(artSaveT); artSaveT = setTimeout(artSaveNow, 500); }
async function artSaveNow() {
  if (!ART.db) return;
  if (artWriting) { artAgain = true; return; }
  if (!SPLIT.every(k => artPart.loaded[k])) { artSave(); return; } // erst speichern, wenn alle Teile geladen sind
  const j = JSON.stringify(artHubPart(S)), at = new Date().toISOString();
  const parts = SPLIT.map(k => [k, JSON.stringify(S[k] === undefined ? null : S[k])]).filter(x => x[1] !== artPart.json[x[0]]);
  if (j === artLastJson && !parts.length) return;
  const big = [['Hub', j]].concat(parts).find(x => x[1].length > 240000);
  if (big) { toast('Bereich „' + big[0] + '“ ist zu groß zum Speichern bei Claude – bitte alte Einträge aufräumen.'); return; }
  artWriting = true;
  try {
    for (const [k, pj] of parts) { await ART.db.doc('parts/' + k).set({ data: JSON.parse(pj), at }); artPart.json[k] = pj; artPart.data[k] = JSON.parse(pj); }
    if (j !== artLastJson) { artLastJson = j; await ART.db.doc('hub/state').set({ state: JSON.parse(j), at }); }
  } catch (e) { artLastJson = ''; SPLIT.forEach(k => { artPart.json[k] = ''; }); toast('Speichern bei Claude fehlgeschlagen (' + (e.code || '?') + ').'); }
  artWriting = false;
  if (artAgain) { artAgain = false; artSaveNow(); }
}

/* Ergebnisse der geplanten Claude-Jobs übernehmen: inbox/<id> = {source, at, summary, actions:[{tool,…}]} */
async function artProcessInbox() {
  if (!ART.db || !ART.ready || artInboxBusy || !ART.inbox.length || !SPLIT.every(k => artPart.loaded[k])) return;
  artInboxBusy = true;
  try {
    for (const id of ART.inbox.slice()) {
      const ref = ART.db.doc('inbox/' + id);
      let lease;
      try { lease = await ref.acquire({ holder: ART.holder, ttlMs: 20000 }); } catch (e) { continue; }
      if (!lease.acquired) continue;
      const snap = await ref.get();
      if (!snap.exists) continue;
      const x = snap.data() || {}, labels = [], turn = { files: [] };
      (Array.isArray(x.actions) ? x.actions : []).slice(0, 60).forEach(a => {
        try { labels.push(runTool(String(a.tool || ''), a, turn).label); } catch (e) { labels.push('⚠︎ ' + (a.tool || '?') + ': ' + e.message); }
      });
      const docA = (Array.isArray(x.actions) ? x.actions : []).find(a => a && /^https:\/\//.test(String(a.doc || a.url || '')));
      const doc = /^https:\/\//.test(String(x.doc || x.url || '')) ? String(x.doc || x.url) : docA ? String(docA.doc || docA.url) : '';
      S.jobLog = [{ source: String(x.source || 'Claude-Job').slice(0, 80), at: String(x.at || new Date().toISOString()), summary: String(x.summary || '').slice(0, 4000), labels, doc: doc.slice(0, 300) }]
        .concat(S.jobLog || []).slice(0, 80);
      save(labels.length ? (x.source || 'Claude-Job') + ': ' + labels.length + ' Änderungen übernommen' : undefined);
      await artSaveNow();
      try { await ref.delete(); } catch (e) { /* nächster Durchlauf */ }
    }
  } finally { artInboxBusy = false; }
}
function jobLogCard() {
  const L = (S.jobLog || []).slice(0, 5);
  if (!L.length) return ART.db ? `<section class="card"><h2>Von deinen Claude-Jobs</h2><div class="empty">Noch nichts eingegangen. Briefing, Radare und Recherchen landen hier automatisch, sobald sie gelaufen sind.</div></section>` : '';
  return `<section class="card"><h2>Von deinen Claude-Jobs<small>${L.length}</small></h2>${L.map((j, i) => `<div class="row"><div class="t">${esc(j.source)}${typeof jobFbButtons === 'function' ? jobFbButtons(j, i) : ''} <small>${esc(new Date(j.at).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))}${j.summary ? ' · ' + esc(j.summary.length > 300 ? j.summary.slice(0, 300) + ' …' : j.summary) : ''}</small>${j.labels.length ? `<ul class="acts">${j.labels.slice(0, 6).map(l => `<li>${esc(l)}</li>`).join('')}${j.labels.length > 6 ? `<li>… und ${j.labels.length - 6} weitere</li>` : ''}</ul>` : ''}</div></div>`).join('')}</section>`;
}

/* ---------- Dokumente im Artefakt (Assets + db) ---------- */
const ART_TYPES = /^(image\/(jpeg|png|gif|webp)|application\/pdf|text\/(plain|csv|markdown)|application\/json)$/;
async function artPutDoc(d) {
  const m = meta(d);
  if (d.blob && !m.assetId) {
    if (!ART.assets) throw new Error('Die Dateiablage ist hier nicht verfügbar.');
    const type = d.type || (/\.pdf$/i.test(d.name) ? 'application/pdf' : /\.(txt|md)$/i.test(d.name) ? 'text/plain' : /\.csv$/i.test(d.name) ? 'text/csv' : '');
    if (!ART_TYPES.test(type)) throw new Error('„' + d.name + '“: Dieses Format kann nicht gespeichert werden. Bitte als PDF, Foto oder Text sichern.');
    const r = await ART.assets.upload(d.blob, { type });
    m.assetId = r.id; m.type = type; d.assetId = r.id; d.type = type; BLOBS[d.id] = d.blob;
  }
  delete m.id;
  await ART.db.doc('docs/' + d.id).set(JSON.parse(JSON.stringify(m)));
}
async function artGetDoc(id) {
  const m = DOCS.find(x => x.id === id);
  if (!m) return null;
  let blob = BLOBS[id];
  if (!blob && m.assetId) { try { const r = await fetch('/_blob/' + m.assetId); if (r.ok) blob = await r.blob(); } catch (e) { /* unten */ } }
  if (!blob) throw new Error('Die Datei ist gerade nicht erreichbar.');
  return Object.assign({}, m, { blob });
}
async function artDelDoc(id) {
  const m = DOCS.find(x => x.id === id);
  await ART.db.doc('docs/' + id).delete();
  if (m && m.assetId && ART.assets) { try { await ART.assets.delete(m.assetId); } catch (e) { /* egal */ } }
}

/* PDF lesen (pdf.js, nur bei Bedarf geladen): Text, sonst die ersten Seiten als Bilder */
let pdfP = null;
function loadPdfJs() {
  const add = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('PDF-Leser konnte nicht geladen werden.')); document.head.appendChild(s); });
  const base = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  return pdfP || (pdfP = add(base + 'pdf.min.js').then(() => add(base + 'pdf.worker.min.js')).then(() => window.pdfjsLib).catch(e => { pdfP = null; throw e; }));
}
async function pdfContent(blob, maxImages) {
  const lib = await loadPdfJs();
  const pdf = await lib.getDocument({ data: await blob.arrayBuffer() }).promise;
  let text = '';
  for (let p = 1; p <= Math.min(pdf.numPages, 40) && text.length < 80000; p++) {
    const tc = await (await pdf.getPage(p)).getTextContent();
    text += '\n[Seite ' + p + ']\n' + tc.items.map(i => i.str).join(' ');
  }
  if (text.replace(/\s|\[Seite \d+\]/g, '').length > 200 || !maxImages) return { text: text.slice(0, 80000) };
  const images = []; // gescanntes PDF: Seiten als Bilder
  for (let p = 1; p <= Math.min(pdf.numPages, maxImages); p++) {
    const page = await pdf.getPage(p), vp = page.getViewport({ scale: 1.6 }), c = document.createElement('canvas');
    c.width = vp.width; c.height = vp.height;
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    images.push(await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85)));
  }
  return { images };
}
/* Inhalt einer Datei für Claude (Abo): {text} oder {images} */
async function artContent(d) {
  const t = d.type || '';
  if (/^image\//.test(t)) { if (!ART.imgMax) throw new Error('Bilder können hier nicht an Claude gesendet werden.'); return { images: [d.blob] }; }
  if (t === 'application/pdf' || /\.pdf$/i.test(d.name)) return pdfContent(d.blob, ART.imgMax ? Math.min(3, ART.imgMax) : 0);
  if (/^text\/|json|csv/.test(t) || /\.(txt|csv|md|json)$/i.test(d.name)) return { text: (await d.blob.text()).slice(0, 80000) };
  throw new Error('Dieses Format kann nicht gelesen werden. Bitte als PDF oder Foto hinzufügen.');
}
function sampleErr(e) {
  const c = e && e.code;
  return c === 'not_granted' ? 'Du hast Claude für diesen Hub nicht erlaubt. Öffne die Berechtigungen des Artefakts, um es zu ändern.'
    : c === 'rate_limited' ? 'Gerade zu viele Anfragen oder dein Nutzungslimit ist erreicht – bitte später erneut versuchen.'
    : c === 'session_expired' ? 'Bitte bei Claude neu anmelden.'
    : c === 'refused' ? 'Claude hat diese Anfrage abgelehnt.'
    : c === 'prompt_too_large' ? 'Das ist zu viel auf einmal – bitte kürzer oder in Teilen.'
    : c === 'image_rejected' ? 'Das Bild konnte nicht gelesen werden.'
    : c === 'cancelled' ? 'Abgebrochen.'
    : (e && e.message) || 'Claude ist gerade nicht erreichbar.';
}
async function artDownload(name, type, text) {
  try { await ART.downloads.save({ filename: name, data: new Blob([text], { type }) }); toast('Gespeichert'); }
  catch (e) { if (e && e.code !== 'cancelled' && e.code !== 'declined') toast('Speichern nicht möglich (' + (e.code || '?') + ').'); }
}
function artSettingsCard() {
  const tier = pref('tier', 'default');
  return `<section class="card"><h2>Verbindung mit Claude</h2>
    <div class="kv"><span>Daten</span><span>${ART.db ? 'bei Claude gespeichert, auf allen Geräten gleich' : 'nur auf diesem Gerät'}</span></div>
    <div class="kv"><span>Assistent &amp; Analyse</span><span>${ART.sample ? 'über dein Claude-Abo' : 'nicht verfügbar'}</span></div>
    <div class="kv"><span>Claude-Jobs</span><span>${ART.db ? 'Ergebnisse kommen automatisch' : '—'}</span></div>
    ${ART.sample ? `<label class="f" style="margin-top:8px">Assistent<select id="tierSel"><option value="default" ${tier === 'default' || tier === 'auto' ? 'selected' : ''}>Automatisch (empfohlen: schnell bei Kleinem, gründlich bei Analysen)</option><option value="complex" ${tier === 'complex' ? 'selected' : ''}>Immer sehr gründlich</option><option value="quick" ${tier === 'quick' ? 'selected' : ''}>Immer schnell (schont dein Nutzungslimit)</option></select></label>` : ''}
    <div class="hint" style="margin-top:8px">Erinnerungen: Exportiere die Kalenderdatei unten – dein iPhone-Kalender erinnert dich dann. Ergebnisse der Claude-Jobs kommen zusätzlich als Mitteilung der Claude-App.</div></section>`;
}
document.addEventListener('change', e => { if (e.target.id === 'tierSel') { setPref('tier', e.target.value); toast(e.target.value === 'quick' ? 'Assistent: schnell' : e.target.value === 'complex' ? 'Assistent: sehr gründlich' : 'Assistent: automatisch'); } });
