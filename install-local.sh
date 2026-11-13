#!/usr/bin/env bash
# 플러그인 없이 쓰는 방법: 이 저장소(또는 zip)의 스킬을 ~/.claude/skills/youtube-video 로 덮어쓴다.
# 기존 폴더는 youtube-video.bak-<날짜> 로 백업한다. 플러그인으로 설치했다면 이 스크립트는 쓰지 말 것(스킬이 두 개가 됨).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/plugins/ai-lab-video/skills/youtube-video"
DEST="$HOME/.claude/skills/youtube-video"
[ -f "$SRC/SKILL.md" ] || { echo "skill not found in $SRC"; exit 1; }
if [ -d "$DEST" ]; then
  BAK="$DEST.bak-$(date +%Y%m%d-%H%M%S)"
  mv "$DEST" "$BAK" && echo "backup: $BAK"
fi
mkdir -p "$DEST" && cp -r "$SRC/." "$DEST/"
echo "installed → $DEST  (restart Claude Code or start a new session)"
