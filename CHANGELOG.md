# Changelog

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
