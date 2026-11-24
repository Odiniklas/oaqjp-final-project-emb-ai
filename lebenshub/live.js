/* Lebenshub – Live-Daten über die Connectors des Nutzers (Capability „mcp“):
   AccuWeather → Wettervorhersage + amtliche Warnungen (ersetzt bis zum nächsten Job-Lauf die Websuche),
   Alpha Vantage → aktuelle Kurse der Depot-Positionen (in EUR umgerechnet).
   Im Code stehen keine Orte oder Depotdaten: Ort kommt aus S.weather.place, Positionen aus S.fin.
   Alpha Vantage (kostenloser Schlüssel): höchstens 1 Anfrage pro Sekunde und 25 am Tag → sparsam, mit Pause und Cache. */
'use strict';
const WX_SRV = 'AccuWeather', AV_SRV = 'Alpha Vantage MCP Server';
let wxBusy = false, avBusy = false;
const sleep = ms => new Promise(r => setTimeout(r, ms));
function livePayload(r) {
  if (r && r.payload != null) return r.payload;
  const c = r && Array.isArray(r.content) ? r.content.find(b => b && b.type === 'text') : null;
  try { return c ? JSON.parse(c.text) : r; } catch (e) { return r; }
}
async function liveCall(srv, tool, input) { return livePayload(await ART.mcp.callTool(srv, tool, input, { cache: false })); }
function liveErr(e, name) {
  const c = e && e.code;
  return c === 'server_not_connected' ? name + ' ist in Claude nicht verbunden (Einstellungen → Connectors).' : c === 'not_in_manifest' || c === 'not_granted' ? 'Zugriff auf ' + name + ' wurde für den Hub nicht erlaubt.' : c === 'needs_reauth' ? name + ' bitte in Claude neu verbinden.' : name + ' gerade nicht erreichbar (' + (c || (e && e.message) || '?') + ').';
}
const n1 = v => { const x = parseFloat(v); return isFinite(x) ? Math.round(x * 10) / 10 : null; };

/* ---------- Wetter (AccuWeather) ---------- */
async function wxLive(manual) {
  if (!ART.mcp || wxBusy) { if (manual && !ART.mcp) toast('Live-Wetter geht nur im Lebenshub in Claude.'); return; }
  const W = S.weather || {}, place = W.place || (S.settings && S.settings.wxPlace) || '';
  if (!place) { if (manual) toast('Noch kein Ort bekannt – der Wetter-Job legt ihn beim ersten Lauf fest.'); return; }
  wxBusy = true;
  try {
    const st = S.settings;
    if (!st.wxKey || st.wxKeyPlace !== place) {
      const r = await liveCall(WX_SRV, 'widgets-search-claude', { queryParams: { query: place } });
      const hit = r && Array.isArray(r.results) ? r.results[0] : null;
      if (!hit || !hit.locationKey) throw Object.assign(new Error('Ort nicht gefunden'), { code: 'kein Ort' });
      st.wxKey = String(hit.locationKey); st.wxKeyPlace = place;
    }
    const r = await liveCall(WX_SRV, 'widgets-daily-claude', { queryParams: { locationKey: st.wxKey, unit: 'metric', lang: 'de' } });
    const F = r && Array.isArray(r.dailyForecast) ? r.dailyForecast : [];
    const days = F.slice(0, 4).map(f => {
      const dy = f.day || {}, nt = f.night || {};
      const rain = Math.max(dy.rainProbabilityValue || 0, dy.snowProbabilityValue || 0, parseFloat(dy.precip) || 0);
      return { d: String(f.date || '').slice(0, 10), tmin: n1(nt.temperature), tmax: n1(dy.temperature), rain: Math.round(rain), desc: String(dy.phrase || dy.iconPhrase || '').slice(0, 80) };
    }).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.d));
    if (!days.length) throw Object.assign(new Error('keine Vorhersage'), { code: 'leer' });
    const al = (r.alerts || []).find(a => a && a.isActive !== false);
    const alert = al ? String(al.alertName || al.name || 'Wetterwarnung').slice(0, 80) + (al.endDate ? ' bis ' + String(al.endDate).replace(/^\w+,\s*/, '') + (al.endTime ? ' ' + al.endTime : '') : '') : '';
    const sameDay = W.days && W.days[0] && W.days[0].d === days[0].d;
    S.weather = { place, tip: sameDay ? (W.tip || '') : '', alert, src: 'AccuWeather', at: new Date().toISOString(), days };
    save(manual ? 'Wetter aktualisiert (AccuWeather)' : undefined);
  } catch (e) { if (manual) toast(liveErr(e, 'AccuWeather')); }
  finally { wxBusy = false; }
}
function wxAuto() { const W = S.weather; if (ART.mcp && W && W.place && (!W.at || Date.now() - Date.parse(W.at) > 3 * 36e5)) wxLive(false); }

