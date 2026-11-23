#!/usr/bin/env node
// Kommandozeile – auch der Einstiegspunkt für n8n (gibt am Ende eine JSON-Zeile aus).
//   validate <paket.json>           Paket prüfen
//   produce <paket.json|--next> --mode A|B|C   Voiceover, Video, Beschreibung, QA
//   approve <id> --by <Name>        Freigabe (Modus B)      reject <id> --why <Grund>
//   publish <id> --video-url <URL> [--at ISO] [--channel tiktok] [--mode B|C]
//   status <id>                     Status bei Buffer abfragen
//   list                            Ledger anzeigen          costs   Kosten im Monat
//   check                           Integrationen einzeln testen
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { p, readJSON, writeJSON, loadEnv, config, nowISO } from './lib/util.js';
import { validatePackage, voiceoverText } from './lib/schema.js';
import { Ledger } from './lib/ledger.js';
import { chooseProvider, estimateCost, synthesize } from './voice/index.js';
import { buildCaption } from './caption/index.js';
import { runQA } from './qa/index.js';
import { publish, refreshStatus } from './publish/index.js';
import * as buffer from './publish/buffer.js';

loadEnv();
const [cmd, ...rest] = process.argv.slice(2);
const flag = (n, d) => { const i = rest.indexOf('--' + n); return i >= 0 ? rest[i + 1] : d; };
const out = o => { console.log(JSON.stringify(o)); return o; };
const log = (...a) => console.error('›', ...a);

