import { AbsoluteFill, Audio, Easing, Img, Loop, OffthreadVideo, Sequence, interpolate, random, spring, staticFile, useVideoConfig } from 'remotion';
import { theme } from '../theme';
import { winHits } from './WinBeat';
import { deskHits } from './DeskBeat';
import { towerHits } from './TowerBeat';

// Motion beats for the hybrid short: real Pickle demo footage in a phone, Pickle's own characters
// (transparent idle loops from pickle.com) with speech bubbles, app icons slamming in, a payment
// approval tap and accounts wiring into the agent. Everything is driven by `f` (frames into the beat).
/* eslint-disable @typescript-eslint/no-explicit-any */
type B = any;

export const IVORY = '#F4EEE1';
const INK = '#1d1d1f';
const STEP = 3;
const jit = (seed: string, f: number, a: number) => (random(seed + '-' + Math.floor(f / STEP)) - 0.5) * a;
const sec = (s: number | undefined, fps: number) => Math.round((s ?? 0) * fps);

// ---------- Pickle character + speech bubble ----------
export type BlobSpec = { src: string; x: number; y: number; size?: number; at?: number; say?: string; sayAt?: number; flip?: boolean; bubbleSide?: 'left' | 'right' };

export const PickleBlob: React.FC<{ s: BlobSpec; f: number; i?: number }> = ({ s, f, i = 0 }) => {
  const { fps } = useVideoConfig();
  const t = f - sec(s.at, fps);
  if (t < 0) return null;
  const size = s.size ?? 300;
  const p = spring({ frame: t, fps, config: { damping: 9, mass: 0.7, stiffness: 160 } });
  const bob = Math.sin((t / fps) * Math.PI * 1.4 + i) * 8;
  const st = t - sec(s.sayAt ?? (s.at ?? 0) + 0.35, fps) + sec(s.at, fps);
  const q = s.say && st >= 0 ? spring({ frame: st, fps, config: { damping: 10, mass: 0.8, stiffness: 140 } }) : 0;
  const right = (s.bubbleSide ?? 'right') === 'right';
  return (
    <div style={{ position: 'absolute', left: s.x + '%', top: s.y + '%', width: size, height: size, transform: `translateY(${(1 - p) * 160 + bob}px) scale(${0.4 + 0.6 * p})`, transformOrigin: '50% 100%' }}>
      <Loop durationInFrames={180}>
        <OffthreadVideo src={staticFile(s.src)} transparent muted style={{ width: '100%', height: '100%', transform: s.flip ? 'scaleX(-1)' : undefined }} />
      </Loop>
      {s.say && q > 0 && (
        <div style={{ position: 'absolute', bottom: size * 0.82, [right ? 'left' : 'right']: size * 0.55, whiteSpace: 'nowrap', fontFamily: theme.display, fontSize: 64, color: INK,
          background: '#fff', border: `6px solid ${INK}`, borderRadius: 40, padding: '14px 34px', boxShadow: '0 10px 0 rgba(0,0,0,0.18)',
          transform: `scale(${q}) rotate(${right ? -3 : 3}deg)`, transformOrigin: right ? '0% 100%' : '100% 100%' }}>
          {s.say}
          <div style={{ position: 'absolute', bottom: -30, [right ? 'left' : 'right']: 40, width: 0, height: 0, borderLeft: '22px solid transparent', borderRight: '22px solid transparent', borderTop: `32px solid ${INK}` }} />
        </div>
      )}
    </div>
  );
};

// ---------- Real demo video in a phone, over Pickle's blurred hero ----------
export const DemoBeat: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const p = spring({ frame: f, fps, config: { damping: 14, mass: 0.9 } });
  const H = 990, W = Math.round((H * 600) / 1298);
  return (
    <AbsoluteFill style={{ background: '#EAF3FB' }}>
      <OffthreadVideo src={staticFile('pk/hero.mp4')} muted style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(26px) saturate(1.1)', transform: 'scale(1.15)' }} />
      <AbsoluteFill style={{ background: 'rgba(255,255,255,0.28)' }} />
      <div style={{ position: 'absolute', left: (1080 - W) / 2 + (b.phoneX ?? 0), top: 250, width: W, height: H, borderRadius: 64, overflow: 'hidden', border: `14px solid ${INK}`,
        background: '#fff', boxShadow: '0 40px 90px rgba(30,40,70,0.35)', transform: `translateY(${(1 - p) * 300}px) rotate(${(1 - p) * 4 + (b.tilt ?? 0)}deg)` }}>
        <OffthreadVideo src={staticFile(b.src)} muted startFrom={sec(b.start, fps)} playbackRate={b.rate ?? 1} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      {(b.blobs ?? []).map((s: BlobSpec, i: number) => <PickleBlob key={i} s={s} f={f} i={i} />)}
    </AbsoluteFill>
  );
};

