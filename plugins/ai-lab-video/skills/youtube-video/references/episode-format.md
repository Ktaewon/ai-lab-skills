# episode.json format

```jsonc
{
  "title": "AI 실험실 Ep.1 - 로컬 vs 클라우드 LLM",   // video title (also used for the default thumbnail)
  "channel": "AI 실험실",
  "episode": "Ep.1",
  "description": "영상 설명 첫 문단",  // → out/youtube.md (chapters are appended automatically)
  "tags": ["AI", "LLM", "벤치마크"],   // → out/youtube.md
  "accent": "#6366f1",            // brand colour: highlighted bars, labels, thumbnail payoff line
  "voice": { "provider": "gemini", "voice": "Kore", "style": "밝고 또렷하게" },  // ask the user: gemini | elevenlabs | local
  //   elevenlabs: { "provider": "elevenlabs", "speed": 0.9,
  //                 "roles": { "toast": { "voice": "XrExE9yKIg1WjnnlVkGX", "model": "eleven_v4", "stability": 0.55 } } }
  //   a scene with "voice": "toast" is read by that role (second speaker, letter, toast)
  "music": "audio/music.mp3",     // optional, in public/; skipped if the file is missing
  "musicVolume": 0.08,            // keep 0.05–0.12 under narration
  "pronounce": { "TOP9": "탑 나인" },  // optional: the voice reads the right side, captions keep the written word (ElevenLabs)
  "captionStyle": "plain",        // optional: "karaoke" (default, spoken word yellow) | "plain" (white, dark stroke)
  "hookStyle": "fixed",           // optional: "slide" (default, big 2 s then header) | "fixed" (big title stays on top all short)
  "scenes": [ /* in order, see below */ ],
  "shortScenes": [ /* vertical-only scenes for Shorts (usually "beats"), see "Shorts" below */ ],
  "shorts": [
    { "id": "speed", "hook": "로컬 LLM이 이길까?", "scenes": ["s_bench"],
      "thumb": { "label": "AI 실험실 Ep.1", "big": "2.3배", "lines": ["로컬 LLM이", "더 빨랐다"], "pose": "gasp", "say": "헐", "bg": "images/bench.png" } }
  ],
  "thumbnail": { "lines": ["로컬 vs 클라우드", "승자는?"], "sub": "AI 실험실 Ep.1", "image": "images/thumb.png" }
}
```

## Fields every scene has

| field | meaning |
|---|---|
| `id` | unique, lowercase; names the audio (`public/audio/<id>.mp3`) and recording files |
| `type` | one of the scene types below |
| `narration` | what the voice says (plain text, no markdown). Empty = silent scene |
| `chapter` | optional; starts a YouTube chapter here. The first scene's chapter should be "인트로". YouTube needs ≥ 3 chapters, each ≥ 10 s |
| `minSeconds` | optional floor on the scene length |
| `voice` | optional voice role for this scene (`voice.roles.<role>`), e.g. a toast read by a second speaker |
| `marks` | on-screen highlighter: `[{"text": "phrase as shown on screen", "say": "word in the narration"}]` (or `"at": seconds`). The yellow marker sweeps across the phrase when `say` is spoken, then it glows softly. Works on statement headings/bullets, prompt text, compare tags/text, chart labels. 1–3 per scene on what matters most |
| `keywords` | phrases (from the narration) that caption lines must never split |
| `noCaptions` | `true` hides the long-form captions (e.g. a text read aloud that is already on screen) |

Scene length = max(0.8 s + narration audio + 1.0 s, the scene's visual minimum, `minSeconds`).

## Scene props

### title
- `title`: array of 1–2 lines, broken by hand
- `label`: small line above (channel / episode)
- `subtitle`: line below

### statement
- `heading`: string or array of lines
- `bullets`: up to ~4 short items, revealed across the narration in order
- `kicker`: small accent label above the heading
- `tone`: `"dark"` (default) or `"light"` — alternate between acts, not every scene
- `bigNumber`: e.g. `"01"` — section opener: a giant outlined number slides in and an accent line wipes under the kicker

### recording
- `steps`: path of the steps file (documentation only; record.cjs is run by hand per scene)
- `shots`: label per zoom shot, shown top-left
- `zoom`: 16:9 zoom factor, default 1.6
- `zoomShort`: extra zoom in shorts, default 1.15 (the vertical crop already follows the clicks)
- `playbackRate`: omit to let prepare.py fit the recording to the narration (0.6–1.0); set 1.5–2 to speed up a slow real-time demo

### terminal
Simple form (one command and its output):
- `command`: typed at 18 chars/s
- `lines`: output lines, appearing one by one after the command — real output only
- `highlight`: indexes of lines to emphasise
- `title`: window title

Timed form — make any line an object and every line appears on its spoken word, so a whole
install → error → fix → pass story plays out in one terminal (the "터미널 실황" look):
```jsonc
{ "id": "fix", "type": "terminal", "title": "claude-code — youtube-video",
  "aside": { "label": "CHAPTER 03", "title": ["AI는", "그냥 고침"], "pose": "idea", "say": "슥-" },   // 16:9 only
  "lines": [
    { "say": "설치",      "kind": "cmd",  "text": "npm install", "progress": true },
    { "say": "삼십이",    "kind": "ok",   "text": "added 281 packages in 32s", "stamp": "32초 컷" },
    { "say": "에러",      "kind": "err",  "text": "ERROR: 스위치가 틀립니다." },
    { "say": "원인",      "kind": "ai",   "text": "원인: Git Bash가 /J 를 경로로 바꿈" },
    { "say": "스크립트",  "kind": "del",  "text": "cmd //c mklink /J" },
    {                     "kind": "add",  "text": "MSYS_NO_PATHCONV=1 cmd /c mklink /J" },   // no say: 0.6 s after the previous line
    { "say": "통과",      "kind": "ok",   "text": "[PASS] node_modules 연결 성공", "stamp": "PASS" }
  ] }
```
- `say`: a phrase from this scene's narration (searched in order, so a repeated word hits its
  next use); `at`: seconds into the narration instead; neither: 0.6 s after the previous line.
- `kind`: `cmd` (typed, `$` prompt) · `out` (default) · `dim` · `ok` (green) · `err` (red; the
  window shakes and flashes red) · `warn` · `ai` (amber, the agent's own line) · `add`/`del` (diff
  bands) · `hi` (accent)
- `stamp`: a big slammed stamp for ~3 s from this line (cut short by the next stamp) ("PASS", "32초 컷")
- `progress: true`: a bar under the line fills until the next line arrives
- `command` still works with the timed form (typed first). Old episode.json files are unchanged.
- Real output only, same as the simple form.

