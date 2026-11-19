/* Lebenshub – Assistent: Chat (Text oder Sprache) mit Claude, der den Hub selbst pflegt.
   Nutzt Globals aus app.js/docs.js (S, H, C, esc, uid, save, toast, render, claude, errText, toBlock, normImage, DB, DOCS, meta, AREA). */
'use strict';
const CHAT_KEY = 'lebenshub-chat';
let CHAT = [], chatBusy = false, chatDraft = '', chatFiles = [], undoSnap = null, speakOn = false, recog = null;
try { CHAT = JSON.parse(localStorage.getItem(CHAT_KEY)) || []; } catch (e) { CHAT = []; }
try { speakOn = localStorage.getItem(CHAT_KEY + '-tts') === '1'; } catch (e) { /* egal */ }
function saveChat() { try { localStorage.setItem(CHAT_KEY, JSON.stringify(CHAT.slice(-60))); } catch (e) { /* egal */ } }

const SYS = `Du bist der persönliche Assistent im „Lebenshub“, einer App für Termine, Routinen, Arbeit, Finanzen und Gesundheit. Antworte auf Deutsch, knapp, direkt und freundlich (Du-Form).
Deine Aufgabe: Alles, was der Nutzer erzählt, diktiert oder anhängt, sofort sinnvoll in den Hub übernehmen – ohne Rückfrage, wenn die Zuordnung klar ist.
- Neue Infos (Termine, Fristen, Kontostände, Bewerbungen, Ideen, Beschwerden …) mit add_entry in die passende Liste eintragen; Bestehendes mit update_entry aktualisieren statt doppelt anzulegen (prüfe die Hub-Daten auf vorhandene Einträge).
- Wiederkehrendes als Routine (add_routine). Erledigtes abhaken (complete_routine, oder Status per update_entry).
- Angehängte Dokumente/Fotos: Inhalt auswerten, die Datei mit store_attachment im passenden Bereich ablegen und die relevanten Fakten als Einträge übernehmen.
- Kontostände/Depotwerte: Liste „Konten & Depots“ (k), Wert und Stichtag in note, Datum = Stichtag.
- Nur übernehmen, was der Nutzer sagt oder was im Dokument steht – nichts erfinden. Datumsangaben als JJJJ-MM-TT. Keine IBAN, Konto-, Depot-, Versicherungs- oder Kundennummern speichern.
- Bei echter Mehrdeutigkeit kurz nachfragen, sonst handeln.
Nach dem Handeln: in 1–3 Sätzen sagen, was du eingetragen/geändert hast, und – wenn sinnvoll – einen konkreten nächsten Schritt vorschlagen, damit Projekte gut vorankommen. Bei Fragen zum Hub (z. B. „Was steht diese Woche an?“) aus den Hub-Daten antworten. Keine Anlage-, Rechts- oder medizinische Beratung im engeren Sinn; bei Gesundheitsthemen sachlich bleiben und bei Warnzeichen zum Arzt raten.`;

