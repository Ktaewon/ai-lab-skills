#!/usr/bin/env bash
# 이 PC의 ~/.claude/skills/youtube-video 를 플러그인 폴더로 복사한다 (스킬을 고친 뒤 GitHub에 올리기 전에 실행).
# 그 다음: plugin.json / marketplace.json 의 version 올리기 → CHANGELOG.md 적기 → git commit → git push
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="${1:-$HOME/.claude/skills/youtube-video}"
DEST="$HERE/plugins/ai-lab-video/skills/youtube-video"
[ -f "$SRC/SKILL.md" ] || { echo "SKILL.md not found in $SRC"; exit 1; }
rm -rf "$DEST" && mkdir -p "$DEST"
cp -r "$SRC/." "$DEST/"
find "$DEST" -name "__pycache__" -type d -prune -exec rm -rf {} +
find "$DEST" -name ".env*" -delete
echo "synced $SRC → $DEST"