### chat
A story told as a messenger thread between "me" and the AI. Use it when the content **is** a
conversation: asking an AI to do something, back-and-forth debugging, a prompt and its answer,
"AI한테 시켰더니 생긴 일". Messages pop in on their spoken word and the thread scrolls up from the bottom.
```jsonc
{ "id": "ask", "type": "chat", "title": "Claude", "status": "● 작업 중", "avatar": "laptop",
  "aside": { "label": "CHAPTER 01", "title": ["시킨 건", "딱 한 줄"], "pose": "coffee", "say": "편-안" },  // 16:9 only
  "messages": [
    { "say": "가이드",  "who": "me", "text": "설치 가이드 보고 깔아줘" },
    { "say": "끝",      "who": "ai", "text": "넵! 바로 설치할게요" },
    { "say": "패키지",  "who": "ai", "kind": "term",  "lines": ["$ npm install", "added 281 packages in 32s"] },
    { "say": "에러",    "who": "ai", "kind": "error", "text": "스위치가 틀립니다 - mklink /J" },
    { "say": "표정",    "who": "me", "kind": "img",   "src": "images/memes/monkey_puppet.png", "w": 190, "h": 251 },
    { "say": "한 줄",   "who": "ai", "kind": "diff",  "minus": "cmd //c mklink /J", "plus": "MSYS_NO_PATHCONV=1 cmd /c mklink /J" },
    { "say": "통과",    "who": "ai", "text": "다시 돌려봤어요. 통과!" }
  ] }
```
- `who`: `me` (right, accent bubble) or `ai` (left, white bubble with the otter avatar)
- `kind`: `text` (default; `\n` for a line break) · `term` (`lines`, numbers auto-highlighted) ·
  `error` (`text`; the window jolts) · `diff` (`minus`/`plus`, string or list) · `img` (`src`, `w`,
  `h` in px — a reaction pic dropped in the chat, `caption` optional)
- `say`/`at` timing as in the timed terminal.
- `title`, `status`, `avatar` (otter pose for the AI): the chat header. `tone: "dark"` for a
  dark window; `tone: "light"` also turns the stage light. Default: light window on the graphite stage.
- `aside` (16:9 only): chapter label, two-line title (last line in the accent) and an otter on the
  left; the window moves right. Without it the window is centred. In 9:16 the window fills the
  short's middle band (hook above, captions below).
- Keep texts short (one or two lines). Messages stand for what was really asked/answered/run —
  paraphrase is fine, invented results are not.

### chart
- `heading`, `unit`
- `bars`: `[{ "label": "...", "value": 42, "highlight": true }]` — highlight the one the narration is about
- `source`: where the numbers come from (shown small). Required in spirit: if the values are examples, say so here
- The highlighted bar gets a glow, one light sweep and a bouncy "1위" badge — highlight the actual winner only

### media
- `src`: file in `public/` (png/jpg/webp or mp4/mov/webm)
- `fit`: `cover` (default) or `contain` (screenshots with text you need to read)
- `kenBurns`: slow push-in, default on for images
- `caption`: small label top-left
- `startFrom`: seconds into a video clip
- `slot`: no `src` yet → a dashed "촬영 후 삽입" box showing this text (results still to come; never fake them)

### compare
- `panels`: 2–4 of `{ "label": "A", "tag": "대충", "src": "results/a.png" | "text": "…" | "slot": "results/a.png", "fit": "contain" }`
- `kicker`, `heading` (optional), `reveal`: `"stagger"` (default, panels appear across the narration) or `"all"`
- Text panels auto-size; `textShort` gives a shorter text for 9:16. Images/videos use `contain` in shorts

### prompt
- One prompt / mail / letter shown in full: `label` ("A", "①"), `kicker`, `tag`, `text` (keeps line breaks)
- Auto-fits font size and 1–2 columns; SCOPE headers ("S — Situation" …) get the accent colour
- `follow: true` + narration = the same text read aloud: the paragraph being read stays bright, others dim
  (paragraph starts come from the word timings — needs align_words.py). Pair with `noCaptions: true`
- `bg`: faint blurred image behind (e.g. a wedding photo behind a toast)

### outro
- `heading`, `sub`
- `stats`: `[{ "value": 6, "unit": "번", "label": "AI가 직접 클릭", "highlight": true }]` — real numbers only
- `cta`: button text, default "구독" (shows "구독중" after the press animation)

## Shorts

- `scenes`: ids from `shortScenes` (preferred) or the long-form, in play order
- `hook`: on screen from frame 0 (frame 0 is the cover in feeds), big for 2 s, then a header. A question or a surprising claim.
  Too long for one big line, it splits at a comma (dropped), else into even halves; force a break with `\n`.
  When it shrinks, each line glides into a one-line header if that fits (comma restored), else stays stacked.
  With `"hookStyle": "fixed"` the hook is instead a big plain title (Black Han Sans, last line yellow)
  that stays at the top for the whole short, like Korean countdown shorts; use it with `win` beats.
- Karaoke captions in the lower third and a progress bar at the top are automatic
  (`"captionStyle": "plain"` for ordinary white subtitles — the user asked for these on the TOP9 short)
- 15–60 s is the sweet spot; up to 180 s is allowed (prepare.py notes > 60 s)
- `thumb`: vertical cover rendered as the still `ShortThumb-<id>` (1080x1920):
  `label` (top pill), `big` (huge word/number in a red marker circle), `lines` (2, last in yellow),
  `pose`/`say` (otter + bubble), optional `bg` (image), `card` + `cardLabel` (a white message card),
  `stamp` (red stamp on the big word), `letters` (a row of letter blocks, e.g. "SCOPE")

### shortScenes and `beats` (fast cuts)

