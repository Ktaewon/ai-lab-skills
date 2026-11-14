---
name: youtube-video
description: Director for the "AI 실험실" YouTube channel — produces a long-form episode (16:9) plus vertical Shorts (9:16), a Big Number thumbnail, chapters and upload text from a topic or outline, in the channel's look (graphite premium stage, scrappy red marker doodles and post-its, a felt otter mascot that reacts on cue, karaoke Shorts captions, Black Han Sans + Pretendard). It picks the right production route per video (its own Remotion pipeline by default; OpenMontage or claude-code-video-toolkit pipelines for explainers, stock-footage analysis, dubbing, clip cutting), keeps the brand identical across them, writes the script, generates Korean narration (Gemini TTS), word-times captions, adds music, records browser demos with click-following zoom, renders and normalises loudness to -14 LUFS. Use this whenever the user wants to make a YouTube video, 롱폼, 숏폼, 쇼츠, 유튜브 에피소드, 영상 기획/대본/편집, a channel episode like "AI 실험실 Ep.N", a screen-recorded tutorial or demo, or to turn an experiment, article or idea into a video — even if they don't mention Remotion, Playwright, OpenMontage or TTS. Works from any folder.
---

# YouTube video (long-form + shorts)

## 0. Pick the route, keep the brand

This skill is the director. First decide how this video gets made — `references/pipelines.md` has
the routing table. Most episodes (experiments, tool reviews, benchmarks, demos) use this skill's
own pipeline below; concept explainers with lots of generated art, stock-footage analysis,
dubbing and clip cutting go to an OpenMontage or toolkit pipeline. Say which route and why in one
line before starting.

**Pacing rules apply on every route** — read `references/pacing-rules.md` before writing the scene
list: nothing static for more than 3 s, every emphasis word gets a cut/kinetic text/SFX hit, and
the result is checked numerically before render. If the user gives a reference video, analyse it
first (OM `video-reference-analyst`) and use its pacing as the target.

**Anti-slop passes apply on every route** — `references/anti-slop.md`: de-slop the narration
(humanizer patterns + `stop-slop-ko` scanner) before TTS, and check generated scene designs
against the Hallmark floor rules before render.

