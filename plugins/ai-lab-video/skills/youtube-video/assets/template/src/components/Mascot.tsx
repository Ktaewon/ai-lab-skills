import { Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme, useLayout } from '../theme';
import meta from '../mascot-meta.json';

// Sprite outlines measured by scripts/mascot_meta.py: per horizontal band (top to bottom), the
// first/last opaque column as a fraction of the width. Used to park the speech bubble right next
// to the character instead of on top of it.
type SpriteMeta = { aspect: number; bands: ([number, number] | null)[] };
const SPRITES = meta as unknown as Record<string, SpriteMeta>;
const FALLBACK: SpriteMeta = { aspect: 1, bands: Array.from({ length: 24 }, () => [0.08, 0.92] as [number, number]) };

// Nanum Pen Script is narrow; a slightly generous estimate keeps the bubble clear of the sprite.
const bubbleWidth = (text: string, fs: number) =>
  [...text].reduce((w, ch) => w + (/[\u3131-\uD7A3]/.test(ch) ? 0.8 : ch === ' ' ? 0.3 : 0.55) * fs, 0) + 52 + 10;

// 28 poses: public/mascot/otter/<pose>.png. When to use each: brand.json mascot.poses.
export type Pose =
  | 'idle' | 'wave' | 'cheer' | 'shy' | 'surprised' | 'calm' | 'thinking' | 'excited'
  | 'jump' | 'blush' | 'gasp' | 'confused' | 'worried' | 'angry' | 'peek' | 'sleepy' | 'nap'
  | 'explain' | 'idea' | 'search' | 'note' | 'reading' | 'laptop' | 'coffee'
  | 'explorer' | 'graduate' | 'pajamas' | 'cozy';
export type Beat = { at: number; pose: Pose; say?: string };
export type MascotProps = {
  beats: Beat[]; // seconds into the scene; each beat swaps the pose (and speech bubble)
  side?: 'right' | 'left';
  size?: number; // height in px at 1080p
  character?: string; // 'otter' (sprites in public/mascot/otter) or a friend: cat, puppy, hamster, bunny, mole, hedgehog
  until?: number; // seconds; slides out after this
  bottomShort?: number; // px from the bottom in 9:16 shorts (default 640, just above captions)
};

// The felt otter (cut from the reference sheet) popping in with a squash-and-stretch on every
// pose swap, breathing while idle, with a scrappy hand-written speech bubble.
export const Mascot: React.FC<MascotProps> = ({ beats, side = 'right', size = 380, character = 'otter', until, bottomShort }) => {
  const frame = useCurrentFrame();
  const { fps, width: frameW } = useVideoConfig();
  const { vertical } = useLayout();
  const t = frame / fps;
  const sorted = [...beats].sort((a, b) => a.at - b.at);
  const current = [...sorted].reverse().find((b) => t >= b.at);
  if (!current) return null;
  const startF = Math.round(sorted[0].at * fps);
  const beatF = Math.round(current.at * fps);

  const enter = spring({ frame: frame - startF, fps, config: { damping: 11, mass: 0.7 } });
  const exit = until ? spring({ frame: frame - Math.round(until * fps), fps, config: { damping: 200 } }) : 0;
  const pop = spring({ frame: frame - beatF, fps, config: { damping: 7, mass: 0.5, stiffness: 180 } });
  const sx = 1 + (1 - pop) * 0.08;
  const sy = 1 - (1 - pop) * 0.1;
  const breathe = Math.sin((frame / fps) * Math.PI * 1.2) * 0.012;
  const h = vertical ? size * 0.8 : size;
  const src = character === 'otter' ? `mascot/otter/${current.pose}.png` : `mascot/friends/${character}.png`;
  const x = side === 'right' ? { right: vertical ? 40 : 110 } : { left: vertical ? 40 : 110 };
  const bottom = vertical ? (bottomShort ?? 640) : 70;
  const slide = (1 - enter + exit) * (h + bottom + 80);

  // Bubble beside the outline at about two-thirds of the height, on the inward side. It only
  // slides onto the character when the frame edge leaves no room.
  const spriteKey = character === 'otter' ? `otter/${current.pose}` : `friends/${character}`;
  const sm = SPRITES[spriteKey] ?? FALLBACK;
  const spriteW = h * sm.aspect;
  const xOff = vertical ? 40 : 110;
  const fs = vertical ? 64 : 58;
  const bh = fs * 1.25 + 10;
  const lift = h * 0.64;
  const n = sm.bands.length;
  const bandFrom = Math.max(0, Math.floor((1 - (lift + bh + 12) / h) * n));
  const bandTo = Math.min(n - 1, Math.ceil((1 - (lift - 12) / h) * n));
  const rows = sm.bands.slice(bandFrom, bandTo + 1).filter((b): b is [number, number] => !!b);
  const gap = 18 + spriteW * 0.05; // room for the pop/breathe scale and the bubble's tilt
  // distance from the character's own screen edge (right edge for side=right) to its nearest inner pixel
  const reach = rows.length ? (side === 'right' ? 1 - Math.min(...rows.map((b) => b[0])) : Math.max(...rows.map((b) => b[1]))) : 0;
  const bw = current.say ? bubbleWidth(current.say, fs) : 0;
  const ideal = xOff + spriteW * reach + gap;
  const bubbleEdge = Math.max(xOff, Math.min(ideal, frameW - 30 - bw));

  // Bubble: a soft, slow bouncy pop, then a gentle float and sway (no stop-motion jitter).
  const bubbleIn = spring({ frame: frame - beatF - 4, fps, config: { damping: 10, mass: 1.4, stiffness: 90 } });
  const tB = (frame - beatF) / fps;
  const bob = Math.sin(tB * Math.PI * 0.9) * 5;
  const sway = Math.sin(tB * Math.PI * 0.6 + 0.8) * 1.6;
  const jit = 0;

  return (
    <>
      <div style={{ position: 'absolute', ...x, bottom: bottom - slide, height: h, transformOrigin: '50% 100%', transform: `scale(${sx + breathe}, ${sy - breathe})` }}>
        <Img src={staticFile(src)} style={{ height: '100%' }} />
      </div>
      {current.say && (
        <div
          style={{
            position: 'absolute', [side === 'right' ? 'right' : 'left']: bubbleEdge, bottom: bottom + lift - slide,
            fontFamily: theme.hand, fontSize: fs, lineHeight: `${bh - 10}px`, color: '#111', background: '#fff', border: '5px solid #111',
            borderRadius: 26, padding: '0 26px', whiteSpace: 'nowrap', opacity: interpolate(bubbleIn, [0, 0.4], [0, 1], { extrapolateRight: 'clamp' }),
            transformOrigin: side === 'right' ? '100% 100%' : '0% 100%',
            transform: `translateY(${bob}px) rotate(${(side === 'right' ? -3 : 3) + sway + jit}deg) scale(${0.55 + 0.45 * bubbleIn})`,
          }}
        >
          {current.say}
        </div>
      )}
    </>
  );
};