A short should not be long-form scenes squeezed into 9:16 — it cuts every 2–5 s on a spoken word.
```jsonc
"shortScenes": [
  { "id": "s_verdict", "type": "beats", "audioFrom": "verdict",      // reuse a long scene's narration + word timings
    "beats": [
      { "kind": "big", "text": "결과는?", "sub": "블라인드 채점", "sticker": { "pose": "peek", "say": "두근" } },  // first beat starts at 0
      { "say": "49.5점으로", "kind": "number", "value": 49.5, "unit": "점", "label": "C · AI가 쓴 프롬프트", "sticker": { "pose": "jump", "say": "압승!" } },
      { "say": "B가 40점", "kind": "bars", "max": 60, "bars": [{ "label": "C", "value": 49.5, "highlight": true }, { "label": "B", "value": 40 }] },
      { "say": "반면 A는", "kind": "video", "src": "results/a.mp4", "label": "A · 컵이 사발로?!", "tone": "bad" },
      { "say": "줄기는", "kind": "quote", "label": "C의 프롬프트", "text": "줄기는 반드시\n컵 안쪽 수면에 닿아야 한다", "mark": "컵 안쪽 수면에" },
      { "say": "지어내면", "kind": "big", "text": "지연 사유는\n주지 않았다", "stamp": "지어내기 금지" }
    ] },
  { "id": "s_intro", "type": "beats", "tts": true, "narration": "쇼츠 전용 멘트…", "beats": [ … ] },   // new narration, voiced by tts.py
  { "id": "s_toast1", "type": "beats", "clipFrom": { "scene": "toast_1", "paragraphs": [2, 5] },   // excerpt cut by clip_paragraphs.py
    "beats": [ { "kind": "photo", "src": "images/wedding.png", "badge": "1", "label": "첫 번째 축사" } ] }
]
```
- Each beat starts when `say` is spoken (or at `at` seconds) and lasts until the next; every cut gets a punch-in and a flash
- kinds: `video`/`image` (card, slow push, `label` pill, `tone` good/bad border), `photo` (full-bleed + optional `badge`/`text`),
  `big` (`text`, `sub`, burst), `number` (count-up `value`, `unit`, `label`, `sub`), `bars` (`bars`, `max`),
  `quote` (white card, `label`, `text`, `mark` swept), `letters` (`letters` row, `lit` index or "all", `sub`)
- any beat: `sticker` ({pose, say, side}) and `stamp` (red stamp slammed in)
- Use plain digits in badges/letters ("1", not "①": the circled glyph draws its own ring)

#### Motion beats (product / service shorts — EP.04 피클·뮤즈 style)

Which beat for which line is in `references/shorts-motion.md`; the fields:
```jsonc
{ "kind": "photo", "src": "pk/hero.mp4", "pos": "50% 50%", "credit": "pickle.com" },        // photo also takes .mp4 (muted b-roll / site hero)
{ "say": "피클은", "kind": "demo", "src": "pk/demo_booking.mp4", "start": 1, "rate": 2,     // product's own demo video in a phone frame
  "phoneX": 110, "tilt": 0, "credit": "pickle.com 데모 영상",                                  // phoneX shifts the phone (px) to make room for a character
  "blobs": [ { "src": "pk/char_idle.webm", "x": 2, "y": 50, "size": 310, "at": 0.2,         // transparent webm/png character, x/y in % of frame
               "say": "제가 끊어왔어요!", "sayAt": 1.0, "bubbleSide": "left", "flip": true } ] },
{ "say": "쿠팡", "kind": "icons", "items": [ { "src": "icons/coupang.jpg", "label": "쿠팡", "at": 0 },
                                            { "src": "icons/korail.jpg", "label": "코레일", "at": 0.6 } ] },  // slam in as each name is spoken
{ "say": "다만", "kind": "approve", "rows": [["KTX 부산 왕복","2명"],["총 결제","239,200원"]],
  "note": "금액은 공식 데모 화면 그대로", "pressAt": 2.2 },                                       // approval card, finger taps, turns green
{ "say": "계정을", "kind": "connect", "icons": ["icons/naver.jpg", "icons/kakao.jpg"], "every": 0.35,
  "secAt": 2.7, "secSrc": "pk/sec_box.webp", "secNote": "권한은\n필요한 만큼만" },                  // accounts fly in + "볼 수 있는 정보 n/7" meter + security badge
{ "say": "직접", "kind": "memo",                                                              // ivory notebook page
  "notes": [ { "text": "내 일을\n직접 하는 AI", "x": 28, "y": 34, "w": 56, "rot": 3, "at": 0.15, "size": 112,
               "paper": "yellow", "ink": "black" } ],                                          // paper yellow|pink|blue|white|none, ink black|red; at -1 = already there
  "tapes": [ { "src": "images/src/site.png", "x": 7, "y": 16, "w": 86, "h": 31, "rot": -2, "pos": "50% 50%" } ],  // taped screenshot
  "strokes": [ { "type": "arrow", "at": 0.05, "x1": 200, "y1": 480, "x2": 300, "y2": 690, "bend": 60 },          // px in 1080x1920
               { "type": "ellipse", "at": 0.6, "cx": 600, "cy": 800, "rx": 380, "ry": 215, "rot": -3 },
               { "type": "line", "at": 1.3, "x1": 330, "y1": 1082, "x2": 700, "y2": 1072, "bend": -10 } ] }
```
- `blobs` work on every beat kind (memo/demo/icons/approve place them inside the scene; others overlay them)
- `credit`: small source line bottom-right above the captions (y≈1730) — use it for every captured site/demo/news image
- `sfx` on any beat: `[{ "at": 0.2, "name": "type", "vol": 0.3 }]` (names = files in `public/sfx/`). Cuts, notes,
  icons, character pops, approve taps and connect icons get SFX automatically; add only extra ones.
- strokes draw smooth (no wobble) and fully, with pathLength=1; keep them inside y 300–1240

#### Countdown beats (`win` — ranking shorts, EP.05 "가장 똑똑한 AI 순위 TOP9")

One rank at a time in a fixed layout: the `fixed` hook title on top, a full-width 16:9 window
(y 410–1018), a 9→1 ladder (y≈1046), stat cards (y 1124–1280), plain captions below. Use with
`"hookStyle": "fixed"` and `"captionStyle": "plain"`. How to write one: `references/shorts-motion.md` § 7.
```jsonc
{ "kind": "win", "ladder": true, "icons": [ { "src": "icons/claude.jpg", "label": "클로드", "say": "클로드" } ] },  // intro: icons in the window
{ "say": "기준은", "kind": "win", "src": "images/aa_site.png", "pos": "50% 0%", "ladder": false,   // image or .mp4 in the window
  "facts": [ { "label": "합친 시험", "value": 9, "unit": "개", "tone": "gold", "say": "9개" } ], "credit": "artificialanalysis.ai" },
{ "say": "8위", "kind": "win", "r": 8, "name": "GPT-6.1 Terra", "maker": "OpenAI", "logo": ["icons/chatgpt.jpg"], "score": 51,
  "src": "clips/terra.mp4", "start": 6, "rate": 1, "ladder": true,                              // the model's official video, from 6 s
  "facts": [ { "label": "과제당 비용", "prefix": "$", "value": 0.96, "decimals": 2, "tone": "good", "say": "1달러도" },
             { "label": "TOP9 중", "text": "최저가", "tone": "good", "say": "제일" } ],
  "credit": "OpenAI 공식 영상 · Artificial Analysis" },
{ "say": "대망의", "kind": "win", "r": 1, "mystery": true, "ladder": true },                       // "?" teaser before #1
{ "say": "아레나에선", "kind": "win", "ladder": false,                                             // mini board in the window
  "rows": [ { "r": 1, "icon": "icons/gemini.jpg", "name": "Gemini 4 Carbon", "score": 1526, "say": "카본" } ] },
{ "say": "딥시크와", "kind": "win", "ladder": false, "icons": [ … ], "stamp": "TOP9 밖", "stampSay": "없고요" },
{ "say": "여러분이라면", "kind": "win", "ladder": false,                                           // closing question: option cards
  "options": [ { "icon": "icons/claude.jpg", "tag": "비싼 1위", "name": "Fable 5.2", "color": "#FF6B6B", "say": "페이블" } ] }
```
- `r` puts the rank badge on the window (red; yellow for 1) and lights that ladder step; `name`/`maker`/`logo`/`score`
  make the lower third (score pill counts up). `ladder: true` shows the 9→1 row; `past` (ranks already revealed,
  with their logo) is filled in by prepare.py from the earlier beats — set it only to override.
