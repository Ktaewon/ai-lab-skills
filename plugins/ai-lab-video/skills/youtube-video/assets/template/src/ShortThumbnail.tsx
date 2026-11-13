import { AbsoluteFill, Img, random, staticFile } from 'remotion';
import { Stage } from './components/Stage';
import { theme } from './theme';
import timelineJson from './timeline.json';
import type { ShortThumb, Timeline } from './types';

const timeline = timelineJson as unknown as Timeline;

// Vertical cover for a Short (1080x1920), in the channel's thumbnail look: one huge word/number
// inside a crude red marker circle, two short lines, the otter reacting. Key content sits in the
// middle band so it survives the square crop YouTube uses in some feeds.
// Data: episode.json shorts[].thumb → timeline.shorts[].thumb

export const ShortThumbnail: React.FC<{ id: string }> = ({ id }) => {
  const t = timeline.shorts.find((s) => s.id === id)?.thumb as ShortThumb;
  const fs = t.big.length <= 3 ? 330 : t.big.length <= 5 ? 250 : 210;
  const cw = 470, ch = fs * 0.62;
  const pts = Array.from({ length: 14 }, (_, k) => {
    const a = (k / 12) * Math.PI * 2 - 0.4;
    const r = 1 + (random(`st${id}${k}`) - 0.5) * 0.1;
    return `${cw + Math.cos(a) * cw * r},${ch + Math.sin(a) * ch * r}`;
  });
  return (
    <Stage seed={`thumb-${id}`}>
      {t.bg && (
        <AbsoluteFill>
          <Img src={staticFile(t.bg)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'saturate(1.15)' }} />
          <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(20,20,24,0.55) 0%, rgba(20,20,24,0.25) 35%, rgba(20,20,24,0.85) 75%, rgba(20,20,24,0.95) 100%)' }} />
        </AbsoluteFill>
      )}
      {t.card && (
        <div style={{ position: 'absolute', left: 90, right: 90, top: 250, background: '#fbfaf6', color: '#151515', borderRadius: 34, padding: '44px 46px',
          fontFamily: theme.font, fontSize: 60, fontWeight: 800, lineHeight: 1.4, whiteSpace: 'pre-line', transform: 'rotate(-3deg)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.5)', borderLeft: `18px solid ${theme.accent}` }}>
          {t.cardLabel && <div style={{ fontSize: 38, color: '#777', marginBottom: 12 }}>{t.cardLabel}</div>}
          {t.card}
        </div>
      )}
      {!!t.letters && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 300, display: 'flex', justifyContent: 'center', gap: 16 }}>
          {[...(t.letters ?? '')].map((c, i) => (
            <div key={i} style={{ width: 168, height: 210, borderRadius: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.display, fontSize: 140,
              background: i === 0 ? theme.accent : theme.panel, color: i === 0 ? '#151515' : theme.bone, border: `4px solid ${i === 0 ? theme.accent : theme.panelBorder}`,
              transform: `rotate(${(i - 2) * 2}deg) translateY(${Math.abs(i - 2) * 12}px)` }}>{c}</div>
          ))}
        </div>
      )}
      {t.brand ? (() => {
        const words = t.brand.text.split(' ');
        const head = words.slice(0, -1).join(' '), tail = words[words.length - 1];
        const bfs = t.brand.text.length <= 9 ? 180 : t.brand.text.length <= 12 ? 150 : 120;
        return (
          <div style={{ position: 'absolute', left: 0, right: 0, top: 120, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {t.brand.kicker && (
              <div style={{ fontFamily: theme.font, fontWeight: 800, fontSize: 52, letterSpacing: '0.32em', color: theme.bone, opacity: 0.85, marginBottom: 6, paddingLeft: '0.32em' }}>
                {t.brand.kicker.toUpperCase()}
              </div>
            )}
            <div style={{ position: 'relative', transform: 'rotate(-3deg)' }}>
              {/* marker swash behind the model name */}
              <div style={{ position: 'absolute', left: -30, right: -30, bottom: bfs * 0.06, height: bfs * 0.42, background: theme.accent, opacity: 0.9, borderRadius: 12, transform: 'skewX(-8deg)' }} />
              <div style={{ position: 'relative', fontFamily: theme.display, fontSize: bfs, lineHeight: 1.05, whiteSpace: 'nowrap', color: theme.bone,
                WebkitTextStroke: '12px #000', paintOrder: 'stroke fill' }}>
                {head && <span>{head} </span>}<span style={{ color: theme.caption }}>{tail}</span>
              </div>
            </div>
            {t.brand.sub && (
              <div style={{ marginTop: 18, fontFamily: theme.display, fontSize: 64, color: theme.bone, WebkitTextStroke: '8px #000', paintOrder: 'stroke fill' }}>{t.brand.sub}</div>
            )}
          </div>
        );
      })() : (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 90, textAlign: 'center', fontFamily: theme.font, fontWeight: 800, fontSize: 40, color: theme.bone, letterSpacing: '0.04em' }}>
          <span style={{ background: 'rgba(20,20,24,0.7)', padding: '10px 26px', borderRadius: 40 }}>{t.label}</span>
        </div>
      )}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 660, display: 'flex', flexDirection: 'column', alignItems: 'center', wordBreak: 'keep-all' }}>
        <div style={{ position: 'relative' }}>
          <div style={{ fontFamily: theme.display, fontSize: fs, lineHeight: 1, color: theme.accent, WebkitTextStroke: '12px #000', paintOrder: 'stroke fill', whiteSpace: 'nowrap', textAlign: 'center' }}>{t.big}</div>
          <svg width={cw * 2} height={ch * 2} style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -cw, marginTop: -ch, overflow: 'visible' }}>
            <path d={`M${pts.join(' L')}`} fill="none" stroke={theme.doodle} strokeWidth={14} strokeLinecap="round" transform={`rotate(-4 ${cw} ${ch})`} />
          </svg>
          {t.stamp && (
            <div style={{ position: 'absolute', right: -60, top: -90, fontFamily: theme.display, fontSize: 80, color: '#ff4040', border: '10px solid #ff4040', borderRadius: 18,
              padding: '4px 22px', transform: 'rotate(10deg)', background: 'rgba(20,20,22,0.6)' }}>{t.stamp}</div>
          )}
        </div>
        {t.lines.map((l, i) => (
          <div key={i} style={{ fontFamily: theme.display, fontSize: 110, lineHeight: 1.1, marginTop: i === 0 ? 60 : 8, color: i === t.lines.length - 1 ? theme.caption : theme.bone,
            WebkitTextStroke: '10px #000', paintOrder: 'stroke fill', textAlign: 'center' }}>{l}</div>
        ))}
      </div>
      <Img src={staticFile(`mascot/otter/${t.pose}.png`)} style={{ position: 'absolute', right: 60, bottom: 30, height: 430 }} />
      {t.say && (
        <div style={{ position: 'absolute', right: 440, bottom: 300, fontFamily: theme.hand, fontSize: 86, color: '#111', background: '#fff', border: '7px solid #111',
          borderRadius: 30, padding: '0 30px', transform: 'rotate(-5deg)' }}>{t.say}</div>
      )}
    </Stage>
  );
};
