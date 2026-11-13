#!/usr/bin/env python3
"""Generate narration with Gemini TTS, one MP3 per scene script.

Every <name>.txt in the folder becomes <name>.mp3 beside it (intro.txt -> intro.mp3), levelled
to -16 LUFS so scenes sound even (render.sh lifts the final mix to YouTube's -14).

Usage:
  python3 tts_gemini.py --scene-dir <project>/public/audio [--voice Kore] [--style "..."] [--only id1,id2]
  python3 tts_gemini.py --text "안녕하세요" --output hello.mp3

Engines:
  openmontage (default when OpenMontage is installed): OpenMontage's GeminiTTS tool, which tracks
      Google's current SDK and model (gemini-3.8-flash-tts at the time of writing) and reads the
      key from OpenMontage's .env.
  rest: direct REST call, standard library only. Fallback if OpenMontage is missing; its model
      name may be outdated (override with --model / GEMINI_TTS_MODEL).
The key is never printed.
"""
import argparse
import base64
import json
import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
def _venv_py(root):
    for p in (root / ".venv" / "bin" / "python", root / ".venv" / "Scripts" / "python.exe"):
        if p.is_file():
            return p
    return root / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


OM_ROOT = Path(os.environ.get("OPENMONTAGE_DIR", Path(os.environ.get("VIDEO_TOOLS", Path.home() / "video-tools")) / "OpenMontage"))
OM_PY = _venv_py(OM_ROOT)
REST_MODEL = os.environ.get("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts")
ENV_FILES = [
    (Path(os.environ.get("VIDEO_TOOLKIT", Path(os.environ.get("VIDEO_TOOLS", Path.home() / "video-tools")) / "claude-code-video-toolkit")) / ".env"),
    OM_ROOT / ".env",
]
KEY_NAMES = ("GEMINI_API_KEY", "GOOGLE_API_KEY")


def to_mp3(src: Path, out_mp3: Path, raw_pcm_rate: str | None = None) -> float:
    pre = ["-f", "s16le", "-ar", raw_pcm_rate, "-ac", "1"] if raw_pcm_rate else []
    subprocess.run(["ffmpeg", "-y", "-v", "error", *pre, "-i", str(src),
                    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "44100",
                    "-c:a", "libmp3lame", "-b:a", "192k", str(out_mp3)], check=True)
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=nw=1:nk=1", str(out_mp3)], capture_output=True, text=True)
    return float(r.stdout.strip() or 0)


# ---- engine: OpenMontage ----------------------------------------------------------------------
def synth_openmontage(text, out_mp3, voice, style, model):
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "tts.wav"
        inputs = {"text": text, "voice_id": voice, "output_path": str(wav)}
        if style:
            inputs["style"] = style
        if model:
            inputs["model_id"] = model
        r = subprocess.run([str(OM_PY), str(HERE / "om_tool.py"), "tools.audio.gemini_tts:GeminiTTS",
                            json.dumps(inputs, ensure_ascii=False)], capture_output=True, text=True)
        try:
            res = json.loads(r.stdout.strip().splitlines()[-1])
        except (IndexError, json.JSONDecodeError):
            sys.exit("OpenMontage GeminiTTS failed:\n" + (r.stderr or r.stdout)[-800:])
        if not res["success"] or not wav.is_file():
            sys.exit(f"OpenMontage GeminiTTS error: {res.get('error')}")
        return to_mp3(wav, out_mp3)


# ---- engine: REST -----------------------------------------------------------------------------
def read_env_file(path: Path) -> dict:
    out = {}
    if not path.is_file():
        return out
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip().removeprefix("export ").strip()] = v.strip().strip('"').strip("'")
    return out


def find_key() -> str:
    for name in KEY_NAMES:
        if os.environ.get(name):
            return os.environ[name]
    for f in ENV_FILES:
        env = read_env_file(f)
        for name in KEY_NAMES:
            if env.get(name):
                return env[name]
    sys.exit("No Gemini key: set GEMINI_API_KEY in the environment or a .env file "
             "(" + ", ".join(str(p) for p in ENV_FILES) + ").")


def synth_rest(text, out_mp3, voice, style, model):
    key = find_key()
    model = model or REST_MODEL
    body = {
        "contents": [{"parts": [{"text": f"{style}\n\n{text}" if style else text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}},
        },
    }
    req = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        hint = f"\nModel '{model}' not found; pass --model with a current TTS model." if e.code == 404 else ""
        sys.exit(f"Gemini API error {e.code}: {e.read().decode(errors='replace')[:500]}{hint}")
    try:
        part = data["candidates"][0]["content"]["parts"][0]["inlineData"]
    except (KeyError, IndexError):
        sys.exit("Unexpected Gemini response (no audio): " + json.dumps(data)[:500])
    rate = "24000"
    for bit in part.get("mimeType", "").split(";"):
        if bit.strip().startswith("rate="):
            rate = bit.strip().split("=", 1)[1]
    with tempfile.NamedTemporaryFile(suffix=".pcm", delete=False) as tmp:
        tmp.write(base64.b64decode(part["data"]))
    try:
        return to_mp3(Path(tmp.name), out_mp3, raw_pcm_rate=rate)
    finally:
        os.unlink(tmp.name)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--scene-dir", type=Path, help="folder of <scene>.txt files")
    ap.add_argument("--only", help="comma-separated scene ids to (re)generate; default all")
    ap.add_argument("--text", help="single text (with --output)")
    ap.add_argument("--output", type=Path)
    ap.add_argument("--voice", default="Kore", help="prebuilt voice name (default Kore)")
    ap.add_argument("--model", help="model id (engine default if omitted)")
    ap.add_argument("--style", default="", help='delivery note, e.g. "밝고 또렷한 유튜버 톤으로"')
    ap.add_argument("--engine", choices=["auto", "openmontage", "rest"], default="auto")
    a = ap.parse_args()

    engine = a.engine
    if engine == "auto":
        engine = "openmontage" if OM_PY.is_file() else "rest"
    synth = synth_openmontage if engine == "openmontage" else synth_rest
    print(f"engine: {engine}", file=sys.stderr)

    if a.scene_dir:
        txts = sorted(a.scene_dir.glob("*.txt"))
        if a.only:
            wanted = set(a.only.split(","))
            txts = [t for t in txts if t.stem in wanted]
        if not txts:
            sys.exit(f"No matching .txt files in {a.scene_dir}")
        results = []
        for t in txts:
            mp3 = t.with_suffix(".mp3")
            secs = synth(t.read_text(encoding="utf-8").strip(), mp3, a.voice, a.style, a.model)
            results.append({"scene": t.stem, "file": str(mp3), "seconds": round(secs, 2)})
            print(f"{t.stem}: {secs:.2f}s -> {mp3}", file=sys.stderr)
        print(json.dumps(results, ensure_ascii=False))
    elif a.text and a.output:
        secs = synth(a.text, a.output, a.voice, a.style, a.model)
        print(json.dumps({"file": str(a.output), "seconds": round(secs, 2)}))
    else:
        ap.error("use --scene-dir, or --text with --output")


if __name__ == "__main__":
    main()
