import { Easing, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
// prismjs ships no types and @types/prismjs is not installed. The core bundle already has
// markup, css, clike and javascript; the rest are loaded here (order matters: tsx needs jsx + ts).
// @ts-ignore
import Prism from 'prismjs';
// @ts-ignore
import 'prismjs/components/prism-typescript';
// @ts-ignore
import 'prismjs/components/prism-jsx';
// @ts-ignore
import 'prismjs/components/prism-tsx';
// @ts-ignore
import 'prismjs/components/prism-python';
// @ts-ignore
import 'prismjs/components/prism-bash';
// @ts-ignore
import 'prismjs/components/prism-json';
// @ts-ignore
import 'prismjs/components/prism-yaml';
// @ts-ignore
import 'prismjs/components/prism-sql';
// @ts-ignore
import 'prismjs/components/prism-go';
// @ts-ignore
import 'prismjs/components/prism-rust';
// @ts-ignore
import 'prismjs/components/prism-java';
// @ts-ignore
import 'prismjs/components/prism-c';
// @ts-ignore
import 'prismjs/components/prism-cpp';
// @ts-ignore
import 'prismjs/components/prism-diff';
// @ts-ignore
import 'prismjs/components/prism-markdown';
// @ts-ignore
import 'prismjs/components/prism-docker';
// @ts-ignore
import 'prismjs/components/prism-powershell';
import { Doodle } from '../components/Doodle';
import { theme, useLayout } from '../theme';
import type { Scene } from '../types';

// Code walkthrough (Fireship style): a stylised editor; one line range is focused at a time (bright,
// accent bar in the gutter, the rest dimmed to ~30%) with a callout holding a short note. A diff
// strikes a line in red and types its replacement in green; the scene can end with a red marker
// ellipse + hand-written note on the key line. Use it to explain real code line by line — the code
// is shown as real, so paste the actual file (trimmed), never invented output.
//
// props: filename, language ('ts'|'tsx'|'js'|'jsx'|'py'|'bash'|'json'|'yaml'|'sql'|'go'|'rust'|'java'|
//          'c'|'cpp'|'css'|'html'|'diff'|'md'|'docker'|'powershell'; full names work too), code (string, \n lines)
//        focus: [{lines: [a, b] (1-based, inclusive; a number = one line), note, say|at}]
//        diff?: {line, newText, say|at} — line `line` is struck out and `newText` typed in its place
//        keyLine?: {line, text, say|at} — final focus: marker ellipse + hand-written `text`
//        tabs?: string[] (extra, inactive file tabs), branch? (status bar, e.g. "main")
// Every timed item gets `from` (frame) from prepare.py; without it the items are spread over the scene.
// Long code (up to ~30 lines) shrinks to fit, then scrolls so the focused range stays in view.
// 16:9: editor left, callout to its right (kept in the upper half; lower right is mascot room).
// 9:16: editor fills the middle band, the callout sits under it (left 2/3).
type Focus = { lines: [number, number] | number; note: string; from?: number };
type Diff = { line: number; newText: string; from?: number };
type KeyLine = { line: number; text: string; from?: number };
type Tok = { text: string; color: string };

const LANGS: Record<string, { prism: string; badge: string; name: string; color: string }> = {
  ts: { prism: 'typescript', badge: 'TS', name: 'TypeScript', color: '#4E9BFF' },
  tsx: { prism: 'tsx', badge: 'TSX', name: 'TypeScript JSX', color: '#4E9BFF' },
  js: { prism: 'javascript', badge: 'JS', name: 'JavaScript', color: '#F7DF1E' },
  jsx: { prism: 'jsx', badge: 'JSX', name: 'JavaScript JSX', color: '#F7DF1E' },
  py: { prism: 'python', badge: 'PY', name: 'Python', color: '#FFD43B' },
  bash: { prism: 'bash', badge: 'SH', name: 'Shell', color: '#8BE38B' },
  json: { prism: 'json', badge: '{}', name: 'JSON', color: '#F5A623' },
  yaml: { prism: 'yaml', badge: 'YML', name: 'YAML', color: '#FF7F7F' },
  sql: { prism: 'sql', badge: 'SQL', name: 'SQL', color: '#E38C00' },
  go: { prism: 'go', badge: 'GO', name: 'Go', color: '#00ADD8' },
  rust: { prism: 'rust', badge: 'RS', name: 'Rust', color: '#DEA584' },
  java: { prism: 'java', badge: 'JV', name: 'Java', color: '#F89820' },
  c: { prism: 'c', badge: 'C', name: 'C', color: '#A8B9CC' },
  cpp: { prism: 'cpp', badge: 'C++', name: 'C++', color: '#659AD2' },
  css: { prism: 'css', badge: 'CSS', name: 'CSS', color: '#2965F1' },
  html: { prism: 'markup', badge: 'HTML', name: 'HTML', color: '#E44D26' },
  diff: { prism: 'diff', badge: 'DIFF', name: 'Diff', color: '#8B93A1' },
  md: { prism: 'markdown', badge: 'MD', name: 'Markdown', color: '#8B93A1' },
  docker: { prism: 'docker', badge: 'DKR', name: 'Dockerfile', color: '#2496ED' },
  powershell: { prism: 'powershell', badge: 'PS', name: 'PowerShell', color: '#5391FE' },
};
const ALIAS: Record<string, string> = {
  typescript: 'ts', javascript: 'js', python: 'py', sh: 'bash', shell: 'bash', zsh: 'bash', yml: 'yaml',
  markdown: 'md', dockerfile: 'docker', ps1: 'powershell', 'c++': 'cpp', markup: 'html', xml: 'html',
};
const COLORS: Record<string, string> = {
  keyword: '#C792EA', function: '#82AAFF', 'function-name': '#82AAFF', string: '#C3E88D', 'template-string': '#C3E88D',
  'template-punctuation': '#C3E88D', char: '#C3E88D', punctuation: '#8B93A1', 'interpolation-punctuation': '#89DDFF',
  operator: '#89DDFF', number: '#F78C6C', boolean: '#F78C6C', constant: '#F78C6C', 'class-name': '#FFCB6B', builtin: '#FFCB6B',
  decorator: '#FFCB6B', annotation: '#FFCB6B', comment: '#676E7B', shebang: '#676E7B', prolog: '#676E7B', arrow: '#89DDFF',
  parameter: '#E8EAED', property: '#82AAFF', key: '#82AAFF', variable: '#F07178', tag: '#F07178', 'attr-name': '#FFCB6B',
  'attr-value': '#C3E88D', selector: '#C3E88D', regex: '#89DDFF', important: '#FF5370', deleted: '#FF8A80', inserted: '#7CF29C',
  title: '#FFCB6B', url: '#89DDFF', symbol: '#F78C6C', namespace: '#B2CCD6',
};
const DIM = 0.28;
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// Prism token tree → lines of coloured runs (plain text for an unknown language).
const highlight = (code: string, prismLang: string): Tok[][] => {
  const grammar = Prism.languages[prismLang];
  if (!grammar) return code.split('\n').map((l) => (l ? [{ text: l, color: '#E8EAED' }] : []));
  const lines: Tok[][] = [[]];
  const walk = (tokens: unknown, color: string) => {
    for (const tk of tokens as (string | { type: string; alias?: string | string[]; content: unknown })[]) {
      if (typeof tk === 'string') {
        tk.split('\n').forEach((part, i) => {
          if (i > 0) lines.push([]);
          if (part) lines[lines.length - 1].push({ text: part, color });
        });
      } else {
        const alias = Array.isArray(tk.alias) ? tk.alias[0] : tk.alias;
        const c = COLORS[tk.type] ?? (alias ? COLORS[alias] : undefined) ?? color;
        walk(Array.isArray(tk.content) ? tk.content : [tk.content], c);
      }
    }
  };
  walk(Prism.tokenize(code, grammar), '#E8EAED');
  return lines;
};
// D2Coding: latin half-width, Hangul full-width. Width in em.
const emW = (s: string) => [...s].reduce((w, ch) => w + (/[ㄱ-힣]/.test(ch) ? 1 : ch === '\t' ? 2 : 0.5), 0);
// Hand / body fonts: rough width in px.
const textW = (s: string, fs: number) => [...s].reduce((w, ch) => w + (/[ᄀ-퟿　-鿿]/.test(ch) ? 1 : ch === ' ' ? 0.3 : 0.56) * fs, 0);

// Red marker ellipse (the shared Doodle circle tops out at ~1000 px of stroke): drawn on in stepped
// strokes and re-wobbled every 3 frames, overshooting its start like a real pen.
const MarkerEllipse: React.FC<{ at: number; cx: number; cy: number; rx: number; ry: number }> = ({ at, cx, cy, rx, ry }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const start = Math.round(at * fps);
  if (frame < start) return null;
  const drawn = Math.min(1, Math.floor((frame - start) / 2) / 5);
  const step = Math.floor(frame / 3);
  const jit = (k: string) => (random(`me-${k}-${step}`) - 0.5) * 8;
  const N = 28;
  const pts = Array.from({ length: N + 1 }, (_, k) => {
    const a = -2.6 + (k / N) * Math.PI * 2.18;
    const r = 1 + (k / N) * 0.06 + (random(`mer-${k}`) - 0.5) * 0.05;
    return `${cx + Math.cos(a) * rx * r + jit('x' + k)},${cy + Math.sin(a) * ry * r + jit('y' + k)}`;
  });
  return (
    <svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
      <path d={`M${pts.join(' L')}`} fill="none" stroke={theme.doodle} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - drawn} />
    </svg>
  );
};

