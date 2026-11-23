// TikTok-Beschreibung mit Hashtags (max. 2200 Zeichen, Hashtags dedupliziert und begrenzt).
export function buildCaption(pkg, cfg) {
  const max = cfg.hashtags?.max ?? 5;
  const tags = [...new Set([...(pkg.hashtags || []), ...(cfg.hashtags?.base || [])].map(t => '#' + String(t).replace(/^#/, '').toLowerCase().replace(/[^a-zäöüß0-9_]/g, '')))].filter(t => t.length > 1).slice(0, max);
  let text = String(pkg.caption || pkg.topic).trim();
  if (pkg.aiDisclosure && !/ki-generiert|künstliche intelligenz|ki-stimme/i.test(text)) text += ' Stimme KI-generiert.';
  const full = `${text}\n\n${tags.join(' ')}`.slice(0, 2200);
  const sourcesComment = 'Quellen:\n' + (pkg.sources || []).map(s => `• ${s.publisher || ''}: ${s.title} – ${s.url}`).join('\n');
  return { text: full, hashtags: tags, sourcesComment };
}
