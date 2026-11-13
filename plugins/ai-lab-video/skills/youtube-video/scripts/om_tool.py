#!/usr/bin/env python3
"""Run one OpenMontage tool and print its result as JSON.

Run it with OpenMontage's own interpreter so its dependencies (google-genai, ...) and .env load:

  $VIDEO_TOOLS/OpenMontage/.venv/bin/python (Windows: .venv/Scripts/python.exe) om_tool.py \
      tools.audio.gemini_tts:GeminiTTS '{"text": "안녕하세요", "output_path": "/abs/out.wav"}'

The second argument may also be @path/to/inputs.json. Output paths should be absolute: the tool
runs with OpenMontage as the working directory (that is where its .env is read from).
stdout: {"success", "data", "artifacts", "error", "cost_usd"}; exit 1 when success is false.
"""
import importlib
import json
import os
import sys
from pathlib import Path

OM_ROOT = Path(os.environ.get("OPENMONTAGE_DIR", Path(os.environ.get("VIDEO_TOOLS", Path.home() / "video-tools")) / "OpenMontage"))


def main():
    if len(sys.argv) != 3 or ":" not in sys.argv[1]:
        sys.exit(__doc__)
    module_name, class_name = sys.argv[1].split(":", 1)
    raw = sys.argv[2]
    inputs = json.loads(Path(raw[1:]).read_text(encoding="utf-8") if raw.startswith("@") else raw)

    os.chdir(OM_ROOT)
    sys.path.insert(0, str(OM_ROOT))
    tool = getattr(importlib.import_module(module_name), class_name)()
    result = tool.execute(inputs)
    out = {
        "success": bool(result.success),
        "data": result.data,
        "artifacts": result.artifacts,
        "error": result.error,
        "cost_usd": result.cost_usd,
    }
    print(json.dumps(out, ensure_ascii=False, default=str))
    sys.exit(0 if result.success else 1)


if __name__ == "__main__":
    main()
