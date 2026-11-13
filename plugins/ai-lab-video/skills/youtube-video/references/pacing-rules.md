# Pacing rules (every route)

These hold for this skill's own pipeline and for every OpenMontage / toolkit route. When running
an OpenMontage pipeline, apply them on top of its `scene-director.md` (scene_plan stage) and
`edit-director.md` (edit stage) — they win where the two disagree. Check them on the scene list
before TTS and again on the edit decisions before render.

## Hard rules

1. **Nothing sits still for more than 3 seconds.** Within any 3 s window something on screen must
   change: a cut, a camera move (zoom/pan ≥ 5 %), kinetic text entering, a doodle/post-it/otter
   reaction, a chart value moving, or new b-roll. A scene longer than 3 s needs an internal beat
   plan (what changes at roughly 0 s, 3 s, 6 s …). Long-form charts/code may hold up to 4 s only
   when the narration is reading the thing on screen.
2. **Emphasis words get a visual hit.** Mark the beat words in the script (numbers, names,
   "근데", "사실은", punchlines, the reveal). After word alignment (`align_words.py` /
   OM transcriber), each beat word gets at least one of: a cut or scene change, a kinetic-text
   pop of that word, a marker doodle, a zoom punch-in, or an SFX (whoosh at cuts, pop/click on
   text hits). Land it within ±2 frames of the word's start time.
3. **SFX are sparse and on beats only.** Not every cut — at most one SFX per ~2 s, never under
   narration consonant clusters at full volume (duck SFX to about -18 dB under voice).
4. **Mix the visual source.** No more than 2 consecutive scenes of the same kind (AI image,
   chart, statement card, b-roll, screen recording). For non-demo topics prefer real footage
   (Hybrid / documentary-montage b-roll: server rooms, code on screens, archive) over a run of
   generated illustrations.
5. **Shorts:** first frame already in motion with the hook text on screen; a cut or major change
   at least every 1.5–2 s on average.

## Verify numerically

After the edit stage, list each scene/shot with start, end and its change timestamps; flag any
gap > 3 s without a change and any beat word with no hit within ±2 frames. Fix and re-check
before rendering. Report the result table to the user.

## Choosing the tools that make this possible

- **User gives a reference video/Short** (URL or file): run OM `skills/meta/video-reference-analyst.md`
  first (`tools/analysis/video_analyzer.py`). Use its pacing (cuts/min, average shot length),
  scene structure and caption style as the targets for the scene plan, and tell the user the
  numbers you took from it.
- **Kinetic typography, scroll captures of websites, SVG character rigs**: render those scenes
  with OM HyperFrames (`tools/video/hyperframes_compose.py`, skill `.agents/skills/hyperframes*`,
  GSAP timelines) instead of Remotion stock cards, then bring the clip in as a `media` scene.
- **Real b-roll**: OM `documentary-montage` or `hybrid` (stock sources + CLIP `clip_search`).
  Keyless sources work without setup (Archive.org, NASA, Wikimedia, LoC, NARA, ESA, NOAA);
  Pexels/Pixabay/Unsplash need their keys in OM `.env`.