function listEnum() { return C.map(c => c.k); }
function tools() {
  const str = d => ({ type: 'string', description: d });
  return [
    { name: 'add_entry', description: 'Neuen Eintrag in einer Liste des Hubs anlegen.',
      input_schema: { type: 'object', additionalProperties: false, required: ['list', 'title'], properties: {
        list: { type: 'string', enum: listEnum(), description: 'Listen-Schlüssel (siehe Hub-Daten)' }, title: str('Kurzer Titel'),
        note: str('Notiz/Wert, optional'), date: str('Datum/Frist JJJJ-MM-TT, optional'), status: str('Statusname der Liste, optional') } } },
    { name: 'update_entry', description: 'Vorhandenen Eintrag ändern (nur angegebene Felder).',
      input_schema: { type: 'object', additionalProperties: false, required: ['list', 'id'], properties: {
        list: { type: 'string', enum: listEnum() }, id: str('Eintrags-ID aus den Hub-Daten'), title: str('neuer Titel'),
        note: str('neue Notiz/Wert'), date: str('neues Datum JJJJ-MM-TT oder leer zum Entfernen'), status: str('neuer Statusname') } } },
    { name: 'delete_entry', description: 'Eintrag löschen – nur wenn der Nutzer es ausdrücklich will.',
      input_schema: { type: 'object', additionalProperties: false, required: ['list', 'id'], properties: { list: { type: 'string', enum: listEnum() }, id: str('Eintrags-ID') } } },
    { name: 'add_routine', description: 'Wiederkehrende Aufgabe anlegen.',
      input_schema: { type: 'object', additionalProperties: false, required: ['title', 'freq'], properties: {
        title: str('Aufgabe'), note: str('Notiz, optional'), freq: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
        every: { type: 'integer', description: 'Alle N Tage/Wochen/Monate, Standard 1' }, weekday: { type: 'integer', description: '0=So … 6=Sa (bei weekly)' },
        monthday: { type: 'integer', description: '1–28, 31=letzter Tag (bei monthly)' }, time: str('Uhrzeit HH:MM, optional') } } },
    { name: 'complete_routine', description: 'Routine für heute als erledigt abhaken.',
      input_schema: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: str('Routinen-ID') } } },
    { name: 'delete_routine', description: 'Routine löschen – nur auf ausdrücklichen Wunsch.',
      input_schema: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: str('Routinen-ID') } } },
    { name: 'store_attachment', description: 'Die in dieser Nachricht angehängten Dateien im passenden Bereich unter „Dokumente“ ablegen, mit Titel und Kurzfassung.',
      input_schema: { type: 'object', additionalProperties: false, required: ['area', 'title', 'summary'], properties: {
        area: { type: 'string', enum: ['work', 'money', 'health'] }, title: str('Titel des Dokuments'), summary: str('2–4 Sätze Zusammenfassung') } } }
  ];
}

function hubSnapshot() {
  const t = H.today();
  const lists = C.map(c => ({ key: c.k, title: c.title, bereich: c.tab, status: c.st || null,
    items: S.lists[c.k].map(it => Object.assign({ id: it.id, title: it.n }, it.t ? { note: it.t } : {}, it.d ? { date: it.d } : {}, c.st ? { status: c.st[it.s] } : {})) }));
  const routines = S.routines.map(r => { const st = H.state(r, t); return { id: r.id, title: r.n, rhythmus: H.freqLabel(r), time: r.time || null, faellig: st.due, naechster: st.next, zuletzt: r.last || null, claude: !!r.claude }; });
  const docs = DOCS.map(d => ({ bereich: d.area, name: d.name, title: d.analysis && d.analysis.title || null }));
  return 'Heute: ' + t + ' (' + H.WDL[H.P(t).getUTCDay()] + ')\nHub-Daten (JSON):\n' + JSON.stringify({ lists, routines, dokumente: docs });
}

