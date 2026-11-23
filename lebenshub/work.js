/* Lebenshub – Arbeitskontexte & Hightech-Ideen (Bereich Arbeit).
   Zeigt je Arbeitskontext die öffentlichen Treiber, die passenden Einträge aus „Eigene Arbeit“ und die Ideen
   aus dem Wissen (Tags „Hightech-Idee“ + Kontext-Tag). Eine Idee kann als Pilot markiert (S.work.pilot),
   mit Odi als 1-Seiter ausgearbeitet oder als nächster Schritt übernommen werden. Nur öffentliche Quellen –
   interne Daten erst nach Freigabe. */
'use strict';
const WK_CTX = [
  { tag: 'iMSys', icon: '📡', name: 'iMSys & CLS-/Steuerbox-Management', re: /imsys|cls|gateway/i,
    drv: ['MsbG-Novelle seit 25.02.2025, gesetzliche Rolloutquoten', 'Steuerbox-Rollout für § 14a ab 2026 (FNN-Steuerbox, EEBUS)', 'Niederspannung wird über Smart-Meter-Daten beobachtbar'] },
  { tag: 'SLP', icon: '📈', name: 'SLP-Abrechnung & Netznutzung', re: /slp|netznutzung|lastprofil/i,
    drv: ['BDEW-Standardlastprofile 2025 – Umstellung freiwillig, Wirkung vorher testen', '24-h-Lieferantenwechsel und MaBiS-Hub erhöhen den Klärfall-Druck', 'Netzentgelt-Änderung 2027'] },
  { tag: 'MOSB', icon: '🧾', name: 'MOSB- & Steuerbox-Abrechnung', re: /mosb|steuerbox|messstellenbetrieb/i,
    drv: ['Preisobergrenzen je Zählpunkt (§§ 30, 35 MsbG), eigene POG für Steuerungseinrichtungen', '§ 14a Modul 1/2/3 – Modul 3 mit zeitvariablen Netzentgelten', 'Stammdaten Zählpunkt → Gerät → Steuerbox → Rechnung müssen zusammenpassen'] }
];
let WK_OPEN = '';
function wkState() { S.work = Object.assign({ pilot: '' }, S.work || {}); return S.work; }
function wkHas(k, t) { return (k.tags || []).some(x => String(x).toLowerCase() === t.toLowerCase()); }
function wkIdeas(tag) { return (typeof know === 'function' ? know() : []).filter(k => wkHas(k, 'Hightech-Idee') && wkHas(k, tag) && !/^Arbeitskontexte/.test(k.title)); }
const wkTitle = k => String(k.title || '').replace(/^Hightech-Idee · /, '');
function workCard() {
  const W = wkState(), all = (typeof know === 'function' ? know() : []).filter(k => wkHas(k, 'Hightech-Idee'));
  const pilot = all.find(k => k.id === W.pilot), map = all.find(k => /^Arbeitskontexte/.test(k.title));
  const own = (S.lists && S.lists.a) || [];
  const ctx = WK_CTX.map(c => {
    const ideas = wkIdeas(c.tag), items = own.filter(it => c.re.test(it.n)), open = WK_OPEN === c.tag;
    return `<div class="wk-ctx${open ? ' open' : ''}"><button class="wk-h" data-act="wkCtx" data-v="${c.tag}"><span class="wk-i">${c.icon}</span><b>${esc(c.name)}</b><span class="chip d">${ideas.length} Ideen</span></button>
      ${open ? `<ul class="wk-drv">${c.drv.map(d => `<li>${esc(d)}</li>`).join('')}</ul>
      ${items.length ? `<div class="chips">${items.map(it => `<button class="chip" data-act="wkItem" data-id="${esc(it.id)}">✎ ${esc(it.n)}</button>`).join('')}</div>` : ''}
      ${ideas.map(k => `<div class="row wk-idea"><button class="t" data-act="wkKnow" data-id="${esc(k.id)}">${W.pilot === k.id ? '⭐ ' : ''}${esc(wkTitle(k))}<small>${esc(String(k.summary || '').slice(0, 140))}${String(k.summary || '').length > 140 ? ' …' : ''}</small></button>
        <span class="wk-b"><button class="chip" data-act="wkOdi" data-id="${esc(k.id)}" aria-label="Mit Odi ausarbeiten">1-Seiter</button><button class="chip${W.pilot === k.id ? ' on' : ''}" data-act="wkPilot" data-id="${esc(k.id)}" aria-label="Als Pilot wählen">⭐</button></span></div>`).join('') || '<div class="empty">Noch keine Ideen – frag Odi: „Hightech-Ideen für ' + esc(c.name) + '“.</div>'}` : ''}</div>`;
  }).join('');
  return `<section class="card wide work"><h2>🛠 Arbeitskontexte & Hightech<small>${all.length - (map ? 1 : 0)} Ideen${pilot ? ' · Pilot gewählt' : ''}</small></h2>
    ${pilot ? `<div class="wk-pilot"><b>⭐ Pilot:</b> ${esc(wkTitle(pilot))}<div class="hint">4-Wochen-Test: Woche 1 Problem und KPI festlegen · Woche 2 Daten (nur freigegeben) · Woche 3 Prototyp · Woche 4 Ergebnis und Entscheidung.</div>
      <div class="btns"><button class="btn" data-act="wkOdi" data-id="${esc(pilot.id)}">1-Seiter mit Odi</button><button class="btn ghost" data-act="wkStep" data-id="${esc(pilot.id)}">→ Nächster Schritt</button></div></div>` : '<div class="hint">Wähle mit ⭐ eine Idee als Pilot – klein, messbar, gut erklärbar.</div>'}
    ${ctx}
    ${map ? `<div class="btns"><button class="btn ghost" data-act="wkKnow" data-id="${esc(map.id)}">Treiber & Quellen</button></div>` : ''}
    <div class="hint">Ideen beruhen auf öffentlichen Quellen. Bei der Arbeit nur mit Freigabe und freigegebenen Daten einsetzen – keine Kunden- oder Interna-Daten in externe KI.</div></section>`;
}
function wkOnePager(k) {
  return `Arbeite meine Hightech-Idee als 1-Seiter für ein internes Gespräch aus (Deutsch, sachlich, höchstens 1 Seite).

Idee: ${wkTitle(k)}
${k.summary || ''}
${(k.points || []).map(p => '- ' + p).join('\n')}

Gliederung: 1) Problem und heutiger Aufwand (als Annahme markieren, wo ich es nicht belegt habe) · 2) Lösung und Methode · 3) Benötigte Daten (nur freigegebene, Datenschutz und AI-Act-Einstufung) · 4) KPI mit Ausgangswert und Ziel · 5) Risiken und Grenzen · 6) 4-Wochen-Test mit Stop-Kriterium · 7) Was ich vom Gegenüber brauche.
Regeln: Nur öffentliche Quellen zitieren, keine Arbeitgeber-Interna erfinden; Zahlen ohne Beleg als Annahme kennzeichnen. Speichere nichts im Hub, bis ich „übernehmen“ sage.`;
}
function workAct(act, b) {
  if (!/^wk/.test(act)) return false;
  const k = b.dataset.id && (typeof know === 'function' ? know() : []).find(x => x.id === b.dataset.id);
  if (act === 'wkCtx') { WK_OPEN = WK_OPEN === b.dataset.v ? '' : b.dataset.v; render(); return true; }
  if (act === 'wkItem') { editItem('a', b.dataset.id); return true; }
  if (act === 'wkKnow' && k) { editKnow(k.id); return true; }
  if (act === 'wkPilot' && k) { const W = wkState(); W.pilot = W.pilot === k.id ? '' : k.id; save(W.pilot ? 'Als Pilot gewählt' : 'Pilot entfernt'); return true; }
  if (act === 'wkStep' && k) { S.lists.n.push({ id: uid(), n: 'Pilot vorbereiten: ' + wkTitle(k).slice(0, 70), t: '1-Seiter erstellen und im Entwicklungsgespräch vorschlagen. Wissen: ' + wkTitle(k), d: '', s: 0 }); save('In „Nächste Schritte“ übernommen'); return true; }
  if (act === 'wkOdi' && k) {
    chatDraft = wkOnePager(k); TAB = 'chat';
    try { sessionStorage.setItem(K + '-tab', 'chat'); } catch (e) { /* egal */ }
    render(); scrollTo(0, 0); const i = $('chatIn'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
    toast('Im Odi-Feld – prüfen und absenden'); return true;
  }
  return true;
}