**Channel identity is fixed** (`SKILL_DIR/assets/brand.json`, decided with the user):
- Premium graphite stage (#1B1C21) with a slow warm orange glow and fine grain; data and titles
  move with smooth springs; one data accent (#FF6A3D).
- Scrappy layer on top: crude red marker circles/arrows/underlines and yellow post-its in
  Nanum Pen Script, jittering in stop-motion. Use them to point, not to decorate (1–2 per scene).
- The felt otter mascot (28 poses) reacts at the key beat of a scene with a short hand-written
  line. **Pick the pose that matches what the narration is saying at that moment** — the table in
  `references/episode-format.md` maps situations to poses (emotions like gasp/confused/angry,
  actions like explain/idea/search/note, outfits like explorer/graduate for special episodes).
  Friends (cat, puppy, hamster, bunny, mole, hedgehog) appear as occasional guests.
- Fonts: Black Han Sans (titles, numbers, Shorts captions), Pretendard (body, long captions),
  D2Coding (code), Nanum Pen Script (doodles). Shorts captions: karaoke bold (spoken word yellow), or `"captionStyle": "plain"` white subtitles.
- Thumbnail (long-form): Big Number + 2–4 words + otter pose + one red marker circle.
  Shorts with the fixed title (`hookStyle: "fixed"`): the cover is a clean frame of the short itself
  — fixed title + its most striking beat (e.g. the EP.06 icon grid), no captions or progress bar:
  `npx remotion still Short-<id> out/thumbnail-short-<id>.png --frame=<n> --props=<json with {"shortId":"<id>","clean":true}>`.
  Pick a frame after the beat has fully built and between captions (user, 2026-11-14).
- When another pipeline is used, run `export_brand.py` first so it uses the same look.
- New mascot poses: generate a new sheet in the same style, then cut it with
  `scripts/cutout.py <sheet> <cols> <rows> <outdir> <prefix>` (removes the white background,
  enclosed gaps between legs, and floor shadows).
  Then run `scripts/mascot_meta.py` so speech bubbles know the new outline (they sit beside the
  character and only overlap it when the frame edge leaves no room).
- Fonts missing (`assets/fonts` empty): ask the user to run `bash SKILL_DIR/scripts/get_fonts.sh`.

## This skill's own pipeline

One `episode.json` drives everything. Narration audio comes first and sets every scene's length,
so picture and voice never drift. It borrows tools from two local projects when they do a job
better (see `references/tools.md` for the full map):

- **OpenMontage** (`$VIDEO_TOOLS/OpenMontage`): Gemini TTS, Lyria
  music, local whisper word timing, and ~150 other tools (stock footage, image gen, reframing...).
- **claude-code-video-toolkit** (`$VIDEO_TOOLS/claude-code-video-toolkit`):
  QC + loudness to YouTube's -14 LUFS, ElevenLabs voice/music/Scribe captions, YouTube upload.

```
topic ─▶ episode.json
  record.cjs ──────────▶ public/rec/<scene>.mp4 + record/<scene>.clicks.json   (recording scenes)
  prepare.py --scripts-only ▶ public/audio/<scene>.txt
  tts.py ──────────────▶ public/audio/<scene>.mp3          (voice.provider; only scenes without audio)
  align_words.py ──────▶ public/audio/<scene>.captions.json (word timing; drives captions, marks, sync)
  clip_paragraphs.py ──▶ public/audio/<short scene>.mp3      (optional: excerpts of a long read for a Short)
  music.py ────────────▶ public/audio/music.mp3            (optional)
  prepare.py ──────────▶ src/timeline.json, out/chapters.txt, out/youtube.md
  render.sh all ───────▶ out/long.mp4, out/short-<id>.mp4, out/thumbnail.png  (QC'd, -14 LUFS)
  export_srt.py ───────▶ output_<lang>.srt                  (optional: translated subtitles)
```

`SKILL_DIR` = this skill's folder. **Run every Python script through `SKILL_DIR/scripts/py`** —
some folders (OpenMontage's, for one) pin a broken pyenv Python, and `py` picks a working one.

## 1. Plan the episode with the user

Agree on these before building (ask only what you can't infer; propose defaults):
- **Topic, angle, target length.** Long-form is usually 3–12 min; Korean narration runs ~6.5
  syllables/s, so 8 min ≈ 3,000 syllables of script. The user may give a length — budget to it.
- **Scene list** mixing the types below. A good rhythm: title → why it matters → 2–4 body blocks
  (recording / terminal / chart / statement) → result → outro. Change scene type every 10–40 s.
- **Real data only.** Charts, terminal output and stats are presented as real. Use numbers the
  user gave or you measured; otherwise mark them as examples (`source`) and say so. Never invent
  benchmark numbers.
- **Shorts**: 1–4, each 15–60 s (up to 180 s allowed). Build them as **dedicated fast-cut `beats`
  scenes** in `shortScenes`, reusing a long scene's narration (`audioFrom`) — the visual changes on
  a spoken word every 2–5 s (real result clips/images full-bleed, a count-up number, bars, a quote
  card with a marker sweep, a slammed stamp, otter stickers). Do NOT just reuse long-form scenes in
  9:16: the user found that boring ("화면은 안 변하고 글만 읽어줌"). Hook ≤ 18 Korean chars. Give
  each short a cover in `shorts[].thumb`. A teaser short can end on a question that sends viewers to
  the long video ("정답은 본편에서").
  For a **product / service short** (an app, an AI agent, a launch) use the motion beats and follow
  `references/shorts-motion.md` — the EP.04 피클·뮤즈 short the user called "센스 넘친다": the product's
  own demo video in a phone, its characters with speech bubbles, app icons slamming in on each
  name, a payment-approval tap, an account-connect meter, an ivory notebook with post-its and
  smooth red strokes, SFX on every hit. Gather real assets with `scripts/site_media.cjs`,
  `scripts/app_icons.cjs`, `scripts/stock.cjs`.
  For a **ranking / countdown short** ("순위 TOP9", "best N") use `win` beats with
  `"hookStyle": "fixed"` and `"captionStyle": "plain"` (`references/shorts-motion.md` § 7, EP.05 TOP9):
  a big fixed title, one rank at a time in a 16:9 window showing that entry's official video,
  a 9→1 ladder, count-up stat cards, about 10–13 s per rank with a one-line "what you're seeing".
  If the voice misreads a word ("TOP9" → "탑 구"), add `"pronounce": {"TOP9": "탑 나인"}`.
  Don't repeat the same countdown layout every episode: when the ranked number spans orders of
  magnitude (stars, users), use `tower` beats instead (§ 8, EP.07 star elevator, cinematic `t_*` SFX).
- **Thumbnail**: two short lines (≤ 7 chars each), payoff word last.
- **Upload text**: `description` and `tags` in episode.json feed `out/youtube.md`. When asked for
  upload copy, also write each short's title/description and a pinned comment (for a blind test:
  question first, answer pushed below a few "." lines so "자세히 보기" hides it).
- **Experiments**: when the outline compares conditions (A/B/C prompts, models), run them for real
  or have the user run them; generate in fresh sessions, keep every run, blind-evaluate with a
  model different from the generator (shuffle labels per run, keep the map in record/eval), and
  disclose models, run counts and limits on screen. Show the inputs in full (prompt scenes) and the
  outputs side by side (compare scenes). After each test, add a short "제 생각" take grounded in
  what the outputs actually show; no moralising "I learned…" lines.
- **Voice — always ask, every episode** (the user wants to choose each time; use AskUserQuestion
  when available). Offer:
  1. **Google Gemini TTS** — natural Korean, cheap, style-steerable (`voice`: Kore/Puck/Charon/Aoede…, `style`: delivery note). Key is set.
  2. **ElevenLabs** — premium quality, the channel's cloned/selected voice (toolkit `.env`
     `ELEVENLABS_VOICE_ID`); costs per character.
  3. **Local model (MeloTTS Korean)** — free and offline on this computer, less expressive than the
     cloud voices; presets `lively` (default) or `max` (high energy). Set up once with
     `scripts/setup_local_tts.sh` (if `~/.cache/youtube-video/melo` is missing, give the user that
     command first).
  Record the answer in episode.json: `"voice": {"provider": "gemini"|"elevenlabs"|"local", "voice": "...", "style": "...", "speed": 0.9}`.
  Keep one provider per episode so every scene sounds like the same narrator. The user prefers a
  calm pace — on `eleven_v4` (the default) `speed` is ignored, so set the pace with tags instead
  (`[차분하게]`, `[천천히]`, `[여유 있게]`), mainly in long-form explanations; keep `speed` only for
  v2/Gemini/local. A second speaker (a toast, a letter read aloud) is a voice
  **role**: `voice.roles.<role>` + `"voice": "<role>"` on those scenes. For an emotional role,
  make 3 short samples with `voice_samples.py` and let the user pick by ear before generating
  (EP.01 toasts: Matilda `XrExE9yKIg1WjnnlVkGX`, `eleven_v4`, stability 0.55 — "부드럽고 친근한").
- **Direct the ElevenLabs read with audio tags** — plain text sounds flat ("밋밋", user, 2026-11).
  tts.py defaults ElevenLabs to `eleven_v4` (stability 0.5, similarity 0.75). Start sentences
  with delivery tags in `narration`: `[장난스럽게] 피자 치즈가… [위협적으로] 2024년 5월… [나지막이 웃음] 끝이
  아닙니다.` Change the tag as the mood turns (hook → build-up → punchline), 1 per sentence or two.
  Same in long-form: tag by need — mood (`[신나게]`, `[진지하게]`, `[한숨]`) and pace (`[차분하게]`,
  `[천천히]` for explanations, `[빠르게]` for a quick aside); untagged stretches read neutrally.
  Tags go to TTS only; captions, word alignment and `say` timing use the tag-free text
  (`public/audio/<id>.txt`; the tagged one is `<id>.tts.txt`). Show the user the tagged script.

Write `episode.json` (format: `references/episode-format.md`; complete example:
`SKILL_DIR/assets/example-episode.json`). Run the script anti-slop pass
(`references/anti-slop.md` § 1) on the narration, then show the user the scene list and narration
(with the scan result) before generating audio — script changes are cheap now, expensive after TTS.

| type | use for | key props |
|---|---|---|
| `title` | opening, section openers | `title` (2 lines, last line in accent), `label`, `subtitle` |
| `statement` | a claim, a list of points | `heading`, `bullets`, `kicker`, `tone` |
| `recording` | real browser/app use, auto-zoom on clicks | `steps` file, `shots`, `zoom`, `playbackRate` |
| `terminal` | commands and their real output; the timed form plays a whole run (install → error → fix → PASS) on spoken words | `command`, `lines` (strings, or `{say, kind, text, stamp, progress}`), `highlight`, `aside` |
| `chat` | the story **is** a conversation: asking an AI, back-and-forth debugging, "AI한테 시켰더니" | `messages` [{say, who, kind, text…}], `title`, `aside`, `tone` |
| `chart` | comparisons, results | `heading`, `unit`, `bars`, `source` |
| `media` | screenshots, photos, clips (own or stock) | `src` in public/, `fit`, `caption` |
| `outro` | wrap-up, next episode, subscribe | `heading`, `sub`, `stats`, `cta` |
| `compare` | 2–4 results side by side (images, videos, text) | `panels` [{label, tag, src\|text\|slot}], `reveal` |
| `prompt` | one prompt / document shown in full (SCOPE letters coloured, 2 columns when long) | `label`, `tag`, `text`, `follow`, `bg` |
| `tier` | ranking tools/models into S–F rows ("몇 티어?") | `tiers`, `items` [{name, tier, note, say}] |
| `quiz` | "진짜 vs AI?" / guess-which: countdown, reveal stamps, 정답률 | `question`, `items` [{src, label, isAI}], `countdown`, `reveal` |
| `scoreboard` | head-to-head rounds (model A vs B vs C), running score bar | `contestants`, `rounds` [{title, results, winner}] |
| `news` | weekly news round-up / fact-check: headline cards + 사실·과장·오보 stamps | `items` [{outlet, headline, highlight, verdict}] |
| `doc` | quoting a paper/system card/blog as evidence: push-in + highlighted sentence + source tag | `source`, `paragraphs` or `image`, `highlight` |
| `race` | a ranking changing over time (users, stars, scores) with overtakes | `entities`, `frames` [{period, values}] |
| `flow` | how a system works (agent, RAG, pipeline): nodes + moving packets, a failing step + retry | `nodes`, `edges`, `runs` [{path, label}] |
| `code` | explaining code line by line, a one-line fix, "이 한 줄이 핵심" | `filename`, `language`, `code`, `focus`, `diff`, `keyLine` |
| `receipt` | what tools/subscriptions cost, what was wasted | `lines` [{name, plan, price, unused}] |
| `map` | where things are/move (chips, data centres, regulation) | `camera`, `pins`, `routes` [{path}], `spots` |
| `beats` | Shorts only: fast cuts timed to spoken words; motion kinds `memo` `demo` `icons` `approve` `connect`; countdown kinds `win`, `tower` (순위 TOPn) | `beats` [{say, kind, …}] (see episode-format, shorts-motion) |

**Choosing chat / timed terminal / stickers.** They are options, not defaults — propose them per
scene during planning, only where the content fits, and mix freely with the other types:
- `chat` when what happens is a dialogue (request → reply → error → "괜찮은 거 맞지?" → fix). It
  carries a light, story-time tone and works in 16:9 (with `aside` chapter + otter) and 9:16.
- timed `terminal` when the story is a run of commands and their output (builds, installs, agent
  runs, benchmarks). One terminal can hold a whole sequence; `err` lines shake it, `stamp` slams
  the payoff. Use the simple form for a single command.
- `stickers` for a small reaction meme or photo on a word (one per scene at most, small, in empty
  space). Prefer the otter for reactions; a sticker is for when a real image says it better.
Statement/chart/compare stay the choice for claims, numbers and side-by-side results.
- The ten data & story scenes (tier … map) are the same kind of option: pick one when the content has
  that shape (a ranking → `tier`/`race`, a guessing game → `quiz`, a multi-round test → `scoreboard`,
  news → `news`, a quoted source → `doc`, an architecture → `flow`, code → `code`, money → `receipt`,
  geography → `map`). One or two per episode is plenty; they all take `say` timing on every item.
  Details and examples: `references/episode-format.md` → "Data & story scenes".

Any scene also takes `mascot` (otter beats), `doodles` (marker circles/arrows/underlines/post-its),
`stickers` (small labelled memes, see `references/episode-format.md`),
`marks` (on-screen highlighter: `[{"text": phrase on screen, "say": spoken word}]` — the yellow
marker sweeps across the phrase when it is spoken; this is the "형광펜" the user wants, NOT on the
captions) and `keywords` (phrases caption lines must never split); `statement` takes `bigNumber`
("01") for section openers. Use `marks` generously on important on-screen text. See
`references/episode-format.md`. The conclusion is a `statement` or `chart` with an otter reaction,
not a gag scene. Results that aren't in yet: `media`/`compare` with `slot` (a dashed "촬영 후 삽입"
box naming the file) — never invent results to fill them.

## 2. Create the project

```bash
bash SKILL_DIR/scripts/scaffold.sh <project_dir>      # e.g. ./videos/ep01-local-vs-cloud
```

Copies the Remotion template and links `node_modules` to an existing full install when found.
Otherwise it prints the install command (run it, or hand it to the user if the network is blocked).
Put `episode.json` in the project root.

## 3. Record the recording scenes

```bash
node SKILL_DIR/scripts/record.cjs <project_dir> <project_dir>/record/<scene>.steps.json <scene>
```

Steps format is at the top of `record.cjs`. Keep each recording 5–20 s. Clicks within 3 s on the
same row/column become one zoom shot — give `shots` one label per shot. Check 2–3 frames of
`public/rec/<scene>.mp4`. Login-protected sites: the user supplies a test account; never type
real passwords.

## 4. Audio: narration, word timing, music

```bash
bash SKILL_DIR/scripts/py SKILL_DIR/scripts/prepare.py <project_dir> --scripts-only
bash SKILL_DIR/scripts/py SKILL_DIR/scripts/tts.py <project_dir>      # only scenes without audio; --only a,b / --all
bash SKILL_DIR/scripts/py SKILL_DIR/scripts/align_words.py <project_dir>/public/audio      # absolute path; also fixes drift
bash SKILL_DIR/scripts/py SKILL_DIR/scripts/prepare.py <project_dir>                       # lengths
bash SKILL_DIR/scripts/py SKILL_DIR/scripts/music.py <project_dir> --prompt "calm lo-fi tech"  # optional
```

Details, engines and fallbacks: `references/voiceover.md`. Order matters: music.py sizes the track
from the timeline, so run it after prepare.py, then set `"music": "audio/music.mp3"` and run
prepare.py again. prepare.py deletes an MP3 (and its captions.json) whose script changed. Without
audio everything still renders with estimated lengths — a free silent preview.

**Cost discipline (TTS is billed per character):** tts.py prints scenes and characters before
generating; tell the user the count. Never run tts.py "just to test" — it really generates when the
API is reachable. Before a big ElevenLabs batch, remember the API key has its own credit limit;
on `quota_exceeded` the fix is ElevenLabs → Developers → API Keys → edit key → Credit limit.

**Timing rules (fixed after EP.01):** each scene has 0.8 s before and 1.0 s after its narration
(prepare.py LEAD_IN/PAD_OUT; the video reads `timeline.leadInFrames`, so audio, captions, marks and
paragraph highlights stay in sync). Captions break at Korean phrase boundaries (no lone predicate,
particle or one-syllable word, no modifier split from its noun, keywords kept whole).

## 5. Check and render

```bash
cd <project_dir> && npx tsc --noEmit -p .
bash SKILL_DIR/scripts/render.sh <project_dir> all           # or Long | Short-<id> | Thumbnail
bash SKILL_DIR/scripts/contact_sheet.sh <project_dir>/out/long.mp4 <scratch>/long.png
bash SKILL_DIR/scripts/contact_sheet.sh <project_dir>/out/short-<id>.mp4 <scratch>/short.png
```

render.sh runs the toolkit's `qc.py` on every video: it lifts audio to -14 LUFS (originals kept as
`*.raw.mp4`) and reports black gaps and frozen stretches (> 3 s with nothing changing). Treat its
`!` lines as real problems to fix, apart from the pre-fix loudness line. Read prepare.py's warnings
too (unrecorded scenes, shorts over 60 s, chapters YouTube would ignore). QC flags "nothing on
screen changing" for slow read-along scenes (a toast with paragraph highlight) — that one is fine.

