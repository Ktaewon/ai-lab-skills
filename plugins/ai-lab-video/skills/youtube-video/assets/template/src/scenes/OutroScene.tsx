import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Enter } from '../components/Enter';
import { safeArea, theme, useLayout } from '../theme';
import type { Scene } from '../types';

// props: heading, sub?, cta? (button text, default '구독'), stats?: { value, unit, label, highlight? }[]
export const OutroScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { vertical } = useLayout();
  const safe = safeArea(vertical);
  const { heading, sub, cta = '구독', stats = [] } = scene.props;
  const press = spring({ frame: frame - 50, fps, config: { damping: 10 } });
  const pressed = frame > 58;

  return (
    <AbsoluteFill style={{ color: theme.bone, fontFamily: theme.font, padding: `${safe.top}px ${safe.side}px ${safe.bottom}px`, justifyContent: 'center' }}>
      <Enter>
        <div style={{ fontFamily: theme.display, fontSize: vertical ? 84 : 88, lineHeight: 1.1 }}>{heading}</div>
      </Enter>
      {sub && (
        <Enter delay={8}>
          <div style={{ fontSize: 42, color: theme.muted, marginTop: 24 }}>{sub}</div>
        </Enter>
      )}
      {(stats as { value: number; unit: string; label: string; highlight?: boolean }[]).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 50 }}>
          {(stats as { value: number; unit: string; label: string; highlight?: boolean }[]).map((s, i) => {
            const p = spring({ frame: frame - 14 - i * 8, fps, config: { damping: 200 } });
            const v = s.value % 1 === 0 ? Math.round(s.value * p) : (s.value * p).toFixed(1);
            return (
              <div key={s.label} style={{ display: 'flex', alignItems: 'baseline', gap: 24, opacity: p }}>
                <div style={{ fontSize: 64, fontWeight: 800, color: s.highlight ? theme.accent : theme.bone, fontVariantNumeric: 'tabular-nums' }}>
                  {v}
                  <span style={{ fontSize: 34 }}>{s.unit}</span>
                </div>
                <div style={{ fontSize: 38, color: theme.muted }}>{s.label}</div>
              </div>
            );
          })}
        </div>
      )}
      <Enter delay={40}>
        <div
          style={{
            marginTop: 60, display: 'inline-block', fontSize: 46, fontWeight: 800, padding: '20px 54px', borderRadius: 999,
            background: pressed ? theme.barMuted : '#ff0033', color: '#fff', transform: `scale(${1 - 0.08 * Math.sin(Math.min(1, press) * Math.PI)})`,
          }}
        >
          {pressed ? `${cta}중` : cta}
        </div>
      </Enter>
    </AbsoluteFill>
  );
};
