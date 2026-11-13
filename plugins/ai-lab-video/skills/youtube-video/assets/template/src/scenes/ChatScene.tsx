import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { safeArea, theme, useLayout } from '../theme';
import type { Scene } from '../types';

// A story told as a chat between "me" and the AI (messenger look). Each message appears on its
// spoken word (prepare.py resolves messages[].say → from) and the thread scrolls up from the bottom
// like a real messenger. Use it when the content IS a conversation: asking an AI, back-and-forth
// debugging, a prompt and its answer. Messages are what was actually said/run — never invent output.
//
// props: messages: [{who: 'me'|'ai', kind?: 'text'|'term'|'error'|'diff'|'img', from,
//                    text?, lines?: string[], minus?: string|string[], plus?: string|string[],
//                    src?, w?, h?, caption?}]
//        title? ('Claude'), status? ('● 작업 중'), avatar? (otter pose, 'laptop'), tone? ('light'|'dark'),
//        aside? (16:9 only: {label?, title: string[], pose?, say?} — big chapter text + otter on the left)
type Msg = {
  who: 'me' | 'ai'; kind?: 'text' | 'term' | 'error' | 'diff' | 'img'; from: number;
  text?: string; lines?: string[]; minus?: string | string[]; plus?: string | string[];
  src?: string; w?: number; h?: number; caption?: string;
};
type Aside = { label?: string; title: string[]; pose?: string; say?: string };

const arr = (v?: string | string[]) => (v == null ? [] : Array.isArray(v) ? v : [v]);
// Rough rendered width of a string: Hangul ≈ 1em, latin/digits ≈ 0.55em, space ≈ 0.3em.
const textW = (s: string, fs: number) => [...s].reduce((w, ch) => w + (/[ᄀ-퟿　-鿿]/.test(ch) ? 1 : ch === ' ' ? 0.3 : 0.56) * fs, 0);
const wrapCount = (s: string, fs: number, maxW: number) => s.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(textW(l, fs) / maxW)), 0);

const NUM = /(\d[\d,.]*\s?(?:s|ms|초|분|개|%|MB|GB)?)/g;

