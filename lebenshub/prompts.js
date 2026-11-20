/* Lebenshub – LifeOS-Prompt-Bibliothek (32 Fachprompts) im Bereich Wissen.
   Daten: prompts_data.js (erzeugt aus lifeos/prompts). Ein Prompt wird nie automatisch ausgeführt:
   „Mit Odi nutzen“ füllt nur das Eingabefeld, du ergänzt deinen Auftrag und schickst selbst ab. */
'use strict';
let PRQ = '', PRAREA = '', PROPEN = false;
const PR_HUB_HINT = '\n\n## Kontext Lebenshub\nNutze meine Hub-Daten und Wissenseinträge (Tag „LifeOS“) als Nutzerberichte, nicht als extern belegte Fakten. Schreibe erst etwas in den Hub (Einträge, Wissen, Schritte), wenn ich „übernehmen“ sage – zeige vorher die geplanten Änderungen.\n\n## Mein Auftrag\n';
function prList() { return typeof PROMPTS === 'undefined' ? [] : PROMPTS; }
function promptCard() {
  const P = prList();
  if (!P.length) return '';
  const areas = [...new Set(P.map(p => p.area))], q = PRQ.trim().toLowerCase();
  const L = P.filter(p => (!PRAREA || p.area === PRAREA) && (!q || (p.title + ' ' + p.goal + ' ' + p.ex).toLowerCase().includes(q)));
  const head = `<h2><button class="t" data-act="prToggle">🧭 Prompt-Bibliothek</button><small>${P.length} Fachprompts · LifeOS</small></h2>`;
  if (!PROPEN) return `<section class="card wide prompts">${head}<div class="btns"><button class="btn" data-act="prOpen" data-n="1">Gesprächsnotiz → Wissen</button><button class="btn ghost" data-act="prOpen" data-n="16">Gespräch vorbereiten</button><button class="btn ghost" data-act="prToggle">Alle ${P.length} zeigen</button></div></section>`;
  return `<section class="card wide prompts">${head}
    <input type="search" id="prQ" placeholder="Prompt suchen …" value="${esc(PRQ)}" autocomplete="off">
    <div class="chips"><button class="chip${PRAREA ? '' : ' on'}" data-act="prArea" data-v="">Alle</button>${areas.map(a => `<button class="chip${PRAREA === a ? ' on' : ''}" data-act="prArea" data-v="${esc(a)}">${esc(a)}</button>`).join('')}</div>
    ${L.map(p => `<div class="row"><button class="t" data-act="prOpen" data-n="${p.n}"><b>${String(p.n).padStart(2, '0')}</b> ${esc(p.title)}<small>${esc(p.goal)}</small></button></div>`).join('') || '<div class="empty">Kein Prompt passt.</div>'}
    <div class="hint">Prompts füllen nur das Odi-Eingabefeld – nichts wird automatisch ausgeführt oder gespeichert.</div></section>`;
}
function promptDlg(n) {
  const p = prList().find(x => x.n === n);
  if (!p) return;
  openDlg(`<h3>${String(p.n).padStart(2, '0')} · ${esc(p.title)}</h3>
    <div class="hint">${esc(p.area)}${p.goal ? ' · ' + esc(p.goal) : ''}</div>
    ${p.ex ? `<p><b>Beispiel:</b> ${esc(p.ex)}</p>` : ''}
    <details><summary>Prompt anzeigen</summary><pre class="prbody">${esc(p.body)}</pre></details>
    <label class="f">Dein Auftrag<textarea name="task" rows="4" placeholder="${esc(p.ex || 'Worum geht es? Notiz, Ziel, Datum …')}"></textarea></label>
    <div class="btns"><button class="btn" value="odi">Mit Odi nutzen</button><button class="btn ghost" value="copy">Kopieren</button><button class="btn ghost" value="cancel" formnovalidate>Schließen</button></div>`, (v, f) => {
    const text = p.body + PR_HUB_HINT + (f.task.value.trim() || '[hier ergänzen]');
    if (v === 'copy') { (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast('Prompt kopiert'), () => toast('Kopieren nicht möglich')); return; }
    chatDraft = text; TAB = 'chat';
    try { sessionStorage.setItem(K + '-tab', 'chat'); } catch (e) { /* egal */ }
    render(); scrollTo(0, 0);
    const i = $('chatIn'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
    toast('Im Odi-Feld – prüfen und absenden');
  });
}
function promptAct(act, b) {
  if (act === 'prToggle') { PROPEN = !PROPEN; render(); return true; }
  if (act === 'prArea') { PRAREA = b.dataset.v || ''; render(); return true; }
  if (act === 'prOpen') { promptDlg(Number(b.dataset.n)); return true; }
  return false;
}
document.addEventListener('input', e => { if (e.target && e.target.id === 'prQ') { PRQ = e.target.value; const pos = e.target.selectionStart; render(); const i = $('prQ'); if (i) { i.focus(); i.setSelectionRange(pos, pos); } } });
