# Style presets — pick from the content, not from habit

Choose ONE preset from what the story is about and how it should feel. Say the pick and the reason in one
line ("잉크 수묵 — 고요한 사찰 새벽 이야기라서"). If the user names a style or gives a reference, that wins.
Styles may be *inspired by* a studio or medium; never reproduce a specific film's characters, designs or shots.

| content / mood | preset |
|---|---|
| wonder, nature, nostalgia, giant creatures/machines, coming-of-age | **anime-cel** |
| calm, Eastern settings, philosophy, history, poetry, seasons | **ink-wash** |
| kids' story, cozy explainer, crafts, food, "how it works" with warmth | **papercut** |
| fairy tale, bedtime, gentle emotion, letters, memories | **storybook-watercolor** |
| tech explainer, data, product, process, AI concepts | **flat-motion** (or **lab-stage** for the channel) |
| mystery, tension, folklore, horror-lite, silhouettes | **shadow-puppet** |
| games, retro, internet culture, 8-bit nostalgia | **pixel** |
| lecture, math/science derivation, step-by-step | **chalkboard** |
| future, cyber, AI hype, night city, music | **neon** |

Common to all: one light direction; 4–6 depth layers; characters on twos (12 drawings/s) unless the preset
says otherwise; camera and particles may run on ones; grade + grain last.

---

## anime-cel  (theatrical hand-drawn anime look)
- **Palette**: painted, natural; warm light, cool-violet shadows (never grey/black shadows). Sky gradient 4–6 stops.
- **Characters**: `E.part` cel 2-tone + thin rim highlight, ink line 3–5 px @1080p, thicker on the shadow side.
  Mechanical forms `round:1` (chamfered), organic `round:2–3`. Coloured detail for scale (panel lines, rivets, wear,
  `E.hose` cables, vents, layered armour plates, jointed fingers).
- **Backgrounds**: `E.sky` with dabs (gouache), `E.cloud` 3-tone, `E.ridge` far hills, `E.foliage` for far rows
  (hazy, light, small) and `E.canopy` for mid/near rows (dark, saturated, big layered crowns). Background has **no outlines**; characters do.
- **Atmosphere**: `E.mist` strips between layers, `E.rays` god rays, warm light leak in `E.grade`.
- **Timing**: strong key poses, holds of 0.5–1.5 s, anticipation before big moves, overlapping debris/foliage.
- **FX**: cel-shaded hard-edged flames (`E.flame`), impact rings, leaf bursts.
- **Sound**: orchestral pad + flute/strings motif, nature bed, weighty foley.
- Reference implementation: `examples/lab01/` (mossy robot wakes and launches).

## ink-wash  (sumi-e)
- **Palette**: rice-paper `#efe6d2` with fibre speckle, ink black→grey washes (alpha layers of `#1b1a18`),
  ONE accent (vermilion seal `#c8372d`, or a single plum/peach blossom colour).
- **Marks**: brush strokes = `E.stroke` with high width variance (w 6–30) and tapered ends; dry-brush = many thin
  parallel strokes with gaps; wash = big blurred blobs (`g.filter='blur(6px)'`) at alpha .08–.25 stacked.
- **Space**: 40–60 % empty paper. Mountains as layered washes fading upward into mist. Calligraphic title optional.
- **Characters**: silhouettes or few strokes, no cel shading; motion on threes (8 drawings/s), long holds.
- **Camera**: slow horizontal scroll like a hand-scroll; parallax between wash layers.
- **Sound**: guzheng/koto plucks (`pluck`), shakuhachi-like breathy `flute`, wind, water, a temple `bell`.

## papercut  (layered paper diorama)
- **Palette**: 4–6 flat matte colours per scene + kraft `#c9a77c`; no gradients inside shapes.
- **Shapes**: flat fills with slightly wobbly cut edges (resample + small `boil` amp 0.6, fixed variant), a
  white/cream paper edge 2 px, and a soft drop shadow (`g.shadowBlur 12, offset 4,6, rgba(0,0,0,.25)`) per layer.
- **Texture**: paper fibre noise overlay per layer; subtle crease lines.
- **Motion**: stop-motion — 8–12 fps, pieces translate/rotate as whole cutouts (here that IS the look), tiny
  positional jitter every drawing. Parallax depth with layer scale.
- **Sound**: marimba/pluck, light percussion, paper rustle foley.

## storybook-watercolor
- **Palette**: soft pastels, white paper showing through; pigment pooling darker at shape edges.
- **Marks**: fill shapes with 3–6 low-alpha (.12–.2) blurred passes slightly offset (wet edge = darker stroke of
  same hue at alpha .3 along the outline); pencil line art in warm grey `#5a4c44` 1.5–2 px, sketchy double lines.
- **Motion**: on twos, gentle; page-turn or iris transitions.
- **Sound**: music box (`bell` high), celesta, soft strings pad, gentle foley.

## flat-motion  (clean vector explainer)
- **Palette**: 1 bg + 3 brand colours + 1 accent; generous negative space.
- **Shapes**: geometric, no outlines or uniform 4 px outlines; long soft shadows optional.
- **Motion**: on ones, **smooth easing allowed here** (`E.ease.back` overshoot pop-ins, staggered 60–80 ms),
  morphing shapes via `E.key` on point arrays, kinetic typography.
- **Sound**: modern pluck/synth bed, UI ticks, whooshes (`whoosh`), soft risers.

## lab-stage  (AI 실험실 channel look)
- Graphite `#1B1C21` stage, slow warm glow, grain; data/titles on smooth springs; accent `#FF6A3D`.
- Scrappy layer: red `#FF3B3B` marker circles/arrows, yellow post-its, Nanum Pen Script, stop-motion jitter.
- Fonts: Black Han Sans, Pretendard, D2Coding (load from the youtube-video skill's assets if text appears).
- **Never draw the otter mascot procedurally.** If it must appear, composite the user's cut-out PNGs
  (`../youtube-video/assets/mascot/otter/*.png`) as sprites (pose swaps on cue, no tweened rotation).

## shadow-puppet
- Backlit warm paper screen (radial gradient amber→umber), pure black silhouettes with lace-cut details (holes),
  rods visible as thin lines, slight blur on the screen edge. Two-tone only + firelight flicker in grade.
- Motion: jointed limbs rotating at pins is CORRECT here; add flicker in light intensity, sway.
- Sound: low drum (`drum`), plucked strings, crackling `fire`.

## pixel
- Render to a small canvas (e.g. 320×180 / 180×320) and scale up with `imageSmoothingEnabled=false`.
- Limited palette (16–32 colours), dithering for gradients, 1-px outlines dark-hue (not black).
- Motion: 8–12 fps sprite frames, sub-pixel camera forbidden (snap to pixels).
- Sound: square/triangle chiptune (write simple oscillators), bit-crushed SFX.

## chalkboard
- Board `#2f4a3c` with smudge texture; chalk strokes = many short semi-transparent lines with dropout; colour chalk
  for emphasis (yellow, pink, blue). Writing animates stroke-by-stroke (progressive length).
- Sound: chalk scratch (band-passed noise bursts), soft piano.

## neon
- Night palette, additive `lighter` glow lines (draw stroke 3× with widths 2/8/20 and alphas 1/.3/.1),
  perspective grids, scanlines, chromatic offset in grade.
- Motion: on ones, flicker on/off steps (`E.steps`).
- Sound: synth pads (`pad_note` bright=12), arpeggios, sub `drum`.
