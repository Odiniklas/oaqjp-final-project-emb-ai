/* Lebenshub – Wissen: Paper, Artikel, Notizen, Videos, Bücher mit Zusammenfassung, Kernaussagen und Themen.
   Daten in S.know = [{id, title, kind, url, source, summary, points:[], tags:[], status, added, docId}]
   Füllen: per Hand, aus Dokumenten, über den Assistenten (add_knowledge) und den wöchentlichen Wissens-Job. */
'use strict';
const KNOW_KINDS = ['Paper', 'Artikel', 'Notiz', 'Video', 'Buch', 'Studie', 'Patent', 'Idee'];
const KNOW_ST = ['Zu lesen', 'Gelesen', 'Verarbeitet'];
let KNOWQ = '', KNOWTAG = '';
function know() { if (!Array.isArray(S.know)) S.know = []; return S.know; }
const normTags = t => (Array.isArray(t) ? t : String(t || '').split(/[,;#]/)).map(x => String(x).trim()).filter(Boolean).slice(0, 8);

function knowTool(name, x) {
  if (name === 'add_knowledge') {
    const K = know(), title = String(x.title || '').trim();
    if (!title) throw new Error('Titel fehlt');
    let k = K.find(y => y.title.toLowerCase() === title.toLowerCase() || (x.url && y.url === x.url));
    const isNew = !k;
    if (!k) { k = { id: uid(), title, kind: 'Notiz', url: '', source: '', summary: '', points: [], tags: [], status: 'Zu lesen', added: H.today() }; K.unshift(k); }
    if (KNOW_KINDS.includes(x.kind)) k.kind = x.kind;
    ['url', 'source', 'summary'].forEach(f => { if (x[f]) k[f] = String(x[f]).slice(0, 4000); });
    if (Array.isArray(x.points) && x.points.length) k.points = x.points.map(String).slice(0, 10);
    if (x.tags) k.tags = Array.from(new Set(k.tags.concat(normTags(x.tags))));
    if (KNOW_ST.includes(x.status)) k.status = x.status;
    return { label: (isNew ? '📚 Wissen: ' : '📚 Aktualisiert: ') + k.title, result: (isNew ? 'angelegt' : 'aktualisiert') + ', id=' + k.id };
  }
  if (name === 'get_knowledge') {
    const k = know().find(y => y.id === x.id || y.title.toLowerCase() === String(x.id || x.title || '').toLowerCase());
    if (!k) throw new Error('Nicht gefunden');
    return { label: '📖 gelesen: ' + k.title, result: JSON.stringify(k) };
  }
  return null;
}
const KNOW_TOOLS = [
  { name: 'add_knowledge', description: 'Wissen speichern oder ergänzen: Paper, Artikel, Notiz, Video, Buch, Studie, Patent oder Idee – mit Zusammenfassung, Kernaussagen und Themen (tags).',
    input_schema: { type: 'object', additionalProperties: false, required: ['title'], properties: { title: { type: 'string' }, kind: { type: 'string', enum: KNOW_KINDS }, url: { type: 'string' }, source: { type: 'string', description: 'Autor/Verlag/Institut, Jahr' },
      summary: { type: 'string', description: '3–6 Sätze' }, points: { type: 'array', items: { type: 'string' }, description: 'Kernaussagen' }, tags: { type: 'array', items: { type: 'string' } }, status: { type: 'string', enum: KNOW_ST } } } },
  { name: 'get_knowledge', description: 'Einen Wissenseintrag vollständig lesen (Zusammenfassung, Kernaussagen), um Fragen dazu zu beantworten.',
    input_schema: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: { type: 'string', description: 'id oder Titel' } } } }
];
function knowSnapshotText() {
  return JSON.stringify(know().slice(0, 80).map(k => [k.id, k.title, k.kind, k.tags.join(','), k.status]));
}

/* ---------- Ansicht ---------- */
function knowView() {
  const K = know(), tags = {};
  K.forEach(k => k.tags.forEach(t => { tags[t] = (tags[t] || 0) + 1; }));
  const q = KNOWQ.trim().toLowerCase();
  const L = K.filter(k => (!KNOWTAG || k.tags.includes(KNOWTAG)) && (!q || (k.title + ' ' + k.summary + ' ' + k.tags.join(' ') + ' ' + k.source).toLowerCase().includes(q)));
  const counts = KNOW_ST.map(s => K.filter(k => k.status === s).length);
  return `<section class="card wide know"><h2>Wissen<small>${K.length} Einträge · ${counts[0]} zu lesen</small></h2>
    <input type="search" id="knowq" placeholder="Wissen durchsuchen …" value="${esc(KNOWQ)}" autocomplete="off">
    ${Object.keys(tags).length ? `<div class="tags"><button class="chip ${KNOWTAG ? 'd' : ''}" data-act="ktag" data-v="">Alle</button>${Object.keys(tags).sort((a, b) => tags[b] - tags[a]).slice(0, 14).map(t => `<button class="chip ${KNOWTAG === t ? '' : 'd'}" data-act="ktag" data-v="${esc(t)}">${esc(t)} ${tags[t]}</button>`).join('')}</div>` : ''}
    ${L.map(k => `<div class="row"><button class="t" data-act="kopen" data-id="${k.id}">${esc(k.title)}<small>${esc([k.kind, k.source, k.tags.slice(0, 3).join(', ')].filter(Boolean).join(' · '))}</small></button><span class="chip ${k.status === 'Verarbeitet' ? 'good' : k.status === 'Gelesen' ? '' : 'warn'}">${esc(k.status)}</span></div>`).join('')
      || `<div class="empty">${K.length ? 'Nichts gefunden.' : 'Hier sammelst du Paper, Studien, Artikel, Videos und eigene Notizen – mit Zusammenfassung und Kernaussagen. Füllen: „+ Wissen“, im Assistenten („Fasse dieses Paper zusammen und speichere es“) oder automatisch über den wöchentlichen Wissens-Job.'}</div>`}
    <div class="btns"><button class="btn" data-act="knew">+ Wissen</button>${ART.sample || (typeof getKey === 'function' && getKey()) ? '<button class="btn ghost" data-act="kask">Frag dein Wissen</button>' : ''}</div></section>`;
}
function editKnow(id) {
  const K = know(), k = id ? K.find(x => x.id === id) : null;
  openDlg(`<h3>${k ? esc(k.title) : 'Neues Wissen'}</h3>
    <label class="f">Titel<input type="text" name="ti" value="${esc(k ? k.title : '')}" required></label>
    <div class="f2"><label class="f">Art<select name="ki">${KNOW_KINDS.map(x => `<option ${k && k.kind === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
    <label class="f">Status<select name="st">${KNOW_ST.map(x => `<option ${k && k.status === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label></div>
    <label class="f">Link<input type="text" name="ur" value="${esc(k ? k.url : '')}" placeholder="https://…" inputmode="url"></label>
    <label class="f">Quelle (Autor, Institut, Jahr)<input type="text" name="so" value="${esc(k ? k.source : '')}"></label>
    <label class="f">Zusammenfassung / Notiz<textarea name="su" rows="5" placeholder="Eigene Notiz – oder Text einfügen und von Claude zusammenfassen lassen">${esc(k ? k.summary : '')}</textarea></label>
    ${k && k.points.length ? `<div class="hint"><b>Kernaussagen</b><ul class="acts">${k.points.map(p => `<li>• ${esc(p)}</li>`).join('')}</ul></div>` : ''}
    <label class="f">Themen (mit Komma getrennt)<input type="text" name="tg" value="${esc(k ? k.tags.join(', ') : '')}" placeholder="BESS, Robotik, Gesundheit"></label>
    ${k && k.url ? `<a href="${esc(k.url)}" target="_blank" rel="noopener">Quelle öffnen</a>` : ''}
    <div class="btns"><button class="btn" value="save">Speichern</button>${ART.sample || (typeof getKey === 'function' && getKey()) ? '<button class="btn ghost" value="sum">Mit Claude zusammenfassen</button>' : ''}${k ? '<button class="btn warn" value="del" formnovalidate>Löschen</button>' : ''}<button class="btn ghost" value="cancel" formnovalidate>Abbrechen</button></div>`, async (v, f) => {
    if (v === 'del') { askConfirm('„' + k.title + '“ löschen?', 'Löschen').then(ok => { if (ok) { S.know = K.filter(x => x !== k); save('Gelöscht'); } }); return; }
    const data = { title: f.ti.value, kind: f.ki.value, status: f.st.value, url: f.ur.value.trim(), source: f.so.value.trim(), summary: f.su.value.trim(), tags: normTags(f.tg.value) };
    let item = k;
    if (k) Object.assign(k, data, { tags: data.tags });
    else { const nid = knowTool('add_knowledge', data).result.split('id=')[1]; item = know().find(x => x.id === nid); }
    if (v === 'sum' && item) {
      if (!data.summary) { save(); return toast('Füge zuerst den Text (oder einen Ausschnitt) ins Feld ein.'); }
      busy(true);
      try {
        const out = await askJson(`Fasse den folgenden Text für meine persönliche Wissensdatenbank auf Deutsch zusammen. Antworte nur mit JSON: {"title":"…","summary":"3–6 Sätze","points":["Kernaussage", "…"],"tags":["Thema", "…"],"source":"Autor/Institut, Jahr oder leer"}. Nichts erfinden.\n\nTitel bisher: ${item.title}\n\n<text>\n${data.summary.slice(0, 60000)}\n</text>`);
        if (out.summary) item.summary = String(out.summary); if (Array.isArray(out.points)) item.points = out.points.map(String).slice(0, 10);
        if (out.tags) item.tags = Array.from(new Set(item.tags.concat(normTags(out.tags)))); if (out.source && !item.source) item.source = String(out.source);
        save('Zusammengefasst'); setTimeout(() => editKnow(item.id), 0);
      } catch (e) { save(); toast(e.message || 'Zusammenfassung nicht möglich'); } finally { busy(false); }
      return;
    }
    save('Gespeichert');
  });
}
/* Kurze JSON-Anfrage an Claude: im Artefakt über das Abo, sonst über den API-Schlüssel */
async function askJson(prompt) {
  if (ART.sample) { try { return await ART.sample.json(prompt, { modelTier: 'default', effort: 'low', cache: false }); } catch (e) { throw new Error(sampleErr(e)); } }
  const { client, A } = await apiClient();
  try {
    const res = await client.beta.messages.create({ ...baseParams(), max_tokens: 4000, output_config: { effort: 'low' }, messages: [{ role: 'user', content: prompt }] });
    track(res);
    const t = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
    return JSON.parse((t.match(/\{[\s\S]*\}/) || ['{}'])[0]);
  } catch (e) { throw new Error(errText(e, A)); }
}
/* Frage an die Wissensbasis: läuft über den Assistenten (der get_knowledge nutzen kann) */
function askKnowledge() {
  TAB = 'chat'; chatDraft = 'Was sagt mein Wissen zu ';
  render(); const i = $('chatIn'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
}
function docToKnow(d) {
  const a = d.analysis || {};
  const r = knowTool('add_knowledge', { title: a.title || d.name, kind: /paper|studie|study/i.test(d.name + ' ' + (a.title || '')) ? 'Paper' : 'Artikel', summary: a.summary || '',
    points: (a.facts || []).map(f => f.label + ': ' + f.value), tags: [AREA[d.area] || 'Arbeit'] });
  const k = know().find(x => x.id === r.result.split('id=')[1]); if (k) k.docId = d.id;
  save('Ins Wissen übernommen');
}
function knowAct(act, b) {
  if (act === 'knew') { editKnow(); return true; }
  if (act === 'kopen') { editKnow(b.dataset.id); return true; }
  if (act === 'ktag') { KNOWTAG = b.dataset.v; render(); return true; }
  if (act === 'kask') { askKnowledge(); return true; }
  return false;
}
document.addEventListener('input', e => {
  if (e.target.id !== 'knowq') return;
  KNOWQ = e.target.value; const pos = e.target.selectionStart; render();
  const i = $('knowq'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (er) { /* egal */ } }
});
