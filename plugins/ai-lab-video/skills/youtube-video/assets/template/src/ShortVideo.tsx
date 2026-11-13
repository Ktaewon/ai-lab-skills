import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import timelineJson from './timeline.json';
import { SceneView } from './scenes';
import { Captions } from './components/Captions';
import { theme } from './theme';
import type { Timeline } from './types';

const timeline = timelineJson as unknown as Timeline;
const LEAD_IN = timeline.leadInFrames ?? 24; // frames; written by prepare.py (LEAD_IN) so voice and captions stay in sync

const scenesOf = (shortId: string) => {
  const short = timeline.shorts.find((s) => s.id === shortId);
  if (!short) return [];
  const all = [...(timeline.shortScenes ?? []), ...timeline.scenes];
  return short.scenes.map((id) => all.find((s) => s.id === id)!).filter(Boolean);
};
const Progress: React.FC<{ total: number }> = ({ total }) => {
  const frame = useCurrentFrame();
  return <div style={{ position: 'absolute', left: 0, top: 0, height: 12, width: `${(frame / Math.max(1, total)) * 100}%`, background: theme.accent }} />;
};

export const shortFrames = (shortId: string) => scenesOf(shortId).reduce((n, s) => n + s.frames, 0);

// Real text width in px (fonts are loaded before any frame renders, see fonts.ts).
let ctx: CanvasRenderingContext2D | null = null;
const textW = (s: string, px: number) => {
  ctx = ctx ?? document.createElement('canvas').getContext('2d');
  if (!ctx) return s.length * px * 0.8;
  ctx.font = `${px}px ${theme.display}`;
  return ctx.measureText(s).width;
};
const HOOK_W = 908; // px available for hook text (1080 - 2*60 margin - 2*26 padding)
const PAD = 26;     // pill side padding
const BIG = 96;     // big hook font size
const SMALL = 52;   // header font size

// Split a hook into lines the way a person would: an explicit "\n" wins; otherwise one line if it fits
// at full size; otherwise break after a comma ("RAG 코드, 핵심은 한 줄" -> "RAG 코드" / "핵심은 한 줄"),
// else at the space that gives the most even halves. `joins[i]` is what goes back after line i when
// the hook is shown on one line again (the dropped comma).
const hookLines = (text: string): { lines: string[]; joins: string[] } => {
  if (text.includes('\n')) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    return { lines, joins: lines.map(() => '') };
  }
  if (textW(text, BIG) <= HOOK_W) return { lines: [text], joins: [''] };
  const comma = text.search(/[,，]\s/);
  if (comma > 0) return { lines: [text.slice(0, comma), text.slice(comma + 1).trim()], joins: [text[comma], ''] };
  const words = text.split(' ');
  let best = 1, bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const d = Math.abs(textW(words.slice(0, i).join(' '), BIG) - textW(words.slice(i).join(' '), BIG));
    if (d < bestDiff) { bestDiff = d; best = i; }
  }
  return { lines: [words.slice(0, best).join(' '), words.slice(best).join(' ')], joins: ['', ''] };
};

type Box = { left: number; top: number; w: number; size: number; padL: number; padR: number; rL: number; rR: number };
const pillH = (size: number) => size * 1.25 + 20;

// Lines stacked and centred (the big hook, or a header too wide for one line).
const stackLayout = (lines: string[], size: number, top: number): Box[] =>
  lines.map((l, i) => {
    const w = textW(l, size) + 2 * PAD;
    return { left: 540 - w / 2, top: top + i * (pillH(size) + 6), w, size, padL: PAD, padR: PAD, rL: 18, rR: 18 };
  });