- window content, first that applies: `mystery` → `icons` → `rows` → `options` → `src` (video/image; `start` s, `rate`, `pos`)
- `facts` (1–2 cards; one card goes full width): `value` counts up (`prefix`, `unit`, `decimals`) or `text` (shrinks when long);
  `ring: 0.6` adds a timer ring filled to 60 %; `bars: [{label, value, hi}]` compares prices (uses `prefix`/`unit`);
  `tone` good (green) / bad (red) / gold (yellow).
- Item timing: `say` on facts/icons/rows/options (searched after the beat's own word) or `at` seconds into the beat;
  `stampSay`/`stampAt` for the stamp. Rank stamp, fact/icon/option pops and the cut whoosh are automatic.
- `tall: true` stretches the window over the ladder/fact area (vertical videos, full-height clips; `fit: "contain"`
  shows a vertical video whole). `posts: [{src, at|say, scroll, scrollFor, w, rot}]` shows captured posts as cards
  (crop to the text, blur avatars/handles). `headline` (+ `headlineAt`) slams a big word over the bottom of the beat.
- **`mode` — vary the layout.** The user found "video + two cards" on every beat boring (EP.06). Mix these
  (all fill y 410–1280; items take `say` or `at`; a `stamp` works on any of them):
  - `blueprint`: the clip turns into a blue technical drawing as a scan line sweeps (`src`, `wipeAt`, `labels`)
  - `cards`: 2–3 big cards with a file glyph and ✕/✓ (`items` [{glyph, title, sub, tone, mark: "x"|"check"}])
  - `hex`: disassembler rows read line by line (`label`, `every`, `file`)
  - `flow`: 2–4 nodes top→bottom with a moving packet (`nodes` [{label, sub, icon, tone}])
  - `big`: one huge count-up with stars (`value`, `decimals`, `prefix`, `unit`, `label`, `sub`, `valueAt`)
  - `vs`: "원조 → 새것" rows, the original struck through (`rows` [{from, to, icon}])
  - `grid`: icons popping in a grid with a running count (`grid` [src], `cols`, `every`, `plus`, `count`)
  - `quote`: paper card, one line highlighted (`title`, `lines`, `hl`, `hlAt`, `source`, `paper: false` for dark)
- The ladder has `total` steps (prepare.py sets it to the highest `r`, so TOP5/TOP10 work as is).
- Older ranking kinds, kept for reference: `rank` (ivory leaderboard that fills row by row) and `card`
  (one rank per ivory page with post-it reasons). The user found both weaker than `win` ("포스트잇 장면은 너무 별로").

## Thumbnail

- `lines`: 1–2 very short lines; the last is drawn in the accent colour
- `sub`: small label above
- `image`: optional faint picture behind the right half
- `pose`: otter pose on the right (default `surprised`; any of the 28 below)
- The first line is the Big Number (auto-sized, red marker circle drawn around it); keep it short ("2.3배", "15분→1분")

## Mascot and doodles (any scene)

```jsonc
"mascot": {
  "beats": [ { "at": 1.6, "pose": "surprised", "say": "헐" }, { "at": 4.2, "pose": "cheer", "say": "두 배!!" } ],
  "side": "right",          // or "left" — keep it away from the data
  "size": 380,              // height at 1080p (shorts use 80%)
  "character": "otter",     // or a guest: cat, puppy, hamster, bunny, mole, hedgehog (single pose)
  "until": 6.0              // optional: slide out
},
"doodles": [
  { "type": "circle",    "at": 1.0, "x": 40, "y": 40, "w": 22, "h": 14, "text": "여기!", "until": 3.2 },
  { "type": "arrow",     "at": 3.6, "x": 28, "y": 52, "w": 10, "h": 6, "text": "체크" },
  { "type": "underline", "at": 3.4, "x": 9,  "y": 46, "w": 22, "h": 5, "text": "기록 그대로" },
  { "type": "note",      "at": 1.2, "x": 66, "y": 16, "w": 18, "h": 16, "text": "맥북 M3\n16GB로 돌림", "rotate": 4 }
]
```

- `at`/`until` are seconds into the scene; time beats to the narration (the word the reaction is about).
- One or two beats per scene; not every scene needs the otter. Pick the pose from what the
  narration says at that beat (prepare.py warns about unknown pose names):

| situation in the script | pose | `say` example |
|---|---|---|
| intro, greeting, outro bye | `wave` | "안녕!", "다음에 봐요" |
| explaining a concept, walking through steps or a diagram | `explain` | "자, 보세요" |
| key insight, tip, the trick | `idea` | "꿀팁!" |
| investigating, zooming into a detail, debugging | `search` | "어디 보자.." |
| summary, checklist, takeaways | `note` | "정리하면" |
| docs, paper, release notes | `reading` | "공식 문서엔.." |
| live demo, watching the screen, "watch next" | `laptop` | "직접 해볼게요" |
| hypothesis, comparing options | `thinking` | "음.." |
| weird output, open question to the viewer | `confused` | "왜??" |
| sneak peek before a reveal | `peek` | "살짝 보면" |
| unexpected result | `surprised` | "헐" |
| shocking number | `gasp` | "말도 안 돼" |
| success, big number lands | `cheer` | "두 배!!" |
| best result of the episode | `jump` | "됐다!!" |
| celebration, next-episode teaser | `excited` | "다음 편!" |
| cute or embarrassing result, thanks to viewers | `shy` / `blush` | "헤헤" |
| risk, cost warning, might fail | `worried` | "괜찮을까.." |
| bug, rate limit, bad answer | `angry` | "아 진짜" |
| waiting for something slow | `calm` / `coffee` | "기다리는 중" |
| boring stretch, slow model | `sleepy` | "졸려.." |
| very long job, time skip (overnight) | `nap` | "(8시간 뒤)" |
| listening, neutral | `idle` | — |

  Outfits are for special moments, at most one per episode (series opener, thumbnail):
  `explorer` new tool / field test, `graduate` tutorial complete or series finale,
  `pajamas` late-night or overnight build, `cozy` calm retrospective or seasonal talk.
  Match the thumbnail `pose` to the episode's payoff the same way (`gasp`/`surprised` for a
  shocking number, `jump` for a win, `angry` for a fail, `explorer` for "I tried X").
