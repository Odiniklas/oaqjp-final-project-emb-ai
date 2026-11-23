/* Lebenshub – App */
'use strict';
const H = self.LH;
const K = 'lebenshub-app-v1';
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

const ICON = {
  life: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
  cal: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  routines: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  work: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
  research: '<path d="M9 3h6M10 3v6l-5.5 9.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3"/><path d="M7.5 15h9"/>',
  money: '<path d="M18 7.5A6.5 6.5 0 1 0 18 16.5"/><path d="M4 10.5h9M4 13.5h9"/>',
  files: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  health: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>'
};
const TABS = [['today', 'Heute'], ['cal', 'Kalender'], ['chat', 'Odi'], ['routines', 'Routinen'], ['work', 'Arbeit'], ['research', 'Forschung'], ['money', 'Finanzen'], ['life', 'Leben'], ['health', 'Gesundheit'], ['files', 'Wissen']];
const BW = ['Entwurf', 'Versandt', 'Termin', 'Stand prüfen', 'Absage'];

/* Listen-Definitionen. Inhalte kommen per Import (Startdaten/Backup) oder werden in der App angelegt. */
const C = [
  { k: 't', tab: 'today', title: 'Termine', date: 1 },
  { k: 'n', tab: 'today', title: 'Nächste Schritte', st: ['Offen', 'Erledigt'], dn: 1, date: 1 },
  { k: 'f', tab: 'research', title: 'Forschung & Promotion – Kontakte', st: ['Offen', 'Im Gespräch', 'Zusage', 'Zurückgestellt'] },
  { k: 'b', tab: 'work', title: 'Bewerbungen', st: BW },
  { k: 'a', tab: 'work', title: 'Eigene Arbeit', st: ['Läuft', 'Geplant', 'Fertig'] },
  { k: 'u', tab: 'research', title: 'Startups & Ideen', st: ['Idee', 'Validierung', 'Zurückgestellt'] },
  { k: 'k', tab: 'money', hideEmpty: 1, title: 'Weitere Konten (Notizen)', date: 1, hint: 'Konto/Depot mit Stand im Feld „Notiz / Wert“, Datum = Stichtag. Keine IBAN oder Kontonummern.' },
  { k: 'z', tab: 'money', hideEmpty: 1, title: 'Fixkosten & Abos', date: 1, hint: 'Betrag und Rhythmus als Notiz, Datum = nächste Fälligkeit oder Kündigungsfrist.' },
  { k: 'g', tab: 'money-alt', title: 'Finanzen im Überblick (alt)', hint: 'Eigene Angaben, ohne Gewähr. Wert im Feld „Notiz / Wert“ eintragen.' },
  { k: 'i', tab: 'money', compact: 1, title: 'Startup-Beteiligungen', st: ['Beobachten', 'Prüfen', 'Investiert'] },
  { k: 'p', tab: 'money', compact: 1, title: 'Börse & Portfolio – Watchlist', st: ['Beobachten', 'Prüfen', 'Position'] },
  { k: 'h', tab: 'health', title: 'Gesundheitsdokumente', st: ['Abgelegt', 'Prüfen', 'Fehlt'], date: 1, hint: 'Nur Titel und Fristen, keine Befunde. Du wirst am Vortag erinnert.' },
  { k: 'x', tab: 'health', title: 'Verletzungen & Beschwerden', st: ['Akut', 'In Behandlung', 'Heilt', 'Ausgeheilt'], dn: 1, date: 1, hint: 'Was, seit wann, Behandlung/Arzt als Notiz. Datum = nächster Termin.' },
  { k: 'v', tab: 'life-alt', title: 'Versicherungen (alt)', st: ['Aktiv', 'Angebot', 'Prüfen'], date: 1, hint: 'Fälligkeit/Kündigungsfrist als Datum. Keine Policen-Nummern.' },
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
    C.filter(c => !/-alt$/.test(c.tab)).forEach(c => S.lists[c.k].forEach(it => { if ((it.n + ' ' + (it.t || '')).toLowerCase().includes(q)) hits.push(`<div class="row"><button class="t" data-act="iedit" data-k="${c.k}" data-id="${it.id}">${esc(it.n)}<small>${esc(c.title)}${it.t ? ' · ' + esc(it.t) : ''}</small></button>${c.st ? `<span class="chip ${stClass(c.st[it.s])}">${esc(c.st[it.s])}</span>` : ''}</div>`); }));
    S.routines.forEach(r => { if (r.n.toLowerCase().includes(q)) hits.push(`<div class="row"><button class="t" data-act="redit" data-id="${r.id}">${esc(r.n)}<small>Routine · ${esc(H.freqLabel(r))}</small></button></div>`); });
    (typeof DOCS !== 'undefined' ? DOCS : []).forEach(d => { const tt = (d.analysis && d.analysis.title) || d.name; if ((tt + ' ' + d.name).toLowerCase().includes(q)) hits.push(`<div class="row"><button class="t" data-act="dopen" data-id="${d.id}">${esc(tt)}<small>Dokument</small></button></div>`); });
    (S.know || []).forEach(k => { if ((k.title + ' ' + k.summary + ' ' + k.tags.join(' ')).toLowerCase().includes(q)) hits.push(`<div class="row"><button class="t" data-act="kopen" data-id="${k.id}">${esc(k.title)}<small>Wissen · ${esc(k.kind)}</small></button></div>`); });
    if (S.fin) S.fin.positions.forEach(p => { if ((p.name + ' ' + (p.isin || '')).toLowerCase().includes(q)) hits.push(`<div class="row"><button class="t" data-act="fpos" data-id="${p.id}">${esc(p.name)}<small>Depot-Position</small></button></div>`); });
    if (S.life && S.life.items) S.life.items.forEach(it => { if ((it.name + ' ' + (it.provider || '') + ' ' + (it.note || '')).toLowerCase().includes(q)) hits.push(`<div class="row"><button class="t" data-act="lifeEdit" data-id="${it.id}">${esc(it.name)}<small>Leben${it.cost ? ' · ' + eur(it.cost) : ''}${it.provider ? ' · ' + esc(it.provider) : ''}</small></button></div>`); });
    if (S.fin && S.fin.goals) S.fin.goals.forEach(g => { if ((g.name + ' ' + (g.note || '')).toLowerCase().includes(q)) hits.push(`<div class="row"><button class="t" data-act="fgoal" data-id="${g.id}">${esc(g.name)}<small>Ziel${g.target ? ' · ' + eur(g.target, 0) : ''}</small></button></div>`); });
    if (typeof TT !== 'undefined') TT.items.forEach(x => { if (x.t && (x.t + ' ' + (x.k || '') + ' ' + (x.n || '')).toLowerCase().includes(q)) hits.push(`<div class="row"><a class="t" href="https://www.tiktok.com/@/video/${x.v}" target="_blank" rel="noopener">${esc(x.t)}<small>TikTok${x.k ? ' · ' + esc(x.k) : ''}</small></a></div>`); });
    res = hits.slice(0, 40).join('') || '<div class="empty">Nichts gefunden.</div>';
  }
  const t = H.today(), hr = new Date().getHours(), greet = hr < 11 ? 'Guten Morgen' : hr < 18 ? 'Hallo' : 'Guten Abend';
  const open = dueRoutines(t).length, items = [];
  C.forEach(c => S.lists[c.k].forEach(it => { if (it.d && it.d >= t && !isDone(c, it)) items.push(it); }));
  items.sort((a, b) => a.d.localeCompare(b.d));
  const todayN = items.filter(it => it.d === t).length, next = items.find(it => it.d > t) || items[0];
  const name = (S.settings && S.settings.name) || '';
  const tile = (tab, n, l, warn) => `<button class="hero-t${warn ? ' warn' : ''}" data-act="tab" data-v="${tab}"><b>${n}</b><span>${l}</span></button>`;
  return `<section class="card wide hero search">
    <div class="hero-h"><div><div class="hero-g">${greet}${name ? ', ' + esc(name) : ''} 👋</div><div class="hero-s">${next ? 'Als Nächstes: ' + esc(next.n.slice(0, 60)) + ' · ' + rel(next.d, t) : 'Keine Termine in Sicht'}</div></div></div>
    <div class="hero-tiles">${tile('routines', open, open === 1 ? 'Routine offen' : 'Routinen offen', open)}${tile('cal', todayN, todayN === 1 ? 'Termin heute' : 'Termine heute')}${tile('chat', '💬', 'Odi fragen')}</div>
    <div class="hero-q"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" id="hubq" placeholder="Im Hub suchen …" value="${esc(HUBQ)}" autocomplete="off" enterkeyhint="search" aria-label="Im Hub suchen"><button class="hero-up" data-act="dup" aria-label="Dokumente hochladen"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg></button></div>${res}</section>`;
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

