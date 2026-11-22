/* Lebenshub – Assistent: Chat (Text oder Sprache) mit Claude, der den Hub selbst pflegt.
   Zwei Wege: „API“ (direkt in der App, eigener Schlüssel) oder „Claude-Abo“ (über die Claude-App, ohne API-Kosten).
   Nutzt Globals aus app.js/docs.js (S, H, C, esc, uid, save, toast, render, claude, baseParams, track, fusd, errText,
   toBlock, normImage, DB, DOCS, meta, AREA, loadSdk, getKey). */
'use strict';
const CHAT_KEY = 'lebenshub-chat';
let CHAT = [], chatBusy = false, chatDraft = '', chatFiles = [], undoSnap = null, recog = null, viaVoice = false, ttsReady = false;
const pref = (k, d) => { try { const v = localStorage.getItem(CHAT_KEY + '-' + k); return v == null ? d : v; } catch (e) { return d; } };
const setPref = (k, v) => { try { localStorage.setItem(CHAT_KEY + '-' + k, v); } catch (e) { /* egal */ } };
let speakOn = pref('tts', '0') === '1', talkMode = false, mode = pref('mode', 'api'); // 'api' | 'abo'
try { CHAT = JSON.parse(localStorage.getItem(CHAT_KEY)) || []; } catch (e) { CHAT = []; }
function saveChat() { try { localStorage.setItem(CHAT_KEY, JSON.stringify(CHAT.slice(-60))); } catch (e) { /* egal */ } }

/* Stabiler Teil des Prompts (wird gecacht – nicht pro Anfrage verändern) */
const SYS = `Du bist der persönliche Assistent im „Lebenshub“ (Termine, Routinen, Arbeit, Finanzen, Gesundheit). Antworte auf Deutsch, knapp und freundlich (Du-Form).
Übernimm alles, was der Nutzer erzählt oder anhängt, sofort in den Hub – ohne Rückfrage, wenn die Zuordnung klar ist:
- Termine auf Fotos/Screenshots (z. B. Physio-Terminzettel) → je Termin add_entry in Liste t mit date und time (HH:MM), Ort in note.
- TikTok-Links → add_tiktok mit passendem Thema; Fragen zu gespeicherten TikToks aus der TikTok-Sammlung beantworten.
- Verträge, Versicherungen, Miete, Nebenkosten, Strom, Kfz, Handy, Abos, Vorsorge (auch aus Screenshots/Policen/Kontoauszügen) → set_contract mit Bereich, Anbieter, Betrag, Rhythmus, Frist/Kündigungsfrist – niemals Vertrags-, Policen-, Kunden- oder IBAN-Nummern. Gehalt/Netto → set_income.
- Berechnungen, Bewertungen, Businesspläne, Investitionen: zuerst get_knowledge „Methoden-Baukasten: Bewertung, Investition und Businessplan“ und passende Fach-/Projekt-Einträge (z. B. Masterarbeit Batterie, Studium-Profil) lesen, Formeln daraus nutzen, Rechenweg kurz zeigen, Annahmen offenlegen; reale Zahlen aus Finanzen/Wissen bevorzugen.
- Gehirn: Erkennst du bereichsübergreifende Zusammenhänge (z. B. Uni-Wissen ↔ Depot, Gesundheit ↔ Training, Idee ↔ Startup), speichere sie mit add_insight; nutze vorhandene Erkenntnisse beim Antworten.
- Neues mit add_entry in die passende Liste; Vorhandenes mit update_entry aktualisieren statt doppelt anlegen (IDs aus den Hub-Daten).
- Wiederkehrendes als Routine (add_routine), Erledigtes abhaken (complete_routine bzw. Status per update_entry).
- Angehängte Dateien: auswerten, mit store_attachment im passenden Bereich ablegen, relevante Fakten als Einträge übernehmen.
- Konten, Depots, Wertpapiere und Kurse mit set_account / set_position / set_prices (Beträge in EUR, Stichtag angeben).
- Essensfotos: Lebensmittel und Portion erkennen, Nährwerte realistisch schätzen und mit add_meal eintragen; kurz sagen, was heute noch fehlt (Eiweiß, Gemüse …) und eine gesunde Rezeptidee nennen (gern Thermomix-tauglich).
- Screenshots von Uhr/Fitness-App (Mi Fitness, Garmin) oder Angaben zu Schlaf, Puls, Schritten, Befinden: mit set_health_day speichern (Datum = Aufwachtag).
- Wissen (Paper, Artikel, Studien, Videos, Notizen) mit add_knowledge speichern – mit Zusammenfassung, Kernaussagen und Themen. Fragen zum Wissen: passende Einträge mit get_knowledge lesen und mit Quelle antworten.
- Nichts erfinden. Datum als JJJJ-MM-TT. Keine IBAN, Konto-, Depot-, Versicherungs- oder Kundennummern speichern.
- LifeOS-Regeln: Kennzeichne Aussagen als belegt, Nutzerbericht, Annahme, Hypothese oder offen. Ein Gespräch, Interesse oder versendeter Lebenslauf ist keine Zusage, Stelle, Betreuung oder Partnerschaft (Kontaktstufen IDEA → CONTACTED → DISCUSSED → NEXT_STEP_AGREED → FORMAL_OFFER → CONTRACT_SIGNED). Fehlen Zahlen, rechne mit Szenarien statt Punktwerten. Projektwissen steht im Wissen mit Tag „LifeOS“ (get_knowledge). Enthält eine Nachricht einen Prompt aus der Prompt-Bibliothek, befolge ihn und schreibe erst nach „übernehmen“ in den Hub.
- Nur bei echter Mehrdeutigkeit kurz nachfragen.
Danach in 1–2 Sätzen sagen, was du geändert hast; wenn sinnvoll ein konkreter nächster Schritt. Fragen zum Hub aus den Hub-Daten beantworten. Keine Anlage-, Rechts- oder medizinische Beratung im engeren Sinn; bei gesundheitlichen Warnzeichen zum Arzt raten.`;

