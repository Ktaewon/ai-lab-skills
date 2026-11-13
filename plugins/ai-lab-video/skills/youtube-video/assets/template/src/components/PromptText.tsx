import { theme } from '../theme';
import { MarkedText } from './Marker';

// Full prompt / result text, fitted into a box: picks font size and 1–2 columns from a rough
// line-wrap estimate (Korean ≈ 0.95 em per char, Latin/digits ≈ 0.55 em).
// SCOPE headers ("S — Situation", "P — Parameters" ...) get the accent colour on their letters.
const charW = (ch: string) => (/[ㄱ-힝]/.test(ch) ? 0.95 : /\s/.test(ch) ? 0.3 : 0.56);

export const fitText = (text: string, width: number, height: number, maxFs = 36, minFs = 17, lh = 1.45) => {
  const lines = text.split('\n');
  for (let fs = maxFs; fs >= minFs; fs -= 1) {
    for (const cols of [1, 2]) {
      const gap = 48;
      const colW = (width - gap * (cols - 1)) / cols;
      let rows = 0;
      for (const l of lines) {
        const w = [...l].reduce((n, c) => n + charW(c), 0) * fs;
        rows += Math.max(1, Math.ceil(w / (colW * 0.97)));
      }
      // columns break between lines, allow a little slack per column
      if ((rows / cols + (cols - 1) * 1.5) * fs * lh <= height) return { fs, cols };
    }
  }
  return { fs: minFs, cols: 2 };
};

const SCOPE = /^([SCOPE])(\s*[—-]\s*)(Situation|Context|Objective|Parameters|Evaluation)?(.*)$/;

// progress (0..1, optional): how far the narration has read; the paragraph being read stays bright,
// the others dim. Opacity only — no movement, so the text never shimmers.
export const PromptText: React.FC<{ text: string; width: number; height: number; maxFs?: number; mono?: boolean; progress?: number; activePara?: number }> = ({ text, width, height, maxFs, mono, progress, activePara }) => {
  const { fs, cols } = fitText(text, width, height, maxFs);
  const lines = text.split('\n');
  // paragraph index per line, and char offset where each paragraph starts
  const para: number[] = [];
  const paraStart: number[] = [0];
  let pi = 0, off = 0;
  lines.forEach((l, i) => {
    if (l.trim() === '' && i > 0 && lines[i - 1].trim() !== '') { pi += 1; paraStart.push(off); }
    para.push(pi); off += l.length + 1;
  });
  let active = activePara ?? -1;
  if (activePara === undefined && progress !== undefined) {
    const at = progress * text.length;
    active = paraStart.reduce((a, st, k) => (at >= st ? k : a), 0);
  }
  const op = (i: number) => (active < 0 ? 1 : para[i] === active ? 1 : 0.38);
  return (
    <div
      style={{
        width, height, columnCount: cols, columnGap: 48, columnFill: 'auto',
        fontSize: fs, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'keep-all', overflowWrap: 'anywhere',
        fontFamily: mono ? theme.mono : theme.font, color: theme.bone,
      }}
    >
      {text.split('\n').map((line, i) => {
        const m = line.match(SCOPE);
        if (m && (m[3] || m[4].trim() === '')) {
          return (
            <div key={i} style={{ breakInside: 'avoid', opacity: op(i) }}>
              <span style={{ color: theme.accent, fontWeight: 800 }}>{m[1]}</span>
              <span style={{ color: theme.muted }}>{m[2]}</span>
              <span style={{ color: theme.accent, fontWeight: 700 }}>{m[3] ?? ''}</span>
              <MarkedText text={m[4]} />
            </div>
          );
        }
        return <div key={i} style={{ opacity: op(i) }}>{line === '' ?' ' : <MarkedText text={line} />}</div>;
      })}
    </div>
  );
};
