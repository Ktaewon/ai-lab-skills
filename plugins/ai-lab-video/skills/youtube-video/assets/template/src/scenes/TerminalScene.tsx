import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { safeArea, theme, useLayout } from '../theme';
import type { Scene } from '../types';
import { AsidePanel } from './ChatScene';

// A rebuilt terminal, not a recording: crisp at any size and timed to the narration.
// Only show output you actually observed — this is presented as a real run.
//
// Simple form (unchanged): title?, command, lines?: string[] (shown one by one after the command
// types out), highlight?: number[] (output lines in the accent).
//
// Timed form — when any line is an object, every line appears on its spoken word
// (prepare.py resolves lines[].say/at → from). The whole story can play out in one terminal:
//   lines: [{text, say|at, kind?, stamp?, progress?}]
//   kind: 'cmd' (typed out, "$ " prompt) | 'out' (default) | 'dim' | 'ok' (green) | 'err' (red; the
//         window shakes and flashes red) | 'warn' | 'ai' (amber, an agent's own line) | 'add' / 'del'
//         (diff lines on a green/red band) | 'hi' (accent)
//   stamp: big slammed stamp ("PASS", "32초 컷") for ~3 s (or until the next stamp)
//   progress: true → a progress bar under this line fills until the next line arrives
// Optional: command (typed first, as before), aside (16:9: {label?, title[], pose?, say?} on the right).
type Kind = 'cmd' | 'out' | 'dim' | 'ok' | 'err' | 'warn' | 'ai' | 'add' | 'del' | 'hi';
type Line = { text: string; from: number; kind?: Kind; stamp?: string; progress?: boolean };

const CHARS_PER_SEC = 18;
const LINE_GAP = 0.35;
const GREEN = '#39FF88';
const COLORS: Record<Kind, string> = {
  cmd: '#E8EAED', out: '#cfd3dc', dim: '#8B93A1', ok: GREEN, err: '#FF5A4E', warn: '#FFB020', ai: '#FFB020', add: '#7CF29C', del: '#FF8A80', hi: '',
};
const BANDS: Partial<Record<Kind, string>> = { add: 'rgba(52,199,89,0.18)', del: 'rgba(255,77,64,0.18)' };

