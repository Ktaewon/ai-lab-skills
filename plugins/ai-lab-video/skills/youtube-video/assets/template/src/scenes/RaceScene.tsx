import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { safeArea, theme, useLayout } from '../theme';
import type { Scene } from '../types';
import { textWidth } from '../components/NewsHighlight';

// Bar chart race. Bars grow period by period and re-sort with smooth swaps; a big period counter
// ticks in the corner; a "1위 등극!/탈환!" stamp slams whenever the leader changes; the last period
// holds with the winner glowing. Use it for rankings over time (users, downloads, benchmark scores,
// market share). Values are real data per period — never interpolate made-up points.
//
// props: entities: {key: {label, color?}}, frames: [{period, values: {key: number}}] (in time order)
//        title?, unit? ('만 명'), kicker? ('RANKING'), topN? (6), decimals? (0)
//        run? ({from} — the race starts; default ~0.7 s in)
//        end? ({from} — the last period is reached; default ~2 s before the scene ends)
//        leadStamps? (true | false | {first?: '1위 등극!', retake?: '1위 탈환!'} — stamp on lead changes)
type Ent = { label: string; color?: string };
type Period = { period: string; values: Record<string, number> };
const GREYS = ['#9AA0AE', '#767B89', '#5F6371', '#4D515D', '#8B8F9C', '#6A6E7B'];

