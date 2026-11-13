import { Composition, Still } from 'remotion';
import timelineJson from './timeline.json';
import { LongVideo } from './LongVideo';
import { ShortVideo, shortFrames } from './ShortVideo';
import { Thumbnail } from './Thumbnail';
import { ShortThumbnail } from './ShortThumbnail';
import type { Timeline } from './types';

const timeline = timelineJson as unknown as Timeline;

// Long:       the full episode, 1920x1080
// Short-<id>: one vertical short per entry in episode.json "shorts", 1080x1920
// Thumbnail:  1280x720 still
// ShortThumb-<id>: 1080x1920 cover for each short that has a "thumb" in episode.json
export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="Long" component={LongVideo} durationInFrames={Math.max(1, timeline.totalFrames)} fps={timeline.fps} width={1920} height={1080} />
    {timeline.shorts.map((s) => (
      <Composition
        key={s.id}
        id={`Short-${s.id}`}
        component={ShortVideo}
        defaultProps={{ shortId: s.id }}
        durationInFrames={Math.max(1, shortFrames(s.id))}
        fps={timeline.fps}
        width={1080}
        height={1920}
      />
    ))}
    <Still id="Thumbnail" component={Thumbnail} width={1280} height={720} />
    {timeline.shorts.filter((s) => s.thumb).map((s) => (
      <Still key={s.id} id={`ShortThumb-${s.id}`} component={ShortThumbnail} defaultProps={{ id: s.id }} width={1080} height={1920} />
    ))}
  </>
);
