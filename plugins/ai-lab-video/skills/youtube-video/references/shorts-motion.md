# Shorts direction playbook — motion beats

Reference short: EP.04 "피클, 뮤즈가 챗GPT랑 다른 점" (45 s, 16 beats). The user's verdict:
"모션그래픽들이 센스가 넘친다 — 적재적소에 적절한 모션그래픽과 영상이 들어가서 좋다."
The point is **matching each spoken line to the one visual that proves or shows it**, using the
product's real material first. Read this before writing `beats` for any product, app, service or
AI-tool short.

## 1. Pick the visual from what the line says

| the narration says… | beat | what the EP.04 version did |
|---|---|---|
| the opening hook / "요즘 왜 난리?" | `photo` with the product's own hero video/image | pickle.com hero video, **held ≥ 4 s** (the user said the first picture vanished too fast) |
| what people usually do / the old way | `photo` b-roll (.mp4) + short `text` | stock typing clip + "챗GPT에 \"KTX 끊어줘\"" + `type` sfx |
| what the old tool answers | `memo` with notes + a red `line` stroke under the punchline | "코레일톡 열고…결제하세요~" post-it, "→ 방법만 알려줌" in red |
| **what the product actually does** | `demo`: the product's official demo video in a phone (rate 2) + its character with a bubble | KTX booking demo; character "제가 끊어왔어요!", 2nd character "취소표 뜨면 바로!" |
| how it works under the hood | `photo` b-roll + 2-line `text` | server-room clip, "자기 클라우드 브라우저" |
| **named services / apps** ("쿠팡, 코레일, 정부24") | `icons` — real app icons slam in **as each name is spoken** (`at` = word offsets) | + character "직접 로그인!" |
| a second capability | another `demo` (other demo video, phone on the other side, character mirrored) | phone call demo, "전화 거는 중~" |
| price / availability / a fact from the site | `memo` with the site screenshot taped (`tapes`) + a post-it + `credit` | "한국은 지금 무료!" |
| a competitor / news | `photo` of a real news frame (composite, headline above the caption zone) + `credit` | PBS Meta Muse frame |
| a number | `number` count-up + `label` + `credit` + a character reacting | 1,090만, "40일 만에?!" |
| **the thesis / contrast** (A → B) | `memo`: A on a white card, then B on a post-it, smooth red `arrow` A→B and an `ellipse` around B, character "이게 차이!" | "말 잘하는 AI" → "내 일을 직접 하는 AI" |
| a user action / safeguard ("결제는 내가 승인") | `approve` card, finger taps at `pressAt`, button turns green "승인 완료 ✓" | numbers taken from the official demo, `note` says so |
| a risk / permissions / privacy | `connect`: account icons fly in, "AI가 볼 수 있는 정보 n/7" meter climbs, security badge at `secAt` | 7 icons, sec_box image from the site, "권한은 필요한 만큼만" |
| the question to viewers | `photo` b-roll "여러분이라면?" → `memo` with 3 coloured post-its (options) + character "댓글로!" | |

Rules of thumb:
- **One idea per beat, cut on the noun** (`say` = the first word of the phrase that the visual is about).
  2–4 s per beat; never two "memo"s with the same layout back to back unless the second builds on
  the first (the 말 잘하는 AI → 직접 하는 AI pair keeps the white card in place with `at: -1`).
- **Real footage first**: the product's site (demo videos, character loops, screenshots) → official
  news frames → stock b-roll. Generated images only when nothing real exists. Credit everything on
  screen (`credit`) and in the upload text.
- **Product characters are the mascot for that short**: use the brand's own transparent loops as
  `blobs` with 2–5-word bubbles (cute, first-person: "제가 끊어왔어요!"). Max 1–2 per beat, never
  covering the phone or the text; alternate sides; `flip` to face inward. They replace the otter in a
  product short.
- **Motion beats over text cards.** The user rejected the quote card and the giant `big` burst as
  "AI 티 / 효과가 별로". Prefer ivory `memo` pages, phone demos, icons, approve, connect. Keep `big`
  and `quote` for long-form-derived teaser shorts only.
- **Numbers that look like data must be real** (239,200원 came from the official demo screen, and the
  `note` says so).

## 2. Look

- Two palettes alternate: real footage (full-bleed / blurred-bg phone) and **ivory paper** (#F4EEE1
  notebook with ruled lines and a red margin) for memo/icons/approve. Graphite only for `connect`
  (it reads as "inside the machine"). No neon bursts, no gradients, no glow.
- Red marker strokes are **smooth and fully drawn** (`strokes`, pathLength=1). Wobbly/stop-motion
  lines look broken in 9:16 — keep the scrappy jitter only for small doodles in long-form.
