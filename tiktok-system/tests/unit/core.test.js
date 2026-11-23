import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validatePackage, voiceoverText } from '../../src/lib/schema.js';
import { Ledger, jaccard, shingles } from '../../src/lib/ledger.js';
import { buildCaption } from '../../src/caption/index.js';
import { wordsFromAlignment, estimateWordTimes, chooseProvider } from '../../src/voice/index.js';
import { timeScenes } from '../../src/render/index.js';
import { captionGroups } from '../../src/render/captions.js';
import { checkVideoTech } from '../../src/qa/index.js';
import { gate, publish, AUTOPUBLISH_PHRASE } from '../../src/publish/index.js';
import { operation } from '../../src/publish/buffer.js';

const cfg = JSON.parse(fs.readFileSync(new URL('../../config/channel.json', import.meta.url)));
const pkg = JSON.parse(fs.readFileSync(new URL('../../content/examples/solarspitzen.json', import.meta.url)));
const tmpLedger = () => new Ledger(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tt-')), 'ledger.json'));

test('Beispielpaket ist gültig', () => { const v = validatePackage(pkg, cfg); assert.equal(v.ok, true, v.errors.join('; ')); });
test('Aussage ohne Quelle und fehlende KI-Kennzeichnung werden abgelehnt', () => {
  const bad = structuredClone(pkg); bad.claims[0].sources = ['gibtsnicht']; bad.aiDisclosure = false;
  const v = validatePackage(bad, cfg); assert.equal(v.ok, false);
  assert.ok(v.errors.some(e => e.includes('keine gültige Quelle'))); assert.ok(v.errors.some(e => e.includes('aiDisclosure')));
});
test('nicht erlaubte Asset-Lizenz wird abgelehnt', () => {
  const bad = structuredClone(pkg); bad.assets = [{ path: 'x.png', license: 'unbekannt' }];
  assert.ok(validatePackage(bad, cfg).errors.some(e => e.includes('Lizenz')));
});
test('Zahl in Szene ohne Beleg erzeugt Warnung', () => {
  const p2 = structuredClone(pkg); p2.scenes[5].say = 'Spart 40 Prozent.'; assert.ok(validatePackage(p2, cfg).warnings.length > 0);
});
test('Ledger: erlaubte und verbotene Statuswechsel', () => {
  const l = tmpLedger(); l.upsert('a', { text: 'x' });
  l.transition('a', 'rendered'); l.transition('a', 'qa_passed');
  assert.throws(() => l.transition('a', 'published'), /nicht erlaubt/);
});
test('Ledger: ähnlicher Inhalt wird als Dublette erkannt', () => {
  const l = tmpLedger(); l.upsert('alt', { text: voiceoverText(pkg) });
  assert.ok(l.similar(voiceoverText(pkg), 0.55, 'neu')); assert.equal(l.similar('Ganz anderes Thema über Wärmepumpen im Altbau und Förderung', 0.55, 'neu'), null);
  assert.equal(jaccard(shingles('a b c d'), shingles('a b c d')), 1);
});
test('Ledger: Kosten je Monat', () => { const l = tmpLedger(); l.upsert('a', {}); l.addCost('a', 0.4, 'voice'); l.addCost('a', 0.2, 'voice'); assert.equal(l.spent(), 0.6); });
test('Beschreibung: KI-Hinweis, Hashtags begrenzt und ohne Dubletten', () => {
  const c = buildCaption({ ...pkg, caption: 'Test', hashtags: ['#A', 'a', '#b', '#c', '#d', '#e', '#f'] }, cfg);
  assert.match(c.text, /KI-generiert/); assert.equal(c.hashtags.length, 5); assert.equal(new Set(c.hashtags).size, 5); assert.match(c.sourcesComment, /co2online/);
});
test('Wortzeiten aus ElevenLabs-Zeichenzeiten', () => {
  const text = 'Hallo Welt'; const al = { characters: [...text], character_start_times_seconds: [...text].map((_, i) => i * 0.1), character_end_times_seconds: [...text].map((_, i) => i * 0.1 + 0.1) };
  const w = wordsFromAlignment(al); assert.deepEqual(w.map(x => x.w), ['Hallo', 'Welt']); assert.ok(Math.abs(w[1].start - 0.6) < 1e-9);
});
test('geschätzte Wortzeiten sind monoton und passen in die Dauer', () => {
  const w = estimateWordTimes(voiceoverText(pkg), 30); assert.ok(w.every((x, i) => i === 0 || x.start >= w[i - 1].start)); assert.ok(w.at(-1).end <= 30);
});
test('Szenen folgen den Wortzeiten lückenlos', () => {
  const w = estimateWordTimes(voiceoverText(pkg), 30), s = timeScenes(pkg.scenes, w, 30.5);
  assert.equal(s[0].start, 0); assert.equal(s.at(-1).end, 30.5); assert.ok(s.every((x, i) => i === 0 || x.start === s[i - 1].end));
});
test('Untertitel-Gruppen brechen am Satzende', () => {
  const g = captionGroups([{ w: 'Null' }, { w: 'Euro.' }, { w: 'Seit' }, { w: 'dem' }, { w: '25.' }]);
  assert.deepEqual(g, [[0, 1], [2, 3, 4]]);
  assert.deepEqual(captionGroups([{ w: 'dem' }, { w: '25.' }, { w: 'Februar' }, { w: 'gilt.' }]), [[0, 1, 2], [3]], 'Ordnungszahl ist kein Satzende');
});
test('Test-Stimme nur im Modus A', () => {
  const old = process.env.ELEVENLABS_API_KEY; delete process.env.ELEVENLABS_API_KEY;
  assert.equal(chooseProvider(cfg, 'A'), 'espeak'); assert.throws(() => chooseProvider(cfg, 'B'), /nur im Modus A/);
  if (old) process.env.ELEVENLABS_API_KEY = old;
});
test('Video-Technikprüfung', () => {
  assert.deepEqual(checkVideoTech({ width: 1080, height: 1920, codec: 'h264', pix: 'yuv420p', audio: 'aac', duration: 30, size: 1e7 }, cfg), []);
  assert.equal(checkVideoTech({ width: 1920, height: 1080, codec: 'vp9', pix: 'yuvj420p', audio: null, duration: 70, size: 1e7 }, cfg).length, 5);
});
test('Modus-Sperren: A nie, B nur mit Freigabe, C nur voll aktiviert', () => {
  const entry = { status: 'qa_passed', qa: { ok: true, warnings: [] } };
  assert.match(gate({ mode: 'A', cfg, entry }), /nie/);
  assert.match(gate({ mode: 'B', cfg, entry }), /Freigabe fehlt/);
  assert.equal(gate({ mode: 'B', cfg, entry: { ...entry, status: 'approved', approval: { by: 'Test' } } }), null);
  assert.match(gate({ mode: 'C', cfg, entry, env: {} }), /nicht aktiviert/);
  const cfgC = { ...cfg, mode: 'C', autonomous: { enabled: true, maxPostsPerDay: 1, requireZeroWarnings: true } };
  assert.match(gate({ mode: 'C', cfg: cfgC, entry, env: {} }), /AUTOPUBLISH_CONFIRM/);
  assert.equal(gate({ mode: 'C', cfg: cfgC, entry, env: { AUTOPUBLISH_CONFIRM: AUTOPUBLISH_PHRASE } }), null);
  assert.match(gate({ mode: 'C', cfg: cfgC, entry: { ...entry, qa: { ok: true, warnings: ['w'] } }, env: { AUTOPUBLISH_CONFIRM: AUTOPUBLISH_PHRASE } }), /Warnungen/);
  assert.match(gate({ mode: 'C', cfg: cfgC, entry, publishedToday: 1, env: { AUTOPUBLISH_CONFIRM: AUTOPUBLISH_PHRASE } }), /Tageslimit/);
});
test('Veröffentlichung: genau ein Upload, zweiter Versuch wird verhindert', async () => {
  const l = tmpLedger(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-')), video = path.join(dir, 'v.mp4'); fs.writeFileSync(video, 'video-bytes');
  l.upsert('v1', { files: { video }, caption: { text: 'T KI-generiert', sourcesComment: 'Q' }, qa: { ok: true, warnings: [] }, approval: { by: 'Test' } });
  l.transition('v1', 'rendered'); l.transition('v1', 'qa_passed'); l.transition('v1', 'approved');
  let calls = 0; const adapter = { schedule: async () => { calls++; return { id: 'post-1', status: 'scheduled' }; } };
  const env = { BUFFER_TIKTOK_CHANNEL_ID: 'ch1' };
  const r = await publish({ id: 'v1', mode: 'B', cfg, ledger: l, videoUrl: 'https://example.org/v.mp4', adapter, env });
  assert.equal(r.status, 'scheduled'); assert.equal(l.get('v1').status, 'scheduled');
  await assert.rejects(publish({ id: 'v1', mode: 'B', cfg, ledger: l, videoUrl: 'https://example.org/v.mp4', adapter, env }));
  assert.equal(calls, 1);
});
test('Veröffentlichung: API-Fehler wird vermerkt, Status publish_failed', async () => {
  const l = tmpLedger(), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tv-')), video = path.join(dir, 'v.mp4'); fs.writeFileSync(video, 'andere-bytes');
  l.upsert('v2', { files: { video }, caption: { text: 'T KI-generiert' }, qa: { ok: true, warnings: [] }, approval: { by: 'Test' } });
  l.transition('v2', 'rendered'); l.transition('v2', 'qa_passed'); l.transition('v2', 'approved');
  const adapter = { schedule: async () => { throw new Error('Buffer 500'); } };
  await assert.rejects(publish({ id: 'v2', mode: 'B', cfg, ledger: l, videoUrl: 'https://example.org/v.mp4', adapter, env: { BUFFER_TIKTOK_CHANNEL_ID: 'c' } }), /Buffer 500/);
  assert.equal(l.get('v2').status, 'publish_failed'); assert.equal(l.get('v2').publish[0].status, 'failed');
});
test('Buffer-Operationen werden aus config/buffer.graphql gelesen', () => {
  assert.match(operation('CreatePost'), /^mutation CreatePost/); assert.match(operation('PostStatus'), /^query PostStatus/);
});
test('n8n-Workflow ist gültiges JSON mit verbundenen Knoten', () => {
  const wf = JSON.parse(fs.readFileSync(new URL('../../n8n/workflow.json', import.meta.url)));
  const names = new Set(wf.nodes.map(n => n.name));
  for (const [from, c] of Object.entries(wf.connections)) { assert.ok(names.has(from), from); c.main.flat().forEach(t => assert.ok(names.has(t.node), t.node)); }
  assert.ok(wf.nodes.some(n => n.type === 'n8n-nodes-base.scheduleTrigger'));
  assert.ok(wf.nodes.some(n => n.type === 'n8n-nodes-base.wait'), 'Freigabe-Warteschritt fehlt');
});
