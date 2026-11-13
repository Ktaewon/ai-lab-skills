import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { LAND } from '../components/MapLand';
import { theme, useLayout } from '../theme';
import timeline from '../timeline.json';
import type { Scene } from '../types';

// Map route story (지식해적단 / Johnny Harris style): a stylised dot-matrix world on a paper-grain
// stage. The camera flies between regions, pins pop with a number and a label, glowing dashed routes
// arc from origin to destination with a label pill, a spot gets a pulsing ring with a big label, and
// the scene can end on an overview with a summary card. Use it for where things are / move: supply
// chains, launches by country, a trip, data-centre locations. Places and numbers are shown as real.
// The world is Pacific-centred (longitudes < -30 are shifted +360) so trans-Pacific routes stay short.
//
// props: title?, kicker?
//        camera: [{center: [lon, lat], zoom, say|at, centerShort?, zoomShort?}] — holds each view, flies
//                into the next one when said (1.3 s). zoom 1 = whole world across the frame width;
//                the same zoom shows the same east–west span in 9:16 (more north–south).
//        pins:   [{id, lon, lat, label, sub?, num?, side? ('left'|'right'), say|at}]
//        routes: [{path: [pinId, pinId, ...], label?, bend? (arc, default 0.28; negative = other side), say|at}]
//                (`path`, not from/to: prepare.py writes a timed object's `from`)
//        spots?: [{pin? | lon+lat, text, r? (degrees, default 2.4), for? (seconds), say|at}] — pulsing area +
//                big label; stays until the camera next moves (or `for` seconds)
//        summary?: {text, sub?, say|at} — closing card (sub = small line above the big text)
// Every timed item gets `from` (frame) from prepare.py; without it pins/routes/spots/summary are
// spread over the scene in order and camera moves spread over the same span.
// 16:9: title top-left, summary top-right; lower right is mascot room.
// 9:16: the camera centres on the middle band (between the hook and the captions); summary card at the
//       bottom-left of that band.
type Cam = { center: [number, number]; zoom: number; from?: number; centerShort?: [number, number]; zoomShort?: number };
type Pin = { id: string; lon: number; lat: number; label: string; sub?: string; num?: string | number; side?: 'left' | 'right'; from?: number };
type Route = { path?: string[]; from?: number | string; to?: string; label?: string; bend?: number };
type Spot = { pin?: string; lon?: number; lat?: number; text?: string; label?: string; r?: number; for?: number; from?: number; at?: number };
type Summary = { text: string; sub?: string; from?: number };

const normLon = (lon: number) => (lon < -30 ? lon + 360 : lon);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const FLY = 1.3; // seconds per camera move
const LEG = 1.1; // seconds to draw one route leg
const textW = (s: string, fs: number) => [...s].reduce((w, ch) => w + (/[ᄀ-퟿　-鿿]/.test(ch) ? 1 : ch === ' ' ? 0.3 : 0.56) * fs, 0);

// Land path in "degree" units (x = lon, y = -lat), drawn twice (lon and lon+360) so a camera centred
// anywhere in the Pacific-centred view has land on both sides.
const LAND_PATH = [0, 360]
  .map((off) => LAND.map((p) => `M${p.map(([lo, la]) => `${(lo + off).toFixed(2)},${(-la).toFixed(2)}`).join('L')}Z`).join(''))
  .join('');
const GRID = (() => {
  let d = '';
  for (let lo = -180; lo <= 540; lo += 15) d += `M${lo},-80V80`;
  for (let la = -75; la <= 75; la += 15) d += `M-180,${-la}H540`;
  return d;
})();