function upCard() {
  return `<button class="upbig" data-act="dup"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg><span>Dokumente hochladen<small>PDF, Fotos, Screenshots, Office, ZIP</small></span></button>`;
}
function glanceCard() {
  if (!S.fin || !S.fin.accounts || !S.fin.accounts.length || typeof finTotals !== 'function') return '';
  const t = finTotals(), pl = finPL(S.fin.positions), L = typeof life === 'function' ? life() : null, T = L ? lifeTotals() : null;
  const free = L && L.income != null ? L.income - T.month - (T.save || 0) : null, due = L ? lifeDue(30) : [], R = typeof pensCalc === 'function' ? pensCalc() : null;
  return `<section class="card"><h2><button class="t" data-act="tab" data-v="money">Geld & Leben</button><small>Kurzüberblick</small></h2>
    ${finKpis([['Vermögen', eur(t.total, 0)], pl.cost ? ['seit Kauf', (pl.abs >= 0 ? '+' : '−') + eur(Math.abs(pl.abs), 0), pl.abs >= 0 ? 'pos' : 'neg'] : null, free != null ? ['frei/Monat', eur(free, 0), free >= 0 ? 'pos' : 'neg'] : null, R ? ['Rente (heute)', eur(R.total, 0)] : null])}
    ${due.length ? `<div class="hint">Nächste Frist: <button class="chip due" data-act="lifeEdit" data-id="${due[0].id}">${esc(due[0].name)} · ${esc(H.fd(due[0].next))}</button></div>` : ''}</section>`;
}
/* Vorbereitung je Termin: it.prep = Link oder Titel eines Wissenseintrags; sonst Doc-Link aus der Notiz */
function prepOf(it) {
  if (!it) return null;
  const p = String(it.prep || '').trim();
  if (/^https:\/\//.test(p)) return { url: p };
  if (p) return { know: p };
  const m = String(it.t || '').match(/https:\/\/claude\.ai\/(?:code\/)?artifact\/[\w-]+/);
  return m ? { url: m[0] } : null;
}
function prepBtn(it, k) {
  const P = prepOf(it);
  if (P && P.url) return `<a class="prep-b" href="${esc(P.url)}" target="_blank" rel="noopener" aria-label="Vorbereitung öffnen" title="Vorbereitung öffnen">📄<span> Vorbereitung</span></a>`;
  if (P) return `<button class="prep-b" data-act="prepKnow" data-v="${esc(P.know)}" aria-label="Vorbereitung öffnen" title="Vorbereitung öffnen">📄<span> Vorbereitung</span></button>`;
  const t = H.today();
  if (k === 't' && it.d && it.d >= t && it.d <= H.add(t, 7) && !/physio|friseur|zahnreinigung/i.test(it.n)) return `<button class="prep-b ask" data-act="prepAsk" data-k="${k}" data-id="${esc(it.id)}" aria-label="Vorbereitung erstellen" title="Vorbereitung erstellen">＋📄<span> Vorbereitung</span></button>`;
  return '';
}
function prepAct(act, b) {
  if (act === 'prepKnow') {
    const v = b.dataset.v.toLowerCase(), k = (S.know || []).find(x => x.title.toLowerCase() === v) || (S.know || []).find(x => x.title.toLowerCase().includes(v));
    if (k && typeof editKnow === 'function') editKnow(k.id); else toast('Vorbereitung nicht gefunden');
    return true;
  }
  if (act === 'prepAsk') {
    const it = (S.lists[b.dataset.k] || []).find(x => x.id === b.dataset.id); if (!it) return true;
    chatDraft = `Bereite mich auf meinen Termin „${it.n}“ am ${H.fd(it.d)}${it.tm ? ' um ' + it.tm : ''} vor${it.t ? ' (Notiz: ' + it.t + ')' : ''}. Lege eine Vorbereitung als Wissenseintrag an (Ziel und Wunschergebnis, Hintergrund aus meinem Hub, wer dabei ist – nur Rolle und öffentliche Infos, meine Fragen, mögliche Gegenfragen mit Antwortideen, Ablauf, was ich mitnehme, rote Linien, Nachbereitung) und hänge sie an den Termin an.`;
    TAB = 'chat'; try { sessionStorage.setItem(K + '-tab', 'chat'); } catch (e) { /* egal */ }
    render(); scrollTo(0, 0); toast('Im Odi-Feld – prüfen und absenden'); return true;
  }
  return false;
}
function listCard(c, opts) {
  const o = opts || {};
  let L = S.lists[c.k].map((it, i) => Object.assign({}, it, { i }));
  if (c.date) L.sort((a, b) => (a.d || '9').localeCompare(b.d || '9'));
  if (c.dn) L.sort((a, b) => isDone(c, a) - isDone(c, b));
  const t = H.today();
  if (c.compact && L.length && L.every(it => !it.t && !it.d)) {
    const chips = L.map(it => `<button class="chip ${stClass(c.st[it.s] || c.st[0])}" data-act="iedit" data-k="${c.k}" data-id="${it.id}">${esc(it.n)}</button>`).join('');
    return `<section class="card"><h2>${c.title}<small>${L.length}</small></h2><div class="tags wrap">${chips}</div><div class="hint">Antippen zum Bearbeiten · Farbe = Status (${c.st.join(', ')})</div>
    <div class="add-row"><input type="text" id="in-${c.k}" data-add="${c.k}" placeholder="Neu …" enterkeyhint="done"><button class="btn" data-act="add" data-k="${c.k}" aria-label="Hinzufügen">+</button></div></section>`;
  }
  const rows = L.map(it => {
    const done = isDone(c, it);
    const late = it.d && it.d < t && !done;
    const date = it.d ? `<span class="chip ${late || it.d === t ? 'due' : 'd'}">${rel(it.d, t)}</span>` : '';
    const st = c.st ? `<button class="chip ${stClass(c.st[it.s] || c.st[0])}" data-act="cycle" data-k="${c.k}" data-id="${it.id}">${esc(c.st[it.s] || c.st[0])}</button>` : '';
    return `<div class="row ${done ? 'done' : ''}"><button class="t" data-act="iedit" data-k="${c.k}" data-id="${it.id}">${esc(it.n)}${it.t ? `<small>${esc(it.t)}</small>` : ''}</button>${done ? '' : prepBtn(it, c.k)}${date}${st}</div>`;
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
  let h = searchCard() + (typeof weatherCard === 'function' ? weatherCard() : '') + (typeof calTodayCard === 'function' ? calTodayCard() : '') + (typeof glanceCard === 'function' ? glanceCard() : '') + (typeof musicCard === 'function' ? musicCard() : '') + `<section class="card wide"><h2>Heute zu tun<small>${doneT.length} von ${total} erledigt</small></h2><div class="bar"><i style="width:${pct}%"></i></div>
    ${due.map(r => routineRow(r, t)).join('')}${doneT.map(r => routineRow(r, t)).join('')}
    ${!total ? '<div class="empty">Heute stehen keine Routinen an.</div>' : !due.length ? '<div class="empty">Alles erledigt. Gute Arbeit!</div>' : ''}</section>`;

  h += (typeof mailCard === 'function' ? mailCard() : '') + (typeof photoCard === 'function' ? photoCard() : '') + (typeof jobLogCard === 'function' ? jobLogCard() : '');
  // Demnächst: Datums-Einträge aller Listen + Routinen der nächsten 7 Tage
  const until = H.add(t, 14), up = [];
  C.forEach(c => S.lists[c.k].forEach(it => {
    if (!it.d || isDone(c, it) || it.d > until) return;
    if (it.d < t && !c.dn) return; // vergangene Termine nicht mehr zeigen
    up.push({ d: it.d, n: it.n, sub: c.title, k: c.k, id: it.id, it });
  }));
  S.routines.forEach(r => {
    const d = H.nextOcc(r, t);
    if (d && d <= H.add(t, 7) && r.freq !== 'daily') up.push({ d, n: r.n, sub: r.claude ? 'Claude-Aufgabe · ' + r.claude.run : 'Routine · ' + H.freqLabel(r), rid: r.id });
  });
  up.sort((a, b) => a.d.localeCompare(b.d));
  h += `<section class="card"><h2>Demnächst<small>14 Tage</small></h2>${up.map(x => `<div class="row"><button class="t" data-act="${x.rid ? 'redit' : 'iedit'}" data-id="${x.rid || x.id}" data-k="${x.k || ''}">${esc(x.n)}<small>${esc(x.sub)}</small></button>${x.it ? prepBtn(x.it, x.k) : ''}<span class="chip ${x.d <= t ? 'due' : 'd'}">${rel(x.d, t)}</span></div>`).join('') || '<div class="empty">Nichts geplant.</div>'}</section>`;
  h += C.filter(c => c.tab === 'today').map(c => listCard(c)).join('');
  if (!S.settings.notify && !ART.on) h += `<section class="card wide"><h2>Erinnerungen einschalten</h2><div class="hint">Lass dich benachrichtigen, wenn eine Routine fällig ist oder ein Termin ansteht.</div><div class="btns"><button class="btn" data-act="notifon">Benachrichtigungen aktivieren</button><button class="btn ghost" data-act="tab" data-v="settings">Mehr Optionen</button></div></section>`;
  return h;
}

/* Ergebnisse der Claude-Jobs je Job gruppiert (Routinen-Tab) */
let JOBOPEN = '';
const jobName = j => String(j.source || 'Claude-Job').replace(/^Claude\s*[–-]\s*/, '');
const jobWhen = at => { const d = new Date(at); if (isNaN(d)) return ''; const t = H.today(), ds = at.slice(0, 10); return (ds === t ? 'heute' : ds === H.add(t, -1) ? 'gestern' : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })) + ', ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); };
const JOB_RE = { themenbriefing: /themenbriefing|briefing/i, aktienradar: /aktienradar|aktienliste|radar-ampel/i, karriereradar: /karriere|promotion/i, startupradar: /startup|zukunftsradar/i };
function jobsFor(r) {
  const key = r.claude && r.claude.key, re = JOB_RE[key] || new RegExp((key || r.n.split(/\s+/)[0]).replace(/[^\wäöüß]/gi, ''), 'i');
  return (S.jobLog || []).filter(j => re.test(j.source)).sort((a, b) => String(b.at).localeCompare(String(a.at)));
}
function jobsCard() {
  const L = (S.jobLog || []).slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
  if (!L.length) return `<section class="card wide jobs"><h2>Was Claude für dich gemacht hat</h2><div class="empty">Noch keine Ergebnisse. Sobald ein Claude-Job gelaufen ist, siehst du hier, was er gefunden und geändert hat.</div></section>`;
  const G = [];
  L.forEach(j => { const n = jobName(j); let g = G.find(x => x.n === n); if (!g) G.push(g = { n, runs: [] }); g.runs.push(j); });
  const fb = j => typeof jobFbButtons === 'function' ? jobFbButtons(j, S.jobLog.indexOf(j)) : '';
  return `<section class="card wide jobs"><h2>Was Claude für dich gemacht hat<small>${G.length} Jobs · ${L.length} Läufe</small></h2>
    <div class="hint">Tippe auf einen Job: Du siehst, was beim letzten Lauf herauskam, welche Änderungen im Hub übernommen wurden und die früheren Läufe.</div>
    ${G.map(g => { const j = g.runs[0];
      return `<details class="job"${JOBOPEN === g.n ? ' open' : ''} data-job="${esc(g.n)}"><summary><span class="job-n"><b>${esc(g.n)}</b><small>${esc(jobWhen(j.at))}${g.runs.length > 1 ? ' · ' + g.runs.length + ' Läufe' : ''}${j.labels.length ? ' · ' + j.labels.length + (j.labels.length === 1 ? ' Änderung' : ' Änderungen') : ''}</small></span><span class="job-x">›</span></summary>
        <div class="job-b">${j.summary ? `<p>${esc(j.summary)}</p>` : ''}
          ${j.labels.length ? `<div class="job-h">Im Hub übernommen</div><ul class="acts">${j.labels.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
          <div class="job-f">${j.doc ? `<a class="btn ghost" href="${esc(j.doc)}" target="_blank" rel="noopener">Bericht öffnen</a>` : ''}<button class="btn ghost" data-act="jobAsk" data-v="${esc(g.n)}">Mit Odi besprechen</button>${fb(j)}</div>
          ${g.runs.length > 1 ? `<div class="job-h">Frühere Läufe</div>${g.runs.slice(1, 8).map(o => `<div class="job-o"><b>${esc(jobWhen(o.at))}</b> ${esc(o.summary.slice(0, 200))}${o.summary.length > 200 ? ' …' : ''}${o.labels.length ? `<small>${o.labels.length} ${o.labels.length === 1 ? 'Änderung' : 'Änderungen'}</small>` : ''}</div>`).join('')}` : ''}</div></details>`; }).join('')}</section>`;
}
function jobAct(act, b) {
  if (act === 'jobOpen') { JOBOPEN = b.dataset.v; render(); const d = document.querySelector('details.job[open]'); if (d) d.scrollIntoView({ behavior: 'smooth', block: 'start' }); return true; }
  if (act === 'jobAsk') {
    const g = (S.jobLog || []).filter(j => jobName(j) === b.dataset.v).sort((a, c) => String(c.at).localeCompare(String(a.at)))[0]; if (!g) return true;
    chatDraft = `Erkläre mir kurz das letzte Ergebnis von „${b.dataset.v}“ (${jobWhen(g.at)}) und was ich jetzt konkret tun sollte:\n\n${g.summary}\n\nÜbernommen: ${g.labels.join('; ')}`;
    TAB = 'chat'; try { sessionStorage.setItem(K + '-tab', 'chat'); } catch (e) { /* egal */ }
    render(); scrollTo(0, 0); toast('Im Odi-Feld – prüfen und absenden'); return true;
  }
  return false;
}
function viewRoutines() {
  const t = H.today();
  const cl = S.routines.filter(r => r.claude);
  let h = !cl.length ? '' : `<section class="card wide"><h2>Geplante Claude-Aufgaben<small>laufen automatisch</small></h2>
    <div class="hint">Claude führt diese Aufgaben zu den genannten Zeiten selbst aus und schickt dir das Ergebnis. Die App erinnert dich danach, es zu lesen und umzusetzen.</div>
    ${cl.map(r => {
      const nx = H.nextOcc(r, H.add(t, -1));
      const j = jobsFor(r)[0];
      return routineRow(r, t) + `<div class="cinfo"><span>Ergebnis: ${esc(r.claude.out)}</span><span>Nächster Lauf: ${nx ? rel(nx, t) : '—'}</span></div>`
        + (j ? `<button class="cres" data-act="jobOpen" data-v="${esc(jobName(j))}"><b>Zuletzt ${esc(jobWhen(j.at))}:</b> ${esc(j.summary.slice(0, 160))}${j.summary.length > 160 ? ' …' : ''}<span>Ergebnis ansehen ›</span></button>` : '<div class="cres none">Noch kein Ergebnis eingegangen.</div>');
    }).join('') || '<div class="empty">Keine.</div>'}</section>`;
  h += jobsCard();
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
  if (ART.on) return `${typeof odiCard === 'function' ? odiCard() : ''}${artSettingsCard()}
  <section class="card"><h2>Kalender-Erinnerungen</h2><div class="hint">Exportiert alle Routinen als wiederkehrende Termine (mit Alarm) und alle datierten Einträge als Ganztagstermine (Alarm am Vortag). In den iPhone-Kalender übernehmen – dann wirst du immer erinnert. Nach Änderungen neu exportieren.</div><div class="btns"><button class="btn" data-act="ics">Kalenderdatei (.ics) speichern</button></div></section>
  <section class="card"><h2>Design</h2><label class="f">Darstellung<select id="theme"><option value="auto">Automatisch</option><option value="light">Hell</option><option value="dark">Dunkel</option></select></label></section>
  <section class="card"><h2>Daten</h2><div class="hint">Dein Hub ist privat und nur für dich sichtbar. Backups enthalten Listen und Routinen, keine Dokumente.</div>
    <div class="btns"><button class="btn" data-act="export">Backup speichern</button><button class="btn ghost" data-act="import">Backup/Startdatei importieren</button></div>
    <div class="btns"><button class="btn warn" data-act="reset">Alle Daten löschen</button></div></section>`;
  return `${typeof odiCard === 'function' ? odiCard() : ''}<section class="card"><h2>Erinnerungen</h2>
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
  document.querySelector('.top [data-v=settings]').classList.toggle('on', TAB === 'settings');
  let h;
  if (TAB === 'today') h = viewToday();
  else if (TAB === 'routines') h = viewRoutines();
  else if (TAB === 'life') h = typeof lifeView === 'function' ? lifeView() : '';
  else if (TAB === 'cal') h = typeof calView === 'function' ? calView() : '';
  else if (TAB === 'settings') h = viewSettings();
  else if (TAB === 'chat') h = typeof viewChat === 'function' ? viewChat() : '';
  else h = (TAB === 'money' && typeof finView === 'function' ? finView() : '') + (TAB === 'money' && typeof radarCard === 'function' ? radarCard() : '') + (TAB === 'health' && typeof healthView === 'function' ? healthView() : '') + (TAB === 'work' && typeof workView === 'function' ? workView() : '') + (TAB === 'work' && typeof workCard === 'function' ? workCard() : '') + (TAB === 'research' && typeof researchView === 'function' ? researchView() : '') + (TAB === 'files' ? upCard() : '') + (TAB === 'files' && typeof brainView === 'function' ? brainView() : '') + (TAB === 'files' && typeof promptCard === 'function' ? promptCard() : '') + (TAB === 'files' && typeof ttCard === 'function' ? ttCard() : '') + (TAB === 'files' && typeof promoCard === 'function' ? promoCard() : '') + (TAB === 'files' && typeof knowView === 'function' ? knowView() + '<h2 class="sect">Ablage – deine Unterlagen</h2>' : '') + C.filter(c => c.tab === TAB && !(c.hideEmpty && !S.lists[c.k].length)).map(c => listCard(c)).join('') + (typeof docsCard === 'function' && TAB !== 'files' && TAB !== 'research' ? docsCard(TAB) : '');
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
    if (it.tm && typeof apptIcs === 'function') { const x = apptIcs([{ title: it.n, date: it.d, time: it.tm, end: it.te || '', note: c.title + (it.t ? ' – ' + it.t : '') }]).split('\r\n'); L.push(...x.slice(x.indexOf('BEGIN:VEVENT'), x.indexOf('END:VEVENT') + 1).map(l => /^UID:/.test(l) ? 'UID:' + it.id + '@lebenshub' : l)); return; }
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
    default: if (jobAct(act, b)) break; if (typeof pjAct === 'function' && pjAct(act, b)) break; if (prepAct(act, b)) break; if (typeof workAct === 'function' && workAct(act, b)) break; if (typeof radarAct === 'function' && radarAct(act, b)) break; if (typeof promptAct === 'function' && promptAct(act, b)) break; if (typeof researchAct === 'function' && researchAct(act, b)) break; if (typeof ttAct === 'function' && ttAct(act, b)) break; if (typeof lifeAct === 'function' && lifeAct(act, b)) break; if (typeof calAct === 'function' && calAct(act, b)) break; if (typeof brainAct === 'function' && brainAct(act, b)) break; if (typeof odiOrbAct === 'function' && odiOrbAct(act, b)) break; if (typeof photoAct === 'function' && photoAct(act, b)) break; if (typeof musicAct === 'function' && musicAct(act, b)) break; if (typeof odiAct === 'function' && odiAct(act, b)) break; if (typeof mailAct === 'function' && mailAct(act, b)) break; if (typeof healthAct === 'function' && healthAct(act, b)) break; if (typeof knowAct === 'function' && knowAct(act, b)) break; if (typeof finAct === 'function' && finAct(act, b)) break; if (typeof docAct === 'function' && docAct(act, b)) break; if (typeof chatAct === 'function') chatAct(act, b); break;
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
if (typeof odiWake === 'function') odiWake();
setTimeout(() => { if (!ART.db && typeof ttInit === 'function') ttInit(); }, 1500);
if (typeof artInit === 'function') artInit();
if (typeof loadDocs === 'function') loadDocs().then(render);
if ('serviceWorker' in navigator && location.protocol !== 'file:' && !window.claude) {
  const hadSw = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadSw) toast('Update geladen – App einmal schließen und neu öffnen.'); });
  navigator.serviceWorker.register('sw.js').then(() => syncData()).then(checkNotify).catch(() => {});
}
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* egal */ }

document.addEventListener('toggle', e => { const d = e.target; if (d && d.matches && d.matches('details.job')) { if (d.open) JOBOPEN = d.dataset.job; else if (JOBOPEN === d.dataset.job) JOBOPEN = ''; } }, true);

/* Sicherheit: Links nur zu http(s), mailto oder Seitenankern – schützt vor javascript:-Links in Daten von Jobs oder Mails */
(function () {
  const ok = /^(https?:|mailto:|#|\.?\/)/i;
  const fix = root => { if (!root || !root.querySelectorAll) return; root.querySelectorAll('a[href]').forEach(a => { if (!ok.test((a.getAttribute('href') || '').trim())) a.removeAttribute('href'); }); };
  try { new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) { if (n.tagName === 'A') fix(n.parentNode); else fix(n); } }))).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) { /* egal */ }
})();
