import React from 'react';
import { Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { safeArea, theme, useLayout } from '../theme';
import type { Scene } from '../types';
import { textWidth } from '../components/NewsHighlight';

// Subscription / cost audit as a thermal receipt. The receipt prints line by line while a big
// monthly total ticks up; unused lines get a red marker strike + "안 씀" and the total ticks back
// down; the payoff splits it into 실사용 / 낭비 with an optional yearly post-it. Use it for "내 구독료
// 점검", API bills, tool costs, any "이만큼 내고 이만큼 버린다" story. Prices are the real ones.
//
// props: title, date?, currency? ('₩'), lines: [{name, plan?, price, unused?, from}] (from = printed)
//        strike? ({from} — unused lines get struck one after another from here; default after printing)
//        result? ({from, labels?: {real?: '실사용', waste?: '낭비'}} — the final split; default after the strikes)
//        yearly? (true — "1년이면 ₩… 증발" post-it under the waste; false hides it)
//        labels? ({total?: '이번 달 구독료', per?: '/월', unused?: '안 씀', head?: ['항목', '금액/월'],
//                  sum?: '합계', printer?: 'SUBSCRIPTION AUDIT', yearly?: '1년이면 {n} 증발'})
type Line = { name: string; plan?: string; price: number; unused?: boolean; from?: number };
const RED = theme.doodle;

export const ReceiptScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { vertical } = useLayout();
  const safe = safeArea(vertical);
  const p = scene.props as {
    title?: string; date?: string; currency?: string; lines?: Line[]; strike?: { from?: number };
    result?: { from?: number; labels?: { real?: string; waste?: string } }; yearly?: boolean;
    labels?: { total?: string; per?: string; unused?: string; head?: [string, string]; sum?: string; printer?: string; yearly?: string };
  };
  const L = { total: '이번 달 구독료', per: '/월', unused: '안 씀', head: ['항목', '금액/월'], sum: '합계', printer: 'SUBSCRIPTION AUDIT', yearly: '1년이면 {n} 증발', ...p.labels };
  const RL = { real: '실사용', waste: '낭비', ...p.result?.labels };
  const cur = p.currency ?? '₩';
  const money = (n: number) => `${cur}${Math.round(n).toLocaleString('en-US')}`;
  const sec = (s: number) => Math.round(s * fps);
  const sp = (f: number, config = { damping: 16, mass: 0.7, stiffness: 160 }) => spring({ frame: frame - f, fps, config });

  // ---- timing ------------------------------------------------------------------------------
  const raw = p.lines ?? [];
  const n = raw.length;
  const unusedIdx = raw.map((l, i) => (l.unused ? i : -1)).filter((i) => i >= 0);
  // Without timing: printing takes the first ~45 % of the scene, strikes the next ~25 %.
  const printStart = sec(0.9);
  const printSpan = Math.max(sec(0.4) * n, scene.frames * 0.42);
  const printAt = raw.reduce<number[]>((acc, l, i) => {
    const spread = printStart + Math.round((printSpan * i) / Math.max(1, n));
    acc.push(l.from ?? Math.max(spread, i ? acc[i - 1] + sec(0.35) : 0));
    return acc;
  }, []);
  const totalAt = (n ? printAt[n - 1] : printStart) + sec(0.5);
  const strikeStart = p.strike?.from ?? Math.max(totalAt + sec(0.6), Math.round(scene.frames * 0.5));
  const strikeEvery = sec(0.75);
  const strikeAt = (i: number) => strikeStart + unusedIdx.indexOf(i) * strikeEvery;
  const lastStrikeAt = unusedIdx.length ? strikeAt(unusedIdx[unusedIdx.length - 1]) : strikeStart;
  const finalAt = p.result?.from ?? Math.min(scene.frames - sec(2.2), lastStrikeAt + sec(1.2));

  const fullTotal = raw.reduce((s, l) => s + l.price, 0);
  const waste = raw.filter((l) => l.unused).reduce((s, l) => s + l.price, 0);
  const real = fullTotal - waste;

  // ticker: each printed line adds its price, each strike removes it (eased count)
  const ease = (a: number) => interpolate(frame, [a, a + sec(0.45)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const ticker = raw.reduce((s, l, i) => s + l.price * ease(printAt[i]) - (l.unused ? l.price * ease(strikeAt(i)) : 0), 0);

  // ---- geometry ----------------------------------------------------------------------------
  // 16:9: a tall receipt fills the left half (rows stretch to the available height), totals on the right.
  // 9:16: totals band on top, receipt below.
  const paper = vertical
    ? { left: safe.side, top: 680, w: 640, bottomMax: 1290 }
    : { left: 200, top: 165, w: 780, bottomMax: 905 };
  const HEADER = vertical ? 160 : 168;
  const TOTAL_H = vertical ? 80 : 90;
  // 9:16 puts the plan on the name's line (one-line rows), 16:9 under it
  const inlinePlan = vertical;
  const ROW = Math.max(inlinePlan ? 46 : 56, Math.min(vertical ? 80 : 104, (paper.bottomMax - paper.top - 60 - HEADER - TOTAL_H) / Math.max(1, n)));
  const nameFs = Math.min(vertical ? 36 : 40, ROW * (inlinePlan ? 0.62 : 0.46));
  const planFs = Math.round(nameFs * (inlinePlan ? 0.7 : 0.64));
  const padX = vertical ? 34 : 54;

  const head = sp(sec(0.2));
  const paperH = 40 + HEADER * head + raw.reduce((s, _, i) => s + ROW * sp(printAt[i]), 0) + TOTAL_H * sp(totalAt) + 20;
  const printing = printAt.some((a) => frame >= a && frame < a + sec(0.3)) || (frame >= totalAt && frame < totalAt + sec(0.3)) || (frame >= sec(0.2) && frame < sec(0.5));
  const buzz = printing ? Math.sin(frame * 3.1) * 1.4 : 0;

  // final split
  const fin = sp(finalAt, { damping: 13, mass: 0.8, stiffness: 140 });
  const fin2 = sp(finalAt + sec(0.35), { damping: 13, mass: 0.8, stiffness: 140 });
  const fin3 = sp(finalAt + sec(0.8), { damping: 12, mass: 0.7, stiffness: 150 });
  const tickerOut = interpolate(frame, [finalAt - 3, finalAt + 4], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const lastStrike = [...unusedIdx].reverse().find((i) => frame >= strikeAt(i));
  const jolt = lastStrike !== undefined ? interpolate(frame - strikeAt(lastStrike), [0, 2, 12], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0;

  // number sizes fitted to the panel width
  const panelW = vertical ? 1080 - safe.side * 2 : 1780 - 1090;
  const numW = (s: string, fs: number) => [...s].reduce((w, ch) => w + (/[0-9]/.test(ch) ? 0.56 : ch === ',' ? 0.3 : 0.9) * fs, 0);
  const perW = (fs: number) => textWidth(` ${L.per}`, fs * 0.37);
  const fitFs = (s: string, max: number, w: number) => Math.min(max, w / Math.max(1, numW(s, 1) + perW(1)));
  const tickFs = fitFs(money(fullTotal), vertical ? 120 : 132, panelW);
  const splitW = vertical ? panelW / 2 - 20 : panelW;
  const splitFs = Math.min(fitFs(money(real), vertical ? 92 : 104, splitW), fitFs(money(waste), vertical ? 92 : 104, splitW));
  const showYearly = p.yearly !== false && waste > 0;

  // zig-zag torn edge
  const teeth = 24;
  const zig = Array.from({ length: teeth + 1 }, (_, k) => `${(1 - k / teeth) * paper.w}px ${paperH - (k % 2 ? 0 : 14)}px`).join(', ');

  const tickerBlock = (
    <div style={{ opacity: tickerOut * sp(sec(0.6)), transform: `translate(${jolt * 8 * Math.sin(frame * 2.7)}px, ${(1 - tickerOut) * -30}px)` }}>
      <div style={{ fontFamily: theme.font, fontWeight: 700, fontSize: vertical ? 38 : 34, color: theme.muted }}>{L.total}</div>
      <div style={{ fontFamily: theme.display, fontSize: tickFs, lineHeight: 1.05, color: lastStrike !== undefined ? theme.bone : theme.accent, whiteSpace: 'nowrap' }}>
        {money(ticker)}
        <span style={{ fontSize: tickFs * 0.37, color: theme.muted }}> {L.per}</span>
      </div>
      {/* minus chips that fly up on each strike */}
      <div style={{ position: 'relative', height: 80 }}>
        {unusedIdx.map((i, k) => {
          if (frame < strikeAt(i)) return null;
          const q = sp(strikeAt(i), { damping: 14, mass: 0.6, stiffness: 160 });
          const fade = interpolate(frame, [strikeAt(i) + sec(0.55), strikeAt(i) + sec(0.75)], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <div key={i} style={{ position: 'absolute', left: 10 + k * 8, top: 10, fontFamily: theme.display, fontSize: 52, color: RED, opacity: fade, transform: `translateY(${(1 - q) * 40 - q * 20}px)`, whiteSpace: 'nowrap' }}>
              −{money(raw[i].price)}
            </div>
          );
        })}
      </div>
    </div>
  );

  const split =
    frame >= finalAt - 2 ? (
      <div style={{ position: 'absolute', left: 0, top: 0, width: panelW }}>
        <div style={{ display: 'flex', flexDirection: vertical ? 'row' : 'column', gap: vertical ? 40 : 22 }}>
          <div style={{ opacity: fin, transform: `translateY(${(1 - fin) * 40}px)` }}>
            <div style={{ fontFamily: theme.font, fontWeight: 700, fontSize: vertical ? 36 : 32, color: theme.muted }}>{RL.real}</div>
            <div style={{ fontFamily: theme.display, fontSize: splitFs, lineHeight: 1.05, color: theme.bone, whiteSpace: 'nowrap' }}>
              {money(real)}<span style={{ fontSize: splitFs * 0.38, color: theme.muted }}> {L.per}</span>
            </div>
          </div>
          <div style={{ opacity: fin2, transform: `translateY(${(1 - fin2) * 40}px)` }}>
            <div style={{ fontFamily: theme.font, fontWeight: 700, fontSize: vertical ? 36 : 32, color: RED }}>{RL.waste}</div>
            <div style={{ position: 'relative', display: 'inline-block', fontFamily: theme.display, fontSize: splitFs, lineHeight: 1.05, color: RED, whiteSpace: 'nowrap' }}>
              {money(waste)}<span style={{ fontSize: splitFs * 0.38 }}> {L.per}</span>
              <Underline from={finalAt + sec(0.55)} />
            </div>
          </div>
        </div>
        {/* share bar: how much of the bill is waste */}
        <div style={{ marginTop: vertical ? 18 : 30, height: 18, width: vertical ? panelW : panelW * 0.92, borderRadius: 9, background: theme.barMuted, overflow: 'hidden', display: 'flex', opacity: fin2 }}>
          <div style={{ width: `${(real / Math.max(1, fullTotal)) * 100 * fin2}%`, background: theme.bone }} />
          <div style={{ width: `${(waste / Math.max(1, fullTotal)) * 100 * fin2}%`, background: RED }} />
        </div>
        {showYearly && (
          <div
            style={{
              display: 'inline-block', marginTop: vertical ? 22 : 30, fontFamily: theme.hand, fontSize: vertical ? 58 : 56, color: '#222', background: theme.postit, padding: '6px 22px',
              transform: `rotate(-3deg) scale(${0.6 + 0.4 * fin3})`, opacity: Math.min(1, fin3 * 1.6), transformOrigin: '0 50%', boxShadow: '0 6px 0 rgba(0,0,0,.18)', whiteSpace: 'nowrap',
            }}
          >
            {L.yearly.replace('{n}', money(waste * 12))}
          </div>
        )}
      </div>
    ) : null;

  // own stacking context: the z-indexes below never rise above the scene's mascot / doodles
  return (
    <div style={{ position: 'absolute', inset: 0, isolation: 'isolate' }}>
      {/* paper */}
      <div
        style={{
          position: 'absolute', left: paper.left, top: paper.top, width: paper.w, height: paperH, transform: `translateY(${buzz}px) rotate(-1.2deg)`, transformOrigin: '50% 0',
          filter: 'drop-shadow(0 26px 40px rgba(0,0,0,0.5))',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, clipPath: `polygon(0 0, ${paper.w}px 0, ${zig})`, background: 'linear-gradient(90deg, #E9E5DC 0%, #F7F4EC 8%, #FAF8F2 50%, #F7F4EC 92%, #E6E2D8 100%)' }}>
          <div style={{ position: 'absolute', left: padX, right: padX, top: 40, opacity: head, color: '#26262A', fontFamily: theme.mono }}>
            <div style={{ textAlign: 'center', fontFamily: theme.display, fontSize: vertical ? 50 : 54, lineHeight: 1.15, letterSpacing: 2, whiteSpace: 'nowrap' }}>{p.title}</div>
            {p.date && <div style={{ textAlign: 'center', fontSize: 24, color: '#6B6A66', marginTop: 8 }}>{p.date}</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, color: '#6B6A66', marginTop: p.date ? 18 : 30 }}>
              <span>{L.head[0]}</span><span>{L.head[1]}</span>
            </div>
            <div style={{ borderTop: '3px dashed #B9B5AC', marginTop: 10 }} />
          </div>

          {raw.map((l, i) => {
            if (frame < printAt[i]) return null;
            const typed = Math.min(1, (frame - printAt[i]) / 7);
            const struck = l.unused && frame >= strikeAt(i);
            return (
              <div key={i} style={{ position: 'absolute', left: padX, right: padX, top: 40 + HEADER + i * ROW + (ROW - nameFs * 1.2 - (l.plan && !inlinePlan ? planFs * 1.25 : 0)) / 2 - 4, fontFamily: theme.mono, color: '#222', opacity: struck ? 0.5 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, fontSize: nameFs, fontWeight: 700, lineHeight: 1.2 }}>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', flex: 1 }}>
                    {l.name.slice(0, Math.ceil(l.name.length * typed))}
                    {inlinePlan && l.plan && <span style={{ fontSize: planFs, fontWeight: 400, color: '#7A7873', marginLeft: 14, opacity: typed }}>{l.plan}</span>}
                  </span>
                  <span style={{ opacity: typed >= 1 ? 1 : 0, whiteSpace: 'nowrap' }}>{money(l.price)}</span>
                </div>
                {l.plan && !inlinePlan && <div style={{ fontSize: planFs, lineHeight: 1.25, color: '#7A7873', opacity: typed }}>{l.plan}</div>}
              </div>
            );
          })}

          {frame >= totalAt && (
            <div style={{ position: 'absolute', left: padX, right: padX, top: 40 + HEADER + n * ROW + 6, fontFamily: theme.mono, color: '#111', opacity: Math.min(1, sp(totalAt) * 1.5) }}>
              <div style={{ borderTop: '3px dashed #B9B5AC' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 16, fontSize: nameFs * 1.15, fontWeight: 700 }}>
                <span>{L.sum}</span>
                <span>{money(fullTotal)}</span>
              </div>
            </div>
          )}
        </div>

        {/* red marker strikes (outside the clip so they can overshoot the paper) */}
        {raw.map((l, i) =>
          l.unused && frame >= strikeAt(i) ? (
            <Strike key={i} i={i} from={strikeAt(i)} top={40 + HEADER + i * ROW + ROW * (inlinePlan ? 0.5 : 0.42)} w={paper.w} label={L.unused} inside={vertical} />
          ) : null,
        )}
      </div>

      {/* printer head */}
      <div style={{ position: 'absolute', left: paper.left - 50, top: paper.top - 58, width: paper.w + 100, height: 76, borderRadius: 20, background: 'linear-gradient(180deg, #3A3C44, #24262C)', boxShadow: '0 16px 30px rgba(0,0,0,0.45)', border: `2px solid ${theme.panelBorder}` }}>
        <div style={{ position: 'absolute', left: 40, right: 40, bottom: 12, height: 8, borderRadius: 4, background: '#0C0D10' }} />
        <div style={{ position: 'absolute', right: 30, top: 18, width: 14, height: 14, borderRadius: 7, background: printing ? theme.mint : '#4A4D57', boxShadow: printing ? `0 0 14px ${theme.mint}` : undefined }} />
        <div style={{ position: 'absolute', left: 30, top: 14, fontFamily: theme.font, fontWeight: 700, fontSize: 20, color: theme.muted, letterSpacing: 2 }}>{L.printer}</div>
      </div>

      {/* totals: running ticker → final split */}
      <div style={{ position: 'absolute', left: vertical ? safe.side : 1090, top: vertical ? safe.top + 10 : 190, width: panelW }}>
        {tickerBlock}
        {split}
      </div>
    </div>
  );
};

// Stop-motion red marker strike across a receipt row, plus a hand-written "안 씀"
// (beside the paper in 16:9, on the paper's right end in 9:16).
const Strike: React.FC<{ i: number; from: number; top: number; w: number; label: string; inside: boolean }> = ({ i, from, top, w, label, inside }) => {
  const frame = useCurrentFrame();
  const local = frame - from;
  const drawn = Math.min(1, Math.floor(local / 2) / 3);
  const step = Math.floor(frame / 3);
  const j = (k: string) => (random(`${i}${k}-${step}`) - 0.5) * 5;
  const W = w - 60;
  const pop = Math.min(1, Math.max(0, (local - 5) / 4));
  return (
    <>
      <svg width={W} height={40} style={{ position: 'absolute', left: 30, top: top - 20, overflow: 'visible' }}>
        <path
          d={`M${j('a')},${22 + j('b')} Q${W * 0.5},${12 + j('c')} ${W + j('d')},${18 + j('e')}`}
          fill="none" stroke={RED} strokeWidth={8} strokeLinecap="round" strokeDasharray={1200} strokeDashoffset={1200 * (1 - drawn)}
        />
      </svg>
      <div
        style={{
          position: 'absolute', left: inside ? w - 150 : w + 18, top: top - (inside ? 60 : 46), fontFamily: theme.hand, fontSize: inside ? 58 : 64, color: RED, whiteSpace: 'nowrap',
          transform: `rotate(${-8 + j('r') * 0.6}deg) scale(${0.6 + 0.4 * pop})`, opacity: pop, transformOrigin: '0 50%',
          textShadow: inside ? '0 0 6px #FAF8F2, 0 0 10px #FAF8F2' : undefined,
        }}
      >
        {label}
      </div>
    </>
  );
};

const Underline: React.FC<{ from: number }> = ({ from }) => {
  const frame = useCurrentFrame();
  const local = frame - from;
  if (local < 0) return null;
  const drawn = Math.min(1, Math.floor(local / 2) / 4);
  const step = Math.floor(frame / 3);
  const j = (k: string) => (random(`u${k}-${step}`) - 0.5) * 6;
  return (
    <svg width="100%" height={30} style={{ position: 'absolute', left: 0, bottom: -18, overflow: 'visible' }} viewBox="0 0 400 30" preserveAspectRatio="none">
      <path d={`M${j('a')},${14 + j('b')} Q200,${30 + j('c')} ${400 + j('d')},${8 + j('e')}`} fill="none" stroke={RED} strokeWidth={7} strokeLinecap="round" strokeDasharray={600} strokeDashoffset={600 * (1 - drawn)} />
    </svg>
  );
};
