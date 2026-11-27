# Changelog

## Codex 지원 — 2026-11-27

- 같은 저장소로 Codex에도 설치 가능: `.agents/plugins/marketplace.json`(Codex 마켓플레이스), `plugins/ai-lab-video/.codex-plugin/plugin.json`(Codex 플러그인 정보). 스킬 내용은 그대로, Claude Code 설치에는 영향 없음
- `codex plugin marketplace add Ktaewon/ai-lab-skills` → `codex plugin add ai-lab-video@ai-lab-skills`

## 1.4.0 — 2026-11-22 · 코드 애니메이션 스킬 (code-animation)

- 새 스킬 `code-animation`: 이미지·영상·오디오 생성 모델 없이 Canvas 코드와 numpy 합성만으로 손그림풍 2D 애니메이션 + 음악·효과음 제작
  - `assets/engine.js`: 필압 잉크선, 셀 채색(`E.part`), 과슈 하늘·3톤 구름·능선·물결 나뭇잎(`E.foliage`), 안개, 빛내림, 셀 불꽃, 그레이드·그레인, 키프레임/투스 타이밍, 캡처 하네스
  - 내용에 맞춰 고르는 스타일 프리셋 10종(`references/styles.md`): 애니 셀, 수묵, 페이퍼컷, 동화 수채, 플랫 모션, 채널 lab-stage, 그림자극, 픽셀, 칠판, 네온
  - `references/craft.md`(퀄리티 규칙), `quality-checklist.md`(스틸 검수 루프), `sound.md`(분위기별 조성·폴리 매핑)
  - 스크립트: `new_scene.sh` 스캐폴드, `bundle.py` 단일 HTML, `capture.cjs`(GPU 끔 — 켜면 오프스크린 캔버스가 검게 나옴), `render.sh`(프레임→사운드→먹스→2-pass loudnorm -14 LUFS), `sound_lib.py`(패드·플루트·카라플러스 현·종·북·바람·비·물·불·새·날갯짓·발소리·럼블·삐걱임·휘익·붐·라이저, `Mix`)
  - 예제 `examples/lab01/`(이끼 낀 로봇이 깨어나 이륙하는 20초 애니 셀)

## 1.3.0 — 2026-11-18 · 런칭·뉴스 쇼츠 (EP.08 GPT-6.2)

- 아이보리 모션 비트 `scenes/Motion2.tsx` 템플릿 편입: `stats` `vs` `poll` `headline` `hud` `chat` `rules` `donut`
  `calendar` `timeline` `typer` `meter` `ticker` `range` `textcard`, 새 `duel`(모델 vs 모델 막대, 비용 블록)과
  `stall`(긴 작업 진행 바가 중간에 멈춤). 모든 beat에 `meme`(캡처한 게시물 폴라로이드)·`fx` 오버레이
- 쇼츠 장면 옵션 `hardCut`(펀치인·플래시·전환 whoosh 없음), `noLeadIn`(첫 프레임부터 음성)
- 쇼츠별 `hookStyle` / `captionStyle`, `fixedBand`(어두운 띠 위 큰 고정 제목 + 장면 200px 아래로, 자막 y 1450)
- stats 항목 `count`(카운트업 프레임 수, 짧은 비트에서 숫자가 끝까지 보이게)
- `scripts/capture_posts.cjs`: X 공개 embed 캡처, 아바타·아이디 흐림, `--text-only` 본문만 자르기
- 문서: shorts-motion.md § 9 (런칭·뉴스 쇼츠), episode-format.md 아이보리 모션 비트·장면 스위치,
  SKILL.md 새 쇼츠 기본값(하드컷, 즉시 음성, 포스트잇 대신 모션그래픽), tts.py 키 경로(VIDEO_TOOLS) 안내

## 1.2.0 — 2026-11-15 · 순위 쇼츠 레이아웃 (EP.05–07)

- 새 beat 종류 `win`(EP.05 TOP9 카운트다운: 16:9 창 + 공식 영상, 9→1 사다리, 카운트업 카드),
  `desk`(증거 파일 책상 변형), `tower`(EP.07 "별 엘리베이터": 순위마다 화면 가득 색 층, 별 수 로그 높이로
  카메라가 올라가는 구성, drop / fog / gap / ask 모드, 댓글 버튼을 가리키는 마커 화살표 엔딩)
- 시네마틱 효과음 `assets/sfx/t_*.mp3` 10종 (ElevenLabs 생성), tower beat 자동 히트에 사용
- 쇼츠 상단 여백: 고정 제목 top 190, 자막 top 1330 (피드 썸네일에서 제목이 잘리지 않게)
- `ShortVideo`에 `clean` prop: 자막·진행바 없이 커버용 스틸 (`--props '{"shortId":"…","clean":true}'`)
- prepare.py: beat의 `<이름>Say` → `<이름>At` 일반화, 항목 `say` 키에 checks / bars / lines 추가
- tts.py: Gemini·로컬 엔진에도 `pronounce` 적용
- 문서: shorts-motion.md § 7 (카운트다운), 상단 여백·커버 규칙, § 8 (tower + 효과음), SKILL.md 순위 쇼츠 항목

## 1.1.0 — 2026-11-13 · 쇼츠 모션 비트 (EP.04 피클·뮤즈)

- 새 beat 종류: `memo`(아이보리 노트 + 포스트잇 + 붙인 스크린샷), `demo`(공식 데모 영상을 폰 프레임에),
  `icons`(앱 아이콘이 이름 말할 때마다 쾅), `approve`(결제 승인 탭), `connect`(계정 연결 + 정보 미터 + 보안 배지)
- 모든 beat에 `blobs`(투명 캐릭터 + 말풍선), `credit`(출처 한 줄), `sfx`(추가 효과음), photo에 `.mp4`·`pos`
- 빨간 마커 `strokes`(arrow / ellipse / line): 매끈하게, 끝까지 그려짐 (pathLength=1)
- 효과음 라이브러리 `assets/sfx/` (char_pop 포함), scaffold가 `public/sfx/`로 복사, 컷·포스트잇·아이콘·캐릭터에 자동 히트
- 템플릿 `Doodle.tsx`: 큰 원이 덜 그려지던 문제 수정, 흔들림 7→3
- 스크립트: `site_media.cjs`(사이트 데모 영상·캐릭터·스크린샷 수집), `app_icons.cjs`(앱스토어 공식 아이콘),
  `stock.cjs`(Pixabay b-roll + 크레딧)
- 문서: `references/shorts-motion.md`(어떤 대사에 어떤 모션을 쓰는지 연출 플레이북), episode-format beats 필드,
  SKILL.md 쇼츠 항목
