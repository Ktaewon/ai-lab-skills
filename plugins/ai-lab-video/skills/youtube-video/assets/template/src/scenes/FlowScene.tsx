import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Doodle } from '../components/Doodle';
import { theme, useLayout } from '../theme';
import type { Scene } from '../types';

// Architecture flow (ByteByteGo style): rounded nodes pop in, edges draw themselves, then glowing
// packets run each step's path hop by hop. The node a packet reaches pulses in the accent and a
// checklist panel shows the current step big and ticks steps off. A step with `fail` dies half-way
// along its first hop (red X, shake, hand-drawn retry loop); the next step usually re-runs the same
// path and succeeds. `done` stamps a mint badge and sets every edge flowing.
// Use it to explain how a system / agent / pipeline works, or to replay what happened in a run.
//
// props: title?, kicker? (small accent line above the title)
//        nodes: [{id, label, sub?, icon?, x, y, xShort?, yShort?}]
//               x, y = position in % of the diagram area (0 = left/top, 100 = right/bottom).
//               9:16 uses xShort/yShort when given, otherwise the layout is transposed (x↔y), so a
//               wide 3×2 grid becomes a tall 2×3 one.
//               icon: user | agent | db | llm | answer | server | cloud | file | code | tool (optional)
//        edges: [{from, to}] (node ids; drawn as arrows)
//        runs:  [{path: [ids], label, fail?, failText?, say|at}] — the steps: a packet runs along path when
//               said (failText = hand-written note at the failure point, e.g. "타임아웃!").
//               Named `runs` because prepare.py reserves a scene's `steps` key (it never reaches props).
//        done?: {text, say|at} — the finish stamp
//        retryText? (hand-written label of the retry loop, default "재시도 ↺")
// Every timed item gets `from` (frame) from prepare.py; without it steps are spread over the scene.
// 16:9: diagram left, checklist top-right (lower right stays free for the mascot).
// 9:16: title, diagram in the middle band, checklist under it (left 2/3, mascot room on the right).
type Icon = 'user' | 'agent' | 'db' | 'llm' | 'answer' | 'server' | 'cloud' | 'file' | 'code' | 'tool';
type FlowNode = { id: string; label: string; sub?: string; icon?: Icon; x: number; y: number; xShort?: number; yShort?: number };
type Edge = { from: string; to: string };
type Step = { path: string[]; label: string; fail?: boolean; failText?: string; from?: number };
type Done = { text: string; from?: number };
type Pt = { x: number; y: number };

const HOP = 0.7; // seconds per hop
const FAIL_AT = 0.55; // a failing packet dies at this fraction of its first hop
const RED = '#FF4B42';
const NODE_IN = 0.4;
const NODE_GAP = 0.25;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
// Rough rendered width: Hangul ≈ 1em, latin/digits ≈ 0.56em, space ≈ 0.3em.
const textW = (s: string, fs: number) => [...s].reduce((w, ch) => w + (/[ᄀ-퟿　-鿿]/.test(ch) ? 1 : ch === ' ' ? 0.3 : 0.56) * fs, 0);