export const TerminalScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { vertical } = useLayout();
  const safe = safeArea(vertical);
  const { title = 'Terminal', command = '', lines = [], highlight = [] } = scene.props as {
    title?: string; command?: string; lines?: (string | Line)[]; highlight?: number[];
  };
  const timed = lines.some((l) => typeof l === 'object');
  const aside = (!vertical && timed && scene.props.aside) as { label?: string; title: string[]; pose?: string; say?: string } | false;
  const t = frame / fps - 0.4;
  const typed = Math.max(0, Math.min(command.length, Math.floor(t * CHARS_PER_SEC)));
  const typedDone = command.length / CHARS_PER_SEC + 0.4;

  // Normalise both forms to timed lines.
  const items: Line[] = timed
    ? lines.map((l) => (typeof l === 'string' ? { text: l, from: 0 } : l))
    : lines.map((l, i) => ({
        text: l as string, kind: (highlight as number[]).includes(i) ? 'hi' : 'out',
        from: Math.round((0.4 + typedDone + i * LINE_GAP) * fps),
      }));
  const shown = items.filter((l) => frame >= l.from);

  const fontSize = vertical ? 34 : aside ? 34 : 40;
  const lh = fontSize * 1.55;
  const box = vertical
    ? { left: safe.side - 30, top: safe.top - 10, width: 1080 - 2 * (safe.side - 30), height: 1920 - safe.top - safe.bottom - 30 }
    : aside
      ? { left: 80, top: 110, width: 1180, height: 790 }
      : { left: safe.side, top: safe.top, width: 1920 - 2 * safe.side, height: 1080 - safe.top - safe.bottom };
  const BAR = 70;
  const maxLines = Math.max(3, Math.floor((box.height - BAR - 60 - (command ? lh : 0)) / lh) - 1);
  const first = Math.max(0, shown.length - maxLines);

  // Error jolt + red flash on the newest err line.
  const lastErr = [...shown].reverse().find((l) => l.kind === 'err');
  const errK = lastErr ? interpolate(frame - lastErr.from, [0, 2, 18], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0;
  const shake = errK * 16 * Math.sin(frame * 2.9);
  const cursorOn = Math.floor(frame / 15) % 2 === 0;
  const enter = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });

  // Stamp: from a line with `stamp` until the next stamp line.
  const stampLines = items.filter((l) => l.stamp);
  const stampAt = [...stampLines].reverse().find((l) => frame >= l.from);
  const nextStamp = stampAt ? stampLines.find((l) => l.from > stampAt.from) : undefined;
  const stampOn = !!stampAt && (!nextStamp || frame < nextStamp.from) && frame < stampAt.from + 3 * fps; // ~3 s, then it clears
  const stampColor = stampAt?.kind === 'err' ? '#FF5A4E' : GREEN;
  const stampPop = stampAt ? spring({ frame: frame - stampAt.from, fps, config: { damping: 9 } }) : 0;

  const renderLine = (l: Line, i: number) => {
    const kind = l.kind ?? 'out';
    const color = kind === 'hi' ? theme.accent : COLORS[kind];
    const isCmd = kind === 'cmd';
    const body = isCmd ? l.text.replace(/^\$\s*/, '') : l.text;
    const chars = isCmd ? Math.floor(Math.max(0, frame - l.from) * (30 / fps)) : body.length;
    const next = items[items.indexOf(l) + 1];
    const pb = l.progress ? interpolate(frame, [l.from, next ? next.from : l.from + 2 * fps], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0;
    const glow = kind === 'ok' || kind === 'err';
    return (
      <div key={first + i} style={{ color, fontWeight: kind === 'hi' || glow ? 700 : 400 }}>
        <span style={{ background: BANDS[kind], padding: BANDS[kind] ? '1px 10px' : 0, borderRadius: 6, textShadow: glow ? `0 0 16px ${color}55` : undefined }}>
          {isCmd && <span style={{ color: theme.accent }}>$ </span>}
          {kind === 'add' && '+ '}
          {kind === 'del' && '- '}
          {body.slice(0, chars)}
        </span>
        {isCmd && chars < body.length && cursorOn && <span style={{ background: theme.bone }}>&nbsp;</span>}
        {l.progress && pb < 1 && (
          <div style={{ width: '60%', height: fontSize * 0.7, border: `2px solid ${GREEN}`, borderRadius: 6, marginTop: 6, marginBottom: 4 }}>
            <div style={{ width: `${pb * 100}%`, height: '100%', background: GREEN }} />
          </div>
        )}
      </div>
    );
  };

  return (
    <AbsoluteFill style={{ transform: `translate(${shake}px, ${shake * 0.6}px)` }}>
      <div
        style={{
          position: 'absolute', ...box, background: timed ? '#0B0F0D' : theme.panel, border: `2px solid ${timed ? '#1F2A24' : theme.panelBorder}`, borderRadius: 22, overflow: 'hidden',
          opacity: enter, boxShadow: '0 40px 90px rgba(0,0,0,.45)', transform: `translateY(${(1 - enter) * 30}px)`,
          // simple form at 16:9 keeps its old look: auto height, vertically centred
          ...(timed || vertical ? {} : { height: 'auto', minHeight: 620, top: '50%', marginTop: -310 }),
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 26px', height: BAR, background: '#17181d' }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
            <div key={c} style={{ width: 18, height: 18, borderRadius: 9, background: c }} />
          ))}
          <div style={{ marginLeft: 18, color: theme.muted, fontFamily: theme.font, fontSize: 26 }}>{title}</div>
        </div>
        {timed && <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 2px, transparent 2px 5px)', pointerEvents: 'none' }} />}
        <div style={{ padding: '30px 36px', fontFamily: theme.mono, fontSize, lineHeight: 1.55, color: theme.bone, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {command && (
            <div>
              <span style={{ color: theme.accent }}>$ </span>
              {command.slice(0, typed)}
              {typed < command.length && cursorOn && <span style={{ background: theme.bone }}>&nbsp;</span>}
            </div>
          )}
          {shown.slice(first).map(renderLine)}
        </div>
        <AbsoluteFill style={{ background: '#FF2A1F', opacity: errK * 0.35, mixBlendMode: 'screen', pointerEvents: 'none' }} />
      </div>
      {aside && <AsidePanel a={aside} sceneFrame={frame} x={1320} width={520} />}
      {stampOn && stampAt && (
        <div style={{ position: 'absolute', pointerEvents: 'none', ...(vertical ? { left: 0, right: 0, top: 1060, textAlign: 'center' } : aside ? { left: 1340, top: 440 } : { right: 200, top: 160 }) }}>
          <span
            style={{
              display: 'inline-block', fontFamily: theme.display, fontSize: vertical ? 110 : 84, color: stampColor, border: `7px solid ${stampColor}`, borderRadius: 16,
              padding: '2px 24px', transform: `rotate(-7deg) scale(${2.2 - 1.2 * stampPop})`, opacity: Math.min(1, stampPop * 1.4),
              textShadow: `0 0 26px ${stampColor}88`, background: 'rgba(0,0,0,0.6)',
            }}
          >
            {stampAt.stamp}
          </span>
        </div>
      )}
    </AbsoluteFill>
  );
};
