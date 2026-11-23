/* Lebenshub – Odis Verstand: Wissenssuche über den ganzen Hub, Gedächtnis und gut sprechbare Antworten.
   1) hubSearch: findet zu jeder Frage die passendsten Wissenseinträge, Dokumente, Einträge, Erkenntnisse und Notizen
      (Schlagwortsuche mit Gewichtung, ohne externe Dienste). Die besten Treffer gehen automatisch als <relevant> an Claude.
   2) Gedächtnis: Entscheidungen, Ziele, Vorlieben und neue Fakten aus Gesprächen landen in S.brain.facts.
   3) Sprache: ttsText macht Antworten vorlesbar (Euro, Prozent, Datum, Abkürzungen), spokenPart liefert die Kurzantwort. */
'use strict';
const MIND_STOP = new Set('aber alle allem allen aller alles also auch auf aus bei beim bin bis bist dann das dass dem den der des die dies diese diesem diesen dieser dieses doch dort du durch ein eine einem einen einer eines er es etwa euch für gibt hab habe haben hat hatte hier ich ihr im in ins ist ja jetzt kann kannst kein keine man mein meine meinem meinen meiner mich mir mit muss nach nicht noch nur ob oder ohne sein seine sich sie sind so soll sollte über um und uns unter viel vom von vor war was weil welche welcher welches wenn wer werden wie wieder wir wird wo zu zum zur zwischen bitte mal sag sage zeig erklär erkläre weißt wissen sagt steht stand gerade eigentlich ganz sehr'.split(' '));
function mindTerms(s) {
  return Array.from(new Set(String(s || '').toLowerCase().replace(/ß/g, 'ss').replace(/[^a-zäöü0-9 ]/g, ' ').split(/\s+/)
    .filter(w => w.length >= 3 && !MIND_STOP.has(w)).map(w => w.length > 6 ? w.replace(/(ungen|ung|en|er|es|e|n|s)$/, '') : w)));
}
/* Alle durchsuchbaren Bausteine des Hubs */
function mindCorpus() {
  const out = [], add = (ref, type, title, body, extra) => out.push({ ref, type, title: String(title || ''), body: String(body || ''), extra: extra || '' });
  (typeof know === 'function' ? know() : []).forEach(k => add('know:' + k.id, 'Wissen', k.title, [k.summary, (k.points || []).join(' · ')].join(' '), (k.tags || []).join(' ') + (k.url ? ' ' + k.url : '')));
  (typeof DOCS !== 'undefined' ? DOCS : []).forEach(d => add('doc:' + d.id, 'Dokument', (d.analysis && d.analysis.title) || d.name, (d.analysis && d.analysis.summary) || '', ((d.analysis && d.analysis.facts) || []).map(f => f.label + ' ' + f.value).join(' ')));
  (typeof C !== 'undefined' ? C : []).forEach(c => (S.lists[c.k] || []).forEach(it => add('item:' + c.k + ':' + it.id, c.title, it.n, it.t || '', it.d || '')));
  const B = S.brain || {};
  (B.insights || []).forEach(i => add('ins:' + i.id, 'Erkenntnis', i.text.slice(0, 80), i.text));
  (B.facts || []).forEach(f => add('fact:' + f.id, 'Gemerkt', (f.kind || 'Fakt') + ': ' + f.text.slice(0, 70), f.text));
  ((S.fin && S.fin.radar && S.fin.radar.items) || []).forEach(r => add('radar:' + r.name, 'Aktienradar', r.name + ' (' + r.cat + ')', [r.why, r.risk, r.next, r.val, r.pe].filter(Boolean).join(' · '), r.ticker));
  ((S.life && S.life.contracts) || []).forEach(v => add('vertrag:' + v.id, 'Vertrag', v.name, [v.provider, v.note, v.status].filter(Boolean).join(' · ')));
  return out;
}
function hubSearch(q, limit) {
  const terms = mindTerms(q); if (!terms.length) return [];
  const docs = mindCorpus(), N = docs.length || 1;
  const prep = docs.map(d => ({ d, t: mindTerms(d.title), b: mindTerms(d.body + ' ' + d.extra) }));
  // Wortanfänge zählen nur bei kurzen Endungen (Speicher ↔ Speichers), nicht bei Komposita (Aktien ≠ Aktiengesellschaft)
  const near = (a, b) => a.length >= 4 && b.startsWith(a) && b.length - a.length <= 4;
  // 1 = genau/Endung, 0,6 = Wortanfang eines zusammengesetzten Wortes (Physio → Physiotherapie)
  const match = (list, term) => list.reduce((m, w) => Math.max(m, w === term || near(term, w) || near(w, term) ? 1 : term.length >= 5 && w.startsWith(term) ? 0.5 : 0), 0);
  const df = {}; terms.forEach(term => { df[term] = prep.filter(p => match(p.t, term) || match(p.b, term)).length; });
  const res = prep.map(p => {
    let s = 0, hit = 0;
    const typeT = mindTerms(p.d.type);
    terms.forEach(term => {
      const idf = Math.log(1 + N / (1 + df[term])), inT = match(p.t, term), inB = match(p.b, term);
      const inType = term.length >= 4 && typeT.some(w => w === term || w.startsWith(term)) ? 1 : 0; // Frage nennt die Art (Aktien → Aktienradar, Termin → Termine)
      if (inT || inB || inType) { hit++; s += idf * (3 * inT + inB + 1.5 * inType); }
    });
    if (hit > 1) s *= 1 + 0.35 * (hit - 1); // mehrere Suchbegriffe zugleich = deutlich relevanter
    if (p.d.type === 'Wissen' || p.d.type === 'Gemerkt') s *= 1.15;
    if (/^\d{4}-\d{2}-\d{2}$/.test(p.d.extra)) { const today = H.today(); s *= p.d.extra < today ? 0.5 : p.d.extra <= H.add(today, 30) ? 1.3 : 1; } // anstehende Termine vor vergangenen
    return { ref: p.d.ref, type: p.d.type, title: p.d.title, text: p.d.body, extra: p.d.extra, score: s, hit };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score || String(a.extra).localeCompare(String(b.extra)));
  const seen = {}; // gleiche Titel höchstens zweimal (z. B. Serientermine)
  return res.filter(r => (seen[r.title] = (seen[r.title] || 0) + 1) <= 2).slice(0, limit || 8);
}
/* Automatischer Kontext für jede Frage */
function relevantContext(q, n) {
  const hits = hubSearch(q, n || 6).filter((h, i, a) => h.score >= a[0].score * 0.25);
  if (!hits.length) return { text: '', refs: [] };
  const lines = hits.map(h => `[${h.type}] ${h.title}${h.extra && /https?:/.test(h.extra) ? ' – ' + (h.extra.match(/https?:\S+/) || [''])[0] : ''}\n${h.text.slice(0, 700)}`);
  return { text: '\n<relevant hinweis="Die passendsten Stellen aus meinem Hub zu dieser Nachricht. Nutze sie zuerst und nenne den Titel als Quelle.">\n' + lines.join('\n---\n') + '\n</relevant>', refs: hits.map(h => h.title.slice(0, 60)) };
}
/* Wie gründlich soll Claude denken? */
function chooseEffort(text, voice) {
  const t = String(text || '');
  if (/gründlich|ausführlich|strategie|konzept|vergleich|analys|bewerte|empfiehl|plan(e|ung)?\b|rechne|berechn|warum|lohnt|sinnvoll|risik|förder|finanzier/i.test(t) || t.length > 220) return voice ? 'medium' : 'high';
  if (/\?|was|wie|wann|welche|wer|wo/i.test(t) && t.length > 40) return 'medium';
  return 'low';
}
/* Gedächtnis */
function mindTool(name, x) {
  if (name === 'remember') {
    const B = typeof brain === 'function' ? brain() : (S.brain = S.brain || {});
    B.facts = Array.isArray(B.facts) ? B.facts : [];
    const text = String(x.text || '').trim().slice(0, 300); if (!text) throw new Error('Text fehlt');
    const kind = ['Entscheidung', 'Ziel', 'Vorliebe', 'Fakt', 'Person/Rolle', 'Frist'].includes(x.kind) ? x.kind : 'Fakt';
    const same = B.facts.find(f => f.text.toLowerCase() === text.toLowerCase() || (x.replaces && f.id === x.replaces));
    if (same) { Object.assign(same, { text, kind, at: new Date().toISOString() }); return { label: '🧠 Gedächtnis aktualisiert: ' + text.slice(0, 50), result: 'aktualisiert, id=' + same.id }; }
    const f = { id: uid(), text, kind, refs: Array.isArray(x.refs) ? x.refs.map(String).slice(0, 5) : [], at: new Date().toISOString() };
    B.facts.unshift(f); B.facts = B.facts.slice(0, 200);
    return { label: '🧠 Gemerkt: ' + text.slice(0, 60), result: 'gespeichert, id=' + f.id };
  }
  if (name === 'search_hub') {
    const r = hubSearch(x.query, Math.min(12, x.limit || 8));
    return { label: '🔎 gesucht: ' + String(x.query).slice(0, 40), result: r.length ? JSON.stringify(r.map(h => ({ ref: h.ref, art: h.type, titel: h.title, text: h.text.slice(0, 500), info: h.extra.slice(0, 160) }))) : 'Keine Treffer im Hub.' };
  }
  return null;
}
const MIND_TOOLS = [
  { name: 'search_hub', description: 'Den ganzen Lebenshub durchsuchen (Wissen, Dokumente, Listen, Erkenntnisse, Gemerktes, Aktienradar, Verträge). Nutzen, wenn <relevant> nicht reicht.',
    input_schema: { type: 'object', additionalProperties: false, required: ['query'], properties: { query: { type: 'string', description: 'Suchbegriffe' }, limit: { type: 'integer' } } } },
  { name: 'remember', description: 'Etwas dauerhaft merken: Entscheidung, Ziel, Vorliebe, Fakt, Person/Rolle (ohne Privatnamen Dritter) oder Frist, die der Nutzer im Gespräch nennt.',
    input_schema: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: { type: 'string', description: 'ein klarer Satz' }, kind: { type: 'string', enum: ['Entscheidung', 'Ziel', 'Vorliebe', 'Fakt', 'Person/Rolle', 'Frist'] }, refs: { type: 'array', items: { type: 'string' } }, replaces: { type: 'string', description: 'id eines veralteten Eintrags' } } } }
];
function factsSnapshot() { const F = (S.brain && S.brain.facts) || []; return JSON.stringify(F.slice(0, 30).map(f => [f.id, f.kind, f.text, (f.at || '').slice(0, 10)])); }

