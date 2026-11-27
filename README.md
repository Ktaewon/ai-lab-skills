# ai-lab-skills

AI 실험실 채널의 Claude Code · Codex 스킬 저장소 (두 도구의 플러그인 마켓플레이스 형식).
지금 들어 있는 것: `ai-lab-video` 플러그인 → `youtube-video`, `code-animation` 스킬 (v1.4.0. 변경 내역은 CHANGELOG.md).

## 다른 PC의 Claude에 설치하기

### A. GitHub 플러그인으로 (추천, 업데이트가 쉬움)
이 폴더를 GitHub 저장소(비공개 가능)로 올린 뒤, 다른 PC의 Claude Code에서:
```
/plugin marketplace add Ktaewon/ai-lab-skills
/plugin install ai-lab-video@ai-lab-skills
```
업데이트가 나오면 `/plugin marketplace update ai-lab-skills` 후 플러그인 업데이트(또는 재설치).
비공개 저장소는 그 PC에 `gh auth login` 또는 git 자격 증명이 있어야 받아진다.
플러그인 스킬은 `/ai-lab-video:youtube-video` 로 불린다. 그 PC에 예전 `~/.claude/skills/youtube-video` 가
있으면 스킬이 두 개가 되니, 플러그인으로 갈 거면 예전 폴더는 지우거나 이름을 바꿔 둔다.

### B. 폴더 복사로 (플러그인 없이)
zip을 풀고:
```
bash install-local.sh
```
기존 `~/.claude/skills/youtube-video` 는 `.bak-<날짜>` 로 백업되고 새 버전으로 바뀐다.

### C. 다른 Claude에게 시키기
zip(또는 이 폴더)을 그 PC에 두고 Claude에게 `UPDATE_PROMPT.md` 내용을 붙여 넣는다.

### D. Codex에 설치하기
같은 저장소가 Codex 마켓플레이스도 겸한다 (`.agents/plugins/marketplace.json`, `plugins/ai-lab-video/.codex-plugin/plugin.json`).
```
codex plugin marketplace add Ktaewon/ai-lab-skills
codex plugin add ai-lab-video@ai-lab-skills
```
또는 Codex 안에서 `/plugins` → AI 실험실 Skills → Install. 업데이트는 `codex plugin marketplace upgrade ai-lab-skills`.
스킬 이름은 `ai-lab-video:youtube-video`, `ai-lab-video:code-animation`. 명령이 없다고 나오면 Codex를 최신으로 올린다
(PATH의 오래된 `codex` 0.118에는 `plugin` 명령이 없다. Codex 앱에 들어 있는 CLI는 된다).
SKILL.md 의 `AskUserQuestion`·`SendUserFile` 같은 Claude Code 도구 이름은 Codex에서는 해당 도구가 없으면 건너뛴다.

## 설치 후 그 PC에 필요한 것 (스킬과 별개)
- Node 18+, ffmpeg, Python (스킬의 `scripts/py` 가 찾음)
- API 키는 저장소에 없다. 그 PC의 `.env` 에 직접 넣는다: ElevenLabs/Gemini (toolkit `.env`), `PIXABAY_API_KEY` (OpenMontage `.env` 또는 환경변수)
- 사이트 수집 스크립트용 Playwright: 프로젝트에서 `npm i playwright && npx playwright install chromium`
- 폰트·마스코트는 `assets/` 에 포함 (폰트는 모두 OFL)

## 이 PC에서 스킬을 고친 뒤 배포하기
```
bash sync-from-local.sh           # ~/.claude/skills/youtube-video → plugins/ai-lab-video/skills/
# version 올리기: plugins/ai-lab-video/.claude-plugin/plugin.json, .codex-plugin/plugin.json, .claude-plugin/marketplace.json
# 그리고 CHANGELOG.md 적기
git add -A && git commit -m "youtube-video 1.x.x" && git push
```