- `say` is one to four words in casual Korean ("헐", "오?", "두 배!!", "음..").
- Doodle x/y/w/h are % of the 16:9 frame. Point at the thing the narration names; 1–2 per scene.
  Shorts lay scenes out differently, so they only draw `doodlesShort` (same format, % of 1080x1920).
- Recording scenes circle every click automatically (crude red marker, placed through the zoom
  camera, so it is right in 16:9 and 9:16). Turn off with `"clickMarks": false`; don't add manual
  circles on recordings — add an `arrow` or `text` doodle only for things that aren't clicks.

## Data & story scenes (tier · quiz · scoreboard · news · doc · race · flow · code · receipt · map)

Ten formats taken from what works on tech/AI YouTube in 2025–26 (tier lists, "real or AI?" quizzes,
round-by-round matches, news fact-checks, document evidence, ranking races, architecture flows, code
walk-throughs, subscription receipts, map routes). Each works at 16:9 and 9:16.

**Timing (all ten):** any object in these scenes' props may carry `"say": "<phrase from this scene's
narration>"` (searched in order, so a repeated word hits its next use) or `"at": <seconds into the
narration>`; prepare.py turns it into `from` (frame). Items without either are spread over the scene, so
a scene still plays before you time it. Mascot beats can use `"on": "<phrase>"` instead of `at`.
In 9:16 shorts these scenes draw the otter smaller (≤ 270 px) so it stays off the data; still keep
mascot beats few and short on them, or leave the mascot out.

**Real data only** — rankings, scores, prices, routes and quotes are presented as real. Use what was
measured or sourced; a verdict/tier is your stated opinion. Never fill these with invented numbers.

### tier
A tier-list board for "이거 몇 티어?" rankings of tools, models or products: chips slide into their
row one at a time with a hand-written verdict, a "배치 완료 n / N" counter ticks up, and one item can
fake a landing in the wrong row before jumping to its real tier with a stamp and a board shake.
```jsonc
{ "id": "tiers", "type": "tier", "title": "AI 코딩툴 티어표", "subtitle": "기준: 일주일 써본 체감 생산성",
  "tiers": [ { "label": "S", "color": "#FF5A3C" }, { "label": "A", "color": "#FF9F3D" }, { "label": "B", "color": "#FFD84D" },
             { "label": "C", "color": "#7FD8A6" }, { "label": "F", "color": "#6E727C" } ],
  "items": [
    { "say": "클로드는", "name": "Claude",  "tier": "S", "note": "리팩토링 장인", "color": "#D97757" },
    { "say": "커서는",   "name": "Cursor",  "tier": "A", "note": "IDE 끝판왕",   "color": "#5B8CFF" },
    { "say": "메모장은", "name": "메모장",  "tier": "F", "note": "근본은 인정",  "badge": "메" },
    { "say": "에이더",   "name": "Aider",   "tier": "S", "fakeTier": "F", "move": { "say": "써보니" }, "note": "터미널 숨은 고수" }
  ],
  "stamp": { "text": "반전 S급!" } }
```
- `tiers`: rows top to bottom (`label`, `color`), 3–6 rows; row height shrinks to fit
- `items[]`: `name`, `tier` (row label it ends in), `note` (verdict shown when it lands, keep it short),
  `color` (chip accent, default the brand accent), `badge` (1–2 letters, default first 2 chars of name)
- Fake-out: `fakeTier` = row it lands in first; `move: {say|at}` = when it jumps to `tier` (default ~1 s
  after landing). `stamp: {text, say|at?}` slams when it arrives (default: right on the move)
- `say`/`at` on every item (and on `move`/`stamp`); items without timing are spread over the scene
- Chips shrink to fit the fullest row. 16:9: board left, counter top right, verdict next to the chip,
  lower right free for the mascot. 9:16: title + counter under the hook, full-width board, verdict strip
  below it.
- Verdicts are your real opinion of each item — don't invent rankings.

### quiz
A guess-then-reveal quiz ("진짜 vs AI", "정답은 몇 번?"): 2 or 4 numbered image panels, a 3-2-1
countdown ring with a scan line, then a stamp lands on every panel, the clue line gets highlighted and
an optional accuracy bar fills with its own stamp. Use it to make the viewer commit to an answer first.
```jsonc
{ "id": "guess", "type": "quiz", "question": "둘 중 AI가 만든 사진은?", "tag": "진짜 vs AI",
  "items": [
    { "src": "images/real_cat.jpg", "label": "놀란 고양이", "isAI": false },
    { "src": "images/ai_puppet.png", "label": "곁눈질 인형", "isAI": true }
  ],
  "countdown": { "say": "3초 드릴게요" },
  "reveal":    { "say": "정답은" },
  "explain":   { "say": "털 결이", "text": "단서: 털 결이 너무 매끈하고 배경 글자가 뭉개짐",
                 "highlights": ["털 결이 너무 매끈", "배경 글자가 뭉개짐"] },
  "accuracy":  { "say": "정답률은", "label": "시청자 누적 정답률", "value": 38, "stamp": "62% 속음!" } }