/* ---------- Sprache ---------- */
const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
function ttsText(t) {
  let s = String(t || '');
  s = s.replace(/```[\s\S]*?```/g, ' ').replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1').replace(/https?:\/\/\S+/g, ' ')
    .replace(/(\d{4})-(\d{2})-(\d{2})/g, (m, y, mo, d) => `${+d}. ${MONTHS_DE[+mo - 1] || mo} ${y}`)
    .replace(/(\d+)\s?%/g, '$1 Prozent').replace(/(\d)\s?€|€\s?(\d)/g, (m, a, b) => a ? a + ' Euro' : 'Euro ' + b).replace(/€/g, 'Euro')
    .replace(/(\d)\s?Tsd\.?/g, '$1 tausend').replace(/(\d)\s?Mio\.?/g, '$1 Millionen').replace(/(\d)\s?Mrd\.?/g, '$1 Milliarden')
    .replace(/\bz\.\s?B\./g, 'zum Beispiel').replace(/\bd\.\s?h\./g, 'das heißt').replace(/\bu\.\s?a\./g, 'unter anderem').replace(/\bca\./g, 'circa').replace(/\bggf\./g, 'gegebenenfalls').replace(/\bbzw\./g, 'beziehungsweise').replace(/\bvgl\./g, 'vergleiche').replace(/\binkl\./g, 'inklusive').replace(/\bNr\./g, 'Nummer')
    .replace(/\bkWh\b/g, 'Kilowattstunden').replace(/\bMWh\b/g, 'Megawattstunden').replace(/\bkWp\b/g, 'Kilowatt Peak').replace(/\bkW\b/g, 'Kilowatt').replace(/\bMW\b/g, 'Megawatt')
    .replace(/(\d)\s?–\s?(\d)/g, '$1 bis $2').replace(/→/g, ', dann ').replace(/[*#_`>|•·]/g, ' ')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/\n+/g, '. ').replace(/\s*\.\s*\./g, '.').replace(/\s{2,}/g, ' ').trim();
  return s;
}
/* Kurzantwort zum Vorlesen: erster Absatz, höchstens ~3 Sätze */
function spokenPart(t, max) {
  const first = String(t || '').trim().split(/\n\s*\n/)[0].replace(/^[-*]\s+/gm, '');
  const sentences = first.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [first];
  let out = ''; for (const s of sentences) { if ((out + s).length > (max || 420) && out) break; out += s; }
  return out.trim();
}
/* Satzweise vorlesen, während Claude noch schreibt */
let speechQ = Promise.resolve(), speechGen = 0, streamSpoken = 0, streamSaid = '';
function speakOnce(txt, gen) {
  return new Promise(res => {
    if (gen !== speechGen || !txt) return res();
    const done = () => res();
    if (ART.tts && (typeof ttsFail !== 'undefined' && (ttsFail || (!odi().voice && !deVoices().length)))) { ART.tts.speak(txt.slice(0, 1900), { voice: 'rounded' }).then(done, done); return; }
    try {
      const u = new SpeechSynthesisUtterance(txt.slice(0, 1200));
      pickVoice(); u.lang = voice ? voice.lang : 'de-DE'; if (voice) u.voice = voice; u.rate = +odi().rate || 1; u.pitch = +odi().pitch || 1;
      let started = false; u.onstart = () => { started = true; }; u.onend = done; u.onerror = () => { if (!started) noTts(); done(); };
      speechSynthesis.speak(u); setTimeout(() => { if (!started && !speechSynthesis.speaking) { noTts(); done(); } }, 3000);
    } catch (e) { done(); }
  });
}
function enqueueSpeech(txt) { const g = speechGen, s = ttsText(txt); if (!s) return speechQ; speechQ = speechQ.then(() => speakOnce(s, g)); return speechQ; }
function stopSpeech() { speechGen++; speechQ = Promise.resolve(); streamSpoken = 0; streamSaid = ''; try { speechSynthesis.cancel(); } catch (e) { /* egal */ } }
/* Wird beim Streamen aufgerufen: fertige Sätze der Kurzantwort sofort vorlesen */
function streamSpeak(full) {
  const para = String(full || '').split(/\n\s*\n/)[0];
  const done = para.match(/^[\s\S]*[.!?](\s|$)/); if (!done) return;
  const upto = done[0].length; if (upto <= streamSpoken) return;
  const chunk = para.slice(streamSpoken, upto); streamSpoken = upto; streamSaid += chunk;
  if (streamSaid.length <= 460) enqueueSpeech(chunk);
}
/* Modellstufe für das Claude-Abo: schnell bei Kleinem, gründlich bei Analysen (bei Sprache zugunsten der Antwortzeit gemäßigt) */
function chooseTier(text, voice) { const e = chooseEffort(text, voice); return e === 'high' ? 'complex' : e === 'low' && voice && String(text).length < 60 ? 'quick' : 'default'; }
