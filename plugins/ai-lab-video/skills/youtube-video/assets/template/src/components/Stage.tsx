import { AbsoluteFill, interpolate, random, useCurrentFrame } from 'remotion';
import { theme } from '../theme';

// The premium stage: graphite ground, a slow warm glow, and film grain re-seeded every 2 frames.
export const Stage: React.FC<{ seed?: string; light?: boolean; children?: React.ReactNode }> = ({ seed = 's', light, children }) => {
  const frame = useCurrentFrame();
  const gx = 70 + Math.sin(frame / 90 + random(seed) * 6) * 8;
  const gy = 75 + Math.cos(frame / 110 + random(seed + 'y') * 6) * 8;
  const grainSeed = Math.floor(frame / 2) % 50;
  return (
    <AbsoluteFill style={{ background: light ? theme.light : theme.ink, overflow: 'hidden' }}>
      {!light && (
        <div
          style={{
            position: 'absolute', left: `${gx}%`, top: `${gy}%`, width: 900, height: 900, marginLeft: -450, marginTop: -450,
            borderRadius: '50%', background: theme.accent, filter: 'blur(160px)',
            opacity: interpolate(frame, [0, 20], [0, 0.22], { extrapolateRight: 'clamp' }),
          }}
        />
      )}
      {children}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: light ? 0.05 : 0.07, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
        <filter id={`g${grainSeed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={grainSeed} />
        </filter>
        <rect width="100%" height="100%" filter={`url(#g${grainSeed})`} />
      </svg>
    </AbsoluteFill>
  );
};
