# Audio: narration, word timing, music

Files, named by scene id:

```
public/audio/<id>.txt            ← prepare.py --scripts-only, from episode.json "narration"
public/audio/<id>.mp3            ← TTS; its length sets the scene length
public/audio/<id>.captions.json  ← align_words.py; word timing for captions (optional)
public/audio/music.mp3           ← music.py (optional), set "music" in episode.json
```

Run every script as `bash SKILL_DIR/scripts/py SKILL_DIR/scripts/<name>.py ...`.

## Writing the narration

- Korean TTS reads about 6–7 syllables per second: a 10 s scene holds ~65 syllables.
- Spoken style, short sentences. Write numbers as they should be read when it matters
  ("십오 분", "초당 42토큰").
- Recording scenes: narrate the key moments, not every click.
- Shorts reuse scene narration, so scenes picked for a short must make sense on their own.
- Plain text only in the .txt — the whole file is spoken.
- ElevenLabs (v3/v4): direct the delivery with audio tags in `narration`, e.g.
  `[장난스럽게] 피자 치즈가 자꾸 흘러내린다고 구글에 물어봤더니, 풀을 넣으래요. [위협적으로] 2024년 5월…
  [나지막이 웃음] 내년은 2028년이에요.` Free Korean or English directions work ([속삭이듯], [신나게],
  [한숨], [excited]). Tags are sent to TTS only: prepare.py writes the tag-free `<id>.txt` (captions,
  alignment, `say` timing) and keeps the tagged `<id>.tts.txt`; changing a tag re-voices that scene.
  Gemini/local can't follow them, so tts.py drops the tags for those engines.

## Choosing the voice (ask the user every episode)

`tts.py <project>` reads `episode.json` `"voice"` and runs the matching engine; all three write
`<id>.mp3` levelled to -16 LUFS, so the rest of the pipeline doesn't care which was used.

| provider | quality | cost | needs | voice / options |
|---|---|---|---|---|
| `gemini` | natural, expressive Korean | low | Gemini key (set in OpenMontage `.env`) | `voice` Kore/Puck/Charon/Aoede…, `style` delivery note |
| `elevenlabs` | premium, consistent | per character | toolkit `.env` key (set) | `voice` voiceId (default: toolkit `.env` `ELEVENLABS_VOICE_ID`) |
| `local` | clear, less expressive than cloud | free, offline | one-time `setup_local_tts.sh` (MeloTTS, MIT) | `preset`: `lively` (default) / `max` (high energy, may slur) / `flat`; `speed` override |

```jsonc
"voice": { "provider": "gemini", "voice": "Kore", "style": "밝고 또렷한 한국어 유튜버 톤으로" }
"voice": { "provider": "elevenlabs" }                 // channel voice from the toolkit .env
"voice": { "provider": "local", "preset": "lively" }
```

`tts.py <project>` voices only scenes that have no mp3 yet (prepare.py removes the mp3 of any scene
whose narration changed), so a re-run never pays twice. `--only intro,outro` redoes those scenes,
`--all` redoes everything. It prints the scene list and character count first — tell the user.

### ElevenLabs settings, roles and samples
- Base settings on `voice`: `voice` (voiceId), `model` (default `eleven_v4`), `speed` (0.7–1.2; the
  user likes 0.9), `stability` (default 0.5; lower = more emotion), `style` (v2 only), `similarity`
  (default 0.75). These defaults match what the user picked in the ElevenLabs app (2026-11: v4, s50, sim75).
