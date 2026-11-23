/* Lebenshub – KI-Agenten-Team: sechs Rollen, die als Claude-Jobs arbeiten und nur ENTWÜRFE liefern.
   „Du – Chef – gibst frei“: Entwürfe landen in S.drafts und werden erst nach Freigabe verwendet
   (Mail → Entwurf in Gmail, Post → in die Zwischenablage). Nichts wird automatisch gesendet oder veröffentlicht.
   Werkzeug add_draft für Jobs und Odi. Die Zuordnung Job → Agent erfolgt über den Namen im Job-Log. */
'use strict';
const AGENTS = [
  { id: 'content', nr: '01', name: 'Content', icon: '✍️', desc: 'Posts und Newsletter aus deinen Notizen und deinem Wissen', re: /content|newsletter|linkedin/i, when: 'montags' },
  { id: 'akquise', nr: '02', name: 'Akquise', icon: '🤝', desc: 'Gesprächs-Briefings, Nachfass-Mails, Kontakte aktuell', re: /akquise|nachfass|karriere|startup-|terminvorbereitung/i, when: 'donnerstags + vor Terminen' },
  { id: 'assistenz', nr: '03', name: 'Assistenz', icon: '🗂️', desc: 'Mails sortieren, Morgen-Briefing, Termine, Wetter', re: /themenbriefing|wetter|wissensagent|posteingang/i, when: 'werktags früh' },
  { id: 'buchhaltung', nr: '04', name: 'Finanzen & Belege', icon: '🧾', desc: 'Belege ablegen, Steuer-Sammlung, Kurse, Aktienradar', re: /beleg|steuer|kurs|aktien|finanz|deal-radar/i, when: 'monatlich + samstags' },
  { id: 'video', nr: '05', name: 'Video', icon: '🎬', desc: 'Pausen raus, Untertitel drauf (TikTok-System)', re: /video|tiktok/i, when: 'startet mit Laptop', idle: true },
  { id: 'bericht', nr: '06', name: 'Wochenbericht', icon: '📊', desc: 'Was lief, was hakt, was ansteht', re: /wochenreview|lebenshub-check|synthese|gesamtkonzept/i, when: 'sonntags + 2× im Monat' }
];
const DRAFT_KINDS = { post: 'Post', newsletter: 'Newsletter', mail: 'Mail', briefing: 'Briefing', beleg: 'Beleg', notiz: 'Notiz' };
function drafts() { S.drafts = Array.isArray(S.drafts) ? S.drafts : []; return S.drafts; }
function agentOf(id) { return AGENTS.find(a => a.id === id) || AGENTS[2]; }
function agentLast(a) { return (S.jobLog || []).filter(j => a.re.test(j.source)).sort((x, y) => String(y.at).localeCompare(String(x.at)))[0]; }
function agentsCard() {
  const D = drafts().filter(d => d.st === 'offen');
  const when = at => typeof jobWhen === 'function' ? jobWhen(at) : String(at).slice(0, 10);
  return `<section class="card wide ag"><div class="ag-boss"><b>Du</b><small>CHEF · GIBST FREI</small>${D.length ? `<span class="ag-n">${D.length} zur Freigabe</span>` : ''}</div>
    <div class="ag-line"></div>
    <div class="ag-grid">${AGENTS.map(a => { const j = agentLast(a), n = D.filter(d => d.agent === a.id).length;
      return `<button class="ag-c${a.idle ? ' idle' : ''}" data-act="agOpen" data-v="${a.id}"><span class="ag-nr">AGENT ${a.nr}</span><b>${a.icon} ${esc(a.name)}</b><small>${esc(a.desc)}</small>
        <span class="ag-st">${a.idle ? '⏸ ' + esc(a.when) : j ? '● ' + esc(when(j.at)) : '○ ' + esc(a.when)}${n ? ` · <i>${n} Entwurf${n > 1 ? 'e' : ''}</i>` : ''}</span></button>`; }).join('')}</div>
    <div class="hint">Die Agenten sind deine Claude-Jobs. Sie liefern nur Entwürfe – gesendet, gepostet oder bezahlt wird erst, wenn du freigibst.</div></section>` + draftsCard();
}
function draftsCard(only) {
  const D = drafts().filter(d => d.st === 'offen' && (!only || d.agent === only));
  if (!D.length) return only ? '<div class="empty">Keine offenen Entwürfe.</div>' : '';
  return `<section class="card wide ag-fr"><h2>✅ Zur Freigabe<small>${D.length}</small></h2>${D.map(d => { const a = agentOf(d.agent);
    return `<details class="ag-d"><summary><span class="ag-dk">${esc(DRAFT_KINDS[d.kind] || 'Entwurf')}</span><b>${esc(d.title)}</b><small>${a.icon} ${esc(a.name)} · ${esc(String(d.at).slice(0, 10))}</small></summary>
      ${d.to || d.subject ? `<div class="hint">${d.to ? 'An: ' + esc(d.to) : ''}${d.subject ? ' · Betreff: ' + esc(d.subject) : ''}</div>` : ''}<p class="ag-body">${esc(d.body)}</p>${d.link ? `<a href="${esc(d.link)}" target="_blank" rel="noopener">Quelle öffnen</a>` : ''}
      <div class="btns"><button class="btn" data-act="drOk" data-id="${esc(d.id)}">${d.kind === 'mail' ? 'Freigeben → Entwurf in Gmail' : 'Freigeben → kopieren'}</button><button class="btn ghost" data-act="drEdit" data-id="${esc(d.id)}">Mit Odi ändern</button><button class="btn warn" data-act="drNo" data-id="${esc(d.id)}">Verwerfen</button></div></details>`; }).join('')}</section>`;
}
async function draftApprove(d) {
  if (d.kind === 'mail' && typeof ART !== 'undefined' && ART.mcp) {
    try { await ART.mcp.callTool('Gmail', 'create_draft', { to: d.to ? [d.to] : [], subject: d.subject || d.title, body: d.body }, { cache: false }); d.st = 'freigegeben'; d.done = new Date().toISOString(); save('Entwurf in Gmail angelegt – dort prüfen und senden'); return; }
    catch (e) { toast(typeof mailErr === 'function' ? mailErr(e) : 'Gmail nicht erreichbar – Text wird kopiert'); }
  }
  try { await navigator.clipboard.writeText((d.subject ? d.subject + '\n\n' : '') + d.body); } catch (e) { /* iOS ggf. ohne Rechte */ }
  d.st = 'freigegeben'; d.done = new Date().toISOString(); save('Freigegeben und kopiert');
}
function agentsAct(act, b) {
  if (act === 'agOpen') {
    const a = agentOf(b.dataset.v), j = agentLast(a);
    if (j && typeof JOBOPEN !== 'undefined') { JOBOPEN = typeof jobName === 'function' ? jobName(j) : ''; }
    openDlg(`<h3>${a.icon} Agent ${a.nr} · ${esc(a.name)}</h3><div class="hint">${esc(a.desc)} · läuft ${esc(a.when)}</div>
      ${j ? `<p><b>Zuletzt:</b> ${esc(j.source)} – ${esc(String(j.summary || '').slice(0, 400))}</p>` : '<p class="hint">Noch kein Ergebnis.</p>'}${draftsCard(a.id)}
      <div class="btns"><button class="btn" value="ask">Auftrag an Odi</button><button class="btn ghost" value="cancel" formnovalidate>Schließen</button></div>`, v => {
      if (v !== 'ask') return;
      chatDraft = `Agent ${a.name}: `; TAB = 'chat'; try { sessionStorage.setItem(K + '-tab', 'chat'); } catch (e) { /* egal */ } render();
    });
    return true;
  }
  const d = b.dataset.id && drafts().find(x => x.id === b.dataset.id);
  if (act === 'drOk' && d) { draftApprove(d); return true; }
  if (act === 'drNo' && d) { d.st = 'verworfen'; save('Verworfen'); return true; }
  if (act === 'drEdit' && d) {
    chatDraft = `Überarbeite diesen ${DRAFT_KINDS[d.kind] || 'Entwurf'} (${d.title}) und lege ihn mit add_draft neu an:\n\n${d.body}\n\nÄnderung: `;
    d.st = 'verworfen'; TAB = 'chat'; try { sessionStorage.setItem(K + '-tab', 'chat'); } catch (e) { /* egal */ } save(); render(); return true;
  }
  return false;
}
function agentTool(name, x) {
  if (name !== 'add_draft') return null;
  const body = String(x.body || '').trim(); if (!body) throw new Error('body fehlt');
  const D = drafts(), title = String(x.title || body.slice(0, 60)).slice(0, 120);
  if (D.some(d => d.st === 'offen' && d.title === title)) return { label: '✎ Entwurf schon vorhanden: ' + title, result: 'Dublette, übersprungen' };
  D.unshift({ id: uid(), agent: AGENTS.some(a => a.id === x.agent) ? x.agent : 'assistenz', kind: DRAFT_KINDS[x.kind] ? x.kind : 'notiz', title, body: body.slice(0, 6000),
    to: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.to || '') ? x.to : '', subject: String(x.subject || '').slice(0, 200), link: /^https:\/\//.test(x.link || '') ? String(x.link).slice(0, 300) : '', at: new Date().toISOString(), st: 'offen' });
  S.drafts = D.filter(d => d.st === 'offen').concat(D.filter(d => d.st !== 'offen').slice(0, 30)).slice(0, 80);
  return { label: '📝 Entwurf zur Freigabe: ' + title, result: 'gespeichert – wartet auf Freigabe' };
}
const AGENT_TOOLS = [{ name: 'add_draft', description: 'Entwurf eines Agenten zur Freigabe ablegen (Post, Newsletter, Mail, Briefing, Beleg, Notiz). Wird NIE automatisch gesendet; der Nutzer gibt frei.',
  input_schema: { type: 'object', additionalProperties: false, required: ['agent', 'kind', 'title', 'body'], properties: {
    agent: { type: 'string', enum: AGENTS.map(a => a.id) }, kind: { type: 'string', enum: Object.keys(DRAFT_KINDS) }, title: { type: 'string' }, body: { type: 'string' },
    to: { type: 'string', description: 'Empfänger-Adresse bei Mails' }, subject: { type: 'string' }, link: { type: 'string' } } } }];