// Lines side by side as one pill (inner corners square, the space split between neighbours).
const rowLayout = (segs: string[], size: number, top: number): Box[] => {
  const half = textW(' ', size) / 2;
  const boxes = segs.map((t, i) => {
    const padL = i === 0 ? PAD : half;
    const padR = i === segs.length - 1 ? PAD : half;
    return { left: 0, top, w: textW(t, size) + padL + padR, size, padL, padR, rL: i === 0 ? 18 : 0, rR: i === segs.length - 1 ? 18 : 0 };
  });
  let x = 540 - boxes.reduce((n, b) => n + b.w, 0) / 2;
  for (const b of boxes) { b.left = x; x += b.w; }
  return boxes;
};

// The hook owns the first two seconds (that's when viewers decide to swipe), then each line glides
// into its place in a small header that stays for the rest of the short: side by side on one line
// when that fits, otherwise still stacked. The lines leave one after another, like they're sliding home.
const Hook: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 14 } });
  const settle = spring({ frame: frame - 2 * fps, fps, config: { damping: 200 } });
  const { lines, joins } = hookLines(text);
  const segs = lines.map((l, i) => l + joins[i]);
  const bigSize = BIG * Math.min(1, HOOK_W / Math.max(...lines.map((l) => textW(l, BIG))));
  const bigH = lines.length * pillH(bigSize) + (lines.length - 1) * 6;
  const from = stackLayout(lines, bigSize, 760 - bigH / 2);
  const row = textW(segs.join(' '), SMALL) <= HOOK_W;
  const to = row
    ? rowLayout(segs, SMALL, 150)
    : stackLayout(lines, SMALL * Math.min(1, HOOK_W / Math.max(...lines.map((l) => textW(l, SMALL)))), 150);
  return (
    <>
      {/* While the hook is big it owns the frame: dim the scene behind it, then fade out as it shrinks. */}
      <AbsoluteFill style={{ background: theme.ink, opacity: 0.92 * (1 - settle), pointerEvents: 'none' }} />
      <AbsoluteFill style={{ transform: `scale(${0.8 + 0.2 * enter})`, transformOrigin: '540px 760px' }}>
        {lines.map((l, i) => {
          const p = spring({ frame: frame - 2 * fps - i * 4, fps, config: { damping: 18, mass: 0.9 } });
          const a = from[i], b = to[i];
          const m = (k: keyof Box) => a[k] + (b[k] - a[k]) * p;
          const size = m('size');
          return (
            <div
              key={i}
              style={{
                position: 'absolute', left: m('left'), top: m('top'), width: m('w') + (i < lines.length - 1 && row ? p : 0),
                height: pillH(size), background: theme.bone, color: theme.ink, fontFamily: theme.display,
                fontSize: size, lineHeight: `${size * 1.25}px`, paddingTop: 10, paddingLeft: m('padL'),
                boxSizing: 'border-box', whiteSpace: 'nowrap', overflow: 'visible',
                borderRadius: `${m('rL')}px ${m('rR')}px ${m('rR')}px ${m('rL')}px`,
              }}
            >
              {l}
              {row && joins[i] && <span style={{ opacity: Math.min(1, Math.max(0, p)) }}>{joins[i]}</span>}
            </div>
          );
        })}
      </AbsoluteFill>
    </>
  );
};

export const ShortVideo: React.FC<{ shortId: string }> = ({ shortId }) => {
  const short = timeline.shorts.find((s) => s.id === shortId);
  const scenes = scenesOf(shortId);
  let from = 0;
  return (
    <AbsoluteFill style={{ background: theme.ink, wordBreak: 'keep-all' }}>
      {scenes.map((s) => {
        const at = from;
        from += s.frames;
        return (
          <Sequence key={s.id} from={at} durationInFrames={s.frames}>
            <SceneView scene={s} />
            <Captions captions={s.captions.short} format="short" />
            {s.audio && (
              <Sequence from={LEAD_IN}>
                <Audio src={staticFile(s.audio)} />
              </Sequence>
            )}
          </Sequence>
        );
      })}
      {short?.hook && <Hook text={short.hook} />}
      <Progress total={from} />
      {timeline.music && <Audio src={staticFile(timeline.music)} volume={timeline.musicVolume} loop />}
    </AbsoluteFill>
  );
};
