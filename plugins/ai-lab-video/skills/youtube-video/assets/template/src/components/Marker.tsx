import { createContext, useContext } from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';

// On-screen highlighter. episode.json: "marks": [{ "text": <phrase on screen>, "say": <spoken word> }]
// prepare.py turns `say` into a frame (the moment that word is spoken). Any on-screen text drawn
// with <MarkedText> gets a marker swept left→right behind the phrase at that moment, then the
// phrase keeps a soft glow so it stays the focus of the frame.
export type Mark = { text: string; from: number; color?: string };
export const MarksContext = createContext<Mark[]>([]);

const SWEEP = 14; // frames

export const MarkedText: React.FC<{ text: string; dark?: boolean }> = ({ text, dark = true }) => {
  const marks = useContext(MarksContext);
  const frame = useCurrentFrame();
  const hits = marks
    .map((m) => ({ ...m, at: text.indexOf(m.text) }))
    .filter((m) => m.at >= 0)
    .sort((a, b) => a.at - b.at);
  if (!hits.length) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let pos = 0;
  hits.forEach((m, i) => {
    if (m.at < pos) return;
    parts.push(text.slice(pos, m.at));
    const p = interpolate(frame, [m.from, m.from + SWEEP], [0, 1], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
    });
    const glow = interpolate(frame, [m.from + SWEEP, m.from + SWEEP + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const c = m.color ?? 'rgba(255,225,77,0.92)';
    parts.push(
      <span
        key={i}
        style={{
          backgroundImage: `linear-gradient(100deg, transparent 0.6%, ${c} 1.2%, ${c} 98%, transparent 99.4%)`,
          backgroundSize: `${p * 100}% 78%`, backgroundPosition: '0 62%', backgroundRepeat: 'no-repeat',
          color: dark && p > 0.5 ? '#151515' : undefined,
          boxShadow: glow > 0 ? `0 0 ${18 * glow}px rgba(255,225,77,${0.35 * glow})` : undefined,
          borderRadius: 6, padding: '0 0.12em', margin: '0 -0.12em',
          WebkitBoxDecorationBreak: 'clone', boxDecorationBreak: 'clone',
        }}
      >
        {m.text}
      </span>,
    );
    pos = m.at + m.text.length;
  });
  parts.push(text.slice(pos));
  return <>{parts}</>;
};
