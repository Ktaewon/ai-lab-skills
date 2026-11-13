#!/usr/bin/env python3
"""Word-level caption timing for every narration clip: <id>.mp3 + <id>.txt -> <id>.captions.json.

prepare.py uses these files (when newer than the MP3) instead of spreading captions by text length.
Captions always show the script's words; recognition only supplies the timing.

Usage:
  python3 align_words.py <project>/public/audio [--engine auto|openmontage|scribe] [--only id1,id2]

Engines:
  openmontage  OpenMontage's transcriber (faster-whisper, runs locally, language ko). Needs
               faster-whisper in OpenMontage's venv once:
               $VIDEO_TOOLS/OpenMontage/.venv/bin/python (Windows: .venv/Scripts/python.exe) -m pip install faster-whisper
               (the first run also downloads the whisper model).
  scribe       The video toolkit's captions.py with ElevenLabs Scribe (cloud, uses its
               ELEVENLABS_API_KEY). It aligns to the .txt itself.
  auto         openmontage if faster-whisper is installed, else scribe.

Drift fix (on by default; --no-fix to skip): recognisers sometimes drift by seconds on a sentence
(Scribe did, on spelled-out numbers). After alignment, ffmpeg silencedetect measures where speech
really is; the script's phrases are matched to those speech chunks, and any phrase whose words fall
outside its chunk is re-spread inside it by syllable count. `--fix-only` re-checks existing
captions.json files without calling any engine (free).
"""
import argparse
import json
import os
import re
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


def has_faster_whisper() -> bool:
    if not OM_PY.is_file():
        return False
    return subprocess.run([str(OM_PY), "-c", "import faster_whisper"], capture_output=True).returncode == 0


def norm(s: str) -> str:
    return re.sub(r"[\s\W_]+", "", s)


def align_to_script(script: str, heard: list[dict]) -> list[dict]:
    """Give each script word a time by its relative character position, mapped through the
    recognised words' timings. Robust to recognition mistakes because only positions are used."""
    points = [(0.0, heard[0]["start"])]
    total = sum(len(norm(w["word"])) for w in heard) or 1
    pos = 0
    for w in heard:
        n = len(norm(w["word"]))
        points.append((pos / total, w["start"]))
        pos += n
        points.append((pos / total, w["end"]))

    def at(frac: float) -> float:
        for (f0, t0), (f1, t1) in zip(points, points[1:]):
            if f0 <= frac <= f1:
                return t0 if f1 == f0 else t0 + (t1 - t0) * (frac - f0) / (f1 - f0)
        return points[-1][1]

    words = script.split()
    stotal = sum(len(norm(w)) for w in words) or 1
    out, spos = [], 0
    for w in words:
        n = len(norm(w))
        start, end = at(spos / stotal), at((spos + n) / stotal)
        spos += n
        out.append({"text": w, "startMs": round(start * 1000), "endMs": round(max(end, start + 0.05) * 1000),
                    "timestampMs": round(start * 1000), "confidence": None})
    return out


def run_openmontage(mp3: Path, txt: Path, out: Path):
    inputs = {"input_path": str(mp3), "language": "ko", "model_size": "small", "output_dir": str(mp3.parent / ".transcripts")}
    env = dict(os.environ)
    # Once the model is cached, don't ask the Hugging Face hub for updates on every run: it is
    # slow, and it hangs where the network is blocked.
    if (Path.home() / ".cache/huggingface/hub/models--Systran--faster-whisper-small/snapshots").is_dir():
        env["HF_HUB_OFFLINE"] = "1"
    r = subprocess.run([str(OM_PY), str(HERE / "om_tool.py"), "tools.analysis.transcriber:Transcriber",
                        json.dumps(inputs)], capture_output=True, text=True, env=env)
    try:
        res = json.loads(r.stdout.strip().splitlines()[-1])
    except (IndexError, json.JSONDecodeError):
        sys.exit("OpenMontage transcriber failed:\n" + (r.stderr or r.stdout)[-800:])
    if not res["success"]:
        sys.exit(f"OpenMontage transcriber error: {res['error']}")
    heard = res["data"].get("word_timestamps") or []
    if not heard:
        sys.exit(f"{mp3.name}: no words recognised")
    out.write_text(json.dumps(align_to_script(txt.read_text(encoding="utf-8"), heard), ensure_ascii=False, indent=1), encoding="utf-8")


# ---------- drift fix: snap phrases to the speech chunks ffmpeg hears ----------
def speech_chunks(mp3: Path, noise="-38dB", min_sil=0.12):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(mp3), "-af", f"silencedetect=noise={noise}:d={min_sil}", "-f", "null", "-"],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    log = r.stderr
    dur = re.search(r"Duration: (\d+):(\d+):([\d.]+)", log)
    total = int(dur[1]) * 3600 + int(dur[2]) * 60 + float(dur[3]) if dur else None
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", log)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", log)]
    chunks, t = [], 0.0
    for a, b in zip(starts, ends + [None] * (len(starts) - len(ends))):
        if a - t > 0.08:
            chunks.append([t, a])
        t = b if b is not None else (total or a)
    if total and total - t > 0.08:
        chunks.append([t, total])
    return chunks


def syl(w: str) -> int:
    return max(1, len(re.sub(r"[^\w]", "", w)))


MERGE_P, MERGE_C = 0.3, 0.05  # penalties: punctuation without a pause; a pause inside a phrase