const Glyph: React.FC<{ icon: Icon; color: string; size: number }> = ({ icon, color, size }) => {
  const s = { fill: 'none', stroke: color, strokeWidth: 4.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg width={size} height={size} viewBox="0 0 60 60">
      {icon === 'user' && (<><circle cx={30} cy={20} r={10} {...s} /><path d="M10 52 C12 36 48 36 50 52" {...s} /></>)}
      {icon === 'agent' && (<><rect x={10} y={18} width={40} height={30} rx={9} {...s} /><path d="M30 18 V10" {...s} /><circle cx={30} cy={7} r={3.5} fill={color} /><circle cx={22} cy={33} r={3.5} fill={color} /><circle cx={38} cy={33} r={3.5} fill={color} /><path d="M4 29 V38 M56 29 V38" {...s} /></>)}
      {icon === 'db' && (<><ellipse cx={30} cy={14} rx={18} ry={7} {...s} /><path d="M12 14 V46 C12 55 48 55 48 46 V14" {...s} /><path d="M12 30 C12 39 48 39 48 30" {...s} /></>)}
      {icon === 'llm' && (<><path d="M30 6 C32 22 38 28 54 30 C38 32 32 38 30 54 C28 38 22 32 6 30 C22 28 28 22 30 6 Z" {...s} /><circle cx={49} cy={11} r={3.5} fill={color} /></>)}
      {icon === 'answer' && (<><path d="M8 12 H52 V40 H26 L14 50 V40 H8 Z" {...s} /><path d="M17 22 H43 M17 30 H34" {...s} /></>)}
      {icon === 'server' && (<><rect x={10} y={8} width={40} height={18} rx={5} {...s} /><rect x={10} y={34} width={40} height={18} rx={5} {...s} /><circle cx={19} cy={17} r={3} fill={color} /><circle cx={19} cy={43} r={3} fill={color} /><path d="M30 17 H42 M30 43 H42" {...s} /></>)}
      {icon === 'cloud' && <path d="M17 46 C7 46 5 33 14 30 C13 19 27 15 32 23 C37 14 52 18 50 30 C58 32 57 46 47 46 Z" {...s} />}
      {icon === 'file' && (<><path d="M14 6 H36 L48 18 V54 H14 Z" {...s} /><path d="M36 6 V18 H48 M21 30 H41 M21 39 H41" {...s} /></>)}
      {icon === 'code' && (<><path d="M20 16 L7 30 L20 44 M40 16 L53 30 L40 44" {...s} /><path d="M34 10 L26 50" {...s} /></>)}
      {icon === 'tool' && <path d="M38 8 C30 8 26 16 29 22 L9 42 C7 44 7 48 9 50 C11 52 15 52 17 50 L37 30 C43 33 51 29 51 21 L45 27 L38 25 L36 18 Z" {...s} />}
    </svg>
  );
};

