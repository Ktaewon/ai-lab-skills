#!/usr/bin/env python3
"""Subtitle files (.srt) for the long video in another language, timed from the final timeline.

Step 1 — segments:   py export_srt.py <project> segments
    Writes <project>/record/srt_segments.json: one entry per spoken sentence (from the word-timed
    captions) or per paragraph for text scenes read with "follow": true, with start/end seconds
    and the Korean text "ko".
Step 2 — translate:  give that file to a translator (an agent is fine) and get back
    <project>/record/srt_<lang>.json = [{"ko": "<same Korean>", "text": "<translation>"}, ...]
    Keyed by the Korean text, so translations survive re-timing and are reused across re-renders;
    only new or changed sentences need translating (step 3 lists any that are missing).
Step 3 — build:      py export_srt.py <project> build <lang>
    Writes <project>/output_<lang>.srt (≤ 2 lines of 42 chars per cue; long lines split into
    several cues timed by length). Re-run after any change that moves the timeline.
"""
import json
import re
import sys
import textwrap
from pathlib import Path

FPS = 30


def segments(project: Path):
    t = json.loads((project / "src/timeline.json").read_text(encoding="utf-8"))
    ep = {s["id"]: s for s in json.loads((project / "episode.json").read_text(encoding="utf-8"))["scenes"]}
    out = []
    for s in t["scenes"]:
        base = s["from"]
        src = ep.get(s["id"], {})
        if src.get("follow") and s["props"].get("paraStarts"):
            paras = [p.strip() for p in re.split(r"\n\s*\n", src.get("text", "")) if p.strip()]
            st = s["props"]["paraStarts"] + [s["frames"] - FPS]
            for k, p in enumerate(paras):
                out.append({"start": (base + st[k]) / FPS, "end": (base + st[k + 1]) / FPS - 0.05, "ko": p.replace("\n", " ")})
            continue
        cur = None
        for c in s["captions"]["long"]:
            if cur is None:
                cur = {"start": (base + c["from"]) / FPS, "ko": c["text"]}
            else:
                cur["ko"] += " " + c["text"]
            cur["end"] = (base + c["to"]) / FPS
            if re.search(r"[.!?…]$", c["text"]):
                out.append(cur); cur = None
        if cur:
            out.append(cur)
    return out


def ts(v: float) -> str:
    ms = int(round(v * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); s, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{s:02},{ms:03}"


def pieces(text: str, width=42):
    if len(textwrap.wrap(text, width)) <= 2:
        return [text]
    w = text.split(); best = None
    for i in range(1, len(w)):
        score = abs(len(" ".join(w[:i])) - len(text) / 2) - (12 if re.search(r"[.,;!?—]$", w[i - 1]) else 0)
        if best is None or score < best[0]:
            best = (score, i)
    i = best[1]
    return pieces(" ".join(w[:i]), width) + pieces(" ".join(w[i:]), width)


def main():
    if len(sys.argv) < 3 or sys.argv[2] not in ("segments", "build"):
        sys.exit(__doc__)
    project = Path(sys.argv[1]).resolve()
    segs = segments(project)
    if sys.argv[2] == "segments":
        path = project / "record" / "srt_segments.json"
        path.parent.mkdir(exist_ok=True)
        path.write_text(json.dumps([{"id": i, **s} for i, s in enumerate(segs)], ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"{len(segs)} segments → {path}")
        return
    lang = sys.argv[3] if len(sys.argv) > 3 else "en"
    tr = json.loads((project / "record" / f"srt_{lang}.json").read_text(encoding="utf-8"))
    known = {x["ko"]: x["text"] for x in tr}
    missing = [s["ko"] for s in segs if s["ko"] not in known]
    if missing:
        sys.exit(f"{len(missing)} sentences have no translation yet (add them to record/srt_{lang}.json):\n" + "\n".join(missing))
    cues = []
    for s in segs:
        parts = pieces(known[s["ko"]].strip()); a, b = s["start"], s["end"]; tot = sum(len(p) for p in parts) or 1; x = a
        for p in parts:
            d = (b - a) * len(p) / tot
            cues.append((x, x + d - 0.02, "\n".join(textwrap.wrap(p, 42)))); x += d
    out = project / f"output_{lang}.srt"
    out.write_text("\n".join(f"{i}\n{ts(a)} --> {ts(max(b, a + 0.6))}\n{tx}\n" for i, (a, b, tx) in enumerate(cues, 1)), encoding="utf-8")
    cps = max(len(tx) / max(0.6, b - a) for a, b, tx in cues)
    print(f"{len(cues)} cues → {out} (last {ts(cues[-1][1])}, max {cps:.1f} chars/s)")


if __name__ == "__main__":
    main()
