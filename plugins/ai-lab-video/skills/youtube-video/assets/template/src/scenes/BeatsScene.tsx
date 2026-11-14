import { AbsoluteFill, Easing, Img, OffthreadVideo, Sequence, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Doodles, type DoodleSpec } from '../components/Doodle';
import { theme } from '../theme';
import { ApproveBeat, BeatSfx, ConnectBeat, DemoBeat, IconsBeat, PickleBlob, type BlobSpec } from './BeatMotion';
import type { Scene } from '../types';
import { WinBeat } from './WinBeat';
import { DeskBeat } from './DeskBeat';
import { TowerBeat } from './TowerBeat';

// Shorts-style fast cuts over one narration track. props.beats: each beat starts when its `say`
// word is spoken (prepare.py → beat.from) and lasts until the next one. Every cut gets a punch-in
// zoom and a quick flash; beats can carry an otter sticker and a slammed stamp.
type Bar = { label: string; value: number; highlight?: boolean };
type Beat = {
  from: number; kind: 'video' | 'image' | 'big' | 'number' | 'bars' | 'quote' | 'letters' | 'photo' | 'memo' | 'demo' | 'icons' | 'approve' | 'connect' | 'rank' | 'card' | 'win' | 'desk' | 'tower';
  r?: number; name?: string; maker?: string; icons?: string[]; score?: number; total?: number; past?: { r: number; icon: string }[]; mystery?: boolean;
  rows?: RankRow[]; title?: string; focus?: number; min?: number; maxScore?: number; scoreUnit?: string;
  blobs?: BlobSpec[];
  notes?: Note[]; tapes?: Tape[]; doodles?: DoodleSpec[]; strokes?: Stroke[];
  badge?: string;
  src?: string; fit?: 'cover' | 'contain'; label?: string;
  text?: string; sub?: string; value?: number; unit?: string; bars?: Bar[]; max?: number;
  mark?: string; letters?: string; lit?: number | 'all';
  sticker?: { pose: string; say?: string; side?: 'left' | 'right' };
  stamp?: string; tone?: 'accent' | 'bad' | 'good';
  credit?: string; pos?: string; // hybrid: source credit line, objectPosition for photo
};

// memo: an ivory notebook page with hand-written lines, post-its, taped real screenshots and red
// marker doodles, all in stop-motion steps (the channel's scrappy layer as the whole frame).
// Smooth marker strokes (px in the 1080x1920 frame): drawn on once with an ease, no per-frame wobble.
type Stroke = { type: 'ellipse' | 'arrow' | 'line'; at?: number; cx?: number; cy?: number; rx?: number; ry?: number; rot?: number;
  x1?: number; y1?: number; x2?: number; y2?: number; bend?: number };
