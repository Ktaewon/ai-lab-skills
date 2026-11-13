#!/usr/bin/env bash
# Create a new YouTube episode project from the skill's template (channel brand, fonts, mascot included).
# Usage: scaffold.sh <project_dir>
# If an existing install with every needed package is found, node_modules is linked to it
# (no download). Otherwise the script prints the install command to run.
set -euo pipefail
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:?Usage: scaffold.sh <project_dir>}"

if [ -e "$DEST/package.json" ]; then
  echo "Refusing to overwrite: $DEST already has a package.json" >&2
  exit 1
fi
mkdir -p "$DEST"
cp -R "$SKILL_DIR/assets/template/." "$DEST/"
mkdir -p "$DEST/public/audio" "$DEST/public/rec" "$DEST/public/images" "$DEST/record" "$DEST/out"
# Channel identity: one brand file, the fonts, and the mascot sprites.
cp "$SKILL_DIR/assets/brand.json" "$DEST/src/brand.json"
mkdir -p "$DEST/public/fonts" "$DEST/public/mascot"
mkdir -p "$DEST/public/sfx" && cp "$SKILL_DIR/assets/sfx/"*.mp3 "$DEST/public/sfx/"  # beat SFX library (auto hits in beats scenes)
cp -R "$SKILL_DIR/assets/mascot/otter" "$SKILL_DIR/assets/mascot/friends" "$DEST/public/mascot/"
cp "$SKILL_DIR/assets/mascot/meta.json" "$DEST/src/mascot-meta.json"  # sprite outlines for bubble placement
if ls "$SKILL_DIR/assets/fonts/"* >/dev/null 2>&1; then
  cp "$SKILL_DIR/assets/fonts/"* "$DEST/public/fonts/"
else
  echo "WARNING: channel fonts missing. Ask the user to run: bash $SKILL_DIR/scripts/get_fonts.sh" >&2
fi

NEEDED=(remotion @remotion/cli @remotion/three @remotion/transitions three @react-three/fiber react react-dom typescript)
has_all() {
  local nm="$1"
  for p in "${NEEDED[@]}"; do [ -f "$nm/$p/package.json" ] || return 1; done
}

# Reusable installs, newest first. Add yours with AUTO_DEMO_NODE_MODULES=/path/to/node_modules.
CANDIDATES=(
  "${AUTO_DEMO_NODE_MODULES:-}"
)
LINKED=""
for nm in "${CANDIDATES[@]}"; do
  [ -n "$nm" ] && [ -d "$nm" ] && has_all "$nm" || continue
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) MSYS_NO_PATHCONV=1 cmd /c mklink /J "$(cygpath -w "$DEST/node_modules")" "$(cygpath -w "$nm")" >/dev/null ;;  # Windows junction, no admin
    *) ln -s "$nm" "$DEST/node_modules" ;;
  esac
  LINKED="$nm"
  break
done

echo "Project created: $DEST"
if [ -n "$LINKED" ]; then
  echo "node_modules -> $LINKED (shared install, nothing to download)"
else
  echo "No reusable install found. Install packages (needs network):"
  echo "  cd \"$DEST\" && npm install && npx playwright install chromium"
fi
