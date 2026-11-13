#!/usr/bin/env bash
# Download the channel fonts (all SIL OFL 1.1) into the skill, once.
# Run in your own terminal (needs network):  bash ~/.claude/skills/youtube-video/scripts/get_fonts.sh
set -euo pipefail
DEST="$(cd "$(dirname "$0")/.." && pwd)/assets/fonts"
mkdir -p "$DEST"
cd "$DEST"

get() { # url, file
  if [ -s "$2" ]; then echo "have $2"; return; fi
  curl -fsSL --retry 2 -o "$2.part" "$1" && mv "$2.part" "$2" && echo "got  $2 ($(du -h "$2" | cut -f1))"
}

# Display (titles, numbers, thumbnails)
get https://raw.githubusercontent.com/google/fonts/main/ofl/blackhansans/BlackHanSans-Regular.ttf BlackHanSans-Regular.ttf
# Handwriting (doodles, speech bubbles)
get https://raw.githubusercontent.com/google/fonts/main/ofl/nanumpenscript/NanumPenScript-Regular.ttf NanumPenScript-Regular.ttf
# Body and captions
# Pretendard: official release zip (static OTFs); search the zip instead of assuming its layout
if [ ! -s Pretendard-Bold.otf ]; then
  tmp="$(mktemp -d)"
  curl -fsSL --retry 2 -o "$tmp/p.zip" https://github.com/orioncactus/pretendard/releases/download/v1.3.9/Pretendard-1.3.9.zip
  unzip -q -o "$tmp/p.zip" -d "$tmp"
  for w in Regular Medium SemiBold Bold ExtraBold Black; do
    f="$(find "$tmp" -name "Pretendard-$w.otf" | head -1)"
    [ -n "$f" ] && cp "$f" "Pretendard-$w.otf" && echo "got  Pretendard-$w.otf"
  done
  rm -rf "$tmp"
fi
# Code
if [ ! -s D2Coding-Regular.ttf ]; then
  tmp="$(mktemp -d)"
  curl -fsSL --retry 2 -o "$tmp/d2.zip" https://github.com/naver/d2codingfont/releases/download/VER1.3.2/D2Coding-Ver1.3.2-20180524.zip
  unzip -q -o "$tmp/d2.zip" -d "$tmp"
  cp "$(find "$tmp" -name 'D2Coding-Ver1.3.2-20180524.ttf' | head -1)" D2Coding-Regular.ttf
  cp "$(find "$tmp" -name 'D2CodingBold-Ver1.3.2-20180524.ttf' | head -1)" D2Coding-Bold.ttf 2>/dev/null || true
  rm -rf "$tmp"; echo "got  D2Coding"
fi
echo; ls -la "$DEST"
