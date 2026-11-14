import React from 'react';
import { AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, spring, staticFile, useVideoConfig } from 'remotion';
import { theme } from '../theme';

// "tower" beats: a TOP-N short as a star elevator (EP.07 AI가 짠 무료 프로그램). The world is one tall
// column where every entry is a full-bleed coloured floor at the height of its GitHub stars (log
// scale). The camera rides between floors on each rank, an altitude counter in the corner counts
// the stars as it climbs, and the floor builds itself in poster style: a huge rank numeral, the
// real screen on a tilted card, the name in giant type and a highlighted proof quote.
// Modes: floor (default; with tease: the winner blurred, for the hook), drop (plunge to the
// ground while criteria chips slam in), fog (the unrevealed winner floor), gap (linear bars:
// first vs last), ask (closing question over full-bleed footage + a red marker arrow).
type B = any; // eslint-disable-line @typescript-eslint/no-explicit-any
const sec = (s: number | undefined, fps: number) => Math.round((s ?? 0) * fps);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const SCALE = 1900, FOCAL = 905, TOP = 466, YEL = '#FFE45C';
const Y = (v: number) => -Math.log10(Math.max(1, v)) * SCALE;
export const fmt = (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(1)}만` : Math.round(v).toLocaleString('en-US'));

const camAt = (b: B, f: number, fps: number) => {
  const from = Math.log10(b.camFrom ?? b.camTo ?? 1000), to = Math.log10(b.camTo ?? 1000);
  const p = b.mode === 'drop'
    ? interpolate(f, [sec(b.dropAt ?? 0.15, fps), sec((b.dropAt ?? 0.15) + (b.dropFor ?? 1.1), fps)], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) })
    : spring({ frame: f, fps, config: { damping: 22, stiffness: 70, mass: 1 } });
  return from + (to - from) * p;
};

const Media: React.FC<{ fl: B; blur?: number }> = ({ fl, blur = 0 }) => {
  const st: React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', objectPosition: fl.pos ?? '50% 0%', filter: blur ? `blur(${blur}px)` : undefined };
  return /\.(mp4|webm|mov)$/i.test(fl.src)
    ? <OffthreadVideo src={staticFile(fl.src)} muted startFrom={Math.round((fl.start ?? 0) * 30)} style={st} />
    : <Img src={staticFile(fl.src)} style={st} />;
};

// one floor; t = frames since this floor became active (large for floors revealed earlier)
const Floor: React.FC<{ fl: B; t: number; state: 'shown' | 'active' | 'fog' | 'tease'; b: B }> = ({ fl, t, state, b }) => {
  const { fps } = useVideoConfig();
  const cy = Y(fl.stars), ink = fl.ink ?? '#fff';
  const band = (
    <div style={{ position: 'absolute', left: 0, width: 1080, top: cy - 560, height: 1120, background: state === 'fog' ? '#0B0B0E' : fl.color,
      backgroundImage: state === 'fog' ? undefined : 'radial-gradient(rgba(255,255,255,0.10) 2px, transparent 2px)', backgroundSize: '40px 40px' }} />
  );
  if (state === 'fog') {
    return (
      <>
        {band}
        <div style={{ position: 'absolute', left: 0, width: 1080, top: cy - 300, textAlign: 'center', fontFamily: theme.display, fontSize: 420, color: YEL,
          transform: `rotate(${Math.sin(t / 5) * 7}deg) scale(${1 + 0.06 * Math.sin(t / 3)})` }}>?</div>
      </>
    );
  }
  const k = (d: number, cfg = { damping: 12, mass: 0.7 }) => (state === 'shown' ? 1 : spring({ frame: t - d, fps, config: cfg }));
  const num = k(2, { damping: 9, mass: 0.6 }), card = k(6), name = k(12), what = k(16);
  const q = b.proofAt !== undefined && state !== 'shown' ? t - sec(b.proofAt, fps) : 999;
  const sweep = state === 'shown' ? 1 : interpolate(q, [0, 14], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const tease = state === 'tease';
  const nm = tease ? '?????' : fl.name;
  return (
    <>
      {band}
      <div style={{ position: 'absolute', left: 18, top: cy - 520, fontFamily: theme.display, fontSize: 560, lineHeight: 1, color: ink, opacity: 0.95,
        transform: `translateY(${(1 - num) * 160}px) scale(${0.6 + 0.4 * num})`, transformOrigin: '20% 80%' }}>{tease ? '?' : fl.r}</div>
      <div style={{ position: 'absolute', left: 372, top: cy - 365, width: 660, height: 420, perspective: 1400 }}>
        <div style={{ width: '100%', height: '100%', borderRadius: 20, overflow: 'hidden', border: '9px solid #fff', boxShadow: '0 40px 70px rgba(0,0,0,0.45)', background: '#111',
          transform: `rotateY(${-16 + (1 - card) * -40}deg) rotateX(5deg) rotate(2deg) translateX(${(1 - card) * 500}px)`, opacity: Math.min(1, card * 1.6) }}>
          <Media fl={fl} blur={tease ? 16 : 0} />
        </div>
      </div>
      <div style={{ position: 'absolute', left: 46, top: cy + 82, display: 'flex', alignItems: 'center', gap: 22, transform: `translateX(${(1 - name) * -300}px)`, opacity: name }}>
        {fl.icon && !tease && <Img src={staticFile(fl.icon)} style={{ width: 96, height: 96, borderRadius: 24, border: '5px solid #fff', objectFit: 'cover' }} />}
        <div style={{ fontFamily: theme.display, fontSize: nm.length > 12 ? 74 : nm.length > 8 ? 92 : 112, lineHeight: 1.05, color: ink, whiteSpace: 'nowrap',
          WebkitTextStroke: ink === '#fff' ? '4px rgba(0,0,0,0.25)' : undefined, paintOrder: 'stroke fill' }}>{nm}</div>
      </div>
      {!tease && fl.what && (
        <div style={{ position: 'absolute', left: 50, top: cy + 205, fontFamily: theme.font, fontWeight: 800, fontSize: 38, color: ink, opacity: 0.9 * what, whiteSpace: 'nowrap' }}>{fl.what}</div>
      )}
      {fl.quote && q >= 0 && (
        <div style={{ position: 'absolute', left: 44, top: cy + 262 + (tease ? -40 : 0), transform: 'rotate(-1.5deg)' }}>
          <span style={{ position: 'relative', display: 'inline-block', padding: '4px 18px', fontFamily: theme.display, fontSize: 52, color: '#111', whiteSpace: 'nowrap' }}>
            <span style={{ position: 'absolute', left: 0, top: 6, bottom: 0, width: `${sweep * 100}%`, background: YEL, borderRadius: 6, zIndex: 0 }} />
            <span style={{ position: 'relative', color: sweep > 0.05 ? '#111' : 'transparent' }}>“{fl.quote}”</span>
          </span>
          <div style={{ marginTop: 6, marginLeft: 18, fontFamily: theme.font, fontWeight: 700, fontSize: 24, color: ink, opacity: 0.85 * sweep, whiteSpace: 'nowrap' }}>— {fl.who}</div>
        </div>
      )}
    </>
  );
};

const Ground: React.FC = () => (
  <div style={{ position: 'absolute', left: 0, width: 1080, top: Y(100) - 560, height: 1800, background: '#1B1C21' }}>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 900, textAlign: 'center', fontFamily: theme.display, fontSize: 64, color: '#8E8B9E' }}>▲ GitHub 별 0개에서 출발</div>
  </div>
);

const Sky: React.FC<{ top: number }> = ({ top }) => (
  <div style={{ position: 'absolute', left: 0, width: 1080, top: top - 3000, height: 3000, background: 'linear-gradient(180deg,#05050A,#0B0B12)',
    backgroundImage: 'radial-gradient(rgba(255,255,255,0.5) 1.5px, transparent 1.5px)', backgroundSize: '90px 70px' }} />
);

// altitude counter: stars at the camera's height
const Hud: React.FC<{ v: number; scramble: boolean; unknown?: boolean; f: number; pop: number }> = ({ v, scramble, unknown, f, pop }) => (
  <div style={{ position: 'absolute', right: 26, top: 486, padding: '8px 22px 4px', borderRadius: 18, background: 'rgba(10,10,14,0.82)', border: `3px solid ${YEL}`,
    fontFamily: theme.display, fontSize: 46, color: YEL, transform: `scale(${1 + 0.18 * pop})`, transformOrigin: '100% 0%', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
    ★ {unknown ? '???' : scramble ? `${(Math.floor((Math.sin(f * 7.3) + 1) * 45) + 10)}.${f % 10}만` : fmt(v)}
  </div>
);

const Drop: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {(b.checks ?? []).map((c: B, i: number) => {
        const t = f - sec(c.at ?? 0.3 + i * 0.3, fps);
        if (t < 0) return null;
        const s = interpolate(t, [0, 5], [2.2, 1], { ...clamp, easing: Easing.in(Easing.quad) });
        return (
          <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: 540 + i * 150, display: 'flex', justifyContent: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '14px 34px', borderRadius: 20, background: '#fff', boxShadow: '0 16px 30px rgba(0,0,0,0.5)',
              fontFamily: theme.display, fontSize: 58, color: '#111', transform: `scale(${s}) rotate(${i % 2 ? 3 : -3}deg)`, whiteSpace: 'nowrap' }}>
              <span style={{ color: '#1DB954' }}>✔</span>{c.text}
            </div>
          </div>
        );
      })}
    </>
  );
};

const Gap: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const [top, low] = b.bars as B[];
  const H = 610, base = 1255;
  const g = interpolate(f, [4, 30], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const hTop = H * g, hLow = Math.max(4, H * (low.value / top.value) * g);
  const st = f - sec(b.stampAt ?? 1, fps), ss = interpolate(st, [0, 6], [2.6, 1], { ...clamp, easing: Easing.in(Easing.quad) });
  const mk = interpolate(f - sec(b.markAt ?? 1.4, fps), [0, 14], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const ell = 'M 250 1262 C 250 1206 560 1196 584 1248 C 606 1300 300 1318 262 1282 C 246 1266 262 1240 300 1230';
  return (
    <AbsoluteFill style={{ top: TOP, height: 1920 - TOP, background: '#0D0D11' }}>
      <div style={{ position: 'absolute', inset: 0, top: -TOP }}>
        <div style={{ position: 'absolute', left: 600, top: base - hTop, width: 260, height: hTop, borderRadius: '16px 16px 0 0', background: top.color ?? YEL }} />
        <div style={{ position: 'absolute', left: 600, width: 260, top: base - hTop - 120, display: 'flex', alignItems: 'center', gap: 12, opacity: g }}>
          <Img src={staticFile(top.icon)} style={{ width: 64, height: 64, borderRadius: 16 }} />
          <div style={{ fontFamily: theme.display, fontSize: 40, color: '#fff', lineHeight: 1 }}>{top.label}<br /><span style={{ color: YEL }}>★ {fmt(top.value * g)}</span></div>
        </div>
        <div style={{ position: 'absolute', left: 280, top: base - hLow, width: 260, height: hLow, background: low.color ?? '#FF4D4D' }} />
        <div style={{ position: 'absolute', left: 280, width: 300, top: base - 150, display: 'flex', alignItems: 'center', gap: 12, opacity: g }}>
          <Img src={staticFile(low.icon)} style={{ width: 64, height: 64, borderRadius: 16 }} />
          <div style={{ fontFamily: theme.display, fontSize: 40, color: '#fff', lineHeight: 1 }}>{low.label}<br /><span style={{ color: '#FF8A80' }}>★ {fmt(low.value)}</span></div>
        </div>
        <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0 }}>
          <path d={ell} fill="none" stroke="#FF3B30" strokeWidth={12} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - mk} />
        </svg>
        <div style={{ position: 'absolute', left: 70, top: 1150, fontFamily: theme.hand, fontSize: 70, color: '#FF3B30', opacity: mk, transform: 'rotate(-8deg)' }}>여기!</div>
        {st >= 0 && (
          <div style={{ position: 'absolute', left: 40, top: 560, fontFamily: theme.display, fontSize: 170, lineHeight: 1, color: YEL, transform: `scale(${ss}) rotate(-6deg)`,
            transformOrigin: '30% 50%', WebkitTextStroke: '10px #000', paintOrder: 'stroke fill' }}>{b.stamp}</div>
        )}
      </div>
    </AbsoluteFill>
  );
};

const Ask: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  const ar = interpolate(f - sec(b.arrowAt ?? 1.2, fps), [0, 16], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  return (
    <AbsoluteFill style={{ top: TOP, height: 1920 - TOP, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, transform: `scale(${1.08 + f * 0.0008})` }}><Media fl={b} /></div>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0.7))' }} />
      <div style={{ position: 'absolute', inset: 0, top: -TOP }}>
        {(b.lines as B[]).map((l, i) => {
          const t = f - sec(l.at ?? i * 0.5, fps);
          if (t < 0) return null;
          const s = spring({ frame: t, fps, config: { damping: 9, mass: 0.6, stiffness: 170 } });
          return (
            <div key={i} style={{ position: 'absolute', left: 50, right: 50, top: l.y ?? 560 + i * 170, fontFamily: theme.display, fontSize: l.size ?? 120, lineHeight: 1.05,
              color: l.color ?? '#fff', WebkitTextStroke: '10px #000', paintOrder: 'stroke fill', transform: `scale(${0.5 + 0.5 * s}) rotate(${l.rot ?? 0}deg)`, opacity: Math.min(1, s * 1.5),
              transformOrigin: '0% 50%', whiteSpace: 'nowrap' }}>{l.text}</div>
          );
        })}
        <svg width={1080} height={1920} style={{ position: 'absolute', left: 0, top: 0 }}>
          <path d="M 560 1080 C 760 1070 930 1150 1000 1330" fill="none" stroke="#FF3B30" strokeWidth={16} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ar} />
          <path d="M 950 1300 L 1002 1340 L 1030 1272" fill="none" stroke="#FF3B30" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" opacity={ar > 0.95 ? 1 : 0} />
        </svg>
        <div style={{ position: 'absolute', left: 520, top: 1110, fontFamily: theme.hand, fontSize: 84, color: '#E8261C', opacity: ar, transform: `rotate(-6deg) scale(${0.7 + 0.3 * ar})`, whiteSpace: 'nowrap',
          background: '#fff', padding: '0 22px', borderRadius: 10, boxShadow: '0 10px 24px rgba(0,0,0,0.5)' }}>{b.arrowText ?? '댓글로!'}</div>
      </div>
    </AbsoluteFill>
  );
};

export const TowerBeat: React.FC<{ b: B; f: number }> = ({ b, f }) => {
  const { fps } = useVideoConfig();
  if (b.mode === 'gap') return <Gap b={b} f={f} />;
  if (b.mode === 'ask') return <Ask b={b} f={f} />;
  const floors: B[] = b.floors ?? [];
  const cam = camAt(b, f, fps), prev = camAt(b, Math.max(0, f - 1), fps);
  const blur = Math.min(14, Math.abs(cam - prev) * SCALE / 22);
  const worldY = FOCAL + cam * SCALE;
  const arrive = b.mode === 'drop' ? 0 : sec(b.arriveAt ?? 0.35, fps);
  const top = Math.min(...floors.map((x) => Y(x.stars))) - 560;
  const hudV = Math.pow(10, cam);
  const settle = f - sec(b.starAt ?? 0.6, fps);
  const pop = b.starAt !== undefined ? interpolate(settle, [0, 3, 10], [0, 1, 0], clamp) : 0;
  const hudShown = b.tease ? interpolate(f - sec(b.starAt ?? 0.6, fps), [0, 18], [0, b.camTo], { ...clamp, easing: Easing.out(Easing.cubic) }) : hudV;
  return (
    <AbsoluteFill style={{ top: TOP, height: 1920 - TOP, overflow: 'hidden', background: '#1B1C21' }}>
      <div style={{ position: 'absolute', left: 0, top: -TOP, width: 1080, height: 0, transform: `translateY(${worldY}px)`, filter: blur > 0.5 ? `blur(${blur}px)` : undefined }}>
        <Ground />
        <Sky top={top} />
        {[...floors].sort((a, c) => c.r - a.r).map((fl) => {
          const state = b.mode === 'fog' && fl.r === b.r ? 'fog'
            : b.tease && fl.r === b.r ? 'tease'
              : b.mode === 'drop' ? (fl.r === 1 ? 'tease' : 'fog')
                : fl.r === b.r ? 'active' : fl.r > (b.r ?? 99) ? 'shown' : 'fog';
          return <Floor key={fl.r} fl={fl} t={f - arrive} state={state} b={b} />;
        })}
      </div>
      <div style={{ position: 'absolute', inset: 0, top: -TOP }}>
        {b.mode === 'drop' && <Drop b={b} f={f} />}
        <div style={{ position: 'absolute', left: 0, right: 0, top: 1300, height: 620, background: 'linear-gradient(180deg, rgba(12,12,16,0) 0%, rgba(12,12,16,0.88) 22%, #0C0C10 60%)' }} />
        <Hud v={hudShown} scramble={b.mode === 'fog'} unknown={!!b.tease && settle < 0} f={f} pop={pop} />
      </div>
    </AbsoluteFill>
  );
};

// SFX: a cinematic set generated with ElevenLabs for EP.07 (public/sfx/t_*.mp3) - the old cartoon
// whoosh/boing/stamp sounded cheap under this look ("효과음이 좀 저렴한 티", user, 2026-11-15).
export const towerHits = (b: B): { at: number; name: string; vol: number }[] => {
  const h: { at: number; name: string; vol: number }[] = [];
  if (b.mode === 'drop') {
    h.push({ at: b.dropAt ?? 0.15, name: 't_drop', vol: 0.5 });
    (b.checks ?? []).forEach((c: B, i: number) => h.push({ at: c.at ?? 0.3 + i * 0.3, name: 't_slam', vol: 0.4 }));
  } else if (b.mode === 'gap') {
    h.push({ at: 0.1, name: 't_rise', vol: 0.3 });
    h.push({ at: b.markAt ?? 1.4, name: 't_scribble', vol: 0.75 });
    h.push({ at: b.stampAt ?? 1, name: 't_boom', vol: 0.5 });
  } else if (b.mode === 'ask') {
    (b.lines ?? []).forEach((l: B, i: number) => h.push({ at: l.at ?? i * 0.5, name: 't_pop', vol: 0.35 }));
    h.push({ at: b.arrowAt ?? 1.2, name: 't_scribble', vol: 0.8 });
  } else {
    if (b.camFrom !== undefined && b.camFrom !== b.camTo) h.push({ at: 0, name: 't_rise', vol: 0.35 });
    if (b.mode === 'fog') h.push({ at: 0.15, name: 't_tension', vol: 0.35 });
    else if (!b.tease) h.push({ at: (b.arriveAt ?? 0.35) + 0.05, name: 't_hit', vol: 0.42 });
    if (b.tease) h.push({ at: (b.starAt ?? 0.6) + 0.55, name: 't_sparkle', vol: 0.6 });
    if (b.proofAt !== undefined) h.push({ at: b.proofAt, name: 't_marker', vol: 0.3 });
  }
  return h;
};
