#!/usr/bin/env python3
"""Measure every mascot sprite so speech bubbles can sit beside the character, not on it.

Usage:  py mascot_meta.py [SKILL_DIR/assets/mascot]     (re-run after adding or re-cutting sprites)
Writes  assets/mascot/meta.json: { "otter/<pose>": {"aspect": w/h, "bands": [[left, right], ...]}, ... }
bands: BANDS horizontal slices from top to bottom; left/right = first/last opaque column as a
fraction of the width (null for an empty slice). scaffold.sh copies it to src/mascot-meta.json.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

BANDS = 24
root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / "assets" / "mascot"
meta = {}
for png in sorted(list(root.glob("otter/*.png")) + list(root.glob("friends/*.png"))):
    a = np.asarray(Image.open(png).convert("RGBA"))[..., 3] > 24
    h, w = a.shape
    bands = []
    for i in range(BANDS):
        rows = a[round(i * h / BANDS):round((i + 1) * h / BANDS)]
        cols = np.where(rows.any(0))[0]
        bands.append([round(cols[0] / w, 3), round((cols[-1] + 1) / w, 3)] if len(cols) else None)
    meta[f"{png.parent.name}/{png.stem}"] = {"aspect": round(w / h, 4), "bands": bands}
(root / "meta.json").write_text(json.dumps(meta, separators=(",", ":")) + "\n", encoding="utf-8")
print(f"{len(meta)} sprites -> {root / 'meta.json'}")
