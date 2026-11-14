# 다른 Claude에게 붙여 넣을 요청문

아래를 그대로 복사해서 업데이트할 PC의 Claude Code에 보낸다. `<경로>` 만 zip을 푼 위치로 바꾼다.

---

`<경로>/ai-lab-skills` 에 youtube-video 스킬 v1.2.0 이 있어. 이걸로 내 youtube-video 스킬을 업데이트해줘.

1. `<경로>/ai-lab-skills/CHANGELOG.md` 와 `README.md` 를 읽고 무엇이 바뀌는지 나한테 짧게 알려줘.
2. 내 `~/.claude/skills/youtube-video` 가 있으면 `diff -rq` 로 지금 버전과 비교해서, 내가 이 PC에서만 따로 고친 파일이
   있는지 확인해줘 (있으면 덮어쓰기 전에 목록을 보여주고 물어봐).
3. 문제 없으면 `bash <경로>/ai-lab-skills/install-local.sh` 로 설치해 (기존 폴더는 자동 백업됨).
   플러그인으로 이미 설치돼 있으면 이 단계 대신 `/plugin marketplace update ai-lab-skills` 를 안내해줘.
4. 확인: `scripts/scaffold.sh` 로 임시 폴더에 프로젝트를 만들고 `public/sfx/char_pop.mp3`, `public/sfx/t_hit.mp3` 가 복사되는지,
   `npx tsc --noEmit` 이 통과하는지 본 다음 임시 폴더는 지워.
5. 이 PC에 API 키(.env)나 Playwright가 없어서 안 되는 기능이 있으면 알려줘. 키 값은 화면에 출력하지 마.

새 쇼츠 연출 규칙은 `references/shorts-motion.md` 에 있어. 앞으로 제품·서비스 쇼츠는 이 플레이북대로 만들어줘.