- Pace on v4: `speed` is ignored. The user likes a calm read, so direct it with tags where needed —
  `[차분하게]`/`[천천히]` on explanations (long-form especially), `[빠르게]`/`[신나게]` on quick beats.
  Only drop a scene to `eleven_multilingual_v2` (speed works, tags don't) if tags can't get the pace.
- `eleven_v4` is the most expressive model (stability + similarity only; style/speed are ignored).
  On `eleven_multilingual_v2`, emotion = stability 0.3–0.4 + style 0.4–0.6. The default stability
  0.85 with style 0 sounds flat — fine for a narrator, wrong for a toast or a letter.
- Second speaker: `"voice": {"provider": "elevenlabs", "speed": 0.9, "roles": {"toast": {"voice": "XrExE9yKIg1WjnnlVkGX", "model": "eleven_v4", "stability": 0.55}}}`
  and `"voice": "toast"` on those scenes. Each role is generated in its own fresh batch folder.
- Picking a voice: `voice_samples.py <out_dir> --text "<one paragraph>" --voice name=ID:model:stability …`
  (~100 chars each); send the mp3s and let the user choose by ear. EP.01 toast pick: Matilda.
- `quota_exceeded`: usually the API key's own credit limit (ElevenLabs → Developers → API Keys →
  edit key → Credit limit), not the account balance. Nothing is saved from a failed batch.

## Engine details: Gemini (tts_gemini.py)

```bash
tts_gemini.py --scene-dir <project>/public/audio --voice Kore --style "밝고 또렷한 한국어 유튜버 톤으로"
tts_gemini.py --scene-dir <project>/public/audio --only intro,outro      # redo some scenes
```

- Engine `openmontage` (default): OpenMontage's `GeminiTTS` tool through `om_tool.py`, run in
  OpenMontage's venv. It follows Google's current SDK/model (`gemini-3.8-flash-tts`) and reads the
  key from OpenMontage's `.env` (`GOOGLE_API_KEY` is set there). Voice and style map to its
  `voice_id` / `style`.
- Engine `rest`: standard-library fallback when OpenMontage is missing; pass `--model` if its
  default model name is outdated (404).
- Each MP3 is levelled to -16 LUFS so scenes sound even; render.sh lifts the mix to -14.
- Voices: Gemini prebuilt names (Kore, Puck, Charon, Aoede, ...). Keep one voice and one `--style`
  per channel so episodes sound alike.

**ElevenLabs** (run by `tts.py`; the toolkit has `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID`). Equivalent manual call:

```bash
cd $VIDEO_TOOLS/claude-code-video-toolkit && \
  uv run tools/voiceover.py --scene-dir <absolute project path>/public/audio --json
```

## Word timing: align_words.py (recommended)

Without it, captions are spread over each clip by text length — close, not exact. With it, each
caption appears when its words are spoken. Captions always show the script's words; recognition
only supplies timing.

```bash
align_words.py <project>/public/audio [--engine openmontage|scribe] [--only id1,id2]
```

- `openmontage`: OpenMontage's `Transcriber` (faster-whisper, local, Korean). One-time setup:
  `$VIDEO_TOOLS/OpenMontage/.venv/bin/python (Windows: .venv/Scripts/python.exe) -m pip install faster-whisper`
  (the first run downloads the model). Free, offline afterwards.
- `scribe`: the toolkit's `captions.py` with ElevenLabs Scribe (cloud; uses the toolkit key).
- `auto` (default): openmontage if faster-whisper is installed, else scribe.

prepare.py uses a `.captions.json` only if it's newer than its MP3 and reports
`captions: words | ratio` per scene.

## Music: music.py

```bash
music.py <project> --prompt "calm lo-fi tech, soft synth pads" [--provider lyria|elevenlabs] [--seconds N]
```

- `lyria` (default): OpenMontage's `GoogleMusic` (Google Lyria, Gemini key), up to 184 s; the
  video loops the track for longer episodes.
- `elevenlabs`: the toolkit's `music.py`, 10–300 s.
- "instrumental, no vocals" is appended unless the prompt says so — vocals fight narration.
- Then set `"music": "audio/music.mp3"`, `"musicVolume": 0.06–0.10` in episode.json; re-run prepare.py.

## After generating

1. `prepare.py <project>` — re-times scenes to the audio (summary shows `audio: yes`).
2. render.sh normalises loudness and checks the audio track exists. You can't listen — ask the user.

## When the API is unreachable

Calls from Claude's shell go through the managed proxy. On connection errors or timeouts, don't
touch proxy settings: give the user the exact command to run in their own terminal (it works the
same there), then continue with prepare.py on the files it produced.
