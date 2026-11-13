#!/usr/bin/env bash
# One-time setup for the local Korean voice (MeloTTS, MIT licence). Needs network once; afterwards
# narration runs offline on this computer's CPU. Run in your own terminal:
#   bash ~/.claude/skills/youtube-video/scripts/setup_local_tts.sh
set -euo pipefail
VENV="${MELO_VENV:-$HOME/.cache/youtube-video/melo}"

PY=""
for c in "${MELO_PYTHON:-}" /opt/homebrew/bin/python3.11 /opt/homebrew/bin/python3.10 /opt/homebrew/bin/python3.12 \
         "$(command -v python3.11 2>/dev/null)" "$(command -v python3.10 2>/dev/null)"; do
  [ -n "$c" ] && [ -x "$c" ] && { PY="$c"; break; }
done
# Windows: the py launcher (py -3.11)
if [ -z "$PY" ] && command -v py >/dev/null 2>&1 && py -3.11 -c 1 >/dev/null 2>&1; then PY="py -3.11"; fi
[ -n "$PY" ] || { echo "Need Python 3.10-3.11 (macOS: brew install python@3.11, Windows: python.org 3.11, Ubuntu: apt install python3.11-venv)"; exit 1; }
echo "python: $PY"

mkdir -p "$(dirname "$VENV")"
[ -x "$VENV/bin/python" ] || [ -x "$VENV/Scripts/python.exe" ] || $PY -m venv "$VENV"
VPY="$VENV/bin/python"; [ -x "$VPY" ] || VPY="$VENV/Scripts/python.exe"
"$VENV/bin/python" -m pip install -q --upgrade pip
"$VENV/bin/python" -m pip install -q "git+https://github.com/myshell-ai/MeloTTS.git"
# Korean needs python-mecab-ko ("mecab"). MeloTTS also pulls mecab-python3 ("MeCab") for Japanese;
# on case-insensitive disks (macOS, Windows) both land in one folder and break each other, so keep only the
# Korean one (tts_local.py stubs the Japanese import).
"$VENV/bin/python" -m pip uninstall -y -q mecab-python3 >/dev/null 2>&1 || true
SP="$("$VENV/bin/python" -c 'import sysconfig; print(sysconfig.get_paths()["purelib"])')"
rm -rf "$SP/MeCab" "$SP/mecab"
"$VENV/bin/python" -m pip install -q --force-reinstall --no-deps python-mecab-ko
"$VENV/bin/python" -m pip install -q python-mecab-ko-dic

# Download the Korean model and make one test clip (also proves the install works).
"$VENV/bin/python" - <<'EOF'
import os, sys, tempfile, types
try:
    import MeCab  # noqa: F401
except Exception:
    stub = types.ModuleType("MeCab")
    class _T:
        def __init__(self, *a, **k): pass
    stub.Tagger = _T
    sys.modules["MeCab"] = stub
from melo.api import TTS
m = TTS(language="KR", device="cpu")
m.tts_to_file("안녕하세요, 로컬 음성 테스트입니다.", m.hps.data.spk2id["KR"], os.path.join(tempfile.gettempdir(), "melo_test.wav"), speed=1.0)
print("OK:", os.path.join(tempfile.gettempdir(), "melo_test.wav"))
EOF
echo "Local voice ready. Listen to the melo_test.wav printed above."
