/* Lebenshub – App */
'use strict';
const H = self.LH;
const K = 'lebenshub-app-v1';
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

const ICON = {
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  routines: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  work: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
  money: '<path d="M18 7.5A6.5 6.5 0 1 0 18 16.5"/><path d="M4 10.5h9M4 13.5h9"/>',
  files: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  health: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>'
};
const TABS = [['today', 'Heute'], ['chat', 'Assistent'], ['routines', 'Routinen'], ['work', 'Arbeit'], ['money', 'Finanzen'], ['health', 'Gesundheit'], ['files', 'Wissen']];
const BW = ['Entwurf', 'Versandt', 'Termin', 'Stand prüfen', 'Absage'];

/* Listen-Definitionen. Inhalte kommen per Import (Startdaten/Backup) oder werden in der App angelegt. */
const C = [
  { k: 't', tab: 'today', title: 'Termine', date: 1 },
  { k: 'n', tab: 'today', title: 'Nächste Schritte', st: ['Offen', 'Erledigt'], dn: 1, date: 1 },
  { k: 'f', tab: 'work', title: 'Forschung & Promotion', st: ['Offen', 'Im Gespräch', 'Zusage', 'Zurückgestellt'] },
  { k: 'b', tab: 'work', title: 'Bewerbungen', st: BW },
  { k: 'a', tab: 'work', title: 'Eigene Arbeit', st: ['Läuft', 'Geplant', 'Fertig'] },
  { k: 'u', tab: 'work', title: 'Startups & Ideen', st: ['Idee', 'Validierung', 'Zurückgestellt'] },
  { k: 'k', tab: 'money', hideEmpty: 1, title: 'Weitere Konten (Notizen)', date: 1, hint: 'Konto/Depot mit Stand im Feld „Notiz / Wert“, Datum = Stichtag. Keine IBAN oder Kontonummern.' },
  { k: 'z', tab: 'money', title: 'Fixkosten & Abos', date: 1, hint: 'Betrag und Rhythmus als Notiz, Datum = nächste Fälligkeit oder Kündigungsfrist.' },
  { k: 'g', tab: 'money', title: 'Finanzen im Überblick', hint: 'Eigene Angaben, ohne Gewähr. Wert im Feld „Notiz / Wert“ eintragen.' },
  { k: 'i', tab: 'money', title: 'Startup-Beteiligungen', st: ['Beobachten', 'Prüfen', 'Investiert'] },
  { k: 'p', tab: 'money', title: 'Börse & Portfolio', st: ['Beobachten', 'Prüfen', 'Position'] },
  { k: 'h', tab: 'health', title: 'Gesundheitsdokumente', st: ['Abgelegt', 'Prüfen', 'Fehlt'], date: 1, hint: 'Nur Titel und Fristen, keine Befunde. Du wirst am Vortag erinnert.' },
  { k: 'x', tab: 'health', title: 'Verletzungen & Beschwerden', st: ['Akut', 'In Behandlung', 'Heilt', 'Ausgeheilt'], dn: 1, date: 1, hint: 'Was, seit wann, Behandlung/Arzt als Notiz. Datum = nächster Termin.' },
  { k: 'v', tab: 'health', title: 'Versicherungen', st: ['Aktiv', 'Angebot', 'Prüfen'], date: 1, hint: 'Fälligkeit/Kündigungsfrist als Datum. Keine Policen-Nummern.' },
  { k: 'dw', tab: 'files', title: 'Wohnung', st: ['Abgelegt', 'Prüfen', 'Fehlt'], hint: 'Übersicht deiner Unterlagen: abgelegt, zu prüfen oder fehlend.' },
  { k: 'dm', tab: 'files', title: 'Mobilität', st: ['Abgelegt', 'Prüfen', 'Fehlt'] },
  { k: 'dp', tab: 'files', title: 'Projekte & Forschung', st: ['Abgelegt', 'Prüfen', 'Fehlt'] },
  { k: 'dj', tab: 'files', title: 'Jobs, Bildung & Fortbildung', st: ['Abgelegt', 'Prüfen', 'Fehlt'] },
  { k: 'ds', tab: 'files', title: 'Sport, Trainer & Archiv', st: ['Abgelegt', 'Prüfen', 'Fehlt'] }
];

function seed() {
  const s = { v: 2, lists: {}, routines: [], settings: { notify: false, defTime: '08:00', theme: 'auto' } };
  C.forEach(c => { s.lists[c.k] = []; });
  return s;
}

let S = null, TAB = 'today', installEvt = null;
try { S = JSON.parse(localStorage.getItem(K)); } catch (e) { S = null; }
if (!S || !S.lists || !S.routines) S = seed();
S.settings = Object.assign({ notify: false, defTime: '08:00', theme: 'auto' }, S.settings || {});
C.forEach(c => { if (!S.lists[c.k]) S.lists[c.k] = []; });
try { TAB = sessionStorage.getItem(K + '-tab') || 'today'; } catch (e) { /* egal */ }

function save(msg) {
  try { localStorage.setItem(K, JSON.stringify(S)); } catch (e) { if (!ART.db) toast('Speichern fehlgeschlagen'); }
  if (typeof artSave === 'function') artSave();
  render();
  syncData().then(checkNotify);
  if (msg) toast(msg);
}

