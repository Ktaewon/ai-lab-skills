import { random, useCurrentFrame, useVideoConfig } from 'remotion';
import { theme } from '../theme';

// Scrappy marker doodles over the premium stage. They are deliberately crude: drawn on in a few
// stepped frames and re-wobbled every 3 frames (stop-motion), in contrast with the smooth stage.
export type DoodleSpec = {
  type: 'circle' | 'underline' | 'arrow' | 'note' | 'text';
  at: number; // seconds into the scene
  x: number; y: number; // % of frame (top-left of the doodle's box)
  w?: number; h?: number; // % of frame
  text?: string; // for note / text (and an optional label next to arrow/circle)
  color?: string;
  rotate?: number;
  until?: number;
};

const STEP = 3; // frames per stop-motion pose
const wobble = (seed: string, frame: number, amt: number) => (random(`${seed}-${Math.floor(frame / STEP)}`) - 0.5) * amt;

export const Doodle: React.FC<{ d: DoodleSpec; i: number }> = ({ d, i }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const start = Math.round(d.at * fps);
  if (frame < start) return null;
  if (d.until && frame > Math.round(d.until * fps)) return null;
  const local = frame - start;
  const drawn = Math.min(1, Math.floor(local / 2) / 4); // drawn on in 4 stepped strokes (~8 frames)
  const W = ((d.w ?? 18) / 100) * width;
  const H = ((d.h ?? 10) / 100) * height;
  const color = d.color ?? theme.doodle;
  const seed = `${i}-${d.type}`;
  const box: React.CSSProperties = { position: 'absolute', left: `${d.x}%`, top: `${d.y}%`, transform: `rotate(${(d.rotate ?? 0) + wobble(seed + 'r', frame, 2)}deg)` };
  const stroke = { fill: 'none', stroke: color, strokeWidth: 9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const j = (k: string) => wobble(seed + k, frame, 3); // was 7: the user found 7 too wiggly ("구불구불", EP.04)

  if (d.type === 'note' || d.type === 'text') {
    const pop = Math.min(1, local / 4);
    return (
      <div
        style={{
          ...box, fontFamily: theme.hand, fontSize: d.type === 'note' ? 54 : 64, lineHeight: 1.05, color: d.type === 'note' ? '#222' : color,
          background: d.type === 'note' ? theme.postit : 'transparent', padding: d.type === 'note' ? '22px 26px' : 0,
          width: d.type === 'note' ? W : undefined, minHeight: d.type === 'note' ? H : undefined, whiteSpace: 'pre-line',
          boxShadow: d.type === 'note' ? '0 6px 0 rgba(0,0,0,.18)' : undefined, transform: `${box.transform} scale(${0.6 + 0.4 * pop})`,
        }}
      >
        {d.text}
      </div>
    );
  }

  // pathLength=1 so long paths (big circles) draw fully; a fixed 1000px dash cut them short
  const dash = { strokeDasharray: 1, strokeDashoffset: 1 - drawn };
  let path = '';
  if (d.type === 'circle') {
    const rx = W / 2, ry = H / 2;
    const pts = Array.from({ length: 14 }, (_, k) => {
      const a = (k / 12) * Math.PI * 2 - 0.3;
      const r = 1 + (random(`${seed}-${k}`) - 0.5) * 0.12;
      return `${rx + Math.cos(a) * rx * r + j('x' + k)},${ry + Math.sin(a) * ry * r + j('y' + k)}`;
    });
    path = `M${pts.join(' L')}`;
  } else if (d.type === 'underline') {
    path = `M${j('a')},${H * 0.6 + j('b')} Q${W / 2},${H * 0.95 + j('c')} ${W + j('d')},${H * 0.5 + j('e')}`;
  } else {
    const ex = W, ey = H;
    path = `M${j('a')},${j('b')} Q${W * 0.7 + j('c')},${H * 0.1} ${ex + j('d')},${ey + j('e')} M${ex - 40 + j('f')},${ey - 6} L${ex},${ey} L${ex - 10},${ey - 44 + j('g')}`;
  }
  return (
    <div style={box}>
      <svg width={W + 40} height={H + 40} style={{ overflow: 'visible' }}>
        <g transform="translate(20,20)">
          <path d={path} pathLength={1} {...stroke} style={dash} />
        </g>
      </svg>
      {d.text && (
        <div style={{ position: 'absolute', left: d.type === 'arrow' ? -10 : W + 30, top: d.type === 'arrow' ? -70 : H / 2 - 40, fontFamily: theme.hand, fontSize: 60, color, whiteSpace: 'nowrap', opacity: drawn }}>
          {d.text}
        </div>
      )}
    </div>
  );
};

export const Doodles: React.FC<{ items?: DoodleSpec[] }> = ({ items }) => <>{(items ?? []).map((d, i) => <Doodle key={i} d={d} i={i} />)}</>;
