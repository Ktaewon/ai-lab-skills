import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, spring, staticFile, useVideoConfig } from 'remotion';
import { theme } from '../theme';

// Ivory motion-graphic beats (2026-11 shorts: EP.08 GPT-6.2 and the news shorts). Use them instead of
// post-it memos and side-bar cards (user, 2026-11-18). Dispatched from BeatsScene via MOTION.
// Original note: project motion-graphic beats (2026-11 shorts, ivory look). Everything is smooth: springs and eased
// interpolations driven by `f` (frames into the beat) — no stop-motion jitter, no per-frame random.
// Each beat lists its timed parts in `items` ([{ at, ... }]) so BeatSfx gives every entrance a pop.
/* eslint-disable @typescript-eslint/no-explicit-any */
type B = any;

export const IVORY = '#FBF7EE';
const INK = '#1E1D1B';
const MUTED = '#8A847A';
const LINE = '#E7DFCF';
const YELLOW = '#FFE45C';
const RED = '#F0453A';
const ACCENT = theme.accent;
export const TITLE = '"Pretendard", -apple-system, "Apple SD Gothic Neo", sans-serif';

const sec = (s: number | undefined, fps: number) => Math.round((s ?? 0) * fps);
const ease = (f: number, a: number, b: number) =>
  interpolate(f, [a, b], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
const useSpring = () => {
  const { fps } = useVideoConfig();
  return (t: number, damping = 16, mass = 0.8) => (t < 0 ? 0 : spring({ frame: t, fps, config: { damping, mass, stiffness: 120 } }));
};
const Ground: React.FC<{ children?: React.ReactNode; dots?: boolean }> = ({ children, dots = true }) => (
  <AbsoluteFill style={{ background: IVORY, fontFamily: TITLE, color: INK }}>
    {dots && <AbsoluteFill style={{ backgroundImage: 'radial-gradient(rgba(30,29,27,0.07) 2px, transparent 2px)', backgroundSize: '40px 40px' }} />}
    {children}
  </AbsoluteFill>
);
// A title line with a yellow highlighter swept behind it (the new title style).
export const HiTitle: React.FC<{ text: string; f: number; at?: number; size?: number; top: number; color?: string }> = ({ text, f, at = 0, size = 76, top }) => {
  const { fps } = useVideoConfig();
  const t = f - sec(at, fps);
  if (t < 0) return null;
  // Project title style (user, 2026-11-13): plain ink Pretendard Black, no colour fill.
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top, textAlign: 'center', opacity: ease(t, 0, 6), transform: `translateY(${(1 - ease(t, 0, 9)) * 24}px)` }}>
      <span style={{ fontFamily: TITLE, fontWeight: 900, fontSize: size, lineHeight: 1.25, color: INK, whiteSpace: 'pre-line', letterSpacing: '-0.03em' }}>{text}</span>
    </div>
  );
};

// ---------- headline: a real article crop; the camera pushes into it and a highlighter marks the line ----------
export const HeadlineBeat: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const sp = useSpring();
  const W = 940, ar = b.ar ?? 0.6, H = Math.min(W * ar, b.maxH ?? 820);
  const top = b.top ?? 440;
  const enter = sp(f, 18);
  const fz = b.focus as undefined | { x: number; y: number; s: number; at?: number };
  const z = fz ? ease(f, sec(fz.at ?? 0.5, fps), sec(fz.at ?? 0.5, fps) + 22) : 0;
  const s = 1 + ((fz?.s ?? 1) - 1) * z;
  const ox = fz ? (50 - fz.x) * (s - 1) * (W / 100) / s : 0, oy = fz ? (50 - fz.y) * (s - 1) * ((W * ar) / 100) / s : 0;
  return (
    <Ground>
      {b.title && <HiTitle text={b.title} f={f} at={b.titleAt ?? 0.15} top={Math.max(310, top - 130)} size={b.titleSize ?? 66} />}
      <div style={{ position: 'absolute', left: (1080 - W) / 2, top, width: W, height: H, borderRadius: 26, overflow: 'hidden', background: '#fff',
        boxShadow: '0 30px 70px rgba(60,45,20,0.18)', border: `2px solid ${LINE}`, opacity: enter, transform: `translateY(${(1 - enter) * 120}px)` }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: W * ar, transform: `scale(${s}) translate(${ox}px, ${oy}px)`, transformOrigin: '50% 50%' }}>
          <Img src={staticFile(b.src)} style={{ width: '100%', height: '100%' }} />
          {(b.marks ?? []).map((m: B, i: number) => {
            const p = ease(f, sec(m.at, fps), sec(m.at, fps) + 10);
            return <div key={i} style={{ position: 'absolute', left: m.x + '%', top: m.y + '%', width: m.w * p + '%', height: m.h + '%', background: m.color ?? 'rgba(255,214,0,0.42)', borderRadius: 6, mixBlendMode: 'multiply' }} />;
          })}
        </div>
      </div>
      {b.caption && <HiTitle text={b.caption} f={f} at={b.captionAt ?? 1.2} top={top + H + 40} size={b.captionSize ?? 64} color={b.captionColor ?? YELLOW} />}
      {(b.items ?? []).filter((x: B) => x.stamp).map((x: B, i: number) => <Stamp key={i} text={x.stamp} f={f - sec(x.at, fps)} top={x.top ?? top + H - 90} />)}
    </Ground>
  );
};