const strokePath = (k: Stroke) => {
  if (k.type === 'ellipse') {
    const { cx = 540, cy = 960, rx = 200, ry = 120, rot = -4 } = k;
    const r = (rot * Math.PI) / 180, pts: string[] = [];
    for (let i = 0; i <= 64; i++) {
      const a = -2.6 + (i / 64) * (Math.PI * 2 + 0.45); // a touch past a full loop, like a hand-drawn circle
      const g = 1 + 0.035 * Math.sin(a * 2 + 1) + (i / 64) * 0.05; // gentle, smooth unevenness; ends slightly wider
      const x = Math.cos(a) * rx * g, y = Math.sin(a) * ry * g;
      pts.push(`${(cx + x * Math.cos(r) - y * Math.sin(r)).toFixed(1)},${(cy + x * Math.sin(r) + y * Math.cos(r)).toFixed(1)}`);
    }
    return { d: 'M' + pts.join(' L'), head: null as null | string };
  }
  const { x1 = 0, y1 = 0, x2 = 100, y2 = 0, bend = 0 } = k;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
  const qx = mx - (dy / L) * bend, qy = my + (dx / L) * bend;
  let head: string | null = null;
  if (k.type === 'arrow') {
    const tx = x2 - qx, ty = y2 - qy, tl = Math.hypot(tx, ty) || 1, ux = tx / tl, uy = ty / tl, h = 46;
    const p = (ang: number) => `${(x2 - h * (ux * Math.cos(ang) - uy * Math.sin(ang))).toFixed(1)},${(y2 - h * (uy * Math.cos(ang) + ux * Math.sin(ang))).toFixed(1)}`;
    head = `M${p(0.5)} L${x2},${y2} L${p(-0.5)}`;
  }
  return { d: `M${x1},${y1} Q${qx.toFixed(1)},${qy.toFixed(1)} ${x2},${y2}`, head };
};
const Strokes: React.FC<{ items?: Stroke[]; f: number }> = ({ items, f }) => {
  const { fps } = useVideoConfig();
  return (
    <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}>
      {(items ?? []).map((k, i) => {
        const t = f - Math.round((k.at ?? 0) * fps);
        if (t < 0) return null;
        const draw = interpolate(t, [0, k.type === 'ellipse' ? 12 : 8], [0, 1], { extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
        const { d, head } = strokePath(k);
        const st = { fill: 'none', stroke: theme.doodle, strokeWidth: 11, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
        return (
          <g key={i}>
            <path d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - draw} {...st} />
            {head && draw >= 1 && <path d={head} {...st} />}
          </g>
        );
      })}
    </svg>
  );
};
type Note = { text: string; x: number; y: number; w?: number; rot?: number; at?: number; size?: number; paper?: 'yellow' | 'pink' | 'blue' | 'white' | 'none'; ink?: 'red' | 'black' };
type Tape = { src: string; x: number; y: number; w: number; h: number; rot?: number; at?: number; pos?: string };
const PAPER: Record<string, string> = { yellow: '#FFE45C', pink: '#FFC2CF', blue: '#BFE3FF', white: '#FFFFFF' };
const IVORY = '#F4EEE1';
const STEP = 3;
const jit = (seed: string, f: number, a: number) => (random(seed + '-' + Math.floor(f / STEP)) - 0.5) * a;
const Memo: React.FC<{ b: Beat; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const shown = (at = 0) => f >= Math.round(at * fps);
  const slap = (at = 0) => { const l = Math.floor((f - Math.round(at * fps)) / 2) * 2; return l < 0 ? 0 : Math.min(1, 0.55 + l * 0.12); };
  return (
    <AbsoluteFill style={{ background: IVORY }}>
      {/* faint notebook rules + paper grain */}
      <AbsoluteFill style={{ backgroundImage: 'repeating-linear-gradient(180deg, transparent 0 78px, rgba(60,90,140,0.13) 78px 80px)', backgroundPosition: '0 30px' }} />
      <AbsoluteFill style={{ left: 120, width: 3, background: 'rgba(220,70,60,0.28)' }} />
      {(b.tapes ?? []).map((t, i) => shown(t.at) && (
        <div key={'t' + i} style={{ position: 'absolute', left: t.x + '%', top: t.y + '%', width: t.w + '%', height: t.h + '%', background: '#fff', padding: 14,
          boxShadow: '0 10px 24px rgba(0,0,0,0.18)', transform: 'rotate(' + ((t.rot ?? 0) + jit('tp' + i, f, 0.8)) + 'deg) scale(' + slap(t.at) + ')' }}>
          {t.src.endsWith('.mp4') ? <OffthreadVideo src={staticFile(t.src)} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Img src={staticFile(t.src)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: t.pos ?? '50% 0%' }} />}
          <div style={{ position: 'absolute', left: '50%', top: -26, width: 170, height: 52, marginLeft: -85, background: 'rgba(235,225,190,0.82)', transform: 'rotate(-4deg)' }} />
        </div>
      ))}
      {(b.notes ?? []).map((n, i) => {
        if (!shown(n.at)) return null;
        const paper = n.paper ?? 'yellow';
        const bare = paper === 'none';
        return (
          <div key={'n' + i} style={{ position: 'absolute', left: n.x + '%', top: n.y + '%', width: n.w ? n.w + '%' : undefined, fontFamily: theme.hand, fontSize: n.size ?? (bare ? 92 : 84),
            lineHeight: 1.08, whiteSpace: 'pre-line', color: n.ink === 'red' ? theme.doodle : '#1d1d1f', background: bare ? 'transparent' : PAPER[paper],
            padding: bare ? 0 : '30px 34px', boxShadow: bare ? undefined : '0 14px 22px rgba(0,0,0,0.16), inset 0 -10px 0 rgba(0,0,0,0.04)',
            transform: 'rotate(' + ((n.rot ?? 0) + jit('n' + i, f, bare ? 0.6 : 1.4)) + 'deg) scale(' + slap(n.at) + ')', transformOrigin: '50% 0%' }}>{n.text}</div>
        );
      })}
      {(b.blobs ?? []).map((sb, i) => <PickleBlob key={'b' + i} s={sb} f={f} i={i} />)}
      <Sequence from={0} layout="none"><Doodles items={b.doodles} /></Sequence>
      <Strokes items={b.strokes} f={f} />
    </AbsoluteFill>
  );
};