```
- `items`: 2 (side by side, ring between) or 4 (2x2 grid, ring at the cross). `src` in `public/`
  (missing → gradient "이미지 슬롯 n" placeholder), `label` caption, `isAI` true = the target answer
  (red stamp) / false = the other answer (green stamp), `answerLabel` = stamp text (default "AI" / "진짜";
  e.g. "정답", "오답", "실사")
- `question`; `tag` = pill before it ("진짜 vs AI" default, `""` hides it)
- `countdown`, `reveal`: `{say|at}`; defaults ~22% into the scene and 3 s later. Numbers tick evenly
  between them (≤ 1 s each)
- `explain`: `{text, highlights?, say|at}` — highlights are substrings of `text`, swept in order
  (default 1.2 s after the reveal)
- `accuracy`: `{label, value (0–100), stamp?, say|at}` — bar fills, stamp slams when it lands
- `cta`: `{before?, during?}` overrides the hand-written prompt ("댓글에 번호 먼저 찍고 보기!" /
  "번호 골랐죠? 3초 드립니다")
- 16:9 with 4 panels: grid left, text in a right column. 9:16: question under the hook, panels then text.
- Images and the answer key must be real — never stage a fake answer.

### scoreboard
A round-by-round match, sports-broadcast style, for model/tool face-offs over several tasks: a live
score bar on top, each round's title card slams in and settles into a header, one result card per
contestant pops in with PASS/FAIL, a "승리!" stamp hits the winner and "+1" flies to their score.
Scores accumulate across rounds; `final` ends on a big score board with the leader marked.
```jsonc
{ "id": "match", "type": "scoreboard", "event": "AI 코딩 3파전",
  "contestants": [ { "name": "GPT", "color": "#3DDC97", "score": 1 }, { "name": "Claude", "color": "#E8865F" },
                   { "name": "Gemini", "color": "#5B9BFF" } ],
  "rounds": [
    { "say": "두 번째 라운드", "title": "ROUND 2 · 버그 고치기", "task": "무한루프 버그 찾아서 고치기",
      "winner": "Claude", "verdict": { "say": "클로드만" },
      "results": [ { "who": "GPT",    "text": "엉뚱한 파일 수정\n테스트 3개 실패",   "pass": false },
                   { "who": "Claude", "text": "while 조건 1줄 수정\n테스트 전부 통과", "pass": true },
                   { "who": "Gemini", "text": "원인은 찾음\n수정은 미완성",        "pass": false } ] }
  ],
  "final": { "say": "중간 스코어는", "label": "중간 스코어" } }
```
- `contestants`: 2–4, `name`, `color`, `score` (starting score, default 0), `badge` (default name[0..2])
- `rounds[]`: `title` ("ROUND 2 · 버그 고치기": the part before `·` is in the accent and shows as "R2"
  in the bar), `task` (mission line), `results[]` (`who`, `text` with `\n` for a 2nd line — keep to 2
  short lines, `pass` true/false/omitted), `winner` (name, list for a shared win, omit for none),
  `points` (default 1)
- Timing: round `say|at` = title slam; `verdict: {say|at}` = stamp + score tick (default ~3 s in,
  compressed when rounds are close); `final: {label, leadLabel? ("선두"), say|at}` (default ~2.6 s
  before the end). Rounds without timing are spread over the scene.
- `event`, `live` ("● LIVE"; `""` hides it)
- 16:9: cards in a row, kept above the lower-right mascot spot. 9:16: two-line bar under the hook,
  cards stacked (text shrinks to fit).
- Results are what really happened in the test — never invent outcomes.

### news
News roundup / fact check: headline cards fly in and pile up, the key phrase gets the highlighter and a verdict stamp slams on each. Use it for "이번 주 AI 뉴스", headline fact checks, "이 기사들 진짜일까?".
```jsonc
{ "id": "check", "type": "news", "title": "이번 주 AI 뉴스 팩트체크",
  "items": [
    { "say": "코딩 업무", "outlet": "테크데일리", "date": "2026.11.03",
      "headline": "AI 에이전트, 이제 코딩 업무 70% 대신한다", "highlight": "코딩 업무 70%", "verdict": "과장" },
    { "say": "일자리 절반", "outlet": "데브인사이트", "headline": "생성형 AI가 개발자 일자리 절반 없앤다",
      "highlight": "일자리 절반", "verdict": "오보" },
    { "say": "무료 공개", "outlet": "퓨처와이어", "headline": "새 오픈 모델 무료 공개", "verdict": "부분 사실", "tone": "warn" }
  ],
  "summary": { "say": "결과는" } }
```
- `items[]`: `outlet` (first letter becomes the logo), `color?` (logo colour), `date?`, `tag?` (pill, default "IT · AI", `""` hides it), `headline` (quote the real headline), `highlight?` (exact phrase inside the headline), `verdict?` (short text), `tone?` (`good`/`warn`/`bad`; 사실/과장/오보 are picked automatically)
- `say`/`at` per item = the card lands; highlighter ~0.5 s later, stamp ~1 s later. Without timing the cards are spread over the scene
- `title?`, `kicker?` (default "NEWS CHECK"); counter N/total and verdict dots top right
- `summary?`: `{say|at}` (or `true`) — tally chips per verdict under the pile
- Card height follows the headline (1–3 lines). 3–6 items is the sweet spot

### doc
Document evidence ("원문 확인"): a paper page slides in, the camera pushes into one paragraph, the key sentence is highlighted while the rest dims, then a source tag, a red circle and a post-it land. Use it when the narration quotes a paper, system card, ToS, press release or law.
```jsonc
{ "id": "proof", "type": "doc",
  "source": { "title": "모델-X 시스템 카드", "doc": "System Card", "page": 47, "date": "Model-X · 2026.10" },
  "section": "4.3 자율 행동 평가",
  "paragraphs": ["본 절에서는 …", "We measured …", "그러나 … 검증 코드를 수정하려는 시도가 3.2%의 사례에서 관찰되었다. …", "…"],
  "highlight": { "para": 2, "text": "검증 코드를 수정하려는 시도가 3.2%의 사례에서 관찰되었다.", "circle": "3.2%", "say": "검증 코드" },
  "cite": { "say": "출처는" }, "circleMark": { "say": "이 숫자" },
  "note": { "text": "시험 답안을\n고쳐 쓴 셈!", "say": "시험 답안" } }
// real screenshot instead of typeset text:
//  "image": "images/syscard_p47.png", "highlight": { "box": { "x": 8, "y": 41, "w": 84, "h": 9 }, "circle": true, "say": "검증 코드" }
```
- `source`: `title` (used in the 출처 tag), `doc?` (short name in the page header), `page?`, `date?`
- `section?`, `paragraphs[]` (3–6, quoted from the real source; trim, don't rewrite)
- `highlight`: `para` (index), `text` (exact sentence inside it), `circle?` (word inside `text` to ring), `say`/`at` — the camera push ends just before it (default ~35 % into the scene)
- `cite?` (`{say|at}`, default 1.3 s after the highlight, `false` hides it), `circleMark?` (`{say|at}`, default +2.2 s), `note?` (`{text, say|at}` post-it top right)
- `image?`: a page screenshot in `public/` instead of typeset paragraphs; then `highlight.box` = `{x,y,w,h}` in % of the image and `circle: true` rings the box
- The page settles at 1:1 (no zoom shimmer); paragraph position is measured from the real layout

### race
Bar chart race: bars grow period by period and re-sort with smooth swaps, a big period counter ticks, and a "1위 등극!/탈환!" stamp slams whenever the leader changes. Use it for rankings over time (users, downloads, benchmark scores, market share).
```jsonc
{ "id": "rank", "type": "race", "title": "AI 챗봇 주간 사용자", "unit": "만 명", "topN": 6,
  "entities": { "otter": { "label": "오터GPT", "color": "#FF6A3D" }, "raccoon": { "label": "라쿤AI" }, "penguin": { "label": "펭귄LM" } },
  "frames": [
    { "period": "2023 Q1", "values": { "otter": 120, "raccoon": 60, "penguin": 90 } },
    { "period": "2023 Q2", "values": { "otter": 180, "raccoon": 110, "penguin": 140 } }
  ],
  "run": { "say": "따라가" }, "end": { "say": "마무리" } }