export const Stamp: React.FC<{ text: string; f: number; top: number; left?: number }> = ({ text, f, top, left }) => {
  if (f < 0) return null;
  const s = interpolate(f, [0, 6], [2.2, 1], { extrapolateRight: 'clamp', easing: Easing.in(Easing.quad) });
  const o = interpolate(f, [0, 2], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', left: left ?? 0, right: left == null ? 0 : undefined, top, display: 'flex', justifyContent: 'center', opacity: o }}>
      <div style={{ fontFamily: TITLE, fontWeight: 900, fontSize: 84, color: RED, border: `10px solid ${RED}`, borderRadius: 20, padding: '6px 34px', transform: `scale(${s}) rotate(-8deg)`,
        background: 'rgba(255,255,255,0.85)' }}>{text}</div>
    </div>
  );
};

// ---------- hud: real photo/video with callout lines drawn to labelled points ----------
export const HudBeat: React.FC<{ b: B; f: number; len: number }> = ({ b, f, len }) => {
  const { fps } = useVideoConfig();
  const sp = useSpring();
  const push = interpolate(f, [0, Math.max(1, len)], [1.04, 1.12]);
  const scan = ease(f, 0, 26);
  return (
    <AbsoluteFill style={{ background: INK }}>
      {b.src.endsWith('.mp4')
        ? <OffthreadVideo src={staticFile(b.src)} muted style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: b.pos ?? '50% 50%', transform: `scale(${push})` }} />
        : <Img src={staticFile(b.src)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: b.pos ?? '50% 50%', transform: `scale(${push})` }} />}
      <AbsoluteFill style={{ background: 'rgba(20,20,24,0.28)' }} />
      {scan < 1 && <div style={{ position: 'absolute', left: 0, right: 0, top: 260 + scan * 1100, height: 6, background: YELLOW, boxShadow: `0 0 40px ${YELLOW}`, opacity: 1 - scan * 0.6 }} />}
      <svg width={1080} height={1920} style={{ position: 'absolute', inset: 0 }}>
        {(b.items ?? []).map((it: B, i: number) => {
          const t = f - sec(it.at, fps);
          if (t < 0) return null;
          const x = (it.x / 100) * 1080, y = (it.y / 100) * 1920, lx = (it.lx / 100) * 1080, ly = (it.ly / 100) * 1920;
          const d = ease(t, 3, 12);
          const ring = 18 + 10 * Math.sin((t / fps) * Math.PI * 2);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={sp(t, 12) * 16} fill={YELLOW} />
              <circle cx={x} cy={y} r={ring + 14} fill="none" stroke={YELLOW} strokeWidth={4} opacity={0.7} />
              <line x1={x} y1={y} x2={x + (lx - x) * d} y2={y + (ly - y) * d} stroke={YELLOW} strokeWidth={6} strokeLinecap="round" />
            </g>
          );
        })}
      </svg>
      {(b.items ?? []).map((it: B, i: number) => {
        const t = f - sec(it.at, fps) - 10;
        if (t < 0) return null;
        const p = sp(t, 14);
        return (
          <div key={i} style={{ position: 'absolute', left: (it.lx / 100) * 1080, top: (it.ly / 100) * 1920, transform: `translate(${it.lx > 50 ? '-100%' : '0'}, -50%) scale(${p})`,
            transformOrigin: it.lx > 50 ? '100% 50%' : '0% 50%', background: YELLOW, color: INK, fontFamily: TITLE, fontWeight: 900, fontSize: 64, padding: '10px 28px', borderRadius: 16,
            whiteSpace: 'nowrap', boxShadow: '0 12px 30px rgba(0,0,0,0.3)' }}>{it.text}</div>
        );
      })}
    </AbsoluteFill>
  );
};

// ---------- chat: a conversation that builds up bubble by bubble (typing dots first) ----------
export const ChatBeat: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const sp = useSpring();
  const items: B[] = b.items ?? [];
  let y = b.top ?? 440;
  return (
    <Ground>
      {b.title && <HiTitle text={b.title} f={f} top={y - 120} size={60} />}
      {items.map((m, i) => {
        const at = sec(m.at, fps);
        const ai = m.who === 'ai';
        const typing = ai && f >= at - 12 && f < at;
        const shown = f >= at;
        const lines = String(m.text).split('\n').length;
        const h = 60 * lines * 1.3 + 56;
        const top = y;
        if (shown || typing) y += h + 24;
        if (!shown && !typing) return null;
        const p = sp(f - (shown ? at : at - 12), 15);
        return (
          <div key={i} style={{ position: 'absolute', top, left: ai ? 90 : undefined, right: ai ? undefined : 90, display: 'flex', alignItems: 'flex-end', gap: 20, flexDirection: ai ? 'row' : 'row-reverse',
            opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>
            <div style={{ width: 96, height: 96, borderRadius: 48, background: ai ? ACCENT : INK, color: '#fff', fontWeight: 900, fontSize: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {ai ? 'AI' : (m.avatar ?? '나')}
            </div>
            <div style={{ maxWidth: 700, background: ai ? '#fff' : YELLOW, border: `3px solid ${ai ? LINE : YELLOW}`, borderRadius: 36, padding: '24px 36px', fontSize: 60, fontWeight: 800,
              lineHeight: 1.3, whiteSpace: 'pre-line', boxShadow: '0 12px 26px rgba(60,45,20,0.12)' }}>
              {typing && !shown ? <Dots f={f} /> : m.text}
            </div>
          </div>
        );
      })}
      {b.note && <div style={{ position: 'absolute', right: 90, top: 1200, fontSize: 34, fontWeight: 700, color: MUTED }}>{b.note}</div>}
    </Ground>
  );
};
const Dots: React.FC<{ f: number }> = ({ f }) => (
  <span style={{ display: 'inline-flex', gap: 12, padding: '8px 0' }}>
    {[0, 1, 2].map((k) => <span key={k} style={{ width: 18, height: 18, borderRadius: 9, background: MUTED, opacity: 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(f / 3 - k)) }} />)}
  </span>
);

// ---------- rules: checklist rows, each with a red result tag ----------
export const RulesBeat: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const sp = useSpring();
  return (
    <Ground>
      {b.title && <HiTitle text={b.title} f={f} top={330} size={70} />}
      {(b.items ?? []).map((it: B, i: number) => {
        const t = f - sec(it.at, fps);
        if (t < 0) return null;
        const p = sp(t, 16);
        const tag = sp(t - 8, 11);
        return (
          <div key={i} style={{ position: 'absolute', left: 80, right: 80, top: 500 + i * 230, height: 190, background: '#fff', borderRadius: 30, border: `2px solid ${LINE}`,
            boxShadow: '0 16px 36px rgba(60,45,20,0.10)', display: 'flex', alignItems: 'center', padding: '0 40px', gap: 28, opacity: p, transform: `translateX(${(1 - p) * -120}px)` }}>
            <svg width={84} height={84} viewBox="0 0 84 84" style={{ flexShrink: 0 }}>
              <circle cx={42} cy={42} r={40} fill={RED} />
              <path d="M27 27 L57 57 M57 27 L27 57" stroke="#fff" strokeWidth={9} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - ease(t, 4, 12)} />
            </svg>
            <div style={{ flex: 1, fontSize: 56, fontWeight: 800, lineHeight: 1.2 }}>{it.text}</div>
            <div style={{ background: RED, color: '#fff', fontSize: 50, fontWeight: 900, padding: '14px 26px', borderRadius: 18, whiteSpace: 'nowrap', transform: `scale(${tag})` }}>{it.result}</div>
          </div>
        );
      })}
    </Ground>
  );
};

