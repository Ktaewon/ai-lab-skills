import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import timelineJson from './timeline.json';
import { SceneView } from './scenes';
import { Captions } from './components/Captions';
import { theme } from './theme';
import type { Timeline } from './types';

const timeline = timelineJson as unknown as Timeline;
const LEAD_IN = timeline.leadInFrames ?? 24; // frames; written by prepare.py (LEAD_IN) so voice and captions stay in sync

export const LongVideo: React.FC = () => (
  // keep-all: break Korean lines between words, never inside one.
  <AbsoluteFill style={{ background: theme.ink, wordBreak: 'keep-all' }}>
    {timeline.scenes.map((s) => (
      <Sequence key={s.id} from={s.from} durationInFrames={s.frames} name={`${s.type}:${s.id}`}>
        <SceneView scene={s} />
        {s.props.noCaptions ? null : <Captions captions={s.captions.long} format="long" />}
        {s.audio && (
          <Sequence from={LEAD_IN}>
            <Audio src={staticFile(s.audio)} />
          </Sequence>
        )}
      </Sequence>
    ))}
    {timeline.music && <Audio src={staticFile(timeline.music)} volume={timeline.musicVolume} loop />}
  </AbsoluteFill>
);
