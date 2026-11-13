# Anti-slop passes (every route)

Two passes, both mandatory: one on the narration script before TTS, one on any generated screen
design (Remotion / HyperFrames / OpenMontage scenes) before render. Report both results to the
user with the scene list.

## 1. Script pass — after writing narration, before TTS

Narration is spoken Korean in the channel's casual YouTuber voice, not a document. So:

1. Read `~/.claude/skills/humanizer/SKILL.md` sections A–C for the *structural* tells and apply
   their Korean equivalents:
   - "단순히 X가 아니라 Y" / "X를 넘어 Y" → just say Y.
   - one-line dramatic closers and 교훈형 마무리 ("결국 중요한 건 ○○입니다") → cut, end on a fact,
     number, or the otter's reaction.
   - forced triads (3개 나열 습관), staged run-ups ("여러분, 이게 무슨 뜻일까요?" every scene),
     arguing with no one, inflated words (혁신적인, 게임 체인저, 놀라운, 완벽한).
   - repeated sentence openings across scenes (그런데/사실/자, ...).
2. Run the Korean scanner on the plain narration text (the tag-free `public/audio/<id>.txt`, or
   a temp .txt of all scene narration):
   `py ~/.claude/skills/stop-slop-ko/scripts/slop_scan.py <narration.txt> --prose --info`
   Fix every WARN; judge each INFO.
3. Do **not** apply stop-slop-ko's document rules (개조식 종결, 보고서 레지스터). Keep the
   spoken ending the script uses (~요 / ~거든요 / ~죠) consistent; don't flatten it.
4. Keep every fact, number, name and the joke beats. Only phrasing changes. Show the user the
   before/after of lines you changed when they are more than a word or two.

## 2. Screen design pass — scenes built in Remotion, HyperFrames or OM

The channel brand (`assets/brand.json`: graphite stage, orange accent, red marker doodles,
post-its, otter) always wins. On top of it, enforce these Hallmark floor rules
(`~/.claude/skills/hallmark/SKILL.md`, "The Floor") that apply to video frames:

- Every colour and font from the brand tokens; no literal one-off colours. (Floor 1)
- No purple-to-blue gradients, no card inside a card, no emoji used as icons, no fake
  browser/OS window chrome drawn by hand. (Floor 11) Real screen recordings are fine.
- No invented metrics, testimonials or logo walls on screen. (Floor 8)
- No tracked-capitals "eyebrow" labels above titles; no middle-dot-joined meta strings
  (`AI · 2026 · 실험`); no decorative status dots. (Floor 9, 10)
- About one idea per frame; on-screen text short enough to read in the time it is shown
  (Korean: ≈ 6–7 syllables per second of screen time at most).
- Never animate width/height/top/left in HyperFrames HTML; use transforms. (Floor 2)

For HyperFrames scenes (HTML), also run
`node ~/.claude/skills/hallmark/scripts/sloplint.mjs <scene.html>` and fix FAILs; REFLEX
findings that conflict with the brand (e.g. the marker-doodle look) may be waived — say why.
Hallmark's web-page rules (hero above the fold, nav, container width, focus styles) do not apply
to video. Ignore these sloplint IDs for video scenes: `20` (Hallmark stamp), `34` (overflow-x),
`44*`, `26a`/`15` (focus), `27`/`62` (reduced motion / no-script), `F23` (lang/title/meta).
Fix the rest (e.g. `10a`, `30a`, `63`, `2a`, `4`, `47a`, `54`, `67`).
