/* Lebenshub – Promotion/Forschungsstand je Arbeitspaket (AP1–AP8) und Feedback zu Claude-Jobs.
   Forschungsstand: zählt Wissenseinträge mit Tag „AP1“ … „AP8“ (setzt der Wissensagent automatisch).
   Feedback: 👍/👎 je Job-Ergebnis in S.jobLog[i].fb – das Wochenreview wertet es aus und schlägt Verbesserungen vor. */
'use strict';
const AP_LIST = [['AP1', 'Problem, Systemgrenze, Datenkatalog'], ['AP2', 'Baseline ohne Koordination'], ['AP3', 'Dispatch und Netzrestriktionen'], ['AP4', 'Multi-Use-BESS und Alterung'],
  ['AP5', 'Sektorkopplung, mehrstufige Optimierung'], ['AP6', 'Markt- und Regulierungsarchitektur'], ['AP7', 'Wirtschaftlichkeit, Investitionspfade'], ['AP8', 'Sensitivität, Robustheit, Transfer']];
function apCounts() {
  const K = typeof know === 'function' ? know() : [];
  const has = (k, t) => (k.tags || []).some(x => String(x).toLowerCase() === t.toLowerCase());
  return { K, promo: K.filter(k => has(k, 'Promotion')), counts: AP_LIST.map(([ap]) => K.filter(k => has(k, ap)).length) };
}
function promoCard() {
  const { promo, counts } = apCounts();
  if (!promo.length) return '';
  const max = Math.max(1, ...counts), min = Math.min(...counts), toRead = promo.filter(k => k.status === 'Zu lesen').length;
  const thin = AP_LIST.filter((a, i) => counts[i] === min).map(a => a[0]);
  return `<section class="card wide promo"><h2>🎓 Promotion – Forschungsstand<small>${promo.length} Einträge · ${toRead} zu lesen</small></h2>
    <div class="hint">Multi-Energy-Hubs unter Netzanschlussrestriktionen. Der Wissensagent füllt täglich zuerst die dünnsten Arbeitspakete.</div>
    ${AP_LIST.map(([ap, name], i) => `<button class="aprow${KNOWTAG === ap ? ' on' : ''}" data-act="ktag" data-v="${ap}"><b>${ap}</b><span class="apn">${esc(name)}</span><span class="apbar"><i style="width:${Math.round(counts[i] / max * 100)}%"></i></span><span class="apc${counts[i] === min ? ' thin' : ''}">${counts[i]}</span></button>`).join('')}
    <div class="hint">Am dünnsten belegt: ${thin.join(', ')} – tippe ein Arbeitspaket, um seine Quellen unten im Wissen zu sehen.</div>
    ${typeof promptDlg === 'function' ? '<div class="btns"><button class="btn" data-act="prOpen" data-n="5">Exposé mit Odi</button><button class="btn ghost" data-act="prOpen" data-n="4">Literatur-Review</button></div>' : ''}</section>`;
}
function jobFbButtons(j, i) {
  return `<span class="jobfb"><button class="chip${j.fb === 'up' ? ' on' : ''}" data-act="jobfb" data-i="${i}" data-v="up" aria-label="Hilfreich">👍</button><button class="chip${j.fb === 'down' ? ' on' : ''}" data-act="jobfb" data-i="${i}" data-v="down" aria-label="Nicht hilfreich">👎</button></span>`;
}
function researchAct(act, b) {
  if (act !== 'jobfb') return false;
  const j = (S.jobLog || [])[Number(b.dataset.i)], v = b.dataset.v;
  if (!j) return true;
  if (j.fb === v) { delete j.fb; delete j.fbWhy; save(); return true; }
  j.fb = v; j.fbAt = new Date().toISOString();
  if (v === 'down') {
    askText('Was war nicht hilfreich?', 'z. B. falsch, unwichtig, zu lang, Quelle fehlt').then(t => { if (t) j.fbWhy = String(t).slice(0, 200); save('Danke – das Wochenreview wertet es aus'); });
  } else save('Danke für die Rückmeldung');
  return true;
}