export const ChatScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { vertical } = useLayout();
  const safe = safeArea(vertical);
  const { messages = [], title = 'Claude', status = '● 작업 중', avatar = 'laptop', tone = 'light' } = scene.props as {
    messages?: Msg[]; title?: string; status?: string; avatar?: string; tone?: 'light' | 'dark';
  };
  const aside = (!vertical && scene.props.aside) as Aside | false;
  const dark = tone === 'dark';
  const pal = {
    bg: dark ? '#14161B' : '#EEF1F6', head: dark ? '#1C1F26' : '#FFFFFF', ink: dark ? theme.bone : '#16181D',
    ai: dark ? '#262A33' : '#FFFFFF', sub: dark ? '#8B93A1' : '#6B7280', border: dark ? '#2A2E37' : '#DDE2EA',
  };

  // Window geometry (px in the composition).
  const win = vertical
    ? { left: 40, top: safe.top - 10, width: 1000, height: 1920 - safe.top - safe.bottom - 30 }
    : aside
      ? { left: 860, top: 100, width: 980, height: 800 }
      : { left: 400, top: 100, width: 1120, height: 800 };
  const HEAD = vertical ? 104 : 92;
  const fs = vertical ? 44 : 36; // bubble text
  const mono = vertical ? 34 : 28;
  const pad = vertical ? 26 : 22;
  const avatarSize = vertical ? 80 : 64;
  const maxW = win.width * 0.74;
  const GAP = vertical ? 22 : 18;

  const height = (m: Msg) => {
    const k = m.kind ?? 'text';
    if (k === 'text') return pad * 1.6 + wrapCount(m.text ?? '', fs, maxW - pad * 2) * fs * 1.22;
    if (k === 'term') return pad * 1.6 + arr(m.lines).reduce((n, l) => n + wrapCount(l, mono, maxW - pad * 2), 0) * mono * 1.4;
    if (k === 'error') return pad * 1.6 + wrapCount(`ERROR: ${m.text ?? ''}`, mono, maxW - pad * 2) * mono * 1.35;
    if (k === 'diff') return pad * 1.6 + (arr(m.minus).length + arr(m.plus).length) * (mono * 1.35 + 14);
    const w = Math.min(m.w ?? 300, maxW - 20);
    return (m.h ?? w * 0.75) * (w / (m.w ?? w)) + 20 + (m.caption ? fs * 1.4 : 0);
  };

  // Lay the thread out top-down, then anchor the newest message to the bottom: each new message
  // slides the whole thread up by its height (eased over ~8 frames).
  const BOTTOM = win.height - (vertical ? 36 : 30);
  let y = HEAD + 20;
  const placed = messages.map((m, i) => {
    const top = y;
    const h = height(m);
    y += h + GAP;
    return { m: { ...m, from: m.from ?? i * 20 }, top, h, shift: Math.min(0, BOTTOM - (top + h)) };
  });
  const visible = placed.filter((p) => frame >= p.m.from - 1);
  const k = visible.length - 1;
  let shift = 0;
  if (k >= 0) {
    const ease = interpolate(frame, [placed[k].m.from, placed[k].m.from + 8], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
    const prev = k === 0 ? 0 : placed[k - 1].shift;
    shift = prev + (placed[k].shift - prev) * ease;
  }
  // An error message jolts the window.
  const lastErr = [...visible].reverse().find((p) => p.m.kind === 'error');
  const jolt = lastErr ? interpolate(frame - lastErr.m.from, [0, 3, 14], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0;
  const shake = jolt * 14 * Math.sin(frame * 2.7);
  const enter = spring({ frame, fps, config: { damping: 16 } });

  const bubble = (m: Msg) => {
    const me = m.who === 'me';
    const base: React.CSSProperties = {
      maxWidth: maxW, borderRadius: fs * 0.75, padding: `${pad * 0.8}px ${pad}px`, fontFamily: theme.font, fontWeight: 600, fontSize: fs,
      lineHeight: 1.22, whiteSpace: 'pre-line', wordBreak: 'keep-all', overflowWrap: 'anywhere',
      background: me ? theme.accent : pal.ai, color: me ? '#fff' : pal.ink,
      borderBottomRightRadius: me ? 8 : fs * 0.75, borderBottomLeftRadius: me ? fs * 0.75 : 8, boxShadow: '0 4px 14px rgba(20,30,60,0.10)',
    };
    const code: React.CSSProperties = { ...base, background: '#15171C', color: '#E8EAED', fontFamily: theme.mono, fontSize: mono, fontWeight: 400, lineHeight: 1.4, whiteSpace: 'pre-wrap' };
    switch (m.kind ?? 'text') {
      case 'term':
        return (
          <div style={code}>
            {arr(m.lines).map((l, i) => (
              <div key={i} style={{ color: l.startsWith('$') ? '#8B93A1' : '#E8EAED' }}>
                {l.split(NUM).map((part, j) => (j % 2 ? <b key={j} style={{ color: '#FFB020' }}>{part}</b> : part))}
              </div>
            ))}
          </div>
        );
      case 'error':
        return <div style={{ ...code, background: '#FFE9E7', color: '#D9241B', border: '3px solid #FF4D40', fontWeight: 700, lineHeight: 1.35 }}>ERROR: {m.text}</div>;
      case 'diff':
        return (
          <div style={{ ...code, padding: `${pad * 0.7}px ${pad * 0.8}px`, lineHeight: 1.35 }}>
            {arr(m.minus).map((l, i) => <div key={`m${i}`} style={{ background: 'rgba(255,77,64,0.22)', color: '#FF8A80', padding: '4px 12px', borderRadius: 8, marginBottom: 7 }}>- {l}</div>)}
            {arr(m.plus).map((l, i) => <div key={`p${i}`} style={{ background: 'rgba(52,199,89,0.22)', color: '#7CF29C', padding: '4px 12px', borderRadius: 8, marginBottom: 7 }}>+ {l}</div>)}
          </div>
        );
      case 'img': {
        const w = Math.min(m.w ?? 300, maxW - 20);
        const h = (m.h ?? w * 0.75) * (w / (m.w ?? w));
        return (
          <div style={{ ...base, padding: 10 }}>
            <Img src={staticFile(m.src ?? '')} style={{ width: w, height: h, objectFit: 'cover', borderRadius: fs * 0.5, display: 'block' }} />
            {m.caption && <div style={{ padding: '8px 12px 2px' }}>{m.caption}</div>}
          </div>
        );
      }
      default:
        return <div style={base}>{m.text}</div>;
    }
  };

  return (
    <>
      {aside && <AsidePanel a={aside} sceneFrame={frame} light={scene.props.tone === 'light'} />}
      <div
        style={{
          position: 'absolute', ...win, background: pal.bg, borderRadius: vertical ? 40 : 34, overflow: 'hidden', border: `2px solid ${pal.border}`,
          boxShadow: '0 30px 80px rgba(0,0,0,0.35)', opacity: enter, transform: `translate(${shake}px, ${(1 - enter) * 40}px)`,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, transform: `translateY(${shift}px)` }}>
          {visible.map((p, i) => {
            const pop = spring({ frame: frame - p.m.from, fps, config: { damping: 14, mass: 0.7, stiffness: 170 } });
            const me = p.m.who === 'me';
            return (
              <div
                key={i}
                style={{
                  position: 'absolute', top: p.top, left: 30, right: 30, display: 'flex', justifyContent: me ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 14,
                  opacity: pop, transform: `translateY(${(1 - pop) * 36}px) scale(${0.9 + 0.1 * pop})`, transformOrigin: me ? 'right bottom' : 'left bottom',
                }}
              >
                {!me && <Img src={staticFile(`mascot/otter/${avatar}.png`)} style={{ width: avatarSize, height: avatarSize, objectFit: 'contain', borderRadius: avatarSize / 2, background: '#FFE9DA', flexShrink: 0 }} />}
                {bubble(p.m)}
              </div>
            );
          })}
        </div>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: HEAD, background: pal.head, borderBottom: `1px solid ${pal.border}`, display: 'flex', alignItems: 'center', gap: 16, padding: '0 28px' }}>
          <Img src={staticFile(`mascot/otter/${avatar}.png`)} style={{ width: HEAD * 0.62, height: HEAD * 0.62, objectFit: 'contain', borderRadius: HEAD, background: '#FFE9DA' }} />
          <div style={{ fontFamily: theme.font, fontWeight: 800, fontSize: HEAD * 0.34, color: pal.ink }}>{title}</div>
          <div style={{ fontFamily: theme.font, fontWeight: 600, fontSize: HEAD * 0.25, color: theme.accent }}>{status}</div>
        </div>
      </div>
    </>
  );
};