Then **look at the contact sheets and thumbnail**: text not clipped or covered, Korean not broken
mid-word, zoom on the clicked element, hook readable, captions in the short's lower third, chart
values correct (a winner bar must be the longest), otter/bubble not covering data, marks landing
on the right phrase. You can't listen — say so and ask the user to. One frame:
`npx remotion still Long out/f.png --frame=<n> --gl=angle`. Shorts: also check frame 0 (it is the
cover in feeds; the hook must be on screen) and each short's `ShortThumb-<id>` still.

Translated subtitles (when asked): `export_srt.py <project> segments` → translate
`record/srt_segments.json` into `record/srt_<lang>.json` ([{ko, text}], an agent is fine) →
`export_srt.py <project> build <lang>` → `output_<lang>.srt`. Rebuild after any re-time.

## 6. Hand over

Send `out/long.mp4`, each `out/short-*.mp4`, `out/thumbnail.png`, `out/thumbnail-short-*.png`
(`npx remotion still ShortThumb-<id> …`) (SendUserFile when available), and
paste `out/youtube.md` (title, description with chapters, tags, short titles). Say what wasn't
verified. Upload only when asked: toolkit `/publish` or `uv run tools/youtube_upload.py` (needs its
one-time OAuth setup and Google API packages; see `references/tools.md`).