function nextFromQueue(ledger) {
  const dir = p('content', 'queue');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')) : [];
  const pk = files.map(f => ({ f: path.join(dir, f), j: readJSON(path.join(dir, f)) })).filter(x => !ledger.get(x.j.id)).sort((a, b) => (b.j.priority || 0) - (a.j.priority || 0));
  return pk[0]?.f;
}
async function produce() {
  const cfg = config(), mode = (flag('mode', cfg.mode) || 'A').toUpperCase(), ledger = new Ledger();
  const file = rest[0] === '--next' ? nextFromQueue(ledger) : rest[0];
  if (!file) return out({ ok: false, step: 'queue', error: 'Keine neuen Pakete in content/queue' });
  const pkg = readJSON(file), v = validatePackage(pkg, cfg);
  if (!v.ok) return out({ ok: false, step: 'validate', id: pkg.id, errors: v.errors });
  const existing = ledger.get(pkg.id);
  if (existing && ['scheduled', 'published', 'approved'].includes(existing.status)) return out({ ok: false, step: 'ledger', id: pkg.id, error: `Bereits ${existing.status} – keine Neuproduktion` });
  const text = voiceoverText(pkg), provider = chooseProvider(cfg, mode);
  const cost = estimateCost(text, cfg, provider) + (pkg.createdBy === 'anthropic-api' ? cfg.budget.prices.anthropicPerVideo : 0);
  if (cost > cfg.budget.perVideoLimit) return out({ ok: false, step: 'budget', error: `Geschätzte Kosten ${cost.toFixed(2)} € > Limit je Video ${cfg.budget.perVideoLimit} €` });
  if (ledger.spent() + cost > cfg.budget.monthlyLimit) return out({ ok: false, step: 'budget', error: `Monatsbudget ${cfg.budget.monthlyLimit} € würde überschritten (bisher ${ledger.spent()} €)` });
  const dir = p('output', pkg.id); fs.mkdirSync(dir, { recursive: true });
  ledger.upsert(pkg.id, { topic: pkg.topic, text, mode, package: path.relative(p(), file), createdAt: existing?.createdAt || nowISO(), status: existing?.status === 'qa_failed' || existing?.status === 'rejected' ? 'planned' : (existing?.status || 'planned') });
  log(`Voiceover (${provider}) …`);
  const voice = await synthesize(text, dir, { provider, cfg });
  if (cost) ledger.addCost(pkg.id, cost, `voice:${provider}`);
  log(`Rendern (${voice.duration.toFixed(1)} s Audio) …`);
  const { render } = await import('./render/index.js');
  let last = 0; const r = await render({ pkg, voice, cfg, outDir: dir, onProgress: x => { if (x - last >= 0.25) { last = x; log(`  ${Math.round(x * 100)} %`); } } });
  ledger.transition(pkg.id, 'rendered');
  const caption = buildCaption(pkg, cfg);
  const qa = runQA({ pkg, cfg, mode, videoFile: r.file, props: r.props, ledger, caption, voice });
  writeJSON(path.join(dir, 'qa.json'), qa);
  writeJSON(path.join(dir, 'meta.json'), { id: pkg.id, topic: pkg.topic, mode, caption, voice: { provider: voice.provider, duration: voice.duration, testOnly: !!voice.testOnly }, sources: pkg.sources, claims: pkg.claims, createdAt: nowISO() });
  ledger.upsert(pkg.id, { files: { video: r.file, dir }, caption, qa: { ok: qa.ok, errors: qa.errors, warnings: qa.warnings }, voice: voice.provider });
  ledger.transition(pkg.id, qa.ok ? 'qa_passed' : 'qa_failed');
  if (qa.ok && mode === 'B') { ledger.transition(pkg.id, 'awaiting_approval'); writeJSON(p('data', 'approvals', pkg.id + '.json'), { id: pkg.id, requestedAt: nowISO(), video: r.file, caption: caption.text, warnings: qa.warnings }); }
  return out({ ok: qa.ok, step: 'done', id: pkg.id, mode, status: ledger.get(pkg.id).status, video: r.file, duration: +r.duration.toFixed(2), errors: qa.errors, warnings: qa.warnings, costEUR: +cost.toFixed(3), monthSpentEUR: ledger.spent() });
}
async function check() {
  const res = {};
  const bin = (name, args) => { try { execFileSync(name, args, { stdio: 'ignore' }); return 'ok'; } catch { return 'fehlt'; } };
  res.ffmpeg = bin('ffmpeg', ['-version']); res.ffprobe = bin('ffprobe', ['-version']); res.espeak = bin('espeak-ng', ['--version']);
  res.remotion = fs.existsSync(p('node_modules', '@remotion', 'renderer')) ? 'installiert' : 'fehlt (npm install)';
  if (process.env.ELEVENLABS_API_KEY) {
    try { const r = await fetch('https://api.elevenlabs.io/v1/user', { headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY } }); const j = await r.json().catch(() => ({})); res.elevenlabs = r.ok ? `ok (Zeichen frei: ${(j.subscription?.character_limit ?? 0) - (j.subscription?.character_count ?? 0)})` : `Fehler ${r.status}`; } catch (e) { res.elevenlabs = 'nicht erreichbar: ' + e.message; }
  } else res.elevenlabs = 'nicht konfiguriert';
  if (process.env.BUFFER_ACCESS_TOKEN) { try { const c = await buffer.check(); res.buffer = `ok – createPost ${c.createPostAvailable ? 'vorhanden' : 'NICHT vorhanden (config/buffer.graphql anpassen)'}`; res.bufferMutations = c.mutations; } catch (e) { res.buffer = 'Fehler: ' + e.message; } }
  else res.buffer = 'nicht konfiguriert';
  res.anthropic = process.env.ANTHROPIC_API_KEY ? 'konfiguriert (optional)' : 'nicht konfiguriert (Pakete per Claude Code)';
  return out(res);
}
const cmds = {
  validate: () => { const v = validatePackage(readJSON(rest[0]), config()); return out(v); },
  produce,
  approve: () => { const l = new Ledger(), by = flag('by'); if (!by) throw new Error('--by <Name> fehlt'); const e = l.get(rest[0]); if (!e) throw new Error('unbekannt'); if (!e.qa?.ok) throw new Error('QA nicht bestanden – Freigabe nicht möglich'); l.upsert(rest[0], { approval: { by, at: nowISO() } }); return out(l.transition(rest[0], 'approved', `Freigabe: ${by}`)); },
  reject: () => { const l = new Ledger(); l.upsert(rest[0], { rejection: { why: flag('why', ''), at: nowISO() } }); return out(l.transition(rest[0], 'rejected', flag('why', ''))); },
  publish: async () => { const cfg = config(), l = new Ledger(); const r = await publish({ id: rest[0], mode: (flag('mode', cfg.mode) || 'A').toUpperCase(), cfg, ledger: l, channel: flag('channel', 'tiktok'), videoUrl: flag('video-url'), dueAt: flag('at') }); return out({ ok: true, ...r }); },
  status: async () => { const l = new Ledger(); return out({ id: rest[0], publish: await refreshStatus({ id: rest[0], ledger: l }), status: l.get(rest[0]).status }); },
  list: () => out(Object.values(new Ledger().d.videos).map(v => ({ id: v.id, status: v.status, qa: v.qa?.ok, publish: (v.publish || []).map(x => `${x.channel}:${x.status}`) }))),
  costs: () => { const l = new Ledger(); return out({ month: l.month(), spentEUR: l.spent(), limitEUR: config().budget.monthlyLimit }); },
  check
};
if (!cmds[cmd]) { console.error('Befehle: ' + Object.keys(cmds).join(', ')); process.exit(2); }
Promise.resolve(cmds[cmd]()).then(r => process.exit(r && r.ok === false ? 1 : 0)).catch(e => { out({ ok: false, error: e.message }); process.exit(1); });