/* ---------- Hilfen ---------- */
const listOf = k => C.find(c => c.k === k);
function rel(d, t) {
  const n = H.diff(t, d);
  if (n === 0) return 'heute';
  if (n === 1) return 'morgen';
  if (n === -1) return 'gestern';
  if (n > 1 && n < 7) return H.WD[H.P(d).getUTCDay()] + ' ' + H.fd(d);
  return H.fdy(d);
}
function isDone(c, it) { return c.dn && it.s === c.st.length - 1; }
function toast(m) { const el = $('toast'); el.textContent = m; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, 2600); }
function dueRoutines(t) { return S.routines.filter(r => H.state(r, t).due); }

/* ---------- Bausteine ---------- */
function stClass(s) {
  return /^(Fehlt|Absage|Akut)$/.test(s) ? 'bad' : /^(Prüfen|Stand prüfen|Angebot|In Behandlung|Validierung|Im Gespräch|Termin)$/.test(s) ? 'warn'
    : /^(Abgelegt|Aktiv|Erledigt|Zusage|Position|Fertig|Ausgeheilt|Investiert)$/.test(s) ? 'good' : '';
}
/* Suche über den ganzen Hub */
let HUBQ = '';
function searchCard() {
  const q = HUBQ.trim().toLowerCase();
  let res = '';
  if (q.length > 1) {
    const hits = [];
    C.forEach(c => S.lists[c.k].forEach(it => { if ((it.n + ' ' + (it.t || '')).toLowerCase().includes(q)) hits.push(`<div class="row"><button class="t" data-act="iedit" data-k="${c.k}" data-id="${it.id}">${esc(it.n)}<small>${esc(c.title)}${it.t ? ' · ' + esc(it.t) : ''}</small></button>${c.st ? `<span class="chip ${stClass(c.st[it.s])}">${esc(c.st[it.s])}</span>` : ''}</div>`); }));
    S.routines.forEach(r => { if (r.n.toLowerCase().includes(q)) hits.push(`<div class="row"><button class="t" data-act="redit" data-id="${r.id}">${esc(r.n)}<small>Routine · ${esc(H.freqLabel(r))}</small></button></div>`); });
    (typeof DOCS !== 'undefined' ? DOCS : []).forEach(d => { const tt = (d.analysis && d.analysis.title) || d.name; if ((tt + ' ' + d.name).toLowerCase().includes(q)) hits.push(`<div class="row"><button class="t" data-act="dopen" data-id="${d.id}">${esc(tt)}<small>Dokument</small></button></div>`); });
    (S.know || []).forEach(k => { if ((k.title + ' ' + k.summary + ' ' + k.tags.join(' ')).toLowerCase().includes(q)) hits.push(`<div class="row"><button class="t" data-act="kopen" data-id="${k.id}">${esc(k.title)}<small>Wissen · ${esc(k.kind)}</small></button></div>`); });
    if (S.fin) S.fin.positions.forEach(p => { if ((p.name + ' ' + (p.isin || '')).toLowerCase().includes(q)) hits.push(`<div class="row"><button class="t" data-act="fpos" data-id="${p.id}">${esc(p.name)}<small>Depot-Position</small></button></div>`); });
    res = hits.slice(0, 30).join('') || '<div class="empty">Nichts gefunden.</div>';
  }
  return `<section class="card wide search"><input type="search" id="hubq" placeholder="Im Hub suchen …" value="${esc(HUBQ)}" autocomplete="off" enterkeyhint="search">${res}</section>`;
}
function routineRow(r, t) {
  const st = H.state(r, t);
  let btn, chip;
  if (st.due) {
    btn = `<button class="check ${st.overdue ? 'over' : ''}" data-act="rdone" data-id="${r.id}" aria-label="${esc(r.n)} erledigt"></button>`;
    chip = st.overdue ? `<span class="chip due">überfällig · ${rel(st.cur, t)}</span>` : `<span class="chip due">heute${r.time ? ' ' + r.time : ''}</span>`;
  } else if (r.last === t) {
    btn = `<button class="check on" data-act="rundo" data-id="${r.id}" aria-label="Rückgängig"></button>`;
    chip = `<span class="chip d">nächste: ${st.next ? rel(st.next, t) : '—'}</span>`;
  } else {
    btn = '<span class="spacer"></span>';
    chip = `<span class="chip d">${st.next ? rel(st.next, t) : '—'}</span>`;
  }
  const meta = (r.claude ? ['Claude ' + r.claude.run, 'Erinnerung ' + r.time] : [H.freqLabel(r), r.time, r.note]).filter(Boolean).map(esc).join(' · ');
  const tag = r.claude ? '<span class="ctag">Claude</span> ' : '';
  return `<div class="row ${r.last === t && !st.due ? 'done' : ''}">${btn}<button class="t" data-act="redit" data-id="${r.id}">${tag}${esc(r.n)}<small>${meta}</small></button>${chip}</div>`;
}

