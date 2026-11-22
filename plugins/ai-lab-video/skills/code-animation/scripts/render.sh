#!/usr/bin/env bash
# Bundle → capture every frame → synthesize sound.py → mux → loudness -14 LUFS (TP ≤ -1 dB).
# Usage: bash SKILL_DIR/scripts/render.sh <scene_dir> [fps=24] [--no-sound]
# Output: <scene_dir>/<name>.html (standalone) and <scene_dir>/<name>.mp4
set -euo pipefail
SKILL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$(cd "${1:?scene dir}" && pwd)"; FPS="${2:-24}"; NAME="$(basename "$DIR")"
PY="$(command -v python3)"
"$PY" "$SKILL_DIR/scripts/bundle.py" "$DIR" "$DIR/$NAME.html" >/dev/null
rm -rf "$DIR/frames"; node "$SKILL_DIR/scripts/capture.cjs" "$DIR/$NAME.html" "$DIR/frames" video "$FPS"
VID=(-framerate "$FPS" -i "$DIR/frames/f%04d.jpg")
if [[ "${3:-}" != "--no-sound" && -f "$DIR/sound.py" ]]; then
  (cd "$DIR" && "$PY" sound.py "$DIR/sound.wav")
  # two-pass loudnorm → -14 LUFS integrated, true peak -2 dBTP (lands ≤ -1 after AAC)
  M=$(ffmpeg -hide_banner -i "$DIR/sound.wav" -af loudnorm=I=-14:TP=-2:LRA=11:print_format=json -f null - 2>&1 | "$PY" -c "import sys,json,re;d=json.loads(re.search(r'\{[^{}]*\}',sys.stdin.read()).group());print(':'.join(f'{k}={d[v]}' for k,v in [('measured_I','input_i'),('measured_TP','input_tp'),('measured_LRA','input_lra'),('measured_thresh','input_thresh'),('offset','target_offset')]))")
  ffmpeg -y -loglevel error "${VID[@]}" -i "$DIR/sound.wav" -c:v libx264 -pix_fmt yuv420p -crf 17 -preset slow \
    -af "loudnorm=I=-14:TP=-2:LRA=11:${M}:linear=true,aresample=48000" -c:a aac -b:a 192k -ar 48000 -shortest -movflags +faststart "$DIR/$NAME.mp4"
else
  ffmpeg -y -loglevel error "${VID[@]}" -c:v libx264 -pix_fmt yuv420p -crf 17 -preset slow -movflags +faststart "$DIR/$NAME.mp4"
fi
ffmpeg -hide_banner -i "$DIR/$NAME.mp4" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|Peak):" || true
rm -rf "$DIR/frames"
echo "done: $DIR/$NAME.mp4"