- Post-its: yellow default, pink/blue for lists of options, white card for "the old thing",
  `paper: "none"` + red ink for handwritten asides. Slight rotation (−5…5°), slap-in entrance.
- Black Han Sans for bubbles and post-its; bubbles white with a 6 px dark border.

## 3. Safe area (1080x1920, YouTube Shorts UI)

- Content y 300–1240; captions sit ~y1340 (≤ 1480); credit at y≈1730 right-aligned.
- Hook header occupies the top ~270 px after 2 s: **no bubble or character above y≈32 %** (the
  yellow character's bubble was hidden under the title until moved down).
- Keep ~150 px clear on the right below y≈900 (like/comment buttons).
- Phone frame height 990 px from top 250 so it ends above the captions.
- Check every beat with a still at its middle frame before the full render.

## 4. Sound

- Every cut gets a whoosh/send; post-its and icons pop; characters enter with `char_pop` (the user
  picked a cute "뿅" cartoon pop — keep that kind of sound); approve = send + ding; stamps = stamp.
  All automatic from `beatHits`; add `sfx` only for extras (typing on a keyboard clip).
- SFX volume 0.2–0.35 under narration; music low; final loudness −14 LUFS.
- `public/sfx/` comes from `SKILL_DIR/assets/sfx` (scaffold copies it). To swap a sound, replace the
  mp3 with the same name in the project (ElevenLabs sound-generation or a user file).

## 5. Asset gathering (do this before writing beats)

```bash
node SKILL_DIR/scripts/site_media.cjs https://product.com <project>            # list videos/images, phone screenshots
node SKILL_DIR/scripts/site_media.cjs https://product.com <project> --get "demo|idle-540"
node SKILL_DIR/scripts/app_icons.cjs <project> "쿠팡=coupang" "코레일+=korail" "정부24=gov24"
node SKILL_DIR/scripts/stock.cjs <project> search "typing laptop" "server room"
node SKILL_DIR/scripts/stock.cjs <project> get typing=12345 server=67890
```
Then move what you use into `public/<short-id>/` (e.g. `public/pk/`). Look at a frame of every clip
before using it (ffmpeg `-ss 2 -frames:v 1`), check alpha on character webms, and trim demo videos
with `start` / `rate` rather than re-encoding.

## 6. Checklist before rendering

- [ ] hero/opening beat ≥ 4 s, real product visual
- [ ] each "what it does" line has the product's own demo or screenshot
- [ ] every named app/service appears as its real icon on its word
- [ ] user actions shown as an action (tap, connect), not as text
- [ ] characters/bubbles inside the safe area, not under the hook header, not over captions
- [ ] strokes smooth and complete; nothing cut off at the frame edge
- [ ] credits on screen for captured material; sources in `out/shorts-upload.md`
- [ ] SFX audible but under the voice; −14 LUFS; freeze/black detect clean

## 7. Ranking / countdown shorts (`win` beats — EP.05 "가장 똑똑한 AI 순위 TOP9")

The user's reference was a Korean countdown short: a big plain title fixed on top, one media window
in the middle, plain white subtitles, each rank revealed one by one with ~12 s of explanation.
Fields: `references/episode-format.md` → "Countdown beats".

What the user asked for, in order (each was a correction, so do them from the start):
- **Plain subtitles**, not karaoke → `"captionStyle": "plain"`.
- **One rank at a time** like the reference, not a board that fills up → one `win` beat per rank.
- **A video and an explanation for every rank**: the entry's own official video (the maker's
  YouTube channel: launch video, demo, keynote segment) or something made with it, and a narration
  line saying what we are looking at ("구글은 이 모델로 휴머노이드 로봇에게 콩주머니 던지기를 가르쳤어요",
  "지금 보시는 수중 도시도 카본이 3D 코드로 직접 만든 거예요").
- **Motion graphics, not post-its**: count-up stat cards, a timer ring for time, price bars for a
  value comparison. The ivory post-it rank cards were "너무 별로".
- **Big honest title** like other Korean shorts → `"hookStyle": "fixed"`, two lines, last in yellow
  ("가장 똑똑한 AI\n순위 TOP9").
- **"TOP9" read as "탑 나인"**, not "탑 구" → `"pronounce"`.

Structure that worked (121 s for 9 ranks; over 60 s is fine for this format):
1. intro: the contenders' icons in the window ("AI 순위 TOP9, 시험 점수로 줄 세워 봤습니다")
2. the criterion with the source page in the window and 1–2 facts (what is measured, how many tests)
3. ranks N→2: badge + official video + name/maker/score lower third + 1–2 facts, ~10–13 s each
4. `mystery` "?" beat ("대망의 1위는…"), then rank 1 (yellow badge)
5. the twist that starts the comments: a different leaderboard (`rows`), a value pick (`bars`),
   notable entries that missed the list (`icons` + `stamp`)
