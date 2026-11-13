import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import type { Scene } from '../types';
import { useLayout } from '../theme';
import { Stage } from '../components/Stage';
import { Mascot, type MascotProps } from '../components/Mascot';
import { Doodles, type DoodleSpec } from '../components/Doodle';
import { TitleScene } from './TitleScene';
import { StatementScene } from './StatementScene';
import { RecordingScene } from './RecordingScene';
import { TerminalScene } from './TerminalScene';
import { ChartScene } from './ChartScene';
import { MediaScene } from './MediaScene';
import { OutroScene } from './OutroScene';
import { CompareScene } from './CompareScene';
import { PromptScene } from './PromptScene';
import { BeatsScene } from './BeatsScene';
import { ChatScene } from './ChatScene';
import { MapScene } from './MapScene';
import { ReceiptScene } from './ReceiptScene';
import { CodeScene } from './CodeScene';
import { FlowScene } from './FlowScene';
import { RaceScene } from './RaceScene';
import { DocScene } from './DocScene';
import { NewsScene } from './NewsScene';
import { ScoreboardScene } from './ScoreboardScene';
import { QuizScene } from './QuizScene';
import { TierScene } from './TierScene';
import { Stickers, type StickerSpec } from '../components/Sticker';
import { MarksContext, type Mark } from '../components/Marker';

const DENSE = new Set(['tier', 'quiz', 'scoreboard', 'news', 'doc', 'race', 'flow', 'code', 'receipt', 'map']);

// Every scene: stage (glow + grain) → scene content → scrappy doodles → otter mascot.
// Doodles and the mascot come from episode.json: props.doodles[] and props.mascot {beats, side, ...}.
export const SceneView: React.FC<{ scene: Scene }> = ({ scene }) => {
  const body = <SceneBody scene={scene} />;
  const light = (scene.type === 'statement' || scene.type === 'chat') && scene.props.tone === 'light';
  // Doodle positions are % of a 16:9 frame; a 9:16 short lays scenes out differently, so it only
  // draws doodles given for it explicitly (props.doodlesShort).
  const { vertical } = useLayout();
  const doodles = (vertical ? scene.props.doodlesShort : scene.props.doodles) as DoodleSpec[] | undefined;
  const stickers = (vertical ? scene.props.stickersShort : scene.props.stickers) as StickerSpec[] | undefined;
  return (
    <Stage seed={scene.id} light={light}>
      <MarksContext.Provider value={(scene.props.marks as Mark[]) ?? []}>{body}</MarksContext.Provider>
      <Doodles items={doodles} />
      <Stickers items={stickers} />
      {scene.props.mascot && (
        <Mascot
          {...(scene.props.mascot as MascotProps)}
          // dense data scenes in a 9:16 short: a smaller otter so it doesn't sit on the content
          {...(vertical && DENSE.has(scene.type) ? { size: Math.min((scene.props.mascot as MascotProps).size ?? 380, 270) } : {})}
        />
      )}
    </Stage>
  );
};

const SceneBody: React.FC<{ scene: Scene }> = ({ scene }) => {
  switch (scene.type) {
    case 'title':
      return <TitleScene scene={scene} />;
    case 'statement':
      return <StatementScene scene={scene} />;
    case 'recording':
      return <RecordingScene scene={scene} />;
    case 'terminal':
      return <TerminalScene scene={scene} />;
    case 'chart':
      return <ChartScene scene={scene} />;
    case 'media':
      return <MediaScene scene={scene} />;
    case 'outro':
      return <OutroScene scene={scene} />;
    case 'compare':
      return <CompareScene scene={scene} />;
    case 'prompt':
      return <PromptScene scene={scene} />;
    case 'tier':
      return <TierScene scene={scene} />;
    case 'quiz':
      return <QuizScene scene={scene} />;
    case 'scoreboard':
      return <ScoreboardScene scene={scene} />;
    case 'news':
      return <NewsScene scene={scene} />;
    case 'doc':
      return <DocScene scene={scene} />;
    case 'race':
      return <RaceScene scene={scene} />;
    case 'flow':
      return <FlowScene scene={scene} />;
    case 'code':
      return <CodeScene scene={scene} />;
    case 'receipt':
      return <ReceiptScene scene={scene} />;
    case 'map':
      return <MapScene scene={scene} />;
    case 'chat':
      return <ChatScene scene={scene} />;
    case 'beats':
      return <BeatsScene scene={scene} />;
    default:
      return null;
  }
};
