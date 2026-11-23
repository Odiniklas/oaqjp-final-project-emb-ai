/* Lebenshub – Terminlogik für wiederkehrende Aufgaben.
   Wird von der App (Fenster) und vom Service Worker gemeinsam genutzt. */
(function (g) {
  'use strict';
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  const P = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const add = (s, n) => { const d = P(s); d.setUTCDate(d.getUTCDate() + n); return ymd(d); };
  const diff = (a, b) => Math.round((P(b) - P(a)) / 864e5);
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const nowHM = () => { const d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const dim = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const WDL = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const fd = s => { const d = P(s); return pad(d.getUTCDate()) + '.' + pad(d.getUTCMonth() + 1) + '.'; };
  const fdy = s => fd(s) + String(P(s).getUTCFullYear()).slice(2);

  function firstWd(start, wd) { for (let i = 0; i < 7; i++) { const s = add(start, i); if (P(s).getUTCDay() === wd) return s; } return start; }

  function isOcc(r, s) {
    if (r.start && s < r.start) return false;
    const d = P(s), ev = Math.max(1, parseInt(r.every, 10) || 1);
    if (r.freq === 'daily') return diff(r.start || s, s) % ev === 0;
    if (r.freq === 'weekly') {
      if (d.getUTCDay() !== +r.wd) return false;
      if (ev === 1) return true;
      const k = diff(firstWd(r.start || s, +r.wd), s);
      return k >= 0 && (k / 7) % ev === 0;
    }
    if (r.freq === 'monthly') {
      const md = Math.min(+r.md, dim(d.getUTCFullYear(), d.getUTCMonth()));
      if (d.getUTCDate() !== md) return false;
      if (ev === 1 || !r.start) return true;
      const a = P(r.start);
      const months = (d.getUTCFullYear() - a.getUTCFullYear()) * 12 + d.getUTCMonth() - a.getUTCMonth();
      return months % ev === 0;
    }
    return false;
  }
  function lastOcc(r, t) { for (let i = 0; i < 1200; i++) { const s = add(t, -i); if (r.start && s < r.start) return null; if (isOcc(r, s)) return s; } return null; }
  function nextOcc(r, after) { for (let i = 1; i < 1200; i++) { const s = add(after, i); if (isOcc(r, s)) return s; } return null; }

  /* Zustand einer Routine an Tag t: aktuelle Fälligkeit, ob offen, nächster Termin */
  function state(r, t) {
    const cur = lastOcc(r, t);
    const due = !!cur && (!r.last || r.last < cur);
    return { cur, due, overdue: due && cur < t, next: due ? cur : nextOcc(r, t) };
  }

  function freqLabel(r) {
    const ev = Math.max(1, parseInt(r.every, 10) || 1);
    if (r.freq === 'daily') return ev === 1 ? 'täglich' : 'alle ' + ev + ' Tage';
    if (r.freq === 'weekly') return (ev === 1 ? 'wöchentlich' : 'alle ' + ev + ' Wochen') + ', ' + WD[+r.wd];
    if (r.freq === 'monthly') return (ev === 1 ? 'monatlich' : ev === 3 ? 'quartalsweise' : 'alle ' + ev + ' Monate') + (+r.md >= 31 ? ', letzter Tag' : ' am ' + r.md + '.');
    return '';
  }

  /* Welche Benachrichtigungen jetzt anstehen (data = Snapshot aus der App) */
  function dueNotifs(data) {
    const t = today(), hm = nowHM(), def = data.defTime || '08:00', out = [];
    (data.routines || []).forEach(r => {
      const st = state(r, t);
      if (!st.due) return;
      if (st.overdue || (r.time || def) <= hm) {
        out.push({ tag: 'r-' + r.id + '-' + st.cur, day: t, title: r.n,
          body: (st.overdue ? 'Überfällig seit ' + fd(st.cur) : 'Heute fällig · ' + freqLabel(r)) + (r.note ? '\n' + r.note : '') });
      }
    });
    if (hm >= def) {
      const tm = add(t, 1);
      (data.dates || []).forEach(it => {
        if (it.d === t) out.push({ tag: 'd-' + it.id + '-' + t, day: t, title: 'Heute: ' + it.n, body: it.list });
        else if (it.d === tm) out.push({ tag: 'd-' + it.id + '-pre-' + it.d, day: t, title: 'Morgen: ' + it.n, body: it.list });
      });
    }
    return out;
  }

  const DC = 'lebenshub-data', DK = 'lebenshub-data.json', SK = 'lebenshub-sent.json';
  async function notifyDue(reg) {
    if (!reg || !g.caches) return 0;
    const c = await caches.open(DC), r = await c.match(DK);
    if (!r) return 0;
    const data = await r.json();
    if (!data.notify) return 0;
    const sr = await c.match(SK);
    const sent = sr ? await sr.json() : {};
    let n = 0;
    for (const x of dueNotifs(data)) {
      if (sent[x.tag]) continue;
      try {
        await reg.showNotification(x.title, { body: x.body, tag: x.tag, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: './' } });
        sent[x.tag] = x.day; n++;
      } catch (e) { /* Benachrichtigung nicht möglich */ }
    }
    const cut = add(today(), -14);
    Object.keys(sent).forEach(k => { if (sent[k] < cut) delete sent[k]; });
    await c.put(SK, new Response(JSON.stringify(sent), { headers: { 'content-type': 'application/json' } }));
    return n;
  }

  g.LH = { pad, P, add, diff, today, nowHM, WD, WDL, fd, fdy, isOcc, lastOcc, nextOcc, state, freqLabel, dueNotifs, notifyDue, DC, DK, firstWd };
})(typeof self !== 'undefined' ? self : this);