const Runs: React.FC<{ toks: Tok[]; chars?: number }> = ({ toks, chars = Infinity }) => {
  let left = chars;
  return (
    <>
      {toks.map((tk, i) => {
        if (left <= 0) return null;
        const s = tk.text.slice(0, left);
        left -= tk.text.length;
        return <span key={i} style={{ color: tk.color }}>{s}</span>;
      })}
    </>
  );
};

export const CodeScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { vertical, width, height } = useLayout();
  const p = scene.props as {
    filename?: string; language?: string; code?: string; focus?: Focus[]; diff?: Diff; keyLine?: KeyLine; tabs?: string[]; branch?: string;
  };
  const filename = p.filename ?? '';
  const langKey = ALIAS[(p.language ?? '').toLowerCase()] ?? (p.language ?? '').toLowerCase();
  const lang = LANGS[langKey] ?? { prism: langKey, badge: langKey.slice(0, 3).toUpperCase() || 'TXT', name: p.language ?? 'Plain Text', color: '#8B93A1' };
  const code = (p.code ?? '').replace(/\t/g, '  ').replace(/\n+$/, '');
  const src = code.split('\n');
  const nLines = src.length;
  const okLine = (n: number | undefined) => n != null && n >= 1 && n <= nLines;
  const diff = p.diff && okLine(p.diff.line) ? p.diff : undefined;
  const keyLine = p.keyLine && okLine(p.keyLine.line) ? p.keyLine : undefined;
  const rawFocus = (p.focus ?? []).map((f) => {
    const [a, b] = Array.isArray(f.lines) ? f.lines : [f.lines, f.lines];
    return { ...f, lines: [Math.max(1, Math.min(nLines, a)), Math.max(1, Math.min(nLines, b ?? a))] as [number, number] };
  });
  const t = frame / fps;
  const F = (s: number) => Math.round(s * fps);

  // ---- Timing: `from` from prepare.py, else spread focus → (diff after its focus) → key line ----
  type Ev = { kind: 'focus' | 'diff' | 'key'; i: number };
  const order: Ev[] = rawFocus.map((_, i) => ({ kind: 'focus' as const, i }));
  if (diff) {
    const host = rawFocus.findIndex((f) => diff.line >= f.lines[0] && diff.line <= f.lines[1]);
    order.splice(host >= 0 ? host + 1 : order.length, 0, { kind: 'diff', i: 0 });
  }
  if (keyLine) order.push({ kind: 'key', i: 0 });
  const s0 = 1.0 * fps;
  const s1 = Math.max(s0 + 1, scene.frames - 1.5 * fps);
  const slot = (ev: Ev) => {
    const j = order.findIndex((o) => o.kind === ev.kind && o.i === ev.i);
    return (order.length <= 1 ? s0 : s0 + (j * (s1 - s0)) / (order.length - 1)) / fps;
  };
  const focusList = rawFocus.map((f, i) => ({ ...f, at: f.from != null ? f.from / fps : slot({ kind: 'focus', i }) }));
  const diffAt = diff ? (diff.from != null ? diff.from / fps : slot({ kind: 'diff', i: 0 })) : 0;
  const keyAt = keyLine ? (keyLine.from != null ? keyLine.from / fps : slot({ kind: 'key', i: 0 })) : 0;

  // ---- Layout per format ----
  // 9:16: the window ends ~y 1000 so the callout fits under it and the mascot (y ≈ 980–1280, right) stays clear.
  const WIN = vertical ? { left: 40, top: 300, width: 1000, height: 700 } : { left: 140, top: 116, width: 1080, height: 790 };
  const BAR = vertical ? 72 : 64;
  const STATUS = vertical ? 44 : 40;
  const PAD_TOP = 18;
  const GUTTER = vertical ? 74 : 96;
  const viewTop = WIN.top + BAR;
  const viewH = WIN.height - BAR - STATUS;
  const codeLeft = GUTTER + 20; // x of column 0 inside the window
  const codeW = WIN.width - codeLeft - 26;
  const maxEm = Math.max(1, ...src.map(emW), diff ? emW(diff.newText) : 0);
  const baseFs = vertical ? 32 : 29;
  const minFs = vertical ? 25 : 23; // readability floor: longer lines are clipped at the window edge
  const fitFs = (viewH - PAD_TOP * 2) / (nLines * 1.58);
  const FS = Math.max(minFs, Math.min(baseFs, codeW / maxEm, fitFs)); // taller code scrolls
  const LH = Math.round(FS * 1.58);
  const CODE_X = WIN.left + codeLeft;
  const pxW = (s: string) => emW(s) * FS;

  const toks = highlight(code, lang.prism);
  const newToks = diff ? highlight(diff.newText, lang.prism)[0] ?? [] : [];

  // Diff timing
  const strike = diff ? interpolate(t, [diffAt, diffAt + 0.35], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) }) : 0;
  const insert = diff ? spring({ frame: frame - F(diffAt + 0.45), fps, config: { damping: 200 }, durationInFrames: 12 }) : 0;
  const typed = diff ? Math.floor(Math.max(0, t - (diffAt + 0.65)) * 45) : 0;
  const collapse = diff ? spring({ frame: frame - F(diffAt + 0.65 + diff.newText.length / 45 + 0.5), fps, config: { damping: 200 }, durationInFrames: 14 }) : 0;

  // Rows (code lines plus the inserted diff row) with animated heights, y relative to the content top.
  type Row = { n: number; kind: 'code' | 'old' | 'new'; h: number; y: number };
  const rows: Row[] = [];
  let y = PAD_TOP;
  src.forEach((_, i) => {
    const n = i + 1;
    const isOld = !!diff && diff.line === n;
    const h = isOld ? LH * (1 - collapse) : LH;
    rows.push({ n, kind: isOld ? 'old' : 'code', h, y });
    y += h;
    if (isOld) {
      const nh = LH * insert;
      rows.push({ n, kind: 'new', h: nh, y });
      y += nh;
    }
  });
  const contentH = y + PAD_TOP;
  const rangeBoxRel = (a: number, b: number) => {
    const rs = rows.filter((r) => r.n >= a && r.n <= b && r.h > 0.5);
    if (!rs.length) return { top: PAD_TOP, bottom: PAD_TOP + LH, right: CODE_X };
    const top = Math.min(...rs.map((r) => r.y));
    const bottom = Math.max(...rs.map((r) => r.y + r.h));
    const w = Math.max(...rs.map((r) => pxW(r.kind === 'new' ? diff!.newText : src[r.n - 1])));
    return { top, bottom, right: CODE_X + w };
  };

  // Focus sequence (the key line becomes the last focus, without a callout).
  const focus: { lines: [number, number]; note: string; at: number; key?: boolean }[] = [...focusList];
  if (keyLine) focus.push({ lines: [keyLine.line, keyLine.line], note: '', at: keyAt, key: true });
  focus.sort((a, b) => a.at - b.at);
  const fi = focus.reduce((acc, f, i) => (t >= f.at ? i : acc), -1);
  const cur = fi >= 0 ? focus[fi] : undefined;
  const prev = fi > 0 ? focus[fi - 1] : undefined;
  const fp = cur ? spring({ frame: frame - F(cur.at), fps, config: { damping: 200 }, durationInFrames: 12 }) : 0;
  const mix = (a: number | undefined, b: number) => (a == null ? b : a + (b - a) * fp);

  // Scroll: keep the focused range centred when the code is taller than the view.
  const maxScroll = Math.max(0, contentH - viewH);
  const scrollFor = (f?: { lines: [number, number] }) => {
    if (!f || maxScroll <= 0) return 0;
    const b = rangeBoxRel(f.lines[0], f.lines[1]);
    return Math.max(0, Math.min(maxScroll, (b.top + b.bottom) / 2 - viewH / 2));
  };
  const scroll = cur ? mix(prev ? scrollFor(prev) : 0, scrollFor(cur)) : 0;
  const toFrame = (rel: number) => viewTop + rel - scroll;
  const rangeBox = (a: number, b: number) => {
    const r = rangeBoxRel(a, b);
    return { top: toFrame(r.top), bottom: toFrame(r.bottom), mid: toFrame((r.top + r.bottom) / 2), right: r.right };
  };
  const inRange = (f: { lines: [number, number] } | undefined, n: number) => !f || (n >= f.lines[0] && n <= f.lines[1]);
  const bright = (n: number) => {
    if (!cur) return 1;
    const a = prev ? (inRange(prev, n) ? 1 : DIM) : 1;
    const b = inRange(cur, n) ? 1 : DIM;
    return a + (b - a) * fp;
  };
  const curBox = cur ? rangeBox(cur.lines[0], cur.lines[1]) : undefined;
  const prevBox = prev ? rangeBox(prev.lines[0], prev.lines[1]) : undefined;
  const bar = curBox ? { top: mix(prevBox?.top, curBox.top), bottom: mix(prevBox?.bottom, curBox.bottom) } : undefined;
  const barIn = cur ? (prev ? 1 : fp) : 0;

  // ---- Callout ----
  const notes = focusList.map((f) => f.note ?? '');
  const calloutFocus = cur && !cur.key ? cur : undefined;
  const calloutOut = keyLine ? spring({ frame: frame - F(keyAt), fps, config: { damping: 200 }, durationInFrames: 10 }) : 0;
  const calloutIn = focusList.length ? spring({ frame: frame - F(Math.min(...focusList.map((f) => f.at))), fps, config: { damping: 14, mass: 0.6 } }) : 0;
  const prevNote = prev && !prev.key ? prev.note : '';
  const noteFs = vertical ? 40 : 35;
  const CO = vertical
    ? { left: WIN.left, width: 720, x: WIN.left }
    : { left: 1270, width: 510, x: 1270 };
  const noteLines = (s: string) => s.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(textW(l, noteFs) / (CO.width - 60))), 0);
  const coH = 66 + Math.max(1, ...notes.map(noteLines)) * noteFs * 1.22 + 18;
  const coTopV = WIN.top + WIN.height + 22;
  const cMidRaw = curBox ? mix(prevBox?.mid, curBox.mid) : 0;
  const cMid = Math.max(WIN.top + BAR + coH / 2, Math.min(560, cMidRaw)); // callout centre (16:9), upper half
  const cRight = curBox ? Math.min(WIN.left + WIN.width - 40, mix(prevBox?.right, curBox.right) + 36) : 0;
  const pointNo = calloutFocus ? focusList.indexOf(calloutFocus as (typeof focusList)[number]) + 1 : 0;

  const winIn = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 14 });
  const cursorOn = Math.floor(frame / 15) % 2 === 0;
  const lnNow = cur ? cur.lines[1] : 1;

  // ---- Key-line marker ----
  const keyRow = keyLine ? rows.find((r) => r.n === keyLine.line && r.kind === 'code') : undefined;
  const keySrc = keyLine ? src[keyLine.line - 1] : '';
  const keyW = Math.max(FS * 2, pxW(keySrc.trimStart()));
  const keyX = CODE_X + pxW(keySrc.match(/^\s*/)![0]);
  const keyY = keyRow ? toFrame(keyRow.y) : 0;
  const keyTextW = keyLine ? textW(keyLine.text, 64) * 0.85 : 0;
  // hand-drawn arrow from upper left down to just past the end of the key line
  const arrowX = Math.min(width - 420, keyX + Math.min(keyW, WIN.left + WIN.width - keyX - 40) - 60);
  const arrowY = Math.max(130, keyY - 190);

  const fsBar = vertical ? 26 : 25;
  return (
    <>
      <div style={{ position: 'absolute', left: 0, top: 0, width, height, opacity: 0.3 + 0.7 * winIn, transform: `translateY(${(1 - winIn) * 30}px)` }}>
        {/* Editor window */}
        <div style={{ position: 'absolute', ...WIN, background: '#0F1014', border: `2px solid ${theme.panelBorder}`, borderRadius: 20, overflow: 'hidden', boxShadow: '0 40px 90px rgba(0,0,0,.5)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', height: BAR, background: '#16171C', borderBottom: `2px solid ${theme.panelBorder}`, paddingLeft: 22 }}>
            <div style={{ display: 'flex', gap: 10, alignSelf: 'center', marginRight: 26 }}>
              {['#ff5f57', '#febc2e', '#28c840'].map((c) => <div key={c} style={{ width: 16, height: 16, borderRadius: 8, background: c }} />)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: BAR - 14, padding: '0 22px', background: '#0F1014', borderRadius: '12px 12px 0 0', borderTop: `3px solid ${theme.accent}`, marginBottom: -2, flexShrink: 0 }}>
              <span style={{ fontFamily: theme.mono, fontWeight: 700, fontSize: fsBar * 0.76, color: '#111', background: lang.color, borderRadius: 5, padding: '1px 6px' }}>{lang.badge}</span>
              <span style={{ fontFamily: theme.mono, fontSize: fsBar, color: theme.bone, whiteSpace: 'nowrap' }}>{filename}</span>
            </div>
            {(p.tabs ?? []).map((tab) => (
              <div key={tab} style={{ height: BAR - 14, padding: '0 22px', display: 'flex', alignItems: 'center', fontFamily: theme.mono, fontSize: fsBar * 0.92, color: '#5C606B', whiteSpace: 'nowrap' }}>{tab}</div>
            ))}
          </div>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: STATUS, background: '#16171C', borderTop: `2px solid ${theme.panelBorder}`, display: 'flex', alignItems: 'center', gap: 28, padding: '0 22px', fontFamily: theme.mono, fontSize: fsBar * 0.76, color: theme.muted }}>
            {p.branch && <span style={{ color: theme.accent }}>● {p.branch}</span>}
            <span>Ln {lnNow}, Col 1</span>
            <span style={{ marginLeft: 'auto' }}>{lang.name}</span>
            <span>UTF-8</span>
          </div>
          {/* Code viewport (clips while scrolling) */}
          <div style={{ position: 'absolute', left: 0, top: BAR, width: WIN.width, height: viewH, overflow: 'hidden' }}>
            {bar && (
              <>
                <div style={{ position: 'absolute', left: 2, width: WIN.width - 4, top: bar.top - viewTop - 4, height: bar.bottom - bar.top + 8, background: `${theme.accent}12`, opacity: barIn }} />
                <div style={{ position: 'absolute', left: 8, width: 6, top: bar.top - viewTop - 4, height: bar.bottom - bar.top + 8, borderRadius: 3, background: theme.accent, boxShadow: `0 0 16px ${theme.accent}`, opacity: barIn }} />
              </>
            )}
            {rows.map((r, i) => {
              if (r.h < 0.5) return null;
              const top = r.y - scroll;
              if (top > viewH || top + r.h < 0) return null;
              const lineIn = interpolate(t, [0.25 + Math.min(r.n, 20) * 0.04, 0.55 + Math.min(r.n, 20) * 0.04], [0, 1], clamp);
              const b = bright(r.n);
              const isOld = r.kind === 'old';
              const isNew = r.kind === 'new';
              const band = isOld && strike > 0 ? 'rgba(255,77,64,0.16)' : isNew ? `rgba(52,199,89,${0.18 * (1 - collapse * 0.6)})` : 'transparent';
              const num = isOld && strike > 0 ? '-' : isNew ? (collapse > 0.5 ? String(r.n) : '+') : String(r.n);
              const numColor = isOld && strike > 0 ? '#FF6B60' : isNew && collapse <= 0.5 ? '#5BE08A' : '#4C505B';
              const text = isNew ? diff!.newText : src[r.n - 1];
              return (
                <div key={i} style={{ position: 'absolute', left: 2, width: WIN.width - 4, top, height: r.h, overflow: 'hidden', background: band, opacity: lineIn * (isOld ? 1 - collapse : 1) }}>
                  <div style={{ position: 'absolute', left: 0, width: GUTTER, top: 0, height: LH, lineHeight: `${LH}px`, textAlign: 'right', fontFamily: theme.mono, fontSize: FS * 0.83, color: numColor, opacity: b }}>{num}</div>
                  <div style={{ position: 'absolute', left: codeLeft - 2, top: 0, height: LH, lineHeight: `${LH}px`, fontFamily: theme.mono, fontSize: FS, whiteSpace: 'pre', opacity: b, transform: `translateX(${(1 - lineIn) * 16}px)` }}>
                    {isNew ? <Runs toks={newToks} chars={typed} /> : <Runs toks={toks[r.n - 1] ?? []} />}
                    {isNew && typed < text.length && cursorOn && <span style={{ display: 'inline-block', width: 3, height: FS, background: theme.bone, verticalAlign: 'middle' }} />}
                  </div>
                  {isOld && strike > 0 && (
                    <div style={{ position: 'absolute', left: codeLeft - 2 + pxW(text.match(/^\s*/)![0]) - 6, top: LH / 2 - 2, height: 4, borderRadius: 2, background: '#FF5A4E', width: (pxW(text.trimStart()) + 12) * strike }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Callout */}
      {calloutFocus && curBox && calloutOut < 1 && (
        <div style={{ position: 'absolute', left: 0, top: 0, opacity: calloutIn * (1 - calloutOut) }}>
          {!vertical && (
            <svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
              <path d={`M${CO.x - 8},${cMid} C${CO.x - 60},${cMid} ${cRight + 60},${cMidRaw} ${cRight + 14},${cMidRaw}`} fill="none" stroke={theme.accent} strokeWidth={5} strokeLinecap="round" />
              <path d={`M${cRight + 32},${cMidRaw - 14} L${cRight + 12},${cMidRaw} L${cRight + 32},${cMidRaw + 14}`} fill="none" stroke={theme.accent} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={CO.x - 8} cy={cMid} r={7} fill={theme.accent} />
            </svg>
          )}
          <div
            style={{
              position: 'absolute', left: CO.left, top: vertical ? coTopV : cMid - coH / 2, width: CO.width, height: coH,
              transform: vertical ? `translateY(${(1 - calloutIn) * 30}px)` : `translateX(${(1 - calloutIn) * 40}px)`,
            }}
          >
            <div style={{ position: 'absolute', inset: 0, background: theme.panel, border: `3px solid ${theme.accent}`, borderRadius: 22, boxShadow: `0 24px 60px rgba(0,0,0,.45), 0 0 30px ${theme.accent}33` }} />
            <div style={{ position: 'absolute', left: 30, top: 18, fontFamily: theme.font, fontWeight: 800, fontSize: vertical ? 24 : 21, color: theme.accent, letterSpacing: 2 }}>
              POINT {pointNo} · L{calloutFocus.lines[0]}{calloutFocus.lines[1] !== calloutFocus.lines[0] ? `–${calloutFocus.lines[1]}` : ''}
            </div>
            {[prevNote, calloutFocus.note].map((note, j) => {
              const o = j === 0 ? Math.max(0, 1 - fp * 2) : Math.max(0, fp * 2 - 1); // out, then in: no overlap
              if (!note || o <= 0.01) return null;
              return (
                <div key={j} style={{ position: 'absolute', left: 30, right: 24, top: 56, fontFamily: theme.font, fontWeight: 800, fontSize: noteFs, lineHeight: 1.22, color: theme.bone, whiteSpace: 'pre-line', wordBreak: 'keep-all', opacity: o, transform: `translateY(${j === 0 ? -fp * 14 : (1 - fp) * 14}px)` }}>
                  {note}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Key-line marker */}
      {keyLine && keyRow && (
        <>
          <MarkerEllipse at={keyAt + 0.1} cx={keyX + Math.min(keyW, WIN.left + WIN.width - keyX - 40) / 2} cy={keyY + LH / 2} rx={Math.min(keyW, WIN.left + WIN.width - keyX - 40) / 2 + 40} ry={LH / 2 + 14} />
          {vertical ? (
            <Doodle i={3} d={{ type: 'text', at: keyAt + 0.5, x: (90 / width) * 100, y: ((WIN.top + WIN.height + 40) / height) * 100, text: keyLine.text, rotate: -4 }} />
          ) : (
            <>
              <Doodle i={2} d={{ type: 'arrow', at: keyAt + 0.45, x: (arrowX / width) * 100, y: (arrowY / height) * 100, w: 130 / 19.2, h: Math.max(60, keyY - arrowY - 10) / 10.8, rotate: 0 }} />
              <Doodle i={3} d={{ type: 'text', at: keyAt + 0.6, x: (Math.min(width - 80 - keyTextW, arrowX + 110) / width) * 100, y: (Math.max(120, arrowY - 80) / height) * 100, text: keyLine.text, rotate: -5 }} />
            </>
          )}
        </>
      )}
    </>
  );
};
