# Changelog

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
