#!/usr/bin/env bash
# Render compositions of a youtube-video project.
# Usage: render.sh <project_dir> [all|Long|Short-<id>|Thumbnail] [extra remotion flags, e.g. --scale=0.5]
#   all (default): out/long.mp4, out/short-<id>.mp4 for every short, out/thumbnail.png
# Uses Playwright's already-downloaded headless Chrome when present, so Remotion does not
# need to download its own browser (useful when the network or proxy blocks downloads).
set -euo pipefail
PROJECT="$(cd "${1:?Usage: render.sh <project_dir> [all|Long|Short-<id>|Thumbnail]}" && pwd)"
TARGET="${2:-all}"
EXTRA=("${@:3}")
cd "$PROJECT"
mkdir -p out

BROWSER=()
SHELL_BIN="$(ls -d "$HOME"/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell "$HOME"/.cache/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell "${LOCALAPPDATA:-/nonexistent}"/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell.exe 2>/dev/null | sort -V | tail -1 || true)"
if [ -n "$SHELL_BIN" ] && [ -x "$SHELL_BIN" ]; then
  BROWSER=(--browser-executable="$SHELL_BIN")
fi

TOOLKIT="${VIDEO_TOOLKIT:-${VIDEO_TOOLS:-$HOME/video-tools}/claude-code-video-toolkit}"

# Bring a render to YouTube loudness (-14 LUFS, -1 dBTP) and report picture problems (black gaps,
# frozen stretches). Uses the video toolkit's qc.py when present, plain ffmpeg loudnorm otherwise.
# The untouched render is kept as <name>.raw.mp4.
finish_video() { # output
  local out="$1" raw="${1%.mp4}.raw.mp4" norm="${1%.mp4}.loudnorm.mp4"
  local has_audio
  has_audio="$(ffprobe -v error -select_streams a -show_entries stream=codec_name -of csv=p=0 "$out" | head -1)"
  if [ -f "$TOOLKIT/tools/qc.py" ]; then
    if [ -n "$has_audio" ]; then
      (cd "$TOOLKIT" && uv run --offline tools/qc.py --render "$PROJECT/$out" --fix 2>&1 | sed -n '/^render:/,$p') || true
    else
      (cd "$TOOLKIT" && uv run --offline tools/qc.py --render "$PROJECT/$out" --allow-silent 2>&1 | sed -n '/^render:/,$p') || true
    fi
  elif [ -n "$has_audio" ]; then
    ffmpeg -y -v error -i "$out" -c:v copy -af loudnorm=I=-14:TP=-1:LRA=11 -c:a aac -b:a 192k "$norm"
  fi
  if [ -f "$norm" ]; then
    mv "$out" "$raw" && mv "$norm" "$out"
    echo "loudness: normalised to -14 LUFS (original kept as $raw)"
  fi
}

render_video() { # composition, output
  npx remotion render "$1" "$2" --gl=angle ${BROWSER[@]+"${BROWSER[@]}"} ${EXTRA[@]+"${EXTRA[@]}"} 2>&1 | grep -vE '^(Rendered|Encoded) [0-9]+/' || true
  [ -f "$2" ] || { echo "Render failed: $1" >&2; exit 1; }
  echo "$2: $(ffprobe -v error -show_entries format=duration:stream=width,height -of compact "$2" | tr '\n' ' ')"
  [ "${SKIP_QC:-0}" = 1 ] || finish_video "$2"
}
render_thumb() {
  npx remotion still Thumbnail out/thumbnail.png --gl=angle ${BROWSER[@]+"${BROWSER[@]}"} 2>&1 | tail -1
}

case "$TARGET" in
  all)
    render_video Long out/long.mp4
    for id in $(node -e "console.log(require('./src/timeline.json').shorts.map(s=>s.id).join(' '))"); do
      render_video "Short-$id" "out/short-$id.mp4"
    done
    render_thumb
    ;;
  Thumbnail) render_thumb ;;
  Long) render_video Long out/long.mp4 ;;
  Short-*) render_video "$TARGET" "out/short-${TARGET#Short-}.mp4" ;;
  *) echo "Unknown target: $TARGET" >&2; exit 2 ;;
esac
