import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, random, spring, staticFile, useVideoConfig } from 'remotion';
import { theme } from '../theme';

// Alternative layouts for `win` beats (`mode`), so a countdown/explainer short does not repeat
// "video + two stat cards" every beat. Each mode fills the area under the fixed title
// (y 410–1280, above the plain captions). Items take `at` (seconds into the beat; prepare.py
// turns an item's `say` into `at`). Modes: blueprint · cards · hex · flow · big · vs · grid · quote.
/* eslint-disable @typescript-eslint/no-explicit-any */
type B = any;
export const AREA_TOP = 490, AREA_H = 830;  // ends at y 1320; plain captions start at 1330
const INK = '#16171B', PANEL = '#24252C', LINE = '#3A3B44', GOLD = '#FFE45C', GOOD = '#5BE3A0', BAD = '#FF6B6B', BLUE = '#1E5AA8';
const sec = (s: number | undefined, fps: number) => Math.round((s ?? 0) * fps);
const pop = (t: number, fps: number) => (t < 0 ? 0 : spring({ frame: t, fps, config: { damping: 12, mass: 0.7 } }));
const tone = (x?: string) => (x === 'good' ? GOOD : x === 'bad' ? BAD : x === 'gold' ? GOLD : '#fff');

const Media: React.FC<{ src: string; start?: number; rate?: number; pos?: string; style?: React.CSSProperties }> = ({ src, start, rate, pos, style }) => {
  const { fps } = useVideoConfig();
  const st: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos ?? '50% 50%', ...style };
  return src.endsWith('.mp4') ? <OffthreadVideo src={staticFile(src)} muted startFrom={sec(start, fps)} playbackRate={rate ?? 1} style={st} /> : <Img src={staticFile(src)} style={st} />;
};