function listCard(c, opts) {
  const o = opts || {};
  let L = S.lists[c.k].map((it, i) => Object.assign({}, it, { i }));
  if (c.date) L.sort((a, b) => (a.d || '9').localeCompare(b.d || '9'));
  if (c.dn) L.sort((a, b) => isDone(c, a) - isDone(c, b));
  const t = H.today();
  const rows = L.map(it => {
    const done = isDone(c, it);
    const late = it.d && it.d < t && !done;
    const date = it.d ? `<span class="chip ${late || it.d === t ? 'due' : 'd'}">${rel(it.d, t)}</span>` : '';
    const st = c.st ? `<button class="chip ${stClass(c.st[it.s] || c.st[0])}" data-act="cycle" data-k="${c.k}" data-id="${it.id}">${esc(c.st[it.s] || c.st[0])}</button>` : '';
    return `<div class="row ${done ? 'done' : ''}"><button class="t" data-act="iedit" data-k="${c.k}" data-id="${it.id}">${esc(it.n)}${it.t ? `<small>${esc(it.t)}</small>` : ''}</button>${date}${st}</div>`;
  }).join('') || '<div class="empty">Noch leer.</div>';
  return `<section class="card ${o.wide ? 'wide' : ''}"><h2>${c.title}<small>${c.dn ? L.filter(x => !isDone(c, x)).length + ' offen' : L.length}</small></h2>${c.hint ? `<div class="hint">${c.hint}</div>` : ''}${rows}
  <div class="add-row"><input type="text" id="in-${c.k}" data-add="${c.k}" placeholder="Neu …" enterkeyhint="done">${c.date ? `<input type="date" id="dt-${c.k}" aria-label="Datum">` : ''}<button class="btn" data-act="add" data-k="${c.k}" aria-label="Hinzufügen">+</button></div></section>`;
}

/* ---------- Ansichten ---------- */
function isEmpty() { return !S.routines.length && C.every(c => !S.lists[c.k].length); }
function viewToday() {
  const t = H.today();
  if (ART.db && !ART.ready && isEmpty()) return `<section class="card wide"><h2>Lebenshub wird geladen …</h2><div class="hint">Deine Daten kommen von Claude. Das dauert meist nur einen Moment.</div></section>`;
  if (isEmpty()) return `<section class="card wide"><h2>Willkommen im Lebenshub</h2><div class="hint">Hast du eine Startdatei oder ein Backup (<b>.json</b>)? Dann importiere sie hier – auf dem iPhone liegt sie z. B. in der Dateien-App. Sonst leg einfach los und füge Routinen und Einträge selbst hinzu.</div><div class="btns"><button class="btn" data-act="import">Startdaten importieren</button><button class="btn ghost" data-act="tab" data-v="routines">Erste Routine anlegen</button></div></section>`;
  const due = dueRoutines(t).sort((a, b) => (a.time || S.settings.defTime).localeCompare(b.time || S.settings.defTime));
  const doneT = S.routines.filter(r => r.last === t && !H.state(r, t).due);
  const total = due.length + doneT.length;
  const pct = total ? Math.round(doneT.length / total * 100) : 100;
  let h = searchCard() + `<section class="card wide"><h2>Heute zu tun<small>${doneT.length} von ${total} erledigt</small></h2><div class="bar"><i style="width:${pct}%"></i></div>
    ${due.map(r => routineRow(r, t)).join('')}${doneT.map(r => routineRow(r, t)).join('')}
    ${!total ? '<div class="empty">Heute stehen keine Routinen an.</div>' : !due.length ? '<div class="empty">Alles erledigt. Gute Arbeit!</div>' : ''}</section>`;

  h += typeof jobLogCard === 'function' ? jobLogCard() : '';
  // Demnächst: Datums-Einträge aller Listen + Routinen der nächsten 7 Tage
  const until = H.add(t, 14), up = [];
  C.forEach(c => S.lists[c.k].forEach(it => {
    if (!it.d || isDone(c, it) || it.d > until) return;
    if (it.d < t && !c.dn) return; // vergangene Termine nicht mehr zeigen
    up.push({ d: it.d, n: it.n, sub: c.title, k: c.k, id: it.id });
  }));
  S.routines.forEach(r => {
    const d = H.nextOcc(r, t);
    if (d && d <= H.add(t, 7) && r.freq !== 'daily') up.push({ d, n: r.n, sub: r.claude ? 'Claude-Aufgabe · ' + r.claude.run : 'Routine · ' + H.freqLabel(r), rid: r.id });
  });
  up.sort((a, b) => a.d.localeCompare(b.d));
  h += `<section class="card"><h2>Demnächst<small>14 Tage</small></h2>${up.map(x => `<div class="row"><button class="t" data-act="${x.rid ? 'redit' : 'iedit'}" data-id="${x.rid || x.id}" data-k="${x.k || ''}">${esc(x.n)}<small>${esc(x.sub)}</small></button><span class="chip ${x.d <= t ? 'due' : 'd'}">${rel(x.d, t)}</span></div>`).join('') || '<div class="empty">Nichts geplant.</div>'}</section>`;
  h += C.filter(c => c.tab === 'today').map(c => listCard(c)).join('');
  if (!S.settings.notify && !ART.on) h += `<section class="card wide"><h2>Erinnerungen einschalten</h2><div class="hint">Lass dich benachrichtigen, wenn eine Routine fällig ist oder ein Termin ansteht.</div><div class="btns"><button class="btn" data-act="notifon">Benachrichtigungen aktivieren</button><button class="btn ghost" data-act="tab" data-v="settings">Mehr Optionen</button></div></section>`;
  return h;
}