function runTool(name, x, turn) {
  const L = k => { if (!S.lists[k]) throw new Error('Unbekannte Liste ' + k); return S.lists[k]; };
  const stIdx = (k, s) => { const c = C.find(y => y.k === k); if (!c.st || !s) return 0; const i = c.st.findIndex(v => v.toLowerCase() === String(s).toLowerCase()); return i < 0 ? 0 : i; };
  const date = d => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : '');
  const title = k => (C.find(y => y.k === k) || {}).title;
  switch (name) {
    case 'add_entry': {
      const it = { id: uid(), n: String(x.title).trim(), t: x.note || '', d: date(x.date), s: stIdx(x.list, x.status) };
      L(x.list).push(it);
      return { label: '＋ ' + title(x.list) + ': ' + it.n, result: 'angelegt, id=' + it.id };
    }
    case 'update_entry': {
      const it = L(x.list).find(y => y.id === x.id);
      if (!it) throw new Error('Eintrag nicht gefunden');
      if (x.title) it.n = x.title; if (x.note != null) it.t = x.note; if (x.date != null) it.d = date(x.date);
      if (x.status) it.s = stIdx(x.list, x.status);
      return { label: '✎ ' + title(x.list) + ': ' + it.n, result: 'aktualisiert' };
    }
    case 'delete_entry': {
      const arr = L(x.list), it = arr.find(y => y.id === x.id);
      if (!it) throw new Error('Eintrag nicht gefunden');
      S.lists[x.list] = arr.filter(y => y.id !== x.id);
      return { label: '− ' + title(x.list) + ': ' + it.n, result: 'gelöscht' };
    }
    case 'add_routine': {
      const t = H.today(), freq = ['daily', 'weekly', 'monthly'].includes(x.freq) ? x.freq : 'daily';
      const r = { id: uid(), n: String(x.title).trim(), note: x.note || '', freq, every: Math.max(1, x.every | 0 || 1), wd: x.weekday != null ? (x.weekday | 0) % 7 : 1,
        md: Math.min(31, Math.max(1, x.monthday | 0 || 1)), time: /^\d{2}:\d{2}$/.test(x.time || '') ? x.time : '', start: t, last: '', hist: [] };
      if (freq === 'weekly') r.start = H.firstWd(t, r.wd);
      S.routines.push(r);
      return { label: '↻ Routine: ' + r.n + ' (' + H.freqLabel(r) + ')', result: 'angelegt, id=' + r.id };
    }
    case 'complete_routine': {
      const r = S.routines.find(y => y.id === x.id), t = H.today();
      if (!r) throw new Error('Routine nicht gefunden');
      r.last = t; r.hist = (r.hist || []).filter(v => v !== t).concat(t).slice(-60);
      return { label: '✓ ' + r.n, result: 'erledigt' };
    }
    case 'delete_routine': {
      const r = S.routines.find(y => y.id === x.id);
      if (!r) throw new Error('Routine nicht gefunden');
      S.routines = S.routines.filter(y => y.id !== x.id);
      return { label: '− Routine: ' + r.n, result: 'gelöscht' };
    }
    case 'store_attachment': {
      if (!turn.files.length) throw new Error('Keine Datei angehängt');
      turn.files.forEach(f => { f.area = ['work', 'money', 'health'].includes(x.area) ? x.area : 'work'; f.analysis = { title: x.title, summary: x.summary, facts: [], entries: [], at: new Date().toISOString() }; });
      turn.stored = true;
      return { label: '📎 Dokument abgelegt (' + AREA[turn.files[0].area] + '): ' + x.title, result: 'abgelegt' };
    }
  }
  throw new Error('Unbekanntes Werkzeug ' + name);
}

/* Verlauf als reine Text-Nachrichten (die Werkzeug-Schleife eines Zugs bleibt nur während des Zugs erhalten) */
function history() {
  const h = [];
  CHAT.slice(-20).forEach(m => {
    if (m.err) return;
    const text = m.text + (m.actions && m.actions.length ? '\n[Ausgeführt: ' + m.actions.join('; ') + ']' : '') + (m.files && m.files.length ? '\n[Angehängt: ' + m.files.join(', ') + ']' : '');
    if (h.length && h[h.length - 1].role === m.role) h[h.length - 1].content += '\n\n' + text;
    else h.push({ role: m.role, content: text || '…' });
  });
  while (h.length && h[0].role !== 'user') h.shift();
  if (h.length && h[h.length - 1].role === 'user') h.pop(); // unbeantwortete Nachricht nicht doppelt senden
  return h;
}

