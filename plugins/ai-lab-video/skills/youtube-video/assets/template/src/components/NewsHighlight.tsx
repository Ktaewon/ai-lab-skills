import React from 'react';

// Yellow highlighter used by the news and doc scenes (same look as components/Marker.tsx, but driven
// by a progress value so a scene can sweep it word by word on its own clock).

// One word of the sweep. q: 0 → 1 fill progress of this word.
export const HlWord: React.FC<{ text: string; q: number; style?: React.CSSProperties }> = ({ text, q, style }) => (
  <span
    style={{
      backgroundImage: 'linear-gradient(100deg, transparent 0.6%, rgba(255,225,77,0.95) 1.2%, rgba(255,225,77,0.95) 98%, transparent 99.4%)',
      backgroundSize: `${q * 100}% 72%`, backgroundPosition: '0 70%', backgroundRepeat: 'no-repeat',
      padding: '0 0.08em', margin: '0 -0.08em', borderRadius: 6,
      WebkitBoxDecorationBreak: 'clone', boxDecorationBreak: 'clone', ...style,
    }}
  >
    {text}
  </span>
);

// `text` with `phrase` swept by the highlighter (p: 0 → 1 over the whole phrase, word by word).
// A phrase that is not in the text leaves the text plain.
export const Highlighted: React.FC<{ text: string; phrase?: string; p: number }> = ({ text, phrase, p }) => {
  const at = phrase ? text.indexOf(phrase) : -1;
  if (!phrase || at < 0) return <>{text}</>;
  const words = phrase.split(/(?<= )/);
  return (
    <>
      {text.slice(0, at)}
      {words.map((w, k) => (
        <HlWord key={k} text={w} q={Math.max(0, Math.min(1, p * words.length - k))} />
      ))}
      {text.slice(at + phrase.length)}
    </>
  );
};

// Rough rendered width of a string: Hangul ≈ 0.95em, latin/digits ≈ 0.55em, space ≈ 0.28em.
export const textWidth = (s: string, fs: number) =>
  [...s].reduce((w, ch) => w + (/[ᄀ-ᇿ㄰-㆏가-힣　-鿿]/.test(ch) ? 0.95 : ch === ' ' ? 0.28 : 0.56) * fs, 0);