// blueprint: the real thing turns into a blue technical drawing as a scan line sweeps across
// ("완성품 → 설계도"). Fields: src/start/pos, wipeAt (s), labels [left, right].
const Blueprint: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const w = interpolate(f, [sec(b.wipeAt ?? 0.8, fps), sec((b.wipeAt ?? 0.8) + (b.wipeFor ?? 2.2), fps)], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
  const push = interpolate(f, [0, 8 * fps], [1.03, 1.12], { extrapolateRight: 'clamp' });
  const [l, r] = b.labels ?? ['완성품', '설계도'];
  const grid = 'linear-gradient(rgba(255,255,255,0.18) 2px, transparent 2px), linear-gradient(90deg, rgba(255,255,255,0.18) 2px, transparent 2px), linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)';
  return (
    <AbsoluteFill>
      <Media src={b.src} start={b.start} rate={b.rate} pos={b.pos} style={{ transform: `scale(${push})` }} />
      <AbsoluteFill style={{ clipPath: `inset(0 0 0 ${100 - w}%)`, background: BLUE }}>
        <Media src={b.src} start={b.start} rate={b.rate} pos={b.pos}
          style={{ transform: `scale(${push})`, filter: 'grayscale(1) contrast(2.2) brightness(1.4) invert(1)', mixBlendMode: 'screen', opacity: 0.85 }} />
        <AbsoluteFill style={{ backgroundImage: grid, backgroundSize: '120px 120px, 120px 120px, 24px 24px, 24px 24px' }} />
      </AbsoluteFill>
      {w > 0 && w < 100 && <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${100 - w}%`, width: 8, background: '#9FD8FF', boxShadow: '0 0 40px 12px rgba(120,200,255,0.8)' }} />}
      <Tag text={l} x={40} f={f} at={0.2} />
      <Tag text={r} x={null} f={f} at={(b.wipeAt ?? 0.8) + 1} blue />
    </AbsoluteFill>
  );
};
const Tag: React.FC<{ text: string; x: number | null; f: number; at: number; blue?: boolean }> = ({ text, x, f, at, blue }) => {
  const { fps } = useVideoConfig();
  const p = pop(f - sec(at, fps), fps);
  return (
    <div style={{ position: 'absolute', top: 36, ...(x === null ? { right: 40 } : { left: x }), padding: '10px 30px 4px', borderRadius: 18,
      background: blue ? '#E8F4FF' : '#fff', color: blue ? BLUE : INK, fontFamily: theme.display, fontSize: 64, transform: `scale(${p})`, boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>{text}</div>
  );
};

// cards: 2–3 big cards side by side (`items` [{glyph, title, sub, tone, mark: 'x' | 'check', at}])
// — "소스 코드 ✗ / 실행 파일 ✓".
const Cards: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const items: B[] = b.items ?? [], n = items.length, gap = 36, w = (1000 - gap * (n - 1)) / n;
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg,#2A2B33,#1E1F25)' }}>
      {items.map((it, i) => {
        const t = f - sec(it.at ?? i * 0.6, fps), p = pop(t, fps);
        if (t < 0) return null;
        const c = tone(it.tone), mk = pop(t - 10, fps);
        return (
          <div key={i} style={{ position: 'absolute', left: 40 + i * (w + gap), top: 110, width: w, height: 640, borderRadius: 40, background: PANEL, border: `5px solid ${c}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26,
            transform: `translateY(${(1 - p) * 140}px) rotate(${(i - (n - 1) / 2) * 3}deg)`, opacity: Math.min(1, p * 1.4) }}>
            <div style={{ width: 230, height: 280, borderRadius: 26, background: '#fff', position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 30, boxSizing: 'border-box' }}>
              <div style={{ position: 'absolute', top: 40, left: 34, right: 34, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[0.9, 0.7, 0.8, 0.55].map((x, k) => <div key={k} style={{ height: 14, width: `${x * 100}%`, borderRadius: 7, background: '#D6D3CC' }} />)}
              </div>
              <div style={{ fontFamily: theme.mono, fontWeight: 700, fontSize: 40, color: INK }}>{it.glyph}</div>
              {it.mark && (
                <div style={{ position: 'absolute', inset: -30, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${0.3 + 0.7 * mk})`, opacity: mk,
                  fontFamily: theme.display, fontSize: 300, lineHeight: 1, color: it.mark === 'x' ? BAD : GOOD, textShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>{it.mark === 'x' ? '✕' : '✓'}</div>
              )}
            </div>
            <div style={{ fontFamily: theme.display, fontSize: 76, color: c, whiteSpace: 'nowrap' }}>{it.title}</div>
            {it.sub && <div style={{ fontFamily: theme.font, fontWeight: 700, fontSize: 36, color: '#BDB9B1', whiteSpace: 'nowrap' }}>{it.sub}</div>}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// hex: a disassembler view — address / hex bytes / instruction rows scroll by while a cursor bar
// reads them one line at a time. `label` badge, `every` (s per line).
const OPS = ['mov', 'push', 'call', 'cmp', 'jne', 'lea', 'xor', 'ret', 'add', 'test', 'jmp', 'sub'];
const REGS = ['rax', 'rbx', 'rcx', 'rdx', 'rsi', 'rdi', 'r8', 'rsp'];
const Hex: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const rowH = 62, every = sec(b.every ?? 0.35, fps), cur = Math.floor(f / Math.max(1, every));
  const first = Math.max(0, cur - 6);
  const rows = Array.from({ length: 14 }, (_, k) => first + k);
  const hx = (s: string, n: number) => Array.from({ length: n }, (_, j) => Math.floor(random(s + j) * 256).toString(16).padStart(2, '0')).join(' ');
  const off = ((f % every) / every) * (cur > 6 ? rowH : 0);
  return (
    <AbsoluteFill style={{ background: '#0E1014', padding: '0 40px', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 24 - off + 70, left: 40, right: 40 }}>
        {rows.map((r) => {
          const on = r === cur, done = r < cur;
          const op = OPS[Math.floor(random('op' + r) * OPS.length)], a = REGS[Math.floor(random('a' + r) * REGS.length)], c = REGS[Math.floor(random('c' + r) * REGS.length)];
          return (
            <div key={r} style={{ height: rowH, display: 'flex', alignItems: 'center', gap: 34, fontFamily: theme.mono, fontSize: 36, borderRadius: 10, padding: '0 16px',
              background: on ? 'rgba(255,228,92,0.22)' : 'transparent', borderLeft: on ? `8px solid ${GOLD}` : '8px solid transparent', opacity: done ? 0.45 : 1 }}>
              <span style={{ color: '#6B7280' }}>{(0x401000 + r * 4).toString(16)}</span>
              <span style={{ color: '#8BD5FF', width: 330 }}>{hx('h' + r, 4)}</span>
              <span style={{ color: on ? GOLD : '#E5E7EB' }}>{op} {a}, {c}</span>
            </div>
          );
        })}
      </div>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 80, background: '#1B1E25', display: 'flex', alignItems: 'center', gap: 14, padding: '0 30px' }}>
        {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <div key={c} style={{ width: 22, height: 22, borderRadius: 11, background: c }} />)}
        <div style={{ marginLeft: 20, fontFamily: theme.mono, fontSize: 30, color: '#9CA3AF' }}>{b.file ?? 'app.exe — disassembly'}</div>
      </div>
      {b.label && (
        <div style={{ position: 'absolute', right: 40, bottom: 40, padding: '12px 32px 6px', borderRadius: 20, background: GOLD, fontFamily: theme.display, fontSize: 64, color: INK,
          transform: `rotate(-3deg) scale(${pop(f - sec(b.labelAt ?? 0.6, fps), fps)})` }}>{b.label}</div>
      )}
    </AbsoluteFill>
  );
};

// flow: 2–4 nodes top to bottom with arrows and a moving packet ("에이전트 → REA + 분석 도구 → 근거와 설명").
// nodes [{label, sub, icon, tone, at}]
const Flow: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const nodes: B[] = b.nodes ?? [], n = nodes.length, h = 190, gap = (AREA_H - 60 - n * h) / Math.max(1, n - 1);
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 40%, #2C2E38, #1A1B20 75%)' }}>
      {nodes.map((nd, i) => {
        const t = f - sec(nd.at ?? i * 0.8, fps), p = pop(t, fps), y = 30 + i * (h + gap), c = tone(nd.tone);
        const next = nodes[i + 1];
        const tn = next ? f - sec(next.at ?? (i + 1) * 0.8, fps) : -1;
        return (
          <div key={i}>
            {next && t >= 0 && (
              <div style={{ position: 'absolute', left: 536, top: y + h, width: 8, height: gap, background: LINE, borderRadius: 4 }}>
                {tn < 0 && <div style={{ position: 'absolute', left: -12, width: 32, height: 32, borderRadius: 16, background: GOLD, boxShadow: `0 0 24px ${GOLD}`,
                  top: ((t % 24) / 24) * (gap - 32) }} />}
              </div>
            )}
            {t >= 0 && (
              <div style={{ position: 'absolute', left: 110, right: 110, top: y, height: h, borderRadius: 36, background: PANEL, border: `5px solid ${nd.tone ? c : LINE}`,
                display: 'flex', alignItems: 'center', gap: 30, padding: '0 40px', transform: `scale(${0.6 + 0.4 * p})`, opacity: Math.min(1, p * 1.4), boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
                {nd.icon && <Img src={staticFile(nd.icon)} style={{ width: 120, height: 120, borderRadius: 28, flexShrink: 0 }} />}
                <div>
                  <div style={{ fontFamily: theme.display, fontSize: 66, color: nd.tone ? c : '#fff', whiteSpace: 'nowrap' }}>{nd.label}</div>
                  {nd.sub && <div style={{ fontFamily: theme.font, fontWeight: 700, fontSize: 34, color: '#BDB9B1', whiteSpace: 'nowrap' }}>{nd.sub}</div>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// big: one huge number counting up with a label and stars bursting (`value`, `decimals`, `prefix`,
// `unit`, `label`, `sub`, `icon`).
const Big: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const t = f - sec(b.valueAt ?? 0, fps);
  const c = interpolate(t, [0, 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const p = pop(t, fps), land = pop(t - 30, fps);
  const v = ((b.value ?? 0) * c).toFixed(b.decimals ?? 0);
  return (
    <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 50%, #3A2F14, #1A1B20 70%)', alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: 18 }, (_, k) => {
        const a = random('a' + k) * Math.PI * 2, d = (160 + random('d' + k) * 340) * land, s = 30 + random('s' + k) * 40;
        return <div key={k} style={{ position: 'absolute', left: 540 + Math.cos(a) * d - s / 2, top: 430 + Math.sin(a) * d * 0.8 - s / 2, fontSize: s, color: GOLD, opacity: land * (1 - Math.max(0, t - 50) / 40) }}>★</div>;
      })}
      {b.label && <div style={{ fontFamily: theme.display, fontSize: 60, color: '#E2DED6', opacity: p, marginBottom: 10 }}>{b.label}</div>}
      <div style={{ fontFamily: theme.display, fontSize: 250, lineHeight: 1, color: GOLD, transform: `scale(${0.5 + 0.5 * p + 0.06 * land - 0.06 * land * land})`, whiteSpace: 'nowrap',
        textShadow: '0 12px 40px rgba(0,0,0,0.5)', fontVariantNumeric: 'tabular-nums' }}>
        {b.prefix}{v}<span style={{ fontSize: 120 }}>{b.unit}</span>
      </div>
      {b.sub && <div style={{ marginTop: 30, fontFamily: theme.font, fontWeight: 800, fontSize: 42, color: '#BDB9B1', opacity: land }}>{b.sub}</div>}
    </AbsoluteFill>
  );
};

// vs: rows "원조 → 새것" sliding in on their words (`rows` [{from, to, icon, at}]).
const Vs: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const rows: B[] = b.rows ?? [], h = 200, gap = (AREA_H - 80 - rows.length * h) / Math.max(1, rows.length - 1);
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg,#2A2B33,#1E1F25)' }}>
      {rows.map((r, i) => {
        const t = f - sec(r.at ?? i * 0.8, fps), p = pop(t, fps), q = pop(t - 8, fps), y = 40 + i * (h + gap);
        if (t < 0) return null;
        return (
          <div key={i} style={{ position: 'absolute', left: 40, right: 40, top: y, height: h, display: 'flex', alignItems: 'center', gap: 24 }}>
            <div style={{ width: 330, height: 150, borderRadius: 30, background: '#3A3B44', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: theme.display, fontSize: 60, color: '#A9A6A0', transform: `translateX(${(1 - p) * -300}px)`, opacity: p, textDecoration: q > 0.5 ? 'line-through' : 'none', textDecorationColor: BAD, textDecorationThickness: 8 }}>{r.from}</div>
            <div style={{ fontFamily: theme.display, fontSize: 90, color: GOLD, opacity: q, transform: `translateX(${(1 - q) * -40}px)` }}>→</div>
            <div style={{ flex: 1, height: 170, borderRadius: 34, background: PANEL, border: `5px solid ${GOOD}`, display: 'flex', alignItems: 'center', gap: 22, padding: '0 26px',
              transform: `scale(${0.5 + 0.5 * q})`, opacity: q }}>
              {r.icon && <Img src={staticFile(r.icon)} style={{ width: 120, height: 120, borderRadius: 28 }} />}
              <div style={{ fontFamily: theme.display, fontSize: 62, color: '#fff', whiteSpace: 'nowrap' }}>{r.to}</div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

// grid: many icons popping in a grid with a running count (`icons` [src], `every` s, `count` label).
const Grid: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const icons: string[] = b.grid ?? [], cols = b.cols ?? 5, size = 150, gap = 36, every = sec(b.every ?? 0.12, fps);
  const tw = cols * size + (cols - 1) * gap;
  const shown = Math.min(icons.length, Math.floor(f / Math.max(1, every)) + 1);
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg,#2A2B33,#1E1F25)' }}>
      {icons.map((src, i) => {
        const t = f - i * every, p = pop(t, fps);
        if (t < 0) return null;
        return <Img key={i} src={staticFile(src)} style={{ position: 'absolute', left: (1080 - tw) / 2 + (i % cols) * (size + gap), top: 60 + Math.floor(i / cols) * (size + gap),
          width: size, height: size, borderRadius: 34, transform: `scale(${p}) rotate(${(1 - p) * 30}deg)`, boxShadow: '0 12px 24px rgba(0,0,0,0.4)' }} />;
      })}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 40, textAlign: 'center', fontFamily: theme.display, fontSize: 120, color: GOLD, textShadow: '0 8px 30px rgba(0,0,0,0.6)' }}>
        {shown}{shown >= icons.length ? (b.plus ?? '') : ''}<span style={{ fontSize: 64, color: '#fff' }}> {b.count ?? '개'}</span>
      </div>
    </AbsoluteFill>
  );
};

// quote: a paper card with a title and lines; `hl` (index) gets a yellow marker sweep at `hlAt`.
// Also a plain big quote: `lines` + `source`. Use `paper: false` for white text on graphite.
const Quote: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const p = pop(f, fps), paper = b.paper !== false;
  const sw = interpolate(f, [sec(b.hlAt ?? 0.8, fps), sec((b.hlAt ?? 0.8) + 0.6, fps)], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });
  return (
    <AbsoluteFill style={{ background: 'linear-gradient(180deg,#2A2B33,#1E1F25)', alignItems: 'center', justifyContent: b.stamp ? 'flex-start' : 'center', paddingTop: b.stamp ? 60 : 0 }}>
      <div style={{ width: 920, borderRadius: 30, background: paper ? '#F7F4EC' : 'transparent', padding: '56px 60px', boxSizing: 'border-box',
        transform: `translateY(${(1 - p) * 120}px) rotate(${paper ? -1.5 : 0}deg)`, opacity: Math.min(1, p * 1.4), boxShadow: paper ? '0 30px 60px rgba(0,0,0,0.5)' : 'none' }}>
        {b.title && <div style={{ fontFamily: theme.font, fontWeight: 800, fontSize: 38, color: paper ? '#6B6760' : '#A9A6A0', marginBottom: 30 }}>{b.title}</div>}
        {(b.lines ?? []).map((l: string, i: number) => {
          const hi = i === b.hl, size = hi ? Math.min(76, 780 / Math.max(1, l.length * 0.95)) : 40;
          return (
            <div key={i} style={{ fontFamily: hi ? theme.display : theme.font, fontWeight: 700, fontSize: size, lineHeight: 1.35, whiteSpace: 'nowrap', margin: hi ? '18px 0' : '8px 0',
              color: hi ? (paper ? INK : '#fff') : '#8D8880' }}>
              <span style={{ position: 'relative', display: 'inline-block' }}>
                {hi && <span style={{ position: 'absolute', left: -12, top: '22%', height: '68%', width: `calc(${sw}% + 24px)`, background: 'rgba(255,214,0,0.8)', borderRadius: 8 }} />}
                <span style={{ position: 'relative' }}>{l}</span>
              </span>
            </div>
          );
        })}
        {b.source && <div style={{ marginTop: 28, fontFamily: theme.font, fontWeight: 700, fontSize: 30, color: '#8D8880', textAlign: 'right' }}>— {b.source}</div>}
      </div>
    </AbsoluteFill>
  );
};

const MODES: Record<string, React.FC<{ b: B; f: number }>> = { blueprint: Blueprint, cards: Cards, hex: Hex, flow: Flow, big: Big, vs: Vs, grid: Grid, quote: Quote };

export const ModeView: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const M = MODES[b.mode];
  if (!M) return null;
  return (
    <div style={{ position: 'absolute', left: 0, top: AREA_TOP, width: 1080, height: AREA_H, overflow: 'hidden' }}>
      <M b={b} f={f} />
    </div>
  );
};

// headline: a big word slammed over the bottom of a tall video/window (`headline`, `headlineAt`).
export const Headline: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  if (!b.headline) return null;
  const t = f - sec(b.headlineAt ?? 0.4, fps);
  if (t < 0) return null;
  const s = interpolate(t, [0, 5, 8, 11], [2.0, 0.92, 1.04, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });
  return (
    <>
      <div style={{ position: 'absolute', left: 0, right: 0, top: AREA_TOP + AREA_H - 300, height: 300, background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.75))' }} />
      <div style={{ position: 'absolute', left: 30, right: 30, top: AREA_TOP + AREA_H - 200, textAlign: 'center', fontFamily: theme.display, fontSize: b.headline.length > 9 ? 96 : 120,
        color: b.headlineTone === 'white' ? '#fff' : GOLD, WebkitTextStroke: '8px #000', paintOrder: 'stroke fill', transform: `scale(${s}) rotate(-2deg)`, whiteSpace: 'nowrap' }}>{b.headline}</div>
    </>
  );
};

export const modeHits = (b: B): { at: number; name: string; vol: number }[] => {
  const h: { at: number; name: string; vol: number }[] = [];
  const each = (xs: B[] | undefined, gap: number, name = 'pop', vol = 0.35) => (xs ?? []).forEach((x: B, i: number) => h.push({ at: x?.at ?? i * gap, name, vol }));
  if (b.headline) h.push({ at: b.headlineAt ?? 0.4, name: 'stamp', vol: 0.3 });
  if (b.mode === 'blueprint') h.push({ at: b.wipeAt ?? 0.8, name: 'whoosh', vol: 0.4 });
  if (b.mode === 'cards') { each(b.items, 0.6); (b.items ?? []).forEach((x: B, i: number) => x.mark && h.push({ at: (x.at ?? i * 0.6) + 0.35, name: x.mark === 'x' ? 'buzzer' : 'ding', vol: 0.3 })); }
  if (b.mode === 'hex') { for (let s = 0; s < 3; s += 0.7) h.push({ at: s, name: 'type', vol: 0.25 }); }
  if (b.mode === 'flow') each(b.nodes, 0.8);
  if (b.mode === 'big') h.push({ at: (b.valueAt ?? 0) + 1, name: 'ding', vol: 0.35 });
  if (b.mode === 'vs') each(b.rows, 0.8, 'whoosh', 0.3);
  if (b.mode === 'grid') (b.grid ?? []).forEach((_: string, i: number) => i % 3 === 0 && h.push({ at: i * (b.every ?? 0.12), name: 'pop', vol: 0.25 }));
  if (b.mode === 'quote') h.push({ at: b.hlAt ?? 0.8, name: 'pop', vol: 0.3 });
  return h;
};
