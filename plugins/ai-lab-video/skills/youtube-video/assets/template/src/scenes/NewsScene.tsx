import React from 'react';
import { interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { safeArea, theme, useLayout } from '../theme';
import type { Scene } from '../types';
import { Highlighted, textWidth } from '../components/NewsHighlight';

// News roundup / fact check. Headline cards fly in one by one and pile up; the front card's key
// phrase gets the yellow highlighter, then a verdict stamp slams onto it. A counter (N/total) and
// a row of verdict dots track progress; at the end optional tally chips sum up the verdicts.
// Use it for "이번 주 AI 뉴스", headline fact checks, "이 기사들 진짜일까?". Headlines are real
// headlines (quote them, don't invent them); verdicts are the video's own judgement.
//
// props: items: [{outlet, color?, date?, tag? ('IT · AI'; '' hides it), headline, highlight? (phrase inside
//                 the headline), verdict? ('사실'|'과장'|'오보' or any short text), tone? ('good'|'warn'|'bad'), from}]
//        title?, kicker? ('NEWS CHECK'), summary? ({from} — tally chips of the verdicts; true = after the last stamp)
//        Timing: each item lands at its `from` (say/at); the highlighter sweeps ~0.5 s later and the
//        stamp slams ~1 s later. Items without timing are spread over the scene.
type Tone = 'good' | 'warn' | 'bad';
type Item = { outlet: string; color?: string; date?: string; tag?: string; headline: string; highlight?: string; verdict?: string; tone?: Tone; from?: number };

const TONE: Record<Tone, string> = { good: '#34C77B', warn: theme.accent, bad: '#FF3B3B' };
const AUTO_TONE: Record<string, Tone> = { 사실: 'good', 진짜: 'good', 맞음: 'good', 과장: 'warn', 반쯤: 'warn', 절반: 'warn', 오보: 'bad', 가짜: 'bad', 거짓: 'bad', 틀림: 'bad' };
const OUTLET_COLORS = ['#4C7DF0', '#2FB67C', '#9B5CF0', '#E0A526', '#E2558A', '#3FB4D8'];
const toneOf = (it: Item): Tone => it.tone ?? AUTO_TONE[it.verdict ?? ''] ?? 'warn';

const HL_AT = 0.55; // s after the card lands: highlighter sweep
const STAMP_AT = 1.05; // s after the card lands: stamp slam

export const NewsScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { vertical } = useLayout();
  const safe = safeArea(vertical);
  const { items: raw = [], title, kicker = 'NEWS CHECK', summary } = scene.props as {
    items?: Item[]; title?: string; kicker?: string; summary?: { from?: number } | boolean;
  };

  // Timing: given `from` wins; missing ones are spread from ~1 s in to ~1.5 s (+ stamp time) before the end.
  const n = raw.length;
  const first = Math.round(0.8 * fps);
  const lastLand = scene.frames - Math.round((1.5 + STAMP_AT + (summary ? 1.2 : 0)) * fps);
  const items = raw.reduce<(Item & { from: number })[]>((acc, it, i) => {
    const spread = first + Math.round(((lastLand - first) * i) / Math.max(1, n - 1));
    const prev = acc.length ? acc[acc.length - 1].from + Math.round(0.6 * fps) : 0;
    acc.push({ ...it, from: it.from ?? Math.max(spread, prev) });
    return acc;
  }, []);
  const summaryFrom =
    summary && typeof summary === 'object' && summary.from != null
      ? summary.from
      : (items.length ? items[items.length - 1].from : 0) + Math.round((STAMP_AT + 0.9) * fps);

  // Geometry
  const card = vertical
    ? { left: safe.side, top: 680, w: 1080 - safe.side * 2, padX: 44, padY: 36, fs: 60, logo: 60, meta: 30 }
    : { left: 250, top: 330, w: 1080, padX: 52, padY: 40, fs: 62, logo: 58, meta: 32 };
  const LH = 1.28;
  const HEADER = card.logo + 60; // logo row + divider margins
  const lines = (it: Item) => Math.max(1, Math.ceil(textWidth(it.headline, card.fs) / ((card.w - card.padX * 2) * 0.96)));
  const cardH = (it: Item) => card.padY + HEADER + lines(it) * card.fs * LH + card.padY + (it.verdict ? 34 : 0);

  const sp = (f: number, config = { damping: 15, mass: 0.8, stiffness: 120 }) => spring({ frame: frame - f, fps, config });
  const arrived = items.filter((it) => frame >= it.from).length;
  const titleIn = sp(0, { damping: 16, mass: 1, stiffness: 100 });
  const counterPop = arrived ? sp(items[arrived - 1].from + 4, { damping: 8, mass: 0.6, stiffness: 200 }) : 0;

  // Summary chips: one per distinct verdict, in order of first appearance.
  const tally: { verdict: string; tone: Tone; n: number }[] = [];
  for (const it of items) {
    if (!it.verdict) continue;
    const hit = tally.find((x) => x.verdict === it.verdict);
    if (hit) hit.n++;
    else tally.push({ verdict: it.verdict, tone: toneOf(it), n: 1 });
  }
  const lastH = items.length ? cardH(items[items.length - 1]) : 300;

  // own stacking context: the z-indexes below never rise above the scene's mascot / doodles
  return (
    <div style={{ position: 'absolute', inset: 0, isolation: 'isolate' }}>
      {/* title + counter */}
      <div style={{ position: 'absolute', left: safe.side, right: safe.side, top: vertical ? safe.top + 10 : 110, display: 'flex', alignItems: 'flex-start', gap: 30 }}>
        <div style={{ flex: 1, opacity: titleIn, transform: `translateY(${(1 - titleIn) * -30}px)` }}>
          <div style={{ fontFamily: theme.font, fontWeight: 700, fontSize: vertical ? 34 : 28, color: theme.accent, letterSpacing: 2 }}>{kicker}</div>
          {title && <div style={{ fontFamily: theme.display, fontSize: vertical ? 76 : 64, color: theme.bone, lineHeight: 1.1, wordBreak: 'keep-all' }}>{title}</div>}
        </div>
        <div style={{ textAlign: 'right', opacity: titleIn }}>
          <div style={{ fontFamily: theme.display, fontSize: vertical ? 96 : 120, lineHeight: 1, color: theme.bone, whiteSpace: 'nowrap' }}>
            <span style={{ display: 'inline-block', color: theme.accent, transform: `scale(${1 + (1 - counterPop) * 0.35})`, transformOrigin: '50% 70%' }}>{Math.max(arrived, 1)}</span>
            <span style={{ color: theme.muted, fontSize: vertical ? 64 : 80 }}>/{items.length}</span>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
            {items.map((it, i) => {
              const stamped = it.verdict && frame >= it.from + Math.round(STAMP_AT * fps);
              return <div key={i} style={{ width: 34, height: 10, borderRadius: 5, background: stamped ? TONE[toneOf(it)] : i < arrived ? theme.bone : theme.barMuted }} />;
            })}
          </div>
        </div>
      </div>

      {/* card pile */}
      {items.map((it, i) => {
        if (frame < it.from - 2) return null;
        const fly = sp(it.from, { damping: 17, mass: 0.9, stiffness: 110 });
        // how far this card has been pushed back into the pile (later arrivals), capped so it never climbs into the title
        const depthRaw = items.slice(i + 1).reduce((s, nx) => s + sp(nx.from, { damping: 18, mass: 1, stiffness: 90 }), 0);
        if (depthRaw > 4.5) return null; // buried deep in the pile: invisible anyway
        const depth = Math.min(depthRaw, vertical ? 2 : 3);
        const side = i % 2 ? 1 : -1;
        const pileRot = side * (2.2 + random(`r${i}`) * 2.5) * Math.min(1, depthRaw);
        const x = (1 - fly) * 1300 + depth * side * 14;
        const y = (1 - fly) * -260 - depth * (vertical ? 14 : 30);
        const rot = (1 - fly) * 24 + pileRot;
        const stampF = it.from + Math.round(STAMP_AT * fps);
        const slam = spring({ frame: frame - stampF, fps, config: { damping: 9, mass: 0.6, stiffness: 220 } });
        const jolt = it.verdict ? interpolate(frame - stampF, [0, 2, 12], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0;
        const shake = jolt * 10 * Math.sin(frame * 2.9);
        const hl = interpolate(frame, [it.from + HL_AT * fps, it.from + (HL_AT + 0.45) * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
        const dim = Math.min(1, depthRaw) * 0.55;
        const color = it.color ?? OUTLET_COLORS[i % OUTLET_COLORS.length];
        const vColor = TONE[toneOf(it)];
        const stampFs = (vertical ? 88 : 96) * (it.verdict && it.verdict.length > 3 ? 3 / it.verdict.length : 1);
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: card.left, top: card.top, width: card.w, height: cardH(it), zIndex: i,
              transform: `translate(${x + shake}px, ${y + jolt * 6}px) rotate(${rot}deg)`, transformOrigin: '50% 60%',
              filter: dim > 0.01 ? `brightness(${1 - dim})` : undefined,
            }}
          >
            <div style={{ position: 'absolute', inset: 0, background: '#FBFAF6', borderRadius: 26, boxShadow: '0 30px 70px rgba(0,0,0,0.5)', padding: `${card.padY}px ${card.padX}px`, boxSizing: 'border-box' }}>
              {/* header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, height: card.logo }}>
                <div style={{ width: card.logo, height: card.logo, borderRadius: 14, background: color, color: '#fff', fontFamily: theme.display, fontSize: card.logo * 0.55, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {[...it.outlet][0]}
                </div>
                <div style={{ fontFamily: theme.font, fontWeight: 800, fontSize: card.meta, color: '#1A1B20', whiteSpace: 'nowrap' }}>{it.outlet}</div>
                {it.date && <div style={{ fontFamily: theme.font, fontWeight: 500, fontSize: card.meta - 6, color: '#8A8D96', whiteSpace: 'nowrap' }}>· {it.date}</div>}
                <div style={{ flex: 1 }} />
                {it.tag !== '' && (
                  <div style={{ fontFamily: theme.font, fontWeight: 700, fontSize: 22, color: '#8A8D96', border: '2px solid #D9D6CE', borderRadius: 999, padding: '4px 16px', whiteSpace: 'nowrap' }}>{it.tag ?? 'IT · AI'}</div>
                )}
              </div>
              <div style={{ height: 2, background: '#E7E3DA', margin: '30px 0 28px' }} />
              {/* headline */}
              <div style={{ fontFamily: theme.font, fontWeight: 800, fontSize: card.fs, lineHeight: LH, color: '#16171C', wordBreak: 'keep-all', letterSpacing: -1 }}>
                <Highlighted text={it.headline} phrase={it.highlight} p={hl} />
              </div>
            </div>
            {/* verdict stamp: overhangs the card's lower-right corner */}
            {it.verdict && frame >= stampF && (
              <div
                style={{
                  position: 'absolute', ...(vertical ? { left: 40 } : { right: 50 }), bottom: -36, fontFamily: theme.display, fontSize: stampFs, lineHeight: 1, color: vColor, whiteSpace: 'nowrap',
                  border: `9px solid ${vColor}`, borderRadius: 20, padding: '10px 30px 6px', background: 'rgba(251,250,246,0.88)',
                  transform: `rotate(${-9 + side * 2}deg) scale(${2.3 - 1.3 * slam})`, opacity: Math.min(1, slam * 1.6),
                }}
              >
                {it.verdict}
              </div>
            )}
          </div>
        );
      })}

      {/* tally chips (9:16: between the title and the pile — the lower right belongs to the mascot) */}
      {summary && tally.length > 0 && (
        <div style={{ position: 'absolute', left: card.left, top: vertical ? card.top - 120 : card.top + lastH + 70, display: 'flex', gap: vertical ? 16 : 22, zIndex: 50 }}>
          {tally.map((v, k) => {
            const p = sp(summaryFrom + Math.round(k * 0.18 * fps), { damping: 10, mass: 0.6, stiffness: 180 });
            return (
              <div
                key={v.verdict}
                style={{
                  display: 'flex', alignItems: 'baseline', gap: 14, padding: '12px 28px', borderRadius: 18, background: theme.panel, border: `3px solid ${TONE[v.tone]}`,
                  opacity: Math.min(1, p * 1.5), transform: `translateY(${(1 - p) * 40}px)`,
                }}
              >
                <span style={{ fontFamily: theme.display, fontSize: vertical ? 48 : 44, color: TONE[v.tone] }}>{v.verdict}</span>
                <span style={{ fontFamily: theme.display, fontSize: vertical ? 60 : 56, color: theme.bone }}>{v.n}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
