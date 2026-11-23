// Automatische Qualitätsprüfung vor jeder Freigabe. Fehler blockieren, Warnungen blockieren nur in Modus C.
import fs from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { validatePackage, voiceoverText } from '../lib/schema.js';

export function probe(file) {
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]).toString());
  const v = j.streams.find(s => s.codec_type === 'video'), a = j.streams.find(s => s.codec_type === 'audio');
  return { width: v?.width, height: v?.height, codec: v?.codec_name, pix: v?.pix_fmt, fps: v ? (([n, d]) => n / (d || 1))(String(v.r_frame_rate).split('/').map(Number)) : null, audio: a?.codec_name || null, duration: parseFloat(j.format.duration), size: parseInt(j.format.size, 10) };
}
export function meanVolume(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'volumedetect', '-vn', '-f', 'null', '-'], { encoding: 'utf8' });
  const m = (r.stderr || '').match(/mean_volume:\s*(-?[\d.]+) dB/); return m ? parseFloat(m[1]) : null;
}
export function checkVideoTech(info, cfg) {
  const e = [], vc = cfg.video;
  if (info.width !== vc.width || info.height !== vc.height) e.push(`Auflösung ${info.width}×${info.height}, erwartet ${vc.width}×${vc.height}`);
  if (info.codec !== 'h264') e.push(`Codec ${info.codec}, erwartet h264`);
  if (info.pix !== 'yuv420p') e.push(`Pixelformat ${info.pix}, erwartet yuv420p`);
  if (!info.audio) e.push('Keine Tonspur');
  if (info.duration < vc.minSeconds - 0.5 || info.duration > vc.maxSeconds + 0.5) e.push(`Dauer ${info.duration.toFixed(1)} s außerhalb ${vc.minSeconds}–${vc.maxSeconds} s`);
  if (info.size > 250 * 1024 * 1024) e.push('Datei größer als 250 MB');
  return e;
}
export function runQA({ pkg, cfg, mode, videoFile, props, ledger, caption, voice }) {
  const errors = [], warnings = [], checks = {};
  const v = validatePackage(pkg, cfg); errors.push(...v.errors); warnings.push(...v.warnings); checks.schema = v.ok;
  // Technik
  if (!videoFile || !fs.existsSync(videoFile)) errors.push('Videodatei fehlt');
  else {
    const info = probe(videoFile); checks.video = info; errors.push(...checkVideoTech(info, cfg));
    const vol = meanVolume(videoFile); checks.meanVolumeDb = vol; if (vol == null || vol < -45) errors.push('Ton fast stumm oder nicht messbar');
  }
  // Untertitel
  if (!props?.words?.length) errors.push('Keine Untertitel-Zeitstempel'); checks.subtitles = props?.words?.length || 0;
  // Fehlende Assets
  (pkg.assets || []).forEach(a => { if (!fs.existsSync(a.path)) errors.push(`Asset fehlt: ${a.path}`); });
  // Doppelte Inhalte
  const dup = ledger?.similar(voiceoverText(pkg), cfg.qa.duplicateThreshold, pkg.id); checks.duplicate = dup;
  if (dup) errors.push(`Inhalt zu ähnlich zu „${dup.id}“ (${Math.round(dup.score * 100)} %)`);
  // Belege
  const unverified = (pkg.sources || []).filter(s => !s.verified).map(s => s.id);
  checks.unverifiedSources = unverified;
  if (unverified.length && cfg.qa.requireVerifiedSources) (mode === 'A' ? warnings : errors).push(`Quellen nicht von Mensch geprüft: ${unverified.join(', ')} – vor Veröffentlichung öffnen und „verified“: true setzen`);
  // Rechte und KI-Kennzeichnung
  if (pkg.aiDisclosure !== true) errors.push('KI-Kennzeichnung fehlt (aiDisclosure)');
  if (caption && !/ki-generiert|ki-stimme|künstliche intelligenz/i.test(caption.text)) errors.push('Beschreibung enthält keinen KI-Hinweis');
  checks.rights = (pkg.assets || []).length ? 'Assets mit Lizenz' : 'nur im Code gezeichnete Grafiken, keine Fremdmedien';
  if (voice?.testOnly) (mode === 'A' ? warnings : errors).push('Test-Stimme (espeak-ng) – nicht zur Veröffentlichung geeignet');
  return { ok: errors.length === 0, errors, warnings, checks, at: new Date().toISOString() };
}