// ---------- App icons slamming in, one per spoken name ----------
export const IconsBeat: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const items: { src: string; label: string; at?: number }[] = b.items ?? [];
  const n = items.length;
  const size = 270, gap = 50, total = n * size + (n - 1) * gap;
  return (
    <AbsoluteFill style={{ background: IVORY }}>
      <AbsoluteFill style={{ backgroundImage: 'radial-gradient(rgba(0,0,0,0.07) 2px, transparent 2px)', backgroundSize: '36px 36px' }} />
      {items.map((it, i) => {
        const t = f - sec(it.at ?? i * 0.3, fps);
        if (t < 0) return null;
        const s = interpolate(t, [0, 4, 7, 10], [2.3, 0.88, 1.06, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });
        const rot = (random('ic' + i) - 0.5) * 14;
        const shake = t < 8 ? Math.sin(t * 2.4) * (8 - t) : 0;
        return (
          <div key={i} style={{ position: 'absolute', left: (1080 - total) / 2 + i * (size + gap), top: 600 + (i % 2) * 70, width: size, textAlign: 'center',
            transform: `translateX(${shake}px) rotate(${rot}deg) scale(${s})` }}>
            <Img src={staticFile(it.src)} style={{ width: size, height: size, borderRadius: 62, boxShadow: '0 22px 40px rgba(0,0,0,0.22)', border: '6px solid #fff' }} />
            <div style={{ marginTop: 22, fontFamily: theme.display, fontSize: 64, color: INK }}>{it.label}</div>
          </div>
        );
      })}
      {(b.blobs ?? []).map((s: BlobSpec, i: number) => <PickleBlob key={i} s={s} f={f} i={i} />)}
    </AbsoluteFill>
  );
};

// ---------- Payment approval: a finger taps "승인" ----------
export const ApproveBeat: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const card = spring({ frame: f, fps, config: { damping: 13, mass: 0.9 } });
  const press = sec(b.pressAt ?? 1.1, fps);
  const move = interpolate(f, [6, press], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const down = f >= press && f < press + 5;
  const done = f >= press + 3;
  const ripple = interpolate(f, [press, press + 14], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const ok = spring({ frame: f - press - 3, fps, config: { damping: 9, mass: 0.6 } });
  const btnY = 745;
  const fx = interpolate(move, [0, 1], [880, 600]), fy = interpolate(move, [0, 1], [1500, btnY + 40]);
  return (
    <AbsoluteFill style={{ background: IVORY }}>
      <AbsoluteFill style={{ backgroundImage: 'repeating-linear-gradient(180deg, transparent 0 78px, rgba(60,90,140,0.12) 78px 80px)' }} />
      <div style={{ position: 'absolute', left: 130, top: 330, width: 820, background: '#fff', borderRadius: 52, padding: '46px 54px 50px', boxShadow: '0 40px 90px rgba(0,0,0,0.18)',
        transform: `translateY(${(1 - card) * 400}px)`, fontFamily: theme.font, color: INK }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <Img src={staticFile('pk/blob_green.png')} style={{ width: 92, height: 92 }} />
          <div style={{ fontSize: 50, fontWeight: 800 }}>결제 승인 요청</div>
        </div>
        <div style={{ height: 2, background: '#eee', margin: '34px 0' }} />
        {(b.rows ?? []).map((r: [string, string], i: number) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: i === (b.rows.length - 1) ? 52 : 42, fontWeight: i === (b.rows.length - 1) ? 800 : 600,
            color: i === (b.rows.length - 1) ? INK : '#666', marginBottom: 20 }}><span>{r[0]}</span><span>{r[1]}</span></div>
        ))}
        <div style={{ marginTop: 30, height: 130, borderRadius: 30, background: done ? '#1FB85A' : INK, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 54, fontWeight: 800, transform: `scale(${down ? 0.94 : 1})` }}>
          {done ? <span style={{ display: 'inline-block', transform: `scale(${0.6 + 0.4 * ok})` }}>승인 완료 ✓</span> : '승인하기'}
        </div>
        {b.note && <div style={{ marginTop: 22, fontSize: 30, color: '#999', textAlign: 'center' }}>{b.note}</div>}
      </div>
      {/* tap ripple + fingertip */}
      {ripple > 0 && ripple < 1 && <div style={{ position: 'absolute', left: 600 - 120 * ripple, top: btnY + 40 - 120 * ripple, width: 240 * ripple, height: 240 * ripple, borderRadius: '50%',
        border: `8px solid ${theme.doodle}`, opacity: 1 - ripple }} />}
      <div style={{ position: 'absolute', left: fx - 46, top: fy - 46, width: 92, height: 92, borderRadius: '50%', background: 'rgba(255,255,255,0.55)', border: `7px solid ${INK}`,
        boxShadow: '0 12px 24px rgba(0,0,0,0.25)', transform: `scale(${down ? 0.82 : 1})` }} />
      {(b.blobs ?? []).map((s: BlobSpec, i: number) => <PickleBlob key={i} s={s} f={f} i={i} />)}
    </AbsoluteFill>
  );
};