## Troubleshooting

- **Other computers**: `VIDEO_TOOLS` (default `~/video-tools`) holds `OpenMontage` and
  `claude-code-video-toolkit`; venvs may use `.venv/bin/python` or `.venv\Scripts\python.exe` and the
  scripts find either layout. On Windows, Claude Code runs `bash` through Git Bash. The ElevenLabs voice
  is the one in the toolkit `.env` (`ELEVENLABS_VOICE_ID`).
- **Network/API failures** (connect errors, timeouts): never change or bypass proxy settings. Give
  the user the exact command to run in their own terminal — as plain text lines if code blocks
  aren't showing — then continue from its output. render.sh already avoids Remotion's browser
  download by reusing Playwright's headless Chrome.
- **`dyld: Library not loaded ... libpython3.10`**: a folder pinned a broken pyenv Python; run the
  script through `SKILL_DIR/scripts/py`.
- **3D black / missing**: needs `--gl=angle` (remotion.config.ts and render.sh). Animate only from
  `useCurrentFrame()`; never `useFrame`/`requestAnimationFrame`.
- **Package errors**: every `@remotion/*` must equal `remotion` (4.0.539). React 18 needs
  `@react-three/fiber@8`. Don't import OpenMontage's remotion-composer (4.0.484) — copy components.
