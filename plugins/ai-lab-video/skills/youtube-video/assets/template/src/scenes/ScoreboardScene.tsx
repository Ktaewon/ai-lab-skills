import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { safeArea, theme, useLayout } from '../theme';
import type { Scene } from '../types';

// Round-by-round match, sports-broadcast style. A persistent score bar holds the contestant chips;
// each round's title card slams in and settles into a header strip, one result card per contestant
// pops in (what they did + PASS/FAIL), a "승리!" stamp lands on the winner and a "+1" flies up to
// their chip, where the score ticks. Scores accumulate round by round. `final` ends on a big score
// board with the leader marked. Use it for model/tool face-offs over several tasks. Results are
// what really happened in the test — never invent outcomes.
//
// props: event? (bar title), live? ('● LIVE'; '' hides)
//        contestants: [{name, color, score?, badge?}]  2–4; score = starting score (default 0),
//                     badge = 1–2 letters (default name[0..2])
//        rounds: [{title, task?, results: [{who, text, pass?}], winner?, points?, from?, verdict?: {from?}}]
//          title: 'ROUND 2 · 버그 고치기' (the part before '·' is drawn in the accent and shown as
//                 'R2' in the bar) · task: the mission line · results[].text: '\n' for a 2nd line
//          pass: true → PASS ✓, false → FAIL ✗, missing → no badge
//          winner: a contestant name (or a list for a shared win; omit for no winner)
//          points: added to the winner (default 1) · verdict.from: when the stamp lands
//                  (default ~3 s after the round starts, compressed if the next round comes sooner)
//        final?: {label ('중간 스코어'), leadLabel? ('선두'), from?}
// Timing: every `from` is a frame in the scene (prepare.py: say/at → from). Rounds without `from`
// are spread over the scene; final without `from` comes ~2.6 s before the end.
// Layout: 16:9 — bar on top, round strip, cards in a row (kept above the lower-right mascot spot).
// 9:16 — two-line bar under the hook, round strip, result cards stacked vertically.
type Contestant = { name: string; color: string; score?: number; badge?: string };
type Result = { who: string; text: string; pass?: boolean };
type Round = { title: string; task?: string; results?: Result[]; winner?: string | string[]; points?: number; from?: number; verdict?: { from?: number } };
type Props = { event?: string; live?: string; contestants?: Contestant[]; rounds?: Round[]; final?: { label?: string; leadLabel?: string; from?: number } };

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const RED = '#FF4D40';
const GREEN = '#39E58C';
const em = (s: string) => [...s].reduce((w, ch) => w + (/[ᄀ-퟿　-鿿]/.test(ch) ? 1 : ch === ' ' ? 0.3 : 0.6), 0);