type CamAt = { lon: number; lat: number; zoom: number; at: number };
// Camera at time t: hold each keyframe, fly into the next one over FLY seconds starting at its `at`.
const cameraAt = (cams: CamAt[], t: number) => {
  let i = 0;
  while (i < cams.length - 1 && t >= cams[i + 1].at) i++;
  const b = cams[i];
  const a = cams[Math.max(0, i - 1)];
  const p = i === 0 ? 1 : Easing.inOut(Easing.cubic)(interpolate(t, [b.at, b.at + FLY], [0, 1], clamp));
  const lz = Math.log(a.zoom) + (Math.log(b.zoom) - Math.log(a.zoom)) * p;
  const dist = Math.hypot(b.lon - a.lon, b.lat - a.lat);
  const bump = Math.min(0.3, dist / 220) * Math.sin(Math.PI * p); // pull out a little mid-flight
  return { lon: a.lon + (b.lon - a.lon) * p, lat: a.lat + (b.lat - a.lat) * p, zoom: Math.exp(lz) * (1 - bump) };
};

export const MapScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { vertical, width, height } = useLayout();
  const props = scene.props as {
    title?: string; kicker?: string; camera?: Cam[]; pins?: Pin[]; routes?: Route[]; spots?: Spot[]; highlights?: Spot[]; summary?: Summary;
  };
  const t = frame / fps;
  const F = (s: number) => Math.round(s * fps);
  const leadIn = (timeline as { leadInFrames?: number }).leadInFrames ?? Math.round(0.8 * fps);
  const pins = props.pins ?? [];
  const pinById = Object.fromEntries(pins.map((p) => [p.id, p]));
  // `highlights` is accepted as an alias of `spots` (prepare.py reserves that key, so `say` can't time it there).
  const rawSpots = [...(props.spots ?? []), ...(props.highlights ?? []).filter((h) => h.pin || (h.lon != null && h.lat != null))]
    .map((s) => (s.from == null && s.at != null ? { ...s, from: leadIn + Math.round(s.at * fps) } : s));
  const rawRoutes = (props.routes ?? [])
    .map((r) => ({ ...r, path: r.path ?? (typeof r.from === 'string' && r.to ? [r.from, r.to] : []), from: typeof r.from === 'number' ? r.from : undefined }))
    .filter((r) => r.path.length >= 2 && r.path.every((id) => pinById[id]));

  // ---- Fallback timing: pins in order, each route right after its last pin, spots after their pin ----
  type Ev = { kind: 'pin' | 'route' | 'spot' | 'summary'; i: number };
  const order: Ev[] = [];
  const shown = new Set<string>();
  const placedRoutes = new Set<number>();
  const placedSpots = new Set<number>();
  const flush = () => {
    rawRoutes.forEach((r, i) => {
      if (!placedRoutes.has(i) && r.path.every((id) => shown.has(id))) { placedRoutes.add(i); order.push({ kind: 'route', i }); }
    });
    rawSpots.forEach((s, i) => {
      if (!placedSpots.has(i) && s.pin && shown.has(s.pin)) { placedSpots.add(i); order.push({ kind: 'spot', i }); }
    });
  };
  pins.forEach((p, i) => { order.push({ kind: 'pin', i }); shown.add(p.id); flush(); });
  rawRoutes.forEach((_, i) => { if (!placedRoutes.has(i)) order.push({ kind: 'route', i }); });
  rawSpots.forEach((_, i) => { if (!placedSpots.has(i)) order.push({ kind: 'spot', i }); });
  if (props.summary) order.push({ kind: 'summary', i: 0 });
  const s0 = 1.0 * fps;
  const s1 = Math.max(s0 + 1, scene.frames - 1.6 * fps);
  const slot = (kind: Ev['kind'], i: number) => {
    const j = order.findIndex((o) => o.kind === kind && o.i === i);
    return (order.length <= 1 ? s0 : s0 + (j * (s1 - s0)) / (order.length - 1)) / fps;
  };
  const atOf = (from: number | undefined, kind: Ev['kind'], i: number) => (from != null ? from / fps : slot(kind, i));
  const pinsT = pins.map((p, i) => ({ ...p, at: atOf(p.from, 'pin', i) }));
  const routesT = rawRoutes.map((r, i) => ({ ...r, at: atOf(r.from, 'route', i) }));
  const spotsT = rawSpots.map((s, i) => ({ ...s, at: atOf(s.from, 'spot', i) }));
  const summary = props.summary ? { ...props.summary, at: atOf(props.summary.from, 'summary', 0) } : undefined;

  // ---- Camera ----
  const camIn = props.camera?.length
    ? props.camera
    : [{ center: [pins.length ? pins.reduce((a, p) => a + normLon(p.lon), 0) / pins.length : 135, pins.length ? pins.reduce((a, p) => a + p.lat, 0) / pins.length : 25] as [number, number], zoom: 1 }];
  const nc = camIn.length;
  const cams: CamAt[] = camIn
    .map((c, i) => {
      const center = (vertical && c.centerShort) || c.center;
      const at = c.from != null ? c.from / fps : i === 0 ? 0 : (s0 + ((i - 1) * (s1 - s0)) / Math.max(1, nc - 1)) / fps - 0.3;
      return { lon: normLon(center[0]), lat: center[1], zoom: Math.max(0.6, (vertical && c.zoomShort) || c.zoom || 1), at };
    })
    .sort((a, b) => a.at - b.at);
  const cam = cameraAt(cams, t);
  const K = width / 360; // px per degree at zoom 1
  const S = K * cam.zoom;
  const cx = width / 2;
  const cy = vertical ? 800 : height / 2;
  const toScreen = (lon: number, lat: number) => ({ x: cx + (normLon(lon) - cam.lon) * S, y: cy - (lat - cam.lat) * S });
  const detail = interpolate(cam.zoom, [1.1, 1.45], [0, 1], clamp);
  const routeLabels = interpolate(cam.zoom, [1.08, 1.3], [0, 1], clamp); // the overview hides route pills
  const nextMoveAfter = (at: number) => cams.find((c) => c.at > at + 0.05)?.at;

  const mapIn = interpolate(t, [0, 0.6], [0.25, 1], clamp);
  const titleIn = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 14 });
  const fsPin = vertical ? 36 : 32;
  const fsSub = vertical ? 25 : 22;
  const fsRoute = vertical ? 28 : 26;
  const fsSpot = vertical ? 66 : 64;
  const titleTop = vertical ? 312 : 104;
  const titleFs = Math.min(vertical ? 60 : 66, (vertical ? 940 : 1180) / Math.max(1, textW(props.title ?? '', 1)));

  const bez = (r: (typeof routesT)[number], leg: number) => {
    const a = pinById[r.path[leg]], b = pinById[r.path[leg + 1]];
    const p0 = toScreen(a.lon, a.lat), p2 = toScreen(b.lon, b.lat);
    const bend = r.bend ?? 0.28;
    return { p0, p2, c: { x: (p0.x + p2.x) / 2 + (p2.y - p0.y) * bend, y: (p0.y + p2.y) / 2 - (p2.x - p0.x) * bend } };
  };

  const pillW = (label: string) => textW(label, fsRoute) + 40;

  return (
    <>
      {/* Map */}
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <pattern id="mapDots" width={0.75} height={0.75} patternUnits="userSpaceOnUse">
            <circle cx={0.375} cy={0.375} r={0.26} fill="#6B6E79" />
          </pattern>
          <filter id="mapGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8" /></filter>
          <radialGradient id="mapVign" cx="50%" cy={vertical ? '42%' : '50%'} r="75%">
            <stop offset="55%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
          </radialGradient>
        </defs>
        <g transform={`translate(${cx} ${cy}) scale(${S}) translate(${-cam.lon} ${cam.lat})`} opacity={mapIn}>
          <path d={GRID} stroke="#FFFFFF" strokeOpacity={0.045} strokeWidth={1.2} vectorEffect="non-scaling-stroke" fill="none" />
          <path d={LAND_PATH} fill="#26272E" fillRule="evenodd" />
          <path d={LAND_PATH} fill="url(#mapDots)" fillRule="evenodd" />
          <path d={LAND_PATH} fill="none" stroke="#7A7D88" strokeOpacity={0.55} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        </g>
        <rect width={width} height={height} fill="url(#mapVign)" />
      </svg>
      {/* Paper texture: low-frequency blotches over the map */}
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0, mixBlendMode: 'overlay', opacity: 0.22, pointerEvents: 'none' }}>
        <filter id="mapPaper"><feTurbulence type="fractalNoise" baseFrequency="0.006 0.01" numOctaves={4} seed={7} /><feColorMatrix values="0 0 0 0 0.75  0 0 0 0 0.6  0 0 0 0 0.45  0 0 0 1.4 -0.35" /></filter>
        <rect width={width} height={height} filter="url(#mapPaper)" />
      </svg>

      {/* Spots */}
      {spotsT.map((h, i) => {
        const anchor = h.pin ? pinById[h.pin] : h.lon != null && h.lat != null ? { lon: h.lon, lat: h.lat } : undefined;
        const text = h.text ?? h.label ?? '';
        if (!anchor || t < h.at) return null;
        const until = h.for != null ? h.at + h.for : nextMoveAfter(h.at);
        const out = until != null ? interpolate(t, [until, until + 0.3], [1, 0], clamp) : 1;
        if (out <= 0) return null;
        const p = spring({ frame: frame - F(h.at), fps, config: { damping: 12 } });
        const s = toScreen(anchor.lon, anchor.lat);
        const r = Math.max(30, (h.r ?? 2.4) * S);
        const pulse = ((t - h.at) % 1.2) / 1.2;
        // Label right of the ring; left of it when that runs off-frame or into the mascot's corner; else below.
        const tw = textW(text, fsSpot);
        const inMascot = (x0: number, x1: number, y0: number) => (vertical ? x1 > 700 && y0 > 880 && y0 < 1300 : x1 > 1150 && y0 > 520);
        const pin = h.pin ? pinById[h.pin] : undefined; // don't cover the pin's own label
        const pinSide = pin ? pin.side ?? (s.x > width * 0.64 ? 'left' : 'right') : undefined;
        const rightOk = pinSide !== 'right' && s.x + r + 30 + tw < width - 60 && !inMascot(s.x + r + 30, s.x + r + 30 + tw, s.y);
        const leftOk = pinSide !== 'left' && s.x - r - 30 - tw > 40 && !inMascot(s.x - r - 30 - tw, s.x - r - 30, s.y);
        const below = !rightOk && !leftOk;
        return (
          <div key={i} style={{ position: 'absolute', left: 0, top: 0, opacity: out }}>
            <svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
              <circle cx={s.x} cy={s.y} r={r * p} fill={theme.accent} fillOpacity={0.16} stroke={theme.accent} strokeWidth={4} strokeDasharray="10 8" strokeDashoffset={-frame * 1.2} />
              <circle cx={s.x} cy={s.y} r={r * (1 + pulse * 0.9)} fill="none" stroke={theme.accent} strokeWidth={3} opacity={(1 - pulse) * 0.7 * p} />
            </svg>
            {text && (
              <div
                style={{
                  position: 'absolute', opacity: Math.min(1, p * 1.3),
                  ...(below
                    ? { left: Math.max(40, Math.min(width - 40 - textW(text, fsSpot), s.x - textW(text, fsSpot) / 2)), top: s.y + r + 20, transform: `translateY(${(1 - p) * 30}px)` }
                    : { left: rightOk ? s.x + r + 30 : s.x - r - 30 - tw, top: s.y + 10, transform: `translateX(${(1 - p) * (rightOk ? 30 : -30)}px)` }),
                }}
              >
                <div style={{ fontFamily: theme.display, fontSize: fsSpot, color: theme.accent, textShadow: `0 0 30px ${theme.accent}66, 0 4px 18px rgba(0,0,0,.8)`, whiteSpace: 'nowrap' }}>{text}</div>
              </div>
            )}
          </div>
        );
      })}

      {/* Routes */}
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {routesT.map((r, i) => {
          const legs = r.path.length - 1;
          return Array.from({ length: legs }, (_, leg) => {
            const start = r.at + leg * LEG;
            const draw = interpolate(t, [start, start + LEG], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
            if (draw <= 0) return null;
            const { p0, p2, c } = bez(r, leg);
            const N = 70;
            const pts: { x: number; y: number }[] = [];
            for (let q = 0; q <= N; q++) {
              const u = (q / N) * draw;
              pts.push({ x: (1 - u) ** 2 * p0.x + 2 * (1 - u) * u * c.x + u * u * p2.x, y: (1 - u) ** 2 * p0.y + 2 * (1 - u) * u * c.y + u * u * p2.y });
            }
            const d = `M${pts.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join('L')}`;
            const tip = pts[pts.length - 1];
            const pre = pts[pts.length - 3];
            const ang = Math.atan2(tip.y - pre.y, tip.x - pre.x);
            return (
              <g key={`${i}-${leg}`}>
                <path d={d} fill="none" stroke={theme.accent} strokeWidth={12} opacity={0.4} filter="url(#mapGlow)" />
                <path d={d} fill="none" stroke={theme.accent} strokeWidth={5} strokeLinecap="round" strokeDasharray="18 12" strokeDashoffset={-frame * 1.6} />
                {draw < 1 ? (
                  <>
                    <circle cx={tip.x} cy={tip.y} r={18} fill={theme.accent} opacity={0.6} filter="url(#mapGlow)" />
                    <circle cx={tip.x} cy={tip.y} r={8} fill="#FFE6DA" />
                  </>
                ) : (
                  leg === legs - 1 && (
                    <path d={`M${tip.x - 24 * Math.cos(ang - 0.5)},${tip.y - 24 * Math.sin(ang - 0.5)} L${tip.x},${tip.y} L${tip.x - 24 * Math.cos(ang + 0.5)},${tip.y - 24 * Math.sin(ang + 0.5)}`} fill="none" stroke={theme.accent} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
                  )
                )}
              </g>
            );
          });
        })}
      </svg>
      {/* Route labels (on the middle leg) */}
      {routesT.map((r, i) => {
        if (!r.label) return null;
        const legs = r.path.length - 1;
        const leg = Math.floor((legs - 1) / 2);
        const q = interpolate(t, [r.at + leg * LEG + 0.5, r.at + leg * LEG + 0.8], [0, 1], clamp);
        if (q <= 0) return null;
        const { p0, p2, c } = bez(r, leg);
        const m = { x: 0.25 * p0.x + 0.5 * c.x + 0.25 * p2.x, y: 0.25 * p0.y + 0.5 * c.y + 0.25 * p2.y };
        return (
          <div key={i} style={{ position: 'absolute', left: Math.max(30 + pillW(r.label) / 2, Math.min(width - 30 - pillW(r.label) / 2, m.x)), top: m.y, transform: `translate(-50%, -50%) translateY(${(1 - q) * 12}px)`, opacity: q * routeLabels }}>
            <div style={{ fontFamily: theme.font, fontWeight: 700, fontSize: fsRoute, color: theme.bone, background: 'rgba(17,18,21,0.92)', border: `2px solid ${theme.accent}`, borderRadius: 999, padding: '6px 18px', whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
              {r.label}
            </div>
          </div>
        );
      })}

      {/* Pins */}
      {pinsT.map((p) => {
        if (t < p.at) return null;
        const s = toScreen(p.lon, p.lat);
        const pop = spring({ frame: frame - F(p.at), fps, config: { damping: 9, mass: 0.6 } });
        const lab = spring({ frame: frame - F(p.at + 0.15), fps, config: { damping: 200 }, durationInFrames: 12 });
        const ring = ((t - p.at) % 1.6) / 1.6;
        const right = (p.side ?? (s.x > width * 0.64 ? 'left' : 'right')) === 'right';
        return (
          <div key={p.id} style={{ position: 'absolute', left: s.x, top: s.y }}>
            <div style={{ position: 'absolute', left: -34, top: -34, width: 68, height: 68, borderRadius: 34, border: `3px solid ${theme.accent}`, opacity: (1 - ring) * 0.8, transform: `scale(${0.4 + ring})` }} />
            <div style={{ position: 'absolute', left: -13, top: -13, width: 26, height: 26, borderRadius: 13, background: theme.accent, border: '4px solid #FFE6DA', boxShadow: `0 0 24px ${theme.accent}`, transform: `scale(${pop})` }} />
            <div
              style={{
                position: 'absolute', top: -34, [right ? 'left' : 'right']: 30, display: 'flex', flexDirection: right ? 'row' : 'row-reverse', alignItems: 'center', gap: 12,
                opacity: lab, transform: `translateX(${(1 - lab) * (right ? -16 : 16)}px)`,
              }}
            >
              {p.num != null && p.num !== '' && (
                <div style={{ width: fsPin * 1.44, height: fsPin * 1.44, borderRadius: fsPin, background: theme.accent, color: '#111', fontFamily: theme.display, fontSize: fsPin * 0.94, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{p.num}</div>
              )}
              <div style={{ background: 'rgba(17,18,21,0.92)', border: `2px solid ${theme.panelBorder}`, borderRadius: 14, padding: '6px 16px', textAlign: right ? 'left' : 'right', boxShadow: '0 10px 30px rgba(0,0,0,.5)' }}>
                <div style={{ fontFamily: theme.font, fontWeight: 800, fontSize: fsPin, color: theme.bone, whiteSpace: 'nowrap', lineHeight: 1.15 }}>{p.label}</div>
                {p.sub && (
                  <div style={{ fontFamily: theme.font, fontWeight: 500, fontSize: fsSub, color: theme.muted, whiteSpace: 'nowrap', height: fsSub * 1.27 * detail, maxWidth: 360 * detail, opacity: detail, overflow: 'hidden', marginLeft: right ? 0 : 'auto' }}>{p.sub}</div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Title (with a scrim for legibility over the map) */}
      {(props.title || props.kicker) && (
        <>
          <div style={{ position: 'absolute', left: 0, top: vertical ? 240 : 0, width, height: vertical ? 300 : 300, background: 'linear-gradient(180deg, rgba(20,21,25,0.85), rgba(20,21,25,0))', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', left: vertical ? 70 : 140, top: titleTop, opacity: 0.35 + 0.65 * titleIn, transform: `translateY(${(1 - titleIn) * 24}px)` }}>
            {props.kicker && <div style={{ fontFamily: theme.font, fontWeight: 700, fontSize: vertical ? 32 : 26, color: theme.accent, letterSpacing: 2 }}>{props.kicker}</div>}
            {props.title && <div style={{ fontFamily: theme.display, fontSize: titleFs, color: theme.bone, lineHeight: 1.15, whiteSpace: 'nowrap', textShadow: '0 4px 20px rgba(0,0,0,.6)' }}>{props.title}</div>}
          </div>
        </>
      )}

      {/* Summary card */}
      {summary && t >= summary.at && (() => {
        const p = spring({ frame: frame - F(summary.at), fps, config: { damping: 12, mass: 0.7 } });
        const big = vertical ? 70 : 64;
        const pos = vertical ? { left: 70, top: 1090 } : { right: 140, top: 110 };
        return (
          <div style={{ position: 'absolute', ...pos, opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * (vertical ? 30 : -30)}px) rotate(${vertical ? -2 : 2}deg)` }}>
            <div style={{ background: theme.panel, border: `3px solid ${theme.accent}`, borderRadius: 22, padding: '18px 30px', boxShadow: `0 24px 60px rgba(0,0,0,.5), 0 0 40px ${theme.accent}33` }}>
              {summary.sub && <div style={{ fontFamily: theme.font, fontWeight: 700, fontSize: vertical ? 30 : 26, color: theme.muted, whiteSpace: 'nowrap' }}>{summary.sub}</div>}
              <div style={{ fontFamily: theme.display, fontSize: Math.min(big, (vertical ? 640 : 1000) / Math.max(1, textW(summary.text, 1))), color: theme.accent, lineHeight: 1.15, whiteSpace: 'nowrap' }}>{summary.text}</div>
            </div>
          </div>
        );
      })()}
    </>
  );
};