- **"녹화 필요" on screen**: record.cjs not run for that id, or prepare.py not re-run after.
- **Narration longer than a recording**: prepare.py slows the recording (≥ 0.6x), then holds the
  last frame. If sluggish, record slower actions or trim narration.
- **New scene type**: add `src/scenes/<Name>Scene.tsx`, register it in `scenes/index.tsx` and
  `types.ts`, use `useLayout()`/`safeArea()` so it works at 16:9 and 9:16.
- **Text shimmers/wobbles**: never animate `scale` on scenes full of small text (the old slow
  "drift" did this). Move with opacity/translate, or keep the text still.
- **Speech bubble twitches**: bubbles float with a slow sine bob/sway; no per-frame random jitter
  (keep jitter for the scrappy doodles only).
- **A highlighted chart bar looks shorter than the next one**: a flex item shrank because of the
  badge beside it; bars must be `flexShrink: 0`.
- **Captions/messages/beats land seconds off on one sentence**: recogniser drift (Scribe did it on
  spelled-out numbers). align_words.py fixes it automatically from ffmpeg silencedetect (phrases
  snapped to real speech chunks); re-check old files for free with `align_words.py <audio_dir> --fix-only`,
  then re-run prepare.py. On Windows, faster-whisper may fail (`av` too new for the venv's Python):
  use `--engine scribe`.
- **Short-only scene shows nothing / no beat changes**: it has no word timings — its narration
  needs a public/audio/<id>.txt for align_words.py (prepare.py writes it for `"tts": true` scenes).