export const ScoreboardScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { vertical } = useLayout();
  const safe = safeArea(vertical);
  const { event = '', live = '● LIVE', contestants = [], rounds: rawRounds = [], final } = scene.props as Props;
  const f = (s: number) => Math.round(s * fps);
  const W = vertical ? 1080 : 1920;
  const nC = Math.max(1, contestants.length);
  const idx = (name: string) => contestants.findIndex((c) => c.name === name);

  // ---- timing -------------------------------------------------------------------------------
  const finalF = final ? (final.from ?? scene.frames - f(2.6)) : Infinity;
  const spreadEnd = final ? finalF : scene.frames - f(1.5);
  const t0 = f(0.3);
  const starts = rawRounds.map((r, i) => r.from ?? Math.round(t0 + ((spreadEnd - t0) * i) / Math.max(1, rawRounds.length)));
  const rounds = rawRounds.map((r, i) => {
    const r0 = starts[i];
    const next = i + 1 < rawRounds.length ? starts[i + 1] : Math.min(finalF, scene.frames);
    const k = Math.max(0.45, Math.min(1, (next - r0 - f(0.6)) / f(4.0))); // compress the beats when rounds are close
    const stampF = r.verdict?.from ?? r0 + f(3.0 * k);
    const winners = (Array.isArray(r.winner) ? r.winner : r.winner ? [r.winner] : []).filter((w) => idx(w) >= 0);
    return {
      ...r, r0, next, winners, points: r.points ?? 1, results: r.results ?? [],
      settleF: r0 + f(1.0 * k), card0: r0 + f(1.2 * k), cardStep: f(0.55 * k), stampF, flyF: stampF + f(0.2), tickF: stampF + f(0.6),
    };
  });
  const scoreOf = (i: number) => (contestants[i].score ?? 0) + rounds.filter((r) => r.winners.includes(contestants[i].name) && frame >= r.tickF).reduce((s, r) => s + r.points, 0);
  const lastTick = (i: number) => Math.max(-999, ...rounds.filter((r) => r.winners.includes(contestants[i].name) && frame >= r.tickF).map((r) => r.tickF));
  const scores = contestants.map((_, i) => scoreOf(i));
  const top = Math.max(...scores, 0);
  const roundNow = [...rounds].reverse().find((r) => frame >= r.r0);

  // ---- geometry -----------------------------------------------------------------------------
  const side = vertical ? safe.side : 140;
  const barW = W - side * 2;
  const bar = vertical ? { top: 304, h: 172 } : { top: 110, h: 100 };
  const eventFs = vertical ? 38 : 36;
  const liveW = live ? 30 + em(live) * 24 : 0;
  const leftBlock = vertical ? 0 : 26 + liveW + 14 + em(event) * eventFs + 30;
  const chipGap = vertical ? 16 : 20;
  const chipsX = vertical ? side + 16 : side + leftBlock;
  const chipsW = vertical ? barW - 32 : barW - leftBlock - 110;
  const chipW = Math.min(340, (chipsW - chipGap * (nC - 1)) / nC);
  const chipH = vertical ? 86 : bar.h - 28;
  const chipTop = vertical ? bar.top + bar.h - chipH - 16 : bar.top + 14;
  const chipX = (i: number) => chipsX + i * (chipW + chipGap);
  const chipNameFs = (name: string) => Math.max(20, Math.min(vertical ? 36 : 32, (chipW - 52 - 70 - 48) / Math.max(1, em(name))));

  const stripTop = vertical ? 506 : 246;
  const taskTop = vertical ? 586 : 262;
  // Result cards: a row (16:9) or a stack (9:16); heights fit the text so there is no dead space.
  const textFs0 = vertical ? 50 : 40;
  const lineCount = (t: string, fs: number, w: number) => t.split('\n').reduce((s, l) => s + Math.max(1, Math.ceil((em(l) * fs) / w)), 0);
  const gapC = vertical ? 14 : 40;
  const cardW = vertical ? barW : Math.min(500, (barW - gapC * (nC - 1)) / nC);
  const cardsTop = vertical ? 632 : 330;
  const HEAD = vertical ? 74 : 80;
  const FOOT = vertical ? 0 : 76; // 16:9: badge row under the text; 9:16: badge sits in the header
  const cardH = (fs: number) => Math.max(...rounds.flatMap((r) => r.results.map((x) => lineCount(`> ${x.text}`, fs, cardW - 64))), 1) * fs * 1.42 + HEAD + FOOT + (vertical ? 28 : 44);
  let textFs = textFs0;
  const maxStack = vertical ? 1290 - cardsTop : 660 - cardsTop; // 16:9: stay above the mascot's bubble
  while (textFs > 24 && (vertical ? nC * cardH(textFs) + gapC * (nC - 1) : cardH(textFs)) > maxStack) textFs -= 2;
  const CH = cardH(textFs);
  const cardPos = (k: number) => vertical
    ? { x: side, y: cardsTop + k * (CH + gapC) }
    : { x: W / 2 - (cardW * nC + gapC * (nC - 1)) / 2 + k * (cardW + gapC), y: cardsTop };

  const barIn = spring({ frame, fps, config: { damping: 15 } });
  const finalP = Number.isFinite(finalF) ? spring({ frame: frame - finalF, fps, config: { damping: 14 } }) : 0;

  const badge = (c: Contestant, s: number) => (
    <div style={{ width: s, height: s, flexShrink: 0, borderRadius: s * 0.24, background: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.display, fontSize: s * 0.5, color: '#16181D' }}>
      {c.badge ?? c.name.slice(0, 2)}
    </div>
  );
  const passBadge = (pass: boolean, p: number, fs: number) => (
    <div
      style={{
        fontFamily: theme.display, fontSize: fs, color: pass ? GREEN : RED, border: `4px solid ${pass ? GREEN : RED}`, borderRadius: 12, padding: '2px 18px 0',
        background: pass ? 'rgba(57,229,140,.1)' : 'rgba(255,77,64,.1)', transform: `scale(${interpolate(p, [0, 1], [1.8, 1])})`, transformOrigin: '0 100%', opacity: Math.min(1, p * 2), whiteSpace: 'nowrap', flexShrink: 0,
      }}
    >
      {pass ? 'PASS ✓' : 'FAIL ✗'}
    </div>
  );

  return (
    <AbsoluteFill>
      {/* Persistent score bar */}
      <div
        style={{
          position: 'absolute', left: side, width: barW, top: bar.top, height: bar.h, borderRadius: 22, background: theme.panel, border: `2px solid ${theme.panelBorder}`,
          boxShadow: '0 20px 50px rgba(0,0,0,.45)', opacity: barIn, transform: `translateY(${(1 - barIn) * -50}px)`,
        }}
      >
        <div style={{ position: 'absolute', left: 24, top: 0, height: vertical ? 74 : bar.h, display: 'flex', alignItems: 'center', gap: 14 }}>
          {live && <div style={{ fontFamily: theme.font, fontWeight: 900, fontSize: 24, color: '#fff', background: RED, borderRadius: 8, padding: '4px 12px', opacity: 0.6 + 0.4 * Math.abs(Math.sin(frame / 12)), whiteSpace: 'nowrap' }}>{live}</div>}
          <div style={{ fontFamily: theme.display, fontSize: eventFs, color: theme.bone, whiteSpace: 'nowrap' }}>{event}</div>
        </div>
        <div style={{ position: 'absolute', right: 28, top: 0, height: vertical ? 74 : bar.h, display: 'flex', alignItems: 'center', fontFamily: theme.display, fontSize: 34, color: theme.muted, whiteSpace: 'nowrap' }}>
          {roundNow ? roundNow.title.split('·')[0].trim().replace(/^ROUND\s*/i, 'R') : ''}
        </div>
      </div>
      {contestants.map((c, i) => {
        const tickF = lastTick(i);
        const pop = spring({ frame: frame - tickF, fps, config: { damping: 7, stiffness: 220, mass: 0.6 } });
        const glow = interpolate(frame - tickF, [0, 4, 30], [0, 1, 0], clamp);
        const lead = frame >= finalF && scores[i] === top;
        return (
          <div
            key={c.name + i}
            style={{
              position: 'absolute', left: chipX(i), top: chipTop, width: chipW, height: chipH, borderRadius: 16, background: '#22242B',
              border: `3px solid ${glow > 0 || lead ? c.color : '#33363F'}`, boxShadow: glow > 0 ? `0 0 ${40 * glow}px ${c.color}` : undefined,
              display: 'flex', alignItems: 'center', padding: '0 10px', gap: 12, opacity: barIn, transform: `translateY(${(1 - barIn) * -50}px)`,
            }}
          >
            {badge(c, 52)}
            <div style={{ flex: 1, fontFamily: theme.font, fontWeight: 800, fontSize: chipNameFs(c.name), color: theme.bone, whiteSpace: 'nowrap', overflow: 'hidden' }}>{c.name}</div>
            <div
              style={{
                minWidth: 64, height: 56, padding: '0 6px', borderRadius: 12, background: glow > 0 ? c.color : '#111215', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: theme.display, fontSize: 44, color: glow > 0.3 ? '#16181D' : theme.bone, transform: `scale(${1 + (1 - pop) * 0.6})`,
              }}
            >
              {scores[i]}
            </div>
          </div>
        );
      })}

      {/* Rounds: title card slam → header strip; result cards; stamp; +N */}
      {rounds.map((round, ri) => {
        const { r0, next } = round;
        if (frame < r0 || frame >= next + f(0.4)) return null;
        const leave = ri + 1 < rounds.length || final ? interpolate(frame, [next, next + f(0.35)], [0, 1], clamp) : 0;
        const [label, ...restName] = round.title.split('·').map((s) => s.trim());
        const name = restName.join(' · ');
        const slam = spring({ frame: frame - r0, fps, config: { damping: 10, stiffness: 180 } });
        const settle = spring({ frame: frame - round.settleF, fps, config: { damping: 16 } });
        const shake = interpolate(frame - r0, [2, 4, 14], [0, 1, 0], clamp) * 10 * Math.sin(frame * 3.3);
        // Big card font fits the frame; settled it shrinks to a strip at the top-left of the stage.
        const bigFs = Math.min(150, (barW - 140) / Math.max(1, em(label) + em(name) + 0.4));
        const smallFs = vertical ? 60 : 54;
        const sScale = smallFs / bigFs;
        const centerY = vertical ? 820 : 470;
        const st = spring({ frame: frame - round.stampF, fps, config: { damping: 9, stiffness: 210 } });
        return (
          <AbsoluteFill key={ri} style={{ opacity: 1 - leave, transform: `translate(${shake}px, ${leave * -70}px)` }}>
            <div
              style={{
                position: 'absolute', left: interpolate(settle, [0, 1], [W / 2, side]), top: interpolate(settle, [0, 1], [centerY, stripTop]),
                transform: `translate(${interpolate(settle, [0, 1], [-50, 0])}%, ${interpolate(settle, [0, 1], [-50, 0])}%) scale(${interpolate(settle, [0, 1], [1, sScale]) * interpolate(slam, [0, 1], [2.2, 1])})`,
                transformOrigin: '0 0', opacity: Math.min(1, slam * 2), whiteSpace: 'nowrap', zIndex: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: bigFs * 0.27, padding: `${bigFs * 0.16}px ${bigFs * 0.37}px`, borderRadius: 40, background: settle < 0.5 ? 'rgba(17,18,21,.92)' : 'transparent', border: `6px solid ${settle < 0.5 ? theme.accent : 'transparent'}` }}>
                <span style={{ fontFamily: theme.display, fontSize: bigFs, color: theme.accent, lineHeight: 1 }}>{label}</span>
                {name && <span style={{ fontFamily: theme.display, fontSize: bigFs, color: theme.bone, lineHeight: 1 }}>{name}</span>}
              </div>
            </div>
            {round.task && (
              <div
                style={{
                  position: 'absolute', ...(vertical ? { left: side, width: barW } : { right: side, maxWidth: 820, textAlign: 'right' as const }), top: taskTop,
                  fontFamily: theme.font, fontWeight: 600, fontSize: vertical ? 34 : 32, color: theme.muted, opacity: settle, wordBreak: 'keep-all', lineHeight: 1.3,
                }}
              >
                미션 · <span style={{ color: theme.bone }}>{round.task}</span>
              </div>
            )}

            {round.results.map((res, k) => {
              const ci = idx(res.who);
              const c = contestants[ci] ?? { name: res.who, color: theme.muted };
              const inF = round.card0 + k * round.cardStep;
              if (frame < inF) return null;
              const pIn = spring({ frame: frame - inF, fps, config: { damping: 13, mass: 0.8 } });
              const pb = spring({ frame: frame - inF - 8, fps, config: { damping: 10, stiffness: 200 } });
              const won = round.winners.includes(c.name) && frame >= round.stampF;
              const dim = frame >= round.stampF && round.winners.length > 0 && !round.winners.includes(c.name);
              const pos = cardPos(k);
              return (
                <div
                  key={k}
                  style={{
                    position: 'absolute', left: pos.x, top: pos.y, width: cardW, height: CH, borderRadius: 26, background: theme.panel, overflow: 'hidden',
                    border: `3px solid ${won ? c.color : theme.panelBorder}`, opacity: Math.min(1, pIn * 1.6) * (dim ? 0.55 : 1),
                    boxShadow: won ? `0 0 ${50 * st}px ${c.color}77, 0 24px 60px rgba(0,0,0,.5)` : '0 24px 60px rgba(0,0,0,.5)',
                    transform: vertical ? `translateX(${(1 - pIn) * 120}px)` : `translateY(${(1 - pIn) * 90}px) rotate(${(1 - pIn) * (k - (nC - 1) / 2) * 4}deg)`,
                    display: 'flex', flexDirection: 'column',
                  }}
                >
                  <div style={{ height: HEAD, flexShrink: 0, background: `${c.color}22`, borderBottom: `3px solid ${c.color}`, display: 'flex', alignItems: 'center', gap: 16, padding: '0 24px' }}>
                    {badge(c, HEAD * 0.64)}
                    <div style={{ flex: 1, fontFamily: theme.font, fontWeight: 800, fontSize: vertical ? 38 : 36, color: theme.bone, whiteSpace: 'nowrap' }}>{c.name}</div>
                    {vertical && res.pass !== undefined && passBadge(res.pass, pb, 34)}
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '0 32px' }}>
                    <div style={{ fontFamily: theme.mono, fontSize: textFs, lineHeight: 1.42, color: '#E2E5EB', whiteSpace: 'pre-line', wordBreak: 'keep-all' }}>
                      <span style={{ color: theme.accent }}>&gt; </span>{res.text}
                    </div>
                  </div>
                  {!vertical && (
                    <div style={{ height: FOOT, flexShrink: 0, display: 'flex', alignItems: 'flex-start', padding: '0 30px' }}>
                      {res.pass !== undefined && passBadge(res.pass, pb, 38)}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Judge stamp on the winner(s): on the badge row (16:9) or the card's right side (9:16) */}
            {frame >= round.stampF && round.winners.map((w) => {
              const k = round.results.findIndex((r) => r.who === w);
              if (k < 0) return null;
              const pos = cardPos(k);
              const fs = vertical ? 70 : 72;
              const at = vertical ? { left: pos.x + cardW - 330, top: pos.y + CH / 2 - 30 } : { left: pos.x + cardW - 220, top: pos.y + CH - 104 };
              return (
                <div
                  key={w}
                  style={{
                    position: 'absolute', ...at, transform: `rotate(-12deg) scale(${interpolate(st, [0, 1], [2.6, 1])})`, zIndex: 6,
                    opacity: Math.min(1, st * 2.5), fontFamily: theme.display, fontSize: fs, lineHeight: 1, color: theme.doodle, border: `8px solid ${theme.doodle}`,
                    borderRadius: 18, padding: '12px 22px 4px', background: 'rgba(17,18,21,.88)', whiteSpace: 'nowrap', boxShadow: `0 0 30px ${theme.doodle}55`,
                  }}
                >
                  승리!
                </div>
              );
            })}

            {/* +N flying to the winner's chip */}
            {round.winners.map((w) => {
              const k = round.results.findIndex((r) => r.who === w);
              const wi = idx(w);
              const a = round.flyF, b = round.tickF;
              if (k < 0 || frame < a || frame > b + 4) return null;
              const p = interpolate(frame, [a, b], [0, 1], { ...clamp, easing: (x) => x * x * (3 - 2 * x) });
              const pos = cardPos(k);
              const sx = pos.x + cardW / 2, sy = pos.y + 40;
              const ex = chipX(wi) + chipW - 40, ey = chipTop + chipH / 2;
              const x = sx + (ex - sx) * p;
              const y = sy + (ey - sy) * p - Math.sin(p * Math.PI) * 120;
              const col = contestants[wi].color;
              return (
                <div key={w} style={{ position: 'absolute', left: x, top: y, transform: `translate(-50%, -50%) scale(${1.4 - 0.6 * p})`, fontFamily: theme.display, fontSize: 80, color: col, textShadow: `0 0 24px ${col}`, opacity: frame > b ? 0 : 1, zIndex: 7 }}>
                  +{round.points}
                </div>
              );
            })}
          </AbsoluteFill>
        );
      })}

      {/* Final score board */}
      {final && frame >= finalF && (() => {
        const boxW = vertical ? Math.min(300, (barW - 30 * (nC - 1)) / nC) : Math.min(330, (1180 - 40 * (nC - 1)) / nC);
        const boxH = vertical ? 300 : 340; // 9:16: ends above the mascot's spot
        return (
          <div style={{ position: 'absolute', left: side, right: vertical ? side : 560, top: vertical ? 520 : 250, opacity: finalP, transform: `scale(${0.9 + 0.1 * finalP})` }}>
            <div style={{ textAlign: 'center', fontFamily: theme.display, fontSize: vertical ? 92 : 84, color: theme.accent, lineHeight: 1 }}>{final.label ?? '최종 스코어'}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: vertical ? 30 : 40, marginTop: 56 }}>
              {contestants.map((c, i) => {
                const p = spring({ frame: frame - finalF - 6 - i * 5, fps, config: { damping: 11 } });
                const lead = scores[i] === top;
                return (
                  <div
                    key={c.name + i}
                    style={{
                      width: boxW, height: boxH, borderRadius: 28, background: theme.panel, border: `4px solid ${lead ? c.color : theme.panelBorder}`,
                      boxShadow: lead ? `0 0 50px ${c.color}66` : undefined, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                      opacity: p, transform: `translateY(${(1 - p) * 60}px)`, position: 'relative',
                    }}
                  >
                    {lead && <div style={{ position: 'absolute', top: -34, fontFamily: theme.font, fontWeight: 900, fontSize: 30, color: '#16181D', background: c.color, borderRadius: 10, padding: '4px 16px', whiteSpace: 'nowrap' }}>{final.leadLabel ?? '선두'}</div>}
                    {badge(c, 64)}
                    <div style={{ fontFamily: theme.font, fontWeight: 800, fontSize: Math.min(44, (boxW - 30) / Math.max(1, em(c.name))), color: theme.bone, whiteSpace: 'nowrap', marginTop: 8 }}>{c.name}</div>
                    <div style={{ fontFamily: theme.display, fontSize: Math.min(200, boxW * 0.6, boxH * 0.5), lineHeight: 1, color: lead ? c.color : theme.muted }}>{scores[i]}</div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </AbsoluteFill>
  );
};