async function sendChat(text) {
  text = (text || '').trim();
  if (chatBusy || (!text && !chatFiles.length)) return;
  const files = chatFiles; chatFiles = []; chatDraft = '';
  CHAT.push({ role: 'user', text, files: files.map(f => f.name), at: Date.now() });
  chatBusy = true; saveChat(); render(); scrollChat();
  const snap = JSON.stringify(S), turn = { files: files.map(f => ({ id: uid(), name: f.name, type: f.type || '', size: f.size, added: H.today(), blob: f })), stored: false };
  let reply = '', actions = [], err = false;
  try {
    const { client, A } = await claude();
    const content = [];
    for (const f of turn.files) content.push(await toBlock(f));
    content.push({ type: 'text', text: text || 'Bitte auswerten und in den Hub übernehmen.' });
    const msgs = history().concat([{ role: 'user', content }]);
    const system = [{ type: 'text', text: SYS }, { type: 'text', text: hubSnapshot() }];
    for (let i = 0; i < 10; i++) {
      let res;
      try {
        res = await client.beta.messages.create({ model: 'claude-opus-5-5', max_tokens: 16000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
          output_config: { effort: 'medium' }, system, tools: tools(), messages: msgs });
      } catch (e) { throw new Error(errText(e, A)); }
      msgs.push({ role: 'assistant', content: res.content });
      const said = res.content.filter(b => b.type === 'text').map(b => b.text).join('').trim();
      if (said) reply = said;
      if (res.stop_reason === 'refusal') { reply = reply || 'Dazu kann ich leider nicht helfen.'; break; }
      const uses = res.content.filter(b => b.type === 'tool_use');
      if (res.stop_reason !== 'tool_use' || !uses.length) break;
      msgs.push({ role: 'user', content: uses.map(u => {
        try { const r = runTool(u.name, u.input || {}, turn); actions.push(r.label); return { type: 'tool_result', tool_use_id: u.id, content: r.result }; }
        catch (e) { return { type: 'tool_result', tool_use_id: u.id, content: 'Fehler: ' + e.message, is_error: true }; }
      }) });
    }
    // Angehängte Dateien immer ablegen – notfalls im Bereich Arbeit
    for (const f of turn.files) { if (!f.area) f.area = 'work'; await DB.put(f); DOCS.push(meta(f)); }
    if (turn.files.length && !turn.stored) actions.push('📎 ' + turn.files.length + ' Datei(en) unter Arbeit → Dokumente abgelegt');
  } catch (e) { reply = e.message || String(e); err = true; }
  chatBusy = false;
  undoSnap = actions.length ? snap : null;
  CHAT.push({ role: 'assistant', text: reply || (actions.length ? 'Erledigt.' : '…'), actions, err, at: Date.now() });
  saveChat();
  if (actions.length) save(); else render();
  scrollChat();
  if (speakOn && reply && !err) speak(reply);
}

function undoLast() {
  if (!undoSnap) return;
  const settings = S.settings;
  S = JSON.parse(undoSnap); S.settings = settings; undoSnap = null;
  const m = CHAT[CHAT.length - 1]; if (m) m.undone = true;
  saveChat(); save('Änderungen rückgängig gemacht');
}

