import React, { useLayoutEffect, useRef, useState } from 'react';
import { continueRender, delayRender, Easing, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { safeArea, theme, useLayout } from '../theme';
import type { Scene } from '../types';
import { HlWord, textWidth } from '../components/NewsHighlight';

// Document evidence pull-in ("원문 확인"). A paper page slides in, the camera pushes into one
// paragraph, the key sentence gets the yellow highlighter while everything else dims, a citation
// tag pops under it, then a red marker circle and a post-it comment land on top. Use it when the
// narration quotes a paper, system card, terms of service, press release or law: the proof is on
// the page. Paragraphs are quoted from the real source (trim, don't rewrite); with `image` the real
// page screenshot is shown instead.
//
// props: source: {title, doc? (short name in the page header), page?, date?}
//        section? (heading above the paragraphs), paragraphs: string[] (3–6 is ideal)
//        highlight: {para (index), text (exact sentence inside that paragraph), circle? (word inside `text`
//                    to ring in red marker), from}
//        cite? ({from} — "출처 <title> p.<page>" tag; default ~1.3 s after the highlight; false hides it)
//        circleMark? ({from} — when the red circle is drawn; default ~2.2 s after the highlight)
//        note? ({text ('\n' allowed), from} — hand-written post-it)
//        image? (path in public/: a real page screenshot used instead of rendered paragraphs; then
//                highlight takes box: {x, y, w, h} in % of the image, and circle: true rings the box)
//        Timing: the camera push ends right before the highlight; without timing the highlight lands ~35% in.
type Src = { title: string; doc?: string; page?: number | string; date?: string };
type Box = { x: number; y: number; w: number; h: number };
type Hl = { para?: number; text?: string; circle?: string | boolean; box?: Box; from?: number };

export const DocScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { vertical } = useLayout();
  const safe = safeArea(vertical);
  const p = scene.props as {
    source?: Src; section?: string; paragraphs?: string[]; highlight?: Hl;
    cite?: { from?: number } | false; circleMark?: { from?: number }; note?: { text: string; from?: number }; image?: string;
  };
  const source: Src = p.source ?? { title: '' };
  const paragraphs = p.paragraphs ?? [];
  const hlRaw: Hl = p.highlight ?? {};
  const image = p.image;
  const sec = (s: number) => Math.round(s * fps);

  // Page geometry in final screen px (the camera ends at scale 1, so the settled page is crisp).
  const G = vertical
    ? { w: 1000, pad: 80, fs: 42, lh: 1.6, gap: 34, headFs: 27, secFs: 50, cx: 540, cy: 720 }
    : { w: 1243, pad: 104, fs: 34, lh: 1.62, gap: 34, headFs: 27, secFs: 47, cx: 960, cy: 515 };
  const textW = G.w - G.pad * 2;

  // Measure the real layout once fonts (and the screenshot) are ready; estimates are only the fallback.
  const pageRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement>(null);
  const [handle] = useState(() => delayRender('doc layout'));
  const [m, setM] = useState<{ top: number; h: number; pageH: number } | null>(null);
  const [aspect, setAspect] = useState<number | null>(null);
  useLayoutEffect(() => {
    let alive = true;
    const imgReady = image
      ? new Promise<void>((res) => {
          const im = new Image();
          im.onload = () => { if (alive) setAspect(im.naturalHeight / Math.max(1, im.naturalWidth)); res(); };
          im.onerror = () => res();
          im.src = staticFile(image);
        })
      : Promise.resolve();
    Promise.all([document.fonts.ready, imgReady]).then(() => {
      requestAnimationFrame(() => {
        if (alive && !image && targetRef.current && pageRef.current) {
          setM({ top: targetRef.current.offsetTop, h: targetRef.current.offsetHeight, pageH: pageRef.current.offsetHeight });
        }
        continueRender(handle);
      });
    });
    return () => { alive = false; };
  }, [handle, image]);

  // Fallback estimate of the paragraph tops (header band + wrapped lines).
  const HEAD = 70 + G.headFs * 1.4 + 40 + (p.section ? Math.ceil(textWidth(p.section, G.secFs) / textW) * G.secFs * 1.3 + 40 : 10);
  const paraH = (s: string) => Math.ceil(textWidth(s, G.fs) / (textW * 0.97)) * G.fs * G.lh;
  const tops: number[] = [];
  let yy = HEAD;
  for (const s of paragraphs) { tops.push(yy); yy += paraH(s) + G.gap; }
  const minPageH = G.w * 1.3;
  const estPageH = Math.max(minPageH, yy + 180);

  const ti = Math.max(0, Math.min(paragraphs.length - 1, hlRaw.para ?? 0));
  const pageH = image ? G.w * (aspect ?? 1.3) : (m?.pageH ?? estPageH);
  const box = hlRaw.box;
  const target = image
    ? { x: box ? ((box.x + box.w / 2) / 100) * G.w : G.w / 2, y: box ? ((box.y + box.h / 2) / 100) * pageH : pageH / 2 }
    : { x: G.w / 2, y: m ? m.top + m.h / 2 : (tops[ti] ?? HEAD) + paraH(paragraphs[ti] ?? '') / 2 };

  // Timing
  const hlF = hlRaw.from ?? Math.max(sec(2.6), Math.round(scene.frames * 0.35));
  const pushEnd = Math.max(sec(0.6), hlF - sec(0.25));
  const pushStart = Math.max(0, Math.min(pushEnd - sec(0.8), Math.max(sec(0.6), pushEnd - sec(2.6))));
  const citeF = p.cite === false ? null : (p.cite?.from ?? hlF + sec(1.3));
  const circleF = p.circleMark?.from ?? (hlRaw.circle ? hlF + sec(2.2) : null);
  const noteF = p.note ? (p.note.from ?? hlF + sec(3.0)) : null;

  // Camera: overview (whole page) → push to scale 1 on the target; afterwards translate-only drift.
  const availH = vertical ? 1920 - safe.top - safe.bottom : 1080 - 150;
  const s0 = Math.min(0.62, (availH * 0.98) / pageH, (vertical ? 1000 : 1700) / G.w);
  const push = interpolate(frame, [pushStart, pushEnd], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.bezier(0.6, 0, 0.2, 1) });
  const drift = interpolate(frame, [pushEnd, scene.frames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) * -16;
  const s = s0 + (1 - s0) * push;
  const fx = G.w / 2 + (target.x - G.w / 2) * push;
  const fy = pageH / 2 + (target.y - pageH / 2) * push;
  // final anchor chosen so the settled page sits on whole pixels (no re-sampling of the text)
  const cx = Math.round(G.cx - target.x) + target.x;
  const cy = Math.round(G.cy - target.y) + target.y;
  const oy = vertical ? safe.top + availH / 2 : 560;
  const ax = G.cx + (cx - G.cx) * push;
  const ay = oy + (cy - oy) * push;
  const enter = spring({ frame, fps, config: { damping: 18, mass: 1, stiffness: 80 } });
  const tx = ax - s * fx;
  const ty = ay - s * fy + (1 - enter) * 900 + drift;

  const hl = interpolate(frame, [hlF, hlF + sec(0.9)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.quad) });
  const dim = interpolate(frame, [hlF + sec(0.6), hlF + sec(1.2)], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const cite = citeF == null ? 0 : spring({ frame: frame - citeF, fps, config: { damping: 11, mass: 0.7, stiffness: 160 } });
  const note = noteF == null ? 0 : spring({ frame: frame - noteF, fps, config: { damping: 9, mass: 0.6, stiffness: 170 } });
  const label = spring({ frame: frame - sec(0.4), fps, config: { damping: 16 } });

  const pageTag = [source.doc ?? source.title, source.page != null ? `p.${source.page}` : null].filter(Boolean).join(' · ');
  const citeTag =
    citeF != null && frame >= citeF ? (
      <div
        style={{
          position: 'absolute', left: -6, top: '100%', marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 24px', borderRadius: 14, zIndex: 5,
          background: theme.accent, color: '#16171C', boxShadow: '0 14px 30px rgba(0,0,0,0.35)', fontFamily: theme.font, fontWeight: 800, fontSize: vertical ? 36 : 32, whiteSpace: 'nowrap',
          opacity: Math.min(1, cite * 1.5), transform: `translateY(${(1 - cite) * 26}px) rotate(${-1 + (1 - cite) * -4}deg)`, transformOrigin: '0 50%',
        }}
      >
        <span style={{ fontFamily: theme.display, fontWeight: 400 }}>출처</span>
        <span>{source.title}{source.page != null ? ` p.${source.page}` : ''}</span>
      </div>
    ) : null;

  // Highlighted paragraph (text mode).
  const renderTarget = (para: string) => {
    const text = hlRaw.text && para.includes(hlRaw.text) ? hlRaw.text : '';
    const at = text ? para.indexOf(text) : -1;
    if (at < 0) return <span style={{ fontWeight: 700, color: '#111' }}><HlWord text={para} q={hl} /></span>;
    const words = text.split(/(?<= )/);
    const circ = typeof hlRaw.circle === 'string' ? hlRaw.circle : '';
    let circled = false;
    return (
      <>
        <span style={{ opacity: 1 - dim * 0.6 }}>{para.slice(0, at)}</span>
        {words.map((w, k) => {
          const q = Math.max(0, Math.min(1, hl * words.length - k));
          const c = circ && !circled ? w.indexOf(circ) : -1;
          if (c >= 0) circled = true;
          return (
            <span key={k} style={{ fontWeight: 700, color: '#111' }}>
              {c < 0 ? (
                <HlWord text={w} q={q} />
              ) : (
                <>
                  <HlWord text={w.slice(0, c)} q={q} />
                  <span style={{ position: 'relative', display: 'inline-block' }}>
                    <HlWord text={circ} q={q} />
                    {circleF != null && <Circle from={circleF} box={{ w: textWidth(circ, G.fs) + 50, h: G.fs * 2.25 }} />}
                  </span>
                  <HlWord text={w.slice(c + circ.length)} q={q} />
                </>
              )}
            </span>
          );
        })}
        <span style={{ opacity: 1 - dim * 0.6 }}>{para.slice(at + text.length)}</span>
      </>
    );
  };

  // own stacking context: the z-indexes below never rise above the scene's mascot / doodles
  return (
    <div style={{ position: 'absolute', inset: 0, isolation: 'isolate' }}>
      {/* camera */}
      <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${s})` }}>
        <div
          ref={pageRef}
          style={{
            position: 'relative', width: G.w, minHeight: image ? pageH : minPageH, background: '#FBF9F4', borderRadius: 6, transform: 'rotate(-1.4deg)',
            boxShadow: '0 40px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.08)', color: '#23242A', boxSizing: 'border-box',
            padding: image ? 0 : `70px ${G.pad}px 180px`,
          }}
        >
          {image ? (
            <div style={{ position: 'relative', width: G.w, height: pageH, overflow: 'hidden', borderRadius: 6 }}>
              <Img src={staticFile(image)} style={{ width: G.w, height: pageH, display: 'block' }} />
              {box && (
                <div style={{ position: 'absolute', left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%` }}>
                  <div style={{ position: 'absolute', inset: -6, borderRadius: 6, boxShadow: `0 0 0 4000px rgba(24,24,30,${0.5 * dim})` }} />
                  <div style={{ position: 'absolute', left: -6, top: -4, bottom: -4, width: `calc(${hl * 100}% + 12px)`, background: 'rgba(255,225,77,0.55)', mixBlendMode: 'multiply', borderRadius: 6 }} />
                  {circleF != null && hlRaw.circle && <Circle from={circleF} />}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* paper texture */}
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.09, mixBlendMode: 'multiply', pointerEvents: 'none' }}>
                <filter id="doc-paper">
                  <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="3" seed={7} />
                  <feColorMatrix type="saturate" values="0" />
                </filter>
                <rect width="100%" height="100%" filter="url(#doc-paper)" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.5), rgba(220,212,195,0.25) 90%)', pointerEvents: 'none' }} />

              {/* page header */}
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 20, fontFamily: theme.font, fontSize: G.headFs, fontWeight: 600, color: '#8A8578', opacity: 1 - dim * 0.6 }}>
                <span>{pageTag}</span>
                <span>{source.date}</span>
              </div>
              <div style={{ position: 'relative', height: 2, background: '#D8D2C4', margin: '14px 0 40px' }} />
              {p.section && (
                <div style={{ position: 'relative', fontFamily: theme.font, fontWeight: 800, fontSize: G.secFs, lineHeight: 1.3, color: '#16171C', marginBottom: 40, wordBreak: 'keep-all', opacity: 1 - dim * 0.7 }}>{p.section}</div>
              )}

              {/* paragraphs */}
              {paragraphs.map((para, i) => {
                const isT = i === ti;
                const base: React.CSSProperties = {
                  position: 'relative', marginBottom: G.gap, fontFamily: theme.font, fontSize: G.fs, lineHeight: G.lh, fontWeight: 500, wordBreak: 'keep-all', color: '#2A2B31',
                };
                if (!isT) return <div key={i} style={{ ...base, opacity: 1 - dim * 0.72 }}>{para}</div>;
                return (
                  <div key={i} ref={targetRef} style={{ ...base, zIndex: 2 }}>
                    {renderTarget(para)}
                    {citeTag}
                  </div>
                );
              })}

              {source.page != null && (
                <div style={{ position: 'absolute', left: 0, right: 0, bottom: 70, textAlign: 'center', fontFamily: theme.font, fontSize: 24, color: '#8A8578', opacity: 1 - dim * 0.6 }}>— {source.page} —</div>
              )}
            </>
          )}
          {/* image mode: citation tag under the box */}
          {image && box && (
            <div style={{ position: 'absolute', left: `${box.x}%`, top: `${box.y}%`, width: `${box.w}%`, height: `${box.h}%`, zIndex: 5 }}>{citeTag}</div>
          )}
        </div>
      </div>

      {/* evidence label (overview only) */}
      <div
        style={{
          position: 'absolute', left: safe.side, top: vertical ? safe.top - 10 : 110, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 24px', borderRadius: 14, maxWidth: vertical ? 940 : 1100,
          background: 'rgba(17,18,21,0.92)', border: `2px solid ${theme.panelBorder}`, opacity: label * (1 - push), transform: `translateX(${(1 - label) * -40}px)`,
        }}
      >
        <div style={{ width: 14, height: 14, borderRadius: 7, background: theme.accent, flexShrink: 0 }} />
        <div style={{ fontFamily: theme.display, fontSize: vertical ? 40 : 34, color: theme.bone, whiteSpace: 'nowrap' }}>원문 확인</div>
        <div style={{ fontFamily: theme.font, fontWeight: 600, fontSize: vertical ? 28 : 24, color: theme.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pageTag}</div>
      </div>

      {/* post-it comment */}
      {p.note && noteF != null && frame >= noteF && (
        <div
          style={{
            position: 'absolute', right: vertical ? 60 : 150, top: vertical ? safe.top + 20 : 150, maxWidth: vertical ? 420 : 380, padding: '26px 30px', background: theme.postit, color: '#222',
            fontFamily: theme.hand, fontSize: vertical ? 62 : 58, lineHeight: 1.05, whiteSpace: 'pre-line', wordBreak: 'keep-all', boxShadow: '0 10px 0 rgba(0,0,0,0.2), 0 24px 40px rgba(0,0,0,0.35)',
            transform: `rotate(${5 + (1 - note) * 12}deg) scale(${0.6 + 0.4 * note})`, opacity: Math.min(1, note * 1.6), transformOrigin: '50% 0', zIndex: 10,
          }}
        >
          <div style={{ position: 'absolute', left: '35%', top: -16, width: 110, height: 34, background: 'rgba(255,255,255,0.55)', transform: 'rotate(-4deg)' }} />
          {p.note.text}
        </div>
      )}
    </div>
  );
};

