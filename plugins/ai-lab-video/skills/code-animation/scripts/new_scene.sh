#!/usr/bin/env bash
# Scaffold a code-animation scene folder.
# Usage: bash SKILL_DIR/scripts/new_scene.sh <dir> "<title>" [W H]
#   → <dir>/index.html, engine.js (copy), scene.js (template), sound.py (template), stills/, frames/ (git-ignored by you)
set -euo pipefail
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIR="${1:?scene dir}"; TITLE="${2:-Untitled}"; W="${3:-1920}"; H="${4:-1080}"
mkdir -p "$DIR"
cp "$SKILL_DIR/assets/engine.js" "$DIR/engine.js"
[ -f "$DIR/scene.js" ] || sed -e "s/__TITLE__/$TITLE/g" -e "s/W: 1920, H: 1080/W: $W, H: $H/" "$SKILL_DIR/assets/template/scene.js" > "$DIR/scene.js"
[ -f "$DIR/index.html" ] || sed "s/__TITLE__/$TITLE/g" "$SKILL_DIR/assets/template/index.html" > "$DIR/index.html"
[ -f "$DIR/sound.py" ] || sed "s#__SKILL_DIR__#$SKILL_DIR#g" "$SKILL_DIR/assets/template/sound.py" > "$DIR/sound.py"
echo "scene ready: $DIR  (open $DIR/index.html, edit scene.js, then scripts/render.sh $DIR)"
