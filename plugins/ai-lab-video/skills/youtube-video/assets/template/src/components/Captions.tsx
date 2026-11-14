import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';
import type { Caption } from '../types';

// Long: a calm subtitle line at the bottom.
// Short: "karaoke bold" — big Black Han Sans, thick black outline, the spoken word turns yellow.
// Word timing inside a chunk is spread by word length (chunks themselves come from word
// timestamps when align_words.py has run, so the drift stays within a chunk).
// Highlighter: keywords from episode.json (props.highlights, timed to the spoken word by prepare.py).
// When the word is spoken, a yellow marker sweeps left→right behind it.
export type Highlight = { text: string; from: number };
const Marked: React.FC<{ text: string; highlights: Highlight[]; frame: number }> = ({ text, highlights, frame }) => {
  const hits = highlights
    .map((h) => ({ ...h, at: text.indexOf(h.text) }))
    .filter((h) => h.at >= 0 && frame >= h.from)
    .sort((a, b) => a.at - b.at);
  if (!hits.length) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let pos = 0;
  hits.forEach((h, i) => {
    if (h.at < pos) return;
    parts.push(text.slice(pos, h.at));
    const p = Math.min(1, Math.max(0, (frame - h.from) / 9));
    parts.push(
      <span
        key={i}
        style={{
          backgroundImage: 'linear-gradient(transparent 12%, rgba(255,225,77,0.95) 12%, rgba(255,225,77,0.95) 92%, transparent 92%)',
          backgroundSize: `${p * 100}% 100%`, backgroundRepeat: 'no-repeat', color: p > 0.45 ? '#141414' : undefined,
          padding: '0 4px', margin: '0 -4px', borderRadius: 4,
        }}
      >
        {h.text}
      </span>,
    );
    pos = h.at + h.text.length;
  });
  parts.push(text.slice(pos));
  return <>{parts}</>;
};

export const Captions: React.FC<{ captions: Caption[]; format: 'long' | 'short'; highlights?: Highlight[]; plain?: boolean }> = ({ captions, format, highlights = [], plain }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cap = captions.find((c) => frame >= c.from && frame < c.to);
  if (!cap) return null;

  if (format === 'long') {
    return (
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 56, display: 'flex', justifyContent: 'center' }}>
        <span
          style={{
            fontFamily: theme.font, fontSize: 42, fontWeight: 600, color: '#fff', lineHeight: 1.35,
            background: 'rgba(10,10,12,0.78)', padding: '10px 28px', borderRadius: 14, maxWidth: '80%', textAlign: 'center',
            wordBreak: 'keep-all', whiteSpace: 'pre-line',
          }}
        >
          <Marked text={cap.text} highlights={highlights} frame={frame} />
        </span>
      </div>
    );
  }

  if (plain) {
    // "plain" Shorts captions (episode.json "captionStyle": "plain"): an ordinary subtitle, white
    // Pretendard with a dark outline, no per-word colour, no pop. Up to two lines, centred.
    return (
      <div style={{ position: 'absolute', left: 70, right: 70, top: 1330, textAlign: 'center' }}>
        <span style={{ fontFamily: theme.font, fontWeight: 800, fontSize: 64, lineHeight: 1.32, color: '#fff', WebkitTextStroke: '10px rgba(0,0,0,0.92)', paintOrder: 'stroke fill',
          textShadow: '0 4px 14px rgba(0,0,0,0.55)', wordBreak: 'keep-all', whiteSpace: 'pre-line' }}>{cap.text}</span>
      </div>
    );
  }
  const words = cap.text.split(' ');
  const weights = words.map((w) => w.replace(/[^\p{L}\p{N}]/gu, '').length || 1);
  const total = weights.reduce((a, b) => a + b, 0);
  const progress = (frame - cap.from) / Math.max(1, cap.to - cap.from);
  let acc = 0;
  let current = words.length - 1;
  for (let i = 0; i < words.length; i++) {
    acc += weights[i] / total;
    if (progress < acc) {
      current = i;
      break;
    }
  }
  const pop = spring({ frame: frame - cap.from, fps, config: { damping: 12, mass: 0.6 } });
  return (
    <div style={{ position: 'absolute', left: 50, right: 50, top: 1300, textAlign: 'center', transform: `scale(${0.85 + 0.15 * pop})` }}>
      <span style={{ fontFamily: theme.display, fontSize: 88, lineHeight: 1.2, color: '#fff', WebkitTextStroke: '16px #000', paintOrder: 'stroke fill' }}>
        {words.map((w, i) => (
          <span key={i} style={{ color: i === current ? theme.caption : '#fff', display: 'inline-block', transform: i === current ? 'scale(1.08)' : undefined, margin: '0 18px' }}>
            {w}
          </span>
        ))}
      </span>
    </div>
  );
};
