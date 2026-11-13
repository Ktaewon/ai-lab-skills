import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { safeArea, theme, useLayout } from '../theme';
import type { Scene } from '../types';

// Guess quiz ("진짜 vs AI", "어느 쪽이 정답?"): 2 or 4 numbered image panels, a 3-2-1 countdown ring
// (scan line over the panels), then the reveal — each panel gets a slammed stamp (red for the
// target answer, green for the rest) — an explanation line with the clue words swept by the
// highlighter, and an optional running accuracy bar with its own stamp. Use it to make the viewer
// guess before the answer. Images and the answer key are real — never stage a fake answer.
//
// props: question, tag? ('진짜 vs AI': pill before the question; '' hides it)
//        items: [{src?, label, isAI, answerLabel?}]  2 or 4
//          src: image in public/ (missing → gradient "이미지 슬롯 n" placeholder) · label: caption strip
//          isAI: true = the target answer (red stamp), false = the other answer (green stamp)
//          answerLabel: stamp text (default 'AI' / '진짜') — e.g. '정답', '오답', '실제 사진'
//        countdown?: {from?}  3-2-1 starts (default ~22% into the scene)
//        reveal?: {from?}     stamps land (default 3 s after the countdown)
//        explain?: {text, highlights?: string[], from?}  clue line; highlights are substrings of text
//        accuracy?: {label, value (0-100), stamp?, from?}  bar fills to value, stamp slams when it lands
//        cta?: {before?, during?}  hand-written prompt under the panels before the reveal
//              (default '댓글에 번호 먼저 찍고 보기!' / '번호 골랐죠? 3초 드립니다')
// Timing: every `from` is a frame in the scene (prepare.py: say/at → from).
// Layout: 16:9 — 2 panels in a row with the ring between them, text below; 4 panels as a 2x2 grid on
// the left with the ring at the cross and the text in a right column (lower right free for the
// mascot). 9:16 — question under the hook, 2 panels side by side (or 2x2), text block below.
type Item = { src?: string; label: string; isAI: boolean; answerLabel?: string };
type Props = {
  question?: string; tag?: string; items?: Item[];
  countdown?: { from?: number }; reveal?: { from?: number };
  explain?: { text: string; highlights?: string[]; from?: number };
  accuracy?: { label: string; value: number; stamp?: string; from?: number };
  cta?: { before?: string; during?: string };
};

const RED = '#FF4D40';
const GREEN = '#39E58C';
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
const em = (s: string) => [...s].reduce((w, ch) => w + (/[ᄀ-퟿　-鿿]/.test(ch) ? 1 : ch === ' ' ? 0.3 : 0.6), 0);

