import { AbsoluteFill, Img, random, staticFile } from 'remotion';
import timelineJson from './timeline.json';
import { theme } from './theme';
import { Stage } from './components/Stage';
import type { Timeline } from './types';

const timeline = timelineJson as unknown as Timeline;

// 1280x720 "Big Number": a huge accent number (first line), 2-4 words under it, the otter on the
// right, and one crude red marker circle around the number. Readable at ~160 px wide.
// episode.json "thumbnail": { lines: ["2.3배", "로컬 vs 클라우드"], sub?, pose?: 'surprised', image? }
export const Thumbnail: React.FC = () => {
  const t = timeline.thumbnail as Timeline['thumbnail'] & { pose?: string };
  const [num = '', ...rest] = t.lines ?? [];
  const pose = t.pose ?? 'surprised';
  // Fit the number into the left ~650 px whatever its length ("2.3배" vs "15분→1분").
  const ems = [...num].reduce((n, ch) => n + (/[0-9.]/.test(ch) ? 0.58 : /[·\s]/.test(ch) ? 0.3 : /[A-Za-z]/.test(ch) ? 0.66 : 0.95), 0) || 1;
  const fs = Math.min(210, 650 / ems);
  const cw = ems * fs * 0.5 + 40;
  const ch = fs * 0.62;
  const pts = Array.from({ length: 14 }, (_, k) => {
    const a = (k / 12) * Math.PI * 2 - 0.4;
    const r = 1 + (random(`th${k}`) - 0.5) * 0.1;
    return `${cw + Math.cos(a) * cw * r},${ch + Math.sin(a) * ch * r}`;
  });
  return (
    <Stage seed="thumb">
      {t.image && <Img src={staticFile(t.image)} style={{ position: 'absolute', right: 0, top: 0, width: '48%', height: '100%', objectFit: 'cover', opacity: 0.35 }} />}
      <AbsoluteFill style={{ justifyContent: 'center', padding: '0 0 0 64px', wordBreak: 'keep-all' }}>
        {t.sub && <div style={{ fontFamily: theme.font, fontWeight: 700, fontSize: 34, letterSpacing: '0.08em', color: theme.muted, marginBottom: 8 }}>{t.sub}</div>}
        <div style={{ position: 'relative', alignSelf: 'flex-start' }}>
          <div style={{ fontFamily: theme.display, fontSize: fs, lineHeight: 0.95, color: theme.accent, WebkitTextStroke: '8px #000', paintOrder: 'stroke fill', whiteSpace: 'nowrap' }}>{num}</div>
          <svg width={cw * 2} height={ch * 2} style={{ position: 'absolute', left: -40, top: -ch * 0.3, overflow: 'visible' }}>
            <path d={`M${pts.join(' L')}`} fill="none" stroke={theme.doodle} strokeWidth={10} strokeLinecap="round" transform={`rotate(-3 ${cw} ${ch})`} />
          </svg>
        </div>
        {rest.map((l, i) => (
          <div key={i} style={{ fontFamily: theme.display, fontSize: 76, lineHeight: 1.08, color: theme.bone, marginTop: 10, WebkitTextStroke: '6px #000', paintOrder: 'stroke fill', maxWidth: 700 }}>{l}</div>
        ))}
      </AbsoluteFill>
      <Img src={staticFile(`mascot/otter/${pose}.png`)} style={{ position: 'absolute', right: 40, bottom: 10, height: 560 }} />
    </Stage>
  );
};