/* ---------- Kurse (Alpha Vantage) ---------- */
function avPick(r) {
  const M = r && Array.isArray(r.bestMatches) ? r.bestMatches : [];
  const g = (m, k) => m[Object.keys(m).find(x => x.endsWith(k))];
  const eq = M.filter(m => /equity|etf/i.test(g(m, 'type') || ''));
  const m = eq.find(x => /united states/i.test(g(x, 'region') || '')) || eq.find(x => g(x, 'currency') === 'EUR') || eq[0];
  return m ? { sym: String(g(m, 'symbol')), cur: String(g(m, 'currency') || 'USD') } : null;
}
async function finLive(manual) {
  if (!ART.mcp || avBusy) { if (manual && !ART.mcp) toast('Live-Kurse gehen nur im Lebenshub in Claude.'); return; }
  const P = fin().positions.filter(p => p.qty != null && !p.noLive);
  if (!P.length) { if (manual) toast('Keine Positionen mit Stückzahl.'); return; }
  avBusy = true; if (manual) toast('Kurse werden geladen …');
  const fx = { EUR: 1 }, upd = []; let calls = 0, fail = '';
  const call = async (tool, input) => { if (calls++) await sleep(1300); const r = await liveCall(AV_SRV, tool, input); if (r && r.error) throw Object.assign(new Error(r.error.message || 'Fehler'), { code: r.error.type || 'Fehler' }); if (r && (r.Note || r.Information)) throw Object.assign(new Error('Tageslimit'), { code: 'rate_limit' }); return r; };
  try {
    for (const p of P) {
      try {
        if (!p.sym) { const m = avPick(await call('SYMBOL_SEARCH', { keywords: p.name, datatype: 'json' })); if (!m) { p.noLive = true; continue; } p.sym = m.sym; p.cur = m.cur; }
        const q = (await call('GLOBAL_QUOTE', { symbol: p.sym, datatype: 'json' }))['Global Quote'] || {};
        const price = parseFloat(q['05. price']); if (!isFinite(price) || price <= 0) continue;
        const cur = p.cur || 'USD';
        if (fx[cur] == null) { const x = (await call('CURRENCY_EXCHANGE_RATE', { from_currency: cur, to_currency: 'EUR', datatype: 'json' }))['Realtime Currency Exchange Rate'] || {}; fx[cur] = parseFloat(x['5. Exchange Rate']); }
        if (!isFinite(fx[cur])) continue;
        upd.push({ id: p.id, price: Math.round(price * fx[cur] * 100) / 100, date: String(q['07. latest trading day'] || H.today()).slice(0, 10) });
      } catch (e) { if (e.code === 'rate_limit') { fail = 'Tageslimit von Alpha Vantage erreicht – später erneut.'; break; } fail = liveErr(e, 'Alpha Vantage'); }
    }
    S.settings.finLiveAt = new Date().toISOString();
    if (upd.length) { const r = finTool('set_prices', { prices: upd }); save(manual ? r.label + ' (Alpha Vantage)' : undefined); }
    else { save(); if (manual) toast(fail || 'Keine neuen Kurse gefunden.'); }
  } finally { avBusy = false; }
}
function finLiveAuto() { const t = S.settings && S.settings.finLiveAt; if (ART.mcp && fin().positions.some(p => p.qty != null) && (!t || Date.now() - Date.parse(t) > 12 * 36e5)) finLive(false); }
function liveAct(act) {
  if (act === 'wxLive') { wxLive(true); return true; }
  if (act === 'finLive') { finLive(true); return true; }
  return false;
}