function listEnum() { return C.map(c => c.k); }
function tools() {
  const str = d => ({ type: 'string', description: d });
  return [
    { name: 'add_entry', description: 'Neuen Eintrag in einer Liste anlegen.',
      input_schema: { type: 'object', additionalProperties: false, required: ['list', 'title'], properties: {
        list: { type: 'string', enum: listEnum() }, title: str('Kurzer Titel'), note: str('Notiz/Wert'), date: str('JJJJ-MM-TT'), time: str('Uhrzeit HH:MM bei Terminen'), status: str('Statusname der Liste') } } },
    { name: 'update_entry', description: 'Eintrag ändern (nur angegebene Felder).',
      input_schema: { type: 'object', additionalProperties: false, required: ['list', 'id'], properties: {
        list: { type: 'string', enum: listEnum() }, id: str('Eintrags-ID'), title: str('Titel'), note: str('Notiz/Wert'), date: str('JJJJ-MM-TT, leer = entfernen'), status: str('Statusname') } } },
    { name: 'delete_entry', description: 'Eintrag löschen – nur auf ausdrücklichen Wunsch.',
      input_schema: { type: 'object', additionalProperties: false, required: ['list', 'id'], properties: { list: { type: 'string', enum: listEnum() }, id: str('Eintrags-ID') } } },
    { name: 'add_routine', description: 'Wiederkehrende Aufgabe anlegen.',
      input_schema: { type: 'object', additionalProperties: false, required: ['title', 'freq'], properties: {
        title: str('Aufgabe'), note: str('Notiz'), freq: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
        every: { type: 'integer', description: 'alle N Einheiten, Standard 1' }, weekday: { type: 'integer', description: '0=So…6=Sa' },
        monthday: { type: 'integer', description: '1–28, 31=letzter Tag' }, time: str('HH:MM') } } },
    { name: 'complete_routine', description: 'Routine heute abhaken.',
      input_schema: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: str('Routinen-ID') } } },
    { name: 'delete_routine', description: 'Routine löschen – nur auf ausdrücklichen Wunsch.',
      input_schema: { type: 'object', additionalProperties: false, required: ['id'], properties: { id: str('Routinen-ID') } } },
    { name: 'store_attachment', description: 'Angehängte Dateien dieser Nachricht unter „Dokumente“ ablegen.',
      input_schema: { type: 'object', additionalProperties: false, required: ['area', 'title', 'summary'], properties: {
        area: { type: 'string', enum: ['work', 'money', 'health'] }, title: str('Titel'), summary: str('2–4 Sätze') } } }
  ].concat(typeof FIN_TOOLS !== 'undefined' ? FIN_TOOLS : [], typeof KNOW_TOOLS !== 'undefined' ? KNOW_TOOLS : [], typeof HEALTH_TOOLS !== 'undefined' ? HEALTH_TOOLS : [], typeof BRAIN_TOOLS !== 'undefined' ? BRAIN_TOOLS : [], typeof LIFE_TOOLS !== 'undefined' ? LIFE_TOOLS : [], typeof TT_TOOLS !== 'undefined' ? TT_TOOLS : [], typeof GOAL_TOOLS !== 'undefined' ? GOAL_TOOLS : [], typeof PENS_TOOLS !== 'undefined' ? PENS_TOOLS : [], typeof RADAR_TOOLS !== 'undefined' ? RADAR_TOOLS : []);
}

/* Kompakte Hub-Daten (kurze Schlüssel = weniger Tokens) */
function hubSnapshot() {
  const t = H.today();
  const lists = {};
  C.forEach(c => {
    lists[c.k] = { name: c.title, ...(c.st ? { st: c.st } : {}),
      e: S.lists[c.k].map(it => [it.id, it.n, it.t || '', it.d || ''].concat(c.st ? [c.st[it.s]] : [])) };
  });
  const r = S.routines.map(x => { const st = H.state(x, t); return [x.id, x.n, H.freqLabel(x) + (x.time ? ' ' + x.time : ''), st.due ? 'fällig' : 'nächste ' + (st.next || '-')]; });
  return `<hub heute="${t} ${H.WDL[H.P(t).getUTCDay()]}">\nFormat Listeneintrag: [id, titel, notiz, datum, status]; Routine: [id, titel, rhythmus, zustand]\n` +
    JSON.stringify({ listen: lists, routinen: r, dokumente: DOCS.map(d => (d.analysis && d.analysis.title) || d.name) }) +
    '\nFinanzen [Konto, Art, Guthaben, Stichtag] / [Konto, Wertpapier, ISIN, Stück, Einstand, Kurs, Kursdatum]: ' + (typeof finSnapshotText === 'function' ? finSnapshotText() : '') + '\nAktienradar-Ampel [Aktie, Kategorie, Bewertung, Kurs, Zone]: ' + (typeof radarSnapshotText === 'function' ? radarSnapshotText() : '{}') +
    '\nWissen [id, Titel, Art, Themen, Status] (Details mit get_knowledge): ' + (typeof knowSnapshotText === 'function' ? knowSnapshotText() : '[]') +
    '\nGesundheit (letzte 7 Tage): ' + (typeof healthSnapshotText === 'function' ? healthSnapshotText() : '{}') +
    '\nLeben (Netto, Fixkosten/Monat, Verträge [id, Bereich, Name, Anbieter, Betrag, Rhythmus, Status, Frist, Kündigung]): ' + (typeof lifeSnapshotText === 'function' ? lifeSnapshotText() : '{}') +
    '\nTikTok-Sammlung (Themen, Beispiele): ' + (typeof ttSnapshotText === 'function' ? ttSnapshotText() : '{}') +
    '\nKalender nächste 14 Tage inkl. Apple-Kalender: ' + (typeof calSnapshotText === 'function' ? calSnapshotText() : '{}') +
    '\nGehirn (Erkenntnisse, Verknüpfungen, offene Fragen): ' + (typeof brainSnapshotText === 'function' ? brainSnapshotText() : '{}') + '\n</hub>';
}