function viewRoutines() {
  const t = H.today();
  const cl = S.routines.filter(r => r.claude);
  let h = !cl.length ? '' : `<section class="card wide"><h2>Geplante Claude-Aufgaben<small>laufen automatisch</small></h2>
    <div class="hint">Claude führt diese Aufgaben zu den genannten Zeiten selbst aus und schickt dir das Ergebnis. Die App erinnert dich danach, es zu lesen und umzusetzen.</div>
    ${cl.map(r => {
      const nx = H.nextOcc(r, H.add(t, -1));
      return routineRow(r, t) + `<div class="cinfo"><span>Ergebnis: ${esc(r.claude.out)}</span><span>Nächster Lauf: ${nx ? rel(nx, t) : '—'}</span></div>`;
    }).join('') || '<div class="empty">Keine.</div>'}</section>`;
  const grp = [['daily', 'Täglich'], ['weekly', 'Wöchentlich'], ['monthly', 'Monatlich']];
  h += grp.map(([f, l]) => {
    const rs = S.routines.filter(r => r.freq === f && !r.claude);
    return `<section class="card"><h2>${l}<small>${rs.length}</small></h2>${rs.map(r => routineRow(r, t)).join('') || '<div class="empty">Keine.</div>'}<div class="btns"><button class="btn ghost" data-act="rnew" data-v="${f}">+ ${l.replace('lich', 'liche')} Routine</button></div></section>`;
  }).join('');
  h += `<section class="card wide"><h2>So funktioniert's</h2><div class="hint">Abhaken, wenn erledigt – die Aufgabe kommt beim nächsten Termin automatisch wieder. Tippe auf einen Eintrag, um Rhythmus, Uhrzeit oder Notiz zu ändern. Verpasste Termine bleiben als „überfällig“ stehen, bis du sie abhakst.</div></section>`;
  return h;
}

function viewSettings() {
  const s = S.settings;
  const perm = ('Notification' in self) ? Notification.permission : 'unsupported';
  const permTxt = { granted: 'erlaubt', denied: 'blockiert (in den Browser-/Systemeinstellungen freigeben)', default: 'noch nicht gefragt', unsupported: 'von diesem Browser nicht unterstützt' }[perm];
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (ART.on) return `${artSettingsCard()}
  <section class="card"><h2>Kalender-Erinnerungen</h2><div class="hint">Exportiert alle Routinen als wiederkehrende Termine (mit Alarm) und alle datierten Einträge als Ganztagstermine (Alarm am Vortag). In den iPhone-Kalender übernehmen – dann wirst du immer erinnert. Nach Änderungen neu exportieren.</div><div class="btns"><button class="btn" data-act="ics">Kalenderdatei (.ics) speichern</button></div></section>
  <section class="card"><h2>Design</h2><label class="f">Darstellung<select id="theme"><option value="auto">Automatisch</option><option value="light">Hell</option><option value="dark">Dunkel</option></select></label></section>
  <section class="card"><h2>Daten</h2><div class="hint">Dein Hub ist privat und nur für dich sichtbar. Backups enthalten Listen und Routinen, keine Dokumente.</div>
    <div class="btns"><button class="btn" data-act="export">Backup speichern</button><button class="btn ghost" data-act="import">Backup/Startdatei importieren</button></div>
    <div class="btns"><button class="btn warn" data-act="reset">Alle Daten löschen</button></div></section>`;
  return `<section class="card"><h2>Erinnerungen</h2>
    <div class="kv"><span>Status</span><span>${s.notify && perm === 'granted' ? 'aktiv' : 'aus'}</span></div>
    <div class="kv"><span>Berechtigung</span><span>${permTxt}</span></div>
    <label class="f" style="margin-top:8px">Standard-Uhrzeit (Routinen ohne Uhrzeit, Termin-Hinweise)<input type="time" id="defTime" value="${esc(s.defTime)}"></label>
    <div class="btns">${s.notify ? '<button class="btn ghost" data-act="notifoff">Ausschalten</button><button class="btn ghost" data-act="notiftest">Test senden</button>' : '<button class="btn" data-act="notifon">Aktivieren</button>'}</div>
    <div class="hint" style="margin-top:8px">Die App prüft beim Öffnen und solange sie läuft jede Minute. Auf Android (Chrome, installiert) zusätzlich im Hintergrund. ${ios ? 'Auf dem iPhone funktionieren Benachrichtigungen nur, wenn die App über „Teilen → Zum Home-Bildschirm“ installiert ist (iOS 16.4+).' : ''} Für zuverlässige Erinnerungen auch bei geschlossener App: Kalender-Export unten.</div></section>
  ${typeof aboCard === 'function' ? aboCard() : ''}
  ${typeof keyCard === 'function' ? keyCard() : ''}
  <section class="card"><h2>Kalender-Erinnerungen</h2><div class="hint">Exportiert alle Routinen als wiederkehrende Termine (mit Alarm) und alle datierten Einträge als Ganztagstermine (Alarm am Vortag). In Apple-/Google-Kalender importieren – dann erinnert dich dein Handy immer, auch ohne geöffnete App. Nach Änderungen neu exportieren.</div><div class="btns"><button class="btn" data-act="ics">Kalenderdatei (.ics) exportieren</button></div></section>
  <section class="card"><h2>App</h2>
    ${standalone ? '<div class="kv"><span>Installation</span><span>installiert ✓</span></div>' : installEvt ? '<div class="btns" style="margin-top:0"><button class="btn" data-act="install">Als App installieren</button></div>' : `<div class="hint">${ios ? 'Installieren: in Safari auf „Teilen“ tippen → „Zum Home-Bildschirm“.' : 'Installieren: im Browser-Menü „App installieren“ bzw. „Zum Startbildschirm hinzufügen“ wählen.'}</div>`}
    <label class="f" style="margin-top:8px">Design<select id="theme"><option value="auto">Automatisch</option><option value="light">Hell</option><option value="dark">Dunkel</option></select></label></section>
  <section class="card"><h2>Daten</h2><div class="hint">Alles wird nur lokal auf diesem Gerät gespeichert. Mach ab und zu ein Backup – damit kannst du auch auf ein anderes Gerät umziehen.</div>
    <div class="btns"><button class="btn" data-act="export">Backup exportieren</button><button class="btn ghost" data-act="import">Backup importieren</button></div>
    <div class="btns"><button class="btn warn" data-act="reset">Alle Daten löschen</button></div></section>`;
}

