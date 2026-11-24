/* Lebenshub – Wetter: ein täglicher Claude-Job (Websuche, Abo) schreibt die Vorhersage über die Sammelbox;
   beim Öffnen aktualisiert live.js sie über den AccuWeather-Connector (inkl. amtlicher Warnungen).
   S.weather = { place, at, tip, alert, src, days:[{d, tmin, tmax, rain, desc}] } */
'use strict';
function weatherTool(name, x) {
  if (name !== 'set_weather') return null;
  const days = (Array.isArray(x.days) ? x.days : []).filter(d => d && /^\d{4}-\d{2}-\d{2}$/.test(d.date || d.d || '')).slice(0, 4)
    .map(d => ({ d: d.date || d.d, tmin: nz(d.tmin), tmax: nz(d.tmax), rain: nz(d.rain), desc: String(d.desc || '').slice(0, 80) }));
  if (!days.length) throw new Error('Keine Tage');
  S.weather = { place: String(x.place || '').slice(0, 60), tip: String(x.tip || '').slice(0, 200), at: new Date().toISOString(), days };
  return { label: '🌦 Wetter ' + (S.weather.place || '') + ': ' + days[0].desc + ', ' + (days[0].tmin != null ? Math.round(days[0].tmin) + '–' : '') + (days[0].tmax != null ? Math.round(days[0].tmax) + ' °C' : ''), result: 'ok' };
}
const WEATHER_TOOLS = [{ name: 'set_weather', description: 'Wettervorhersage für die nächsten Tage speichern (Tagesbeginn).',
  input_schema: { type: 'object', additionalProperties: false, required: ['days'], properties: { place: { type: 'string' }, tip: { type: 'string', description: 'kurzer Alltags-/Trainingstipp' },
    days: { type: 'array', items: { type: 'object', properties: { date: { type: 'string' }, tmin: { type: 'number' }, tmax: { type: 'number' }, rain: { type: 'number', description: 'Regenwahrscheinlichkeit %' }, desc: { type: 'string' } } } } } } }];
const wIcon = s => /gewitter/i.test(s) ? '⛈' : /schnee/i.test(s) ? '🌨' : /regen|schauer|niesel/i.test(s) ? '🌧' : /nebel/i.test(s) ? '🌫' : /wolkig|bedeckt|bewölkt/i.test(s) ? (/sonn|heiter|auflock/i.test(s) ? '⛅' : '☁️') : /sonn|klar|heiter/i.test(s) ? '☀️' : '🌤';
function weatherCard() {
  const W = S.weather;
  if (!W || !W.days || !W.days.length) return '';
  const t = H.today(), days = W.days.filter(d => d.d >= t).slice(0, 3);
  if (!days.length) return '';
  const stale = W.days[0].d < H.add(t, -1);
  return `<section class="card wx"><h2>Wetter${W.place ? ' · ' + esc(W.place) : ''}<small>${stale ? 'veraltet' : (W.src ? esc(W.src) + ' · ' : '') + new Date(W.at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}${ART.mcp ? ' <button class="chip" data-act="wxLive" title="Live aktualisieren">↻</button>' : ''}</small></h2>
    ${W.alert ? `<div class="hint warn">⚠️ ${esc(W.alert)}</div>` : ''}
    <div class="wxrow">${days.map(d => `<div class="wxd"><div class="wxn">${d.d === t ? 'Heute' : d.d === H.add(t, 1) ? 'Morgen' : H.WD[H.P(d.d).getUTCDay()]}</div><div class="wxi">${wIcon(d.desc)}</div>
      <div class="wxt">${d.tmax != null ? Math.round(d.tmax) + '°' : '–'}<small>${d.tmin != null ? ' / ' + Math.round(d.tmin) + '°' : ''}</small></div><div class="wxs">${esc(d.desc)}${d.rain != null ? ' · ' + Math.round(d.rain) + ' %' : ''}</div></div>`).join('')}</div>
    ${W.tip ? `<div class="hint">${esc(W.tip)}</div>` : ''}</section>`;
}
