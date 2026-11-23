/* Lebenshub – Posteingang (Gmail über den Connector des Nutzers, Capability „mcp“).
   Liest nur ungelesene Mails der letzten Tage (Betreff, Absender, Vorschau), Claude sortiert sie (Abo) und schlägt Einträge vor.
   Antworten werden nur als ENTWURF in Gmail angelegt – Senden macht der Nutzer selbst. */
'use strict';
const GMAIL = 'Gmail';
let MAILS = null, MAILSUM = null, mailBusy = false;
function mailParse(res) {
  const out = [];
  collect(res && res.payload != null ? res.payload : res, (o, acc) => {
    if (o.id && Array.isArray(o.messages) && o.messages.length) {
      const m = o.messages[o.messages.length - 1];
      let snd = typeof m.sender === 'string' ? m.sender : m.sender ? (m.sender.displayName || m.sender.name || '') + ' <' + (m.sender.email || m.sender.emailAddress || '') + '>' : '';
      const dn = Array.isArray(m.addressDisplayNames) ? m.addressDisplayNames.find(x => x && x.emailAddress && snd && snd.toLowerCase().includes(String(x.emailAddress).toLowerCase())) : null;
      if (dn && dn.displayName && !/</.test(snd)) snd = dn.displayName + ' <' + dn.emailAddress + '>';
      acc.push({ id: String(o.id), msgId: String(m.id || ''), subject: String(m.subject || '(ohne Betreff)'), sender: snd, snippet: String(m.snippet || '').slice(0, 300), date: String(m.date || ''), url: String(o.viewUrl || m.viewUrl || ''), n: o.messageCount || o.messages.length });
    }
  }, out);
  return out.filter((x, i, a) => a.findIndex(y => y.id === x.id) === i);
}
const senderName = s => (String(s).match(/^\s*"?([^"<]+?)"?\s*</) || [, String(s).replace(/<.*>/, '')])[1].trim() || s;
const senderMail = s => (String(s).match(/<([^>]+)>/) || String(s).match(/([\w.+-]+@[\w.-]+\.\w+)/) || [, ''])[1];
async function mailFetch(manual) {
  if (!ART.mcp) { if (manual) toast('Gmail ist hier nicht verfügbar – bitte den Lebenshub in Claude öffnen.'); return; }
  if (mailBusy) return; mailBusy = true;
  try {
    const r = await ART.mcp.callTool(GMAIL, 'search_threads', { query: 'in:inbox category:primary is:unread newer_than:4d', pageSize: 15, view: 'THREAD_VIEW_SUMMARY' }, { cache: false });
    MAILS = mailParse(r); MAILSUM = null;
    S.settings.mailOn = true; S.settings.lastMail = H.today();
    save(manual ? (MAILS.length ? MAILS.length + ' ungelesene Mail(s)' : 'Keine ungelesenen Mails der letzten 4 Tage') : undefined);
  } catch (e) {
    const c = e && e.code;
    if (manual || c === 'needs_reauth') toast(c === 'needs_reauth' ? 'Gmail bitte in den Claude-Einstellungen neu verbinden.' : c === 'server_not_connected' ? 'Gmail ist in Claude nicht verbunden (Einstellungen → Connectors).' : c === 'not_in_manifest' ? 'Zugriff auf Gmail wurde für den Hub nicht erlaubt.' : 'Posteingang nicht abrufbar (' + (c || e.message || '?') + ').');
  } finally { mailBusy = false; }
}
async function mailSort() {
  if (!MAILS || !MAILS.length) return;
  busy(true);
  try {
    const list = MAILS.map((m, i) => `${i + 1}. Von: ${senderName(m.sender)} | Betreff: ${m.subject} | Vorschau: ${m.snippet}`).join('\n');
    const out = await askJson(`Sortiere meine ungelesenen Mails für meinen Lebenshub. Antworte nur mit JSON {"kurz":"1–2 Sätze","mails":[{"nr":1,"wichtig":true,"kategorie":"Bewerbung|Termin|Rechnung|Finanzen|Gesundheit|Arbeit|Privat|Newsletter|Sonstiges","aktion":"konkreter nächster Schritt oder leer","frist":"JJJJ-MM-TT oder leer"}],"eintraege":[{"list":"n|t|b|z|v","title":"…","note":"…","date":"JJJJ-MM-TT oder leer"}]}. Nur was aus Betreff/Vorschau hervorgeht, nichts erfinden. Listen: n=Nächste Schritte, t=Termine, b=Bewerbungen, z=Fixkosten & Abos, v=Versicherungen. Heute ist ${H.today()}.\n\n${list}`);
    MAILSUM = out && typeof out === 'object' ? out : null;
    render();
  } catch (e) { toast(e.message || 'Auswertung nicht möglich'); } finally { busy(false); }
}
function mailApply() {
  if (!MAILSUM || !Array.isArray(MAILSUM.eintraege)) return;
  const labels = [];
  MAILSUM.eintraege.forEach(e => {
    if (!e || !S.lists[e.list] || !e.title) return;
    if (S.lists[e.list].some(x => x.n.trim().toLowerCase() === String(e.title).trim().toLowerCase())) return;
    try { labels.push(runTool('add_entry', { list: e.list, title: e.title, note: e.note, date: e.date }, { files: [] }).label); } catch (er) { /* egal */ }
  });
  MAILSUM.eintraege = [];
  save(labels.length ? labels.length + ' Einträge aus Mails übernommen' : 'Nichts Neues zu übernehmen');
}
async function mailDraft(i) {
  const m = MAILS && MAILS[i];
  if (!m) return;
  const to = senderMail(m.sender);
  openDlg(`<h3>Antwort-Entwurf</h3><div class="hint">An ${esc(senderName(m.sender))} · ${esc(m.subject)}</div>
    <label class="f">Was soll drinstehen? (Stichworte genügen)<textarea name="w" rows="3" placeholder="z. B. Danke, Termin Dienstag 10 Uhr passt"></textarea></label>
    <div class="hint">Claude formuliert die Mail und legt sie als <b>Entwurf</b> in Gmail ab. Gesendet wird erst, wenn du es in Gmail tust.</div>
    <div class="btns"><button class="btn" value="go">Entwurf erstellen</button><button class="btn ghost" value="cancel" formnovalidate>Abbrechen</button></div>`, async (v, f) => {
    const wish = f.w.value.trim();
    busy(true);
    try {
      const d = await askJson(`Schreibe eine kurze, freundliche Antwort-Mail auf Deutsch (Du/Sie passend zum Ton der Mail). Antworte nur mit JSON {"body":"Text ohne Markdown, mit Gruß"}.\nUrsprüngliche Mail – Von: ${senderName(m.sender)} | Betreff: ${m.subject} | Vorschau: ${m.snippet}\nMeine Stichworte: ${wish || '(keine – höflich bestätigen bzw. nachfragen)'}`);
      if (!d || !d.body) throw new Error('Kein Text erhalten');
      await ART.mcp.callTool(GMAIL, 'create_draft', Object.assign({ to: to ? [to] : [], subject: /^re:/i.test(m.subject) ? m.subject : 'Re: ' + m.subject, body: String(d.body) }, m.msgId ? { replyToMessageId: m.msgId } : {}), { cache: false });
      toast('Entwurf in Gmail gespeichert – dort prüfen und senden.');
    } catch (e) { toast((e && e.code) ? 'Entwurf nicht möglich (' + e.code + ')' : (e.message || 'Entwurf nicht möglich')); } finally { busy(false); }
  });
}
function mailCard() {
  if (!ART.mcp) return '';
  const S2 = MAILSUM, byNr = {};
  if (S2 && Array.isArray(S2.mails)) S2.mails.forEach(x => { byNr[x.nr] = x; });
  const rows = (MAILS || []).map((m, i) => { const a = byNr[i + 1] || {};
    return `<div class="row"><div class="t">${a.wichtig ? '<span class="chip bad">wichtig</span> ' : ''}${esc(m.subject)}<small>${esc(senderName(m.sender))}${a.kategorie ? ' · ' + esc(a.kategorie) : ''}${a.aktion ? ' · ➜ ' + esc(a.aktion) : ''}${a.frist ? ' · bis ' + esc(H.fd(a.frist)) : ''}</small></div>
      <span class="mailbtns">${m.url ? `<a class="chip d" href="${esc(m.url)}" target="_blank" rel="noopener">öffnen</a>` : ''}<button class="chip" data-act="mdraft" data-v="${i}">Antwort</button></span></div>`; }).join('');
  return `<section class="card mail"><h2>Posteingang<small>${MAILS ? MAILS.length + ' ungelesen' : 'Gmail'}</small></h2>
    ${MAILS == null ? '<div class="hint">Zeigt ungelesene Mails der letzten 4 Tage. Claude sortiert sie nach Wichtigkeit und trägt Fristen und Aufgaben ein – Antworten nur als Entwurf.</div>' : rows || '<div class="empty">Keine ungelesenen Mails. 🎉</div>'}
    ${S2 && S2.kurz ? `<div class="hint" style="margin-top:6px">${esc(S2.kurz)}</div>` : ''}
    <div class="btns"><button class="btn ${MAILS ? 'ghost' : ''}" data-act="mfetch">${MAILS ? 'Aktualisieren' : 'Posteingang abrufen'}</button>${MAILS && MAILS.length && (ART.sample) ? '<button class="btn" data-act="msort">Mit Claude sortieren</button>' : ''}${S2 && S2.eintraege && S2.eintraege.length ? `<button class="btn" data-act="mapply">${S2.eintraege.length === 1 ? '1 Vorschlag' : S2.eintraege.length + ' Vorschläge'} übernehmen</button>` : ''}</div></section>`;
}
function mailAuto() { if (S.settings && S.settings.mailOn && ART.mcp && MAILS == null) mailFetch(false); }
function mailAct(act, b) {
  if (act === 'mfetch') { mailFetch(true); return true; }
  if (act === 'msort') { mailSort(); return true; }
  if (act === 'mapply') { mailApply(); return true; }
  if (act === 'mdraft') { mailDraft(+b.dataset.v); return true; }
  return false;
}

