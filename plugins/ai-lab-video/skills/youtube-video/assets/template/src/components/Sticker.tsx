import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';

// Small polaroid memes/photos with a hand-written label, popped in on a spoken word.
// props.stickers (16:9) / props.stickersShort (9:16): [{src, label?, say|at, until|for?, x, y, w?, rotate?}]
// prepare.py turns say/at into `from` (frame in the scene) and until/for into `to`.
// x, y: % of the frame (top-left corner of the sticker); w: px at 1080p. Keep them small (w 240–440)
// and off the main content; they are a reaction, not the subject.
export type StickerSpec = { src: string; label?: string; from: number; to?: number; x?: number; y?: number; w?: number; rotate?: number };

export const Sticker: React.FC<{ s: StickerSpec; i: number }> = ({ s, i }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const to = s.to ?? s.from + Math.round(2.8 * fps);
  if (frame < s.from || frame > to) return null;
  const p = spring({ frame: frame - s.from, fps, config: { damping: 10, mass: 0.7, stiffness: 160 } });
  const out = interpolate(frame, [to - 6, to], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const rot = s.rotate ?? (i % 2 ? 5 : -6);
  const w = s.w ?? 340;
  const scale = Math.min(width, height) / 1080;
  return (
    <div
      style={{
        position: 'absolute', left: ((s.x ?? 70) / 100) * width, top: ((s.y ?? 12) / 100) * height, width: w * scale,
        background: '#fff', padding: 12 * scale, paddingBottom: (s.label ? 8 : 12) * scale, borderRadius: 10 * scale,
        boxShadow: '0 18px 40px rgba(0,0,0,0.45)', opacity: Math.min(1, p * 1.5) * out,
        transform: `rotate(${rot + (1 - p) * -14}deg) scale(${0.6 + 0.4 * p})`, transformOrigin: 'center',
      }}
    >
      <Img src={staticFile(s.src)} style={{ width: '100%', display: 'block', borderRadius: 4 * scale }} />
      {s.label && (
        <div style={{ fontFamily: theme.hand, fontSize: 44 * scale, color: '#16181D', textAlign: 'center', lineHeight: 1.1, marginTop: 4 * scale }}>{s.label}</div>
      )}
    </div>
  );
};

export const Stickers: React.FC<{ items?: StickerSpec[] }> = ({ items }) => <>{(items ?? []).map((s, i) => <Sticker key={i} s={s} i={i} />)}</>;
