import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

// Fade + rise in, starting `delay` frames into the scene. Used for staggered text.
export const Enter: React.FC<{ delay?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ delay = 0, children, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Settles in ~0.4 s: slower entrances leave the first half-second of a dark scene looking black.
  const p = spring({ frame: frame - delay, fps, config: { damping: 200 }, durationInFrames: 12 });
  // Items with no delay are already partly visible on the scene's first frame, so a cut between two
  // dark scenes never shows an empty (black-looking) frame.
  const opacity = delay === 0 ? 0.35 + 0.65 * p : p;
  return <div style={{ opacity, transform: `translateY(${(1 - p) * 30}px)`, ...style }}>{children}</div>;
};
