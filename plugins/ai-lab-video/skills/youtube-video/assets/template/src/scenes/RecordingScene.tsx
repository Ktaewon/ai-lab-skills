import { AbsoluteFill, Freeze, OffthreadVideo, interpolate, random, spring, staticFile, useCurrentFrame } from 'remotion';
import { theme, useLayout } from '../theme';
import type { Click, Scene } from '../types';

// props: zoom? (long, default 1.6), zoomShort? (vertical, default 1.15), playbackRate? (default 1),
//        shots?: string[] (one label per zoom shot, shown top-left)
//
// The recording is cropped into a box (the whole frame for 16:9, the middle band for 9:16) and the
// camera follows the logged clicks: clicks within MERGE_GAP s on the same row/column form one shot,
// the camera springs in before the shot and out after it.
const MERGE_GAP = 3;
const SAME_LINE_PX = 20;
const LEAD = 0.45;
const HOLD = 0.7;
const CHAIN = 0.5;

type Shot = { start: number; end: number; x: number; y: number; label: string; n: number };

const makeShots = (clicks: Click[]) => {
  const shots: Shot[] = [];
  clicks.forEach((c, i) => {
    const prev = clicks[i - 1];
    const last = shots[shots.length - 1];
    const sameLine = prev && (Math.abs(c.y - prev.y) < SAME_LINE_PX || Math.abs(c.x - prev.x) < SAME_LINE_PX);
    if (last && sameLine && c.t - last.end < MERGE_GAP) {
      last.n += 1;
      last.x += (c.x - last.x) / last.n;
      last.y += (c.y - last.y) / last.n;
      last.end = c.t;
    } else {
      shots.push({ start: c.t, end: c.t, x: c.x, y: c.y, label: c.label, n: 1 });
    }
  });
  return shots.map((s) => ({ ...s, start: s.start - LEAD, end: s.end + HOLD }));
};

export const RecordingScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { width, height, vertical } = useLayout();
  const fps = 30;
  const rec = scene.rec;

  if (!rec) {
    return (
      <AbsoluteFill style={{ color: theme.muted, fontFamily: theme.font, fontSize: 44, alignItems: 'center', justifyContent: 'center' }}>
        녹화 필요: {scene.id}
      </AbsoluteFill>
    );
  }

  const rate: number = scene.props.playbackRate ?? 1;
  const videoEnd = Math.floor(((rec.duration - 0.05) / rate) * fps);
  const zoom: number = vertical ? scene.props.zoomShort ?? 1.15 : scene.props.zoom ?? 1.6;
  const shots = makeShots(rec.clicks.map((c) => ({ ...c, t: c.t / rate })));
  const sp = (atSec: number) => spring({ frame: frame - Math.round(atSec * fps), fps, config: { damping: 200, mass: 0.9 } });

  let z = 0;
  let fx = rec.width / 2;
  let fy = rec.height / 2;
  let px = fx;
  let py = fy;
  shots.forEach((s, i) => {
    const next = shots[i + 1];
    const prev = shots[i - 1];
    if (!(prev && s.start - prev.end < CHAIN)) z += sp(s.start);
    if (!(next && next.start - s.end < CHAIN)) z -= sp(s.end);
    const p = sp(s.start);
    fx += (s.x - px) * p;
    fy += (s.y - py) * p;
    px = s.x;
    py = s.y;
  });
  z = Math.min(1, Math.max(0, z));

  // Box the recording is shown in.
  const box = vertical ? { x: 0, y: 300, w: width, h: 1020 } : { x: 0, y: 0, w: width, h: height };
  const cover = Math.max(box.w / rec.width, box.h / rec.height);
  const s = cover * (1 + (zoom - 1) * z);
  // In a vertical box the crop always follows the focus (the video is wider than the box);
  // in 16:9 it only moves while zoomed.
  const follow = vertical ? 1 : z;
  const cx = rec.width / 2 + (fx - rec.width / 2) * follow;
  const cy = rec.height / 2 + (fy - rec.height / 2) * z;
  const tx = Math.min(0, Math.max(box.w - rec.width * s, box.w / 2 - cx * s));
  const ty = Math.min(0, Math.max(box.h - rec.height * s, box.h / 2 - cy * s));

  const t = frame / fps;
  let active = -1;
  shots.forEach((sh, i) => {
    if (t >= sh.start && t <= sh.end + 0.3) active = i;
  });
  const labels: string[] = scene.props.shots ?? [];
  const label = active >= 0 ? labels[active] ?? shots[active].label : '';
  const labelIn = active >= 0 ? interpolate(t, [shots[active].start, shots[active].start + 0.25], [0, 1], { extrapolateRight: 'clamp' }) : 0;

  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: rec.width, height: rec.height, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${s})` }}>
          {frame < videoEnd ? (
            <OffthreadVideo src={staticFile(rec.video)} playbackRate={rate} muted style={{ width: rec.width, height: rec.height }} />
          ) : (
            // Narration outlasts the recording: hold its last frame instead of going blank.
            <Freeze frame={videoEnd - 1}>
              <OffthreadVideo src={staticFile(rec.video)} playbackRate={rate} muted style={{ width: rec.width, height: rec.height }} />
            </Freeze>
          )}
        </div>
        {scene.props.clickMarks !== false &&
          rec.clicks.map((c, i) => {
            // A crude red marker circle on every click, placed through the same camera transform
            // as the video, so it lands on the clicked element at any zoom, in 16:9 and 9:16.
            const at = Math.round((c.t / rate) * fps);
            const local = frame - at + 4;
            if (local < 0 || local > 1.3 * fps) return null;
            const drawn = Math.min(1, Math.floor(local / 2) / 4);
            const r = 46 * s;
            const step = Math.floor(frame / 3);
            const pts = Array.from({ length: 14 }, (_, k) => {
              const a = (k / 12) * Math.PI * 2 - 0.3;
              const w = 1 + (random(`ck${i}-${k}`) - 0.5) * 0.14 + (random(`ck${i}-${k}-${step}`) - 0.5) * 0.06;
              return `${c.x * s + tx + Math.cos(a) * r * 1.35 * w},${c.y * s + ty + Math.sin(a) * r * w}`;
            });
            return (
              <svg key={i} style={{ position: 'absolute', inset: 0, width: box.w, height: box.h, overflow: 'visible' }}>
                <path d={`M${pts.join(' L')}`} fill="none" stroke={theme.doodle} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray={2000} strokeDashoffset={2000 * (1 - drawn)} />
              </svg>
            );
          })}
        {label && (
          <div
            style={{
              position: 'absolute', left: vertical ? 40 : 70, top: vertical ? 30 : 60, opacity: labelIn,
              background: theme.panel, color: theme.bone, fontFamily: theme.font, fontSize: vertical ? 44 : 38,
              fontWeight: 700, padding: '14px 26px', borderRadius: 14,
            }}
          >
            <span style={{ color: theme.accent, marginRight: 14 }}>{active + 1}</span>
            {label}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