def fix_drift(words: list[dict], mp3: Path, tol=0.35):
    """Returns (words, n_fixed). Phrases end at . ? ! , ~ or …; chunks come from silencedetect."""
    chunks = speech_chunks(mp3)
    if len(words) < 2 or len(chunks) < 2:
        return words, 0
    # phrases = runs of words ending in punctuation
    phrases, cur = [], []
    for i, w in enumerate(words):
        cur.append(i)
        if re.search(r"[.?!,~…]$", w["text"].strip()):
            phrases.append(cur); cur = []
    if cur:
        phrases.append(cur)
    # Monotone many-to-many match: consecutive phrases ↔ consecutive chunks (a phrase may hold an
    # unpunctuated pause; a pause may be missing at a comma). Cost: how far each group's length is
    # from what the clip's average syllable rate predicts.
    P, N = len(phrases), len(chunks)
    ps = [sum(syl(words[i]["text"]) for i in ph) for ph in phrases]
    rate = sum(ps) / sum(b - a for a, b in chunks)
    INF = float("inf")
    cost = [[INF] * (N + 1) for _ in range(P + 1)]
    back = {}
    cost[0][0] = 0.0
    for i in range(P):
        for j in range(N):
            if cost[i][j] == INF:
                continue
            for i2 in range(i + 1, min(P, i + 4) + 1):
                sy = sum(ps[i:i2])
                for j2 in range(j + 1, min(N, j + 6) + 1):
                    T = sum(b - a for a, b in chunks[j:j2])
                    v = cost[i][j] + ((sy / rate - T) / max(T, 0.5)) ** 2 + MERGE_P * (i2 - i - 1) + MERGE_C * (j2 - j - 1)
                    if v < cost[i2][j2]:
                        cost[i2][j2], back[(i2, j2)] = v, (i, j)
    if cost[P][N] == INF:
        return words, 0
    groups, key = [], (P, N)
    while key != (0, 0):
        i, j = back[key]
        groups.append(((i, key[0]), (chunks[j][0], chunks[key[1] - 1][1]), chunks[j:key[1]]))
        key = (i, j)
    groups.reverse()
    fixed = 0
    for (i, j), (a, b), parts in groups:
        idx = [k for ph in phrases[i:j] for k in ph]
        s0, s1 = words[idx[0]]["startMs"] / 1000, words[idx[-1]]["endMs"] / 1000
        if abs(s0 - a) <= tol and abs(s1 - b) <= tol:
            continue  # recogniser timing agrees with the audio; keep its finer word timing
        weights = [syl(words[k]["text"]) for k in idx]
        tw, acc = sum(weights), 0
        speech = sum(y - x for x, y in parts)
        def place(frac):  # fraction of the group's speech time -> clock time, skipping pauses
            t = frac * speech
            for x, y in parts:
                if t <= y - x:
                    return x + t
                t -= y - x
            return parts[-1][1]
        for k, wt in zip(idx, weights):
            st = place(acc / tw)
            acc += wt
            en = place(acc / tw)
            words[k].update(startMs=round(st * 1000), endMs=round(en * 1000), timestampMs=round(st * 1000))
        fixed += 1
    return words, fixed


def fix_file(mp3: Path):
    cap = mp3.with_name(mp3.stem + ".captions.json")
    if not cap.is_file():
        return
    data = json.loads(cap.read_text(encoding="utf-8"))
    words = data if isinstance(data, list) else data.get("captions") or data.get("words")
    if not words:
        return
    mtime = cap.stat().st_mtime
    words, n = fix_drift(words, mp3)
    if n:
        if isinstance(data, list):
            data = words
        else:
            data["captions" if "captions" in data else "words"] = words
        cap.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"{mp3.stem}: drift fixed in {n} phrase group(s)", file=sys.stderr)
    else:
        os.utime(cap, (mtime, mtime))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("audio_dir", type=Path)
    ap.add_argument("--engine", choices=["auto", "openmontage", "scribe"], default="auto")
    ap.add_argument("--only", help="comma-separated scene ids")
    ap.add_argument("--no-fix", action="store_true", help="skip the silence-based drift fix")
    ap.add_argument("--fix-only", action="store_true", help="only re-check existing captions.json (no engine, free)")
    a = ap.parse_args()

    pairs = [(m, m.with_suffix(".txt")) for m in sorted(a.audio_dir.glob("*.mp3")) if m.with_suffix(".txt").is_file()]
    if a.only:
        wanted = set(a.only.split(","))
        pairs = [p for p in pairs if p[0].stem in wanted]
    if not pairs:
        sys.exit(f"No <id>.mp3 with a matching <id>.txt in {a.audio_dir}")

    if a.fix_only:
        for mp3, _ in pairs:
            fix_file(mp3)
        return

    engine = a.engine
    if engine == "auto":
        engine = "openmontage" if has_faster_whisper() else "scribe"
    print(f"engine: {engine}", file=sys.stderr)

    if engine == "openmontage":
        if not has_faster_whisper():
            sys.exit(f"faster-whisper is not installed in OpenMontage's venv. Install once:\n  {OM_ROOT}/.venv/bin/python -m pip install faster-whisper")
        for mp3, txt in pairs:
            out = mp3.with_name(mp3.stem + ".captions.json")
            run_openmontage(mp3, txt, out)
            print(f"{mp3.stem}: {out.name}", file=sys.stderr)
    else:
        # captions.py aligns to the sibling .txt and writes <name>.captions.json itself.
        files = [str(m.resolve()) for m, _ in pairs]
        r = subprocess.run(["uv", "run", "tools/captions.py", *files, "--engine", "scribe", "--language", "ko"],
                           cwd=TOOLKIT)
        if r.returncode:
            sys.exit("toolkit captions.py failed (network or ELEVENLABS_API_KEY?)")
    if not a.no_fix:
        for mp3, _ in pairs:
            fix_file(mp3)
    print(json.dumps({"engine": engine, "scenes": [m.stem for m, _ in pairs]}))


if __name__ == "__main__":
    main()
