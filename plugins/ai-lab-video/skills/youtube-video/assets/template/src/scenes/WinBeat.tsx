import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, spring, staticFile, useVideoConfig } from 'remotion';
import { theme } from '../theme';
import { AREA_TOP, AREA_H, Headline, ModeView, modeHits } from './WinModes';

// "win" beat: the countdown-shorts layout (a big fixed title on top — see FixedHeader in
// ShortVideo — one 16:9 media window, then a 9→1 ladder and stat cards above the plain captions).
// The window shows the model's own official video (src/start/rate), or icons, a mini board,
// a mystery "?" or option cards. Stat cards (`facts`) slide up and count on their spoken word.
/* eslint-disable @typescript-eslint/no-explicit-any */
type B = any;
// Layout sits ~80px lower than the first drafts: phone feeds crop the top of a Short's cover, so
// the fixed title starts at y 190 and the window/area at y 490 (user, 2026-11-14).
export const WIN_TOP = 490, WIN_H = 560;
// `tall: true` (or `posts`) stretches the window down over the ladder/fact area (y 410–1280) for
// vertical videos and captured posts; such beats carry no ladder or facts.
const winH = (b: B) => (b.tall || b.posts ? AREA_TOP + AREA_H - WIN_TOP : WIN_H);
const INK = '#16171B';
const sec = (s: number | undefined, fps: number) => Math.round((s ?? 0) * fps);

type Fact = { label: string; value?: number; text?: string; prefix?: string; unit?: string; decimals?: number; at?: number; tone?: 'good' | 'bad' | 'gold';
  ring?: number; bars?: { label: string; value: number; hi?: boolean }[] };
const TONE = { good: '#5BE3A0', bad: '#FF6B6B', gold: '#FFE45C' } as const;

