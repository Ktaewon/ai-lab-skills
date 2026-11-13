import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { safeArea, theme, useLayout } from '../theme';
import type { Scene } from '../types';

// Tier list board: rows (S, A, B …), item chips slide into their row one at a time, with a short
// hand-written verdict next to the chip just placed and a "배치 완료 n / N" counter. The surprise:
// an item with `fakeTier` first lands in that (wrong) row, sits there a beat, then jumps into its
// real `tier` on its own cue, with a stamp and a board shake. Use it for "이거 몇 티어?" rankings of
// tools/models/products. Verdicts are the creator's real opinion — don't invent them.
//
// props: title, subtitle?,
//        tiers: [{label, color}]  (top to bottom; 3–6 rows)
//        items: [{name, tier, note?, from?, color?, badge?, fakeTier?, move?: {from?}}]
//          name: chip text · tier: row label it ends in · note: verdict shown when it lands
//          color: chip accent (default theme.accent) · badge: 1–2 letters on the chip (default name[0..2])
//          fakeTier: row it first lands in (the fake-out); move.from: when it jumps to `tier`
//                    (default ~1 s after it lands)
//        stamp?: {text, from?}  slammed when the fake-out item reaches its real tier (default: on the move)
// Timing: every `from` is a frame in the scene (prepare.py: say/at → from). Items without `from`
// are spread evenly over the scene.
// Layout: 16:9 — board on the left, counter top right, verdict next to the chip, lower right free
// for the mascot. 9:16 — title + counter under the hook, full-width board, verdict strip below it.
type Tier = { label: string; color: string };
type Item = {
  name: string; tier: string; note?: string; from?: number; color?: string; badge?: string;
  fakeTier?: string; move?: { from?: number };
};
type Props = { title?: string; subtitle?: string; tiers?: Tier[]; items?: Item[]; stamp?: { text: string; from?: number } };

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;
// Rough rendered width of a string in em: Hangul ≈ 1, latin/digits ≈ 0.6, space ≈ 0.3.
const em = (s: string) => [...s].reduce((w, ch) => w + (/[ᄀ-퟿　-鿿]/.test(ch) ? 1 : ch === ' ' ? 0.3 : 0.6), 0);

