/* Lebenshub – TikTok-Sammlung: Import aus dem offiziellen TikTok-Datenexport (JSON oder ZIP),
   Favoriten, Sammlungen und Likes; Claude ordnet sie nach Themen (Fußball, Leben, KI …) ein.
   Gespeichert getrennt vom Hub-Zustand im Dokument tiktok/data: { at, items:[{v, d, s, t, a, k, n, w}] }
   v = Video-ID, d = Datum, s = Quelle (Favorit/Like/Sammlung …), t = Titel/Beschreibung, a = Account, k = Thema, n = Notiz, w = ins Wissen übernommen */
'use strict';
const TT_TOPICS = ['Fußball', 'Sport & Fitness', 'KI & Tech', 'Business & Geld', 'Leben & Mindset', 'Gesundheit & Ernährung', 'Kochen & Rezepte', 'Reisen', 'Humor', 'Musik', 'Wissen & Lernen', 'Sonstiges'];
let TT = { at: '', items: [] }, ttFilter = '', ttQ = '', ttShow = 30, ttLoaded = false;
const ttUrl = v => 'https://www.tiktok.com/@/video/' + v;
const ttVid = s => { const m = String(s || '').match(/(?:video|v)\/(\d{8,25})/) || String(s || '').match(/\b(\d{17,21})\b/); return m ? m[1] : ''; };
function ttInit() {
  if (ART.db) {
    ART.db.doc('tiktok/data').onSnapshot(sn => { if (sn.metadata && sn.metadata.hasPendingWrites) return; const d = sn.exists ? sn.data() : null; TT = d && Array.isArray(d.items) ? JSON.parse(JSON.stringify(d)) : { at: '', items: [] }; ttLoaded = true; if (TAB === 'files') render(); }, () => { ttLoaded = true; });
  } else { try { TT = JSON.parse(localStorage.getItem(K + '-tiktok') || '{"items":[]}'); } catch (e) { TT = { at: '', items: [] }; } ttLoaded = true; }
}
let ttSaveT = null;
function ttSave() {
  clearTimeout(ttSaveT);
  ttSaveT = setTimeout(async () => {
    TT.at = new Date().toISOString();
    try { if (ART.db) await ART.db.doc('tiktok/data').set(JSON.parse(JSON.stringify(TT))); else localStorage.setItem(K + '-tiktok', JSON.stringify(TT)); }
    catch (e) { toast('TikTok-Sammlung konnte nicht gespeichert werden (' + (e.code || e.message || '?') + ').'); }
  }, 400);
}
/* Export lesen: sucht überall nach Video-Links, merkt sich die Quelle (Favoriten, Sammlungsname, Likes …) */
function ttParse(json) {
  const out = [];
  const walk = (o, path, coll) => {
    if (o == null) return;
    if (Array.isArray(o)) { o.forEach(x => walk(x, path, coll)); return; }
    if (typeof o !== 'object') return;
    const keys = Object.keys(o);
    const name = keys.find(k => /^(collection.?name|name|title)$/i.test(k) && typeof o[k] === 'string');
    const c2 = /collection|sammlung/i.test(path) && name ? o[name] : coll;
    const linkK = keys.find(k => /link|url/i.test(k) && typeof o[k] === 'string' && /tiktok/i.test(o[k]));
    if (linkK) {
      const v = ttVid(o[linkK]); const dk = keys.find(k => /date|time/i.test(k));
      if (v) out.push({ v, d: String(o[dk] || '').slice(0, 10), s: c2 ? 'Sammlung: ' + c2 : /favorit/i.test(path) ? 'Favorit' : /like/i.test(path) ? 'Like' : /share/i.test(path) ? 'Geteilt' : /watch|browsing/i.test(path) ? 'Verlauf' : 'Gespeichert' });
    }
    keys.forEach(k => walk(o[k], path + '/' + k, c2));
  };
  walk(json, '', '');
  return out;
}
async function ttImport(file) {
  try {
    let text = '';
    if (/\.zip$/i.test(file.name) || file.type === 'application/zip') {
      const JSZip = await loadZip(), z = await JSZip.loadAsync(file);
      const f = Object.values(z.files).filter(x => !x.dir && /\.json$/i.test(x.name)).sort((a, b) => (b._data && b._data.uncompressedSize || 0) - (a._data && a._data.uncompressedSize || 0))[0];
      if (!f) throw new Error('Im ZIP ist keine JSON-Datei – beim Export bitte „JSON“ wählen.');
      text = await f.async('string');
    } else text = await file.text();
    const found = ttParse(JSON.parse(text));
    const skipHist = found.filter(x => x.s === 'Verlauf').length;
    const keep = found.filter(x => x.s !== 'Verlauf'); // Verlauf (angesehene Videos) bewusst nicht übernehmen
    const have = new Map(TT.items.map(x => [x.v, x]));
    let n = 0;
    keep.forEach(x => { const o = have.get(x.v); if (o) { if (/^Sammlung/.test(x.s) && !/^Sammlung/.test(o.s)) o.s = x.s; return; } const it = { v: x.v, d: x.d, s: x.s }; TT.items.push(it); have.set(x.v, it); n++; });
    const rank = s => /^Sammlung/.test(s) ? 0 : s === 'Favorit' ? 1 : s === 'Gespeichert' ? 2 : 3;
    TT.items.sort((a, b) => rank(a.s) - rank(b.s) || (b.d || '').localeCompare(a.d || ''));
    if (TT.items.length > 4000) TT.items = TT.items.slice(0, 4000);
    ttSave(); render();
    toast(n ? n + ' TikToks übernommen' + (skipHist ? ' (Verlauf ausgelassen)' : '') : 'Keine neuen TikToks gefunden' + (found.length ? '' : ' – ist es der JSON-Export?'));
  } catch (e) { toast(e.message && /JSON/.test(e.message) ? e.message : 'Import fehlgeschlagen: ' + (e.message || '?')); }
}
/* Werkzeuge für Odi und Claude-Jobs */
function ttTool(name, x) {
  if (name === 'tiktok_update') {
    const L = Array.isArray(x.items) ? x.items : []; let n = 0;
    L.forEach(u => { const v = ttVid(u.id || u.url || u.v); const it = TT.items.find(y => y.v === v); if (!it) return;
      if (u.title) it.t = String(u.title).slice(0, 200); if (u.author) it.a = String(u.author).slice(0, 60); if (TT_TOPICS.includes(u.topic)) it.k = u.topic; if (u.note) it.n = String(u.note).slice(0, 300); n++; });
    if (n) ttSave();
    return { label: '🎵 TikTok: ' + n + ' Video(s) eingeordnet', result: n + ' aktualisiert' };
  }
  if (name === 'add_tiktok') {
    const v = ttVid(x.url); if (!v) throw new Error('Kein TikTok-Videolink');
    let it = TT.items.find(y => y.v === v);
    if (!it) { it = { v, d: H.today(), s: 'Gespeichert' }; TT.items.unshift(it); }
    if (x.title) it.t = String(x.title).slice(0, 200); if (TT_TOPICS.includes(x.topic)) it.k = x.topic; if (x.note) it.n = String(x.note).slice(0, 300);
    ttSave();
    return { label: '🎵 TikTok gespeichert' + (it.k ? ' · ' + it.k : ''), result: 'ok' };
  }
  return null;
}
const TT_TOOLS = [
  { name: 'add_tiktok', description: 'TikTok-Video (Link) in der TikTok-Sammlung speichern, optional mit Titel, Thema und Notiz.', input_schema: { type: 'object', additionalProperties: false, required: ['url'], properties: { url: { type: 'string' }, title: { type: 'string' }, topic: { type: 'string', enum: TT_TOPICS }, note: { type: 'string' } } } },
  { name: 'tiktok_update', description: 'Mehrere TikToks einordnen: Titel, Account, Thema, Notiz.', input_schema: { type: 'object', additionalProperties: false, required: ['items'], properties: { items: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, author: { type: 'string' }, topic: { type: 'string', enum: TT_TOPICS }, note: { type: 'string' } } } } } } }
];
function ttSnapshotText() {
  const by = {}; TT.items.forEach(x => { const k = x.k || 'unsortiert'; by[k] = (by[k] || 0) + 1; });
  return JSON.stringify({ anzahl: TT.items.length, themen: by, beispiele: TT.items.filter(x => x.t).slice(0, 25).map(x => [x.k || '', x.t]) });
}
/* ---------- Ansicht (Bereich Wissen) ---------- */
function ttCard() {
  const by = {}; TT.items.forEach(x => { const k = x.k || 'Noch nicht eingeordnet'; by[k] = (by[k] || 0) + 1; });
  const q = ttQ.toLowerCase();
  const L = TT.items.filter(x => (!ttFilter || (x.k || 'Noch nicht eingeordnet') === ttFilter) && (!q || ((x.t || '') + ' ' + (x.a || '') + ' ' + (x.n || '') + ' ' + x.s).toLowerCase().includes(q)));
  const open = TT.items.filter(x => !x.k).length;
  return `<section class="card wide tt"><h2>TikTok-Sammlung<small>${TT.items.length ? TT.items.length + ' Videos' + (open ? ' · ' + open + ' offen' : '') : 'noch leer'}</small></h2>
    ${TT.items.length ? `<div class="tags wrap">${Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<button class="chip ${ttFilter === k ? '' : 'd'}" data-act="ttf" data-v="${esc(k)}">${esc(k)} ${n}</button>`).join('')}${ttFilter ? '<button class="chip" data-act="ttf" data-v="">alle</button>' : ''}</div>
    <input type="search" id="ttQ" placeholder="In TikToks suchen …" value="${esc(ttQ)}" autocomplete="off">
    ${L.slice(0, ttShow).map(x => `<div class="row"><a class="t" href="${ttUrl(x.v)}" target="_blank" rel="noopener">${esc(x.t || 'TikTok-Video' + (x.d ? ' vom ' + H.fd(x.d) : ''))}<small>${esc([x.a ? '@' + x.a : '', x.s, x.n].filter(Boolean).join(' · '))}</small></a>${x.k ? `<span class="chip d">${esc(x.k)}</span>` : ''}${!x.w ? `<button class="chip" data-act="ttk" data-v="${x.v}" title="Ins Wissen übernehmen">→ Wissen</button>` : '<span class="chip good">im Wissen</span>'}</div>`).join('')}
    ${L.length > ttShow ? `<div class="btns"><button class="btn ghost" data-act="ttmore">Mehr anzeigen (${L.length - ttShow})</button></div>` : ''}` : `<div class="hint"><b>So kommen deine gespeicherten TikToks hierher:</b><br>
      1. TikTok → Profil → ☰ → Einstellungen und Datenschutz → Konto → <b>Deine Daten herunterladen</b><br>
      2. Format <b>JSON</b> wählen, „Alle Daten“ (oder „Aktivität“) → Anfordern. TikTok braucht meist einige Stunden bis wenige Tage.<br>
      3. Unter „Daten herunterladen“ die Datei laden und hier importieren (ZIP oder JSON).<br>
      Einzelne Videos: in TikTok „Teilen → Link kopieren“ und Odi schicken.</div>`}
    <div class="btns"><button class="btn ${TT.items.length ? 'ghost' : ''}" data-act="ttimp">TikTok-Export importieren</button>${open && (ART.sample || (typeof getKey === 'function' && getKey())) ? '' : ''}</div>
    ${TT.items.length ? '<div class="hint">Titel und Themen ergänzt der wöchentliche Claude-Job „TikTok einordnen“ automatisch. Dein Wiedergabeverlauf wird bewusst nicht übernommen.</div>' : ''}</section>`;
}
function ttToKnow(v) {
  const x = TT.items.find(y => y.v === v); if (!x) return;
  knowTool('add_knowledge', { title: x.t || 'TikTok-Video ' + (x.d ? H.fd(x.d) : v.slice(-6)), kind: 'Video', url: ttUrl(v), source: 'TikTok' + (x.a ? ' · @' + x.a : ''), summary: x.n || '', tags: ['TikTok'].concat(x.k ? [x.k] : []), status: 'Zu lesen' });
  x.w = 1; ttSave(); save('Ins Wissen übernommen');
}
function ttAct(act, b) {
  if (act === 'ttimp') { $('ttFile').value = ''; $('ttFile').click(); return true; }
  if (act === 'ttf') { ttFilter = b.dataset.v; ttShow = 30; render(); return true; }
  if (act === 'ttmore') { ttShow += 50; render(); return true; }
  if (act === 'ttk') { ttToKnow(b.dataset.v); return true; }
  return false;
}
document.addEventListener('change', e => { if (e.target.id === 'ttFile' && e.target.files[0]) ttImport(e.target.files[0]); });
document.addEventListener('input', e => { if (e.target.id === 'ttQ') { ttQ = e.target.value; clearTimeout(ttAct.t); ttAct.t = setTimeout(() => { const p = e.target.selectionStart; render(); const i = $('ttQ'); if (i) { i.focus(); i.setSelectionRange(p, p); } }, 300); } });
