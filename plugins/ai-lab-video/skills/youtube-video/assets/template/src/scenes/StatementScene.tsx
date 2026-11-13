import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { Enter } from '../components/Enter';
import { safeArea, theme, useLayout } from '../theme';
import type { Scene } from '../types';
import { MarkedText } from '../components/Marker';

// props: kicker?, heading: string | string[], bullets?: string[], tone?: 'dark' | 'light'
// Bullets are revealed across the narration so each lands roughly when it is spoken.
export const StatementScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const { vertical } = useLayout();
  const { kicker, heading, bullets = [], tone = 'dark', bigNumber } = scene.props;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // section opener flourish: a giant outlined number slides in, an accent line wipes under the kicker
  const numIn = spring({ frame: frame - 2, fps, config: { damping: 16, mass: 1.3 } });
  const wipe = interpolate(frame, [6, 26], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
  const safe = safeArea(vertical);
  const dark = tone !== 'light';
  // Background comes from the Stage (graphite, or the light stage when tone is 'light').
  const fg = dark ? theme.bone : theme.ink;
  const lines: string[] = Array.isArray(heading) ? heading : [heading];
  const caps = scene.captions.long;
  const speakEnd = caps.length ? caps[caps.length - 1].to : scene.frames;
  const bulletAt = (i: number) => 20 + Math.round(((speakEnd - 20) * (i + 0.5)) / Math.max(1, bullets.length + 0.5));

  return (
    <AbsoluteFill
      style={{
        color: fg, fontFamily: theme.font,
        padding: `${safe.top}px ${safe.side}px ${safe.bottom}px`, justifyContent: 'center',
      }}
    >
      {bigNumber && (
        <div style={{ position: 'absolute', right: vertical ? 40 : 110, top: vertical ? 200 : 90, fontFamily: theme.display, fontSize: vertical ? 420 : 560, lineHeight: 1,
          color: 'transparent', WebkitTextStroke: `4px ${theme.accent}`, opacity: 0.32 * numIn, transform: `translateX(${(1 - numIn) * 260}px)` }}>
          {bigNumber}
        </div>
      )}
      {kicker && (
        <Enter>
          <div style={{ fontSize: 38, fontWeight: 700, color: theme.accent, marginBottom: 18 }}>{kicker}</div>
          {bigNumber && <div style={{ height: 6, width: 220 * wipe, background: theme.accent, borderRadius: 3, marginTop: -6, marginBottom: 22 }} />}
        </Enter>
      )}
      <Enter>
        <div style={{ fontFamily: theme.display, fontSize: vertical ? 92 : 100, lineHeight: 1.1 }}>
          {lines.map((l, i) => (
            <div key={i}><MarkedText text={l} dark /></div>
          ))}
        </div>
      </Enter>
      {bullets.length > 0 && (
        <div style={{ marginTop: 56, display: 'flex', flexDirection: 'column', gap: 26 }}>
          {(bullets as string[]).map((b, i) => (
            <Enter key={i} delay={bulletAt(i)}>
              <div style={{ display: 'flex', gap: 22, alignItems: 'baseline', fontSize: vertical ? 50 : 48, lineHeight: 1.3 }}>
                <span style={{ color: theme.accent, fontWeight: 800, minWidth: 40 }}>{i + 1}</span>
                <span style={{ color: dark ? theme.bone : theme.ink }}><MarkedText text={b} /></span>
              </div>
            </Enter>
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
};
