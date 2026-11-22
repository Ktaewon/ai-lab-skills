---
name: code-animation
description: Makes a short hand-drawn-looking 2D animation (with synthesized music and sound effects) purely from code — HTML Canvas drawing plus numpy audio, no image, video or audio generation models — from whatever story, idea or script the user gives. Picks a visual style that fits the content (theatrical anime cel, ink-wash, papercut, storybook watercolour, flat motion graphics, shadow puppet, pixel, chalkboard, neon, or the AI 실험실 channel look), writes a timed shot list, paints layered backgrounds, draws and animates characters on twos, checks still frames against a quality checklist and iterates, then renders a standalone HTML file and an MP4 at -14 LUFS. Use when the user asks for an animation, 애니메이션, 애니, 움직이는 장면, 단편, 오프닝 시퀀스, "코드로만 만든 영상", "이미지 모델 없이", a Ghibli-like or anime-style scene, or wants to turn a story or concept into an animated clip — even if they don't mention canvas or code. For whole YouTube episodes use youtube-video; it can call this for animated segments.
---

# Code animation

Hand-drawn-looking animation where every pixel and every sound comes from code. The engine
(`assets/engine.js`) already does the hard parts — inked variable-width lines, cel shading, gouache skies,
scalloped foliage, clouds, mist, god rays, flames, grade and grain, deterministic timing, a capture harness —
so effort goes into **design, staging and timing**.

`SKILL_DIR` below = this skill's folder. Python: `python3` with numpy. Node + Playwright (found via
`VIDEO_TOOLKIT` / `VIDEO_TOOLS` like the youtube-video scripts). ffmpeg.

## 0. Intake — what the user gives, what you fill in

The user only has to give **the content** ("비 오는 밤 골목 고양이가 우산 밑으로 숨는 이야기"). Fill the rest
with defaults and state them in one short block before building; ask only if the story itself is unclear.

| field | default |
|---|---|
| length | 15–20 s (one scene). Over 30 s → split into scenes, build one at a time |
| ratio | 16:9 1920×1080; "쇼츠/세로" → 9:16 1080×1920 |
| style | picked from the content via `references/styles.md` (say which and why) |
| sound | on (music + foley, synthesized) |
| budget | **standard** (3 review rounds). quick = 1 round test; max = iterate until the checklist passes |
| output folder | `./videos/<slug>/` in the current project (or a folder the user names) |

Characters: design originals. Brand mascots (the felt otter) are never redrawn in code — composite the
user's own images if they must appear (`styles.md` › lab-stage).

## 1. Shot list first

Write the beat sheet as the comment header of `scene.js` and a `T = {...}` object of times — the single
source of truth for animation and sound. Shape: quiet open (establish, 2–4 s) → inciting detail → build
(tension, sound rising) → climax (biggest frame, biggest sound) → resolve and hold → fade. For each beat
note: key pose, what moves (on twos), camera, FX, sound cue. Design the first second to hook (motion or
light already happening, not a black frame).

## 2. Scaffold and build

```bash
bash SKILL_DIR/scripts/new_scene.sh videos/<slug> "<title>" [W H]
```
Edit `scene.js` (template inside shows the structure): `build(E)` paints every static layer once into
offscreen canvases and pre-renders character drawings per boil variant; `render(g, t, L, E)` composites
back → front, characters on `E.twos(t)`, then `E.grade(...)`. `render` must be a pure function of `t`.
Read `references/craft.md` before drawing the hero — its rules are what separate "film still" from
"web illustration". `examples/lab01/` is a complete anime-cel reference (robot wakes, stands, launches) —
reuse its patterns (layer order, debris, launch transform, trail, rings), not its subject.

Preview while working: open `index.html` in the Browser pane (`?t=7.5` freezes a frame).

## 3. Review stills, iterate (the step that makes it good)

```bash
python3 SKILL_DIR/scripts/bundle.py videos/<slug>          # → videos/<slug>/<slug>.html
node SKILL_DIR/scripts/capture.cjs videos/<slug>/<slug>.html <scratch>/stills random 8
node SKILL_DIR/scripts/capture.cjs videos/<slug>/<slug>.html <scratch>/stills stills 2.0 6.4 12.1
```
Tile them (`ffmpeg … tile=4x2`) and look. Judge every frame with `references/quality-checklist.md` as if
it were a still from a finished film in the chosen style. Write the verdict in 2–4 lines (biggest problem
first), fix, recapture. Typical first-round failures: rounded "pill" forms, hero too small / no scale cues,
uniform tree rows, layers missing (empty ground band), effects that read as something else.
Keep a backup of the last good version before big rewrites (`cp scene.js scene.v1.js`).

## 4. Sound

Edit `sound.py` (template uses `scripts/sound_lib.py`: pads, flute, pluck, bell, drum, wind, rain, water,
fire, chirps, flaps, steps, rumble, creak, rustle, zap, hum, whine, whoosh, boom, riser, `Mix`).
Cue times = the `T` block. Pick key/progression and foley from `references/sound.md`.

## 5. Render and hand over

```bash
bash SKILL_DIR/scripts/render.sh videos/<slug>      # bundle → frames → sound → mux → -14 LUFS
```
Make a contact sheet from the MP4 for a final check, then send the MP4 and the standalone HTML. Tell the
user the inline player in the app is muted and open the MP4 in QuickTime (`open -a "QuickTime Player" …`).
Report honestly: what passes, what still fails the checklist, and the one change that would help most.
Note that sound was verified by measurement, not listening.

## Cost & time (tell the user up front for standard/max)
quick ≈ 10–20 min; standard ≈ 30–60 min; max can run hours and millions of tokens (the viral Threads
example used ~3.1M). Rendering itself is fast (~20 s for 20 s of 1080p).

## Hand-off to/from youtube-video
youtube-video can call this skill for an animated cold open, intro or illustrative segment: render here,
then drop the MP4 into the episode as a video beat. For Shorts, build at 1080×1920 and keep y 300–1500
clear for the fixed title and captions.
