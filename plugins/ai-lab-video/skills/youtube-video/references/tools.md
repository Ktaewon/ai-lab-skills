# Tool map: what to borrow from OpenMontage and the video toolkit

Use these when a scene or step needs something the skill's own scripts don't do. Paths are
absolute; nothing here needs to be copied into the project.

## Calling an OpenMontage tool

Every OpenMontage tool is a Python class with `execute(inputs) -> ToolResult`. Call any of them
through the bridge, with OpenMontage's own interpreter (it has the right packages and loads its .env):

```bash
$VIDEO_TOOLS/OpenMontage/.venv/bin/python (Windows: .venv/Scripts/python.exe) SKILL_DIR/scripts/om_tool.py \
  tools.<package>.<module>:<Class> '<json inputs>'      # or @inputs.json
```

Use absolute output paths. Prints `{success, data, artifacts, error, cost_usd}`. Read the tool's
`input_schema` in its source for the inputs. Verified working: `tools.subtitle.subtitle_gen:SubtitleGen`.

## Already wired into the skill

| need | script | backed by |
|---|---|---|
| narration | `tts_gemini.py` | OpenMontage `tools/audio/gemini_tts.py:GeminiTTS` (REST fallback) |
| word timing | `align_words.py` | OpenMontage `tools/analysis/transcriber.py:Transcriber` or toolkit `tools/captions.py` (Scribe) |
| music | `music.py` | OpenMontage `tools/audio/google_music.py:GoogleMusic` or toolkit `tools/music.py` |
| loudness + QC | `render.sh` | toolkit `tools/qc.py --render --fix` |
| ElevenLabs voice | (documented) | toolkit `tools/voiceover.py` |

## Worth reaching for, case by case (not wired; check the source before first use)

| need | tool | needs |
|---|---|---|
| stock video / photos for `media` scenes | OpenMontage `tools/video/pexels_video.py`, `tools/graphics/pexels_image.py`, `pixabay_*` | `PEXELS_API_KEY` / `PIXABAY_API_KEY` (free), network |
| generated images (b-roll, thumbnail background) | OpenMontage `tools/graphics/google_imagen.py` (Gemini key); toolkit `tools/flux2.py` (cloud GPU), `tools/ideogram4.py` (text-in-image thumbnails, `IDEOGRAM_API_KEY`) | network |
| code shown as an image | OpenMontage `tools/graphics/code_snippet.py` (Pygments → PNG) | local |
| diagrams | OpenMontage `tools/graphics/diagram_gen.py` | check source |
| sound effects (whoosh at cuts, clicks) | toolkit `tools/sfx.py --preset whoosh|click|pop`; OpenMontage `music_gen.py` op `generate_sfx` | ElevenLabs key, network |
| reframe someone else's 16:9 clip to 9:16 (face tracking) | OpenMontage `tools/video/auto_reframe.py`; toolkit `tools/cutdown.py` | local |
| trim silences from a recorded voice | OpenMontage `tools/analysis/silence_cutter.py` | local |
| scene cuts in an external video | OpenMontage `tools/analysis/scene_detect.py` | local |
| SRT/VTT subtitle file for upload | OpenMontage `tools/subtitle/subtitle_gen.py` (segments → srt) | local |
| pick the best of several music takes | toolkit `tools/pick_music.py` | local |
| upload to YouTube | toolkit `tools/youtube_upload.py` / `/publish` | one-time OAuth (`docs/youtube-upload.md`) and `google-api-python-client google-auth-oauthlib google-auth-httplib2` in the toolkit venv |
| text layout QC (clipped / too-small text) | toolkit `tools/qc.py --layout` | local, Playwright |

## Design references (read, don't import)

- OpenMontage `skills/creative/` (short-form.md, long-form.md, sound-design.md) — pacing and
  structure guidance for YouTube formats.
- OpenMontage `styles/*.yaml` — palette/typography/motion tokens to borrow for a channel look.
- OpenMontage `remotion-composer/src/components/` (charts, CaptionOverlay, StatReveal, ...) — on
  Remotion 4.0.484; copy and adapt into `src/` rather than importing.
- Toolkit `.claude/skills/video-design/` — critique checklist for a finished render.