6. closing question with `options` cards (2–3 choices) → pinned comment repeats the question

Rules:
- **Real, dated data only.** Name the source and date on screen (`credit`) and in the upload text;
  ties and dedupe rules (one entry per model family) go in the description.
- **Clips**: download with yt-dlp `--download-sections "*START-END" --force-keyframes-at-cuts`
  (otherwise the section can come back without a moov atom); look at frames before picking `start`
  (a launch video often opens on a blank title card — Fable's clip moved from 6 s to 17 s). Keep
  them muted; the narration carries the sound. Credit "<회사> 공식 영상".
- Pages behind a captcha are not bypassed: use the maker's keynote or another official video.
- Facts: short labels (≤ 12 chars), one number or a 2–4 word text; the cheapest/fastest/most
  expensive fact is what people argue about. Time per task → `ring`; "same score, 1/8 the price" → `bars`.
- Ladder icons are the maker's app icon (`app_icons.cjs`), so viewers see which company keeps winning.
- Upload text: list every clip's channel and title under "영상 출처".
- **Vary the layout every beat** (EP.06 feedback "영상 + 박스 두 개가 너무 많아 지루"): at most one or two
  classic window+facts beats per short; the rest use `mode` (blueprint, cards, hex, flow, big, vs, grid, quote),
  `tall` clips with a `headline`, and `posts`. Never the same layout twice in a row.
- Explainer shorts ("~가 뭔가요?") use the same fixed title + plain captions, without ranks or ladder. Reviews from
  X/Threads: capture the public embed (platform.twitter.com/embed/Tweet.html?id=…, threads.com/@user/post/…/embed)
  with Playwright at 400 px width, crop to the text, blur avatar and handle, credit the platform only.

### Top margin and cover (EP.06, 2026-11-14)
Phone feeds crop the top of a Short's cover; with the title at y 105 the first line was cut in half.
The template now puts the fixed title at y 190, the window/mode area at y 490–1320 (`WIN_TOP`,
`AREA_TOP`/`AREA_H`), facts and ladder below the window, and plain captions at y 1330. Keep new
layouts inside that area rather than moving them back up. For the Short's thumbnail, render a clean
still of the short itself (`clean: true` prop hides captions and the progress bar) on its most
striking beat — fixed title on top, beat below — instead of a separate otter thumbnail.

## 8. Tower beats — "star elevator" ranking (EP.07 "AI가 짠 무료 프로그램 TOP5", 2026-11-15)

Use for a TOP-N whose entries have a number that spans orders of magnitude (GitHub stars, users,
downloads). Do NOT reuse the `win`/`desk` window layout for every countdown — the user called a
repeat "너무 식상해" and rejected emoji vote buttons as an ending ("마지막 장면이 너무 별로").

- `kind: "tower"`, `floors: [{r, stars, color, ink?, src, start?, pos?, icon, name, what, quote, who}]`
  shared by every beat (put them in a constant). Each floor is a full-bleed colour band at
  log10(stars) height (`SCALE` 1900 px/decade keeps floors ≥ 0.5 decade apart from overlapping).
- Camera: `camFrom` → `camTo` (star values) springs between floors; the yellow HUD counts stars.
- Modes: floor (default; `tease: true` = blurred winner + "???" HUD for the hook, `starAt`),
  `drop` (plunge to the ground, `checks` slam in — criteria), `fog` (unrevealed winner "?"),
  `gap` (`bars` [first, last] linear bars, `stamp`/`stampSay`, red circle on the sliver `markSay`),
  `ask` (full-bleed footage `src`, kinetic `lines` [{text, size, y, color, at|say}], red marker
  arrow to the comment button `arrowAt`, `arrowText`).
- `proofSay` sweeps the yellow highlighter over the floor's `quote` when that word is spoken.
- **SFX:** tower beats use the cinematic `t_*` set (`assets/sfx/t_*.mp3`, copied by scaffold:
  rise, drop, hit, slam, marker, sparkle, tension, boom, pop, scribble), generated with the toolkit
  `tools/sfx.py` (ElevenLabs). The old cartoon set (whoosh/boing/stamp) sounded "저렴한 티" under a
  premium look — keep cartoon SFX for the playful pickle/otter styles only.
- Remotion `still` in parallel fails with "No available ports" on this machine: render a
  `--scale=0.5` draft once with `--port=3417` and pull frames with ffmpeg instead.