/* ---------- Sprache ---------- */
function speak(t) {
  try { const u = new SpeechSynthesisUtterance(t.replace(/[*#_`]/g, '')); u.lang = 'de-DE'; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch (e) { /* egal */ }
}
function listen() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast('Tipp: Nutze das Mikrofon auf der iPhone-Tastatur zum Diktieren.'); const i = $('chatIn'); if (i) i.focus(); return; }
  if (recog) { recog.stop(); return; }
  recog = new SR(); recog.lang = 'de-DE'; recog.interimResults = true; recog.continuous = false;
  let finalText = '';
  recog.onresult = e => { let s = ''; for (const r of e.results) s += r[0].transcript; finalText = s; const i = $('chatIn'); if (i) i.value = s; chatDraft = s; };
  recog.onend = () => { recog = null; render(); if (finalText.trim()) sendChat(finalText); };
  recog.onerror = e => { recog = null; render(); if (e.error === 'not-allowed') toast('Mikrofon nicht erlaubt – in den iPhone-Einstellungen freigeben oder Tastatur-Diktat nutzen.'); };
  recog.start(); render();
}

/* ---------- Ansicht ---------- */
function fmtText(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); }
function viewChat() {
  if (!getKey()) return `<section class="card wide"><h2>Assistent</h2><div class="hint">Der Assistent nutzt Claude und braucht deinen API-Schlüssel (console.anthropic.com). Hinterlege ihn unter ⚙︎ → „KI-Analyse von Dokumenten“.</div><div class="btns"><button class="btn" data-act="tab" data-v="settings">Zu den Einstellungen</button></div></section>`;
  const last = CHAT[CHAT.length - 1];
  const msgs = CHAT.map((m, i) => `<div class="msg ${m.role}${m.err ? ' err' : ''}">${m.text ? `<div>${fmtText(m.text)}</div>` : ''}${m.files && m.files.length ? `<small>📎 ${m.files.map(esc).join(', ')}</small>` : ''}${m.actions && m.actions.length ? `<ul class="acts">${m.actions.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}${i === CHAT.length - 1 && undoSnap && !m.undone ? '<button class="chip" data-act="cundo">Rückgängig</button>' : ''}${m.undone ? '<small>rückgängig gemacht</small>' : ''}</div>`).join('')
    || '<div class="hint">Erzähl mir einfach, was ansteht – oder häng ein Dokument/Foto an. Ich trage alles in deinen Hub ein. Zum Beispiel: „Ich hab am Dienstag um 10 Physio wegen dem Knie“, „Mein Trade-Republic-Depot steht bei 22.000 €“ oder „Was steht diese Woche an?“</div>';
  return `<section class="card wide chat"><h2>Assistent<small><button class="chip ${speakOn ? '' : 'd'}" data-act="ctts">${speakOn ? '🔊 Vorlesen an' : '🔈 Vorlesen aus'}</button> ${CHAT.length ? '<button class="chip d" data-act="cclear">Leeren</button>' : ''}</small></h2>
    <div class="msgs" id="msgs">${msgs}${chatBusy ? '<div class="msg assistant"><div class="typing">Claude denkt nach …</div></div>' : ''}</div>
    ${chatFiles.length ? `<div class="hint">📎 ${chatFiles.map(f => esc(f.name)).join(', ')} <button class="chip d" data-act="cfclear">entfernen</button></div>` : ''}
    <div class="chatbar"><button class="icon-btn" data-act="cattach" aria-label="Datei anhängen">＋</button>
      <textarea id="chatIn" rows="1" placeholder="Schreiben …" ${chatBusy ? 'disabled' : ''}>${esc(chatDraft)}</textarea>
      <button class="icon-btn ${recog ? 'on' : ''}" data-act="cmic" aria-label="Sprechen">🎤</button>
      <button class="btn" data-act="csend" ${chatBusy ? 'disabled' : ''}>Senden</button></div></section>`;
}
function scrollChat() { requestAnimationFrame(() => { const m = $('msgs'); if (m) m.scrollTop = m.scrollHeight; }); }

function chatAct(act) {
  switch (act) {
    case 'csend': { const i = $('chatIn'); sendChat(i ? i.value : ''); return true; }
    case 'cmic': listen(); return true;
    case 'cattach': $('chatFile').click(); return true;
    case 'cfclear': chatFiles = []; render(); return true;
    case 'cundo': undoLast(); return true;
    case 'ctts': speakOn = !speakOn; try { localStorage.setItem(CHAT_KEY + '-tts', speakOn ? '1' : '0'); } catch (e) { /* egal */ } if (!speakOn) try { speechSynthesis.cancel(); } catch (e) { /* egal */ } render(); return true;
    case 'cclear': if (confirm('Chatverlauf löschen? Deine Hub-Daten bleiben erhalten.')) { CHAT = []; undoSnap = null; saveChat(); render(); } return true;
  }
  return false;
}
document.addEventListener('input', e => { if (e.target.id === 'chatIn') chatDraft = e.target.value; });
document.addEventListener('keydown', e => { if (e.target.id === 'chatIn' && e.key === 'Enter' && !e.shiftKey && !/iphone|ipad|android/i.test(navigator.userAgent)) { e.preventDefault(); sendChat(e.target.value); } });
document.addEventListener('change', async e => {
  if (e.target.id !== 'chatFile' || !e.target.files.length) return;
  const fl = Array.from(e.target.files); e.target.value = '';
  for (const f of fl) chatFiles.push(f.type.startsWith('image/') || /\.hei[cf]$/i.test(f.name) ? await normImage(f) : f);
  render();
});