// rank: an ivory leaderboard that fills in one row per beat (9 -> 1). Each row: `at` seconds into
// this beat when it slams in, -1 = already on the board, missing = hidden slot ("?").
// `focus` = rank to highlight (a hidden focused row pulses "???" for the big reveal).
// Consecutive rank beats skip the punch-in/flash/whoosh so the board reads as one growing list.
type RankRow = { r: number; name: string; maker?: string; icons?: string[]; score: number; at?: number };
const INK2 = '#1d1d1f';
const RankBoard: React.FC<{ b: Beat; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const rows = [...(b.rows ?? [])].sort((x, y) => x.r - y.r);
  const lo = b.min ?? Math.min(...rows.map((x) => x.score)) - 5, hi = b.maxScore ?? Math.max(...rows.map((x) => x.score));
  const big = rows.length <= 4;
  const top = 370, rowH = big ? 200 : 96, h = rowH - (big ? 24 : 10);
  const slot = (y: number, focus: boolean, child: React.ReactNode, pulse = 1) => (
    <div style={{ position: 'absolute', left: 50, right: 50, top: y, height: h, borderRadius: 22, border: `5px dashed ${focus ? theme.doodle : 'rgba(0,0,0,0.18)'}`,
      display: 'flex', alignItems: 'center', padding: '0 26px', gap: 26, fontFamily: theme.display, color: focus ? theme.doodle : 'rgba(0,0,0,0.25)', transform: `scale(${pulse})`,
      background: focus ? 'rgba(255,255,255,0.75)' : 'transparent' }}>{child}</div>
  );
  return (
    <AbsoluteFill style={{ background: IVORY }}>
      <AbsoluteFill style={{ backgroundImage: 'radial-gradient(rgba(0,0,0,0.06) 2px, transparent 2px)', backgroundSize: '36px 36px' }} />
      {b.title && <div style={{ position: 'absolute', left: 50, right: 50, top: 300, fontSize: 36, fontWeight: 800, color: '#6b645a', whiteSpace: 'pre-line' }}>{b.title}</div>}
      {rows.map((row, i) => {
        const y = top + i * rowH;
        const focus = b.focus === row.r;
        const t = row.at === undefined ? -1 : row.at < 0 ? 999 : f - Math.round(row.at * fps);
        if (t < 0) {
          const pulse = focus ? 1 + 0.03 * Math.sin((f / fps) * Math.PI * 4) : 1;
          return <div key={i}>{slot(y, focus, <><div style={{ width: 96, fontSize: big ? 72 : 54 }}>{row.r}위</div><div style={{ fontSize: focus ? 64 : 50 }}>{focus ? '???' : '?'}</div></>, pulse)}</div>;
        }
        const s = interpolate(t, [0, 4, 7, 10], [1.35, 0.95, 1.03, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });
        const fill = interpolate(t, [3, 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
        const pct = 30 + 70 * Math.max(0, Math.min(1, (row.score - lo) / Math.max(1, hi - lo)));
        const shown = Math.round(row.score * fill);
        return (
          <div key={i} style={{ position: 'absolute', left: 50, right: 50, top: y, height: h, borderRadius: 22, overflow: 'hidden', background: '#fff',
            boxShadow: focus ? `0 0 0 6px ${theme.doodle}, 0 16px 30px rgba(0,0,0,0.18)` : '0 8px 18px rgba(0,0,0,0.10)', transform: `scale(${s * (focus ? 1.02 : 1)})`, zIndex: focus ? 2 : 1 }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct * fill}%`, background: focus ? '#FFE45C' : '#FFD9C7' }} />
            <div style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center', padding: '0 26px', gap: 20 }}>
              <div style={{ width: 96, flexShrink: 0, fontFamily: theme.display, fontSize: big ? 72 : 54, color: row.r <= 3 ? theme.doodle : INK2 }}>{row.r}위</div>
              {(row.icons ?? []).map((src, k) => (
                <Img key={k} src={staticFile(src)} style={{ width: big ? 130 : 66, height: big ? 130 : 66, flexShrink: 0, borderRadius: big ? 30 : 16, border: '3px solid #fff',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.18)', marginLeft: k ? -30 : 0 }} />
              ))}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ fontFamily: theme.display, fontSize: big ? 50 : row.name.length > 18 ? 34 : 44, color: INK2, lineHeight: 1.05, whiteSpace: 'nowrap' }}>{row.name}</div>
                {row.maker && <div style={{ fontSize: big ? 34 : 24, fontWeight: 700, color: '#7a7268', marginTop: 2, whiteSpace: 'nowrap' }}>{row.maker}</div>}
              </div>
              <div style={{ flexShrink: 0, fontFamily: theme.display, fontSize: big ? 66 : 56, color: INK2, fontVariantNumeric: 'tabular-nums', marginRight: big ? 30 : 70 }}>
                {shown}<span style={{ fontSize: big ? 38 : 30, color: '#7a7268' }}>{b.scoreUnit ?? '점'}</span>
              </div>
            </div>
          </div>
        );
      })}
      {(b.notes ?? []).map((n, i) => f >= Math.round((n.at ?? 0) * fps) && (
        <div key={'n' + i} style={{ position: 'absolute', left: n.x + '%', top: n.y + '%', fontFamily: theme.hand, fontSize: n.size ?? 92, lineHeight: 1.05, whiteSpace: 'pre-line', zIndex: 5,
          color: n.ink === 'black' ? INK2 : theme.doodle, background: n.paper && n.paper !== 'none' ? PAPER[n.paper] : 'transparent', padding: n.paper && n.paper !== 'none' ? '20px 28px' : 0,
          boxShadow: n.paper && n.paper !== 'none' ? '0 12px 20px rgba(0,0,0,0.16)' : undefined, transform: `rotate(${(n.rot ?? -4) + jit('rn' + i, f, 0.6)}deg)` }}>{n.text}</div>
      ))}
      <div style={{ position: 'absolute', inset: 0, zIndex: 6 }}><Strokes items={b.strokes} f={f} /></div>
    </AbsoluteFill>
  );
};

// card: one rank at a time ("9위 …" → its reason), like the countdown shorts the user likes.
// A ladder of the 9 places across the top shows where we are; big icon + name + score bar in the
// middle; post-it `notes` slam in on the spoken reason (at = seconds into the beat).
// `mystery`: the 1st place before the reveal (dashed "?" icon, pulsing).
const RankCard: React.FC<{ b: Beat; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const total = b.total ?? 9, r = b.r ?? 1;
  const p = spring({ frame: f, fps, config: { damping: 11, mass: 0.8, stiffness: 140 } });
  const icon = interpolate(f, [0, 5, 8, 11], [2.0, 0.9, 1.05, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });
  const lo = b.min ?? 40, hi = b.maxScore ?? 65;
  const fill = interpolate(f, [8, 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const pct = Math.max(0.06, Math.min(1, ((b.score ?? lo) - lo) / Math.max(1, hi - lo)));
  const pulse = b.mystery ? 1 + 0.04 * Math.sin((f / fps) * Math.PI * 4) : 1;
  const pw = 92, gap = 14, lw = total * pw + (total - 1) * gap;
  return (
    <AbsoluteFill style={{ background: IVORY }}>
      <AbsoluteFill style={{ backgroundImage: 'radial-gradient(rgba(0,0,0,0.06) 2px, transparent 2px)', backgroundSize: '36px 36px' }} />
      {/* ladder 9 → 1 */}
      <div style={{ position: 'absolute', left: (1080 - lw) / 2, top: 300, display: 'flex', gap }}>
        {Array.from({ length: total }, (_, k) => total - k).map((n) => {
          const done = (b.past ?? []).find((x) => x.r === n);
          const cur = n === r;
          return (
            <div key={n} style={{ width: pw, height: pw, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
              border: cur ? `5px solid ${theme.doodle}` : done ? '3px solid rgba(0,0,0,0.12)' : '3px dashed rgba(0,0,0,0.2)', background: cur ? '#fff' : done ? '#fff' : 'transparent',
              transform: cur ? `scale(${1 + 0.12 * p})` : undefined, boxShadow: cur ? '0 8px 18px rgba(0,0,0,0.15)' : undefined }}>
              {done ? <Img src={staticFile(done.icon)} style={{ width: 62, height: 62, borderRadius: 14, opacity: 0.85 }} />
                : <span style={{ fontFamily: theme.display, fontSize: 40, color: cur ? theme.doodle : 'rgba(0,0,0,0.28)' }}>{n}</span>}
            </div>
          );
        })}
      </div>
      {/* big rank + icon */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 450, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 50 }}>
        <div style={{ fontFamily: theme.display, fontSize: 210, lineHeight: 1, color: theme.doodle, transform: `scale(${0.6 + 0.4 * p}) rotate(${(1 - p) * -10 - 4}deg)`, WebkitTextStroke: '6px #fff', paintOrder: 'stroke fill' }}>
          {r}<span style={{ fontSize: 120 }}>위</span>
        </div>
        <div style={{ display: 'flex', transform: `scale(${icon * pulse})` }}>
          {b.mystery ? (
            <div style={{ width: 260, height: 260, borderRadius: 60, border: `8px dashed ${theme.doodle}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: theme.display, fontSize: 170, color: theme.doodle, background: '#fff' }}>?</div>
          ) : (b.icons ?? []).map((src, k) => (
            <Img key={k} src={staticFile(src)} style={{ width: (b.icons ?? []).length > 1 ? 210 : 260, height: (b.icons ?? []).length > 1 ? 210 : 260, borderRadius: 58, border: '7px solid #fff',
              boxShadow: '0 22px 40px rgba(0,0,0,0.22)', marginLeft: k ? -40 : 0, transform: `rotate(${k ? 6 : -4}deg)` }} />
          ))}
        </div>
      </div>
      {/* name + maker */}
      <div style={{ position: 'absolute', left: 60, right: 60, top: 770, textAlign: 'center', opacity: interpolate(f, [3, 9], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
        <div style={{ fontFamily: theme.display, fontSize: (b.name ?? '').length > 16 ? 76 : 92, color: INK2, lineHeight: 1.05, whiteSpace: 'nowrap' }}>{b.mystery ? '???' : b.name}</div>
        {b.maker && <div style={{ fontSize: 40, fontWeight: 700, color: '#7a7268', marginTop: 10 }}>{b.mystery ? '대망의 1위' : b.maker}</div>}
      </div>
      {/* score bar */}
      {!b.mystery && b.score !== undefined && (
        <div style={{ position: 'absolute', left: 90, right: 90, top: 960, height: 96, borderRadius: 48, background: 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct * fill * 100}%`, borderRadius: 48, background: r === 1 ? '#FFE45C' : '#FF8A5C' }} />
          <div style={{ position: 'absolute', right: 34, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontFamily: theme.display, fontSize: 70, color: INK2, fontVariantNumeric: 'tabular-nums' }}>
            {Math.round((b.score ?? 0) * fill)}<span style={{ fontSize: 38, color: '#6b645a', marginLeft: 4 }}>점</span>
          </div>
        </div>
      )}
      {(b.notes ?? []).map((n, i) => {
        const t = f - Math.round((n.at ?? 0) * fps);
        if (t < 0) return null;
        const slap = Math.min(1, 0.55 + Math.floor(t / 2) * 2 * 0.12);
        const bare = !n.paper || n.paper === 'none';
        return (
          <div key={'n' + i} style={{ position: 'absolute', left: n.x + '%', top: n.y + '%', width: n.w ? n.w + '%' : undefined, fontFamily: theme.hand, fontSize: n.size ?? 84, lineHeight: 1.06,
            whiteSpace: 'pre-line', color: n.ink === 'red' || (bare && n.ink !== 'black') ? theme.doodle : INK2, background: bare ? 'transparent' : PAPER[n.paper!],
            padding: bare ? 0 : '22px 30px', boxShadow: bare ? undefined : '0 14px 22px rgba(0,0,0,0.16)', zIndex: 5,
            transform: `rotate(${(n.rot ?? -3) + jit('cn' + i, f, bare ? 0.6 : 1.2)}deg) scale(${slap})`, transformOrigin: '50% 0%' }}>{n.text}</div>
        );
      })}
      <div style={{ position: 'absolute', inset: 0, zIndex: 6 }}><Strokes items={b.strokes} f={f} /></div>
    </AbsoluteFill>
  );
};

const TOP = 270; // below the short's hook header
const BOTTOM = 1250; // above the karaoke captions
const H = BOTTOM - TOP;

const pop = (f: number, fps: number, d = 0) => spring({ frame: f - d, fps, config: { damping: 11, mass: 0.8, stiffness: 150 } });

const Card: React.FC<{ children: React.ReactNode; label?: string; f: number; fps: number; tone?: string }> = ({ children, label, f, fps, tone }) => (
  <div style={{ position: 'absolute', left: 60, right: 60, top: TOP + 20, bottom: 1920 - BOTTOM + 10, borderRadius: 40, overflow: 'hidden', background: theme.panel,
    border: `4px solid ${tone === 'bad' ? '#ff5a5a' : tone === 'good' ? theme.caption : theme.panelBorder}`, boxShadow: '0 30px 80px rgba(0,0,0,0.45)' }}>
    {children}
    {label && (
      <div style={{ position: 'absolute', left: 28, top: 28, fontFamily: theme.display, fontSize: 48, color: '#151515', background: theme.caption,
        padding: '8px 22px', borderRadius: 16, transform: `scale(${pop(f, fps, 4)}) rotate(-2deg)`, transformOrigin: '0 50%' }}>{label}</div>
    )}
  </div>
);

const Visual: React.FC<{ b: Beat; f: number; len: number }> = ({ b, f, len }) => {
  const { fps } = useVideoConfig();
  const p = pop(f, fps);
  const accent = b.tone === 'bad' ? '#ff5a5a' : theme.accent;
  if (b.kind === 'win') return <WinBeat b={b} f={f} />;
  if (b.kind === 'desk') return <DeskBeat b={b} f={f} len={len} />;
  if (b.kind === 'tower') return <TowerBeat b={b} f={f} />;
  if (b.kind === 'memo') return <Memo b={b} f={f} />;
  if (b.kind === 'rank') return <RankBoard b={b} f={f} />;
  if (b.kind === 'card') return <RankCard b={b} f={f} />;
  if (b.kind === 'demo') return <DemoBeat b={b} f={f} />;
  if (b.kind === 'icons') return <IconsBeat b={b} f={f} />;
  if (b.kind === 'approve') return <ApproveBeat b={b} f={f} />;
  if (b.kind === 'connect') return <ConnectBeat b={b} f={f} />;
  if (b.kind === 'photo') {
    // full-bleed photo (slow push), darkened so the karaoke captions read; big badge (①②③) on top
    const push = interpolate(f, [0, Math.max(1, len)], [1.06, 1.16]);
    return (
      <AbsoluteFill>
        {b.src!.endsWith('.mp4')
          ? <OffthreadVideo src={staticFile(b.src!)} muted style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: b.pos ?? '50% 50%', transform: `scale(${push})` }} />
          : <Img src={staticFile(b.src!)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: b.pos ?? '62% 50%', transform: `scale(${push})` }} />}
        <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(18,18,22,0.75) 0%, rgba(18,18,22,0.25) 30%, rgba(18,18,22,0.55) 62%, rgba(18,18,22,0.9) 100%)' }} />
        {b.badge && (
          <div style={{ position: 'absolute', left: 0, right: 0, top: TOP + 40, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: 260, height: 260, borderRadius: '50%', background: theme.accent, color: '#151515', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: theme.display, fontSize: 170, transform: `scale(${p}) rotate(${(1 - p) * -30}deg)`, boxShadow: `0 0 80px ${theme.accent}99` }}>{b.badge}</div>
            {b.label && <div style={{ marginTop: 26, fontSize: 56, fontWeight: 800, color: theme.bone, opacity: pop(f, fps, 6), textShadow: '0 4px 16px rgba(0,0,0,0.7)' }}>{b.label}</div>}
          </div>
        )}
        {!b.badge && b.text && (
          <div style={{ position: 'absolute', left: 60, right: 60, top: TOP + 60, textAlign: 'center', fontFamily: theme.display, fontSize: 120, lineHeight: 1.12, color: theme.bone,
            whiteSpace: 'pre-line', transform: `scale(${0.7 + 0.3 * p})`, WebkitTextStroke: '10px #000', paintOrder: 'stroke fill' }}>{b.text}</div>
        )}
      </AbsoluteFill>
    );
  }
  if (b.kind === 'video' || b.kind === 'image') {
    const push = interpolate(f, [0, Math.max(1, len)], [1.04, 1.16]);
    const st: React.CSSProperties = { width: '100%', height: '100%', objectFit: b.fit ?? 'cover', transform: `scale(${push})` };
    return (
      <Card label={b.label} f={f} fps={fps} tone={b.tone}>
        {b.kind === 'video' ? <OffthreadVideo src={staticFile(b.src!)} muted style={st} /> : <Img src={staticFile(b.src!)} style={st} />}
      </Card>
    );
  }
  if (b.kind === 'big') {
    const burst = interpolate(f, [2, 22], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
    return (
      <AbsoluteFill style={{ top: TOP, height: H, alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 70px' }}>
        {Array.from({ length: 12 }, (_, k) => (
          <div key={k} style={{ position: 'absolute', left: '50%', top: '50%', width: 10, height: 70, marginLeft: -5, borderRadius: 5, background: k % 2 ? theme.caption : accent,
            opacity: interpolate(burst, [0, 0.3, 1], [0, 0.9, 0]), transform: `rotate(${k * 30}deg) translateY(${-260 - 200 * burst}px)` }} />
        ))}
        <div style={{ fontFamily: theme.display, fontSize: (b.text ?? '').length > 10 ? 110 : 150, lineHeight: 1.12, color: theme.bone, whiteSpace: 'pre-line',
          transform: `scale(${0.6 + 0.4 * p}) rotate(${(1 - p) * -6}deg)`, textShadow: '0 10px 0 rgba(0,0,0,0.35)' }}>{b.text}</div>
        {b.sub && <div style={{ marginTop: 34, fontSize: 52, fontWeight: 800, color: accent, opacity: pop(f, fps, 6), whiteSpace: 'pre-line' }}>{b.sub}</div>}
      </AbsoluteFill>
    );
  }
  if (b.kind === 'number') {
    const v = (b.value ?? 0) * interpolate(f, [0, 22], [0, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
    return (
      <AbsoluteFill style={{ top: TOP, height: H, alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {b.label && <div style={{ fontSize: 56, fontWeight: 800, color: theme.bone, marginBottom: 10, opacity: p }}>{b.label}</div>}
        <div style={{ fontFamily: theme.display, fontSize: 300, lineHeight: 1, color: accent, transform: `scale(${0.7 + 0.3 * p})`, fontVariantNumeric: 'tabular-nums',
          textShadow: `0 0 ${60 * p}px ${accent}66` }}>
          {Number.isInteger(b.value) ? Math.round(v) : v.toFixed(1)}
          <span style={{ fontSize: 90, color: theme.muted }}>{b.unit}</span>
        </div>
        {b.sub && <div style={{ marginTop: 20, fontSize: 50, fontWeight: 700, color: theme.muted, opacity: pop(f, fps, 8) }}>{b.sub}</div>}
      </AbsoluteFill>
    );
  }
  if (b.kind === 'bars') {
    const max = b.max ?? Math.max(...(b.bars ?? []).map((x) => x.value));
    return (
      <AbsoluteFill style={{ top: TOP + 120, height: H - 120, padding: '0 80px', justifyContent: 'center', gap: 46 }}>
        {(b.bars ?? []).map((x, i) => {
          const g = spring({ frame: f - 3 - i * 5, fps, config: { damping: 15, mass: 0.9 } });
          return (
            <div key={i} style={{ width: '100%' }}>
              <div style={{ fontSize: 50, fontWeight: 800, color: x.highlight ? theme.bone : theme.muted, marginBottom: 12 }}>{x.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24, width: '100%' }}>
                <div style={{ height: 90, width: `${(x.value / max) * 74 * g}%`, flexShrink: 0, borderRadius: 16, background: x.highlight ? theme.accent : theme.barMuted,
                  boxShadow: x.highlight ? `0 0 40px ${theme.accent}88` : undefined }} />
                <div style={{ fontFamily: theme.display, fontSize: 72, color: x.highlight ? theme.bone : theme.muted, opacity: g }}>{x.value}</div>
              </div>
            </div>
          );
        })}
      </AbsoluteFill>
    );
  }
  if (b.kind === 'quote') {
    const t = b.text ?? '';
    const at = b.mark ? t.indexOf(b.mark) : -1;
    const sweep = interpolate(f, [8, 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
    const body = at < 0 ? t : (
      <>
        {t.slice(0, at)}
        <span style={{ backgroundImage: `linear-gradient(${theme.caption}, ${theme.caption})`, backgroundSize: `${sweep * 100}% 80%`, backgroundPosition: '0 70%',
          backgroundRepeat: 'no-repeat', color: sweep > 0.5 ? '#151515' : undefined, borderRadius: 8 }}>{b.mark}</span>
        {t.slice(at + (b.mark ?? '').length)}
      </>
    );
    return (
      <AbsoluteFill style={{ top: TOP, height: H, alignItems: 'center', justifyContent: 'center', padding: '0 70px' }}>
        <div style={{ background: '#fbfaf6', color: '#151515', borderRadius: 36, padding: '54px 50px', fontSize: t.length > 40 ? 58 : 70, fontWeight: 800, lineHeight: 1.4,
          whiteSpace: 'pre-line', wordBreak: 'keep-all', transform: `translateY(${(1 - p) * 120}px) rotate(${(1 - p) * 3 - 1}deg)`, opacity: Math.min(1, p * 1.5),
          boxShadow: '0 30px 80px rgba(0,0,0,0.5)', borderLeft: `18px solid ${b.tone === 'bad' ? '#ff5a5a' : theme.accent}` }}>
          {b.label && <div style={{ fontSize: 40, color: '#777', marginBottom: 18 }}>{b.label}</div>}
          {body}
        </div>
      </AbsoluteFill>
    );
  }
  if (b.kind === 'letters') {
    const L = [...(b.letters ?? 'SCOPE')];
    return (
      <AbsoluteFill style={{ top: TOP, height: H, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 18 }}>
          {L.map((ch, i) => {
            const on = b.lit === 'all' || b.lit === i;
            const q = spring({ frame: f - i * 3, fps, config: { damping: 10, mass: 0.7 } });
            return (
              <div key={i} style={{ width: 170, height: 220, borderRadius: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.display, fontSize: 150,
                background: on ? theme.accent : theme.panel, color: on ? '#151515' : theme.muted, border: `4px solid ${on ? theme.accent : theme.panelBorder}`,
                transform: `translateY(${(1 - q) * 80}px) scale(${on ? 1.06 : 0.94})`, boxShadow: on ? `0 0 50px ${theme.accent}88` : undefined }}>{ch}</div>
            );
          })}
        </div>
        {b.sub && <div style={{ marginTop: 60, fontSize: 64, fontWeight: 800, color: theme.bone, opacity: pop(f, fps, 6), textAlign: 'center', whiteSpace: 'pre-line' }}>{b.sub}</div>}
      </AbsoluteFill>
    );
  }
  return null;
};

const Sticker: React.FC<{ s: NonNullable<Beat['sticker']>; f: number }> = ({ s, f }) => {
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - 6, fps, config: { damping: 9, mass: 0.9, stiffness: 120 } });
  const bob = Math.sin((f / fps) * Math.PI * 0.9) * 6;
  const right = (s.side ?? 'right') === 'right';
  return (
    <div style={{ position: 'absolute', [right ? 'right' : 'left']: 30, top: BOTTOM - 330, height: 300, transform: `translateY(${(1 - p) * 300 + bob}px) rotate(${right ? 6 : -6}deg)`, transformOrigin: '50% 100%' }}>
      <Img src={staticFile(`mascot/otter/${s.pose}.png`)} style={{ height: '100%' }} />
      {s.say && (
        <div style={{ position: 'absolute', bottom: 250, [right ? 'right' : 'left']: 150, fontFamily: theme.hand, fontSize: 64, color: '#111', background: '#fff', border: '5px solid #111',
          borderRadius: 26, padding: '0 24px', whiteSpace: 'nowrap', transform: `scale(${spring({ frame: f - 10, fps, config: { damping: 10, mass: 1.2, stiffness: 90 } })}) rotate(${right ? -4 : 4}deg)` }}>{s.say}</div>
      )}
    </div>
  );
};

const Stamp: React.FC<{ text: string; f: number; light?: boolean }> = ({ text, f, light: b_light }) => {
  const s = interpolate(f, [10, 16], [2.4, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad) });
  const o = interpolate(f, [10, 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const shake = f >= 16 && f < 24 ? Math.sin(f * 2.2) * (24 - f) * 0.9 : 0;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: BOTTOM - 150, display: 'flex', justifyContent: 'center', opacity: o, transform: `translateX(${shake}px)` }}>
      <div style={{ fontFamily: theme.display, fontSize: 84, color: '#ff4040', border: '10px solid #ff4040', borderRadius: 20, padding: '10px 34px', transform: `scale(${s}) rotate(-8deg)`,
        background: b_light ? 'rgba(255,255,255,0.92)' : 'rgba(20,20,22,0.55)', letterSpacing: 2 }}>{text}</div>
    </div>
  );
};

export const BeatsScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const beats = (scene.props.beats as Beat[]) ?? [];
  let i = 0;
  beats.forEach((b, k) => { if (frame >= b.from) i = k; });
  const b = beats[i];
  if (!b) return null;
  const f = frame - b.from;
  const len = (beats[i + 1]?.from ?? scene.frames) - b.from;
  const cont = b.kind === 'rank' && beats[i - 1]?.kind === 'rank';
  const punch = cont ? 1 : interpolate(f, [0, 8], [1.1, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const flash = interpolate(f, [0, 5], [i === 0 || cont ? 0 : 0.45, 0], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ fontFamily: theme.font, wordBreak: 'keep-all' }}>
      <AbsoluteFill style={{ transform: `scale(${punch})` }}>
        <Sequence from={b.from} layout="none"><Visual b={b} f={f} len={len} /></Sequence>
      </AbsoluteFill>
      {!['memo', 'demo', 'icons', 'approve'].includes(b.kind) && (b.blobs ?? []).map((sb, k) => <PickleBlob key={'gb' + k} s={sb} f={f} i={k} />)}
      {b.credit && (() => { const paper = ['memo', 'icons', 'approve', 'rank', 'card'].includes(b.kind); return <div style={{ position: 'absolute', right: 60, top: 1730, fontSize: 30, fontWeight: 600, color: paper ? '#4a443c' : theme.bone, opacity: paper ? 0.85 : 0.75, textShadow: paper ? undefined : '0 2px 8px rgba(0,0,0,0.8)' }}>{b.credit}</div>; })()}
      {b.stamp && b.kind !== 'win' && b.kind !== 'desk' && b.kind !== 'tower' && <Stamp text={b.stamp} f={f} light={['memo', 'rank', 'card'].includes(b.kind)} />}
      {b.sticker && <Sticker s={b.sticker} f={f} />}
      <AbsoluteFill style={{ background: '#fff', opacity: flash, pointerEvents: 'none' }} />
      <BeatSfx beats={beats} />
    </AbsoluteFill>
  );
};
