import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { MarkedText } from '../components/Marker';
import { Enter } from '../components/Enter';
import { safeArea, theme, useLayout } from '../theme';
import type { Scene } from '../types';

// props: heading, unit?, bars: { label, value, highlight? }[], source? (small note under the chart)
// Horizontal bars read well in both 16:9 and 9:16. One accent: only highlighted bars get the brand colour.
// Values must be real measurements — say where they came from in `source`.
export const ChartScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { vertical } = useLayout();
  const safe = safeArea(vertical);
  const { heading, unit = '', bars = [], source } = scene.props;
  const max = Math.max(...(bars as { value: number }[]).map((b) => b.value), 1);
  const fmt = (v: number) => (Math.abs(v) >= 100 || v % 1 === 0 ? Math.round(v).toLocaleString() : v.toFixed(1));

  return (
    <AbsoluteFill style={{ color: theme.bone, fontFamily: theme.font, padding: `${safe.top}px ${safe.side}px ${safe.bottom}px`, justifyContent: 'center' }}>
      <Enter>
        <div style={{ fontFamily: theme.display, fontSize: vertical ? 76 : 84, lineHeight: 1.1 }}>{heading}</div>
      </Enter>
      <div style={{ marginTop: 64, display: 'flex', flexDirection: 'column', gap: vertical ? 44 : 36 }}>
        {(bars as { label: string; value: number; highlight?: boolean }[]).map((b, i) => {
          const p = spring({ frame: frame - 15 - i * 8, fps, config: { damping: 200, mass: 1.4 } });
          const color = b.highlight ? theme.accent : theme.barMuted;
          // winner flourish: glow, one light sweep across the bar, a bouncy "1위" badge with a burst
          const t0 = 15 + bars.length * 8 + 30;
          const win = interpolate(frame, [t0, t0 + 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const shine = interpolate(frame, [t0, t0 + 28], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic) });
          const badge = spring({ frame: frame - t0 - 8, fps, config: { damping: 9, mass: 0.9, stiffness: 140 } });
          const burst = interpolate(frame, [t0 + 8, t0 + 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
          return (
            <div key={b.label} style={{ display: vertical ? 'block' : 'flex', alignItems: 'center', gap: 30 }}>
              <div style={{ width: vertical ? 'auto' : 320, fontSize: 42, color: b.highlight ? theme.bone : theme.muted, marginBottom: vertical ? 12 : 0 }}><MarkedText text={b.label} /></div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 22 }}>
                <div style={{ position: 'relative', overflow: 'hidden', height: vertical ? 64 : 70, width: `${(b.value / max) * (vertical ? 62 : 64) * p}%`, flexShrink: 0, background: color, borderRadius: 10, minWidth: 6,
                  boxShadow: b.highlight ? `0 0 ${28 * win}px rgba(255,106,61,${0.55 * win})` : undefined }}>
                  {b.highlight && (
                    <div style={{ position: 'absolute', top: 0, bottom: 0, width: '30%', left: `${shine * 140 - 35}%`,
                      background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.55), transparent)' }} />
                  )}
                </div>
                <div style={{ whiteSpace: 'nowrap', fontSize: 48, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: b.highlight ? theme.bone : theme.muted, opacity: p }}>
                  {fmt(b.value * p)}
                  <span style={{ fontSize: 30, marginLeft: 6, fontWeight: 600 }}>{unit}</span>
                </div>
                {b.highlight && badge > 0.01 && (
                  <div style={{ position: 'relative', width: 84, height: 84, flexShrink: 0 }}>
                    {Array.from({ length: 10 }, (_, k) => (
                      <div key={k} style={{ position: 'absolute', left: 40, top: 40, width: 4, height: 20, borderRadius: 2, background: theme.caption,
                        opacity: interpolate(burst, [0, 0.4, 1], [0, 1, 0]),
                        transform: `rotate(${k * 36}deg) translateY(${-40 - 34 * burst}px)` }} />
                    ))}
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: theme.caption, color: '#151515', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: theme.display, fontSize: 34, transform: `scale(${badge}) rotate(${(1 - badge) * -40 - 8}deg)`, boxShadow: '0 6px 0 rgba(0,0,0,0.35)' }}>1위</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {source && (
        <Enter delay={40}>
          <div style={{ marginTop: 48, fontSize: 28, color: theme.muted }}>{source}</div>
        </Enter>
      )}
    </AbsoluteFill>
  );
};
