// Sprechertext → Audiodatei + Wort-Zeitstempel. ElevenLabs (produktiv) oder espeak-ng (nur Testmodus).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { words } from '../lib/util.js';

export function chooseProvider(cfg, mode) {
  const want = cfg.voice?.provider || 'auto';
  if (want === 'elevenlabs' || (want === 'auto' && process.env.ELEVENLABS_API_KEY)) return 'elevenlabs';
  if (mode !== 'A') throw new Error('Kein ELEVENLABS_API_KEY: Produktion mit Test-Stimme ist nur im Modus A erlaubt.');
  return 'espeak';
}
export const estimateCost = (text, cfg, provider) => provider === 'elevenlabs' ? text.length / 1000 * (cfg.budget?.prices?.elevenlabsPer1kChars ?? 0.3) : 0;

export async function synthesize(text, outDir, { provider, cfg }) {
  fs.mkdirSync(outDir, { recursive: true });
  return provider === 'elevenlabs' ? elevenlabs(text, outDir, cfg) : espeak(text, outDir, cfg);
}
function probeDuration(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]).toString().trim();
  return parseFloat(out);
}
/* Wortzeiten aus Zeichenzeiten (ElevenLabs „alignment“) */
export function wordsFromAlignment(al) {
  const out = []; let cur = null;
  al.characters.forEach((ch, i) => {
    if (/\s/.test(ch)) { if (cur) { out.push(cur); cur = null; } return; }
    if (!cur) cur = { w: '', start: al.character_start_times_seconds[i], end: al.character_end_times_seconds[i] };
    cur.w += ch; cur.end = al.character_end_times_seconds[i];
  });
  if (cur) out.push(cur);
  return out;
}
/* Ohne echte Zeitstempel: proportional zur Wortlänge verteilen (Satzzeichen = kurze Pause) */
export function estimateWordTimes(text, duration) {
  const ws = words(text), weight = w => w.replace(/[^\p{L}\p{N}]/gu, '').length + 2 + (/[.!?]$/.test(w) ? 4 : /[,:;]$/.test(w) ? 2 : 0);
  const total = ws.reduce((s, w) => s + weight(w), 0); let t = 0.15; const scale = (duration - 0.3) / total;
  return ws.map(w => { const d = weight(w) * scale; const r = { w, start: +t.toFixed(3), end: +(t + d * 0.92).toFixed(3) }; t += d; return r; });
}
async function elevenlabs(text, outDir, cfg) {
  const voice = process.env.ELEVENLABS_VOICE_ID; if (!voice) throw new Error('ELEVENLABS_VOICE_ID fehlt');
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_128`, {
    method: 'POST', headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2' })
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const j = await res.json();
  const file = path.join(outDir, 'voice.mp3'); fs.writeFileSync(file, Buffer.from(j.audio_base64, 'base64'));
  const wordsT = j.alignment ? wordsFromAlignment(j.alignment) : estimateWordTimes(text, probeDuration(file));
  return { file, duration: probeDuration(file), words: wordsT, provider: 'elevenlabs', synthetic: true };
}
function espeak(text, outDir, cfg) {
  const file = path.join(outDir, 'voice.wav');
  execFileSync('espeak-ng', ['-v', 'de', '-s', String(cfg.voice?.speedWpm || 165), '-w', file, text]);
  const duration = probeDuration(file);
  return { file, duration, words: estimateWordTimes(text, duration), provider: 'espeak', synthetic: true, testOnly: true };
}
