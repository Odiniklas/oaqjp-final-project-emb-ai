// End-to-End (Modus A): echtes Rendern mit Remotion + QA, ohne Netzwerk und ohne Veröffentlichung.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
test('Modus A: Beispielpaket wird vollständig produziert und nicht veröffentlicht', { timeout: 600000 }, () => {
  const ledger = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-')), 'ledger.json');
  const env = { ...process.env, LEDGER_FILE: ledger, ELEVENLABS_API_KEY: '' };
  const r = spawnSync('node', ['src/cli.js', 'produce', 'content/examples/solarspitzen.json', '--mode', 'A'], { cwd: root, env, encoding: 'utf8' });
  const res = JSON.parse(r.stdout.trim().split('\n').at(-1));
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(res.status, 'qa_passed');
  const info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', res.video]).toString());
  const v = info.streams.find(s => s.codec_type === 'video');
  assert.equal(v.width, 1080); assert.equal(v.height, 1920); assert.equal(v.codec_name, 'h264');
  assert.ok(info.streams.some(s => s.codec_type === 'audio'));
  assert.ok(res.duration >= 25 && res.duration <= 45, String(res.duration));
  for (const f of ['meta.json', 'qa.json', 'render-props.json']) assert.ok(fs.existsSync(path.join(root, 'output', res.id, f)), f);
  const pub = spawnSync('node', ['src/cli.js', 'publish', res.id, '--mode', 'A', '--video-url', 'https://example.org/x.mp4'], { cwd: root, env, encoding: 'utf8' });
  assert.notEqual(pub.status, 0); assert.match(pub.stdout, /Modus A/);
  const again = spawnSync('node', ['src/cli.js', 'publish', res.id, '--mode', 'B', '--video-url', 'https://example.org/x.mp4'], { cwd: root, env, encoding: 'utf8' });
  assert.match(again.stdout, /Freigabe fehlt/);
});
