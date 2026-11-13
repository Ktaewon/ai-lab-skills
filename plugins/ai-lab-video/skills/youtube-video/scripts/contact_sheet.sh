#!/usr/bin/env bash
# Tile 9 evenly spaced frames of a video into one PNG, to check every scene at a glance.
# Usage: contact_sheet.sh <video.mp4> <out.png>
set -euo pipefail
IN="${1:?Usage: contact_sheet.sh <video.mp4> <out.png>}"
OUT="${2:?Usage: contact_sheet.sh <video.mp4> <out.png>}"
FRAMES=$(ffprobe -v error -count_packets -select_streams v:0 -show_entries stream=nb_read_packets -of default=nw=1:nk=1 "$IN" | head -1 | tr -dc '0-9')
STEP=$(( FRAMES / 10 ))
SEL=""
for i in 1 2 3 4 5 6 7 8 9; do SEL+="eq(n\\,$(( STEP * i )))+"; done
ffmpeg -y -v error -i "$IN" -vf "select='${SEL%+}',scale=640:-1,tile=3x3" -frames:v 1 "$OUT"
echo "$OUT (frames every $STEP of $FRAMES)"