// Left column in 16:9: chapter label, a two-line title (second line in the accent) and an otter.
export const AsidePanel: React.FC<{ a: Aside; sceneFrame: number; light?: boolean; x?: number; width?: number }> = ({ a, sceneFrame, light, x = 110, width = 700 }) => {
  const { fps } = useVideoConfig();
  const pop = spring({ frame: sceneFrame, fps, config: { damping: 13 } });
  const otter = spring({ frame: sceneFrame - 8, fps, config: { damping: 12 } });
  const ink = light ? '#16181D' : theme.bone;
  return (
    <>
      <div style={{ position: 'absolute', left: x, top: 150, width, opacity: pop, transform: `translateX(${(1 - pop) * -50}px)` }}>
        {a.label && <div style={{ fontFamily: theme.display, fontSize: 38, color: theme.accent }}>{a.label}</div>}
        <div style={{ fontFamily: theme.display, fontSize: 104, color: ink, lineHeight: 1.08, marginTop: 10, wordBreak: 'keep-all' }}>
          {a.title.map((t, i) => (
            <div key={i} style={{ color: i === a.title.length - 1 && a.title.length > 1 ? theme.accent : ink }}>{t}</div>
          ))}
        </div>
      </div>
      {a.pose && (
        <div style={{ position: 'absolute', left: x + 190, top: 540, transform: `translateY(${(1 - otter) * 260}px)` }}>
          {a.say && (
            <div style={{ position: 'absolute', left: -170, top: 10, fontFamily: theme.hand, fontSize: 54, background: '#fff', color: '#16181D', border: '4px solid #16181D', borderRadius: 22, padding: '2px 22px', whiteSpace: 'nowrap', transform: 'rotate(-5deg)' }}>{a.say}</div>
          )}
          <Img src={staticFile(`mascot/otter/${a.pose}.png`)} style={{ height: 320 }} />
        </div>
      )}
    </>
  );
};