// ---------- Accounts wiring into the agent, "what it can see" meter rises ----------
export const ConnectBeat: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const icons: string[] = b.icons ?? [];
  const cx = 540, cy = 760, R = 360;
  const every = sec(b.every ?? 0.32, fps);
  const connected = Math.max(0, Math.min(icons.length, Math.floor(f / every) + 1));
  const meter = spring({ frame: f, fps, durationInFrames: every * icons.length, config: { damping: 30 } });
  const secAt = sec(b.secAt ?? 2.8, fps);
  const sp = spring({ frame: f - secAt, fps, config: { damping: 10, mass: 0.8 } });
  return (
    <AbsoluteFill style={{ background: theme.ink }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 40%, ${theme.accent}33, transparent 60%)` }} />
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        {icons.map((_, i) => {
          const t = f - i * every;
          if (t < 0) return null;
          const a = (i / icons.length) * Math.PI * 2 - Math.PI / 2;
          const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.9;
          const d = interpolate(t, [2, 9], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return <line key={i} x1={x} y1={y} x2={x + (cx - x) * d} y2={y + (cy - y) * d} stroke={theme.accent} strokeWidth={6} strokeDasharray="14 12" strokeDashoffset={-f * 3} opacity={0.9} />;
        })}
      </svg>
      {icons.map((src, i) => {
        const t = f - i * every;
        if (t < 0) return null;
        const a = (i / icons.length) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.9;
        const s = spring({ frame: t, fps, config: { damping: 9, mass: 0.6, stiffness: 180 } });
        const fly = 1 - s;
        return <Img key={i} src={staticFile(src)} style={{ position: 'absolute', left: x - 70 + Math.cos(a) * 300 * fly, top: y - 70 + Math.sin(a) * 300 * fly, width: 140, height: 140,
          borderRadius: 34, border: '5px solid #fff', boxShadow: '0 14px 30px rgba(0,0,0,0.4)', transform: `scale(${s})` }} />;
      })}
      <div style={{ position: 'absolute', left: cx - 150, top: cy - 170 }}>
        <PickleBlob s={{ src: b.center ?? 'pk/intro_pickle_pieup_idle-540.webm', x: 0, y: 0, size: 300 }} f={f} />
      </div>
      {/* what the agent can see */}
      <div style={{ position: 'absolute', left: 120, right: 120, top: 1190, fontFamily: theme.font }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 44, fontWeight: 800, color: theme.bone, marginBottom: 14 }}>
          <span>AI가 볼 수 있는 정보</span><span style={{ color: theme.accent }}>{connected} / {icons.length}</span>
        </div>
        <div style={{ height: 34, borderRadius: 17, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(connected / icons.length) * 100 * Math.min(1, meter + 0.1)}%`, background: `linear-gradient(90deg, ${theme.caption}, ${theme.accent})` }} />
        </div>
      </div>
      {f >= secAt && b.secSrc && (
        <div style={{ position: 'absolute', left: cx + 70, top: cy - 230, transform: `scale(${sp}) rotate(${jit('sec', f, 3) + 6}deg)` }}>
          <Img src={staticFile(b.secSrc)} style={{ width: 150, height: 150, borderRadius: 32, background: '#2a2b31', border: `6px solid ${theme.doodle}`, boxShadow: `0 0 40px ${theme.doodle}88` }} />
        </div>
      )}
    </AbsoluteFill>
  );
};

