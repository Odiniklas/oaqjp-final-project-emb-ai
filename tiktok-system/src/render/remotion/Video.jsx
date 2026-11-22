// Remotion-Komposition: 1080×1920, Szenen aus dem Content-Paket, Untertitel aus Wort-Zeitstempeln.
// Alle Grafiken werden im Code gezeichnet (keine fremden Bilder → keine Lizenzfragen).
import React from 'react';
import { captionGroups } from '../captions.js';
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

const SAFE = { top: 180, bottom: 420, side: 90, right: 150 }; // TikTok-Bedienelemente freihalten

function useEnter(transition, delay = 0) {
  const f = useCurrentFrame(), { fps } = useVideoConfig();
  const s = spring({ frame: f - delay, fps, config: { damping: 14, mass: 0.7 } });
  const o = interpolate(f - delay, [0, 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  if (transition === 'zoom') return { opacity: o, transform: `scale(${0.8 + 0.2 * s})` };
  if (transition === 'slide') return { opacity: o, transform: `translateX(${(1 - s) * 140}px)` };
  return { opacity: o };
}
const Big = ({ children, style, color }) => <div style={{ fontSize: 150, fontWeight: 800, lineHeight: 1.05, color, textAlign: 'center', letterSpacing: -2, ...style }}>{children}</div>;
const Small = ({ children, style }) => <div style={{ fontSize: 54, fontWeight: 600, opacity: 0.9, textAlign: 'center', marginTop: 28, ...style }}>{children}</div>;

const Icon = ({ name, color, size = 170 }) => {
  const c = color;
  if (name === 'sun') return <svg width={size} height={size} viewBox="0 0 100 100"><circle cx="50" cy="50" r="20" fill={c} />{[...Array(8)].map((_, i) => <rect key={i} x="47" y="8" width="6" height="16" rx="3" fill={c} transform={`rotate(${i * 45} 50 50)`} />)}</svg>;
  if (name === 'battery') return <svg width={size} height={size} viewBox="0 0 100 100"><rect x="18" y="28" width="58" height="44" rx="6" fill="none" stroke={c} strokeWidth="6" /><rect x="78" y="42" width="8" height="16" rx="2" fill={c} /><rect x="25" y="35" width="30" height="30" rx="3" fill={c} /></svg>;
  if (name === 'moon') return <svg width={size} height={size} viewBox="0 0 100 100"><path d="M62 18a34 34 0 1 0 20 52A28 28 0 0 1 62 18z" fill={c} /></svg>;
  return <svg width={size} height={size} viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill={c} /></svg>;
};

function Scene({ scene, style, durationInFrames }) {
  const v = scene.visual, f = useCurrentFrame(), enter = useEnter(scene.transition);
  const box = { position: 'absolute', left: SAFE.side, right: SAFE.right, top: SAFE.top + 120, height: 860, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: style.text, ...enter };
  if (v.type === 'title' || v.type === 'stat') return <div style={box}><Big color={v.type === 'title' ? style.accent : style.text}>{v.big}</Big><Small>{v.small}</Small></div>;
  if (v.type === 'cta') { const pulse = 1 + 0.04 * Math.sin(f / 5); return <div style={box}><div style={{ background: style.accent, color: style.bg1, borderRadius: 999, padding: '40px 110px', fontSize: 110, fontWeight: 800, transform: `scale(${pulse})` }}>{v.big}</div><Small>{v.small}</Small></div>; }
  if (v.type === 'list') return <div style={box}><div style={{ fontSize: 76, fontWeight: 800, marginBottom: 50 }}>{v.title}</div>{v.items.map((it, i) => { const o = interpolate(f, [10 + i * 14, 20 + i * 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); return <div key={i} style={{ opacity: o, transform: `translateY(${(1 - o) * 30}px)`, fontSize: 60, fontWeight: 600, margin: '18px 0', display: 'flex', alignItems: 'center', gap: 28, alignSelf: 'stretch' }}><span style={{ width: 64, height: 64, borderRadius: 32, background: style.accent, color: style.bg1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, fontWeight: 800, flex: 'none' }}>{i + 1}</span>{it}</div>; })}</div>;
  if (v.type === 'flow') return <div style={box}>{v.items.map((it, i) => { const o = interpolate(f, [i * 16, i * 16 + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }); return <React.Fragment key={i}><div style={{ opacity: o, display: 'flex', alignItems: 'center', gap: 40, transform: `scale(${0.85 + 0.15 * o})` }}><Icon name={it.icon} color={style.accent} /><span style={{ fontSize: 72, fontWeight: 700 }}>{it.label}</span></div>{i < v.items.length - 1 && <div style={{ opacity: o, fontSize: 70, margin: '6px 0', color: style.accent }}>↓</div>}</React.Fragment>; })}</div>;
  if (v.type === 'bars') {
    const max = Math.max(...v.values.map(Math.abs)), H = 280, W = 760 / v.values.length;
    const grow = interpolate(f, [5, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    return <div style={box}><div style={{ fontSize: 72, fontWeight: 800, marginBottom: 30 }}>{v.title}</div>
      <svg width="800" height={H * 2 + 70} viewBox={`0 0 800 ${H * 2 + 70}`}><line x1="20" x2="780" y1={H} y2={H} stroke={style.text} strokeOpacity="0.6" strokeWidth="4" />
        {v.values.map((val, i) => { const h = Math.abs(val) / max * (H - 20) * grow, neg = val < 0; return <g key={i}><rect x={30 + i * W} y={neg ? H : H - h} width={W - 26} height={h} rx="10" fill={neg ? '#FF6B6B' : style.accent} /><text x={30 + i * W + (W - 26) / 2} y={H * 2 + 50} fill={style.text} fontSize="34" textAnchor="middle" fontFamily={style.font}>{(v.labels || [])[i]}</text></g>; })}</svg>
      {v.note && <Small style={{ color: '#FF8E8E' }}>{v.note}</Small>}</div>;
  }
  return null;
}

function Captions({ words, groups, style }) {
  const f = useCurrentFrame(), { fps } = useVideoConfig(), t = f / fps;
  const i = words.findIndex(w => t >= w.start && t < (w.next ?? w.end + 0.25));
  if (i < 0) return null;
  const group = groups.find(g => g.includes(i)) || [i];
  return <div style={{ position: 'absolute', left: SAFE.side, right: SAFE.right, bottom: SAFE.bottom, textAlign: 'center' }}>
    <span style={{ background: 'rgba(0,0,0,0.62)', borderRadius: 22, padding: '14px 26px', fontSize: 66, fontWeight: 800, lineHeight: 1.35, boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}>
      {group.map((k, n) => <span key={k} style={{ color: k === i ? style.accent : style.text }}>{words[k].w}{n < group.length - 1 ? ' ' : ''}</span>)}</span></div>;
}

export const Video = ({ scenes, words, style, audio, duration, aiLabel, channel }) => {
  const { fps } = useVideoConfig(), f = useCurrentFrame();
  const ws = words.map((w, i) => ({ ...w, next: words[i + 1] ? words[i + 1].start : duration }));
  const drift = Math.sin(f / 60) * 40;
  return <AbsoluteFill style={{ background: `linear-gradient(160deg, ${style.bg1}, ${style.bg2})`, fontFamily: style.font, color: style.text }}>
    <div style={{ position: 'absolute', width: 700, height: 700, borderRadius: 350, background: style.accent, opacity: 0.08, left: -200 + drift, top: 300 }} />
    <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: 250, background: style.text, opacity: 0.05, right: -150 - drift, top: 1100 }} />
    <div style={{ position: 'absolute', top: SAFE.top - 60, left: SAFE.side, right: SAFE.right, height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.18)' }}><div style={{ width: `${Math.min(100, f / (duration * fps) * 100)}%`, height: '100%', borderRadius: 5, background: style.accent }} /></div>
    <div style={{ position: 'absolute', top: SAFE.top - 20, left: SAFE.side, fontSize: 34, fontWeight: 700, opacity: 0.85 }}>{channel}</div>
    {aiLabel && <div style={{ position: 'absolute', top: SAFE.top - 22, right: SAFE.right, fontSize: 28, padding: '6px 16px', borderRadius: 999, border: `2px solid ${style.text}`, opacity: 0.8 }}>{aiLabel}</div>}
    {scenes.map((s, i) => <Sequence key={s.id} from={Math.round(s.start * fps)} durationInFrames={Math.max(1, Math.round((s.end - s.start) * fps))}><Scene scene={s} style={style} /></Sequence>)}
    <Captions words={ws} groups={captionGroups(words)} style={style} />
    {audio && <Audio src={staticFile(audio)} />}
  </AbsoluteFill>;
};