export const TierScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { vertical } = useLayout();
  const safe = safeArea(vertical);
  const { title = '', subtitle, tiers = [], items: rawItems = [], stamp } = scene.props as Props;
  const W = vertical ? 1080 : 1920;

  // ---- timing -------------------------------------------------------------------------------
  const hasFake = rawItems.some((it) => it.fakeTier);
  const t0 = fps * 1;
  const t1 = scene.frames - fps * (hasFake ? 2.6 : 1.5);
  const items = rawItems.map((it, i) => {
    const from = it.from ?? Math.round(rawItems.length <= 1 ? t0 : t0 + ((t1 - t0) * i) / (rawItems.length - 1));
    const fake = it.fakeTier && it.fakeTier !== it.tier ? it.fakeTier : undefined;
    const moveF = fake ? Math.max(from + 12, it.move?.from ?? from + Math.round(fps * 1.0)) : -1;
    // land = when the chip settles in its final row (it counts as placed from then on)
    const land = fake ? moveF + Math.round(fps * 0.25) : from + Math.round(fps * 0.3);
    return { ...it, from, fake, moveF, land };
  });
  type It = (typeof items)[number];
  const tierIdx = (label?: string) => Math.max(0, tiers.findIndex((x) => x.label === label));

  // ---- geometry -----------------------------------------------------------------------------
  const n = Math.max(1, tiers.length);
  const board = vertical
    ? { left: safe.side, top: 480, width: W - safe.side * 2, maxBottom: 1090, labelW: 112 }
    : { left: 140, top: 236, width: 1170, maxBottom: 1080 - safe.bottom, labelW: 150 };
  const gap = 10;
  const rowH = Math.min(vertical ? 118 : 122, (board.maxBottom - board.top - gap * (n - 1)) / n);
  const rowY = (i: number) => board.top + i * (rowH + gap);
  const boardBottom = rowY(n - 1) + rowH;
  const trackX = board.left + board.labelW + 16;
  const trackW = board.width - board.labelW - 30;

  // Slots: a row is ordered by landing time; a fake-out chip waits after the row's regular chips.
  const finalSlot = new Map<It, number>();
  const fakeSlot = new Map<It, number>();
  tiers.forEach((tr) => {
    const inRow = items.filter((it) => it.tier === tr.label).sort((a, b) => a.land - b.land);
    inRow.forEach((it, k) => finalSlot.set(it, k));
    items.filter((it) => it.fake === tr.label).forEach((it, k) => fakeSlot.set(it, inRow.filter((o) => !o.fake).length + k));
  });
  const perRow = Math.max(3, ...tiers.map((tr) => Math.max(
    items.filter((it) => it.tier === tr.label).length,
    items.filter((it) => it.tier === tr.label && !it.fake).length + items.filter((it) => it.fake === tr.label).length,
  )));
  const chipGap = 14;
  const chipW = Math.min(vertical ? 270 : 236, (trackW - chipGap * (perRow - 1)) / perRow);
  const chipH = Math.min(92, rowH - 22);
  const slotPos = (row: number, slot: number) => ({ x: trackX + slot * (chipW + chipGap), y: rowY(row) + (rowH - chipH) / 2 });
  const finalPos = (it: It) => slotPos(tierIdx(it.tier), finalSlot.get(it) ?? 0);
  const badgeS = Math.min(58, chipH - 30);
  const nameFs = (name: string) => Math.max(18, Math.min(vertical ? 36 : 34, (chipW - badgeS - 44) / Math.max(1, em(name))));

  // ---- state --------------------------------------------------------------------------------
  const placed = items.filter((it) => frame >= it.land).length;
  // The chip whose verdict is shown: the last one placed, until another chip starts moving.
  const lastLanded = [...items].sort((a, b) => a.land - b.land).reverse().find((it) => frame >= it.land + 2);
  const current = lastLanded && !items.some((it) => it !== lastLanded && frame >= it.from && it.from > lastLanded.land) ? lastLanded : undefined;
  const latest = [...items].sort((a, b) => a.from - b.from).reverse().find((it) => frame >= it.from);
  const litRow = latest ? tierIdx(latest.fake && frame < latest.moveF ? latest.fake : latest.tier) : -1;

  const surprise = items.find((it) => it.fake);
  const stampF = surprise ? (stamp?.from ?? surprise.moveF + Math.round(fps * 0.2)) : -1;
  const shake = stamp && surprise ? interpolate(frame - stampF, [0, 2, 14], [0, 1, 0], clamp) * 12 * Math.sin(frame * 2.9) : 0;

  const titleIn = spring({ frame, fps, config: { damping: 14 } });
  const rowIn = (i: number) => spring({ frame: frame - 4 - i * 3, fps, config: { damping: 15 } });
  const words = title.split(' ');

  return (
    <AbsoluteFill style={{ transform: `translateX(${shake}px)` }}>
      {/* Title (last word in the accent) + subtitle */}
      <div
        style={{
          position: 'absolute', left: board.left, top: vertical ? 322 : 104, width: vertical ? 680 : 1250, opacity: titleIn,
          transform: `translateY(${(1 - titleIn) * -30}px)`, display: 'flex', flexDirection: vertical ? 'column' : 'row',
          alignItems: vertical ? 'flex-start' : 'baseline', gap: vertical ? 10 : 28,
        }}
      >
        <div style={{ fontFamily: theme.display, fontSize: vertical ? 74 : 84, color: theme.bone, lineHeight: 1.05, wordBreak: 'keep-all', whiteSpace: vertical ? 'normal' : 'nowrap' }}>
          {words.map((w, i) => (
            <span key={i} style={{ color: i === words.length - 1 && words.length > 1 ? theme.accent : theme.bone }}>{w}{i < words.length - 1 ? ' ' : ''}</span>
          ))}
        </div>
        {subtitle && (
          <div style={{ fontFamily: theme.font, fontWeight: 600, fontSize: vertical ? 32 : 30, color: theme.muted, opacity: interpolate(frame, [10, 22], [0, 1], clamp), whiteSpace: 'nowrap' }}>
            {subtitle}
          </div>
        )}
      </div>

      {/* Counter (title band, right) */}
      <div style={{ position: 'absolute', right: vertical ? safe.side : 140, top: vertical ? 318 : 96, textAlign: 'right', opacity: titleIn }}>
        <div style={{ fontFamily: theme.font, fontWeight: 700, fontSize: vertical ? 28 : 26, color: theme.muted, letterSpacing: 2 }}>배치 완료</div>
        <div style={{ fontFamily: theme.display, fontSize: vertical ? 80 : 84, color: theme.bone, lineHeight: 1.05, whiteSpace: 'nowrap' }}>
          <span style={{ color: theme.accent }}>{placed}</span>
          <span style={{ color: theme.muted, fontSize: vertical ? 54 : 58 }}> / {items.length}</span>
        </div>
      </div>

      {/* Rows */}
      {tiers.map((tier, i) => {
        const p = rowIn(i);
        // Glow when a chip lands in this row (fake landing included).
        const hits = items.flatMap((it) => [
          ...(tierIdx(it.tier) === i ? [it.land] : []),
          ...(it.fake && tierIdx(it.fake) === i ? [it.from + Math.round(fps * 0.3)] : []),
        ]).filter((f) => frame >= f);
        const hitF = hits.length ? Math.max(...hits) : -999;
        const flash = interpolate(frame - hitF, [0, 3, 22], [0, 1, 0], clamp);
        return (
          <div key={tier.label + i} style={{ position: 'absolute', left: board.left, top: rowY(i), width: board.width, height: rowH, opacity: p, transform: `translateX(${(1 - p) * -80}px)` }}>
            <div
              style={{
                position: 'absolute', inset: 0, borderRadius: 18, background: theme.panel, border: `2px solid ${i === litRow ? tier.color + '88' : theme.panelBorder}`,
                boxShadow: flash > 0 ? `0 0 ${50 * flash}px ${tier.color}66, inset 0 0 ${60 * flash}px ${tier.color}22` : undefined,
              }}
            />
            <div
              style={{
                position: 'absolute', left: 0, top: 0, width: board.labelW, height: rowH, borderRadius: '18px 0 0 18px', background: tier.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.display, fontSize: Math.min(78, rowH * 0.64), color: '#16181D',
              }}
            >
              {tier.label}
            </div>
          </div>
        );
      })}

      {/* Chips */}
      {items.map((it, i) => {
        if (frame < it.from) return null;
        const target = finalPos(it);
        const color = it.color ?? theme.accent;
        let x = target.x, y = target.y, rot = 0, op = 1, scale = 1;
        if (it.fake) {
          // Lands in the fake row, wobbles, then jumps (arc + pop) into the real one.
          const fake = slotPos(tierIdx(it.fake), fakeSlot.get(it) ?? 0);
          const a = spring({ frame: frame - it.from, fps, config: { damping: 13 } });
          const b = spring({ frame: frame - it.moveF, fps, config: { damping: 11, stiffness: 140 } });
          const wob = frame < it.moveF ? Math.sin((frame - it.from) * 0.9) * 3 * Math.min(1, (frame - it.from) / 10) : 0;
          const arc = Math.sin(Math.min(1, b) * Math.PI);
          x = interpolate(a, [0, 1], [fake.x + 520, fake.x]) + (target.x - fake.x) * b;
          y = fake.y + (target.y - fake.y) * b - arc * 60;
          rot = (1 - a) * 10 + wob + (b > 0 && b < 1 ? (1 - b) * -8 : 0);
          op = Math.min(1, a * 2);
          scale = 1 + arc * 0.18;
        } else {
          const a = spring({ frame: frame - it.from, fps, config: { damping: 12, mass: 0.8 } });
          x = target.x + (1 - a) * 560;
          y = target.y - (1 - a) * 70;
          rot = (1 - a) * 9;
          op = Math.min(1, a * 2);
        }
        const isCurrent = current === it;
        return (
          <div
            key={i}
            style={{
              position: 'absolute', left: x, top: y, width: chipW, height: chipH, borderRadius: 18, opacity: op,
              background: '#262830', border: `3px solid ${isCurrent ? color : '#3A3D46'}`, display: 'flex', alignItems: 'center', gap: 12, padding: '0 14px',
              boxShadow: isCurrent ? `0 10px 30px rgba(0,0,0,.5), 0 0 24px ${color}55` : '0 6px 16px rgba(0,0,0,.4)',
              transform: `rotate(${rot}deg) scale(${scale})`, zIndex: it.fake ? 5 : 2, overflow: 'hidden',
            }}
          >
            <div style={{ width: badgeS, height: badgeS, flexShrink: 0, borderRadius: 14, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: theme.display, fontSize: badgeS * 0.5, color: '#16181D' }}>
              {it.badge ?? it.name.slice(0, 2)}
            </div>
            <div style={{ fontFamily: theme.font, fontWeight: 800, fontSize: nameFs(it.name), color: theme.bone, whiteSpace: 'nowrap' }}>{it.name}</div>
          </div>
        );
      })}

      {/* Verdict for the chip just placed: next to it (16:9) or in a strip under the board (9:16) */}
      {current && current.note && (() => {
        const p = finalPos(current);
        const a = spring({ frame: frame - current.land - 2, fps, config: { damping: 14 } });
        const tier = tiers[tierIdx(current.tier)];
        const pill = <div style={{ fontFamily: theme.display, fontSize: vertical ? 34 : 26, color: '#16181D', background: tier?.color, borderRadius: 8, padding: '4px 10px', flexShrink: 0 }}>{tier?.label}</div>;
        if (vertical) {
          return (
            <div key={current.name} style={{ position: 'absolute', left: safe.side, top: boardBottom + 28, width: 690, display: 'flex', alignItems: 'center', gap: 14, opacity: a, transform: `translateY(${(1 - a) * 20}px)` }}>
              {pill}
              <div style={{ fontFamily: theme.font, fontWeight: 800, fontSize: 40, color: theme.bone, whiteSpace: 'nowrap' }}>{current.name}</div>
              <div style={{ fontFamily: theme.hand, fontSize: 62, color: theme.postit, lineHeight: 1.05, wordBreak: 'keep-all' }}>{current.note}</div>
            </div>
          );
        }
        return (
          <div key={current.name} style={{ position: 'absolute', left: p.x + chipW + 22, top: p.y, height: chipH, display: 'flex', alignItems: 'center', gap: 10, opacity: a, transform: `translateX(${(1 - a) * -24}px)`, zIndex: 6 }}>
            <svg width="34" height="24" viewBox="0 0 34 24" style={{ flexShrink: 0 }}>
              <path d="M32 12 H4 M14 2 L3 12 L14 22" fill="none" stroke={theme.doodle} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{ fontFamily: theme.hand, fontSize: 54, color: theme.postit, whiteSpace: 'nowrap', lineHeight: 1 }}>{current.note}</div>
            {pill}
          </div>
        );
      })()}

      {/* Stamp when the fake-out item reaches its real tier */}
      {surprise && stamp && frame >= stampF && (() => {
        const s = spring({ frame: frame - stampF, fps, config: { damping: 9, stiffness: 200 } });
        const pos: React.CSSProperties = vertical ? { right: safe.side - 10, top: rowY(tierIdx(surprise.tier)) - 22 } : { right: 150, top: 330 };
        return (
          <div style={{ position: 'absolute', ...pos, transform: `rotate(-7deg) scale(${interpolate(s, [0, 1], [2.4, 1])})`, opacity: Math.min(1, s * 2), zIndex: 8 }}>
            <div style={{ fontFamily: theme.display, fontSize: vertical ? 56 : 80, color: theme.doodle, border: `8px solid ${theme.doodle}`, borderRadius: 18, padding: '6px 28px', background: 'rgba(27,28,33,.82)', whiteSpace: 'nowrap', boxShadow: `0 0 40px ${theme.doodle}44` }}>
              {stamp.text}
            </div>
          </div>
        );
      })()}
    </AbsoluteFill>
  );
};
