import { AbsoluteFill } from 'remotion';
import { Enter } from '../components/Enter';
import { safeArea, theme, useLayout } from '../theme';
import type { Scene } from '../types';

// props: label?, title: string[] (two lines max, broken by hand), subtitle?
// The otter usually greets here: set props.mascot = { beats: [{ at: 0.6, pose: 'wave', say: '해보자!' }] }.
export const TitleScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const { vertical } = useLayout();
  const { label, title = [], subtitle } = scene.props;
  const safe = safeArea(vertical);
  return (
    <AbsoluteFill
      style={{
        justifyContent: vertical ? 'flex-start' : 'center',
        padding: vertical ? `${safe.top + 80}px ${safe.side}px 0` : `0 ${safe.side}px`,
        fontFamily: theme.font, color: theme.bone,
      }}
    >
      {label && (
        <Enter delay={4}>
          <div style={{ fontSize: 34, letterSpacing: '0.18em', color: theme.muted, fontWeight: 600 }}>{label}</div>
        </Enter>
      )}
      <Enter delay={10}>
        <div style={{ fontFamily: theme.display, fontSize: vertical ? 104 : 124, lineHeight: 1.06, marginTop: 14 }}>
          {(title as string[]).map((l, i) => (
            <div key={i} style={{ color: i === title.length - 1 && title.length > 1 ? theme.accent : theme.bone }}>{l}</div>
          ))}
        </div>
      </Enter>
      {subtitle && (
        <Enter delay={20}>
          <div style={{ fontSize: 40, color: theme.muted, marginTop: 28 }}>{subtitle}</div>
        </Enter>
      )}
    </AbsoluteFill>
  );
};