export const QuizScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { vertical } = useLayout();
  const safe = safeArea(vertical);
  const p = scene.props as Props;
  const { question = '', tag = '진짜 vs AI', items = [], explain, accuracy } = p;
  const f = (s: number) => Math.round(s * fps);
  const n = items.length;
  const grid = n > 2; // 4 panels → 2x2

  // ---- timing -------------------------------------------------------------------------------
  const cdF = p.countdown?.from ?? Math.round(scene.frames * 0.22);
  const revF = Math.max(cdF + f(0.9), p.reveal?.from ?? cdF + f(3));
  const step = Math.min(f(1), Math.max(f(0.3), (revF - cdF) / 3)); // frames per number
  const explainF = explain?.from ?? revF + f(1.2);
  const accF = accuracy?.from ?? (explain ? Math.max(explainF, revF) + f(0.9) : revF + f(1.2));

  // ---- geometry -----------------------------------------------------------------------------
  const qFs = vertical ? 64 : 78;
  const qLines = vertical ? Math.max(1, Math.ceil((em(question) * qFs) / 940)) : 1;
  const PY = vertical ? 384 + qLines * qFs * 1.12 + 26 : 236;
  type Rect = { x: number; y: number; w: number; h: number };
  let rects: Rect[];
  let ring: { cx: number; cy: number; size: number };
  let text: { left: number; top: number; width: number };
  if (!vertical && !grid) {
    const pw = 560, ph = 420, gap = 220, rowW = pw * 2 + gap;
    rects = [0, 1].map((i) => ({ x: 960 - rowW / 2 + i * (pw + gap), y: PY, w: pw, h: ph }));
    ring = { cx: 960, cy: PY + ph / 2, size: 220 };
    text = { left: 290, top: PY + ph + 40, width: 1100 };
  } else if (!vertical) {
    const pw = 480, ph = 318, gap = 36;
    rects = [0, 1, 2, 3].map((i) => ({ x: 140 + (i % 2) * (pw + gap), y: PY + Math.floor(i / 2) * (ph + gap), w: pw, h: ph }));
    ring = { cx: 140 + pw + gap / 2, cy: PY + ph + gap / 2, size: 180 };
    text = { left: 140 + pw * 2 + gap + 70, top: PY + 30, width: 1780 - (140 + pw * 2 + gap + 70) };
  } else {
    const gap = 30, pw = (1080 - safe.side * 2 - gap) / 2, ph = grid ? 260 : 455;
    rects = Array.from({ length: grid ? 4 : 2 }, (_, i) => ({ x: safe.side + (i % 2) * (pw + gap), y: PY + Math.floor(i / 2) * (ph + gap), w: pw, h: ph }));
    ring = { cx: 540, cy: grid ? PY + ph + gap / 2 : PY + ph / 2, size: grid ? 170 : 190 };
    const bottom = rects[rects.length - 1].y + ph;
    text = { left: safe.side, top: bottom + 34, width: 1080 - safe.side * 2 };
  }

  const head = spring({ frame, fps, config: { damping: 14 } });
  const revealed = frame >= revF;
  const shake = interpolate(frame - revF, [0, 2, 14], [0, 1, 0], clamp) * 12 * Math.sin(frame * 3.1);

  // Countdown: 3 → 2 → 1 (one `step` each), then '!' until the reveal.
  const cdNum = 3 - Math.floor((frame - cdF) / step);
  const counting = frame >= cdF && cdNum >= 1 && frame < revF;
  const secF = cdF + step * (3 - cdNum);
  const ringStart = Math.max(0, Math.min(cdF - 15, f(1.2)));
  const ringIn = spring({ frame: frame - ringStart, fps, config: { damping: 13 } });
  const ringOut = spring({ frame: frame - revF + 4, fps, config: { damping: 200 } });

  const textFs = vertical ? 42 : grid ? 46 : 38;
  const cta = { before: '댓글에 번호 먼저 찍고 보기!', during: '번호 골랐죠? 3초 드립니다', ...(p.cta ?? {}) };

  return (
    <AbsoluteFill style={{ transform: `translateX(${shake}px)` }}>
      {/* Question */}
      <div
        style={{
          position: 'absolute', left: vertical ? safe.side : 140, right: vertical ? safe.side : 140, top: vertical ? 318 : 104, textAlign: grid && !vertical ? 'left' : 'center',
          opacity: head, transform: `translateY(${(1 - head) * -30}px)`, wordBreak: 'keep-all',
        }}
      >
        {tag && (
          <span
            style={{
              fontFamily: theme.font, fontWeight: 800, fontSize: vertical ? 36 : 30, color: '#16181D', background: theme.accent, borderRadius: 10, padding: '4px 14px',
              marginRight: vertical ? 0 : 22, verticalAlign: 'middle', display: vertical ? 'inline-block' : 'inline', marginBottom: vertical ? 14 : 0,
            }}
          >
            {tag}
          </span>
        )}
        {vertical && <br />}
        <span style={{ fontFamily: theme.display, fontSize: qFs, color: theme.bone, verticalAlign: 'middle', lineHeight: 1.12 }}>{question}</span>
      </div>

      {/* Panels */}
      {items.slice(0, rects.length).map((it, i) => {
        const r = rects[i];
        const outer = vertical || grid ? (i % 2 === 0 ? 'left' : 'right') : 'left';
        const pIn = spring({ frame: frame - f(0.4 + i * 0.3), fps, config: { damping: 13, mass: 0.8 } });
        const stampF = revF + (it.isAI ? 0 : f(0.5));
        const st = spring({ frame: frame - stampF, fps, config: { damping: 9, stiffness: 210 } });
        const showStamp = frame >= stampF;
        const col = it.isAI ? RED : GREEN;
        const answer = it.answerLabel ?? (it.isAI ? 'AI' : '진짜');
        const stampFs = Math.min((it.isAI ? 150 : 120) * (r.w / 560), (r.w * 0.66) / Math.max(1, em(answer)), r.h * 0.34);
        const scanY = counting ? ((frame - cdF) % f(1.5)) / f(1.5) : -1;
        const labelFs = vertical ? 34 : grid ? 28 : 32;
        return (
          <div key={i} style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, opacity: Math.min(1, pIn * 1.6), transform: `translateY(${(1 - pIn) * 60}px) rotate(${(1 - pIn) * (i % 2 ? 4 : -4)}deg)` }}>
            <div
              style={{
                position: 'absolute', inset: 0, borderRadius: 22, overflow: 'hidden', border: `5px solid ${showStamp ? col : theme.panelBorder}`, background: '#0E0F12',
                boxShadow: showStamp ? `0 0 ${40 * st}px ${col}66, 0 20px 50px rgba(0,0,0,.5)` : '0 20px 50px rgba(0,0,0,.5)',
              }}
            >
              {it.src ? (
                <Img src={/^https?:/.test(it.src) ? it.src : staticFile(it.src)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: revealed && !showStamp ? 'brightness(0.8)' : undefined }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, #3A3C44, #23252C 55%, ${theme.accent}55)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.font, fontWeight: 700, fontSize: 32, color: theme.muted }}>
                  이미지 슬롯 {i + 1}
                </div>
              )}
              {scanY >= 0 && (
                <div style={{ position: 'absolute', left: 0, right: 0, top: `${scanY * 100}%`, height: 6, background: theme.accent, boxShadow: `0 0 24px 6px ${theme.accent}88`, opacity: 0.7 }} />
              )}
              <div
                style={{
                  position: 'absolute', left: 0, right: 0, bottom: 0, padding: '40px 22px 14px', background: 'linear-gradient(transparent, rgba(0,0,0,.8))',
                  fontFamily: theme.font, fontWeight: 700, fontSize: labelFs, color: '#fff', textAlign: outer, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {it.label}
              </div>
            </div>
            {/* Number badge on the outer top corner */}
            <div
              style={{
                position: 'absolute', [outer]: -22, top: -22, width: 76, height: 76, borderRadius: 38, background: theme.accent, border: `5px solid ${theme.ink}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.display, fontSize: 46, color: '#16181D',
              }}
            >
              {i + 1}
            </div>
            {showStamp && (
              <div
                style={{
                  position: 'absolute', left: '50%', top: '44%', transform: `translate(-50%, -50%) rotate(${it.isAI ? -12 : 8}deg) scale(${interpolate(st, [0, 1], [2.6, 1])})`,
                  opacity: Math.min(1, st * 2.5), fontFamily: theme.display, fontSize: stampFs, lineHeight: 1, color: col, border: `${Math.max(6, stampFs / 13)}px solid ${col}`, borderRadius: 24,
                  padding: `${stampFs * 0.08}px ${stampFs * 0.24}px ${stampFs * 0.03}px`, background: 'rgba(14,15,18,.72)', whiteSpace: 'nowrap', textShadow: `0 0 30px ${col}66`,
                }}
              >
                {answer}
              </div>
            )}
          </div>
        );
      })}

      {/* Countdown ring (VS before it starts) */}
      {(() => {
        const S = ring.size, R = S * 0.39, C = 2 * Math.PI * R;
        const prog = counting ? 1 - (frame - secF) / step : frame < cdF ? 1 : 0;
        const slam = counting ? spring({ frame: frame - secF, fps, config: { damping: 9, stiffness: 220 } }) : 1;
        const s = ringIn * (1 - ringOut);
        if (s <= 0.001) return null;
        return (
          <div style={{ position: 'absolute', left: ring.cx - S / 2, top: ring.cy - S / 2, width: S, height: S, transform: `scale(${s})`, zIndex: 5 }}>
            <svg width={S} height={S} style={{ position: 'absolute', inset: 0 }}>
              <circle cx={S / 2} cy={S / 2} r={S / 2 - 6} fill={theme.panel} stroke={theme.panelBorder} strokeWidth={3} />
              <circle cx={S / 2} cy={S / 2} r={R} fill="none" stroke="#2C2F37" strokeWidth={S * 0.064} />
              <circle cx={S / 2} cy={S / 2} r={R} fill="none" stroke={cdNum === 1 && counting ? RED : theme.accent} strokeWidth={S * 0.064} strokeLinecap="round"
                strokeDasharray={C} strokeDashoffset={C * (1 - prog)} transform={`rotate(-90 ${S / 2} ${S / 2})`} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.display, color: theme.bone, fontSize: counting ? S * 0.55 : S * 0.29, transform: `scale(${interpolate(slam, [0, 1], [1.8, 1])})`, opacity: Math.min(1, slam * 2) }}>
              {counting ? cdNum : frame < cdF ? 'VS' : '!'}
            </div>
          </div>
        );
      })()}

      {/* Text block: prompt before the reveal, then explanation + accuracy */}
      <div style={{ position: 'absolute', left: text.left, top: text.top, width: text.width, display: 'flex', flexDirection: 'column', gap: vertical ? 26 : 30 }}>
        {frame < revF && (() => {
          const a = spring({ frame: frame - f(1.0), fps, config: { damping: 14 } });
          const out = interpolate(frame, [revF - 6, revF], [1, 0], clamp);
          return (
            <div style={{ position: 'absolute', left: 0, right: 0, top: 0, textAlign: grid && !vertical ? 'left' : 'center', opacity: a * out, fontFamily: theme.hand, fontSize: vertical ? 64 : 60, color: theme.postit, wordBreak: 'keep-all', lineHeight: 1.1 }}>
              {frame >= cdF ? cta.during : cta.before}
            </div>
          );
        })()}

        {explain && frame >= explainF && (() => {
          const a = spring({ frame: frame - explainF, fps, config: { damping: 14 } });
          const parts: React.ReactNode[] = [];
          let rest = explain.text;
          let k = 0;
          const hl = (explain.highlights ?? []).filter(Boolean);
          while (rest.length) {
            const hits = hl.map((c) => ({ c, at: rest.indexOf(c) })).filter((h) => h.at >= 0).sort((x, y) => x.at - y.at);
            if (!hits.length) { parts.push(rest); break; }
            const h = hits[0];
            parts.push(rest.slice(0, h.at));
            const sweep = interpolate(frame - explainF - 8 - k * 8, [0, 12], [0, 1], clamp);
            parts.push(
              <span key={k} style={{ backgroundImage: `linear-gradient(${theme.caption}, ${theme.caption})`, backgroundSize: `${sweep * 100}% 80%`, backgroundPosition: '0 60%', backgroundRepeat: 'no-repeat', color: sweep > 0.5 ? '#16181D' : undefined, borderRadius: 6, padding: '0 6px', boxDecorationBreak: 'clone', WebkitBoxDecorationBreak: 'clone' }}>
                {h.c}
              </span>,
            );
            rest = rest.slice(h.at + h.c.length);
            k++;
          }
          return (
            <div style={{ opacity: a, transform: `translateY(${(1 - a) * 20}px)`, fontFamily: theme.font, fontWeight: 700, fontSize: textFs, lineHeight: 1.4, color: theme.bone, wordBreak: 'keep-all' }}>
              {parts}
            </div>
          );
        })()}

        {accuracy && frame >= accF && (() => {
          const a = spring({ frame: frame - accF, fps, config: { damping: 15 } });
          const value = Math.max(0, Math.min(100, accuracy.value));
          const fill = interpolate(frame - accF - 6, [0, 30], [0, value], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 3) });
          const done = frame - accF - 6 >= 30;
          const pop = spring({ frame: frame - accF - 36, fps, config: { damping: 8, stiffness: 200 } });
          const barW = vertical ? text.width : Math.min(880, text.width);
          // Stamp sits in the label row between label and number when it fits, else under the bar.
          const labelFs = vertical ? 34 : 30;
          const stampFs = vertical ? 54 : 52;
          const stampW = em(accuracy.stamp ?? '') * stampFs + 60;
          const inRow = em(accuracy.label) * labelFs + 40 + stampW + 190 <= barW;
          const stampPos: React.CSSProperties = inRow ? { left: em(accuracy.label) * labelFs + 40, top: -14 } : { left: 0, top: 130 };
          return (
            <div style={{ position: 'relative', width: barW, opacity: a, transform: `translateY(${(1 - a) * 20}px)` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <span style={{ fontFamily: theme.font, fontWeight: 700, fontSize: labelFs, color: theme.muted }}>{accuracy.label}</span>
                <span style={{ fontFamily: theme.display, fontSize: vertical ? 64 : 58, color: done ? theme.accent : theme.bone, display: 'inline-block', transform: done ? `scale(${1 + (1 - pop) * 0.4})` : undefined, transformOrigin: '100% 80%' }}>
                  {Math.round(fill)}%
                </span>
              </div>
              <div style={{ height: 30, borderRadius: 15, background: theme.barMuted, overflow: 'hidden' }}>
                <div style={{ width: `${fill}%`, height: '100%', borderRadius: 15, background: `linear-gradient(90deg, ${theme.accent}AA, ${theme.accent})`, boxShadow: `0 0 20px ${theme.accent}88` }} />
              </div>
              {accuracy.stamp && done && (
                <div
                  style={{
                    position: 'absolute', ...stampPos, transform: `rotate(-8deg) scale(${interpolate(pop, [0, 1], [2.4, 1])})`, opacity: Math.min(1, pop * 2.5), transformOrigin: '50% 50%',
                    fontFamily: theme.display, fontSize: stampFs, color: RED, border: `7px solid ${RED}`, borderRadius: 16, padding: '4px 20px 0', whiteSpace: 'nowrap',
                    background: 'rgba(27,28,33,.88)', boxShadow: `0 0 30px ${RED}44`,
                  }}
                >
                  {accuracy.stamp}
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </AbsoluteFill>
  );
};