function runTool(name, x, turn) {
  const fr = (typeof finTool === 'function' ? finTool(name, x || {}) : null) || (typeof knowTool === 'function' ? knowTool(name, x || {}) : null) || (typeof healthTool === 'function' ? healthTool(name, x || {}) : null) || (typeof weatherTool === 'function' ? weatherTool(name, x || {}) : null) || (typeof brainTool === 'function' ? brainTool(name, x || {}) : null) || (typeof lifeTool === 'function' ? lifeTool(name, x || {}) : null) || (typeof ttTool === 'function' ? ttTool(name, x || {}) : null) || (typeof goalTool === 'function' ? goalTool(name, x || {}) : null) || (typeof pensTool === 'function' ? pensTool(name, x || {}) : null) || (typeof radarTool === 'function' ? radarTool(name, x || {}) : null);
  if (fr) return fr;
  const L = k => { if (!S.lists[k]) throw new Error('Unbekannte Liste ' + k); return S.lists[k]; };
  const stIdx = (k, s) => { const c = C.find(y => y.k === k); if (!c.st || !s) return 0; const i = c.st.findIndex(v => v.toLowerCase() === String(s).toLowerCase()); return i < 0 ? 0 : i; };
  const date = d => (/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : '');
  const title = k => (C.find(y => y.k === k) || {}).title;
  switch (name) {
    case 'add_entry': {
      const it = { id: uid(), n: String(x.title || '').trim() || 'Eintrag', t: x.note || '', d: date(x.date), s: stIdx(x.list, x.status) };
      if (/^\d{1,2}:\d{2}$/.test(x.time || '')) { it.tm = x.time.padStart(5, '0'); if (!it.t.includes(it.tm)) it.t = (it.tm + ' Uhr' + (it.t ? ' · ' + it.t : '')); }
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
      const r = { id: uid(), n: String(x.title || '').trim() || 'Routine', note: x.note || '', freq, every: Math.max(1, x.every | 0 || 1), wd: x.weekday != null ? (x.weekday | 0) % 7 : 1,
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
      return { label: '📎 Abgelegt (' + AREA[turn.files[0].area] + '): ' + x.title, result: 'abgelegt' };
    }
  }
  throw new Error('Unbekanntes Werkzeug ' + name);
}

/* Kurzer Verlauf als Text (spart Tokens) */
function history() {
  const h = [];
  CHAT.slice(-10).forEach(m => {
    if (m.err || m.local) return;
    let text = (m.text || '').slice(0, 1500) + (m.actions && m.actions.length ? '\n[Ausgeführt: ' + m.actions.join('; ') + ']' : '') + (m.files && m.files.length ? '\n[Angehängt: ' + m.files.join(', ') + ']' : '');
    if (h.length && h[h.length - 1].role === m.role) h[h.length - 1].content += '\n\n' + text;
    else h.push({ role: m.role, content: text || '…' });
  });
  while (h.length && h[0].role !== 'user') h.shift();
  if (h.length && h[h.length - 1].role === 'user') h.pop();
  return h;
}

function finishTurn(reply, actions, snap, err, cost) {
  chatBusy = false;
  undoSnap = actions.length ? snap : null;
  CHAT.push({ role: 'assistant', text: reply || (actions.length ? 'Erledigt.' : '…'), actions, err, cost, at: Date.now() });
  saveChat();
  if (actions.length) save(); else render();
  scrollChat();
  if ((speakOn || viaVoice || talkMode) && reply && !err) speak(reply, talkMode);
  if (typeof odiRefocus === 'function') odiRefocus();
  else if (talkMode && !err) setTimeout(listen, 400);
}

async function sendChat(text) {
  text = (text || '').trim();
  if (chatBusy || (!text && !chatFiles.length)) return;
  if (ART.sample) return sendArt(text);
  if (mode === 'abo') return sendAbo(text);
  const files = chatFiles; chatFiles = []; chatDraft = '';
  CHAT.push({ role: 'user', text, files: files.map(f => f.name), voice: viaVoice, at: Date.now() });
  chatBusy = true; saveChat(); render(); scrollChat();
  const snap = JSON.stringify(S), turn = { files: files.map(f => ({ id: uid(), name: f.name, type: f.type || '', size: f.size, added: H.today(), blob: f })), stored: false };
  let reply = '', actions = [], err = false, cost = 0;
  try {
    const { client, A } = await apiClient();
    const content = [];
    for (const f of turn.files) content.push(await toBlock(f));
    content.push({ type: 'text', text: hubSnapshot() + '\n\n' + (text || 'Bitte auswerten und in den Hub übernehmen.') +
      (viaVoice || talkMode || location.hash === '#odi' ? '\n\n(Per Sprache – Antwort wird vorgelesen: höchstens 2 kurze Sätze, keine Aufzählungen.)' : '') });
    const msgs = history().concat([{ role: 'user', content }]);
    for (let i = 0; i < 8; i++) {
      let res;
      try {
        res = await client.beta.messages.create({ ...baseParams(), max_tokens: 4000, cache_control: { type: 'ephemeral' },
          output_config: { effort: 'low' }, system: [{ type: 'text', text: sysText(), cache_control: { type: 'ephemeral' } }], tools: tools(), messages: msgs });
      } catch (e) { throw new Error(errText(e, A)); }
      cost += track(res);
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
    for (const f of turn.files) { if (!f.area) f.area = 'work'; await DB.put(f); DOCS.push(meta(f)); }
    if (turn.files.length && !turn.stored) actions.push('📎 ' + turn.files.length + ' Datei(en) unter Arbeit → Dokumente abgelegt');
  } catch (e) { reply = e.message || String(e); err = true; }
  viaVoice = false;
  finishTurn(reply, actions, snap, err, cost);
}

/* ---------- Im Claude-Artefakt: über das Abo des Nutzers (sample) mit Seiten-Werkzeugen ---------- */
let chatStream = '', chatCtl = null;
/* Nur passende Werkzeuge mitgeben (Claude erlaubt pro Anfrage nur eine begrenzte Zahl) */
const TOOL_GROUPS = [
  [/termin|eintrag|liste|aufgabe|todo|erinner|routine|bewerb|frist|schritt|notier|merk|lösch|änder|erledigt|abhak/i, ['add_entry', 'update_entry', 'delete_entry', 'add_routine', 'complete_routine', 'delete_routine']],
  [/depot|aktie|etf|kurs|konto|krypto|bitcoin|ethereum|sparplan|position|portfolio|vermögen|trade republic|comdirect|börse/i, ['set_account', 'set_position', 'set_prices', 'remove_position', 'set_saving_plan']],
  [/radar|aktienradar|kaufen|günstig bewertet|einstiegszone|kaufempfehlung/i, ['set_radar']],
  [/rente|renteninfo|entgeltpunkt|rentenpunkt|altersvorsorge/i, ['set_pension']],
  [/ziel|spar|notgroschen|eigenkapital|einrichtung|budget/i, ['set_goal']],
  [/vertrag|versicher|miete|nebenkosten|strom|kfz|auto|handy|abo|kündig|rente|bav|gehalt|netto|einkommen|police|leasing|dienstrad/i, ['set_contract', 'set_income']],
  [/wissen|paper|studie|artikel|buch|lern|video|idee|notiz|recherch|businessplan|berechn|rechne|bewert|kapitalwert|dcf/i, ['add_knowledge', 'get_knowledge']],
  [/schlaf|hrv|puls|schritte|gewicht|essen|mahlzeit|kalorien|eiweiß|protein|gegessen|training|erholt|stimmung|energie|ziel/i, ['set_health_day', 'add_meal', 'set_health_goals']],
  [/tiktok/i, ['add_tiktok', 'tiktok_update']],
  [/zusammenhang|erkenntnis|verknüpf|gehirn/i, ['add_insight', 'link_items']],
];
const TOOL_CORE = ['add_entry', 'update_entry', 'add_routine', 'complete_routine', 'add_knowledge', 'get_knowledge', 'set_contract', 'add_meal', 'set_health_day', 'set_position', 'set_prices', 'add_tiktok', 'add_insight'];
function pickTools(text, max, hasFiles) {
  const all = tools(), want = [];
  const add = n => { if (!want.includes(n) && all.some(t => t.name === n)) want.push(n); };
  if (hasFiles) add('store_attachment');
  TOOL_GROUPS.forEach(([re, names]) => { if (re.test(text)) names.forEach(add); });
  TOOL_CORE.forEach(add);
  all.forEach(t => add(t.name));
  return want.slice(0, Math.max(1, max)).map(n => all.find(t => t.name === n));
}
/* Ersatzweg ohne Werkzeuge: Claude antwortet als JSON mit Aktionen, die App führt sie aus */
async function sendArtJson(turns, images, turn, actions) {
  const spec = tools().map(t => t.name + '(' + Object.keys((t.input_schema && t.input_schema.properties) || {}).join(', ') + ')').join('; ');
  const last = turns[turns.length - 1];
  const prompt = turns.slice(0, -1).map(m => (m.role === 'user' ? 'Nutzer: ' : 'Assistent: ') + m.content).join('\n\n') + '\n\nNutzer: ' + last.content +
    '\n\nAntworte NUR mit JSON {"reply":"deine Antwort an mich","actions":[{"tool":"<name>", …Argumente}]}. Führe meinen Wunsch über actions aus, wenn etwas eingetragen/geändert werden soll. Verfügbare Werkzeuge: ' + spec;
  const out = await ART.sample.json(prompt, Object.assign({ modelTier: pref('tier', 'default'), effort: 'low', cache: false }, images.length && ART.imgMax ? { images: images.slice(0, ART.imgMax) } : {}));
  (Array.isArray(out && out.actions) ? out.actions : []).slice(0, 40).forEach(a => {
    if (!a || !a.tool) return;
    try { actions.push(runTool(String(a.tool), a, turn).label); } catch (e) { actions.push('⚠︎ ' + a.tool + ': ' + e.message); }
  });
  return String((out && out.reply) || (actions.length ? 'Erledigt.' : '…'));
}
function turns2(text) {
  return [{ role: 'user', content: sysText() }].concat(history(), [{ role: 'user', content: hubSnapshot() + '\n\n' + text }]);
}
async function sendArt(text) {
  const files = chatFiles; chatFiles = []; chatDraft = '';
  CHAT.push({ role: 'user', text, files: files.map(f => f.name), voice: viaVoice, at: Date.now() });
  chatBusy = true; chatStream = ''; saveChat(); render(); scrollChat();
  const snap = JSON.stringify(S), actions = [];
  const turn = { files: files.map(f => ({ id: uid(), name: f.name, type: f.type || '', size: f.size, added: H.today(), blob: f })), stored: false };
  let reply = '', err = false;
  for (const f of turn.files) { f.area = 'work'; try { await DB.put(f); } catch (e) { actions.push('⚠︎ ' + f.name + ': ' + e.message); f.failed = true; } }
  try {
    let extra = '', images = [];
    for (const f of turn.files) {
      try { const c = await artContent(f); if (c.text) extra += '\n<anhang name="' + f.name + '">\n' + c.text + '\n</anhang>'; if (c.images) images = images.concat(c.images); }
      catch (e) { extra += '\n[Anhang „' + f.name + '“ konnte nicht gelesen werden: ' + e.message + ']'; }
    }
    if (images.length) extra += '\n[' + Math.min(images.length, ART.imgMax) + ' Bild(er) angehängt]';
    const turns = [{ role: 'user', content: sysText() + '\nDie Werkzeuge sind Funktionen dieser App; rufe sie direkt auf.' }].concat(history(),
      [{ role: 'user', content: hubSnapshot() + extra + '\n\n' + (text || 'Bitte auswerten und in den Hub übernehmen.') +
        (viaVoice || talkMode || location.hash === '#odi' ? '\n\n(Per Sprache – Antwort wird vorgelesen: höchstens 2 kurze Sätze, keine Aufzählungen.)' : '') }]);
    chatCtl = new AbortController();
    if (!ART.toolMax) { reply = (await sendArtJson(turns, images, turn, actions)).trim(); throw { done: true }; }
    const res = await ART.sample(turns, {
      cache: false, signal: chatCtl.signal, modelTier: pref('tier', 'default'), effort: 'low',
      ...(images.length && ART.imgMax ? { images: images.slice(0, ART.imgMax) } : {}),
      tools: pickTools(text + ' ' + (extra ? 'anhang' : ''), ART.toolMax, turn.files.length > 0).map(t => ({ name: t.name, description: t.description, inputSchema: t.input_schema,
        execute: inp => { const r = runTool(t.name, inp || {}, turn); actions.push(r.label); chatStream = chatStream || '…'; showStream(); return r.result; } })),
      onText: ({ text: tx }) => { chatStream = tx; showStream(); }
    });
    reply = res.text.trim();
    for (const f of turn.files) { if (turn.stored && !f.failed) { try { await DB.put(f); } catch (e) { /* bleibt unter Arbeit */ } } }
    if (turn.files.some(f => !f.failed) && !turn.stored) actions.push('📎 ' + turn.files.filter(f => !f.failed).length + ' Datei(en) unter Arbeit → Dokumente abgelegt');
  } catch (e) {
    if (e && e.done) { /* Ersatzweg fertig */ }
    else if (e && (e.code === 'tools_unavailable' || e.code === 'invalid_request') && !actions.length) {
      try { ART.toolMax = e.code === 'tools_unavailable' ? 0 : ART.toolMax; reply = (await sendArtJson(turns2(text), [], turn, actions)).trim(); } catch (e2) { reply = sampleErr(e2); err = true; }
    } else { reply = (e && e.text) || sampleErr(e); err = !(e && e.text); }
  }
  chatCtl = null; chatStream = ''; viaVoice = false;
  finishTurn(reply, actions, snap, err, 0);
}
function showStream() { const el = $('stream'); if (el) { el.textContent = chatStream || 'Claude denkt nach …'; scrollChat(); } }

/* ---------- Claude-Abo-Modus: Prompt in die Claude-App, Antwort zurück (keine API-Kosten) ---------- */
const ABO_FORMAT = `Antworte zuerst ganz normal. Wenn etwas in den Lebenshub soll, hänge am Ende GENAU EINEN Codeblock an:
\`\`\`lebenshub
{"actions":[{"tool":"add_entry","list":"x","title":"…","note":"…","date":"JJJJ-MM-TT","status":"…"}]}
\`\`\`
Werkzeuge: add_entry(list,title,note?,date?,time? HH:MM,status?), update_entry(list,id,title?,note?,date?,status?), delete_entry(list,id), add_routine(title,freq=daily|weekly|monthly,every?,weekday 0=So..6=Sa?,monthday?,time HH:MM?, note?), complete_routine(id), delete_routine(id), set_account(name, kind=Depot|Girokonto|Tagesgeld|Verrechnungskonto, broker?, cash? in EUR, asOf?), set_position(account, name, isin?, qty?, buyPrice?, price? in EUR, priceDate?), set_prices(prices:[{name|isin, price in EUR, date}]), remove_position(account, name), set_health_day(date?, sleep?, hrv?, rhr?, steps?, active?, stress?, spo2?, weight?, mood? 1–5, energy? 1–5, sore? 1–5, note?, source?), add_meal(description, kcal, protein?, carbs?, fat?, date?, time?), add_knowledge(title, kind=Paper|Artikel|Notiz|Video|Buch|Studie|Patent|Idee, url?, source?, summary?, points?[], tags?[], status=Zu lesen|Gelesen|Verarbeitet), add_insight(text, refs?[]), link_items(a, b, why?), add_tiktok(url, title?, topic?, note?), tiktok_update(items:[{id, title?, author?, topic?, note?}]), set_contract(name, cat=wohnen|mobil|vers|vorsorge|vertrag, provider?, cost?, per=monat|quartal|halbjahr|jahr|einmalig, status=aktiv|Angebot|prüfen|fehlt|gekündigt, next?, notice?, note?), set_income(net).
Listen: ${'${LISTEN}'}
Regeln: nichts erfinden, Datum JJJJ-MM-TT, keine IBAN/Konto-/Kunden-/Versicherungsnummern, vorhandene Einträge per update_entry mit ihrer id ändern statt doppelt anlegen.`;
function aboFormat() { return ABO_FORMAT.replace('${LISTEN}', C.map(c => c.k + '=' + c.title + (c.st ? ' (Status: ' + c.st.join('/') + ')' : '')).join(', ')); }
function aboPrompt(text) {
  return `Du bist mein Assistent für meinen „Lebenshub“ (App für Termine, Routinen, Arbeit, Finanzen, Gesundheit). Antworte auf Deutsch, knapp.
${aboFormat()}

Aktuelle Hub-Daten:
${hubSnapshot()}

Meine Nachricht:
${text}`;
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (e) {
    const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (er) { /* egal */ } ta.remove(); return ok;
  }
}
async function sendAbo(text) {
  if (chatFiles.length) { toast('Dateien bitte direkt in der Claude-App anhängen.'); chatFiles = []; }
  if (!text) return;
  chatDraft = '';
  const ok = await copyText(aboPrompt(text));
  CHAT.push({ role: 'user', text, at: Date.now(), local: true });
  CHAT.push({ role: 'assistant', local: true, at: Date.now(), text: ok
    ? 'Ich habe deine Nachricht samt Hub-Daten kopiert. In Claude einfügen, Antwort abwarten, die Antwort kopieren (lange drücken → Kopieren) und hier „Antwort einfügen“ tippen.'
    : 'Kopieren hat nicht geklappt. Bitte erneut versuchen.', aboWait: ok });
  saveChat(); render(); scrollChat();
  if (ok) window.open('https://claude.ai/new', '_blank');
}
function parseAbo(t) {
  const m = t.match(/```lebenshub\s*([\s\S]*?)```/) || t.match(/```json\s*(\{[\s\S]*?"actions"[\s\S]*?\})\s*```/) || t.match(/(\{\s*"actions"[\s\S]*\})/);
  if (!m) return null;
  try { const o = JSON.parse(m[1]); return Array.isArray(o.actions) ? o.actions : null; } catch (e) { return null; }
}
async function pasteAbo() {
  let t = '';
  try { t = await navigator.clipboard.readText(); } catch (e) { /* iOS fragt ggf. nach */ }
  if (!t) t = await askText('Antwort von Claude einfügen', 'Hier die kopierte Antwort einfügen …');
  if (!t.trim()) return;
  applyAbo(t);
}
function applyAbo(t) {
  const acts = parseAbo(t), snap = JSON.stringify(S), actions = [], turn = { files: [] };
  (acts || []).forEach(a => { try { actions.push(runTool(a.tool, a, turn).label); } catch (e) { actions.push('⚠︎ ' + (a.tool || '?') + ': ' + e.message); } });
  const reply = t.replace(/```lebenshub[\s\S]*?```/, '').trim().slice(0, 4000);
  CHAT.forEach(m => { m.aboWait = false; });
  CHAT.push({ role: 'assistant', text: (reply || 'Übernommen.') + (acts ? '' : '\n\n(Kein Lebenshub-Block gefunden – nichts eingetragen.)'), actions, via: 'abo', at: Date.now() });
  undoSnap = actions.length ? snap : null;
  saveChat();
  if (actions.length) save(actions.length + ' Änderungen übernommen'); else render();
  scrollChat();
}

function undoLast() {
  if (!undoSnap) return;
  const settings = S.settings;
  S = JSON.parse(undoSnap); S.settings = settings; undoSnap = null;
  const m = CHAT[CHAT.length - 1]; if (m) m.undone = true;
  saveChat(); save('Änderungen rückgängig gemacht');
}

/* ---------- Odi: Persönlichkeit & Stimme ---------- */
function odi() { S.settings.odi = Object.assign({ on: true, name: 'Odi', sir: true, voice: '', rate: 1, pitch: 0.9 }, S.settings.odi || {}); return S.settings.odi; }
function sysText() {
  const o = odi();
  if (!o.on) return SYS;
  return SYS + `\nDu heißt ${o.name}. Persönlichkeit: ein souveräner, höflicher KI-Butler mit britischer Gelassenheit und feinem, trockenem Humor – präzise, vorausschauend, nie unterwürfig. Ein eigener Charakter, kein bestimmter Film-Charakter.${o.sir ? ' Sprich den Nutzer gelegentlich mit „Sir“ an.' : ''} Bleib auf Deutsch und kurz.`;
}
/* ---------- Sprache ---------- */
let voice = null;
function deVoices() { try { return speechSynthesis.getVoices().filter(v => /^(de|en-GB)([-_]|$)/i.test(v.lang)); } catch (e) { return []; } }
function pickVoice() {
  try {
    const all = deVoices(), want = odi().voice, de = all.filter(v => /^de/i.test(v.lang));
    voice = (want && all.find(v => v.name === want)) || de.find(v => /premium|enhanced|erweitert/i.test(v.name) && /Markus|Yannick|Martin|Viktor|Helmut/i.test(v.name))
      || de.find(v => /Markus|Yannick|Martin|Viktor|Helmut/i.test(v.name)) || de.find(v => /premium|enhanced|erweitert/i.test(v.name)) || de.find(v => v.localService) || de[0] || null;
  } catch (e) { voice = null; }
}
try { pickVoice(); speechSynthesis.onvoiceschanged = () => { pickVoice(); if (typeof render === 'function' && document.getElementById('odiVoice')) render(); }; } catch (e) { /* egal */ }
function unlockTts() { // iOS: Sprachausgabe muss einmal durch eine Berührung freigeschaltet werden
  if (ttsReady) return; ttsReady = true;
  try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) { /* egal */ }
}
let ttsFail = false;
function speak(t, thenListen) {
  const txt = t.replace(/[*#_`>|]/g, '').replace(/\n+/g, '. ');
  const viaArt = () => ART.tts.speak(txt.slice(0, 1900), { voice: 'rounded' }).then(() => { if (thenListen && talkMode) setTimeout(listen, 300); }).catch(() => {});
  if (ART.tts && (ttsFail || (!odi().voice && !deVoices().length))) return viaArt();
  try {
    if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
    try { speechSynthesis.resume(); } catch (e) { /* egal */ }
    const u = new SpeechSynthesisUtterance(txt.slice(0, 1200));
    pickVoice(); u.lang = voice ? voice.lang : 'de-DE'; if (voice) u.voice = voice; u.rate = +odi().rate || 1; u.pitch = +odi().pitch || 1; u.volume = 1;
    let started = false;
    u.onstart = () => { started = true; if (ttsFail) { ttsFail = false; render(); } };
    u.onend = () => { started = true; if (thenListen && talkMode) setTimeout(listen, 300); };
    u.onerror = () => { if (!started) noTts(); };
    speechSynthesis.speak(u);
    setTimeout(() => { if (!started && !speechSynthesis.speaking) noTts(); }, 2500);
  } catch (e) { noTts(); if (thenListen && talkMode) listen(); }
}
function noTts() {
  if (ART.tts) { ttsFail = true; return; }
  if (!ttsFail) { ttsFail = true; toast('Vorlesen ist in dieser Ansicht gesperrt – den Lebenshub in Safari öffnen (siehe ⚙︎ → Odi).'); if ($('odiVoice')) render(); }
}
let dictWired = false, srBlocked = false;
function listen() {
  if (ART.dictation) { // Claude-Diktat (Desktop/Chrome)
    const d = ART.dictation;
    if (!dictWired) {
      dictWired = true;
      d.onFinal(({ text }) => { chatDraft = (chatDraft + text).replace(/^\s+/, ''); const i = $('chatIn'); if (i) i.value = chatDraft; });
      d.onState(({ state }) => { recog = state === 'idle' ? null : 'dict'; if (state === 'idle') { const t = chatDraft.trim(); render(); if (t) { viaVoice = true; sendChat(t); } else if (talkMode) { talkMode = false; render(); } } else render(); });
    }
    if (d.active()) { d.stop(); return; }
    d.start({ language: 'de' }).catch(e => { if (e && e.code !== 'stopped') { talkMode = false; toast('Diktat nicht möglich – nutze das Mikrofon der Tastatur.'); render(); } });
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR || srBlocked) { talkMode = false; toast('Tipp: Nutze das Mikrofon auf der iPhone-Tastatur zum Diktieren.'); render(); const i = $('chatIn'); if (i) i.focus(); return; }
  if (recog && recog !== 'dict') { recog.stop(); return; }
  try { speechSynthesis.cancel(); } catch (e) { /* egal */ }
  recog = new SR(); recog.lang = 'de-DE'; recog.interimResults = true; recog.continuous = false;
  let finalText = '';
  recog.onresult = e => { let s = ''; for (const r of e.results) s += r[0].transcript; finalText = s; const i = $('chatIn'); if (i) i.value = s; chatDraft = s; };
  recog.onend = () => { recog = null; if (finalText.trim()) { viaVoice = true; sendChat(finalText); } else { if (talkMode) { talkMode = false; toast('Gesprächsmodus beendet.'); } render(); } };
  recog.onerror = e => { recog = null; talkMode = false; if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') { srBlocked = true; toast(ART.on ? 'Mikrofon ist in dieser Ansicht gesperrt – nutze das 🎤 der Tastatur (oder den Lebenshub in Safari öffnen).' : 'Mikrofon nicht erlaubt – in den iPhone-Einstellungen freigeben oder Tastatur-Diktat nutzen.'); const i = $('chatIn'); if (i) i.focus(); } render(); };
  try { recog.start(); } catch (e) { recog = null; }
  render();
}

/* ---------- Ansicht ---------- */
function fmtText(t) { return esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); }
function viewChat() {
  if (ART.sample) return viewChatArt();
  const abo = mode === 'abo';
  if (!abo && !getKey()) return `<section class="card wide"><h2>Assistent</h2>
    <div class="hint">Wähle, wie der Assistent arbeiten soll:</div>
    <div class="kv"><span><b>Über dein Claude-Abo</b></span><span>keine Zusatzkosten</span></div>
    <div class="hint">Die App kopiert deine Nachricht samt Hub-Daten, du fügst sie in der Claude-App ein und holst die Antwort zurück. Claude kann dort auch im Web recherchieren.</div>
    <div class="btns"><button class="btn" data-act="cmode" data-v="abo">Claude-Abo nutzen</button></div>
    <div class="kv" style="margin-top:10px"><span><b>Direkt in der App (API)</b></span><span>wenige Cent pro Nachricht</span></div>
    <div class="hint">Schneller und automatisch, mit Sprache und Dokumenten – braucht einen API-Schlüssel (⚙︎).</div>
    <div class="btns"><button class="btn ghost" data-act="tab" data-v="settings">API-Schlüssel eintragen</button></div></section>`;
  loadSdk && !abo && loadSdk().catch(() => {});
  const last = CHAT[CHAT.length - 1];
  const msgs = CHAT.map((m, i) => `<div class="msg ${m.role}${m.err ? ' err' : ''}">${m.text ? `<div>${fmtText(m.text)}</div>` : ''}${m.files && m.files.length ? `<small>📎 ${m.files.map(esc).join(', ')}</small>` : ''}${m.actions && m.actions.length ? `<ul class="acts">${m.actions.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}${m.aboWait && i === CHAT.length - 1 ? '<button class="btn" data-act="cpaste">Antwort einfügen</button>' : ''}${i === CHAT.length - 1 && undoSnap && !m.undone ? '<button class="chip" data-act="cundo">Rückgängig</button>' : ''}${m.undone ? '<small>rückgängig gemacht</small>' : ''}${m.cost ? `<small class="cost">≈ ${fusd(m.cost)}</small>` : ''}${m.via === 'abo' ? '<small class="cost">über Claude-Abo</small>' : ''}</div>`).join('')
    || `<div class="hint">${abo ? 'Abo-Modus: Schreib oder sprich deine Nachricht, tippe „In Claude öffnen“, füge sie in Claude ein und hol die Antwort mit „Antwort einfügen“ zurück. Ideal für Recherchen – ohne API-Kosten.' : 'Erzähl mir, was ansteht – oder häng ein Dokument/Foto an. Ich trage alles ein. Zum Beispiel: „Dienstag 10 Uhr Physio wegen dem Knie“, „Depot steht bei 22.000 €“ oder „Was steht diese Woche an?“. Mit 🎙 führst du ein Gespräch per Sprache.'}</div>`;
  return `<section class="card wide chat"><h2>${odi().on ? esc(odi().name) : 'Assistent'}<small class="chips">
      <button class="chip ${abo ? '' : 'd'}" data-act="cmode" data-v="${abo ? 'api' : 'abo'}">${abo ? 'Modus: Claude-Abo' : 'Modus: API'}</button>
      ${!abo ? `<button class="chip ${talkMode ? 'due' : 'd'}" data-act="ctalk">${talkMode ? '🎙 Gespräch läuft' : '🎙 Gespräch'}</button><button class="chip ${speakOn ? '' : 'd'}" data-act="ctts">${speakOn ? '🔊 an' : '🔈 aus'}</button>` : '<button class="chip d" data-act="cpaste">📋 Antwort einfügen</button>'}
      ${CHAT.length ? '<button class="chip d" data-act="cclear">Leeren</button>' : ''}</small></h2>
    <div class="msgs" id="msgs">${msgs}${chatBusy ? '<div class="msg assistant"><div class="typing">Claude denkt nach …</div></div>' : ''}${recog ? '<div class="msg user"><div class="typing">Ich höre zu …</div></div>' : ''}</div>
    ${chatFiles.length ? `<div class="hint">📎 ${chatFiles.map(f => esc(f.name)).join(', ')} <button class="chip d" data-act="cfclear">entfernen</button></div>` : ''}
    <div class="chatbar">${abo ? '' : '<button class="icon-btn" data-act="cattach" aria-label="Datei anhängen">＋</button>'}
      <textarea id="chatIn" rows="1" placeholder="${abo ? 'Frage/Auftrag …' : 'Schreiben …'}" ${chatBusy ? 'disabled' : ''}>${esc(chatDraft)}</textarea>
      <button class="icon-btn ${recog ? 'on' : ''}" data-act="cmic" aria-label="Sprechen">🎤</button>
      <button class="btn" data-act="csend" ${chatBusy ? 'disabled' : ''}>${abo ? 'In Claude öffnen' : 'Senden'}</button></div></section>`;
}
function msgHtml(m, i) {
  return `<div class="msg ${m.role}${m.err ? ' err' : ''}">${m.text ? `<div>${fmtText(m.text)}</div>` : ''}${m.files && m.files.length ? `<small>📎 ${m.files.map(esc).join(', ')}</small>` : ''}${m.actions && m.actions.length ? `<ul class="acts">${m.actions.map(a => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}${i === CHAT.length - 1 && undoSnap && !m.undone ? '<button class="chip" data-act="cundo">Rückgängig</button>' : ''}${m.undone ? '<small>rückgängig gemacht</small>' : ''}${m.role === 'assistant' && m.text && !m.err ? `<a class="chip d wa" href="https://wa.me/?text=${encodeURIComponent(m.text.slice(0, 1500))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</div>`;
}
function viewChatArt() {
  const msgs = CHAT.filter(m => !m.local).map((m, i, a) => msgHtml(m, i === a.length - 1 ? CHAT.length - 1 : -1)).join('')
    || '<div class="hint">Erzähl mir, was ansteht, oder häng ein Foto/PDF an – ich trage alles in deinen Hub ein. Zum Beispiel: „Dienstag 10 Uhr Physio wegen dem Knie“, „Depot steht bei 22.000 €“ oder „Was steht diese Woche an?“ Läuft über dein Claude-Abo.</div>';
  const voice = true;
  return `<section class="card wide chat"><h2>${odi().on ? esc(odi().name) : 'Assistent'}<small class="chips">
      <button class="chip ${talkMode ? 'due' : 'd'}" data-act="ctalk">${talkMode ? '🎙 Gespräch läuft' : '🎙 Gespräch'}</button>
      <button class="chip ${speakOn ? '' : 'd'}" data-act="ctts">${speakOn ? '🔊 Vorlesen an' : '🔈 Vorlesen aus'}</button>
      ${CHAT.length ? '<button class="chip d" data-act="cclear">Leeren</button>' : ''}</small></h2>
    ${typeof odiOrb === 'function' ? odiOrb() : ''}<div class="msgs" id="msgs">${msgs}${chatBusy ? `<div class="msg assistant"><div class="typing stream" id="stream">${esc(chatStream || 'Claude denkt nach …')}</div><button class="chip d" data-act="cstop">Stopp</button></div>` : ''}${recog ? '<div class="msg user"><div class="typing">Ich höre zu …</div></div>' : ''}</div>
    ${chatFiles.length ? `<div class="hint">📎 ${chatFiles.map(f => esc(f.name)).join(', ')} <button class="chip d" data-act="cfclear">entfernen</button></div>` : ''}
    <div class="chatbar"><button class="icon-btn" data-act="cattach" aria-label="Foto oder PDF anhängen">＋</button>
      <textarea id="chatIn" rows="1" placeholder="Schreiben …" ${chatBusy ? 'disabled' : ''}>${esc(chatDraft)}</textarea>
      ${voice ? `<button class="icon-btn ${recog ? 'on' : ''}" data-act="cmic" aria-label="Sprechen">🎤</button>` : ''}
      <button class="btn" data-act="csend" ${chatBusy ? 'disabled' : ''}>Senden</button></div></section>`;
}
function scrollChat() { requestAnimationFrame(() => { const m = $('msgs'); if (m) m.scrollTop = m.scrollHeight; }); }

function chatAct(act, b) {
  switch (act) {
    case 'csend': { unlockTts(); const i = $('chatIn'); sendChat(i ? i.value : ''); return true; }
    case 'cmic': unlockTts(); listen(); return true;
    case 'ctalk': unlockTts(); talkMode = !talkMode; if (talkMode) listen(); else { if (recog) recog.stop(); try { speechSynthesis.cancel(); } catch (e) { /* egal */ } render(); } return true;
    case 'cattach': $('chatFile').click(); return true;
    case 'cfclear': chatFiles = []; render(); return true;
    case 'cundo': undoLast(); return true;
    case 'cpaste': pasteAbo(); return true;
    case 'cpaste2': TAB = 'chat'; render(); pasteAbo(); return true;
    case 'cmode': mode = b.dataset.v; setPref('mode', mode); render(); return true;
    case 'ctts': unlockTts(); speakOn = !speakOn; setPref('tts', speakOn ? '1' : '0'); if (!speakOn) try { speechSynthesis.cancel(); } catch (e) { /* egal */ } render(); return true;
    case 'cclear': askConfirm('Chatverlauf löschen? Deine Hub-Daten bleiben erhalten.', 'Löschen').then(ok => { if (ok) { CHAT = []; undoSnap = null; saveChat(); render(); } }); return true;
    case 'cstop': if (chatCtl) chatCtl.abort(); return true;
    case 'cproj': copyText(projectInstructions()).then(ok => toast(ok ? 'Projekt-Anweisung kopiert – in Claude unter Projekt → Anweisungen einfügen.' : 'Kopieren fehlgeschlagen')); return true;
  }
  return false;
}
/* Anweisung für ein Claude-Projekt „Lebenshub“ (claude.ai) – damit jede Recherche dort importierbar endet */
function projectInstructions() {
  return `Dieses Projekt gehört zu meiner App „Lebenshub“ (Termine, Routinen, Arbeit, Finanzen, Gesundheit). Antworte auf Deutsch.
Wenn Ergebnisse in den Hub gehören (Termine, Fristen, Stellen, Kontostände, Ideen, Aufgaben, Gesundheitsinfos), hänge am Ende deiner Antwort einen Import-Block an:
${aboFormat()}
Ohne aktuelle Hub-Daten keine update_/delete_-Aktionen – dann nur add_entry/add_routine.`;
}
document.addEventListener('input', e => { if (e.target.id === 'chatIn') { chatDraft = e.target.value; e.target.style.height = 'auto'; e.target.style.height = Math.min(120, e.target.scrollHeight) + 'px'; } });
document.addEventListener('keydown', e => { if (e.target.id === 'chatIn' && e.key === 'Enter' && !e.shiftKey && !/iphone|ipad|android/i.test(navigator.userAgent)) { e.preventDefault(); sendChat(e.target.value); } });
document.addEventListener('change', async e => {
  if (e.target.id !== 'chatFile' || !e.target.files.length) return;
  const fl = Array.from(e.target.files); e.target.value = '';
  const big = fl.filter(f => /\.(zip|docx|xlsx|pptx)$/i.test(f.name)), rest = fl.filter(f => !big.includes(f));
  if (big.length) {
    const n = await addFiles(big, 'work');
    CHAT.push({ role: 'assistant', local: true, at: Date.now(), text: n ? n + ' Datei(en) aus ' + big.map(f => f.name).join(', ') + ' entpackt und unter „Dokumente“ gespeichert (Arbeit, Finanzen, Gesundheit). Tippe dort auf „Alle analysieren & eintragen“ – oder sag mir hier, worauf ich achten soll.' : 'Aus ' + big.map(f => f.name).join(', ') + ' konnte nichts gespeichert werden.' });
    saveChat(); render();
  }
  for (const f of rest) chatFiles.push(f.type.startsWith('image/') || /\.hei[cf]$/i.test(f.name) ? await normImage(f) : f);
  render();
});
function aboCard() {
  return `<section class="card"><h2>Claude-Abo nutzen</h2>
    <div class="hint">Recherchen und Auswertungen über dein Claude-Abo kosten nichts extra. So geht's:<br>
    1. Im Assistenten „Modus: Claude-Abo“ wählen – Nachricht wird samt Hub-Daten kopiert und Claude geöffnet.<br>
    2. Für Recherchen in claude.ai ein Projekt „Lebenshub“ anlegen und diese Anweisung einfügen – dann endet jede Antwort mit einem Import-Block.<br>
    3. Antwort in Claude kopieren und im Assistenten „Antwort einfügen“ tippen.</div>
    <div class="btns"><button class="btn" data-act="cproj">Projekt-Anweisung kopieren</button><button class="btn ghost" data-act="cpaste2">Antwort aus Claude einfügen</button></div></section>`;
}

function odiCard() {
  const o = odi(), vs = deVoices();
  pickVoice();
  const cur = voice ? voice.name + ' (' + voice.lang + ')' : 'Standardstimme des iPhones';
  return `<section class="card"><h2>Assistent „${esc(o.name)}“</h2>
    <div class="btns" style="margin-top:0"><button class="btn" data-act="odiPreset" data-v="butler">Butler-Klang</button><button class="btn ghost" data-act="odiPreset" data-v="normal">Normal</button><button class="btn ghost" data-act="odiTest">▶︎ Probe hören</button></div>
    ${ttsFail ? '<div class="hint" style="color:var(--bad,#c0392b)"><b>Sprachausgabe blockiert:</b> Die Claude-App auf dem iPhone lässt Webseiten hier nicht sprechen. In <b>Safari</b> funktioniert es – Anleitung unten.</div>' : ''}
    <div class="hint">Aktive Stimme: <b>${esc(cur)}</b></div>
    <label class="f">Stimme${vs.length ? '' : ' <small>(Liste noch leer)</small>'}<select id="odiVoice"><option value="">Automatisch (männlich, deutsch)</option>${vs.map(v => `<option ${o.voice === v.name ? 'selected' : ''} value="${esc(v.name)}">${esc(v.name)} (${esc(v.lang)})</option>`).join('')}</select></label>
    ${vs.length && !ttsFail ? '' : `<div class="hint">Diese Ansicht zeigt (noch) keine Stimmenliste. <button class="chip" data-act="odiVoices">Stimmen neu laden</button><br>Die Claude-App gibt Webseiten oft keine Stimmenliste – dann spricht Odi mit der deutschen Systemstimme (Butler-Klang über Tempo/Tonhöhe wirkt trotzdem).<br><b>Stimme frei wählen:</b> Lebenshub in <b>Safari</b> öffnen (Link in die Adresszeile einfügen, nicht antippen), dort ⚙︎ → Stimme wählen. Im Kurzbefehl „Odi“ statt „URL öffnen“ die Aktion <b>„Webseite in Safari öffnen“</b> bzw. Safari-Aktion „URL öffnen“ nehmen.</div>`}
    <div class="f2"><label class="f">Tempo <b id="odiRateV">${(+o.rate).toFixed(2)}</b><input type="range" id="odiRate" min="0.7" max="1.4" step="0.05" value="${o.rate}"></label><label class="f">Tonhöhe <b id="odiPitchV">${(+o.pitch).toFixed(2)}</b><input type="range" id="odiPitch" min="0.5" max="1.5" step="0.05" value="${o.pitch}"></label></div>
    <div class="f2"><label class="f">Name<input type="text" id="odiName" value="${esc(o.name)}"></label>
    <label class="f">Persönlichkeit<select id="odiOn"><option value="1" ${o.on ? 'selected' : ''}>KI-Butler (souverän, trockener Humor)</option><option value="0" ${o.on ? '' : 'selected'}>Neutral</option></select></label></div>
    <label class="f"><span><input type="checkbox" id="odiSir" ${o.sir ? 'checked' : ''}> mit „Sir“ ansprechen</span></label>
    <div class="hint">Kein Ton? Lautlos-Schalter am iPhone prüfen. Alles wird sofort gespeichert.</div></section>`;
}
document.addEventListener('input', e => { if (e.target.id === 'odiRate' || e.target.id === 'odiPitch') { const l = $(e.target.id + 'V'); if (l) l.textContent = (+e.target.value).toFixed(2); } });
document.addEventListener('change', e => {
  const id = e.target.id; if (!/^odi/.test(id)) return;
  const o = odi();
  if (id === 'odiName') o.name = e.target.value.trim() || 'Odi';
  if (id === 'odiOn') o.on = e.target.value === '1';
  if (id === 'odiVoice') o.voice = e.target.value;
  if (id === 'odiRate') o.rate = +e.target.value;
  if (id === 'odiPitch') o.pitch = +e.target.value;
  if (id === 'odiSir') o.sir = e.target.checked;
  pickVoice(); save();
});
function odiAct(act, b) {
  if (act === 'odiPreset') { const o = odi(); if (b.dataset.v === 'butler') { o.rate = 0.95; o.pitch = 0.85; o.sir = true; o.on = true; } else { o.rate = 1; o.pitch = 1; } unlockTts(); save('Stimme eingestellt'); odiAct('odiTest'); return true; }
  if (act === 'odiVoices') {
    try { unlockTts(); const u = new SpeechSynthesisUtterance('Stimmen werden geladen.'); u.lang = 'de-DE'; speechSynthesis.speak(u); } catch (e) { /* egal */ }
    let n = 0; const tick = () => { n++; if (deVoices().length || n > 12) { pickVoice(); render(); toast(deVoices().length ? deVoices().length + ' Stimmen gefunden' : 'Hier gibt es keine Stimmenliste – siehe Hinweis (Safari).'); } else setTimeout(tick, 300); }; setTimeout(tick, 300);
    return true; }
  if (act === 'odiTest') { unlockTts(); speak((odi().sir ? 'Guten Tag, Sir. ' : 'Hallo. ') + 'Hier ist ' + odi().name + '. Alle Systeme laufen. Womit kann ich helfen?'); return true; }
  return false;
}
/* Direktaufruf per Link …#odi (z. B. Siri-Kurzbefehl „Odi“) */
function odiWake() {
  if (location.hash !== '#odi') return;
  TAB = 'chat'; speakOn = true;
  odiAwake = false; render(); scrollChat();
}
window.addEventListener('hashchange', odiWake);
