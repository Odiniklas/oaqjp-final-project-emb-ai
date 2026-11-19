/* Lebenshub – ZIP entpacken, Word/Excel/PowerPoint in lesbaren Text umwandeln, Bereich erraten.
   JSZip wird nur bei Bedarf von cdnjs geladen. */
'use strict';
let zipP = null;
function loadZip() {
  return zipP || (zipP = new Promise((ok, no) => {
    if (window.JSZip) return ok(window.JSZip);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    s.onload = () => ok(window.JSZip); s.onerror = () => { zipP = null; no(new Error('Entpacken nicht möglich (keine Verbindung).')); };
    document.head.appendChild(s);
  }));
}
const EXT_TYPE = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
  txt: 'text/plain', md: 'text/plain', csv: 'text/csv', json: 'application/json' };
const ext = n => (String(n).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
const xmlText = s => s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

async function officeToText(zip, kind) {
  if (kind === 'docx') {
    const x = await zip.file('word/document.xml').async('string');
    return xmlText(x.replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, '\t')).replace(/\n{3,}/g, '\n\n').trim();
  }
  if (kind === 'pptx') {
    const slides = Object.keys(zip.files).filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f)).sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));
    const out = [];
    for (const f of slides) out.push('[Folie ' + f.match(/\d+/)[0] + ']\n' + xmlText((await zip.file(f).async('string')).replace(/<\/a:p>/g, '\n')).trim());
    return out.join('\n\n');
  }
  if (kind === 'xlsx') {
    const ss = zip.file('xl/sharedStrings.xml') ? (await zip.file('xl/sharedStrings.xml').async('string')).split(/<si>/).slice(1).map(x => xmlText(x.split('</si>')[0])) : [];
    const sheets = Object.keys(zip.files).filter(f => /^xl\/worksheets\/sheet\d+\.xml$/.test(f)).sort();
    const out = [];
    for (const f of sheets) {
      const x = await zip.file(f).async('string'), rows = [];
      (x.match(/<row[^>]*>[\s\S]*?<\/row>/g) || []).forEach(r => {
        const cells = [];
        (r.match(/<c [^>]*?(\/>|>[\s\S]*?<\/c>)/g) || []).forEach(c => {
          const ref = (c.match(/r="([A-Z]+)\d+"/) || [])[1] || 'A';
          const col = ref.split('').reduce((s, ch) => s * 26 + ch.charCodeAt(0) - 64, 0) - 1;
          let v = (c.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
          if (v == null) v = xmlText((c.match(/<is>([\s\S]*?)<\/is>/) || [])[1] || '');
          else if (/t="s"/.test(c)) v = ss[+v] || '';
          cells[col] = /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
        });
        rows.push(Array.from(cells, v => v || '').join(';'));
      });
      out.push('[Tabelle ' + f.match(/\d+/)[0] + ']\n' + rows.join('\n'));
    }
    return out.join('\n\n');
  }
  return '';
}
function guessArea(path) {
  const p = path.toLowerCase();
  if (/gesund|arzt|ärzt|kranken|klinik|befund|impf|physio|reha|zahn|aok|tk\b|barmer/.test(p)) return 'health';
  if (/finanz|bank|konto|depot|trade.?republic|comdirect|steuer|versicher|police|rente|wohnung|miete|kfz|auto|fahrzeug|mobil|rechnung|vertrag|kredit|sparplan|gehalt|lohn/.test(p)) return 'money';
  return 'work';
}
/* Dateien vorbereiten: ZIPs entpacken, Office-Dateien umwandeln. Ergebnis: [{file, area?}], skipped:[Namen] */
async function expandFiles(list, progress) {
  const out = [], skipped = [];
  const officeFile = async (blob, name, folder) => {
    const JSZip = await loadZip(), z = await JSZip.loadAsync(blob), kind = ext(name);
    const text = await officeToText(z, kind);
    if (!text.trim()) { skipped.push(name); return; }
    out.push({ file: new File([text], name + '.txt', { type: 'text/plain' }), area: guessArea(folder + '/' + name), from: name });
  };
  for (const f of list) {
    const e = ext(f.name);
    try {
      if (e === 'zip') {
        const JSZip = await loadZip(), z = await JSZip.loadAsync(f);
        const entries = Object.values(z.files).filter(x => !x.dir && !/(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)/.test(x.name) && !/(^|\/)\._/.test(x.name));
        let i = 0;
        for (const x of entries) {
          i++; if (progress) progress('Entpacke ' + i + '/' + entries.length + ' …');
          const name = x.name.split('/').pop(), folder = x.name.split('/').slice(0, -1).join('/'), xe = ext(name);
          const blob = await x.async('blob');
          if (['docx', 'xlsx', 'pptx'].includes(xe)) await officeFile(blob, name, folder);
          else if (EXT_TYPE[xe]) out.push({ file: new File([blob], name, { type: EXT_TYPE[xe] }), area: guessArea(x.name), from: f.name });
          else skipped.push(name);
        }
      } else if (['docx', 'xlsx', 'pptx'].includes(e)) await officeFile(f, f.name, '');
      else if (EXT_TYPE[e] || /^(image|text)\//.test(f.type) || f.type === 'application/pdf') out.push({ file: f });
      else skipped.push(f.name);
    } catch (er) { skipped.push(f.name + ' (' + (er.message || 'nicht lesbar') + ')'); }
  }
  return { items: out, skipped };
}
