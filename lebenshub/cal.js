/* Lebenshub – Kalender: Monat + Agenda mit allen Terminen, datierten Einträgen, Routinen, Wetter und Apple-Kalender.
   Apple → Hub: iPhone-Kurzbefehl legt täglich „lebenshub-kalender.txt“ in Google Drive ab (Zeilen: Titel | Start | Ende | Ort | Kalender),
   der Hub liest sie beim Öffnen (Google-Drive-Connector). Hub → Apple: .ics nur mit neuen/geänderten Terminen (feste UID → kein Doppeln).
   S.cal = { apple:[{uid,title,d,tm,te,allDay,loc,cal}], appleAt, fileMod, sent:{itemId: signatur}, showRt } */
'use strict';
const CAL_WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const CAL_MON = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const CAL_COL = { t: '#0e7c66', apple: '#e0457b', rt: '#e67e22', item: '#2f8fdd' };
let calCur = null, calSel = null, calMode = 'month', calBusy = false;
function cal() { S.cal = Object.assign({ apple: [], appleAt: '', fileMod: '', sent: {}, showRt: true }, S.cal || {}); return S.cal; }
const calKey = (n, d) => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ') + '|' + d;
function calTimeOf(s) { const m = String(s).match(/\b(\d{1,2}):(\d{2})\b/) || String(s).match(/\b(\d{1,2})(?:[.:](\d{2}))?\s*Uhr\b/); if (!m || +m[1] > 23) return ''; return String(m[1]).padStart(2, '0') + ':' + (m[2] || '00'); }
const calSig = it => [it.n, it.d, it.tm || '', it.te || ''].join('|');

/* Alle Ereignisse eines Tages */
function calDay(d) {
  const out = [], K = cal(), apple = K.apple.filter(e => e.d === d), aKeys = new Set(apple.map(e => calKey(e.title, e.d)));
  apple.forEach(e => out.push({ kind: 'apple', title: e.title, tm: e.allDay ? '' : e.tm, te: e.allDay ? '' : e.te, loc: e.loc, sub: e.cal || 'Apple-Kalender', id: e.uid }));
  C.forEach(c => S.lists[c.k].forEach(it => {
    if (it.d !== d || isDone(c, it)) return;
    const inApple = aKeys.has(calKey(it.n, d));
    if (inApple) { const a = out.find(x => x.kind === 'apple' && calKey(x.title, d) === calKey(it.n, d)); if (a) { a.hub = { k: c.k, id: it.id }; a.it = it; a.sub += ' · im Hub'; } return; }
    out.push({ kind: c.k === 't' ? 't' : 'item', title: it.n, tm: it.tm || calTimeOf(it.n + ' ' + (it.t || '')), te: it.te || '', sub: c.title + (it.t && !/^\d{1,2}:\d{2}/.test(it.t) ? ' · ' + it.t : ''), k: c.k, id: it.id, it, sent: K.sent[it.id] === calSig(it) });
  }));
  if (typeof life === 'function') life().items.forEach(it => {
    if (it.status === 'gekündigt') return;
    const regular = it.status === 'aktiv' && ['monat', 'quartal', 'halbjahr', 'jahr'].includes(it.per) && !it.end;
    if (it.next === d && !regular) out.push({ kind: 'item', title: it.name, tm: '', sub: 'Leben · Frist' + (it.note ? ' · ' + it.note.slice(0, 60) : ''), id: it.id, life: 1 });
    if (it.end === d) out.push({ kind: 'item', title: it.name + ' – endet', tm: '', sub: 'Leben · Vertragsende', id: it.id, life: 1 });
  });
  if (S.fin && S.fin.goals) S.fin.goals.forEach(g => { if (g.date === d) out.push({ kind: 'item', title: 'Ziel: ' + g.name, tm: '', sub: 'Finanzen · Zieltermin', id: g.id, goal: 1 }); });
  if (K.showRt) S.routines.forEach(r => { if (H.isOcc(r, d)) out.push({ kind: 'rt', title: r.n, tm: r.time || '', sub: 'Routine · ' + H.freqLabel(r), id: r.id, done: r.last === d }); });
  return out.sort((a, b) => (a.tm || '99:99').localeCompare(b.tm || '99:99') || a.title.localeCompare(b.title));
}
function calWx(d) { const W = S.weather, x = W && W.days && W.days.find(y => y.d === d); if (!x) return ''; const s = (x.desc || '').toLowerCase(); return (/gewitter/.test(s) ? '⛈' : /schnee/.test(s) ? '🌨' : /regen|schauer/.test(s) || x.rain >= 60 ? '🌧' : /sonn|klar/.test(s) ? '☀️' : /wolk|bewölkt|bedeckt/.test(s) ? '☁️' : '🌤') + (x.tmax != null ? ' ' + Math.round(x.tmax) + '°' : ''); }