function render() {
  const t = H.today();
  $('date').textContent = new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const nd = dueRoutines(t).length;
  $('nav').innerHTML = TABS.map(([id, l]) => `<button class="${TAB === id ? 'on' : ''}" data-act="tab" data-v="${id}" ${TAB === id ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON[id]}</svg>${l}${(id === 'today' || id === 'routines') && nd ? `<span class="badge">${nd}</span>` : ''}</button>`).join('');
  document.querySelector('.top .icon-btn').classList.toggle('on', TAB === 'settings');
  let h;
  if (TAB === 'today') h = viewToday();
  else if (TAB === 'routines') h = viewRoutines();
  else if (TAB === 'settings') h = viewSettings();
  else if (TAB === 'chat') h = typeof viewChat === 'function' ? viewChat() : '';
  else h = (TAB === 'money' && typeof finView === 'function' ? finView() : '') + (TAB === 'files' && typeof knowView === 'function' ? knowView() + '<h2 class="sect">Ablage – deine Unterlagen</h2>' : '') + C.filter(c => c.tab === TAB && !(c.hideEmpty && !S.lists[c.k].length)).map(c => listCard(c)).join('') + (typeof docsCard === 'function' && TAB !== 'files' ? docsCard(TAB) : '');
  $('body').innerHTML = h;
  if (TAB === 'chat' && typeof scrollChat === 'function') scrollChat();
  if (TAB === 'settings') $('theme').value = S.settings.theme;
  if (S.settings.theme === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = S.settings.theme;
  try { if (navigator.setAppBadge) nd ? navigator.setAppBadge(nd) : navigator.clearAppBadge(); } catch (e) { /* egal */ }
}

/* ---------- Dialoge ---------- */
let dlgCancel = null;
function openDlg(html, onSubmit, onCancel) {
  const f = $('dlgf');
  f.innerHTML = html;
  dlgCancel = onCancel || null;
  f.onsubmit = e => {
    e.preventDefault();
    const v = e.submitter ? e.submitter.value : 'save', c = dlgCancel;
    dlgCancel = null;
    $('dlg').close();
    if (v !== 'cancel') onSubmit(v, f); else if (c) c();
  };
  $('dlg').showModal();
}
const dlgBtns = del => `<div class="btns"><button class="btn" value="save">Speichern</button>${del ? '<button class="btn warn" value="del" formnovalidate>Löschen</button>' : ''}<button class="btn ghost" value="cancel" formnovalidate>Abbrechen</button></div>`;

function editItem(k, id) {
  const c = listOf(k), it = S.lists[k].find(x => x.id === id);
  if (!c || !it) return;
  openDlg(`<h3>${esc(c.title)}</h3>
    <label class="f">Titel<input type="text" name="n" value="${esc(it.n)}" required></label>
    <label class="f">Notiz / Wert<textarea name="t">${esc(it.t)}</textarea></label>
    <div class="f2"><label class="f">Datum / Frist<input type="date" name="d" value="${esc(it.d)}"></label>
    ${c.st ? `<label class="f">Status<select name="s">${c.st.map((s, i) => `<option value="${i}" ${i === it.s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>` : ''}</div>
    ${dlgBtns(true)}`, (v, f) => {
    if (v === 'del') { askConfirm('„' + it.n + '“ löschen?', 'Löschen').then(ok => { if (ok) { S.lists[k] = S.lists[k].filter(x => x.id !== id); save('Gelöscht'); } }); return; }
    it.n = f.n.value.trim() || it.n; it.t = f.t.value.trim(); it.d = f.d.value;
    if (c.st) it.s = +f.s.value;
    save('Gespeichert');
  });
}

function editRoutine(id, freq) {
  const isNew = !id;
  const r = isNew ? { id: uid(), n: '', note: '', freq: freq || 'daily', every: 1, wd: 1, md: 1, time: '', start: H.today(), last: '', hist: [] } : S.routines.find(x => x.id === id);
  if (!r) return;
  const hist = (r.hist || []).slice(-8).reverse().map(H.fdy).join(', ');
  openDlg(`<h3>${isNew ? 'Neue Routine' : 'Routine bearbeiten'}</h3>
    ${r.claude ? `<div class="hint">Geplante Claude-Aufgabe: läuft ${esc(r.claude.run)}. Ergebnis: ${esc(r.claude.out)}. Hier änderst du nur deine Erinnerung – den Zeitplan der Claude-Aufgabe selbst stellst du in Claude um.</div>` : ''}
    <label class="f">Aufgabe<input type="text" name="n" value="${esc(r.n)}" required placeholder="z. B. Jobsuche"></label>
    <label class="f">${r.claude ? 'Was ist zu tun' : 'Notiz'}<input type="text" name="note" value="${esc(r.note)}" placeholder="optional"></label>
    <div class="f2"><label class="f">Rhythmus<select name="freq"><option value="daily">Täglich</option><option value="weekly">Wöchentlich</option><option value="monthly">Monatlich</option></select></label>
    <label class="f"><span id="evl">Alle … </span><input type="number" name="every" min="1" max="52" value="${+r.every || 1}"></label></div>
    <div class="f2"><label class="f" id="wdw">Wochentag<select name="wd">${[1, 2, 3, 4, 5, 6, 0].map(i => `<option value="${i}" ${+r.wd === i ? 'selected' : ''}>${H.WDL[i]}</option>`).join('')}</select></label>
    <label class="f" id="mdw">Tag im Monat<select name="md">${Array.from({ length: 28 }, (_, i) => i + 1).map(i => `<option value="${i}" ${+r.md === i ? 'selected' : ''}>${i}.</option>`).join('')}<option value="31" ${+r.md >= 29 ? 'selected' : ''}>Letzter Tag</option></select></label>
    <label class="f">Uhrzeit<input type="time" name="time" value="${esc(r.time)}"></label></div>
    <label class="f">Start ab<input type="date" name="start" value="${esc(r.start)}" required></label>
    ${hist ? `<div class="hint">Zuletzt erledigt: ${hist}</div>` : ''}
    ${dlgBtns(!isNew)}`, (v, f) => {
    if (v === 'del') { askConfirm('Routine „' + r.n + '“ löschen?', 'Löschen').then(ok => { if (ok) { S.routines = S.routines.filter(x => x.id !== r.id); save('Gelöscht'); } }); return; }
    Object.assign(r, { n: f.n.value.trim(), note: f.note.value.trim(), freq: f.freq.value, every: Math.max(1, +f.every.value || 1), wd: +f.wd.value, md: +f.md.value, time: f.time.value, start: f.start.value || H.today() });
    if (isNew) S.routines.push(r);
    save(isNew ? 'Routine angelegt' : 'Gespeichert');
  });
  const f = $('dlgf');
  f.freq.value = r.freq;
  const upd = () => {
    const fr = f.freq.value;
    $('wdw').hidden = fr !== 'weekly'; $('mdw').hidden = fr !== 'monthly';
    $('evl').textContent = 'Alle … ' + ({ daily: 'Tage', weekly: 'Wochen', monthly: 'Monate' }[fr]);
  };
  f.freq.onchange = upd; upd();
}

/* ---------- Benachrichtigungen ---------- */
function snapshot() {
  const dates = [];
  C.forEach(c => S.lists[c.k].forEach(it => { if (it.d && !isDone(c, it)) dates.push({ id: it.id, n: it.n, d: it.d, list: c.title }); }));
  return { notify: S.settings.notify, defTime: S.settings.defTime, routines: S.routines, dates };
}
async function syncData() {
  if (!self.caches) return;
  try { const c = await caches.open(H.DC); await c.put(H.DK, new Response(JSON.stringify(snapshot()), { headers: { 'content-type': 'application/json' } })); } catch (e) { /* z. B. file:// */ }
}
async function getReg() { if (!('serviceWorker' in navigator)) return null; try { return await navigator.serviceWorker.ready; } catch (e) { return null; } }
async function checkNotify() {
  if (!S.settings.notify || !('Notification' in self) || Notification.permission !== 'granted') return;
  const reg = await getReg();
  if (reg) { try { await H.notifyDue(reg); } catch (e) { /* egal */ } }
}
async function notifOn() {
  if (!('Notification' in self)) {
    return toast(/iphone|ipad/i.test(navigator.userAgent) ? 'Erst über „Teilen → Zum Home-Bildschirm“ installieren, dann hier aktivieren.' : 'Dieser Browser unterstützt keine Benachrichtigungen.');
  }
  const p = await Notification.requestPermission();
  if (p !== 'granted') { render(); return toast('Benachrichtigungen wurden nicht erlaubt.'); }
  S.settings.notify = true;
  save('Erinnerungen aktiv');
  const reg = await getReg();
  try {
    if (reg && reg.periodicSync) {
      const st = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (st.state === 'granted') await reg.periodicSync.register('lebenshub-check', { minInterval: 60 * 60 * 1000 });
    }
  } catch (e) { /* nicht unterstützt */ }
}
async function notifTest() {
  const reg = await getReg();
  const n = dueRoutines(H.today()).length;
  const body = n ? n + ' Routine(n) heute offen.' : 'Heute ist alles erledigt.';
  try { if (reg) await reg.showNotification('Lebenshub', { body, icon: 'icon-192.png', tag: 'test' }); else new Notification('Lebenshub', { body }); }
  catch (e) { toast('Test fehlgeschlagen: ' + e.message); }
}

/* ---------- Export ---------- */
function download(name, type, text) {
  if (ART.downloads) return artDownload(name, type, text);
  if (ART.on) return toast('Speichern ist hier nicht möglich.');
  const file = new File([text], name, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && /iphone|ipad|android/i.test(navigator.userAgent)) {
    navigator.share({ files: [file], title: name }).catch(() => {});
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function icsText() {
  const ix = s => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const fold = l => { const out = []; while (l.length > 60) { out.push(l.slice(0, 60)); l = ' ' + l.slice(60); } out.push(l); return out.join('\r\n'); };
  const now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const D = s => s.replace(/-/g, '');
  const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lebenshub//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Lebenshub'];
  const t = H.today();
  S.routines.forEach(r => {
    const first = H.nextOcc(r, H.add(t, -1));
    if (!first) return;
    const tm = (r.time || S.settings.defTime).replace(':', '');
    const ev = Math.max(1, +r.every || 1);
    let rr = 'RRULE:FREQ=' + { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY' }[r.freq] + ';INTERVAL=' + ev;
    if (r.freq === 'weekly') rr += ';BYDAY=' + BYDAY[+r.wd];
    if (r.freq === 'monthly') rr += ';BYMONTHDAY=' + (+r.md >= 29 ? -1 : +r.md);
    L.push('BEGIN:VEVENT', 'UID:' + r.id + '@lebenshub', 'DTSTAMP:' + now, 'DTSTART;TZID=Europe/Berlin:' + D(first) + 'T' + tm + '00', 'DURATION:PT15M', rr,
      fold('SUMMARY:' + ix(r.n)), fold('DESCRIPTION:' + ix((r.note ? r.note + ' – ' : '') + H.freqLabel(r) + ' (Lebenshub)')),
      'BEGIN:VALARM', 'ACTION:DISPLAY', fold('DESCRIPTION:' + ix(r.n)), 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT');
  });
  C.forEach(c => S.lists[c.k].forEach(it => {
    if (!it.d || it.d < t || isDone(c, it)) return;
    L.push('BEGIN:VEVENT', 'UID:' + it.id + '@lebenshub', 'DTSTAMP:' + now, 'DTSTART;VALUE=DATE:' + D(it.d), 'DTEND;VALUE=DATE:' + D(H.add(it.d, 1)),
      fold('SUMMARY:' + ix(it.n)), fold('DESCRIPTION:' + ix(c.title + (it.t ? ' – ' + it.t : ''))),
      'BEGIN:VALARM', 'ACTION:DISPLAY', fold('DESCRIPTION:' + ix(it.n)), 'TRIGGER:-PT15H', 'END:VALARM', 'END:VEVENT');
  }));
  L.push('END:VCALENDAR');
  return L.join('\r\n') + '\r\n';
}
function mergeData(d) {
  let n = 0;
  C.forEach(c => (d.lists[c.k] || []).forEach(it => {
    const L = S.lists[c.k], i = L.findIndex(x => x.id === it.id || x.n === it.n);
    if (i >= 0) L[i] = Object.assign({}, L[i], it, { id: L[i].id }); else { L.push(it); n++; }
  }));
  d.routines.forEach(r => {
    const i = S.routines.findIndex(x => x.id === r.id || (x.claude && r.claude && x.claude.key === r.claude.key) || x.n === r.n);
    if (i >= 0) S.routines[i] = Object.assign({}, r, { id: S.routines[i].id, last: S.routines[i].last || r.last, hist: S.routines[i].hist && S.routines[i].hist.length ? S.routines[i].hist : r.hist });
    else { S.routines.push(r); n++; }
  });
  return n;
}
function importBackup(file) {
  const rd = new FileReader();
  rd.onload = () => {
    let d;
    try { d = JSON.parse(rd.result); if (!d || !d.lists || !Array.isArray(d.routines)) throw new Error('kein Lebenshub-Backup'); }
    catch (e) { return toast('Import fehlgeschlagen: ' + e.message); }
    const replace = () => { const st = S.settings; S = d; S.settings = Object.assign({}, st); C.forEach(c => { if (!S.lists[c.k]) S.lists[c.k] = []; }); save('Daten ersetzt'); };
    if (isEmpty()) return replace();
    openDlg(`<h3>Daten importieren</h3><div class="hint"><b>Zusammenführen</b>: Neue Einträge kommen dazu, gleichnamige werden aktualisiert, deine Häkchen bleiben erhalten.<br><b>Ersetzen</b>: Alles auf diesem Gerät wird durch die Datei ersetzt.</div>
      <div class="btns"><button class="btn" value="merge">Zusammenführen</button><button class="btn warn" value="replace" formnovalidate>Ersetzen</button><button class="btn ghost" value="cancel" formnovalidate>Abbrechen</button></div>`, v => {
      if (v === 'replace') return replace();
      const n = mergeData(d); save(n + ' neue Einträge übernommen');
    });
  };
  rd.readAsText(file);
}

/* ---------- Ereignisse ---------- */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b) return;
  const { act, v, k, id } = b.dataset, t = H.today();
  const r = id && S.routines.find(x => x.id === id);
  switch (act) {
    case 'tab': TAB = v; try { sessionStorage.setItem(K + '-tab', v); } catch (er) { /* egal */ } render(); scrollTo(0, 0); break;
    case 'rdone': r.last = t; r.hist = (r.hist || []).filter(x => x !== t).concat(t).slice(-60); save('„' + r.n + '“ erledigt'); break;
    case 'rundo': r.hist = (r.hist || []).filter(x => x !== t); r.last = r.hist[r.hist.length - 1] || ''; save(); break;
    case 'redit': editRoutine(id); break;
    case 'rnew': editRoutine(null, v); break;
    case 'iedit': if (k) editItem(k, id); break;
    case 'cycle': { const c = listOf(k), it = S.lists[k].find(x => x.id === id); it.s = (it.s + 1) % c.st.length; save(); break; }
    case 'add': addItem(k); break;
    case 'notifon': notifOn(); break;
    case 'notifoff': S.settings.notify = false; save('Erinnerungen aus'); break;
    case 'notiftest': notifTest(); break;
    case 'ics': download('lebenshub.ics', 'text/calendar', icsText()); break;
    case 'export': download('lebenshub-backup-' + t + '.json', 'application/json', JSON.stringify(S, null, 1)); break;
    case 'import': $('importFile').click(); break;
    case 'reset': askConfirm(ART.db ? 'Wirklich alle Hub-Daten löschen – auf allen Geräten? Mach vorher ein Backup.' : 'Wirklich alle Daten auf diesem Gerät löschen? Mach vorher ein Backup.', 'Alles löschen').then(ok => { if (ok) { const st = S.settings; S = seed(); S.settings = st; save('Zurückgesetzt'); } }); break;
    default: if (typeof knowAct === 'function' && knowAct(act, b)) break; if (typeof finAct === 'function' && finAct(act, b)) break; if (typeof docAct === 'function' && docAct(act, b)) break; if (typeof chatAct === 'function') chatAct(act, b); break;
    case 'install': if (installEvt) { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; render(); }); } break;
  }
});
function addItem(k) {
  const c = listOf(k), inp = $('in-' + k), v = inp.value.trim();
  if (!v) return inp.focus();
  const d = c.date && $('dt-' + k) ? $('dt-' + k).value : '';
  S.lists[k].push({ id: uid(), n: v, s: 0, d, t: '' });
  save();
  const ni = $('in-' + k); if (ni) ni.focus();
}
document.addEventListener('focusin', e => { if (e.target.matches('input[type=text],input[type=password],textarea')) document.body.classList.add('kb'); });
document.addEventListener('focusout', () => setTimeout(() => { if (!document.activeElement || !document.activeElement.matches('input,textarea')) document.body.classList.remove('kb'); }, 50));
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.add) { e.preventDefault(); addItem(e.target.dataset.add); } });
document.addEventListener('input', e => {
  if (e.target.id !== 'hubq') return;
  HUBQ = e.target.value; const pos = e.target.selectionStart; render();
  const i = $('hubq'); if (i) { i.focus(); try { i.setSelectionRange(pos, pos); } catch (er) { /* egal */ } }
});
document.addEventListener('change', e => {
  if (e.target.id === 'defTime') { S.settings.defTime = e.target.value || '08:00'; save('Gespeichert'); }
  if (e.target.id === 'theme') { S.settings.theme = e.target.value; save(); }
  if (e.target.id === 'importFile' && e.target.files[0]) { importBackup(e.target.files[0]); e.target.value = ''; }
});
$('dlg').addEventListener('click', e => { if (e.target === $('dlg')) $('dlg').close(); });
$('dlg').addEventListener('close', () => { const c = dlgCancel; dlgCancel = null; if (c) c(); });
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (TAB === 'settings') render(); });

let lastDay = H.today();
function tick() { if (H.today() !== lastDay) { lastDay = H.today(); render(); } checkNotify(); }
document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); tick(); } });
setInterval(tick, 60 * 1000);

render();
if (typeof artInit === 'function') artInit();
if (typeof loadDocs === 'function') loadDocs().then(render);
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !window.claude) {
  const hadSw = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadSw) toast('Update geladen – App einmal schließen und neu öffnen.'); });
  navigator.serviceWorker.register('sw.js').then(() => syncData()).then(checkNotify).catch(() => {});
}
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* egal */ }