export const RaceScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { vertical } = useLayout();
  const safe = safeArea(vertical);
  const p = scene.props as {
    entities?: Record<string, Ent>; frames?: Period[]; title?: string; unit?: string; kicker?: string; topN?: number; decimals?: number;
    run?: { from?: number }; end?: { from?: number }; leadStamps?: boolean | { first?: string; retake?: string };
  };
  const ents = p.entities ?? {};
  const keys = Object.keys(ents);
  const periods = p.frames ?? [];
  if (!keys.length || !periods.length) return null;
  const topN = Math.min(p.topN ?? 6, keys.length);
  const dec = p.decimals ?? 0;
  const last = periods.length - 1;
  const colorOf = (k: string, i: number) => ents[k].color ?? (i === 0 ? theme.accent : i === 1 ? theme.mint : GREYS[(i - 2) % GREYS.length]);
  const colors = Object.fromEntries(keys.map((k, i) => [k, colorOf(k, i)]));

  // Timing: run.from → end.from covers every period.
  const startF = p.run?.from ?? Math.round(0.7 * fps);
  const endF = Math.max(startF + Math.round(1.5 * fps), p.end?.from ?? scene.frames - Math.round(2 * fps));
  const perF = last ? (endF - startF) / last : 1;

  const posAt = (f: number) => (last ? Math.max(0, Math.min(last, (f - startF) / perF)) : 0);
  const valuesAt = (f: number) => {
    const ps = posAt(f);
    const i = Math.min(Math.max(0, last - 1), Math.floor(ps));
    const k = last ? ps - i : 0;
    const a = periods[i].values, b = periods[Math.min(last, i + 1)].values;
    return Object.fromEntries(keys.map((key) => [key, (a[key] ?? 0) + ((b[key] ?? 0) - (a[key] ?? 0)) * k]));
  };
  const ranksAt = (f: number) => {
    const v = valuesAt(f);
    const order = [...keys].sort((x, y) => v[y] - v[x]);
    return Object.fromEntries(order.map((key, r) => [key, r]));
  };
  const leaderAt = (f: number) => Object.entries(ranksAt(f)).find(([, r]) => r === 0)![0];

  const vals = valuesAt(frame);
  // Smooth swaps: rank averaged over the last SM frames (sine-weighted).
  const SM = 10;
  const smRankAt = (f: number) =>
    Object.fromEntries(
      keys.map((key) => {
        let s = 0, w = 0;
        for (let k = 0; k < SM; k++) {
          const wk = Math.sin(((k + 0.5) / SM) * Math.PI);
          s += ranksAt(f - k)[key] * wk;
          w += wk;
        }
        return [key, s / w];
      }),
    );
  const smRank = smRankAt(frame);
  const smPrev = smRankAt(frame - 2);
  const maxV = Math.max(1e-9, ...keys.map((k) => vals[k]));

  // Lead changes: the most recent one within 1.6 s (not before the race starts).
  const stampsOn = p.leadStamps !== false;
  const stampText = typeof p.leadStamps === 'object' ? p.leadStamps : {};
  let change: { f: number; key: string; retake: boolean } | null = null;
  if (stampsOn) {
    for (let f = frame; f > frame - Math.round(1.6 * fps) && f > startF; f--) {
      if (leaderAt(f) !== leaderAt(f - 1)) {
        const key = leaderAt(f);
        let ledBefore = false;
        for (let g = startF; g < f - 1; g += 3) if (leaderAt(g) === key) { ledBefore = true; break; }
        change = { f, key, retake: ledBefore };
        break;
      }
    }
  }

  const pos = posAt(frame);
  const pi = Math.min(last, Math.floor(pos + 0.001));
  const tick = spring({ frame: frame - (pi ? Math.round(startF + pi * perF) : 0), fps, config: { damping: 14, mass: 0.5, stiffness: 200 } });
  const intro = spring({ frame, fps, config: { damping: 16 } });
  const done = frame >= endF;
  const endGlow = interpolate(frame - endF, [0, 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const fmt = (v: number) => v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });

  // Geometry
  const rowTop = vertical ? 600 : 290;
  const rowsH = vertical ? 1170 - rowTop : 930 - rowTop;
  const ROW = Math.min(vertical ? 118 : 102, rowsH / topN);
  const BAR_H = ROW * 0.76;
  const numW = vertical ? 60 : 50; // rank number column
  const labelW = vertical ? 0 : 240; // 16:9: names left of the bars; 9:16: names inside / after the bar
  const barX = safe.side + numW + (labelW ? labelW + 20 : 10);
  const barMax = vertical ? 1080 - safe.side - barX - 130 : 1390 - barX; // 9:16 keeps room for the value after the bar
  const fs = vertical ? 38 : 36;
  const valFs = vertical ? 40 : 42;
  const longestPeriod = Math.max(...periods.map((x) => textWidth(x.period, 1)));
  const periodFs = Math.min(vertical ? 96 : 116, (vertical ? 560 : 520) / Math.max(1, longestPeriod));

  const counter = (
    <div style={{ textAlign: vertical ? 'left' : 'right', opacity: intro }}>
      <div style={{ height: periodFs * 1.14, overflow: 'hidden' }}>
        <div
          style={{
            fontFamily: theme.display, fontSize: periodFs, lineHeight: `${periodFs * 1.14}px`, color: done ? theme.accent : theme.bone, whiteSpace: 'nowrap',
            transform: `translateY(${(1 - tick) * 60}px)`, opacity: interpolate(tick, [0, 0.5], [0.2, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          {periods[pi].period}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: vertical ? 'flex-start' : 'flex-end', fontFamily: theme.font, fontWeight: 600, fontSize: vertical ? 26 : 22, color: theme.muted, marginTop: 10 }}>
        <span>{periods[0].period}</span>
        <div style={{ width: 200, height: 6, borderRadius: 3, background: theme.barMuted, overflow: 'hidden' }}>
          <div style={{ width: `${last ? (pos / last) * 100 : 100}%`, height: '100%', background: theme.accent }} />
        </div>
        <span>{periods[last].period}</span>
      </div>
    </div>
  );

  // own stacking context: the z-indexes below never rise above the scene's mascot / doodles
  return (
    <div style={{ position: 'absolute', inset: 0, isolation: 'isolate' }}>
      {/* title (+ period counter on the right in 16:9, below in 9:16) */}
      <div style={{ position: 'absolute', left: safe.side, right: safe.side, top: vertical ? safe.top + 10 : 110, display: 'flex', flexDirection: vertical ? 'column' : 'row', gap: vertical ? 26 : 30, alignItems: vertical ? 'stretch' : 'flex-start' }}>
        <div style={{ flex: 1, opacity: intro, transform: `translateY(${(1 - intro) * -30}px)` }}>
          <div style={{ fontFamily: theme.font, fontWeight: 700, fontSize: vertical ? 34 : 28, color: theme.accent, letterSpacing: 2 }}>{p.kicker ?? 'RANKING'}</div>
          {p.title && (
            <div style={{ fontFamily: theme.display, fontSize: vertical ? 74 : 64, color: theme.bone, lineHeight: 1.1, wordBreak: 'keep-all' }}>
              {p.title}
              {p.unit && <span style={{ fontFamily: theme.font, fontWeight: 600, fontSize: vertical ? 32 : 28, color: theme.muted }}> 단위: {p.unit}</span>}
            </div>
          )}
        </div>
        {counter}
      </div>

      {/* rank slots (fixed, so swaps never show two numbers at once) */}
      {Array.from({ length: topN }, (_, r) => (
        <div key={r} style={{ position: 'absolute', left: safe.side, width: numW, top: rowTop + r * ROW, height: BAR_H, display: 'flex', alignItems: 'center', fontFamily: theme.display, fontSize: 38, color: r === 0 ? theme.accent : theme.muted, opacity: intro }}>
          {r + 1}
        </div>
      ))}

      {/* bars */}
      {keys.map((key, idx) => {
        const e = ents[key];
        const color = colors[key];
        const r = smRank[key];
        // during a swap the entity moving down is drawn underneath, thinner, with its texts faded
        const d = Math.abs(r - Math.round(r));
        const falling = r - smPrev[key] > 0.001;
        const fade = falling ? 1 - Math.min(1, d * 2.4) * 0.85 : 1;
        const thin = falling ? 1 - Math.min(1, d * 2) * 0.35 : 1;
        const bh = BAR_H * thin;
        const y = rowTop + r * ROW + (BAR_H - bh) / 2;
        const w = Math.max(8, (vals[key] / maxV) * barMax);
        const vis = interpolate(r, [topN - 0.6, topN], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        if (vis <= 0) return null;
        const grow = spring({ frame: frame - 4 - Math.round(r) * 3, fps, config: { damping: 18 } });
        const flash = change && change.key === key ? interpolate(frame - change.f, [0, 3, 20], [0, 0.8, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0;
        const isWinner = done && ranksAt(frame)[key] === 0;
        const light = color === theme.mint || color === theme.accent || /^#[cdefCDEF]/.test(color);
        const ink = light ? '#16171C' : theme.bone;
        const bw = w * grow;
        const value = fmt(vals[key]);
        const valW = textWidth(value, valFs) + 40;
        const nameW = textWidth(e.label, fs) + 40;
        // 16:9: value inside the bar when it fits. 9:16: name inside (left) when it fits, value after the bar.
        const valueInside = !vertical && bw > valW + 30;
        const nameInside = vertical && bw > nameW + 20;
        return (
          <div key={key} style={{ position: 'absolute', left: 0, top: y, width: 1080 * (vertical ? 1 : 2), height: bh, opacity: vis * grow, zIndex: falling ? 1 : 10 + idx }}>
            {!vertical && (
              <div style={{ position: 'absolute', left: safe.side + numW, width: labelW, top: 0, height: bh, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', fontFamily: theme.font, fontWeight: 800, fontSize: fs, color: theme.bone, whiteSpace: 'nowrap', opacity: fade }}>
                {e.label}
              </div>
            )}
            <div
              style={{
                position: 'absolute', left: barX, top: 0, height: bh, width: bw, borderRadius: 14, background: color, overflow: 'hidden',
                boxShadow: isWinner ? `0 0 ${40 * endGlow}px ${color}` : '0 8px 24px rgba(0,0,0,0.3)',
              }}
            >
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0) 55%)' }} />
              <div style={{ position: 'absolute', inset: 0, background: '#fff', opacity: flash }} />
              {valueInside && (
                <div style={{ position: 'absolute', right: 22, top: 0, height: bh, display: 'flex', alignItems: 'center', fontFamily: theme.display, fontSize: valFs, color: ink, opacity: fade }}>{value}</div>
              )}
              {nameInside && (
                <div style={{ position: 'absolute', left: 20, top: 0, height: bh, display: 'flex', alignItems: 'center', fontFamily: theme.font, fontWeight: 800, fontSize: fs, color: ink, whiteSpace: 'nowrap', opacity: fade }}>{e.label}</div>
              )}
            </div>
            {!valueInside && (
              <div style={{ position: 'absolute', left: barX + bw + 16, top: 0, height: bh, display: 'flex', alignItems: 'center', gap: 14, whiteSpace: 'nowrap', opacity: fade }}>
                {vertical && !nameInside && <span style={{ fontFamily: theme.font, fontWeight: 800, fontSize: fs, color: theme.bone }}>{e.label}</span>}
                <span style={{ fontFamily: theme.display, fontSize: valFs, color: theme.bone }}>{value}</span>
              </div>
            )}
          </div>
        );
      })}

      {/* lead-change stamp */}
      {change && (
        <LeadStamp
          key={change.f} f={change.f} label={ents[change.key].label} color={colors[change.key]}
          text={change.retake ? (stampText.retake ?? '1위 탈환!') : (stampText.first ?? '1위 등극!')}
          style={vertical ? { left: 0, right: 0, top: rowTop + ROW * 1.3 } : { right: 110, top: 330, width: 400 }}
        />
      )}
    </div>
  );
};

const LeadStamp: React.FC<{ f: number; label: string; color: string; text: string; style: React.CSSProperties }> = ({ f, label, color, text, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slam = spring({ frame: frame - f, fps, config: { damping: 9, mass: 0.6, stiffness: 220 } });
  const out = interpolate(frame - f, [40, 48], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', ...style, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: Math.min(1, slam * 1.6) * out, zIndex: 40 }}>
      <div
        style={{
          fontFamily: theme.display, fontSize: 62, lineHeight: 1, color, border: `8px solid ${color}`, borderRadius: 18, padding: '12px 26px 6px', background: 'rgba(14,15,18,0.88)',
          transform: `rotate(-8deg) scale(${2.2 - 1.2 * slam})`, textShadow: `0 0 24px ${color}88`, whiteSpace: 'nowrap',
        }}
      >
        {text}
      </div>
      <div style={{ marginTop: 22, fontFamily: theme.hand, fontSize: 56, color: theme.bone, transform: 'rotate(-4deg)', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>{label}</div>
    </div>
  );
};