/* Odi-Werkzeuge für Gmail (nur lesen und Entwürfe anlegen – nie senden) */
const MAIL_NAMES = ['search_mail', 'read_mail', 'draft_mail'];
function mailTools() {
  if (typeof ART === 'undefined' || !ART.mcp) return [];
  const s = d => ({ type: 'string', description: d });
  return [
    { name: 'search_mail', description: 'In Gmail suchen (Posteingang, Gesendet, Archiv). Liefert Threads mit Betreff, Absender, Datum und Vorschau. Für Inhalte danach read_mail.',
      input_schema: { type: 'object', additionalProperties: false, required: ['query'], properties: { query: s('Gmail-Suchsyntax, z. B. „from:firma.de newer_than:30d“, „Bewerbung Absage“, „in:sent einklang“'), max: { type: 'number', description: 'höchstens 20' } } } },
    { name: 'read_mail', description: 'Einen Gmail-Thread vollständig lesen (alle Nachrichten im Klartext).',
      input_schema: { type: 'object', additionalProperties: false, required: ['threadId'], properties: { threadId: s('Thread-ID aus search_mail') } } },
    { name: 'draft_mail', description: 'Antwort oder neue Mail als ENTWURF in Gmail anlegen. Wird nie gesendet – der Nutzer prüft und sendet selbst.',
      input_schema: { type: 'object', additionalProperties: false, required: ['subject', 'body'], properties: { to: s('Empfänger-Adresse'), subject: s('Betreff'), body: s('Text'), replyToMessageId: s('Nachrichten-ID, wenn es eine Antwort ist') } } }
  ];
}
function mailErr(e) {
  const c = e && e.code;
  return c === 'not_granted' ? 'Gmail-Zugriff wurde im Hub abgelehnt – in den Berechtigungen des Hubs (Menü oben) erlauben.'
    : c === 'server_not_connected' ? 'Gmail ist in Claude nicht verbunden – claude.ai → Einstellungen → Connectors → Gmail verbinden.'
    : c === 'needs_reauth' ? 'Gmail muss in den Claude-Einstellungen neu verbunden werden.'
    : c === 'not_in_manifest' ? 'Dieses Gmail-Werkzeug ist für den Hub noch nicht freigegeben.'
    : 'Gmail-Fehler: ' + ((e && (e.message || c)) || 'unbekannt');
}
async function mailToolRun(name, x) {
  if (!ART.mcp) throw new Error('Gmail ist hier nicht verfügbar – bitte den Lebenshub in Claude öffnen.');
  try {
    if (name === 'search_mail') {
      const r = await ART.mcp.callTool(GMAIL, 'search_threads', { query: String(x.query || '').slice(0, 300), pageSize: Math.min(20, Math.max(1, +x.max || 10)), view: 'THREAD_VIEW_SUMMARY' }, { cache: false });
      const P = r && r.payload != null ? r.payload : r, T = (P && P.threads) || [];
      const out = T.map(t => { const m = (t.messages || [])[0] || {}; return { threadId: t.id, messages: t.messageCount || (t.messages || []).length, from: typeof m.sender === 'string' ? m.sender : (m.sender && (m.sender.email || m.sender.emailAddress)) || '', date: String(m.date || '').slice(0, 16), subject: m.subject || '', preview: String(m.snippet || '').slice(0, 240), messageId: m.id }; });
      return { label: '✉️ Gmail durchsucht: „' + String(x.query).slice(0, 40) + '“ (' + out.length + ')', result: JSON.stringify(out) || '[]' };
    }
    if (name === 'read_mail') {
      const r = await ART.mcp.callTool(GMAIL, 'get_thread', { threadId: String(x.threadId || ''), messageFormat: 'PLAIN_TEXT' }, { cache: false });
      const P = r && r.payload != null ? r.payload : r, M = (P && P.messages) || [];
      let budget = 9000;
      const out = M.map(m => { const body = String(m.plaintextBody || m.snippet || '').replace(/\n{3,}/g, '\n\n'); const take = body.slice(0, Math.max(400, Math.floor(budget / Math.max(1, M.length)))); budget -= take.length; return { messageId: m.id, from: typeof m.sender === 'string' ? m.sender : '', date: String(m.date || '').slice(0, 16), subject: m.subject || '', body: take }; });
      return { label: '✉️ Mail gelesen: ' + ((out[0] && out[0].subject) || x.threadId).slice(0, 50), result: JSON.stringify(out) };
    }
    if (name === 'draft_mail') {
      await ART.mcp.callTool(GMAIL, 'create_draft', Object.assign({ to: x.to ? [String(x.to)] : [], subject: String(x.subject || ''), body: String(x.body || '') }, x.replyToMessageId ? { replyToMessageId: String(x.replyToMessageId) } : {}), { cache: false });
      return { label: '✉️ Entwurf in Gmail: ' + String(x.subject || '').slice(0, 50), result: 'Entwurf gespeichert – nicht gesendet.' };
    }
  } catch (e) { throw new Error(mailErr(e)); }
  throw new Error('Unbekanntes Mail-Werkzeug');
}
