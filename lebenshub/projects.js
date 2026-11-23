/* Lebenshub – Projekte (Bereiche Forschung und Arbeit) und Bewerbungs-Übersicht.
   S.projects = [{ id, tab: 'research'|'work', icon, title, sub, stage, goal, next, nextDate,
     links: [{ t, u }], items: { f: [ids], b: [ids], a: [ids], u: [ids], n: [ids], t: [ids] },
     re: 'Suchmuster für Termine/Schritte', tags: ['Wissens-Tags'], docs: 'Suchmuster für abgelegte Dokumente',
     facts: [['Label', 'Wert']] }]
   Daten kommen per Werkzeug set_project (Claude-Jobs, Odi) – im Code stehen keine persönlichen Inhalte.
   S.work.waitUntil = Datum, bis zu dem auf Bewerbungs-Rückmeldungen gewartet wird. */
'use strict';
const PJ_STAGES = ['Idee', 'Kontakt', 'Im Gespräch', 'Antrag/Angebot', 'Läuft', 'Pausiert'];
function projects(tab) { S.projects = Array.isArray(S.projects) ? S.projects : []; return tab ? S.projects.filter(p => p.tab === tab) : S.projects; }
function pjRe(p) { try { return p.re ? new RegExp(p.re, 'i') : null; } catch (e) { return null; } }
function pjItems(p, k) {
  const ids = (p.items && p.items[k]) || [], re = pjRe(p), L = (S.lists && S.lists[k]) || [];
  return L.filter(it => ids.includes(it.id) || (re && (k === 't' || k === 'n') && re.test(it.n + ' ' + (it.t || ''))));
}
function pjKnow(p) {
  const tags = (p.tags || []).map(t => String(t).toLowerCase()), re = pjRe(p);
  return (typeof know === 'function' ? know() : []).filter(k => (k.tags || []).some(t => tags.includes(String(t).toLowerCase())) || (re && re.test(k.title)));
}
function pjDocs(p) {
  if (!p.docs || typeof DOCS === 'undefined') return [];
  let re; try { re = new RegExp(p.docs, 'i'); } catch (e) { return []; }
  return DOCS.filter(d => re.test(d.name + ' ' + ((d.analysis && d.analysis.title) || '')));
}
function pjCard(p) {
  const t = H.today(), cAll = typeof C !== 'undefined' ? C : [];
  const term = pjItems(p, 't').filter(it => it.d && it.d >= t).sort((a, b) => a.d.localeCompare(b.d));
  const steps = pjItems(p, 'n').filter(it => it.s !== 1).sort((a, b) => (a.d || '9').localeCompare(b.d || '9'));
  const rel2 = d => typeof rel === 'function' ? rel(d, t) : d;
  const entries = ['f', 'b', 'a', 'u'].flatMap(k => { const c = cAll.find(x => x.k === k); return pjItems(p, k).map(it => ({ k, c, it })); });
  const K = pjKnow(p), withUrl = K.filter(k => /^https:\/\/claude\.ai\//.test(k.url || '')), D = pjDocs(p);
  const st = Math.max(0, PJ_STAGES.indexOf(p.stage));
  const links = (p.links || []).map(l => `<a class="pj-doc" href="${esc(l.u)}" target="_blank" rel="noopener">📄 ${esc(l.t)}</a>`)
    .concat(withUrl.filter(k => !(p.links || []).some(l => l.u === k.url)).slice(0, 6).map(k => `<a class="pj-doc" href="${esc(k.url)}" target="_blank" rel="noopener">📄 ${esc(k.title.replace(/\s*\(.*?\)\s*$/, '').slice(0, 60))}</a>`))
    .concat(D.slice(0, 6).map(d => `<button class="pj-doc up" data-act="dopen" data-id="${esc(d.id)}">📎 ${esc(((d.analysis && d.analysis.title) || d.name).slice(0, 50))}</button>`));
  return `<section class="card wide pj" data-pj="${esc(p.id)}">
    <div class="pj-h"><span class="pj-i">${esc(p.icon || '📁')}</span><div class="pj-t"><b>${esc(p.title)}</b>${p.sub ? `<small>${esc(p.sub)}</small>` : ''}<button class="chip pj-st" data-act="pjEdit" data-id="${esc(p.id)}">${esc(p.stage || 'Stand')} ✎</button></div></div>
    <div class="pj-steps">${PJ_STAGES.slice(0, 5).map((s, i) => `<i class="${i <= st && p.stage !== 'Pausiert' ? 'on' : ''}" title="${esc(s)}"></i>`).join('')}</div>
    ${p.goal ? `<p class="pj-goal">${esc(p.goal)}</p>` : ''}
    ${(p.facts || []).length ? `<div class="pj-facts">${p.facts.slice(0, 6).map(f => `<div><small>${esc(f[0])}</small><b>${esc(f[1])}</b></div>`).join('')}</div>` : ''}
    ${p.next || steps.length ? `<div class="pj-next"><b>Nächster Schritt</b>${p.next ? `<div>${esc(p.next)}${p.nextDate ? ` <span class="chip ${p.nextDate <= t ? 'due' : 'd'}">${rel2(p.nextDate)}</span>` : ''}</div>` : ''}${steps.slice(0, 3).map(it => `<button class="t" data-act="iedit" data-k="n" data-id="${esc(it.id)}">☐ ${esc(it.n)}${it.d ? ` <span class="chip ${it.d <= t ? 'due' : 'd'}">${rel2(it.d)}</span>` : ''}</button>`).join('')}</div>` : ''}
    ${term.length ? `<div class="pj-sec">Termine</div>${term.slice(0, 3).map(it => `<div class="row"><button class="t" data-act="iedit" data-k="t" data-id="${esc(it.id)}">${esc(it.n)}<small>${esc(H.fd(it.d))}</small></button>${typeof prepBtn === 'function' ? prepBtn(it, 't') : ''}<span class="chip ${it.d === t ? 'due' : 'd'}">${rel2(it.d)}</span></div>`).join('')}` : ''}
    ${links.length ? `<div class="pj-sec">Dokumente</div><div class="pj-docs">${links.join('')}</div>` : ''}
    ${entries.length ? `<div class="pj-sec">Kontakte & Einträge</div>${entries.map(({ k, c, it }) => `<div class="row"><button class="t" data-act="iedit" data-k="${k}" data-id="${esc(it.id)}">${esc(it.n)}${it.t ? `<small>${esc(it.t.slice(0, 160))}${it.t.length > 160 ? ' …' : ''}</small>` : ''}</button>${c && c.st ? `<span class="chip ${typeof stClass === 'function' ? stClass(c.st[it.s] || c.st[0]) : ''}">${esc(c.st[it.s] || c.st[0])}</span>` : ''}</div>`).join('')}` : ''}
    ${K.length ? `<div class="pj-sec">Wissen <small>${K.length}</small></div><div class="chips">${K.slice(0, 5).map(k => `<button class="chip d" data-act="kopen" data-id="${esc(k.id)}">${esc(k.title.slice(0, 48))}</button>`).join('')}</div>` : ''}
    <div class="btns"><button class="btn ghost" data-act="pjAsk" data-id="${esc(p.id)}">Mit Odi besprechen</button></div></section>`;
}
function pjEdit(id) {
  const p = projects().find(x => x.id === id); if (!p) return;
  openDlg(`<h3>${esc(p.title)}</h3>
    <label class="f">Stand<select name="stage">${PJ_STAGES.map(s => `<option ${s === p.stage ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
    <label class="f">Ziel<textarea name="goal">${esc(p.goal || '')}</textarea></label>
    <div class="f2"><label class="f">Nächster Schritt<input type="text" name="next" value="${esc(p.next || '')}"></label><label class="f">bis<input type="date" name="nextDate" value="${esc(p.nextDate || '')}"></label></div>
    ${typeof dlgBtns === 'function' ? dlgBtns(false) : '<div class="btns"><button class="btn" value="save">Speichern</button><button class="btn ghost" value="cancel" formnovalidate>Abbrechen</button></div>'}`, (v, f) => {
    p.stage = f.stage.value; p.goal = f.goal.value.trim(); p.next = f.next.value.trim(); p.nextDate = f.nextDate.value;
    save('Projekt gespeichert');
  });
}
function pjAct(act, b) {
  if (act === 'pjEdit') { pjEdit(b.dataset.id); return true; }
  if (act === 'pjAsk') {
    const p = projects().find(x => x.id === b.dataset.id); if (!p) return true;
    chatDraft = `Lass uns über mein Projekt „${p.title}“ sprechen (Stand: ${p.stage || '–'}). Ziel: ${p.goal || '–'}. Nächster Schritt: ${p.next || '–'}${p.nextDate ? ' bis ' + H.fd(p.nextDate) : ''}.\nFasse den aktuellen Stand aus meinem Hub zusammen und sag mir, was diese Woche am meisten bringt.`;
    TAB = 'chat'; try { sessionStorage.setItem(K + '-tab', 'chat'); } catch (e) { /* egal */ }
    render(); scrollTo(0, 0); toast('Im Odi-Feld – prüfen und absenden'); return true;
  }
  if (act === 'bwWait') {
    S.work = Object.assign({}, S.work || {}); S.work.waitUntil = b.dataset.v; save('Wartezeit gesetzt'); return true;
  }
  return false;
}
/* Bewerbungen: Übersicht nach Status mit Wartezeit */
function bwCard() {
  const L = (S.lists && S.lists.b) || [], c = (typeof C !== 'undefined' ? C : []).find(x => x.k === 'b');
  if (!c || !L.length) return '';
  const t = H.today(), W = (S.work && S.work.waitUntil) || '', by = i => L.filter(it => (it.s || 0) === i);
  const cols = [['📨', 1], ['📅', 2], ['🔎', 3], ['✕', 4], ['✎', 0]];
  const days = W ? Math.round((Date.parse(W) - Date.parse(t)) / 864e5) : null;
  const sent = L.length - by(0).length;
  return `<section class="card wide bw"><h2>💼 Bewerbungen<small>${sent} verschickt · ${by(4).length} ${by(4).length === 1 ? 'Absage' : 'Absagen'} · ${by(2).length} ${by(2).length === 1 ? 'Gespräch' : 'Gespräche'}</small></h2>
    <div class="bw-bar">${cols.filter(([, i]) => by(i).length).map(([, i]) => `<i class="s${i}" style="flex:${by(i).length}" title="${esc(c.st[i])}: ${by(i).length}"></i>`).join('')}</div>
    <div class="bw-leg">${cols.map(([ic, i]) => `<span><b>${by(i).length}</b> ${esc(c.st[i])}</span>`).join('')}</div>
    ${W ? `<div class="bw-wait${days <= 0 ? ' due' : ''}">${days > 0 ? `⏳ Abwarten bis <b>${esc(H.fd(W))}</b> – noch ${days} Tage. Danach bei allen ohne Antwort freundlich nachfassen.` : `⏰ Wartezeit vorbei (${esc(H.fd(W))}): jetzt bei allen ohne Antwort nachfassen.`}</div>`
      : `<div class="btns"><button class="btn ghost" data-act="bwWait" data-v="${H.add(t, 21)}">3 Wochen abwarten</button></div>`}
    ${by(2).length ? `<div class="pj-sec">Gespräche</div>${by(2).map(it => `<div class="row"><button class="t" data-act="iedit" data-k="b" data-id="${esc(it.id)}">${esc(it.n)}${it.d ? `<small>${esc(H.fd(it.d))}</small>` : ''}</button>${typeof prepBtn === 'function' ? prepBtn(Object.assign({}, it, { t: it.t || '' }), 'b') : ''}</div>`).join('')}` : ''}
    <details class="bw-all"><summary>Alle ${L.length} Bewerbungen</summary>${[2, 1, 3, 0, 4].map(i => by(i).map(it => `<div class="row"><button class="t" data-act="iedit" data-k="b" data-id="${esc(it.id)}">${esc(it.n)}${it.t ? `<small>${esc(it.t.slice(0, 120))}</small>` : ''}</button><button class="chip ${typeof stClass === 'function' ? stClass(c.st[i]) : ''}" data-act="cycle" data-k="b" data-id="${esc(it.id)}">${esc(c.st[i])}</button></div>`).join('')).join('')}</details></section>`;
}
/* Werkzeug für Claude-Jobs und Odi */
function projectTool(name, x) {
  if (name === 'set_bw_wait') { S.work = Object.assign({}, S.work || {}); S.work.waitUntil = /^\d{4}-\d{2}-\d{2}$/.test(x.date || '') ? x.date : ''; return { label: '⏳ Bewerbungen: abwarten bis ' + (S.work.waitUntil || '–'), result: 'gespeichert' }; }
  if (name !== 'set_project') return null;
  const P = projects(), title = String(x.title || '').trim();
  let p = P.find(y => (x.id && y.id === x.id) || (title && y.title.toLowerCase() === title.toLowerCase()));
  if (!p) { if (!title) throw new Error('title fehlt'); p = { id: x.id ? String(x.id).slice(0, 40) : uid(), title }; P.push(p); }
  ['tab', 'icon', 'title', 'sub', 'stage', 'goal', 'next', 'nextDate', 're', 'docs'].forEach(k => { if (x[k] != null) p[k] = String(x[k]).slice(0, k === 'goal' ? 600 : 200); });
  if (p.tab !== 'work') p.tab = 'research';
  if (Array.isArray(x.links)) p.links = x.links.filter(l => l && /^https:\/\//.test(l.u || '')).slice(0, 12).map(l => ({ t: String(l.t || 'Dokument').slice(0, 80), u: String(l.u).slice(0, 300) }));
  if (Array.isArray(x.tags)) p.tags = x.tags.map(String).slice(0, 12);
  if (Array.isArray(x.facts)) p.facts = x.facts.filter(f => Array.isArray(f) && f.length === 2).slice(0, 8).map(f => [String(f[0]).slice(0, 40), String(f[1]).slice(0, 80)]);
  if (x.items && typeof x.items === 'object') { p.items = {}; ['f', 'b', 'a', 'u', 'n', 't'].forEach(k => { if (Array.isArray(x.items[k])) p.items[k] = x.items[k].map(String).slice(0, 20); }); }
  if (x.order != null) p.order = +x.order || 0;
  P.sort((a, b) => (a.order || 0) - (b.order || 0));
  return { label: '📁 Projekt: ' + p.title, result: 'gespeichert, id=' + p.id };
}
const PROJECT_TOOLS = [{ name: 'set_project', description: 'Projekt im Bereich Forschung oder Arbeit anlegen/aktualisieren (Übersichtskarte mit Stand, Ziel, nächstem Schritt, Dokument-Links, verknüpften Einträgen und Wissens-Tags).',
  input_schema: { type: 'object', additionalProperties: false, required: ['title'], properties: {
    id: { type: 'string' }, title: { type: 'string' }, tab: { type: 'string', enum: ['research', 'work'] }, icon: { type: 'string' }, sub: { type: 'string' },
    stage: { type: 'string', enum: PJ_STAGES }, goal: { type: 'string' }, next: { type: 'string' }, nextDate: { type: 'string', description: 'JJJJ-MM-TT' },
    links: { type: 'array', items: { type: 'object', properties: { t: { type: 'string' }, u: { type: 'string' } } } },
    items: { type: 'object', description: 'verknüpfte Eintrags-IDs je Liste f, b, a, u, n, t' }, re: { type: 'string', description: 'Suchmuster für passende Termine/Schritte' },
    tags: { type: 'array', items: { type: 'string' } }, docs: { type: 'string', description: 'Suchmuster für abgelegte Dokumente' },
    facts: { type: 'array', items: { type: 'array', items: { type: 'string' } } }, order: { type: 'number' } } } },
  { name: 'set_bw_wait', description: 'Datum setzen, bis zu dem auf Bewerbungs-Rückmeldungen gewartet wird (leer = entfernen).', input_schema: { type: 'object', additionalProperties: false, properties: { date: { type: 'string', description: 'JJJJ-MM-TT' } } } }];
function projectsSnapshotText() { return JSON.stringify(projects().map(p => [p.tab, p.title, p.stage, p.next, p.nextDate])); }
function researchView() {
  const P = projects('research');
  return `<section class="card wide"><h2>🔬 Forschung<small>${P.length} Projekte</small></h2><div class="hint">Deine Forschungs- und Gründungsprojekte mit Stand, Dokumenten, Kontakten und Wissen. Stand per ✎ ändern.</div></section>`
    + (P.map(pjCard).join('') || '<section class="card wide"><div class="empty">Noch keine Projekte – frag Odi: „Lege meine Forschungsprojekte an“.</div></section>');
}
function workView() { return bwCard() + projects('work').map(pjCard).join(''); }