// ---------- donut: a percentage ring fills with a count-up in the middle ----------
export const DonutBeat: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const ringAt = sec(b.ringAt ?? 0.3, fps);
  const p = ease(f, ringAt, ringAt + 30);
  const R = 300, C = 2 * Math.PI * R;
  const v = (b.value ?? 0) * p;
  return (
    <Ground>
      {b.title && <HiTitle text={b.title} f={f} top={330} size={64} />}
      <svg width={760} height={760} style={{ position: 'absolute', left: 160, top: 470 }}>
        <circle cx={380} cy={380} r={R} fill="none" stroke={LINE} strokeWidth={64} />
        {p > 0.01 && <circle cx={380} cy={380} r={R} fill="none" stroke={ACCENT} strokeWidth={64} strokeLinecap="round" strokeDasharray={`${C * (b.value / 100) * p} ${C}`} transform="rotate(-90 380 380)" />}
      </svg>
      <div style={{ position: 'absolute', left: 160, top: 470, width: 760, height: 760, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontWeight: 900, fontSize: 190, letterSpacing: '-0.04em', color: INK, fontVariantNumeric: 'tabular-nums', opacity: f >= ringAt ? 1 : 0 }}>
          {v.toFixed(b.decimals ?? 0)}<span style={{ fontSize: 100 }}>%</span>
        </div>
        {b.label && <div style={{ fontSize: 48, fontWeight: 800, color: MUTED, opacity: ease(f, ringAt + 10, ringAt + 20), textAlign: 'center', whiteSpace: 'pre-line' }}>{b.label}</div>}
      </div>
    </Ground>
  );
};

