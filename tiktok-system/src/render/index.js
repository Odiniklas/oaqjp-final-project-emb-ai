// Rendert ein Content-Paket mit Remotion zu MP4/H.264 (1080×1920). Shotstack wäre ein alternativer Adapter.
import fs from 'node:fs';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { p } from '../lib/util.js';

/* Szenenzeiten aus den Wort-Zeitstempeln ableiten: jede Szene beginnt mit ihrem ersten Wort */
export function timeScenes(scenes, words, duration) {
  let k = 0; const out = [];
  scenes.forEach((s, i) => {
    const n = s.say.trim().split(/\s+/).filter(Boolean).length;
    const start = i === 0 ? 0 : (words[k] ? Math.max(0, words[k].start - 0.1) : duration);
    out.push({ ...s, start, wordFrom: k, wordTo: k + n }); k += n;
  });
  out.forEach((s, i) => { s.end = i < out.length - 1 ? out[i + 1].start : duration; });
  return out;
}
export async function render({ pkg, voice, cfg, outDir, onProgress }) {
  const pub = path.join(outDir, 'public'); fs.mkdirSync(pub, { recursive: true });
  const audioName = path.basename(voice.file); fs.copyFileSync(voice.file, path.join(pub, audioName));
  const duration = Math.max(voice.duration + 0.6, 3);
  const props = { scenes: timeScenes(pkg.scenes, voice.words, duration), words: voice.words, style: cfg.style, audio: audioName, duration, aiLabel: pkg.aiDisclosure ? 'Stimme: KI' : null, channel: cfg.channel, ...cfg.video };
  const serveUrl = await bundle({ entryPoint: p('src', 'render', 'remotion', 'index.jsx'), publicDir: pub });
  const browserExecutable = process.env.REMOTION_BROWSER || (fs.existsSync('/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell') ? '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell' : null);
  const composition = await selectComposition({ serveUrl, id: 'Short', inputProps: props, browserExecutable });
  const file = path.join(outDir, 'video.mp4');
  await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: file, inputProps: props, browserExecutable, crf: 20, pixelFormat: 'yuv420p', colorSpace: 'bt709', audioCodec: 'aac', onProgress: onProgress ? ({ progress }) => onProgress(progress) : undefined, chromiumOptions: { gl: 'swangle' } });
  fs.writeFileSync(path.join(outDir, 'render-props.json'), JSON.stringify(props, null, 2));
  return { file, duration, props };
}