```
- `entities`: `{key: {label, color?}}` (no colour: accent, mint, then greys — give the story's two rivals the colours)
- `frames[]`: `{period, values: {key: number}}` in time order — real data points only
- `run?` (`{say|at}`, race starts; default 0.7 s), `end?` (`{say|at}`, last period reached; default 2 s before the scene ends) — periods are spread evenly between them
- `title?`, `unit?`, `kicker?` ("RANKING"), `topN?` (6), `decimals?` (0)
- `leadStamps?`: `true` (default) / `false` / `{first?: "1위 등극!", retake?: "1위 탈환!"}`

### flow
An architecture / pipeline diagram where glowing packets run each step's path on its spoken word, with a
step checklist that ticks off. Use it to explain how a system, agent or pipeline works, or to replay what
happened in a run (a failed step, the retry, then success).
```jsonc
{ "id": "rag_flow", "type": "flow", "title": "RAG 에이전트는 이렇게 돌아가요", "kicker": "구조도 · 한눈에 보기",
  "nodes": [
    { "id": "user",   "label": "사용자",   "sub": "질문 입력", "icon": "user",   "x": 0,   "y": 0 },
    { "id": "agent",  "label": "에이전트", "sub": "작업 지휘", "icon": "agent",  "x": 50,  "y": 0 },
    { "id": "search", "label": "검색",     "sub": "벡터DB",    "icon": "db",     "x": 100, "y": 0 },
    { "id": "llm",    "label": "LLM",      "sub": "답변 작성", "icon": "llm",    "x": 100, "y": 100 },
    { "id": "answer", "label": "답변",     "sub": "출처 포함", "icon": "answer", "x": 50,  "y": 100 }
  ],
  "edges": [ { "from": "user", "to": "agent" }, { "from": "agent", "to": "search" },
             { "from": "search", "to": "llm" }, { "from": "llm", "to": "answer" } ],
  "runs": [
    { "say": "질문을",        "path": ["user", "agent"],  "label": "① 질문 받기" },
    { "say": "문서 검색을",   "path": ["agent", "search"], "label": "② 문서 검색", "fail": true, "failText": "타임아웃!" },
    { "say": "다시 검색해서", "path": ["agent", "search"], "label": "② 다시 검색" },
    { "say": "LLM에 전달",    "path": ["search", "llm"],   "label": "③ LLM에 전달" },
    { "say": "출처가",        "path": ["llm", "answer"],   "label": "④ 답변 완성" }
  ],
  "done": { "say": "완성됩니다", "text": "답변 완료!" } }
```
- `nodes`: `x`, `y` = position in % of the diagram area (0 = left/top, 100 = right/bottom); boxes shrink
  to fit the grid they form. `sub` and `icon` are optional; icons: `user` `agent` `db` `llm` `answer`
  `server` `cloud` `file` `code` `tool`
- 9:16 transposes the layout (x↔y: a wide 3×2 grid becomes a tall 2×3 one); set `xShort`/`yShort` on a
  node to place it by hand instead
- `edges`: arrows between node ids (drawn as the nodes pop in)
- `runs` (the steps — `steps` is reserved by prepare.py): a packet runs along `path` (2+ node ids, one hop per 0.7 s) when `say` is spoken (or `at`);
  the checklist shows `label` big and ticks it off. `fail: true` kills the packet half-way along its first
  hop (red X, shake, hand-drawn retry loop; `failText` is scribbled next to it); follow it with the retry step
- `done`: `{say|at, text}` mint stamp in the middle, every edge starts flowing
- `title`, `kicker` optional; `retryText` (default "재시도 ↺")
- Without `say`/`at`, runs are spread evenly over the scene. 16:9: checklist top-right, lower right free
  for the mascot; 9:16: checklist under the diagram (left two-thirds)
- Keep 3–6 nodes and up to ~7 runs; labels short (a node label is 1–2 words)

### code
A code walkthrough in a stylised editor: one line range is focused at a time (the rest dims) with a callout
note, a diff can strike a line and type its replacement, and a red marker circles the key line. Use it to
explain real code line by line — paste the actual (trimmed) file, never invented code or output.
```jsonc
{ "id": "rag_code", "type": "code", "filename": "rag.ts", "language": "ts", "tabs": ["vector.ts"], "branch": "main",
  "code": "import { embed, search } from './vector';\nimport { llm } from './llm';\n\nexport async function answer(question: string) {\n  const q = await embed(question);\n  const docs = await search(q, { topK: 3 });\n  …",
  "focus": [
    { "say": "도구 두 개", "lines": [1, 2],  "note": "도구 두 개 불러오기" },
    { "say": "벡터로",     "lines": [5, 6],  "note": "질문을 벡터로 바꿔\n비슷한 문서 검색" },
    { "say": "프롬프트에", "lines": [8, 9],  "note": "찾은 문서를\n프롬프트에 붙이기" }
  ],
  "diff":    { "say": "여덟 개로",  "line": 6, "newText": "  const docs = await search(q, { topK: 8, minScore: 0.7 });" },
  "keyLine": { "say": "이 한 줄이", "line": 9, "text": "이 한 줄이 핵심!" } }
