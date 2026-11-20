/* Lebenshub – Musik ohne Connector: Claude schlägt Songs zur Stimmung vor, Links öffnen Apple Music oder Spotify.
   S.music = { mode, title, at, songs:[{a, t}] } */
'use strict';
const MUSIC_MODES = [['training', 'Training'], ['fokus', 'Fokus'], ['entspannung', 'Entspannung'], ['laune', 'Gute Laune']];
let musicBusy = false;
const amLink = s => 'https://music.apple.com/de/search?term=' + encodeURIComponent(s.a + ' ' + s.t);
const spLink = s => 'https://open.spotify.com/search/' + encodeURIComponent(s.a + ' ' + s.t);
async function musicSuggest(mode) {
  if (musicBusy) return; musicBusy = true; busy(true);
  try {
    const label = (MUSIC_MODES.find(m => m[0] === mode) || [, mode])[1];
    const health = typeof healthSnapshotText === 'function' ? healthSnapshotText().slice(0, 1500) : '';
    const out = await askJson(`Stelle eine kurze Playlist (10 Songs) für „${label}“ zusammen – abwechslungsreich, bekannte und neuere Titel, die es sicher auf Apple Music und Spotify gibt. ${mode === 'training' ? 'Tempo 120–170 BPM, motivierend.' : mode === 'fokus' ? 'Wenig Gesang, ruhig, konzentrationsfördernd.' : mode === 'entspannung' ? 'Ruhig, zum Runterkommen.' : 'Positive Stimmung.'} Berücksichtige meine Tagesform, falls vorhanden: ${health}\nAntworte nur mit JSON {"title":"Name der Playlist","songs":[{"a":"Interpret","t":"Titel"}]}.`);
    const songs = (Array.isArray(out && out.songs) ? out.songs : []).filter(s => s && s.a && s.t).slice(0, 12).map(s => ({ a: String(s.a), t: String(s.t) }));
    if (!songs.length) throw new Error('Keine Vorschläge erhalten');
    S.music = { mode, title: String(out.title || label), at: new Date().toISOString(), songs };
    save('Playlist „' + S.music.title + '“ bereit');
  } catch (e) { toast(e.message || 'Musik-Vorschlag nicht möglich'); } finally { musicBusy = false; busy(false); }
}
function musicCard() {
  if (!(ART.sample || (typeof getKey === 'function' && getKey()))) return '';
  const M = S.music;
  return `<section class="card music"><h2>Musik<small>${M ? esc(M.title) : 'Apple Music & Spotify'}</small></h2>
    <div class="tags">${MUSIC_MODES.map(m => `<button class="chip ${M && M.mode === m[0] ? '' : 'd'}" data-act="mus" data-v="${m[0]}">${m[1]}</button>`).join('')}</div>
    ${M ? M.songs.map(s => `<div class="row"><div class="t">${esc(s.t)}<small>${esc(s.a)}</small></div><span class="mailbtns"><a class="chip d" href="${amLink(s)}" target="_blank" rel="noopener">Apple Music</a><a class="chip d" href="${spLink(s)}" target="_blank" rel="noopener">Spotify</a></span></div>`).join('')
      : '<div class="hint">Wähle eine Stimmung – Claude stellt 10 passende Songs zusammen, jeder lässt sich in Apple Music oder Spotify öffnen.</div>'}</section>`;
}
function musicAct(act, b) { if (act === 'mus') { musicSuggest(b.dataset.v); return true; } return false; }
