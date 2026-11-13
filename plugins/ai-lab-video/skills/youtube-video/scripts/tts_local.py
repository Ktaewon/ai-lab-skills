#!/usr/bin/env python3
"""Local Korean narration with MeloTTS (MIT), offline after scripts/setup_local_tts.sh.

Usage:
  py tts_local.py --scene-dir <project>/public/audio [--preset lively|max|flat] [--speed 1.08] [--only id1,id2]
  py tts_local.py --text "안녕하세요" --output hello.mp3

Runs inside the MeloTTS venv (~/.cache/youtube-video/melo, or MELO_VENV). Each <id>.txt becomes
<id>.mp3, levelled to -16 LUFS like the other engines. The model loads once per run.
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

# Expressiveness presets (sdp_ratio, noise_scale, noise_scale_w, speed). The stock MeloTTS settings
# ("flat") sounded monotone to the user; "lively" is the channel default, "max" for high-energy lines.
PRESETS = {"flat": (0.2, 0.6, 0.8, 1.0), "lively": (0.6, 0.85, 1.0, 1.08), "max": (0.9, 1.0, 1.2, 1.12)}

VENV = Path(os.environ.get("MELO_VENV", Path.home() / ".cache/youtube-video/melo"))
MELO_PY = next((p for p in (VENV / "bin" / "python", VENV / "Scripts" / "python.exe") if p.is_file()), VENV / "bin" / "python")

WORKER = r'''
import json, sys, types
# MeloTTS imports its Japanese module (mecab-python3 "MeCab") even for Korean. On macOS that package
# collides with Korean's python-mecab-ko ("mecab": same folder on a case-insensitive disk), so the
# setup keeps only the Korean one and Japanese gets a harmless stand-in here.
try:
    import MeCab  # noqa: F401
except Exception:
    stub = types.ModuleType("MeCab")
    class _Tagger:
        def __init__(self, *a, **k): pass
        def parse(self, *a, **k): raise RuntimeError("Japanese is disabled in this MeloTTS install")
    stub.Tagger = _Tagger
    sys.modules["MeCab"] = stub
from melo.api import TTS
jobs = json.loads(sys.argv[1]); speed = float(sys.argv[2]); sdp, ns, nw = json.loads(sys.argv[3])
m = TTS(language="KR", device="cpu"); spk = m.hps.data.spk2id["KR"]
for text, wav in jobs:
    m.tts_to_file(text, spk, wav, sdp_ratio=sdp, noise_scale=ns, noise_scale_w=nw, speed=speed, quiet=True)
    print("done", wav, flush=True)
'''


def to_mp3(wav: Path, mp3: Path) -> float:
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(wav), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                    "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "192k", str(mp3)], check=True)
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(mp3)],
                       capture_output=True, text=True)
    return float(r.stdout.strip() or 0)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--scene-dir", type=Path)
    ap.add_argument("--only")
    ap.add_argument("--text")
    ap.add_argument("--output", type=Path)
    ap.add_argument("--preset", choices=list(PRESETS), default="lively")
    ap.add_argument("--speed", type=float, help="override the preset's speed")
    a = ap.parse_args()
    if not MELO_PY.is_file():
        sys.exit("Local voice not set up. Ask the user to run once:\n  bash ~/.claude/skills/youtube-video/scripts/setup_local_tts.sh")

    if a.scene_dir:
        txts = sorted(a.scene_dir.glob("*.txt"))
        if a.only:
            keep = set(a.only.split(","))
            txts = [t for t in txts if t.stem in keep]
        pairs = [(t.read_text(encoding="utf-8").strip(), t.with_suffix(".mp3")) for t in txts]
    elif a.text and a.output:
        pairs = [(a.text, a.output)]
    else:
        ap.error("use --scene-dir, or --text with --output")

    with tempfile.TemporaryDirectory() as tmp:
        jobs = [(text, str(Path(tmp) / f"{i}.wav")) for i, (text, _) in enumerate(pairs)]
        env = dict(os.environ, HF_HUB_OFFLINE=os.environ.get("HF_HUB_OFFLINE", "1"))
        sdp, ns, nw, speed = PRESETS[a.preset]
        speed = a.speed or speed
        r = subprocess.run([str(MELO_PY), "-c", WORKER, json.dumps(jobs, ensure_ascii=False), str(speed), json.dumps([sdp, ns, nw])], env=env)
        if r.returncode:
            sys.exit("MeloTTS failed (if this is the first run, re-run setup_local_tts.sh to fetch the model)")
        results = []
        for (_, wav), (_, mp3) in zip(jobs, pairs):
            secs = to_mp3(Path(wav), mp3)
            results.append({"file": str(mp3), "seconds": round(secs, 2)})
            print(f"{mp3.name}: {secs:.2f}s", file=sys.stderr)
    print(json.dumps(results, ensure_ascii=False))


if __name__ == "__main__":
    main()
