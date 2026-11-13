import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { Enter } from '../components/Enter';
import { PromptText } from '../components/PromptText';
import { safeArea, theme, useLayout } from '../theme';
import type { Scene } from '../types';

// One prompt (or one result text) shown in full.
// props: kicker?, label ('A' | 'B' | 'C' | '①' ...), tag?, text, mono?
export const PromptScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const { vertical, width, height } = useLayout();
  const { kicker, label, tag, text = '', mono, follow } = scene.props as { kicker?: string; label: string; tag?: string; text: string; mono?: boolean; follow?: boolean };
  const frame = useCurrentFrame();
  // follow: highlight the paragraph being read, from the word timings of the narration
  // paraStarts (frames, from the measured word timings) → the paragraph being read right now
  const paraStarts = scene.props.paraStarts as number[] | undefined;
  const activePara = follow && paraStarts?.length ? paraStarts.reduce((a, st, k) => (frame >= st ? k : a), 0) : undefined;
  const bg = scene.props.bg as string | undefined;
  let progress: number | undefined;
  if (follow && activePara === undefined) {
    const caps = scene.captions.long;
    const total = caps.reduce((n, c) => n + c.text.length, 0) || 1;
    const said = caps.reduce((n, c) => n + (frame >= c.from ? c.text.length : 0), 0);
    progress = Math.min(0.999, said / total);
  }
  const safe = safeArea(vertical);
  const padX = vertical ? safe.side : 90;
  const top = vertical ? safe.top : 70;
  const bottom = vertical ? safe.bottom + 100 : 150;
  const head = vertical ? 190 : 150;
  const innerPad = vertical ? 30 : 40;
  const boxW = width - padX * 2 - innerPad * 2;
  const boxH = height - top - bottom - head - innerPad * 2;

  return (
    <AbsoluteFill style={{ padding: `${top}px ${padX}px ${bottom}px`, fontFamily: theme.font, color: theme.bone }}>
      {bg && (
        <AbsoluteFill style={{ opacity: 0.22 }}>
          <Img src={staticFile(bg)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(6px)' }} />
        </AbsoluteFill>
      )}
      <Enter>
        <div style={{ display: 'flex', alignItems: 'center', gap: 26, height: head - 24 }}>
          <span style={{ fontFamily: theme.display, fontSize: vertical ? 92 : 96, color: theme.accent, lineHeight: 1 }}>{label}</span>
          <div>
            {kicker && <div style={{ fontSize: vertical ? 30 : 28, fontWeight: 700, color: theme.muted }}>{kicker}</div>}
            {tag && <div style={{ fontFamily: theme.display, fontSize: vertical ? 40 : 44, lineHeight: 1.2, marginTop: 6 }}>{tag}</div>}
          </div>
        </div>
      </Enter>
      <Enter delay={6}>
        <div style={{ background: theme.panel, border: `2px solid ${theme.panelBorder}`, borderRadius: 22, padding: innerPad }}>
          <PromptText text={text} width={boxW} height={boxH} mono={mono} maxFs={vertical ? 34 : 38} progress={progress} activePara={activePara} />
        </div>
      </Enter>
    </AbsoluteFill>
  );
};
