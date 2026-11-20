/* Lebenshub – Odi-Sprachmodus: schnelle Antworten direkt aus den Hub-Daten (ohne Claude, sofort, keine Kosten),
   alles andere geht an Claude. Antworten werden vorgelesen. */
'use strict';
const WD = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const sirP = () => (odi().sir ? ', Sir' : '');
const joinDe = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' und ' + a[a.length - 1];
function wxSentence(d) {
  const W = S.weather, x = W && W.days && W.days.find(y => y.d === d);
  if (!x) return '';
  const tt = x.tmax != null ? (x.tmin != null ? Math.round(x.tmin) + ' bis ' : '') + Math.round(x.tmax) + ' Grad' : '';
  return [x.desc, tt, x.rain != null ? 'Regenrisiko ' + Math.round(x.rain) + ' Prozent' : ''].filter(Boolean).join(', ') + '.';
}
function apptsOn(d) {
  if (typeof calDay === 'function') return calDay(d).filter(e => e.kind === 't' || e.kind === 'apple' || (e.kind === 'item' && e.tm)).map(e => e.title + (e.tm ? ' um ' + e.tm.replace(/^0/, '') + ' Uhr' : ''));
  return S.lists.t.filter(it => it.d === d).sort((a, b) => (a.tm || '99').localeCompare(b.tm || '99'))
    .map(it => it.n + (it.tm ? ' um ' + it.tm.replace(/^0/, '') + ' Uhr' : ''));
}
function planSentence(d) {
  const today = d === H.today(), out = [];
  const r = S.routines.filter(x => today ? H.state(x, d).due : H.isOcc(x, d)).map(x => x.n);
  const a = apptsOn(d);
  if (a.length) out.push((a.length === 1 ? 'Ein Termin: ' : a.length + ' Termine: ') + joinDe(a) + '.');
  if (r.length) out.push((r.length === 1 ? 'Eine Routine: ' : r.length + ' Routinen: ') + joinDe(r.slice(0, 6)) + (r.length > 6 ? ' und weitere' : '') + '.');
  if (today) {
    const n = S.lists.n.filter(it => !isDone(C.find(c => c.k === 'n'), it)).sort((x, y) => (x.d || '9').localeCompare(y.d || '9')).slice(0, 3).map(it => it.n);
    if (n.length) out.push('Als Nächstes: ' + joinDe(n) + '.');
  }
  return out.join(' ') || (today ? 'Heute steht nichts an – ein freier Tag.' : 'Da steht noch nichts an.');
}
function healthSentence() {
  if (typeof scores !== 'function') return '';
  const s = scores(H.today()), x = (S.health && S.health.days || {})[H.today()] || {};
  const p = [];
  if (s.rec != null) p.push('Erholung ' + Math.round(s.rec) + ' Prozent');
  if (x.sleep != null) p.push(String(x.sleep).replace('.', ',') + ' Stunden Schlaf');
  return p.length ? p.join(', ') + '.' + (s.rec != null ? (s.rec >= 67 ? ' Bereit für eine harte Einheit.' : s.rec >= 34 ? ' Moderates Training passt.' : ' Heute lieber locker.') : '') : 'Für heute habe ich noch keine Gesundheitsdaten.';
}
function briefing() {
  const h = new Date().getHours(), t = H.today();
  const gr = (h < 11 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend') + sirP() + '.';
  const w = wxSentence(t);
  return [gr, 'Heute ist ' + WD[new Date().getDay()] + '.', w ? 'Wetter' + (S.weather.place ? ' in ' + S.weather.place : '') + ': ' + w : '', planSentence(t)].filter(Boolean).join(' ');
}
/* Antwortet direkt, wenn die Frage einfach ist – sonst null (dann Claude) */
function odiLocal(q) {
  const s = q.toLowerCase().trim();
  if (!s || s.length > 90 || /trag|leg|erstell|mach|setz|plan|buch|neu|füg|hinzu|notier|merk|verschieb|lösch|änder|kauf|aktualisier|speicher|schreib|schick|send|erinner|recherch|such|warum|erklär|vergleich|analys|empfiehl|rechne|berechn|kannst du|bitte/.test(s) || /\d{1,2}([:.]\d{2})?\s*uhr|\bum \d/.test(s)) return null;
  const morgen = /morgen(?!s)/.test(s) && !/guten morgen/.test(s), d = morgen ? H.add(H.today(), 1) : H.today(), wann = morgen ? 'Morgen' : 'Heute';
  if (/^(hey |hallo |hi |ok )?(odi|udi)\b[\s!?.]*$|briefing|überblick|guten morgen|lagebericht|status/.test(s)) return briefing();
  if (/wetter|regen|regnet|temperatur|grad|warm|kalt|anzieh|schirm|sonne|schnee/.test(s)) {
    const w = wxSentence(d);
    return w ? wann + (S.weather.place ? ' in ' + S.weather.place : '') + ': ' + w + (!morgen && S.weather.tip ? ' ' + S.weather.tip : '') : 'Mir liegt noch keine aktuelle Vorhersage vor' + sirP() + '. Der Wetter-Job liefert sie jeden Morgen.';
  }
  if (/termin/.test(s)) { const a = apptsOn(d); return a.length ? wann + ' ' + (a.length === 1 ? 'hast du einen Termin: ' : 'hast du ' + a.length + ' Termine: ') + joinDe(a) + '.' : wann + ' hast du keine Termine' + sirP() + '.'; }
  if (/plan|was steht|was muss|zu tun|aufgabe|to.?do|tagesablauf|mein tag|programm|ansteht/.test(s)) return wann + ': ' + planSentence(d);
  if (/erhol|schlaf|fit\b|fitness|recovery|gesundheit|wie geht.s mir/.test(s)) return healthSentence();
  if (/depot|vermögen|finanzen|aktien|portfolio/.test(s) && typeof finTotals === 'function' && S.fin && S.fin.accounts && S.fin.accounts.length)
    return 'Dein Gesamtvermögen liegt bei ' + Math.round(finTotals().total).toLocaleString('de-DE') + ' Euro' + sirP() + '.';
  if (/mail/.test(s) && typeof MAILS !== 'undefined' && MAILS) return MAILS.length ? 'Du hast ' + MAILS.length + ' ungelesene Mail' + (MAILS.length > 1 ? 's' : '') + '. Die neueste: ' + MAILS[0].subject + '.' : 'Keine ungelesenen Mails' + sirP() + '.';
  if (/wie spät|uhrzeit/.test(s)) return 'Es ist ' + new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr' + sirP() + '.';
  if (/^(danke|merci)/.test(s)) return 'Stets zu Diensten' + sirP() + '.';
  return null;
}
/* Sprachbefehle, die direkt in der App ausgeführt werden (ohne Claude) */
const ODI_NAV = [[/heute|start|übersicht|home/, 'today'], [/kalender|termine/, 'cal'], [/routine/, 'routines'], [/arbeit|bewerbung|job/, 'work'], [/finanz|depot|geld|aktie|krypto|portfolio/, 'money'], [/leben|vertr[aä]g|versicherung|miete|wohnung|auto|mobilit/, 'life'], [/gesundheit|schlaf|erholung|training|essen/, 'health'], [/wissen|gehirn|tiktok|dokument|ablage/, 'files'], [/einstellung/, 'settings'], [/odi|assistent|chat/, 'chat']];
function odiCommand(q) {
  const s = q.toLowerCase().trim().replace(/[.!?]+$/, '');
  if (/^(stopp?|halt|ruhe|sei still|aufhören|ende|tschüss|danke,? das war'?s)$/.test(s)) { try { speechSynthesis.cancel(); } catch (e) { /* egal */ } talkMode = false; return 'Sehr wohl' + sirP() + '.'; }
  if (/^(lies|lese) (das |es )?(noch ?mal )?vor$|^wiederhol/.test(s)) { const last = [...CHAT].reverse().find(m => m.role === 'assistant'); return last ? last.text : 'Es gibt noch nichts vorzulesen.'; }
  const m = s.match(/^(öffne|zeig(e)?( mir)?|geh(e)?( zu| in)?|wechsel(e)?( zu| in)?|bring mich zu|navigier(e)?( zu)?)\s+(die |den |das |zu |zum |zur |in )*(.+)$/);
  if (m) { const tgt = ODI_NAV.find(n => n[0].test(m[m.length - 1])); if (tgt) { odiGo = tgt[1]; return 'Öffne ' + ((TABS.find(t => t[0] === tgt[1]) || [, tgt[1]])[1]) + sirP() + '.'; } }
  if (/hochladen|dokument.*(hinzufügen|speichern)/.test(s) && !/^(was|wie|welche)/.test(s)) return 'Gern' + sirP() + ' – tippe oben auf den Pfeil nach oben, dann wählst du die Dateien.';
  return null;
}
let odiGo = '';
const _sendChat = sendChat;
sendChat = async function (text) {
  const t = (text || '').trim();
  const a = !chatBusy && !chatFiles.length ? (odiCommand(t) || (odi().on ? odiLocal(t) : null)) : null;
  if (a == null) return _sendChat(text);
  CHAT.push({ role: 'user', text: t, voice: viaVoice, at: Date.now() }, { role: 'assistant', text: a, actions: [], at: Date.now() });
  chatDraft = ''; viaVoice = false; saveChat(); render(); scrollChat();
  speak(a, talkMode && !odiGo);
  if (odiGo) { const g = odiGo; odiGo = ''; talkMode = false; setTimeout(() => { TAB = g; render(); scrollTo(0, 0); }, 900); } else odiRefocus();
};
function odiRefocus() { if (location.hash === '#odi') setTimeout(() => { const i = $('chatIn'); if (i) i.focus(); }, 150); }
let odiAwake = false;
function odiOrb() {
  if (!odi().on || location.hash !== '#odi') return '';
  return `<button class="orb ${odiAwake ? 'on' : ''}" data-act="odiOrb" aria-label="${esc(odi().name)} aktivieren"><span></span></button>
    <div class="hint" style="text-align:center">${odiAwake ? (talkMode ? 'Ich höre zu … sprich einfach. Befehle: „Öffne Finanzen“, „Trag morgen 10 Uhr Physio ein“, „Stopp“.' : 'Frag mich etwas – 🎤 antippen und sprechen. Z. B. „Wie ist das Wetter?“, „Öffne Kalender“, „Trag morgen 10 Uhr Physio ein“.') : 'Antippen – ' + esc(odi().name) + ' meldet sich mit deinem Tagesüberblick.'}</div>`;
}
function odiOrbAct(act) {
  if (act !== 'odiOrb') return false;
  unlockTts(); speakOn = true; odiAwake = true;
  const b = briefing();
  CHAT.push({ role: 'assistant', text: b, actions: [], at: Date.now() });
  saveChat(); render(); scrollChat();
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR && !srBlocked) { talkMode = true; speak(b, true); } // danach hört Odi automatisch zu
  else { const i = $('chatIn'); if (i) i.focus(); speak(b); } // sonst: Tastatur offen, 🎤 der Tastatur nutzen
  return true;
}