// ---------- calendar: a desk calendar flips month by month and lands on the target; or date tiles ----------
export const CalendarBeat: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const sp = useSpring();
  const flips: string[] = b.flips ?? [];
  const per = b.per ?? 4;
  const idx = Math.min(flips.length - 1, Math.floor(f / per));
  const phase = (f % per) / per;
  const landed = f >= per * (flips.length - 1);
  const land = sp(f - per * (flips.length - 1), 10);
  const Page: React.FC<{ label: string; top?: boolean; rot?: number; z?: number }> = ({ label, rot = 0, z = 0 }) => (
    <div style={{ position: 'absolute', inset: 0, background: '#fff', borderRadius: 34, border: `2px solid ${LINE}`, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', transform: `perspective(1600px) rotateX(${rot}deg)`, transformOrigin: '50% 0%', zIndex: z, backfaceVisibility: 'hidden', boxShadow: '0 20px 50px rgba(60,45,20,0.16)' }}>
      {b.year && <div style={{ fontSize: 60, fontWeight: 800, color: MUTED }}>{b.year}</div>}
      <div style={{ fontWeight: 900, fontSize: 250, lineHeight: 1, color: landed && label === flips[flips.length - 1] ? RED : INK, letterSpacing: '-0.04em' }}>{label}</div>
      {b.sub && landed && label === flips[flips.length - 1] && <div style={{ marginTop: 16, fontSize: 64, fontWeight: 900, opacity: ease(f - per * (flips.length - 1), 4, 12) }}>{b.sub}</div>}
    </div>
  );
  if (b.dates) {
    return (
      <Ground>
        {b.title && <HiTitle text={b.title} f={f} top={340} size={66} />}
        {(b.dates as B[]).map((d, i) => {
          const t = f - sec(d.at, fps);
          if (t < 0) return null;
          const p = sp(t, 13);
          return (
            <div key={i} style={{ position: 'absolute', left: 120 + i * 440, top: 520, width: 400, height: 470, background: '#fff', borderRadius: 32, overflow: 'hidden', border: `2px solid ${LINE}`,
              boxShadow: '0 20px 50px rgba(60,45,20,0.16)', transform: `translateY(${(1 - p) * 160}px) rotate(${(i ? 3 : -3) * p}deg)`, opacity: p, textAlign: 'center' }}>
              <div style={{ height: 110, background: RED, color: '#fff', fontSize: 52, fontWeight: 900, lineHeight: '110px' }}>{d.month}</div>
              <div style={{ fontSize: 210, fontWeight: 900, lineHeight: 1.15, letterSpacing: '-0.04em' }}>{d.day}</div>
              <div style={{ fontSize: 54, fontWeight: 800, color: INK }}>{d.label}</div>
            </div>
          );
        })}
        {b.note && <HiTitle text={b.note} f={f} at={b.noteAt ?? 1.5} top={1080} size={56} color="rgba(240,69,58,0.25)" />}
      </Ground>
    );
  }
  return (
    <Ground>
      {b.title && <HiTitle text={b.title} f={f} top={330} size={66} />}
      <div style={{ position: 'absolute', left: 190, top: 500, width: 700, height: 600, transform: `scale(${landed ? 1 + 0.06 * Math.sin(land * Math.PI) : 1})` }}>
        <div style={{ position: 'absolute', left: 60, right: 60, top: -30, display: 'flex', justifyContent: 'space-around', zIndex: 5 }}>
          {[0, 1, 2, 3, 4].map((k) => <div key={k} style={{ width: 26, height: 70, borderRadius: 13, background: INK }} />)}
        </div>
        <Page label={flips[Math.min(flips.length - 1, idx + (landed ? 0 : 1))]} />
        {!landed && <Page label={flips[idx]} rot={-phase * 100} z={2} />}
      </div>
    </Ground>
  );
};

// ---------- timeline: vertical line, points light up one by one, the active one shows its picture ----------
export const TimelineBeat: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const sp = useSpring();
  const pts: B[] = b.items ?? [];
  const y0 = 420, gap = 290, x = 170;
  const active = b.active ?? 0;
  const prog = ease(f, 0, 18);
  const fromY = y0 + gap * Math.max(0, active - 1), toY = y0 + gap * active;
  return (
    <Ground>
      <div style={{ position: 'absolute', left: x - 5, top: y0, width: 10, height: gap * (pts.length - 1), background: LINE, borderRadius: 5 }} />
      <div style={{ position: 'absolute', left: x - 5, top: y0, width: 10, height: (active === 0 ? 0 : fromY - y0) + (toY - fromY) * prog, background: ACCENT, borderRadius: 5 }} />
      {pts.map((p, i) => {
        const on = i === active, past = i < active;
        const t = f - sec(p.at, fps);
        const pop = on ? sp(t, 9) : 1;
        return (
          <div key={i}>
            <div style={{ position: 'absolute', left: x - 34, top: y0 + i * gap - 34, width: 68, height: 68, borderRadius: 34, background: on || past ? ACCENT : '#fff',
              border: `6px solid ${on || past ? ACCENT : LINE}`, transform: `scale(${on ? 0.6 + 0.5 * pop : 1})`, boxShadow: on ? `0 0 0 ${18 * pop}px rgba(255,106,61,0.18)` : undefined }} />
            <div style={{ position: 'absolute', left: x + 70, top: y0 + i * gap - 50, opacity: on ? 1 : 0.45 }}>
              <div style={{ fontSize: on ? 66 : 52, fontWeight: 900, letterSpacing: '-0.02em' }}>{p.label}</div>
              <div style={{ fontSize: 42, fontWeight: 700, color: MUTED, marginTop: 4 }}>{p.sub}</div>
            </div>
            {on && p.img && (
              <div style={{ position: 'absolute', right: 70, top: y0 + i * gap - 180, width: 360, height: 220, borderRadius: 22, overflow: 'hidden', border: '6px solid #fff',
                boxShadow: '0 18px 40px rgba(60,45,20,0.25)', transform: `scale(${sp(t - 6, 12)}) rotate(4deg)` }}>
                <Img src={staticFile(p.img)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            )}
          </div>
        );
      })}
    </Ground>
  );
};

// ---------- typer: a caption typed out character by character (original, then translation) ----------
export const TyperBeat: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const sp = useSpring();
  const card = sp(f, 16);
  return (
    <Ground>
      {b.title && <HiTitle text={b.title} f={f} top={330} size={62} />}
      <div style={{ position: 'absolute', left: 80, right: 80, top: 470, background: '#fff', borderRadius: 34, border: `2px solid ${LINE}`, padding: '50px 54px',
        boxShadow: '0 24px 60px rgba(60,45,20,0.14)', opacity: card, transform: `translateY(${(1 - card) * 80}px)` }}>
        {(b.items ?? []).map((l: B, i: number) => {
          const t = f - sec(l.at, fps);
          if (t < 0) return null;
          const n = Math.min(l.text.length, Math.floor(t * (l.cps ?? 26) / fps));
          const done = n >= l.text.length;
          return (
            <div key={i} style={{ fontSize: l.size ?? 60, fontWeight: l.weight ?? 800, color: l.color ?? INK, lineHeight: 1.35, whiteSpace: 'pre-line', marginTop: i ? 34 : 0 }}>
              {l.text.slice(0, n)}
              {!done && <span style={{ display: 'inline-block', width: 6, height: (l.size ?? 60) * 0.9, background: ACCENT, marginLeft: 6, verticalAlign: 'middle' }} />}
            </div>
          );
        })}
      </div>
    </Ground>
  );
};

