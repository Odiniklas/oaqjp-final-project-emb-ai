/* Lebenshub – Termine aus Fotos: Fotos/Screenshots auswählen, Claude (Abo) liest Termine aus,
   sie werden in „Termine“ eingetragen und als Kalenderdatei (.ics) für den iPhone-Kalender bereitgestellt. */
'use strict';
let photoBusy = false;
async function shrinkImg(file, max = 1600) {
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(b => r(b || file), 'image/jpeg', 0.85));
  } catch (e) { return file; }
}
function pickPhotos() {
  if (!ART.sample || !ART.imgMax) return toast('Fotos auslesen geht im Lebenshub in Claude (Abo).');
  const i = $('photoFile'); i.value = ''; i.click();
}
async function photosToAppts(files) {
  files = [...files].filter(f => /^image\//.test(f.type) || /\.(heic|jpe?g|png)$/i.test(f.name));
  if (!files.length || photoBusy) return;
  photoBusy = true; busy(true);
  const found = [];
  try {
    const n = Math.max(1, ART.imgMax || 1);
    for (let i = 0; i < files.length; i += n) {
      toast('Lese Fotos ' + (i + 1) + '–' + Math.min(files.length, i + n) + ' von ' + files.length + ' …');
      const imgs = await Promise.all(files.slice(i, i + n).map(f => shrinkImg(f)));
      const out = await ART.sample.json(`Lies auf diesen Fotos/Screenshots alle Termine aus (z. B. Physiotherapie-Terminzettel, Arzt-Termine, Einladungen, Chat-Screenshots, Briefe). Heute ist ${H.today()} (${['So','Mo','Di','Mi','Do','Fr','Sa'][new Date().getDay()]}). Fehlt das Jahr, nimm das nächste passende in der Zukunft. Nur was wirklich auf den Bildern steht, nichts erfinden. Antworte nur mit JSON {"termine":[{"title":"z. B. Physiotherapie","date":"JJJJ-MM-TT","time":"HH:MM oder leer","end":"HH:MM oder leer","place":"Praxis/Adresse oder leer","note":"kurz, z. B. Therapeut, mitbringen"}]}. Keine Termine gefunden → {"termine":[]}.`,
        { images: imgs, modelTier: 'default', effort: 'low', cache: false });
      (out && Array.isArray(out.termine) ? out.termine : []).forEach(x => {
        if (!x || !/^\d{4}-\d{2}-\d{2}$/.test(x.date || '')) return;
        const a = { title: String(x.title || 'Termin').trim(), date: x.date, time: /^\d{1,2}:\d{2}$/.test(x.time || '') ? x.time.padStart(5, '0') : '', end: /^\d{1,2}:\d{2}$/.test(x.end || '') ? x.end.padStart(5, '0') : '', place: String(x.place || ''), note: String(x.note || '') };
        if (!found.some(y => y.title === a.title && y.date === a.date && y.time === a.time)) found.push(a);
      });
    }
  } catch (e) { toast(typeof sampleErr === 'function' ? sampleErr(e) : (e.message || 'Fotos nicht lesbar')); photoBusy = false; busy(false); return; }
  photoBusy = false; busy(false);
  if (!found.length) return toast('Auf den Fotos wurden keine Termine gefunden.');
  found.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const dup = a => S.lists.t.some(it => it.d === a.date && it.n.trim().toLowerCase() === a.title.toLowerCase() && (it.tm || '') === a.time);
  openDlg(`<h3>${found.length} Termin${found.length > 1 ? 'e' : ''} gefunden</h3>
    ${found.map((a, i) => `<label class="f"><span><input type="checkbox" name="c${i}" ${dup(a) ? '' : 'checked'}> <b>${esc(a.title)}</b> · ${esc(H.fd(a.date))}${a.time ? ' · ' + a.time + (a.end ? '–' + a.end : '') : ''}${a.place ? ' · ' + esc(a.place) : ''}${dup(a) ? ' <span class="chip d">schon drin</span>' : ''}</span></label>`).join('')}
    <label class="f"><span><input type="checkbox" name="ics" checked> zusätzlich als Kalenderdatei für den iPhone-Kalender speichern</span></label>
    <div class="btns"><button class="btn" value="go">Übernehmen</button><button class="btn ghost" value="cancel" formnovalidate>Abbrechen</button></div>`, (v, f) => {
    const sel = found.filter((a, i) => f['c' + i].checked);
    if (!sel.length) return;
    sel.forEach(a => { if (!dup(a)) S.lists.t.push({ id: uid(), n: a.title, t: [a.time ? a.time + (a.end ? '–' + a.end : '') + ' Uhr' : '', a.place, a.note].filter(Boolean).join(' · '), d: a.date, tm: a.time, te: a.end, s: 0 }); });
    save(sel.length + ' Termin(e) eingetragen');
    if (f.ics.checked) download(sel.length === 1 ? 'termin.ics' : 'termine.ics', 'text/calendar', apptIcs(sel));
  });
}
function apptIcs(list) {
  const ix = s => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const D = s => s.replace(/-/g, ''), T = s => s.replace(':', '') + '00';
  const now = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lebenshub//DE', 'METHOD:PUBLISH'];
  list.forEach(a => {
    L.push('BEGIN:VEVENT', 'UID:' + uid() + '@lebenshub', 'DTSTAMP:' + now);
    if (a.time) {
      const end = a.end || (() => { const [h, m] = a.time.split(':').map(Number), x = h * 60 + m + 60; return String(Math.floor(x / 60) % 24).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); })();
      L.push('DTSTART;TZID=Europe/Berlin:' + D(a.date) + 'T' + T(a.time), 'DTEND;TZID=Europe/Berlin:' + D(a.date) + 'T' + T(end));
    } else L.push('DTSTART;VALUE=DATE:' + D(a.date), 'DTEND;VALUE=DATE:' + D(H.add(a.date, 1)));
    L.push('SUMMARY:' + ix(a.title));
    if (a.place) L.push('LOCATION:' + ix(a.place));
    if (a.note) L.push('DESCRIPTION:' + ix(a.note));
    L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + ix(a.title), 'TRIGGER:' + (a.time ? '-PT1H' : '-PT15H'), 'END:VALARM', 'END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.join('\r\n') + '\r\n';
}
function photoCard() {
  if (!ART.sample || !ART.imgMax) return '';
  return `<section class="card"><h2>Termine aus Fotos<small>Physio, Arzt, Briefe …</small></h2>
    <div class="hint">Fotos oder Screenshots von Terminzetteln auswählen (mehrere auf einmal). Claude liest die Termine aus, trägt sie unter „Termine“ ein und erstellt eine Kalenderdatei für den iPhone-Kalender.</div>
    <div class="btns"><button class="btn" data-act="photos">Fotos auswählen</button></div></section>`;
}
function photoAct(act) { if (act === 'photos') { pickPhotos(); return true; } return false; }
document.addEventListener('change', e => { if (e.target.id === 'photoFile') photosToAppts(e.target.files); });
