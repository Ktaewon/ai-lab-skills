import { AbsoluteFill, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { theme } from '../theme';
import type { Scene } from '../types';

// props: src (path in public/, image or video), fit? ('cover' | 'contain'), kenBurns? (default true for images),
//        caption? (small label top-left), startFrom? (video start, seconds)
export const MediaScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { src, fit = 'cover', kenBurns, caption, startFrom = 0 } = scene.props;
  const isVideo = /\.(mp4|mov|webm|m4v)$/i.test(src ?? '');
  const zoom = (kenBurns ?? !isVideo) ? interpolate(frame, [0, scene.frames], [1, 1.08]) : 1;
  const style: React.CSSProperties = { width: '100%', height: '100%', objectFit: fit, transform: `scale(${zoom})` };

  return (
    <AbsoluteFill>
      {src ? (
        isVideo ? (
          <OffthreadVideo src={staticFile(src)} startFrom={Math.round(startFrom * 30)} muted style={style} />
        ) : (
          <Img src={staticFile(src)} style={style} />
        )
      ) : (
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '62%', height: '62%', border: `4px dashed ${theme.muted}`, borderRadius: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: theme.muted, fontFamily: theme.font }}>
            <div style={{ fontSize: 48, fontWeight: 800 }}>촬영 후 삽입</div>
            <div style={{ fontFamily: theme.mono, fontSize: 30 }}>{scene.props.slot ?? scene.id}</div>
          </div>
        </AbsoluteFill>
      )}
      {caption && (
        <div style={{ position: 'absolute', left: 60, top: 60, background: theme.panel, color: theme.bone, fontFamily: theme.font, fontSize: 34, fontWeight: 700, padding: '12px 22px', borderRadius: 12 }}>
          {caption}
        </div>
      )}
    </AbsoluteFill>
  );
};