// ---------- vs: two cards and a VS badge; the winner gets a marker ring ----------
export const VsBeat: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const sp = useSpring();
  const items: B[] = b.items ?? [];
  const vsAt = sec(b.vsAt ?? 0.4, fps);
  const v = sp(f - vsAt, 9);
  return (
    <Ground>
      {b.title && <HiTitle text={b.title} f={f} top={320} size={60} />}
      {items.map((it, i) => {
        const t = f - sec(it.at, fps);
        if (t < 0) return null;
        const p = sp(t, 14);
        const win = b.winner === i && f >= sec(b.winAt ?? 99, fps);
        return (
          <div key={i} style={{ position: 'absolute', left: 90, right: 90, top: i === 0 ? 450 : 870, height: 300, borderRadius: 34, background: i === 0 ? '#fff' : YELLOW,
            border: `4px solid ${win ? RED : i === 0 ? LINE : YELLOW}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
            boxShadow: '0 18px 40px rgba(60,45,20,0.12)', opacity: p, transform: `translateX(${(1 - p) * (i ? 160 : -160)}px)` }}>
            <div style={{ fontSize: 76, fontWeight: 900, letterSpacing: '-0.02em', whiteSpace: 'pre-line', lineHeight: 1.15 }}>{it.title}</div>
            {it.sub && <div style={{ fontSize: 44, fontWeight: 700, color: MUTED, marginTop: 10 }}>{it.sub}</div>}
            {win && b.winText && <div style={{ position: 'absolute', right: -10, top: -40, background: RED, color: '#fff', fontSize: 46, fontWeight: 900, padding: '8px 24px', borderRadius: 16,
              transform: `rotate(6deg) scale(${sp(f - sec(b.winAt, fps), 10)})` }}>{b.winText}</div>}
          </div>
        );
      })}
      {f >= vsAt && (
        <div style={{ position: 'absolute', left: 540 - 85, top: 765 - 85, width: 170, height: 170, borderRadius: 85, background: INK, color: '#fff', fontSize: 76, fontWeight: 900,
          display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${v}) rotate(${(1 - v) * -90}deg)`, zIndex: 3 }}>VS</div>
      )}
    </Ground>
  );
};

// ---------- meter: a gauge fills; the stage label changes along the way ----------
export const MeterBeat: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const sp = useSpring();
  const end = sec(b.fillTo ?? 3, fps);
  const p = interpolate(f, [4, end], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const items: B[] = b.items ?? [];
  let cur = -1;
  items.forEach((it, i) => { if (f >= sec(it.at, fps)) cur = i; });
  const col = p < 0.5 ? YELLOW : p < 0.85 ? ACCENT : RED;
  return (
    <Ground>
      {b.title && <HiTitle text={b.title} f={f} top={360} size={70} />}
      <div style={{ position: 'absolute', left: 120, right: 120, top: 620, height: 120, borderRadius: 60, background: '#fff', border: `3px solid ${LINE}`, overflow: 'hidden' }}>
        <div style={{ width: `${p * 100}%`, height: '100%', background: col, borderRadius: 60 }} />
      </div>
      <div style={{ position: 'absolute', left: 120, right: 120, top: 760, display: 'flex', justifyContent: 'space-between', fontSize: 40, fontWeight: 800, color: MUTED }}>
        <span>{b.min ?? '0'}</span><span style={{ color: p > 0.95 ? RED : MUTED }}>{b.max ?? 'MAX'}</span>
      </div>
      {cur >= 0 && (
        <div key={cur} style={{ position: 'absolute', left: 0, right: 0, top: 900, textAlign: 'center', fontSize: 120, fontWeight: 900, letterSpacing: '-0.03em',
          color: cur === items.length - 1 ? RED : INK, transform: `scale(${0.7 + 0.3 * sp(f - sec(items[cur].at, fps), 10)})` }}>{items[cur].text}</div>
      )}
    </Ground>
  );
};

// ---------- card: a quote card; optional stamp slams on it ----------
export const CardBeat: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const sp = useSpring();
  const p = sp(f, 15);
  return (
    <Ground>
      {b.title && <HiTitle text={b.title} f={f} top={340} size={60} />}
      <div style={{ position: 'absolute', left: 90, right: 90, top: 480, background: '#fff', borderRadius: 36, border: `2px solid ${LINE}`, borderLeft: `20px solid ${b.tone === 'bad' ? RED : ACCENT}`,
        padding: '60px 56px', fontSize: b.size ?? 78, fontWeight: 900, lineHeight: 1.3, whiteSpace: 'pre-line', letterSpacing: '-0.02em', boxShadow: '0 24px 60px rgba(60,45,20,0.14)',
        opacity: p, transform: `translateY(${(1 - p) * 90}px)` }}>
        {b.sub && <div style={{ fontSize: 40, fontWeight: 700, color: MUTED, marginBottom: 20 }}>{b.sub}</div>}
        {b.text}
      </div>
      {(b.items ?? []).filter((x: B) => x.stamp).map((x: B, i: number) => <Stamp key={i} text={x.stamp} f={f - sec(x.at, fps)} top={x.top ?? 980} />)}
    </Ground>
  );
};

// ---------- poll: two options to vote for in the comments ----------
export const PollBeat: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const sp = useSpring();
  const colors = [YELLOW, '#BFE3FF', '#FFC2CF'];
  return (
    <Ground>
      {b.title && <HiTitle text={b.title} f={f} top={360} size={72} />}
      {(b.items ?? []).map((it: B, i: number) => {
        const t = f - sec(it.at, fps);
        if (t < 0) return null;
        const p = sp(t, 12);
        const glow = 0.5 + 0.5 * Math.sin((f / fps) * Math.PI * 1.5 + i * Math.PI);
        return (
          <div key={i} style={{ position: 'absolute', left: 140, right: 140, top: 560 + i * 230, height: 180, borderRadius: 90, background: colors[i % 3], display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 72, fontWeight: 900, transform: `scale(${p * (1 + 0.025 * glow)})`, boxShadow: `0 ${10 + 8 * glow}px 30px rgba(60,45,20,0.16)` }}>{it.text}</div>
        );
      })}
      {b.cta && <HiTitle text={b.cta} f={f} at={b.ctaAt ?? 1.2} top={1060} size={56} color="rgba(255,106,61,0.35)" />}
    </Ground>
  );
};

