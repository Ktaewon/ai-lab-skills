import React from 'react';
import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, spring, staticFile, useVideoConfig } from 'remotion';
import { theme } from '../theme';
import { AREA_TOP, AREA_H } from './WinModes';

// "desk" beats (episode.json beats kind "desk"): a ranking laid out as evidence files on a desktop,
// made for a "TOP N" short that must not look like the "win" countdown (EP.07 AI가 짠 무료 프로그램).
// Each rank: a round rank sticker, an app window (title bar = repo, GitHub star pill counting up,
// the official screen inside), the name strip, a paper proof card (original quote + Korean +
// source) with a slammed stamp, and a dock along the bottom that collects each revealed app.
// Variants on the same desk: checks (criteria checklist), bars (final comparison), options (vote),
// mystery (blurred window before the winner; with "tease": true it still counts the stars, for a hook).
type B = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const sec = (s: number | undefined, fps: number) => Math.round((s ?? 0) * fps);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const INK = '#16171B', GOOD = '#3DDC84', GOLD = '#FFD84A', RED = '#FF4D4D';
export const fmtStars = (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(v >= 100000 ? 1 : 1)}만` : Math.round(v).toLocaleString('en-US'));

const WIN = { left: 50, top: AREA_TOP + 30, w: 980, h: 470, bar: 56 };
const NAME_TOP = WIN.top + WIN.h + 14, PROOF_TOP = NAME_TOP + 80, DOCK_TOP = AREA_TOP + AREA_H - 76;

const Wallpaper: React.FC<{ f: number }> = ({ f }) => (
  <div style={{ position: 'absolute', left: 0, top: AREA_TOP, width: 1080, height: AREA_H, overflow: 'hidden',
    background: 'radial-gradient(120% 90% at 20% 0%, #2B2550 0%, #1A1B2A 55%, #15161D 100%)' }}>
    <div style={{ position: 'absolute', inset: 0, opacity: 0.18, backgroundImage: 'radial-gradient(#8E8AB8 1.5px, transparent 1.5px)', backgroundSize: '36px 36px',
      transform: `translateY(${(f * 0.4) % 36}px)` }} />
  </div>
);

const Ghost: React.FC<{ r: number | string; f: number }> = ({ r, f }) => {
  const p = interpolate(f, [0, 18], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <div style={{ position: 'absolute', right: 10, top: AREA_TOP - 70, fontFamily: theme.display, fontSize: 620, lineHeight: 1, color: 'transparent',
      WebkitTextStroke: '5px rgba(255,255,255,0.10)', transform: `translateX(${(1 - p) * 120}px)`, opacity: p }}>{r}</div>
  );
};

const Window: React.FC<{ b: B; f: number; children: React.ReactNode; title?: string; stars?: number | null }> = ({ b, f, children, title, stars }) => {
  const { fps } = useVideoConfig();
  const p = spring({ frame: f, fps, config: { damping: 14, mass: 0.8, stiffness: 140 } });
  const c = interpolate(f - sec(b.starAt ?? 0.3, fps), [0, 24], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const pop = spring({ frame: f - sec(b.starAt ?? 0.3, fps) - 24, fps, config: { damping: 8, mass: 0.5 } });
  return (
    <div style={{ position: 'absolute', left: WIN.left, top: WIN.top, width: WIN.w, height: WIN.h, borderRadius: 22, overflow: 'hidden', background: '#0E0F13',
      boxShadow: '0 40px 80px rgba(0,0,0,0.55), 0 0 0 2px rgba(255,255,255,0.08)', transform: `translateY(${(1 - p) * 140}px) scale(${0.9 + 0.1 * p})`, opacity: Math.min(1, p * 1.6) }}>
      <div style={{ height: WIN.bar, background: '#2A2C35', display: 'flex', alignItems: 'center', padding: '0 22px', gap: 12 }}>
        {['#FF5F57', '#FEBC2E', '#28C840'].map((c2) => <div key={c2} style={{ width: 20, height: 20, borderRadius: 10, background: c2 }} />)}
        <div style={{ flex: 1, textAlign: 'center', fontFamily: 'D2Coding, monospace', fontSize: 28, color: '#C9C7D6', whiteSpace: 'nowrap', overflow: 'hidden' }}>{title}</div>
        {stars !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 16px', borderRadius: 14, background: stars === null ? '#3A3C47' : GOLD,
            fontFamily: theme.display, fontSize: 34, color: INK, transform: `scale(${1 + 0.12 * Math.max(0, 1 - Math.abs(pop - 1) * 3) * (c >= 1 ? 1 : 0)})` }}>
            ★ {stars === null ? '???' : fmtStars(stars * c)}
          </div>
        )}
      </div>
      <div style={{ position: 'absolute', left: 0, top: WIN.bar, right: 0, bottom: 0, overflow: 'hidden' }}>{children}</div>
    </div>
  );
};

const Media: React.FC<{ b: B; f: number; len: number }> = ({ b, f, len }) => {
  const z = interpolate(f, [0, Math.max(1, len)], [1, b.zoom ?? 1.08], clamp);
  const st: React.CSSProperties = { width: '100%', height: '100%', objectFit: b.fit ?? 'cover', objectPosition: b.pos ?? '50% 0%', transform: `scale(${z})`, transformOrigin: b.origin ?? '50% 30%' };
  if (!b.src) return null;
  return /\.(mp4|webm|mov)$/i.test(b.src)
    ? <OffthreadVideo src={staticFile(b.src)} muted startFrom={Math.round((b.start ?? 0) * 30)} style={st} />
    : <Img src={staticFile(b.src)} style={st} />;
};

const Sticker: React.FC<{ r: number; f: number }> = ({ r, f }) => {
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - 3, fps, config: { damping: 9, mass: 0.6, stiffness: 160 } });
  const gold = r === 1;
  return (
    <div style={{ position: 'absolute', left: 18, top: WIN.top - 46, width: 170, height: 170, borderRadius: 85, background: gold ? GOLD : RED,
      border: '7px solid #fff', boxShadow: '0 16px 30px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'baseline', justifyContent: 'center', paddingTop: 22, boxSizing: 'border-box',
      fontFamily: theme.display, color: gold ? INK : '#fff', transform: `scale(${p}) rotate(${(1 - p) * -90 - 8}deg)`, zIndex: 5 }}>
      <span style={{ fontSize: 104, lineHeight: 1 }}>{r}</span><span style={{ fontSize: 46 }}>위</span>
    </div>
  );
};

const NameStrip: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const p = spring({ frame: f - 8, fps, config: { damping: 14 } });
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top: NAME_TOP, height: 70, display: 'flex', alignItems: 'center', gap: 18, transform: `translateX(${(1 - p) * -160}px)`, opacity: p }}>
      {b.icon && <Img src={staticFile(b.icon)} style={{ width: 64, height: 64, borderRadius: 16, border: '3px solid #fff', flexShrink: 0, objectFit: 'cover' }} />}
      <div style={{ fontFamily: theme.display, fontSize: 60, color: '#fff', whiteSpace: 'nowrap' }}>{b.name}</div>
      {b.what && <div style={{ fontFamily: theme.font, fontWeight: 700, fontSize: 32, color: '#B8B5CC', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.what}</div>}
    </div>
  );
};

const Proof: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const pr = b.proof;
  if (!pr) return null;
  const t = f - sec(b.proofAt ?? 0.8, fps);
  if (t < 0) return null;
  const p = spring({ frame: t, fps, config: { damping: 13, mass: 0.7 } });
  const st = t - sec(b.stampDelay ?? 0.9, fps);
  const ss = interpolate(st, [0, 6], [2.6, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  return (
    <div style={{ position: 'absolute', left: 60, right: 60, top: PROOF_TOP, height: 150, transform: `translateY(${(1 - p) * 80}px) rotate(-1.2deg)`, opacity: Math.min(1, p * 1.5) }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 14, background: '#F6F1E4', boxShadow: '0 18px 36px rgba(0,0,0,0.45)', padding: '16px 200px 14px 30px', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
        {pr.en && <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 24, color: '#6B655A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>“{pr.en}”</div>}
        <div style={{ fontFamily: theme.display, fontSize: pr.ko.length > 17 ? 38 : 44, color: INK, lineHeight: 1.12, whiteSpace: 'nowrap' }}>{pr.ko}</div>
        <div style={{ fontFamily: theme.font, fontWeight: 700, fontSize: 22, color: '#857E70', whiteSpace: 'nowrap' }}>— {pr.who}</div>
      </div>
      {st >= 0 && (
        <div style={{ position: 'absolute', right: 24, top: 8, width: 150, height: 150, borderRadius: 75, border: `8px solid ${GOOD}`, color: GOOD, background: 'rgba(246,241,228,0.6)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: theme.display, lineHeight: 1.0, transform: `scale(${ss}) rotate(-14deg)` }}>
          <span style={{ fontSize: 30 }}>{b.stampTop ?? 'AI가'}</span><span style={{ fontSize: 44 }}>{b.stampText ?? '짰음'}</span>
        </div>
      )}
    </div>
  );
};

const Dock: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const total: number = b.total ?? 5;
  if (!b.dock) return null;
  const past: { r: number; icon: string }[] = b.past ?? [];
  const size = 62, gap = 18, w = total * size + (total - 1) * gap + 48;
  return (
    <div style={{ position: 'absolute', left: (1080 - w) / 2, top: DOCK_TOP, width: w, height: size + 22, borderRadius: 26, background: 'rgba(255,255,255,0.10)',
      border: '2px solid rgba(255,255,255,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap }}>
      {Array.from({ length: total }, (_, k) => total - k).map((n) => {
        const done = past.find((x) => x.r === n);
        const cur = n === b.r && !b.mystery && b.icon;
        const src = done?.icon ?? (cur ? b.icon : null);
        const bounce = cur ? Math.abs(Math.sin(Math.min(f, 40) / 40 * Math.PI * 3)) * interpolate(f, [0, 40], [34, 0], clamp) : 0;
        const s = cur ? spring({ frame: f - 14, fps, config: { damping: 10 } }) : 1;
        return src ? (
          <div key={n} style={{ position: 'relative', width: size, height: size, transform: `translateY(${-bounce}px) scale(${s})` }}>
            <Img src={staticFile(src)} style={{ width: size, height: size, borderRadius: 16, objectFit: 'cover' }} />
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: -16, textAlign: 'center', fontFamily: theme.display, fontSize: 18, color: n === b.r ? GOLD : '#9C99B2' }}>{n}위</div>
          </div>
        ) : (
          <div key={n} style={{ width: size, height: size, borderRadius: 16, border: `3px dashed ${n === b.r ? GOLD : 'rgba(255,255,255,0.25)'}`, boxSizing: 'border-box',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.display, fontSize: 28, color: n === b.r ? GOLD : 'rgba(255,255,255,0.3)' }}>{n}</div>
        );
      })}
    </div>
  );
};

const Checks: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: '#15161C', padding: '40px 50px', boxSizing: 'border-box', gap: 26 }}>
      {(b.checks as B[]).map((c, i) => {
        const t = f - sec(c.at ?? i * 0.8, fps);
        const p = t < 0 ? 0 : spring({ frame: t, fps, config: { damping: 14 } });
        const tick = interpolate(t, [6, 14], [0, 1], clamp);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 26, opacity: 0.25 + 0.75 * p, transform: `translateX(${(1 - p) * 40}px)` }}>
            <div style={{ width: 70, height: 70, borderRadius: 16, border: `5px solid ${tick > 0 ? GOOD : '#55576A'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="50" height="50" viewBox="0 0 50 50"><path d="M8 26 L20 38 L42 12" fill="none" stroke={GOOD} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="60" strokeDashoffset={60 * (1 - tick)} /></svg>
            </div>
            <div>
              <div style={{ fontFamily: theme.display, fontSize: 52, color: '#fff', whiteSpace: 'nowrap' }}>{c.text}</div>
              {c.sub && <div style={{ fontFamily: theme.font, fontWeight: 700, fontSize: 28, color: '#9C99B2', whiteSpace: 'nowrap' }}>{c.sub}</div>}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const Bars: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const rows: B[] = b.bars, max = Math.max(...rows.map((r) => r.value));
  return (
    <AbsoluteFill style={{ background: '#15161C', padding: '30px 40px', boxSizing: 'border-box', gap: 14, justifyContent: 'center' }}>
      {rows.map((r, i) => {
        const t = f - sec(r.at ?? 0.2 + i * 0.15, fps);
        const g = interpolate(t, [0, 22], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
        const w = Math.max(8, (r.value / max) * 600 * g);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, height: 62 }}>
            <Img src={staticFile(r.icon)} style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
            <div style={{ width: 190, fontFamily: theme.display, fontSize: 30, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden' }}>{r.label}</div>
            <div style={{ width: w, height: 40, borderRadius: 10, background: i === 0 ? GOLD : '#6D6A8A' }} />
            <div style={{ fontFamily: theme.display, fontSize: 30, color: i === 0 ? GOLD : '#C9C7D6', whiteSpace: 'nowrap' }}>{fmtStars(r.value * g)}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const Options: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: '#15161C', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 40 }}>
      {(b.options as B[]).map((o, i) => {
        const t = f - sec(o.at ?? i * 0.4, fps);
        const p = t < 0 ? 0 : spring({ frame: t, fps, config: { damping: 10, mass: 0.6 } });
        return (
          <div key={i} style={{ width: 380, height: 280, borderRadius: 34, background: o.color, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 14px 0 ${o.shade ?? 'rgba(0,0,0,0.35)'}`, transform: `scale(${p}) rotate(${(i ? 3 : -3) * (1 - p)}deg)`, opacity: p }}>
            <div style={{ fontSize: 90, lineHeight: 1.1 }}>{o.emoji}</div>
            <div style={{ fontFamily: theme.display, fontSize: 54, color: INK, whiteSpace: 'nowrap' }}>{o.tag}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const Mystery: React.FC<{ f: number }> = ({ f }) => (
  <AbsoluteFill style={{ background: 'repeating-linear-gradient(45deg,#1C1D24 0 22px,#22232C 22px 44px)', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ fontFamily: theme.display, fontSize: 260, color: GOLD, transform: `rotate(${Math.sin(f / 5) * 6}deg) scale(${1 + 0.05 * Math.sin(f / 3)})` }}>?</div>
  </AbsoluteFill>
);

export const DeskBeat: React.FC<{ b: B; f: number; len: number }> = ({ b, f, len }) => {
  const { fps } = useVideoConfig();
  const body = b.checks ? <Checks b={b} f={f} /> : b.bars ? <Bars b={b} f={f} /> : b.options ? <Options b={b} f={f} /> : b.mystery ? <Mystery f={f} /> : <Media b={b} f={f} len={len} />;
  const st = b.stamp ? f - sec(b.stampAt ?? 0.6, fps) : -1;
  const ss = interpolate(st, [0, 6], [2.6, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  return (
    <AbsoluteFill>
      <Wallpaper f={f} />
      {b.r && <Ghost r={b.r} f={f} />}
      <Window b={b} f={f} title={b.mystery ? '?????/?????' : b.repo} stars={b.mystery && !b.tease ? null : b.stars}>{body}</Window>
      {b.r && <Sticker r={b.r} f={f} />}
      {b.name && !b.mystery && <NameStrip b={b} f={f} />}
      <Proof b={b} f={f} />
      {st >= 0 && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: NAME_TOP + 10, display: 'flex', justifyContent: 'center' }}>
          <div style={{ fontFamily: theme.display, fontSize: 88, color: RED, border: `12px solid ${RED}`, borderRadius: 24, padding: '4px 36px', background: 'rgba(255,255,255,0.94)',
            transform: `scale(${ss}) rotate(-7deg)` }}>{b.stamp}</div>
        </div>
      )}
      <Dock b={b} f={f} />
    </AbsoluteFill>
  );
};

export const deskHits = (b: B): { at: number; name: string; vol: number }[] => {
  const h: { at: number; name: string; vol: number }[] = [];
  if (b.r && !b.mystery) { h.push({ at: 0.1, name: 'stamp', vol: 0.32 }); h.push({ at: 0.45, name: 'boing', vol: 0.18 }); }
  if (b.stars) h.push({ at: (b.starAt ?? 0.3) + 0.8, name: 'ding', vol: 0.28 });
  if (b.proof) { h.push({ at: b.proofAt ?? 0.8, name: 'send', vol: 0.3 }); h.push({ at: (b.proofAt ?? 0.8) + (b.stampDelay ?? 0.9) + 0.18, name: 'stamp', vol: 0.45 }); }
  (b.checks ?? []).forEach((c: B, i: number) => h.push({ at: (c.at ?? i * 0.8) + 0.3, name: 'ding', vol: 0.3 }));
  (b.bars ?? []).forEach((r: B, i: number) => h.push({ at: r.at ?? 0.2 + i * 0.15, name: 'pop', vol: 0.25 }));
  (b.options ?? []).forEach((o: B, i: number) => h.push({ at: o.at ?? i * 0.4, name: 'pop', vol: 0.4 }));
  if (b.stamp) h.push({ at: (b.stampAt ?? 0.6) + 0.2, name: 'stamp', vol: 0.45 });
  if (b.mystery) h.push({ at: 0.1, name: 'murmur', vol: 0.3 });
  return h;
};
