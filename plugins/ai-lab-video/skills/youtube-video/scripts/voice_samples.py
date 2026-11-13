#!/usr/bin/env python3
"""Short ElevenLabs samples of the same line in several voices/settings, so the user can pick by ear
before paying for a whole episode (~100 characters per candidate).

Usage:
  py voice_samples.py <out_dir> --text "한 문단" \\
     --voice matilda=XrExE9yKIg1WjnnlVkGX:eleven_v4:0.55 \\
     --voice sarah_v2=EXAVITQu4vr4xnSDxMaL:eleven_multilingual_v2:0.35:0.5
  Each --voice is  name=voiceId[:model[:stability[:style]]]   → <out_dir>/<n>_<name>.mp3

Premade voices that read Korean reasonably (eleven_multilingual_v2 / v3 / v4):
  female  Sarah EXAVITQu4vr4xnSDxMaL (soft) · Matilda XrExE9yKIg1WjnnlVkGX (warm, friendly; picked for
          the EP.01 toasts) · Lily pFZP5JQG7iQjIQuC4Bku (velvety) · Charlotte XB0fDUnXU5powFXDhCwa (calm)
          · Jessica cgSgspJ2msm6clMCkdW9 (bright)
  Emotion: eleven_v4 is the most expressive (takes stability + similarity only); on v2, lower
  stability (0.3–0.4) and raise style (0.4–0.6). A Korean native voice from the user's Voice
  Library usually beats all of these — ask for its voice ID.
"""
import argparse
import os
import subprocess
import sys
from pathlib import Path

TOOLKIT = Path(os.environ.get("VIDEO_TOOLKIT", Path(os.environ.get("VIDEO_TOOLS", Path.home() / "video-tools")) / "claude-code-video-toolkit"))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("out_dir", type=Path)
    ap.add_argument("--text", required=True)
    ap.add_argument("--voice", action="append", required=True, help="name=voiceId[:model[:stability[:style]]]")
    a = ap.parse_args()
    a.out_dir.mkdir(parents=True, exist_ok=True)
    print(f"{len(a.voice)} samples × {len(a.text)} characters")
    for n, spec in enumerate(a.voice, 1):
        name, _, rest = spec.partition("=")
        vid, model, stab, style = (rest.split(":") + [None] * 4)[:4]
        out = a.out_dir / f"{n}_{name}.mp3"
        cmd = ["uv", "run", "tools/voiceover.py", "--voice-id", vid, "--output", str(out.resolve())]
        if model:
            cmd += ["--model", model]
        if stab:
            cmd += ["--stability", stab]
        if style:
            cmd += ["--style", style]
        r = subprocess.run(cmd, cwd=TOOLKIT, input=a.text, text=True)
        if r.returncode:
            sys.exit(r.returncode)
    print(f"samples in {a.out_dir}")


if __name__ == "__main__":
    main()