```
- `language`: `ts` `tsx` `js` `jsx` `py` `bash` `json` `yaml` `sql` `go` `rust` `java` `c` `cpp` `css`
  `html` `diff` `md` `docker` `powershell` (full names like `typescript`/`python` work too)
- `code`: the file as one string (`\n` between lines). Up to ~30 lines: it shrinks to fit, then scrolls so
  the focused range stays in view. The font shrinks for long lines only down to a readable floor (~70 characters at 16:9); longer lines are clipped at the window edge, so wrap or trim them
- `focus`: `lines: [a, b]` (1-based, inclusive; a single number = one line) highlighted when `say` is
  spoken; `note` (1–3 short lines, `\n` breaks) goes in the callout with "POINT n · La–b"
- `diff` (optional): line `line` is struck in red and `newText` typed in green in its place; time it right
  after the focus on that line
- `keyLine` (optional): the last beat — focus moves there, the callout leaves, a red marker ellipse circles
  the line and `text` is scribbled beside it (below the editor in 9:16)
- `tabs` (extra inactive file tabs) and `branch` (status bar) are optional decoration
- Without `say`/`at`, focus → diff → key line are spread over the scene. 16:9: callout right of the editor
  in the upper half (lower right free for the mascot); 9:16: callout under the editor

### receipt
Cost audit as a thermal receipt: lines print while the monthly total ticks up, unused lines get a red strike + "안 씀", and the payoff splits the bill into 실사용 / 낭비 with a yearly post-it. Use it for subscription checks, API bills, tool costs.
```jsonc
{ "id": "bill", "type": "receipt", "title": "AI 구독 영수증", "date": "2026.11 · 월 정기결제", "currency": "₩",
  "lines": [
    { "say": "오터GPT", "name": "오터GPT", "plan": "Pro · 월간", "price": 29000 },
    { "say": "미어캣 노트", "name": "미어캣 노트", "plan": "Plus", "price": 9900, "unused": true },
    { "say": "카피바라", "name": "카피바라 보이스", "plan": "Studio", "price": 22000, "unused": true }
  ],
  "strike": { "say": "그런데" }, "result": { "say": "실제로" } }
```
- `lines[]`: `name`, `plan?`, `price` (real amounts), `unused?`; `say`/`at` = the line prints (default: printing fills the first ~45 % of the scene)
- `strike?` (`{say|at}`): unused lines are struck one after another (0.75 s apart) from here
- `result?` (`{say|at, labels?: {real, waste}}`): the final 실사용 / 낭비 split with a share bar
- `yearly?` (default `true`): "1년이면 ₩… 증발" post-it; `false` hides it
- `labels?`: `{total, per, unused, head: [left, right], sum, printer, yearly ("{n}" = yearly waste)}` to retitle for non-subscription bills
- 3–8 lines; rows stretch to fill the frame

### map
A dot-matrix world map: the camera flies between regions, numbered pins pop with labels, glowing dashed
routes arc between pins, a spot pulses with a big label and a summary card closes it. Use it when the
story is about where things are or how they move: supply chains, launches by country, a trip, data centres.
Places, distances and shares are shown as real.
```jsonc
{ "id": "chip_map", "type": "map", "title": "AI 칩은 이렇게 이동해요", "kicker": "지도로 보는 공급망",
  "camera": [
    { "center": [135, 30], "zoom": 1.0 },                       // first view, from the start
    { "say": "따라가",      "center": [124, 31], "zoom": 4.2 },
    { "say": "완성된 칩은", "center": [178, 33], "zoom": 2.0 },
    { "say": "세 대륙",     "center": [135, 30], "zoom": 1.0 }
  ],
  "pins": [
    { "say": "한국에서", "id": "kr", "lon": 127.0,  "lat": 37.5, "label": "한국", "sub": "HBM 메모리", "num": "1" },
    { "say": "대만으로", "id": "tw", "lon": 120.9,  "lat": 24.0, "label": "대만", "sub": "칩 생산",    "num": "2", "side": "left" },
    { "say": "미국",     "id": "us", "lon": -121.9, "lat": 37.4, "label": "미국", "sub": "AI 데이터센터", "num": "3" }
  ],
  "routes": [
    { "say": "보내고",       "path": ["kr", "tw"], "label": "메모리 · 1,500km" },
    { "say": "데이터센터로", "path": ["tw", "us"], "label": "완제품 칩 · 10,400km" }
  ],
  "spots":   [ { "say": "구십 퍼센트", "pin": "tw", "text": "첨단 칩 90%" } ],
  "summary": { "say": "이만 킬로미터", "sub": "칩 하나의 여행", "text": "3대륙 · 2만 km" } }
```
- `camera`: views `{center: [lon, lat], zoom}`; each later one flies in (1.3 s) when said. `zoom` 1 = the
  whole world across the frame width (4 ≈ one country region); the same zoom shows the same east–west span
  in 9:16. Optional `centerShort`/`zoomShort` for the vertical framing (9:16 centres on the middle band)
- `pins`: `id`, `lon`/`lat` (degrees, west = negative), `label`, optional `sub` (shown when zoomed in),
  `num` (badge — plain digits), `side` (`left`/`right` label; auto-flips near the right edge)
- `routes`: `path: [pinId, pinId, …]` (not `from`/`to` — prepare.py writes timed objects' `from`), optional
  `label` pill (hidden at world zoom), `bend` (arc, default 0.28; negative bends the other way). Multi-pin
  paths draw leg by leg
- `spots`: `pin` (or `lon`+`lat`), `text` (big accent label), `r` (radius in degrees, default 2.4); stays
  until the camera next moves, or `for` seconds
- `summary`: `{say|at, text, sub?}` card (top-right in 16:9, lower-left of the middle band in 9:16)
- The world is Pacific-centred (Americas east of Asia); the land outlines live in
  `src/components/MapLand.ts` — recognisable, not survey-grade; add an island there if a story needs it
- Without `say`/`at`, pins (each route right after its pins, spots after their pin) and the summary are
  spread over the scene and camera moves over the same span

## Stickers (any scene)
Small polaroid memes/photos with a hand-written label that pop in on a word — a reaction, not the
subject. `stickers` for 16:9, `stickersShort` for 9:16 (each format only draws its own list).
```jsonc
"stickers": [
  { "src": "images/memes/this_is_fine.jpg", "label": "현재 상황", "say": "네?", "until": "고쳤", "x": 70, "y": 25, "w": 400, "rotate": 5 },
  { "src": "images/memes/cat_surprised.jpg", "label": "이게 그 영상", "say": "영상입니다", "for": 2.5, "x": 72, "y": 22, "w": 380 }
]
```
- `say`/`at` start it; `until` (phrase) or `for` (seconds, default 2.8) end it.
- `x`, `y`: % of the frame (top-left corner); `w`: px at 1080p (keep 220–440); `rotate`: degrees.
- Place them in empty space (beside a chat window, over the terminal's aside column, a corner) —
  never over data, captions, or the hook.
- License: only images you may use. Note the source (and any CC credit line, e.g. in the outro or
  description); flag risky memes (copyrighted characters, artists who object) to the user.