// Crude red marker ellipse, drawn on in stepped strokes and re-wobbled every 3 frames (stop-motion).
// box: px size centred on the parent (inline word); without it the ring hugs the parent box (image mode).
const Circle: React.FC<{ from: number; box?: { w: number; h: number } }> = ({ from, box }) => {
  const frame = useCurrentFrame();
  if (frame < from) return null;
  const drawn = Math.min(1, Math.floor((frame - from) / 2) / 4);
  const step = Math.floor(frame / 3);
  const pts = Array.from({ length: 15 }, (_, k) => {
    const a = (k / 13) * Math.PI * 2 - 0.5;
    const r = 1 + (random(`c${k}`) - 0.5) * 0.12;
    const jx = (random(`cx${k}-${step}`) - 0.5) * 0.6;
    const jy = (random(`cy${k}-${step}`) - 0.5) * 1.2;
    return `${50 + Math.cos(a) * 50 * r + jx},${50 + Math.sin(a) * 50 * r + jy}`;
  });
  return (
    <svg
      viewBox="0 0 100 100" preserveAspectRatio="none"
      style={{
        position: 'absolute', overflow: 'visible', pointerEvents: 'none', zIndex: 3,
        ...(box ? { left: '50%', top: '50%', width: box.w, height: box.h, marginLeft: -box.w / 2, marginTop: -box.h / 2 - 2 } : { left: '-9%', top: '-25%', width: '118%', height: '150%' }),
      }}
    >
      <path
        d={`M${pts.join(' L')}`} fill="none" stroke={theme.doodle} strokeWidth={6} vectorEffect="non-scaling-stroke"
        strokeLinecap="round" strokeLinejoin="round" pathLength={1000} strokeDasharray={1000} strokeDashoffset={1000 * (1 - drawn)}
      />
    </svg>
  );
};
