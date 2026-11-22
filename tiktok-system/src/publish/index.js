// Veröffentlichung mit Modus-Sperren und Schutz vor doppelten Uploads.
import { fileHash, nowISO } from '../lib/util.js';
import * as buffer from './buffer.js';

export const AUTOPUBLISH_PHRASE = 'JA_AUTONOM_VEROEFFENTLICHEN';
export function gate({ mode, cfg, entry, publishedToday = 0, env = process.env }) {
  if (!entry) return 'Video unbekannt';
  if (mode === 'A') return 'Modus A (Test) veröffentlicht nie';
  if (!entry.qa?.ok) return 'QA nicht bestanden';
  if (mode === 'B') return entry.status === 'approved' && entry.approval?.by ? null : 'Modus B: Freigabe fehlt (node src/cli.js approve <id> --by <Name>)';
  if (mode === 'C') {
    if (cfg.mode !== 'C' || !cfg.autonomous?.enabled) return 'Modus C ist in config/channel.json nicht aktiviert';
    if (env.AUTOPUBLISH_CONFIRM !== AUTOPUBLISH_PHRASE) return `Modus C: AUTOPUBLISH_CONFIRM=${AUTOPUBLISH_PHRASE} fehlt`;
    if (cfg.autonomous.requireZeroWarnings && entry.qa.warnings?.length) return 'Modus C: QA-Warnungen vorhanden';
    if (publishedToday >= (cfg.autonomous.maxPostsPerDay ?? 1)) return 'Modus C: Tageslimit erreicht';
    return ['approved', 'qa_passed'].includes(entry.status) ? null : `Status ${entry.status} nicht veröffentlichbar`;
  }
  return 'Unbekannter Modus';
}
export async function publish({ id, mode, cfg, ledger, channel = 'tiktok', videoUrl, dueAt, adapter = buffer, env = process.env }) {
  const entry = ledger.get(id);
  const today = nowISO().slice(0, 10);
  const publishedToday = Object.values(ledger.d.videos).flatMap(v => v.publish || []).filter(x => x.at?.startsWith(today) && x.status !== 'failed').length;
  const why = gate({ mode, cfg, entry, publishedToday, env }); if (why) throw new Error(why);
  if (!cfg.channels?.[channel]?.enabled) throw new Error(`Kanal ${channel} ist nicht aktiviert`);
  const key = ledger.publishKey(id, channel, fileHash(entry.files.video));
  const dup = ledger.alreadyPublished(key); if (dup) throw new Error(`Doppelter Upload verhindert: bereits ${dup.id} (${channel})`);
  if (!videoUrl) throw new Error('videoUrl fehlt: Buffer braucht eine öffentlich erreichbare Video-URL (siehe docs/API-ZUGAENGE.md, Medien-Hosting)');
  const channelId = env[`BUFFER_${channel.toUpperCase()}_CHANNEL_ID`]; if (!channelId) throw new Error(`BUFFER_${channel.toUpperCase()}_CHANNEL_ID fehlt`);
  const rec = { channel, key, status: 'sending', at: nowISO(), dueAt: dueAt || null };
  entry.publish = [...(entry.publish || []), rec]; ledger.save(); // vor dem API-Aufruf vermerken: Absturz ⇒ kein zweiter Versand
  try {
    const post = await adapter.schedule({ channelId, text: entry.caption.text, videoUrl, dueAt, comment: entry.caption.sourcesComment });
    Object.assign(rec, { status: 'scheduled', postId: post.id, providerStatus: post.status }); ledger.save();
    if (entry.status !== 'scheduled') ledger.transition(id, 'scheduled', `${channel}: ${post.id}`);
    return rec;
  } catch (err) {
    Object.assign(rec, { status: 'failed', error: String(err.message || err) }); ledger.save();
    if (entry.status === 'approved') ledger.transition(id, 'publish_failed', rec.error);
    throw err;
  }
}
export async function refreshStatus({ id, ledger, adapter = buffer }) {
  const entry = ledger.get(id); const out = [];
  for (const rec of entry.publish || []) {
    if (!rec.postId || rec.status === 'published') { out.push(rec); continue; }
    const st = await adapter.status(rec.postId); rec.providerStatus = st?.status; rec.checkedAt = nowISO();
    if (/sent|published/i.test(st?.status || '')) rec.status = 'published';
    if (/error|failed/i.test(st?.status || '') || st?.error) { rec.status = 'failed'; rec.error = st?.error?.message || st?.status; }
    out.push(rec);
  }
  ledger.save();
  if (out.length && out.every(r => r.status === 'published') && entry.status === 'scheduled') ledger.transition(id, 'published');
  if (out.some(r => r.status === 'failed') && entry.status === 'scheduled') ledger.transition(id, 'publish_failed', 'Statusprüfung: Fehler');
  return out;
}