// ---------- ticker: split-flap board; letters settle one per spoken letter ----------
export const TickerBeat: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const sp = useSpring();
  const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const items: B[] = b.items ?? [];
  const board = sp(f, 16);
  return (
    <Ground>
      {b.title && <HiTitle text={b.title} f={f} top={360} size={64} />}
      <div style={{ position: 'absolute', left: 120, right: 120, top: 520, height: 420, background: INK, borderRadius: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 26,
        boxShadow: '0 30px 70px rgba(30,29,27,0.3)', opacity: board, transform: `translateY(${(1 - board) * 80}px)` }}>
        {items.map((it, i) => {
          const t = f - sec(it.at, fps);
          const settled = t >= 8;
          const ch = t < 0 ? '' : settled ? it.text : AZ[(Math.floor(f / 2) * 7 + i * 5) % 26];
          const p = settled ? sp(t - 8, 10) : 0;
          return (
            <div key={i} style={{ width: 230, height: 300, borderRadius: 24, background: '#2B2A27', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 230, fontWeight: 900, color: settled ? ACCENT : '#6D6A63', transform: `scale(${settled ? 0.92 + 0.08 * p : 1})` }}>
              {ch}
              <div style={{ position: 'absolute', left: 0, right: 0, top: 148, height: 4, background: INK }} />
            </div>
          );
        })}
      </div>
      {b.sub && <div style={{ position: 'absolute', left: 0, right: 0, top: 990, textAlign: 'center', fontSize: 56, fontWeight: 800, color: MUTED, opacity: ease(f, 10, 20) }}>{b.sub}</div>}
    </Ground>
  );
};

// ---------- range: a price band draws on an axis, then a second fact counts up ----------
export const RangeBeat: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const sp = useSpring();
  const [lo, hi] = b.axis ?? [60, 90];
  const [a, c] = b.band ?? [70, 78];
  const X = (v: number) => 120 + ((v - lo) / (hi - lo)) * 840;
  const d = ease(f, 6, 24);
  const nAt = sec(b.nextAt ?? 3, fps);
  const n = ease(f, nAt, nAt + 24);
  return (
    <Ground>
      {b.title && <HiTitle text={b.title} f={f} top={360} size={66} />}
      <div style={{ position: 'absolute', left: 120, width: 840, top: 640, height: 16, borderRadius: 8, background: LINE }} />
      <div style={{ position: 'absolute', left: X(a), width: (X(c) - X(a)) * d, top: 612, height: 72, borderRadius: 36, background: ACCENT }} />
      {[a, c].map((v, i) => (
        <div key={i} style={{ position: 'absolute', left: X(v), top: 470, transform: `translateX(-50%) scale(${sp(f - 6 - i * 10, 11)})`, fontSize: 96, fontWeight: 900, letterSpacing: '-0.03em' }}>
          {b.prefix ?? '$'}{v}
        </div>
      ))}
      {b.next && f >= nAt && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 820, textAlign: 'center' }}>
          <div style={{ fontSize: 50, fontWeight: 800, color: MUTED }}>{b.next.label}</div>
          <div style={{ fontSize: 150, fontWeight: 900, letterSpacing: '-0.04em', color: INK, fontVariantNumeric: 'tabular-nums' }}>
            {(() => { const man = Math.round(b.next.man * n); const eok = Math.floor(man / 10000), rest = man % 10000; return `${eok ? eok + '억 ' : ''}${rest ? rest.toLocaleString('en-US') + '만' : ''} ${b.next.unit}`; })()}
          </div>
        </div>
      )}
    </Ground>
  );
};