export const FlowScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { vertical, width, height } = useLayout();
  const { title, kicker, nodes = [], edges = [], runs, steps: legacySteps, done: rawDone, retryText = '재시도 ↺' } = scene.props as {
    title?: string; kicker?: string; nodes?: FlowNode[]; edges?: Edge[]; runs?: Step[]; steps?: Step[]; done?: Done; retryText?: string;
  };
  const rawSteps = runs ?? legacySteps ?? [];
  const t = frame / fps;
  const F = (s: number) => Math.round(s * fps);

  // ---- Timing: `from` (frames) from prepare.py, else spread steps (+ done) over the scene ----
  const nTimed = rawSteps.length + (rawDone ? 1 : 0);
  const s0 = 1.2 * fps;
  const s1 = Math.max(s0 + 1, scene.frames - 1.5 * fps);
  const spreadAt = (i: number) => (nTimed <= 1 ? s0 : s0 + (i * (s1 - s0)) / (nTimed - 1)) / fps;
  const steps = rawSteps.map((s, i) => ({ ...s, at: s.from != null ? s.from / fps : spreadAt(i) }));
  const done = rawDone ? { text: rawDone.text, at: rawDone.from != null ? rawDone.from / fps : spreadAt(rawSteps.length) } : undefined;

  // ---- Geometry: node boxes sized to the grid they form, centres from % of the diagram area ----
  const area = vertical ? { left: 70, right: 1010, top: 440, bottom: 930 } : { left: 140, right: 1330, top: 262, bottom: 895 };
  const pos = (n: FlowNode) => (vertical ? { px: n.xShort ?? n.y, py: n.yShort ?? n.x } : { px: n.x, py: n.y });
  const cols = new Set(nodes.map((n) => Math.round(pos(n).px))).size || 1;
  const rows = new Set(nodes.map((n) => Math.round(pos(n).py))).size || 1;
  const baseW = vertical ? 420 : 310;
  const baseH = vertical ? 136 : 150;
  const areaW = area.right - area.left;
  const areaH = area.bottom - area.top;
  const W = Math.min(baseW, (areaW - (cols - 1) * 90) / cols);
  const H = Math.min(baseH, (areaH - (rows - 1) * (vertical ? 84 : 64)) / rows);
  const k = Math.min(W / baseW, H / baseH);
  const byId: Record<string, Pt> = Object.fromEntries(
    nodes.map((n) => {
      const p = pos(n);
      return [n.id, { x: area.left + W / 2 + (p.px / 100) * (areaW - W), y: area.top + H / 2 + (p.py / 100) * (areaH - H) }];
    }),
  );
  const exitPoint = (a: Pt, b: Pt, pad: number) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const sx = dx === 0 ? Infinity : (W / 2 + pad) / Math.abs(dx);
    const sy = dy === 0 ? Infinity : (H / 2 + pad) / Math.abs(dy);
    const s = Math.min(sx, sy);
    return { x: a.x + dx * s, y: a.y + dy * s };
  };
  const edgeGeom = (a: Pt, b: Pt) => {
    const p0 = exitPoint(a, b, 10);
    const p1 = exitPoint(b, a, 16);
    return { p0, p1, len: Math.hypot(p1.x - p0.x, p1.y - p0.y) };
  };
  type Geom = ReturnType<typeof edgeGeom>;
  const lerpPt = (g: Geom, q: number) => ({ x: g.p0.x + (g.p1.x - g.p0.x) * q, y: g.p0.y + (g.p1.y - g.p0.y) * q });
  const valid = (s: Step) => s.path.length >= 2 && s.path.every((id) => byId[id]);
  const nodeAt = (id: string) => NODE_IN + Math.max(0, nodes.findIndex((n) => n.id === id)) * NODE_GAP;
  const edgeAt = (e: Edge) => Math.max(nodeAt(e.from), nodeAt(e.to)) + 0.25;

  const stepIdx = steps.reduce((acc, s, i) => (t >= s.at ? i : acc), -1);
  const step = stepIdx >= 0 ? steps[stepIdx] : undefined;
  const isDone = !!done && t >= done.at;

  // ---- Failure beat (first failing step) ----
  const failStep = steps.find((s) => s.fail && valid(s));
  const retryStep = failStep ? steps[steps.indexOf(failStep) + 1] : undefined;
  const failHit = failStep ? failStep.at + HOP * FAIL_AT : 1e6; // finite: interpolate() rejects Infinity
  const failK = interpolate(t, [failHit, failHit + 0.07, failHit + 0.6], [0, 1, 0], clamp);
  const shake = failK * 14 * Math.sin(frame * 2.7);
  const failEdge = failStep ? edgeGeom(byId[failStep.path[0]], byId[failStep.path[1]]) : undefined;
  const failPt = failEdge ? lerpPt(failEdge, FAIL_AT) : undefined;
  const failOn = !!failStep && t >= failHit && (!retryStep || t < retryStep.at + 0.3);
  const xPop = spring({ frame: frame - F(failHit), fps, config: { damping: 9 } });
  const retryDraw = interpolate(t, [failHit + 0.55, failHit + 1.1], [0, 1], clamp);
  const retryOut = retryStep ? interpolate(t, [retryStep.at + 0.9, retryStep.at + 1.2], [1, 0], clamp) : 1;
  // The retry loop bulges out below a horizontal edge, beside a vertical one.
  let nrm = { x: 0, y: 1 };
  if (failEdge) {
    const dx = failEdge.p1.x - failEdge.p0.x, dy = failEdge.p1.y - failEdge.p0.y, l = Math.hypot(dx, dy) || 1;
    nrm = { x: -dy / l, y: dx / l };
    if (nrm.y < -0.01) nrm = { x: -nrm.x, y: -nrm.y };
  }

  // The retry label sits beyond the loop; skipped when that is off-frame (e.g. a vertical edge at the side).
  const retryCx = failPt && failEdge ? (failPt.x + failEdge.p0.x) / 2 + nrm.x * 128 : 0;
  const retryFits = retryCx - 120 >= 20 && retryCx + 120 <= width - 20;

  // ---- Node arrivals (pulses and lit state) ----
  const arrivals: { id: string; at: number }[] = [];
  steps.forEach((s) => {
    if (!s.fail && valid(s)) s.path.forEach((id, i) => arrivals.push({ id, at: s.at + i * HOP }));
  });
  const lastArrival = (id: string) => arrivals.filter((a) => a.id === id && t >= a.at).pop()?.at;
  const isLit = (id: string) => isDone || (!!step && !step.fail && step.path.includes(id) && t >= step.at + step.path.indexOf(id) * HOP);

  // ---- Packets ----
  const packets: { x: number; y: number; lead: boolean }[] = [];
  if (step && valid(step)) {
    const local = t - step.at;
    const hops = step.path.length - 1;
    const hopI = Math.min(hops - 1, Math.floor(local / HOP));
    const raw = (local - hopI * HOP) / HOP;
    const stop = step.fail ? FAIL_AT : 1;
    const alive = step.fail ? t < failHit : local < hops * HOP + 0.05;
    if (hopI >= 0 && alive) {
      const g = edgeGeom(byId[step.path[hopI]], byId[step.path[hopI + 1]]);
      const p = Math.min(stop, Easing.inOut(Easing.cubic)(Math.min(1, raw)));
      for (let q = 0; q < 4; q++) packets.push({ ...lerpPt(g, Math.max(0, p - q * 0.05)), lead: q === 0 });
    }
  }
  if (isDone && done) {
    edges.forEach((e, i) => {
      if (!byId[e.from] || !byId[e.to]) return;
      const g = edgeGeom(byId[e.from], byId[e.to]);
      const p = ((t - done.at) * 0.8 + i * 0.27) % 1;
      packets.push({ ...lerpPt(g, p), lead: true });
    });
  }

  const titleIn = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 14 });
  const panelIn = spring({ frame: frame - F(0.3), fps, config: { damping: 200 }, durationInFrames: 16 });
  const stampP = done ? spring({ frame: frame - F(done.at), fps, config: { damping: 9 } }) : 0;

  // ---- Type sizes per format ----
  const titleFs = Math.min(vertical ? 60 : 66, (vertical ? 940 : 1180) / Math.max(1, textW(title ?? '', 1)));
  const labelFs = (vertical ? 46 : 40) * k;
  const subFs = (vertical ? 29 : 25) * k;
  const iconBox = (vertical ? 82 : 78) * k;
  const panel = vertical ? { left: 70, top: 955, width: 640 } : { left: 1385, top: 130, width: 395 };
  const rowH = vertical ? Math.min(54, (1290 - panel.top - 126) / Math.max(1, steps.length)) : Math.min(56, 470 / Math.max(1, steps.length));
  const rowFs = rowH * (vertical ? 0.6 : 0.52);
  const bigFs = vertical ? 50 : 46;
  const centre = { x: (area.left + area.right) / 2, y: (area.top + area.bottom) / 2 };

  return (
    <>
      {(title || kicker) && (
        <div style={{ position: 'absolute', left: area.left, top: vertical ? 312 : 104, opacity: 0.35 + 0.65 * titleIn, transform: `translateY(${(1 - titleIn) * 24}px)` }}>
          {kicker && <div style={{ fontFamily: theme.font, fontWeight: 700, fontSize: vertical ? 32 : 26, color: theme.accent, letterSpacing: 2 }}>{kicker}</div>}
          {title && <div style={{ fontFamily: theme.display, fontSize: titleFs, color: theme.bone, lineHeight: 1.15, whiteSpace: 'nowrap' }}>{title}</div>}
        </div>
      )}

      <AbsoluteFill style={{ transform: `translate(${shake}px, ${shake * 0.5}px)` }}>
        <svg width={width} height={height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          <defs>
            <filter id="flowGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7" /></filter>
          </defs>
          {edges.map((e, i) => {
            if (!byId[e.from] || !byId[e.to]) return null;
            const g = edgeGeom(byId[e.from], byId[e.to]);
            const draw = interpolate(t, [edgeAt(e), edgeAt(e) + 0.45], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
            const active = !!step && !step.fail && step.path.includes(e.from) && step.path.indexOf(e.to) === step.path.indexOf(e.from) + 1;
            const failing = !!failStep && failStep.path[0] === e.from && failStep.path[1] === e.to && failK > 0.05;
            const color = failing ? RED : active || isDone ? theme.accent : '#4A4D57';
            const ang = Math.atan2(g.p1.y - g.p0.y, g.p1.x - g.p0.x);
            const head = `M${g.p1.x - 22 * Math.cos(ang - 0.5)},${g.p1.y - 22 * Math.sin(ang - 0.5)} L${g.p1.x},${g.p1.y} L${g.p1.x - 22 * Math.cos(ang + 0.5)},${g.p1.y - 22 * Math.sin(ang + 0.5)}`;
            return (
              <g key={i}>
                {(active || isDone) && <line x1={g.p0.x} y1={g.p0.y} x2={g.p1.x} y2={g.p1.y} stroke={theme.accent} strokeWidth={12} opacity={0.4} filter="url(#flowGlow)" />}
                <line x1={g.p0.x} y1={g.p0.y} x2={g.p1.x} y2={g.p1.y} stroke={color} strokeWidth={5} strokeLinecap="round" strokeDasharray={g.len} strokeDashoffset={g.len * (1 - draw)} />
                <path d={head} fill="none" stroke={color} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" opacity={draw > 0.95 ? 1 : 0} />
              </g>
            );
          })}
          {failEdge && failPt && retryDraw > 0 && retryOut > 0 && (() => {
            const sx = failPt.x + nrm.x * 26, sy = failPt.y + nrm.y * 26;
            const ex = failEdge.p0.x + nrm.x * 26, ey = failEdge.p0.y + nrm.y * 26;
            const d = `M${sx},${sy} C${sx + nrm.x * 90},${sy + nrm.y * 90} ${ex + nrm.x * 90},${ey + nrm.y * 90} ${ex},${ey}`;
            const a = Math.atan2(-nrm.y, -nrm.x); // the tip points back at the edge
            return (
              <g opacity={retryOut}>
                <path d={d} fill="none" stroke={theme.caption} strokeWidth={5} strokeLinecap="round" pathLength={1000} strokeDasharray={`${retryDraw * 1000} 1000`} />
                {retryDraw > 0.95 && (
                  <path d={`M${ex - 18 * Math.cos(a - 0.6)},${ey - 18 * Math.sin(a - 0.6)} L${ex},${ey} L${ex - 18 * Math.cos(a + 0.6)},${ey - 18 * Math.sin(a + 0.6)}`} fill="none" stroke={theme.caption} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
                )}
              </g>
            );
          })()}
          {packets.map((p, i) => (
            <g key={i} opacity={p.lead ? 1 : 0.5}>
              <circle cx={p.x} cy={p.y} r={p.lead ? 24 : 12} fill={theme.accent} opacity={0.5} filter="url(#flowGlow)" />
              <circle cx={p.x} cy={p.y} r={p.lead ? 10 : 6} fill={p.lead ? '#FFE6DA' : theme.accent} />
            </g>
          ))}
        </svg>

        {failEdge && failPt && retryDraw > 0.6 && retryOut > 0 && retryFits && (
          <div
            style={{
              position: 'absolute', left: (failPt.x + failEdge.p0.x) / 2 + nrm.x * 128 - 120, top: (failPt.y + failEdge.p0.y) / 2 + nrm.y * 128 - 30,
              width: 240, textAlign: 'center', fontFamily: theme.hand, fontSize: vertical ? 54 : 52, color: theme.caption, whiteSpace: 'nowrap',
              opacity: interpolate(retryDraw, [0.6, 1], [0, 1]) * retryOut,
            }}
          >
            {retryText}
          </div>
        )}

        {nodes.map((n) => {
          const b = byId[n.id];
          const p = spring({ frame: frame - F(nodeAt(n.id)), fps, config: { damping: 12, mass: 0.7 } });
          if (p <= 0.001) return null;
          const last = lastArrival(n.id);
          const pulse = last == null ? 0 : interpolate(t - last, [0, 0.1, 0.9], [0, 1, 0.35], clamp);
          const ring = last == null ? 1 : interpolate(t - last, [0, 0.6], [0, 1], clamp);
          const lit = isLit(n.id);
          const glowA = Math.round(0x99 * pulse).toString(16).padStart(2, '0');
          const textRoom = W - (n.icon ? iconBox + 20 * k : 0) - 56 * k;
          const lfs = Math.min(labelFs, textRoom / Math.max(1, textW(n.label, 1)));
          return (
            <div key={n.id} style={{ position: 'absolute', left: b.x - W / 2, top: b.y - H / 2, width: W, height: H, opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * 40}px)` }}>
              {ring < 1 && <div style={{ position: 'absolute', inset: 0, borderRadius: 26, border: `4px solid ${theme.accent}`, opacity: 1 - ring, transform: `scale(${1 + ring * 0.22})` }} />}
              <div
                style={{
                  position: 'absolute', inset: 0, borderRadius: 24 * k, background: lit ? '#24170F' : theme.panel,
                  border: `3px solid ${lit ? theme.accent : theme.panelBorder}`, display: 'flex', alignItems: 'center', gap: 20 * k, padding: `0 ${26 * k}px`,
                  justifyContent: n.icon ? 'flex-start' : 'center',
                  boxShadow: `0 24px 60px rgba(0,0,0,.45), 0 0 ${60 * pulse}px ${theme.accent}${glowA}`,
                }}
              >
                {n.icon && (
                  <div style={{ width: iconBox, height: iconBox, borderRadius: 20 * k, background: lit ? `${theme.accent}22` : '#1D1E24', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Glyph icon={n.icon} color={lit ? theme.accent : theme.bone} size={iconBox * 0.77} />
                  </div>
                )}
                <div style={{ minWidth: 0, textAlign: n.icon ? 'left' : 'center' }}>
                  <div style={{ fontFamily: theme.font, fontWeight: 800, fontSize: lfs, color: theme.bone, lineHeight: 1.1, whiteSpace: 'nowrap' }}>{n.label}</div>
                  {n.sub && <div style={{ fontFamily: theme.font, fontWeight: 500, fontSize: subFs, color: theme.muted, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.sub}</div>}
                </div>
              </div>
            </div>
          );
        })}

        {failOn && failPt && (
          <div style={{ position: 'absolute', left: failPt.x - 40, top: failPt.y - 40, width: 80, height: 80, transform: `scale(${0.4 + 0.6 * xPop}) rotate(${(1 - xPop) * 40}deg)` }}>
            <svg width={80} height={80}>
              <circle cx={40} cy={40} r={35} fill="#2A1212" stroke={RED} strokeWidth={5} />
              <path d="M27 27 L53 53 M53 27 L27 53" stroke={RED} strokeWidth={8} strokeLinecap="round" />
            </svg>
          </div>
        )}
      </AbsoluteFill>

      {failPt && failStep?.failText && (
        <Doodle
          i={7}
          d={{
            type: 'text', at: failHit + 0.15, until: retryStep ? retryStep.at : failHit + 2.5, rotate: -6, text: failStep.failText,
            // above a horizontal edge, beside (opposite the retry loop) a vertical one
            x: (Math.max(40, Math.min(width - 60 - textW(failStep.failText, 56), Math.abs(nrm.y) > 0.5 ? failPt.x - 120 : failPt.x + 50)) / width) * 100,
            y: ((Math.abs(nrm.y) > 0.5 ? Math.max(vertical ? 430 : 212, failPt.y - 150) : failPt.y - 40) / height) * 100, // clear of the title
          }}
        />
      )}

      {/* Step checklist */}
      {steps.length > 0 && (
        <div style={{ position: 'absolute', ...panel, opacity: panelIn, transform: `translateX(${(1 - panelIn) * 40}px)` }}>
          <div style={{ background: theme.panel, border: `2px solid ${theme.panelBorder}`, borderRadius: 24, padding: vertical ? '16px 22px 10px' : '22px 24px 16px', boxShadow: '0 30px 70px rgba(0,0,0,.4)' }}>
            <div style={{ fontFamily: theme.font, fontWeight: 700, fontSize: vertical ? 24 : 22, color: theme.muted, letterSpacing: 3, paddingLeft: 6 }}>
              {isDone ? 'DONE' : step ? `STEP ${stepIdx + 1} / ${steps.length}` : 'READY'}
            </div>
            <div style={{ position: 'relative', height: bigFs * 1.4, overflow: 'hidden', marginTop: 2, paddingLeft: 6 }}>
              {stepIdx < 0 && <div style={{ fontFamily: theme.display, fontSize: bigFs, color: theme.muted, lineHeight: `${bigFs * 1.4}px` }}>대기 중…</div>}
              {steps.map((s, i) => {
                const kin = spring({ frame: frame - F(s.at), fps, config: { damping: 200 }, durationInFrames: 12 });
                const next = steps[i + 1];
                const out = next ? spring({ frame: frame - F(next.at), fps, config: { damping: 200 }, durationInFrames: 12 }) : 0;
                if (kin <= 0.001 || out >= 0.999) return null;
                const failNow = s.fail && t >= failHit;
                const txt = failNow ? `✕ ${s.label}` : s.label;
                const fs = Math.min(bigFs, (panel.width - 70) / Math.max(1, textW(txt, 1)));
                return (
                  <div key={i} style={{ position: 'absolute', left: 6, top: 0, lineHeight: `${bigFs * 1.4}px`, fontFamily: theme.display, fontSize: fs, color: failNow ? RED : theme.accent, whiteSpace: 'nowrap', opacity: kin * (1 - out), transform: `translateY(${(1 - kin) * 50 - out * 50}px)` }}>
                    {txt}
                  </div>
                );
              })}
            </div>
            <div style={{ height: 2, background: theme.panelBorder, margin: vertical ? '6px 0 8px' : '12px 0 10px' }} />
            {steps.map((s, i) => {
              const rowIn = spring({ frame: frame - F(0.5 + i * 0.12), fps, config: { damping: 200 }, durationInFrames: 12 });
              const failed = s.fail && t >= failHit;
              const state = failed ? 'fail' : i < stepIdx || (i === stepIdx && isDone) ? 'done' : i === stepIdx ? 'active' : 'todo';
              const col = state === 'active' ? theme.bone : state === 'done' ? theme.mint : state === 'fail' ? RED : theme.muted;
              const dot = rowH * 0.6;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, height: rowH - 4, padding: '0 12px', borderRadius: 14, marginBottom: 4, background: state === 'active' ? `${theme.accent}26` : 'transparent', opacity: rowIn, transform: `translateY(${(1 - rowIn) * 16}px)` }}>
                  <div style={{ width: dot, height: dot, borderRadius: dot / 2, border: `3px solid ${col}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.font, fontWeight: 900, fontSize: dot * 0.58, color: '#111', background: state === 'done' ? theme.mint : state === 'fail' ? RED : 'transparent', flexShrink: 0, boxSizing: 'border-box' }}>
                    {state === 'done' ? '✓' : state === 'fail' ? '✕' : ''}
                  </div>
                  <div style={{ fontFamily: theme.font, fontWeight: state === 'active' ? 800 : 600, fontSize: rowFs, color: col, textDecoration: state === 'fail' ? 'line-through' : undefined, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {done && isDone && (
        <div style={{ position: 'absolute', left: centre.x, top: centre.y, transform: `translate(-50%, -50%) rotate(-6deg) scale(${2 - stampP})`, opacity: Math.min(1, stampP * 1.4) }}>
          <div style={{ fontFamily: theme.display, fontSize: vertical ? 84 : 76, color: theme.mint, border: `7px solid ${theme.mint}`, borderRadius: 18, padding: '0 28px', background: 'rgba(10,12,14,0.88)', textShadow: `0 0 26px ${theme.mint}88`, whiteSpace: 'nowrap' }}>
            {done.text}
          </div>
        </div>
      )}
    </>
  );
};
