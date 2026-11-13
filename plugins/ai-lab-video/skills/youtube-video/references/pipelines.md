# Choosing a pipeline

This skill is the director. It picks one production pipeline per video, keeps the channel look
identical across them (brand.json → `export_brand.py`), and always finishes the same way (QC to
-14 LUFS, Shorts, thumbnail, `youtube.md`). Tell the user which route you picked and why, in one
line, before starting.

Paths: OpenMontage = `$VIDEO_TOOLS/OpenMontage` (OM),
toolkit = `$VIDEO_TOOLS/claude-code-video-toolkit` (TK).

## Routing table

| Video is mostly… | Route | Why | Watch out |
|---|---|---|---|
| AI/dev experiment, tool review, benchmark, app demo (screen recordings, terminal, charts) | **This skill's own pipeline** (default) | Only route with click-following zoom, the otter mascot, doodles, long+Shorts from one script | — |
| Concept explainer that needs many generated illustrations/diagrams ("how do LLMs work") | **OM `animated-explainer`** with `style_playbook="ai-lab"` | Research → script → per-scene image/diagram generation built in | Needs image API keys (OM `.env`); its gates stop for approval; add the otter afterwards as an overlay pass in this template if wanted |
| Long CLI/terminal tutorial where subtitles are mandatory | **OM `screen-demo`** (`synthetic_terminal` mode) | Rebuilt terminal + required subtitle stage | No click zoom; Korean font must be set (see below) |
| News/analysis with stock footage, maps, archive clips; or any AI topic that would otherwise be a run of generated illustrations | **OM `documentary-montage`** or **`hybrid`** | Real b-roll via stock retrieval + CLIP `clip_search` (Archive.org, NASA, Wikimedia keyless; Pexels/Pixabay/Unsplash with keys) | Pexels etc. need keys in OM `.env`; beta |
| Scenes needing kinetic typography, website scroll captures or SVG character animation | **OM HyperFrames** (`tools/video/hyperframes_compose.py`, HTML/CSS/GSAP) for those scenes, imported as `media` | Far more dynamic than Remotion stock cards | Node ≥ 22; `npx hyperframes doctor` to check |
| User supplies a reference video/Short to match | **OM `skills/meta/video-reference-analyst.md`** first, then any route | Extracts pacing, scene structure, caption style as plan targets | Needs yt-dlp/scenedetect/opencv in OM venv |
| Translate/dub an existing video | **OM `localization-dub`** | transcribe → translate → TTS dub | beta, ~$3 budget |
| Shorts cut from a long video *not* made here (e.g. a livestream) | **OM `clip-factory`** | transcript-driven clip selection | beta; vertical reframing is face-only, so use TK `cutdown.py --mode blur` for screen content |
| Product walkthrough rebuilt from the app's source (no recording) | **TK `synthetic-ui-demo`** (Stage + Cursor) | crisp UI that never goes stale | TK `cues.ts` drops Korean (cue by frame numbers instead) |
| A batch of quick standalone Shorts from a brief | **TK `video_job.py`** (`concept-explainer-short`) | one-prompt jobs | **Blocked for Korean** until `templates/concept-explainer-short/build.py` font list is patched to a Korean font (renders tofu otherwise) |

When unsure, use this skill's own pipeline: it covers most episodes, and the others can supply
individual assets (an OM generated diagram as a `media` scene, a TK Stage clip, stock footage).

## Running an OpenMontage pipeline

1. `bash SKILL_DIR/scripts/py SKILL_DIR/scripts/export_brand.py` (writes `OM/styles/ai-lab.yaml`).
2. Read `OM/AGENT_GUIDE.md` and the pipeline's manifest `OM/pipeline_defs/<name>.yaml`; follow each
   stage's director skill in `OM/skills/pipelines/<name>/`, applying `references/pacing-rules.md`
   on top of its `scene-director.md` and `edit-director.md` (ours win on conflict; OM's own files
   stay unedited so `git pull` keeps working). Use OM's interpreter for its tools:
   `OM/.venv/bin/python` (or `SKILL_DIR/scripts/om_tool.py` for one-off tool calls).
3. Pass `style_playbook="ai-lab"` to `init_project`. Its approval gates are real: show the user
   each gated artifact and wait.
4. Korean: OM's Remotion composer bundles only Latin fonts. Copy `SKILL_DIR/assets/fonts/*` into
   `OM/remotion-composer/public/fonts/` and register them in `src/lib/localFonts.ts` before render,
   or Hangul falls back to system fonts.
5. Loudness: pass `loudnorm_target: -14` to `audio_mixer`, then still run TK `qc.py --render <mp4> --fix`.
6. Finish here: Shorts (OM `clip-factory` or this template with `media` scenes pointing at clips of
   the OM render), thumbnail (render this template's `Thumbnail` with a minimal episode.json),
   `youtube.md`.

## Running a toolkit route

1. `export_brand.py` writes `TK/brands/ai-lab/`. Use brand `ai-lab`.
2. Follow the TK command file (`TK/.claude/commands/video.md`, `record-demo.md`, …) steps at file
   level; its commands assume an interactive session.
3. Fonts: TK templates use CSS font names; load Pretendard / Black Han Sans with `@remotion/fonts`
   or copy this skill's `fonts.ts` approach. Korean voice: `voice.provider: "elevenlabs"` with the
   brand's voice.json, or generate MP3s with this skill's `tts_gemini.py`.
4. Finish with `TK/tools/qc.py --render out/<file>.mp4 --fix`.