// ---------- stats: rows of big numbers counting up with a growing underline ----------
export const StatsBeat: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  return (
    <Ground>
      {b.title && <HiTitle text={b.title} f={f} top={340} size={62} />}
      {(b.items ?? []).map((it: B, i: number) => {
        const t = f - sec(it.at, fps);
        if (t < 0) return null;
        const p = ease(t, 0, it.count ?? 26); // count: frames for the count-up (short beats need it faster)
        const v = it.value * p;
        return (
          <div key={i} style={{ position: 'absolute', left: 100, right: 100, top: 500 + i * 370, opacity: ease(t, 0, 6) }}>
            <div style={{ fontSize: 50, fontWeight: 800, color: MUTED }}>{it.label}</div>
            <div style={{ fontSize: 190, fontWeight: 900, letterSpacing: '-0.04em', color: i === (b.items.length - 1) ? ACCENT : INK, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>
              {it.decimals ? v.toFixed(it.decimals) : Math.round(v).toLocaleString('en-US')}<span style={{ fontSize: 90 }}>{it.unit}</span>
            </div>
            <div style={{ height: 14, width: `${p * 100}%`, background: YELLOW, borderRadius: 7 }} />
          </div>
        );
      })}
    </Ground>
  );
};

// ---------- duel: two models compared row by row; bars draw smoothly, a red tag lands on the point ----------
// groups: [{ label, at, segments?, rows: [{ name, v, hi? }], tag?, tagAt? }]. With `segments` the bars are
// drawn as that many blocks (cost in fifths), otherwise v is a 0..1 share of the track.
export const DuelBeat: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const sp = useSpring();
  const groups: B[] = b.groups ?? [];
  const TRACK = 640;
  return (
    <Ground>
      {b.title && <HiTitle text={b.title} f={f} top={320} size={64} />}
      {b.sub && <div style={{ position: 'absolute', left: 0, right: 0, top: 418, textAlign: 'center', fontSize: 36, fontWeight: 700, color: MUTED, opacity: ease(f, 4, 12) }}>{b.sub}</div>}
      {groups.map((g, gi) => {
        const t = f - sec(g.at, fps);
        if (t < 0) return null;
        const top = 520 + gi * 340;
        const tagT = f - sec(g.tagAt ?? (g.at ?? 0) + 0.9, fps);
        return (
          <div key={gi} style={{ position: 'absolute', left: 80, right: 80, top, height: 300, background: '#fff', borderRadius: 30, border: `2px solid ${LINE}`,
            boxShadow: '0 16px 36px rgba(60,45,20,0.10)', opacity: ease(t, 0, 6), transform: `translateY(${(1 - sp(t, 16)) * 60}px)` }}>
            <div style={{ position: 'absolute', left: 40, top: 26, fontSize: 46, fontWeight: 900, letterSpacing: '-0.02em' }}>{g.label}</div>
            {(g.rows ?? []).map((r: B, ri: number) => {
              const d = ease(t, 4 + ri * 6, 26 + ri * 6);
              const y = 104 + ri * 92;
              const col = r.hi ? ACCENT : '#BDB5A6';
              return (
                <div key={ri} style={{ position: 'absolute', left: 40, top: y, display: 'flex', alignItems: 'center', gap: 24 }}>
                  <div style={{ width: 150, fontSize: 44, fontWeight: 900, color: r.hi ? INK : MUTED }}>{r.name}</div>
                  <div style={{ position: 'relative', width: TRACK, height: 64, borderRadius: 18, background: '#F1EBDF', overflow: 'hidden' }}>
                    {g.segments
                      ? Array.from({ length: r.v }).map((_, k) => {
                          const kp = ease(t, 4 + ri * 6 + k * 3, 12 + ri * 6 + k * 3);
                          const w = TRACK / g.segments;
                          return <div key={k} style={{ position: 'absolute', left: k * w + 4, top: 6, width: (w - 8) * kp, height: 52, borderRadius: 12, background: col }} />;
                        })
                      : <div style={{ width: TRACK * r.v * d, height: '100%', borderRadius: 18, background: col }} />}
                  </div>
                </div>
              );
            })}
            {g.tag && tagT >= 0 && (
              <div style={{ position: 'absolute', right: 30, top: 18, background: RED, color: '#fff', fontSize: 46, fontWeight: 900, padding: '8px 24px', borderRadius: 16,
                transform: `rotate(4deg) scale(${sp(tagT, 10)})` }}>{g.tag}</div>
            )}
          </div>
        );
      })}
      {b.note && <div style={{ position: 'absolute', left: 0, right: 0, top: 1210, textAlign: 'center', fontSize: 32, fontWeight: 700, color: MUTED, opacity: ease(f, 10, 20) }}>{b.note}</div>}
    </Ground>
  );
};

// ---------- stall: a long task's progress bar fills, then freezes part-way; steps stop ticking ----------
// stopAt: share where it stops (0..1), stallAt: seconds, steps: [{ text, doneAt? }], seal + sealAt (own stamp, timed).
export const StallBeat: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const sp = useSpring();
  const stall = sec(b.stallAt ?? 1, fps);
  const stop = b.stopAt ?? 0.58;
  const p = interpolate(f, [3, stall], [0, stop], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });
  const stalled = f >= stall;
  const card = sp(f, 16);
  const W = 840;
  return (
    <Ground>
      {b.title && <HiTitle text={b.title} f={f} top={320} size={64} />}
      <div style={{ position: 'absolute', left: 80, right: 80, top: 450, height: 560, background: '#fff', borderRadius: 34, border: `2px solid ${LINE}`,
        boxShadow: '0 24px 60px rgba(60,45,20,0.14)', opacity: card, transform: `translateY(${(1 - card) * 70}px)` }}>
        <div style={{ position: 'absolute', left: 40, top: 34, fontSize: 44, fontWeight: 800, color: MUTED }}>{b.label ?? '작업 진행률'}</div>
        <div style={{ position: 'absolute', right: 40, top: 26, fontSize: 56, fontWeight: 900, letterSpacing: '-0.02em', color: stalled ? RED : ACCENT }}>
          {stalled ? '멈춤' : '진행 중' + '.'.repeat(1 + (Math.floor(f / 6) % 3))}
        </div>
        <div style={{ position: 'absolute', left: 40, top: 130, width: W - 80, height: 56, borderRadius: 28, background: '#F1EBDF', overflow: 'hidden' }}>
          <div style={{ width: `${p * 100}%`, height: '100%', borderRadius: 28, background: stalled ? '#BDB5A6' : ACCENT }} />
        </div>
        {(b.steps ?? []).map((st: B, i: number) => {
          const done = st.doneAt != null && f >= sec(st.doneAt, fps);
          const cut = st.doneAt == null && stalled;
          const dp = done ? sp(f - sec(st.doneAt, fps), 11) : 0;
          return (
            <div key={i} style={{ position: 'absolute', left: 40, right: 40, top: 230 + i * 105, height: 96, display: 'flex', alignItems: 'center', gap: 26,
              opacity: st.doneAt == null && !stalled ? 0.45 : 1 }}>
              <div style={{ width: 70, height: 70, borderRadius: 35, flexShrink: 0, background: done ? '#2FB36B' : cut ? RED : '#F1EBDF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transform: `scale(${done ? 0.7 + 0.3 * dp : 1})` }}>
                {done && <svg width={40} height={40} viewBox="0 0 40 40"><path d="M8 21 L17 29 L32 11" stroke="#fff" strokeWidth={6} fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                {cut && <div style={{ display: 'flex', gap: 8 }}><div style={{ width: 9, height: 30, background: '#fff', borderRadius: 3 }} /><div style={{ width: 9, height: 30, background: '#fff', borderRadius: 3 }} /></div>}
              </div>
              <div style={{ fontSize: 52, fontWeight: 800, color: cut ? RED : INK }}>{st.text}</div>
            </div>
          );
        })}
      </div>
      {b.seal && <Stamp text={b.seal} f={f - sec(b.sealAt ?? (b.stallAt ?? 1) + 0.25, fps)} top={1030} />}
      {b.note && <div style={{ position: 'absolute', left: 0, right: 0, top: 1210, textAlign: 'center', fontSize: 32, fontWeight: 700, color: MUTED }}>{b.note}</div>}
    </Ground>
  );
};

export const MOTION: Record<string, React.FC<{ b: B; f: number; len: number }>> = {
  headline: HeadlineBeat, hud: HudBeat, chat: ChatBeat, rules: RulesBeat, donut: DonutBeat, calendar: CalendarBeat, timeline: TimelineBeat,
  typer: TyperBeat, vs: VsBeat, meter: MeterBeat, textcard: CardBeat, poll: PollBeat, ticker: TickerBeat, range: RangeBeat, stats: StatsBeat, duel: DuelBeat, stall: StallBeat,
};

// ---------- meme sticker: a reaction image/clip pops in on a word (polaroid with a caption) ----------
export const MemeSticker: React.FC<{ m: B; f: number }> = ({ m, f }) => {
  const { fps } = useVideoConfig();
  const sp = useSpring();
  const t = f - sec(m.at, fps);
  if (t < 0 || (m.until != null && f >= sec(m.until, fps))) return null;
  const p = sp(t, 11, 0.7);
  const w = m.w ?? 560, h = m.h ?? Math.round(w * (m.ar ?? 0.75));
  const isVid = String(m.src).endsWith('.mp4') || String(m.src).endsWith('.webm');
  return (
    <div style={{ position: 'absolute', left: ((m.x ?? 50) / 100) * 1080 - w / 2, top: ((m.y ?? 45) / 100) * 1920 - h / 2, width: w, background: '#fff', padding: 14, paddingBottom: m.label ? 10 : 14,
      borderRadius: 12, boxShadow: '0 26px 60px rgba(30,29,27,0.35)', transform: `scale(${p}) rotate(${(m.rot ?? -4) * p}deg)`, zIndex: 20 }}>
      <div style={{ width: '100%', height: h, overflow: 'hidden', borderRadius: 4, background: '#000' }}>
        {isVid
          ? <OffthreadVideo src={staticFile(m.src)} startFrom={sec(m.start, fps)} muted={!m.sound} volume={m.volume ?? 0.6} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: m.pos ?? '50% 50%' }} />
          : <Img src={staticFile(m.src)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: m.pos ?? '50% 50%' }} />}
      </div>
      {m.label && <div style={{ fontFamily: TITLE, fontWeight: 900, fontSize: 50, color: INK, textAlign: 'center', paddingTop: 8, letterSpacing: '-0.02em' }}>{m.label}</div>}
      {m.credit && <div style={{ fontSize: 22, color: MUTED, textAlign: 'right', fontWeight: 600 }}>{m.credit}</div>}
    </div>
  );
};