function calGrid() {
  const t = H.today(), cur = calCur, [y, m] = cur.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)), off = (first.getUTCDay() + 6) % 7, start = H.add(cur, -off);
  let h = `<div class="cal-grid">${CAL_WD.map(w => `<div class="cal-wd">${w}</div>`).join('')}`;
  for (let i = 0; i < 42; i++) {
    const d = H.add(start, i), inM = +d.slice(5, 7) === m, ev = calDay(d), cls = ['cal-d', inM ? '' : 'out', d === t ? 'today' : '', d === calSel ? 'sel' : ''].join(' ');
    if (i % 7 === 0 && i >= 28 && !inM && d > cur) break;
    h += `<button class="${cls}" data-act="cday" data-v="${d}"><span class="n">${+d.slice(8)}</span><span class="dots">${ev.slice(0, 4).map(e => `<i style="background:${CAL_COL[e.kind === 'item' ? 'item' : e.kind]}"></i>`).join('')}</span></button>`;
  }
  return h + '</div>';
}
function calRow(e) {
  const tm = e.tm ? `<b>${esc(e.tm)}</b>${e.te ? '<small>' + esc(e.te) + '</small>' : ''}` : '<small>ganztags</small>';
  const act = e.life ? `data-act="lifeEdit" data-id="${e.id}"` : e.goal ? `data-act="fgoal" data-id="${e.id}"` : e.kind === 'apple' ? (e.hub ? `data-act="cedit" data-k="${e.hub.k}" data-id="${e.hub.id}"` : '') : e.kind === 'rt' ? `data-act="redit" data-id="${e.id}"` : `data-act="cedit" data-k="${e.k}" data-id="${e.id}"`;
  return `<div class="cal-ev ${e.kind}${e.done ? ' done' : ''}"><span class="cal-tm">${tm}</span><span class="cal-bar" style="background:${CAL_COL[e.kind === 'item' ? 'item' : e.kind]}"></span><button class="t" ${act}>${esc(e.title)}<small>${esc(e.sub || '')}${e.loc ? ' · ' + esc(e.loc) : ''}${e.kind === 't' || e.kind === 'item' ? (e.sent ? ' · ✓ Apple' : '') : ''}</small></button>${e.it && typeof prepBtn === 'function' ? prepBtn(e.it, e.k || (e.hub && e.hub.k)) : ''}</div>`;
}
function calDayBlock(d, head) {
  const ev = calDay(d), wx = calWx(d);
  return `${head ? `<h3 class="cal-h">${esc(H.fd(d))}${d === H.today() ? ' · heute' : ''}${wx ? ' <span class="cal-wx">' + wx + '</span>' : ''}</h3>` : ''}${ev.map(calRow).join('') || (head ? '' : '<div class="empty">Nichts eingetragen.</div>')}`;
}
function calView() {
  const K = cal(), t = H.today();
  if (!calCur) calCur = t.slice(0, 8) + '01';
  if (!calSel) calSel = t;
  const [y, m] = calCur.split('-').map(Number), pend = calPending();
  let body;
  if (calMode === 'month') body = calGrid() + `<div class="cal-day"><h3 class="cal-h">${esc(H.fd(calSel))}${calWx(calSel) ? ' <span class="cal-wx">' + calWx(calSel) + '</span>' : ''}</h3>${calDayBlock(calSel)}</div>`;
  else { let h = ''; for (let i = 0; i < 30; i++) { const d = H.add(t, i); if (calDay(d).length) h += calDayBlock(d, true); } body = h || '<div class="empty">In den nächsten 30 Tagen steht nichts an.</div>'; }
  const ago = K.appleAt ? Math.round((Date.now() - Date.parse(K.appleAt)) / 36e5) : null;
  return `<section class="card wide calc"><h2><span>${calMode === 'month' ? CAL_MON[m - 1] + ' ' + y : 'Nächste 30 Tage'}</span><small class="chips">
      ${calMode === 'month' ? '<button class="chip d" data-act="cnav" data-v="-1" aria-label="Vorheriger Monat">‹</button><button class="chip d" data-act="cnav" data-v="0">Heute</button><button class="chip d" data-act="cnav" data-v="1" aria-label="Nächster Monat">›</button>' : ''}
      <button class="chip ${calMode === 'agenda' ? '' : 'd'}" data-act="cmode">${calMode === 'month' ? 'Liste' : 'Monat'}</button></small></h2>
    ${body}
    <div class="btns"><button class="btn" data-act="cnew">+ Termin</button><button class="btn ghost" data-act="photos">Termine aus Fotos</button></div>
    <div class="cal-leg"><span><i style="background:${CAL_COL.t}"></i>Termin</span><span><i style="background:${CAL_COL.apple}"></i>Apple-Kalender</span><span><i style="background:${CAL_COL.item}"></i>Frist/Eintrag</span><span><i style="background:${CAL_COL.rt}"></i>Routine</span>
      <label><input type="checkbox" id="calRt" ${K.showRt ? 'checked' : ''}> Routinen zeigen</label></div></section>
  <section class="card"><h2>Abgleich mit Apple-Kalender</h2>
    <div class="row"><div class="t">Apple → Hub<small>${K.apple.length ? K.apple.length + ' Termine · Stand ' + (ago != null ? (ago < 1 ? 'gerade eben' : 'vor ' + ago + ' Std.') : '–') : 'noch nicht verbunden'}</small></div>${ART.mcp ? `<button class="chip" data-act="csync" ${calBusy ? 'disabled' : ''}>${calBusy ? '…' : 'Abgleichen'}</button>` : ''}</div>
    <div class="row"><div class="t">Hub → Apple<small>${pend.length ? pend.length + ' neue/geänderte Termine noch nicht im Apple-Kalender' : 'alles übertragen'}</small></div>${pend.length ? `<button class="chip" data-act="cpush">An Apple senden</button>` : ''}</div>
    <div class="hint">Apple → Hub läuft automatisch über den Kurzbefehl „Lebenshub Kalender“ (Anleitung im Code: ANLEITUNG-KALENDER.md). „An Apple senden“ erstellt eine Kalenderdatei nur mit Neuem – antippen, „Alle hinzufügen“.</div></section>`;
}
/* Neue/geänderte Hub-Termine (Liste Termine + alle datierten Einträge mit Uhrzeit), die noch nicht in Apple sind */
function calPending() {
  const K = cal(), t = H.today(), aKeys = new Set(K.apple.map(e => calKey(e.title, e.d))), out = [];
  C.forEach(c => S.lists[c.k].forEach(it => { if (!it.d || it.d < t || isDone(c, it)) return; if (c.k !== 't' && !it.tm && !calTimeOf(it.n + ' ' + (it.t || ''))) return; if (aKeys.has(calKey(it.n, it.d))) return; if (K.sent[it.id] === calSig(it)) return; out.push({ c, it }); }));
  return out;
}
function calPush() {
  const P = calPending(); if (!P.length) return toast('Alles schon im Apple-Kalender.');
  const ics = apptIcs(P.map(({ c, it }) => ({ uid: it.id, title: it.n, date: it.d, time: it.tm || calTimeOf(it.n + ' ' + (it.t || '')), end: it.te || '', note: c.title + (it.t ? ' – ' + it.t : '') })));
  P.forEach(({ it }) => { cal().sent[it.id] = calSig(it); });
  save(); download('lebenshub-neu.ics', 'text/calendar', ics);
}
/* Termin anlegen/bearbeiten */
function calEdit(k, id, date) {
  const L = S.lists[k || 't'], it = id ? L.find(x => x.id === id) : null, c = C.find(x => x.k === (k || 't'));
  if (k && k !== 't' && it) return editItem(k, id);
  const v = it || { n: '', d: date || calSel || H.today(), tm: '', te: '', t: '' };
  const note = String(v.t || '').replace(/^\d{1,2}:\d{2}(–\d{1,2}:\d{2})? Uhr( · )?/, '');
  openDlg(`<h3>${it ? 'Termin bearbeiten' : 'Neuer Termin'}</h3>
    <label class="f">Titel<input name="n" required value="${esc(v.n)}" placeholder="z. B. Physiotherapie"></label>
    <div class="f2"><label class="f">Datum<input type="date" name="d" required value="${esc(v.d)}"></label><label class="f">Beginn<input type="time" name="tm" value="${esc(v.tm || '')}"></label></div>
    <div class="f2"><label class="f">Ende<input type="time" name="te" value="${esc(v.te || '')}"></label><label class="f">Ort / Notiz<input name="t" value="${esc(note)}"></label></div>
    <label class="f"><span><input type="checkbox" name="ap" checked> gleich in den Apple-Kalender übernehmen</span></label>
    <div class="btns"><button class="btn" value="go">Speichern</button>${it ? '<button class="btn ghost" value="del" formnovalidate>Löschen</button>' : ''}<button class="btn ghost" value="cancel" formnovalidate>Abbrechen</button></div>`, (val, f) => {
    if (val === 'del') { S.lists.t = S.lists.t.filter(x => x.id !== it.id); return save('Termin gelöscht'); }
    const x = it || { id: uid(), s: 0 };
    x.n = f.n.value.trim(); x.d = f.d.value; x.tm = f.tm.value || ''; x.te = f.te.value || '';
    x.t = [x.tm ? x.tm + (x.te ? '–' + x.te : '') + ' Uhr' : '', f.t.value.trim()].filter(Boolean).join(' · ');
    if (!it) S.lists.t.push(x);
    calSel = x.d; calCur = x.d.slice(0, 8) + '01';
    if (f.ap.checked) { cal().sent[x.id] = calSig(x); download('termin.ics', 'text/calendar', apptIcs([{ uid: x.id, title: x.n, date: x.d, time: x.tm, end: x.te, note: f.t.value.trim() }])); }
    save(it ? 'Termin geändert' : 'Termin eingetragen');
  });
}
/* Apple-Kalender aus Google Drive lesen */
function calParse(txt) {
  const out = [];
  String(txt).split(/\r?\n/).forEach(line => {
    const p = line.split('|').map(s => s.trim()); if (p.length < 2 || !p[0]) return;
    const m1 = p[1].match(/(\d{4}-\d{2}-\d{2})(?:[ T](\d{1,2}:\d{2}))?/) || p[1].match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:,?\s*(\d{1,2}:\d{2}))?/);
    if (!m1) return;
    const d = m1[0].includes('-') ? m1[1] : `${m1[3]}-${m1[2].padStart(2, '0')}-${m1[1].padStart(2, '0')}`, tm = (m1[0].includes('-') ? m1[2] : m1[4]) || '';
    const m2 = (p[2] || '').match(/(\d{1,2}:\d{2})/), te = m2 ? m2[1] : '';
    const allDay = /ganzt|all.?day|ja|true/i.test(p[5] || '') || ((!tm || tm === '00:00') && (!te || te === '00:00' || te === '23:59'));
    out.push({ uid: calKey(p[0], d) + '|' + tm, title: p[0].slice(0, 120), d, tm: allDay ? '' : tm.padStart(5, '0'), te: allDay ? '' : te.padStart(5, '0'), allDay, loc: (p[3] || '').slice(0, 120), cal: (p[4] || '').slice(0, 40) });
  });
  return out.filter((e, i, a) => a.findIndex(x => x.uid === e.uid) === i);
}
async function calSync(manual) {
  const mcp = ART.mcp;
  if (!mcp) { if (manual) toast('Google Drive ist hier nicht verfügbar – bitte den Lebenshub in Claude öffnen.'); return; }
  if (calBusy) return; calBusy = true; if (manual) render();
  try {
    const r = await mcp.callTool(DRIVE, 'search_files', { query: "title contains 'lebenshub-kalender' and trashed = false", orderBy: 'modifiedTime desc', pageSize: 3, excludeContentSnippets: true }, { cache: false });
    const files = collect(r.payload != null ? r.payload : r, (o, out) => { const t = o.title || o.name; if (o.id && t && /lebenshub-kalender/i.test(t)) out.push({ id: String(o.id), mod: o.modifiedTime || '' }); }, []);
    if (!files.length) { if (manual) toast('Noch keine Datei „lebenshub-kalender.txt“ in Google Drive – Kurzbefehl einrichten (ANLEITUNG-KALENDER.md).'); return; }
    const f = files.sort((a, b) => b.mod.localeCompare(a.mod))[0], K = cal();
    if (!manual && K.fileMod === f.mod) return;
    const c = await mcp.callTool(DRIVE, 'read_file_content', { fileId: f.id }, { cache: false });
    const txt = collect(c, (o, out) => { Object.keys(o).forEach(k => { if (typeof o[k] === 'string' && o[k].includes('|')) out.push(o[k]); }); }, []).join('\n');
    const ev = calParse(txt);
    K.apple = ev; K.appleAt = new Date().toISOString(); K.fileMod = f.mod;
    save(manual ? ev.length + ' Termine aus dem Apple-Kalender übernommen' : undefined);
  } catch (e) {
    const code = e && e.code;
    if (manual || code === 'needs_reauth') toast(code === 'needs_reauth' ? 'Google Drive bitte in den Claude-Einstellungen neu verbinden.' : code === 'server_not_connected' ? 'Google Drive ist in Claude nicht verbunden.' : 'Abgleich nicht möglich (' + (code || e.message || '?') + ').');
  } finally { calBusy = false; render(); }
}
function calAuto() { const K = cal(); if (ART.mcp && (!K.appleAt || Date.now() - Date.parse(K.appleAt) > 3 * 36e5)) calSync(false); }
/* Kurzüberblick für „Heute“ */
function calTodayCard() {
  const t = H.today(), ev = calDay(t).filter(e => e.kind !== 'rt'), tm = calDay(H.add(t, 1)).filter(e => e.kind !== 'rt');
  if (!ev.length && !tm.length) return '';
  return `<section class="card"><h2><button class="t" data-act="tab" data-v="cal">Kalender</button><small>heute ${ev.length} · morgen ${tm.length}</small></h2>${ev.map(calRow).join('') || '<div class="empty">Heute keine Termine.</div>'}${tm.length ? '<h3 class="cal-h">Morgen</h3>' + tm.slice(0, 4).map(calRow).join('') : ''}</section>`;
}
function calSnapshotText() { const t = H.today(), o = {}; for (let i = 0; i < 14; i++) { const d = H.add(t, i), ev = calDay(d).filter(e => e.kind !== 'rt'); if (ev.length) o[d] = ev.map(e => (e.tm ? e.tm + ' ' : '') + e.title + (e.kind === 'apple' ? ' (Apple)' : '')); } return JSON.stringify(o); }
function calAct(act, b) {
  if (act === 'cday') { calSel = b.dataset.v; if (calSel.slice(0, 7) !== calCur.slice(0, 7)) calCur = calSel.slice(0, 8) + '01'; render(); return true; }
  if (act === 'cnav') { const v = +b.dataset.v; if (!v) { calCur = H.today().slice(0, 8) + '01'; calSel = H.today(); } else { const [y, m] = calCur.split('-').map(Number), dt = new Date(Date.UTC(y, m - 1 + v, 1)); calCur = dt.toISOString().slice(0, 10); } render(); return true; }
  if (act === 'cmode') { calMode = calMode === 'month' ? 'agenda' : 'month'; render(); return true; }
  if (act === 'cnew') { calEdit(null, null, calSel); return true; }
  if (act === 'cedit') { calEdit(b.dataset.k, b.dataset.id); return true; }
  if (act === 'csync') { calSync(true); return true; }
  if (act === 'cpush') { calPush(); return true; }
  return false;
}
document.addEventListener('change', e => { if (e.target.id === 'calRt') { cal().showRt = e.target.checked; save(); } });
