#!/usr/bin/env python3
"""Cut paragraphs out of a long read (a toast, a letter, a quote) for a Short — same voice, no TTS.

For every shortScene with "clipFrom": {"scene": "<long scene id>", "paragraphs": [2, 5]}:
  paragraphs are 0-based, split on blank lines of the source scene's "text"; they are cut from
  public/audio/<scene>.mp3 by their real word timings (needs <scene>.captions.json from
  align_words.py), joined with 0.5 s of silence, and written as public/audio/<shortScene id>.mp3
  + .captions.json (re-based word timings). The excerpt text becomes that shortScene's narration.
Pick the same kind of paragraphs from every source when the Short compares them (fairness).

Usage:  py clip_paragraphs.py <project>      then  prepare.py <project>
"""
import json
import re
import subprocess
import sys
from pathlib import Path


def norm(t: str) -> str:
    return re.sub(r"[^\w]", "", t)


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    P = Path(sys.argv[1]).resolve()
    A = P / "public/audio"
    ep = json.loads((P / "episode.json").read_text(encoding="utf-8"))
    scenes = {s["id"]: s for s in ep["scenes"]}
    for dst in [s for s in ep.get("shortScenes", []) if s.get("clipFrom")]:
        src = dst["clipFrom"]["scene"]
        paras = [p.strip() for p in re.split(r"\n\s*\n", re.sub(r"\[[^\[\]\n]{1,40}\]", "", scenes[src].get("text") or scenes[src]["narration"])) if p.strip()]
        words = json.loads((A / f"{src}.captions.json").read_text(encoding="utf-8"))
        flat, starts = "", []
        for w in words:
            starts.append(len(flat)); flat += norm(w["text"])
        clips, out_words, texts, t0 = [], [], [], 0.0
        for k in dst["clipFrom"]["paragraphs"]:
            a = flat.find(norm(paras[k])[:15]); b = a + len(norm(paras[k]))
            idx = [i for i, s in enumerate(starts) if a <= s < b]
            if a < 0 or not idx:
                sys.exit(f"{dst['id']}: paragraph {k} of {src} not found in its word timings")
            s_ms, e_ms = words[idx[0]]["startMs"], words[idx[-1]]["endMs"] + 120
            clips.append((s_ms / 1000, e_ms / 1000))
            for i in idx:
                w = dict(words[i])
                w["startMs"] = round(w["startMs"] - s_ms + t0 * 1000); w["endMs"] = round(w["endMs"] - s_ms + t0 * 1000)
                out_words.append(w)
            t0 += (e_ms - s_ms) / 1000 + 0.5
            texts.append(paras[k].replace("\n", " "))
        args, labels = [], []
        for n, (s, e) in enumerate(clips):
            args += ["-ss", f"{s:.3f}", "-to", f"{e:.3f}", "-i", str(A / f"{src}.mp3")]
        fc = "".join(f"[{n}:a]aresample=44100,aformat=channel_layouts=mono[a{n}];" for n in range(len(clips)))
        for n in range(len(clips)):
            labels.append(f"[a{n}]")
            if n < len(clips) - 1:
                fc += f"anullsrc=r=44100:cl=mono,atrim=duration=0.5[s{n}];"
                labels.append(f"[s{n}]")
        fc += "".join(labels) + f"concat=n={len(labels)}:v=0:a=1[o]"
        subprocess.run(["ffmpeg", "-v", "error", "-y", *args, "-filter_complex", fc, "-map", "[o]",
                        "-c:a", "libmp3lame", "-b:a", "192k", str(A / f"{dst['id']}.mp3")], check=True)
        (A / f"{dst['id']}.captions.json").write_text(json.dumps(out_words, ensure_ascii=False, indent=1), encoding="utf-8")
        dst["narration"] = " ".join(texts)
        print(f"{dst['id']} ← {src} paragraphs {dst['clipFrom']['paragraphs']}: {t0 - 0.5:.1f}s")
    (P / "episode.json").write_text(json.dumps(ep, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