// ---------- Sound effects: explicit `sfx` list + automatic hits per beat kind ----------
type Hit = { at: number; name: string; vol?: number };
export const beatHits = (b: B, fps: number): { f: number; name: string; vol: number }[] => {
  if (b.kind === 'win' || b.kind === 'desk' || b.kind === 'tower') {
    const w: Hit[] = [...(b.sfx ?? []), ...(b.kind === 'tower' ? towerHits(b) : b.kind === 'desk' ? deskHits(b) : winHits(b))];
    if (b.from > 0 && b.kind !== 'tower') w.push({ at: 0, name: 'whoosh', vol: 0.3 });
    return w.map((h) => ({ f: b.from + Math.round(h.at * fps), name: h.name, vol: h.vol ?? 0.35 }));
  }
  const hits: Hit[] = [...(b.sfx ?? [])];
  const cont = b.kind === 'rank' && b.prevKind === 'rank';
  if (b.kind === 'card' && !b.mystery) hits.push({ at: 0.02, name: 'stamp', vol: 0.35 });
  if (b.kind === 'rank') (b.rows ?? []).forEach((r: { at?: number }) => r.at !== undefined && r.at >= 0 && hits.push({ at: r.at, name: 'stamp', vol: 0.3 }));
  if (b.cut !== false && b.from > 0 && !cont) hits.push({ at: 0, name: ['memo', 'icons', 'approve', 'card'].includes(b.kind) ? 'send' : 'whoosh', vol: 0.3 });
  (b.notes ?? []).forEach((n: { at?: number }) => n.at && hits.push({ at: n.at, name: 'pop', vol: 0.32 }));
  // Pickle character entrance: char_pop.mp3 (cute cartoon pop the user picked in EP.04), on the frame the character pops in
  (b.blobs ?? []).forEach((s: BlobSpec) => hits.push({ at: Math.max(0, s.at ?? 0), name: 'char_pop', vol: 0.24 }));
  (b.items ?? []).forEach((it: { at?: number }, i: number) => hits.push({ at: it.at ?? i * 0.3, name: 'pop', vol: 0.45 }));
  if (b.kind === 'approve') { hits.push({ at: b.pressAt ?? 1.1, name: 'send', vol: 0.5 }); hits.push({ at: (b.pressAt ?? 1.1) + 0.1, name: 'ding', vol: 0.4 }); }
  if (b.kind === 'connect') (b.icons ?? []).forEach((_: string, i: number) => hits.push({ at: i * (b.every ?? 0.32), name: 'pop', vol: 0.3 }));
  if (b.stamp) hits.push({ at: 10 / fps, name: 'stamp', vol: 0.45 });
  return hits.map((h) => ({ f: b.from + Math.round(h.at * fps), name: h.name, vol: h.vol ?? 0.35 }));
};

export const BeatSfx: React.FC<{ beats: B[] }> = ({ beats }) => {
  const { fps } = useVideoConfig();
  const all = beats.flatMap((b, i) => beatHits({ ...b, prevKind: beats[i - 1]?.kind }, fps));
  return <>{all.map((h, i) => <Sequence key={i} from={h.f} durationInFrames={Math.round((h.name.startsWith('t_') ? 2.2 : 1.6) * fps)} layout="none"><Audio src={staticFile(`sfx/${h.name}.mp3`)} volume={h.vol} /></Sequence>)}</>;
};