// ---------- money fx: banknotes rain down, or burst out from the middle ----------
const Bill: React.FC<{ x: number; y: number; r: number; s: number; flip: number }> = ({ x, y, r, s, flip }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: 150, height: 74, transform: `rotate(${r}deg) scale(${s}) scaleY(${flip})`, borderRadius: 8, background: '#7BC47F',
    border: '4px solid #3E8E4A', boxShadow: '0 6px 14px rgba(30,29,27,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: 52, height: 52, borderRadius: 26, border: '4px solid #3E8E4A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: TITLE, fontWeight: 900, fontSize: 34, color: '#2E6E39' }}>$</div>
  </div>
);
export const MoneyFx: React.FC<{ fx: B; f: number }> = ({ fx, f }) => {
  const { fps } = useVideoConfig();
  const t = f - sec(fx.at, fps);
  if (t < 0) return null;
  const n = fx.count ?? 34;
  const seed = (k: number, s: string) => {
    const v = Math.sin(k * 127.1 + s.length * 311.7 + (fx.seed ?? 1) * 74.7) * 43758.5453;
    return v - Math.floor(v);
  };
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', zIndex: 15, overflow: 'hidden' }}>
      {Array.from({ length: n }, (_, k) => {
        if (fx.type === 'burst') {
          const a = seed(k, 'a') * Math.PI * 2, v = 24 + seed(k, 'v') * 30, tt = t / fps;
          const x = 540 + Math.cos(a) * v * tt * 30 - 75, y = (fx.cy ?? 820) + Math.sin(a) * v * tt * 30 + 900 * tt * tt - 37;
          const o = interpolate(tt, [0, 0.1, 1.6, 2.2], [0, 1, 1, 0], { extrapolateRight: 'clamp' });
          return <div key={k} style={{ opacity: o }}><Bill x={x} y={y} r={tt * 400 * (seed(k, 'r') - 0.5)} s={0.7 + 0.5 * seed(k, 's')} flip={Math.cos(tt * 8 + k)} /></div>;
        }
        const delay = seed(k, 'd') * 1.6 * fps;
        const tt = (t - delay) / fps;
        if (tt < 0) return null;
        const speed = 380 + seed(k, 'sp') * 300;
        const x = seed(k, 'x') * 1100 - 60 + Math.sin(tt * 2.2 + k) * 50;
        const y = -120 + tt * speed;
        if (y > 2000) return null;
        return <Bill key={k} x={x} y={y} r={Math.sin(tt * 2 + k) * 35 + seed(k, 'r') * 40} s={0.6 + 0.5 * seed(k, 's')} flip={Math.cos(tt * 4 + k)} />;
      })}
    </AbsoluteFill>
  );
};
