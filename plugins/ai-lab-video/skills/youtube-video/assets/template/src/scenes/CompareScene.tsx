import { AbsoluteFill, Img, OffthreadVideo, staticFile } from 'remotion';
import { Enter } from '../components/Enter';
import { safeArea, theme, useLayout } from '../theme';
import type { Scene } from '../types';
import { MarkedText } from '../components/Marker';

// Side-by-side comparison of 2–4 panels (A/B/C results, prompts, emails...).
// props: kicker?, heading?, panels: [{ label, tag?, src?, text?, slot?, fit? }], reveal?: 'stagger' | 'all'
//   src  → image/video in public/ (shown if the file was given)
//   text → text panel (prompts, emails, toasts)
//   slot → neither yet: a dashed "촬영 후 삽입" box naming the file that goes here.
// Panels are revealed across the narration (stagger) so each lands when it is spoken.
// textShort: shorter text used in 9:16 shorts, where stacked panels have little height.
type Panel = { label: string; tag?: string; src?: string; text?: string; textShort?: string; slot?: string; fit?: 'cover' | 'contain'; mono?: boolean };

const isVideo = (s: string) => /\.(mp4|mov|webm|m4v)$/i.test(s);

export const CompareScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const { vertical } = useLayout();
  const { kicker, heading, panels: raw = [], reveal = 'stagger', textSize } = scene.props as {
    kicker?: string; heading?: string; panels: Panel[]; reveal?: string; textSize?: number;
  };
  const panels = vertical ? raw.map((p) => (p.textShort ? { ...p, text: p.textShort } : p)) : raw;
  const safe = safeArea(vertical);
  const caps = scene.captions.long;
  const speakEnd = caps.length ? caps[caps.length - 1].to : scene.frames;
  const at = (i: number) => (reveal === 'all' ? 6 : 10 + Math.round(((speakEnd - 10) * i) / Math.max(1, panels.length + 0.3)));
  const longest = Math.max(0, ...panels.map((p) => (p.text ?? '').length));
  const fs = textSize ?? (vertical ? (longest > 120 ? 26 : 30) : longest > 260 ? 24 : longest > 160 ? 28 : longest > 80 ? 32 : 40);

  return (
    <AbsoluteFill style={{ fontFamily: theme.font, color: theme.bone, padding: `${vertical ? safe.top : 80}px ${vertical ? safe.side : 90}px ${vertical ? safe.bottom + 100 : 150}px` }}>
      {kicker && (
        <Enter>
          <div style={{ fontSize: vertical ? 36 : 32, fontWeight: 700, color: theme.accent, marginBottom: 8 }}>{kicker}</div>
        </Enter>
      )}
      {heading && (
        <Enter>
          <div style={{ fontFamily: theme.display, fontSize: vertical ? 64 : 62, lineHeight: 1.15, marginBottom: vertical ? 30 : 34 }}>{heading}</div>
        </Enter>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: vertical ? 'column' : 'row', gap: vertical ? 22 : 30, minHeight: 0 }}>
        {panels.map((p, i) => (
          <Enter key={i} delay={at(i)} style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: theme.panel, border: `2px solid ${theme.panelBorder}`, borderRadius: 22, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, padding: '16px 24px', borderBottom: `2px solid ${theme.panelBorder}` }}>
                <span style={{ fontFamily: theme.display, fontSize: vertical ? 44 : 46, color: theme.accent }}>{p.label}</span>
                {p.tag && <span style={{ fontSize: vertical ? 30 : 28, fontWeight: 700, color: theme.bone }}><MarkedText text={p.tag} /></span>}
              </div>
              <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
                {p.src ? (
                  isVideo(p.src) ? (
                    <OffthreadVideo src={staticFile(p.src)} muted style={{ width: '100%', height: '100%', objectFit: vertical ? 'contain' : p.fit ?? 'cover' }} />
                  ) : (
                    <Img src={staticFile(p.src)} style={{ width: '100%', height: '100%', objectFit: vertical ? 'contain' : p.fit ?? 'cover' }} />
                  )
                ) : p.text ? (
                  <div style={{ padding: '20px 26px', fontSize: fs, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'keep-all', fontFamily: p.mono ? theme.mono : theme.font }}><MarkedText text={p.text} /></div>
                ) : (
                  <div style={{ position: 'absolute', inset: 18, border: `3px dashed ${theme.muted}`, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: theme.muted, textAlign: 'center' }}>
                    <div style={{ fontSize: vertical ? 34 : 34, fontWeight: 800 }}>촬영 후 삽입</div>
                    {p.slot && <div style={{ fontFamily: theme.mono, fontSize: vertical ? 26 : 24 }}>{p.slot}</div>}
                  </div>
                )}
              </div>
            </div>
          </Enter>
        ))}
      </div>
    </AbsoluteFill>
  );
};