const FactCard: React.FC<{ fc: Fact; f: number; x: number; w: number }> = ({ fc, f, x, w }) => {
  const { fps } = useVideoConfig();
  const t = f - sec(fc.at, fps);
  if (t < 0) return null;
  const p = spring({ frame: t, fps, config: { damping: 13, mass: 0.7, stiffness: 160 } });
  const c = interpolate(t, [2, 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const color = fc.tone ? TONE[fc.tone] : theme.bone;
  const num = fc.value !== undefined ? (fc.value * c).toFixed(fc.decimals ?? 0) : null;
  return (
    <div style={{ position: 'absolute', left: x, top: WIN_TOP + WIN_H + 106, width: w, height: 156, borderRadius: 28, background: '#24252C', border: `3px solid ${fc.tone ? color + '88' : '#3A3B44'}`,
      transform: `translateY(${(1 - p) * 60}px)`, opacity: Math.min(1, p * 1.4), display: 'flex', alignItems: 'center', padding: '0 26px', gap: 20, boxSizing: 'border-box', overflow: 'hidden' }}>
      {fc.ring !== undefined && (
        <svg width={92} height={92} viewBox="0 0 92 92" style={{ flexShrink: 0 }}>
          <circle cx={46} cy={46} r={38} fill="none" stroke="#3A3B44" strokeWidth={10} />
          <circle cx={46} cy={46} r={38} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" pathLength={1}
            strokeDasharray="1 1" strokeDashoffset={1 - fc.ring * c} transform="rotate(-90 46 46)" />
        </svg>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: theme.font, fontWeight: 700, fontSize: 30, color: '#A9A6A0', whiteSpace: 'nowrap' }}>{fc.label}</div>
        {fc.bars ? (
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {fc.bars.map((b, i) => {
              const mx = Math.max(...fc.bars!.map((x) => x.value));
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 90, fontFamily: theme.display, fontSize: 36, color: b.hi ? color : '#A9A6A0' }}>{b.label}</div>
                  <div style={{ height: 30, width: `${(b.value / mx) * 70 * c}%`, minWidth: 8, borderRadius: 13, background: b.hi ? color : '#5A5B64' }} />
                  <div style={{ fontFamily: theme.display, fontSize: 34, color: b.hi ? color : '#A9A6A0' }}>{fc.prefix ?? ''}{(b.value * c).toFixed(fc.decimals ?? 2)}{fc.unit}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ fontFamily: theme.display, fontSize: (fc.text ?? '').length > 11 ? 42 : (fc.text ?? '').length > 7 ? 52 : 66, lineHeight: 1.1, color, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
            {fc.prefix}{num ?? fc.text}<span style={{ fontSize: 36, marginLeft: 4 }}>{fc.unit}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const Ladder: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  if (!b.ladder) return null;
  const total = b.total ?? 9, s = total > 11 ? 60 : 66, gap = 12, lw = total * s + (total - 1) * gap;  // total: TOP5 → 5, TOP10 → 10
  const p = spring({ frame: f, fps, config: { damping: 10, mass: 0.6 } });
  return (
    <div style={{ position: 'absolute', left: (1080 - lw) / 2, top: WIN_TOP + WIN_H + 28, display: 'flex', gap }}>
      {Array.from({ length: total }, (_, k) => total - k).map((n) => {
        const done = (b.past ?? []).find((x: { r: number }) => x.r === n);
        const cur = n === b.r;
        return (
          <div key={n} style={{ width: s, height: s, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box',
            border: cur ? `4px solid ${theme.doodle}` : done ? '2px solid #3A3B44' : '2px dashed #4A4B54', background: cur ? '#fff' : done ? '#24252C' : 'transparent',
            transform: cur ? `scale(${1 + 0.15 * p})` : undefined }}>
            {done ? <Img src={staticFile(done.icon)} style={{ width: 46, height: 46, borderRadius: 11 }} />
              : <span style={{ fontFamily: theme.display, fontSize: 32, color: cur ? theme.doodle : '#6A6B74' }}>{n}</span>}
          </div>
        );
      })}
    </div>
  );
};

const Window: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const push = interpolate(f, [0, 8 * fps], [1.04, 1.12], { extrapolateRight: 'clamp' });
  const H = winH(b);
  const fit = b.fit ?? 'cover';
  let body: React.ReactNode = null;
  if (b.posts) {
    // captured posts (X / Threads / news) as cards that slap in; a long one scrolls by `scroll` px
    const items: B[] = b.posts, n = items.length;
    body = (
      <AbsoluteFill style={{ background: 'linear-gradient(180deg,#2A2B33,#1E1F25)' }}>
        {items.map((p, i) => {
          const t = f - sec(p.at ?? i * 0.8, fps);
          if (t < 0) return null;
          const s = spring({ frame: t, fps, config: { damping: 12, mass: 0.7 } });
          const w = p.w ?? (n > 1 ? 800 : 920);
          const x = n > 1 ? (i % 2 ? 1080 - w - 40 : 40) : (1080 - w) / 2;
          const y = n > 1 ? 30 + i * ((H - 60) / n) * 0.75 : 30;
          const sc = p.scroll ? interpolate(t, [fps, fps * (p.scrollFor ?? 6)], [0, -p.scroll], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) }) : 0;
          return (
            <div key={i} style={{ position: 'absolute', left: x, top: y, width: w, maxHeight: H - 60 - (y - 30), borderRadius: 28, overflow: 'hidden', boxShadow: '0 30px 60px rgba(0,0,0,0.55)',
              transform: `translateY(${(1 - s) * 90}px) scale(${0.85 + 0.15 * s}) rotate(${p.rot ?? (i % 2 ? 1.5 : -1.5)}deg)`, opacity: Math.min(1, s * 1.5) }}>
              <Img src={staticFile(p.src)} style={{ width: '100%', display: 'block', transform: `translateY(${sc}px)` }} />
            </div>
          );
        })}
      </AbsoluteFill>
    );
  } else if (b.src) {
    const media = (style: React.CSSProperties) => b.src.endsWith('.mp4')
      ? <OffthreadVideo src={staticFile(b.src)} muted startFrom={sec(b.start, fps)} playbackRate={b.rate ?? 1} style={style} />
      : <Img src={staticFile(b.src)} style={style} />;
    body = fit === 'contain'
      ? (
        <AbsoluteFill style={{ background: 'linear-gradient(180deg,#2A2B33,#1E1F25)', alignItems: 'center', justifyContent: 'center' }}>
          {media({ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: '100%', objectFit: 'contain', transform: `scale(${push * 0.94})`, borderRadius: 18 })}
        </AbsoluteFill>
      )
      : media({ width: '100%', height: '100%', objectFit: 'cover', objectPosition: b.pos ?? (b.src.endsWith('.mp4') ? '50% 50%' : '50% 0%'), transform: `scale(${push})` });
  } else if (b.mystery) {
    const pulse = 1 + 0.05 * Math.sin((f / fps) * Math.PI * 4);
    body = (
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 45%, #3a2a1a 0%, #111 70%)', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: theme.display, fontSize: 330, color: theme.caption, transform: `scale(${pulse})`, textShadow: '0 0 60px rgba(255,228,92,0.5)' }}>?</div>
      </AbsoluteFill>
    );
  } else if (b.icons) {
    const items: { src: string; label?: string; at?: number }[] = b.icons;
    const n = items.length, size = n > 4 ? 168 : n > 3 ? 190 : 230, gap = n > 4 ? 30 : 40, tw = n * size + (n - 1) * gap;
    const labelled = items.some((it) => it.label), top = Math.max(30, (WIN_H - size - (labelled ? 72 : 0)) / 2);
    body = (
      <AbsoluteFill style={{ background: 'linear-gradient(180deg,#2A2B33,#1E1F25)' }}>
        {items.map((it, i) => {
          const t = f - sec(it.at ?? i * 0.3, fps);
          if (t < 0) return null;
          const s = interpolate(t, [0, 4, 7, 10], [2.2, 0.9, 1.05, 1], { extrapolateRight: 'clamp', easing: Easing.out(Easing.quad) });
          return (
            <div key={i} style={{ position: 'absolute', left: (1080 - tw) / 2 + i * (size + gap), top, width: size, textAlign: 'center', transform: `scale(${s})` }}>
              <Img src={staticFile(it.src)} style={{ width: size, height: size, borderRadius: size * 0.23, border: '5px solid #fff', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }} />
              {it.label && <div style={{ marginTop: 18, marginLeft: -gap / 2, marginRight: -gap / 2, fontFamily: theme.display, fontSize: n > 4 ? 34 : 50, color: '#fff', whiteSpace: 'nowrap' }}>{it.label}</div>}
            </div>
          );
        })}
      </AbsoluteFill>
    );
  } else if (b.rows) {
    body = (
      <AbsoluteFill style={{ background: 'linear-gradient(180deg,#2A2B33,#1E1F25)', padding: '56px 60px', gap: 22 }}>
        {b.rows.map((r: B, i: number) => {
          const t = f - sec(r.at ?? i * 0.3, fps);
          const p = t < 0 ? 0 : spring({ frame: t, fps, config: { damping: 13 } });
          const hi = i === 0;
          return (
            <div key={i} style={{ height: 150, borderRadius: 26, background: hi ? '#FFE45C' : '#2E2F37', display: 'flex', alignItems: 'center', gap: 26, padding: '0 30px',
              transform: `translateX(${(1 - p) * 300}px)`, opacity: p }}>
              <div style={{ fontFamily: theme.display, fontSize: 70, color: hi ? '#E8382F' : '#fff', width: 120 }}>{r.r}위</div>
              <Img src={staticFile(r.icon)} style={{ width: 96, height: 96, borderRadius: 22 }} />
              <div style={{ flex: 1, fontFamily: theme.display, fontSize: 54, color: hi ? INK : '#fff', whiteSpace: 'nowrap' }}>{r.name}</div>
              <div style={{ fontFamily: theme.display, fontSize: 56, color: hi ? INK : '#cfcfcf' }}>{r.score}</div>
            </div>
          );
        })}
      </AbsoluteFill>
    );
  } else if (b.options) {
    const items: B[] = b.options, w = 300, gap = 30, tw = items.length * w + (items.length - 1) * gap;
    body = (
      <AbsoluteFill style={{ background: 'linear-gradient(180deg,#2A2B33,#1E1F25)' }}>
        {items.map((o, i) => {
          const t = f - sec(o.at ?? i * 0.4, fps);
          if (t < 0) return null;
          const p = spring({ frame: t, fps, config: { damping: 11, mass: 0.7 } });
          return (
            <div key={i} style={{ position: 'absolute', left: (1080 - tw) / 2 + i * (w + gap), top: 90, width: w, height: 430, borderRadius: 32, background: '#2E2F37',
              border: `4px solid ${o.color ?? '#3A3B44'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18,
              transform: `translateY(${(1 - p) * 120}px) rotate(${(i - 1) * 2}deg)`, opacity: Math.min(1, p * 1.4) }}>
              <Img src={staticFile(o.icon)} style={{ width: 150, height: 150, borderRadius: 36 }} />
              <div style={{ fontFamily: theme.display, fontSize: 46, color: o.color ?? '#fff' }}>{o.tag}</div>
              <div style={{ fontFamily: theme.display, fontSize: 40, color: '#fff', textAlign: 'center', lineHeight: 1.1, whiteSpace: 'pre-line' }}>{o.name}</div>
            </div>
          );
        })}
      </AbsoluteFill>
    );
  }
  // stamp slammed in the middle of the window
  const st = b.stamp ? f - sec(b.stampAt ?? 0.4, fps) : -1;
  const ss = interpolate(st, [0, 6], [2.4, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.quad) });
  return (
    <div style={{ position: 'absolute', left: 0, top: WIN_TOP, width: 1080, height: H, overflow: 'hidden', background: '#000' }}>
      {body}
      {b.name && !b.mystery && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 220, background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.85))' }} />
      )}
      {st >= 0 && (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 36 }}>
          <div style={{ fontFamily: theme.display, fontSize: 96, color: '#FF4040', border: '12px solid #FF4040', borderRadius: 24, padding: '6px 40px', background: 'rgba(255,255,255,0.92)',
            transform: `scale(${ss}) rotate(-8deg)`, opacity: st >= 0 ? 1 : 0 }}>{b.stamp}</div>
        </AbsoluteFill>
      )}
    </div>
  );
};

// model name lower third + rank badge, over the window
const Title: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  if (!b.r) return null;
  const p = spring({ frame: f, fps, config: { damping: 10, mass: 0.7, stiffness: 150 } });
  const q = spring({ frame: f - 5, fps, config: { damping: 14 } });
  const c = interpolate(f, [6, 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  return (
    <>
      <div style={{ position: 'absolute', left: 36, top: WIN_TOP - 34, padding: '4px 30px 0', borderRadius: 22, background: b.r === 1 ? '#FFE45C' : '#E8382F',
        fontFamily: theme.display, fontSize: 100, lineHeight: 1.15, color: b.r === 1 ? INK : '#fff', boxShadow: '0 12px 30px rgba(0,0,0,0.45)',
        transform: `scale(${0.4 + 0.6 * p}) rotate(${(1 - p) * -14 - 3}deg)`, transformOrigin: '0% 50%' }}>{b.r}위</div>
      {b.name && !b.mystery && (
        <div style={{ position: 'absolute', left: 40, right: 40, top: WIN_TOP + WIN_H - 150, display: 'flex', alignItems: 'center', gap: 22,
          transform: `translateX(${(1 - q) * -200}px)`, opacity: q }}>
          {(b.logo ?? []).map((src: string, k: number) => (
            <Img key={k} src={staticFile(src)} style={{ width: 104, height: 104, borderRadius: 24, border: '4px solid #fff', marginLeft: k ? -34 : 0, flexShrink: 0 }} />
          ))}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: theme.display, fontSize: b.name.length > 16 ? 62 : 72, lineHeight: 1.02, color: '#fff', whiteSpace: 'nowrap', textShadow: '0 4px 12px rgba(0,0,0,0.6)' }}>{b.name}</div>
            {b.maker && <div style={{ fontFamily: theme.font, fontWeight: 700, fontSize: 30, color: '#E2DED6', whiteSpace: 'nowrap' }}>{b.maker}</div>}
          </div>
          {b.score !== undefined && (
            <div style={{ flexShrink: 0, borderRadius: 24, background: '#FFE45C', padding: '6px 24px 0', fontFamily: theme.display, fontSize: 70, color: INK, fontVariantNumeric: 'tabular-nums' }}>
              {b.scorePrefix && <span style={{ fontSize: 46 }}>{b.scorePrefix}</span>}
              {(b.score * c).toFixed(b.scoreDecimals ?? 0)}<span style={{ fontSize: 34 }}>{b.scoreUnit ?? '점'}</span>
            </div>
          )}
        </div>
      )}
    </>
  );
};

// stamp for mode beats (window beats draw their own inside the window)
const ModeStamp: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const st = f - sec(b.stampAt ?? 0.4, fps);
  if (st < 0) return null;
  const ss = interpolate(st, [0, 6], [2.4, 1], { extrapolateRight: 'clamp', easing: Easing.in(Easing.quad) });
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: AREA_TOP + AREA_H - 280, display: 'flex', justifyContent: 'center' }}>
      <div style={{ fontFamily: theme.display, fontSize: 80, color: '#FF4040', border: '12px solid #FF4040', borderRadius: 24, padding: '6px 40px', background: 'rgba(255,255,255,0.92)',
        transform: `scale(${ss}) rotate(-8deg)` }}>{b.stamp}</div>
    </div>
  );
};

export const WinBeat: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const facts: Fact[] = b.facts ?? [];
  const n = facts.length, gap = 26, w = n === 1 ? 930 : (930 - gap) / 2;
  return (
    <AbsoluteFill style={{ background: theme.ink }}>
      {b.mode ? <ModeView b={b} f={f} /> : <Window b={b} f={f} />}
      {b.mode && b.stamp && <ModeStamp b={b} f={f} />}
      <Headline b={b} f={f} />
      <Title b={b} f={f} />
      <Ladder b={b} f={f} />
      {facts.map((fc, i) => <FactCard key={i} fc={fc} f={f} x={n === 1 ? (1080 - w) / 2 : 75 + i * (w + gap)} w={w} />)}
    </AbsoluteFill>
  );
};

export const winHits = (b: B): { at: number; name: string; vol: number }[] => {
  const hits: { at: number; name: string; vol: number }[] = [...modeHits(b)];
  if (b.r && !b.mystery) hits.push({ at: 0.03, name: 'stamp', vol: 0.32 });
  (b.facts ?? []).forEach((fc: Fact) => hits.push({ at: fc.at ?? 0, name: 'pop', vol: 0.3 }));
  (b.icons ?? []).forEach((it: { at?: number }, i: number) => hits.push({ at: it.at ?? i * 0.3, name: 'pop', vol: 0.4 }));
  (b.options ?? []).forEach((o: { at?: number }, i: number) => hits.push({ at: o.at ?? i * 0.4, name: 'pop', vol: 0.35 }));
  (b.posts ?? []).forEach((o: { at?: number }, i: number) => hits.push({ at: o.at ?? i * 0.8, name: 'pop', vol: 0.4 }));
  if (b.stamp) hits.push({ at: (b.stampAt ?? 0.4) + 0.2, name: 'stamp', vol: 0.45 });
  return hits;
};
