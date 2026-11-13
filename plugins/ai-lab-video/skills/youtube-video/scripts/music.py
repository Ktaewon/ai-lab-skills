#!/usr/bin/env python3
"""Background music for an episode -> <project>/public/audio/music.mp3

Usage:
  python3 music.py <project> --prompt "calm lo-fi tech, soft synth pads, no vocals" [--provider lyria|elevenlabs] [--seconds N]

Providers:
  lyria       OpenMontage's GoogleMusic tool (Google Lyria, uses the Gemini key in OpenMontage's .env).
              Up to 184 s per track; the video loops it, so longer episodes still work.
  elevenlabs  The video toolkit's music.py (ElevenLabs, uses its ELEVENLABS_API_KEY). 10-300 s.
Default: lyria when OpenMontage is installed, else elevenlabs.

--seconds defaults to the long video's length (+2 s) from src/timeline.json, capped per provider.
Then set "music": "audio/music.mp3" in episode.json and re-run prepare.py. Keep musicVolume
around 0.06-0.10 under narration.
"""
import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
def _venv_py(root):
    for p in (root / ".venv" / "bin" / "python", root / ".venv" / "Scripts" / "python.exe"):
        if p.is_file():
            return p
    return root / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


OM_ROOT = Path(os.environ.get("OPENMONTAGE_DIR", Path(os.environ.get("VIDEO_TOOLS", Path.home() / "video-tools")) / "OpenMontage"))
OM_PY = _venv_py(OM_ROOT)
TOOLKIT = Path(os.environ.get("VIDEO_TOOLKIT", Path(os.environ.get("VIDEO_TOOLS", Path.home() / "video-tools")) / "claude-code-video-toolkit"))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project", type=Path)
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--provider", choices=["auto", "lyria", "elevenlabs"], default="auto")
    ap.add_argument("--seconds", type=float)
    a = ap.parse_args()

    project = a.project.resolve()
    out = project / "public" / "audio" / "music.mp3"
    out.parent.mkdir(parents=True, exist_ok=True)
    seconds = a.seconds
    if not seconds:
        tl = json.loads((project / "src" / "timeline.json").read_text(encoding="utf-8"))
        seconds = tl["totalFrames"] / tl["fps"] + 2
    provider = a.provider if a.provider != "auto" else ("lyria" if OM_PY.is_file() else "elevenlabs")
    prompt = a.prompt if "instrumental" in a.prompt.lower() or "no vocals" in a.prompt.lower() else a.prompt + ", instrumental, no vocals"

    if provider == "lyria":
        seconds = max(5, min(seconds, 184))
        inputs = {"prompt": prompt, "duration_seconds": seconds, "output_path": str(out)}
        r = subprocess.run([str(OM_PY), str(HERE / "om_tool.py"), "tools.audio.google_music:GoogleMusic",
                            json.dumps(inputs, ensure_ascii=False)], capture_output=True, text=True)
        try:
            res = json.loads(r.stdout.strip().splitlines()[-1])
        except (IndexError, json.JSONDecodeError):
            sys.exit("OpenMontage GoogleMusic failed:\n" + (r.stderr or r.stdout)[-800:])
        if not res["success"]:
            sys.exit(f"Lyria error: {res['error']}")
    else:
        seconds = max(10, min(seconds, 300))
        r = subprocess.run(["uv", "run", "tools/music.py", "--prompt", prompt, "--duration", str(int(seconds)),
                            "--output", str(out)], cwd=TOOLKIT)
        if r.returncode:
            sys.exit("toolkit music.py failed (network or ELEVENLABS_API_KEY?)")

    if not out.is_file():
        sys.exit("No music file was written.")
    dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(out)],
                         capture_output=True, text=True).stdout.strip()
    print(json.dumps({"provider": provider, "file": str(out), "seconds": float(dur or 0)}))


if __name__ == "__main__":
    main()
