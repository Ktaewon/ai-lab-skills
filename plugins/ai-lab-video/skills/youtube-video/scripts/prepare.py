#!/usr/bin/env python3
"""Turn episode.json into everything Remotion needs.

Usage:  python3 prepare.py <project_dir>            # writes scripts, timeline, chapters
        python3 prepare.py <project_dir> --scripts-only

Reads   <project>/episode.json
        <project>/public/audio/<scene>.mp3          (narration, if generated)
        <project>/record/<scene>.clicks.json         (recording scenes, from record.cjs)
Writes  <project>/public/audio/<scene>.txt           (narration text for TTS)
        <project>/src/timeline.json                  (scene lengths, captions, shorts, thumbnail)
        <project>/out/chapters.txt                   (YouTube description chapters)

Also handles "shortScenes" (vertical-only scenes, e.g. fast-cut "beats" over an existing scene's
narration via "audioFrom"), on-screen "marks" and "keywords" timed to the spoken word, and
"paraStarts" for text scenes with "follow": true.

Scene length is anchored to the narration audio: audio length + padding, never shorter than the
scene's visual minimum (a recording's playback time, a typed terminal, ...). Before audio exists,
length is estimated from the text so the video can be previewed right away.
"""
import copy
import json
import re
import subprocess
import sys
from pathlib import Path

# ElevenLabs v3/v4 audio tags ("[장난스럽게]", "[나지막이 웃음]") direct the delivery. They are stage
# directions, not words: TTS gets them, captions / word alignment / beat timing never do.
TAG_RE = re.compile(r"\[[^\[\]\n]{1,40}\]")


def strip_tags(text: str) -> str:
    """Narration without audio tags, whitespace tidied (what is actually heard)."""
    return re.sub(r"[ \t]{2,}", " ", re.sub(r" *\n *", "\n", TAG_RE.sub("", text))).strip()


FPS = 30
KOREAN_CHARS_PER_SEC = 6.5  # estimate before TTS; replaced by the real audio length later
LEAD_IN = 0.8  # breathing room before the narration (viewers asked for 0.5–1 s between scenes)
PAD_OUT = 1.0  # hold after the narration before the next cut
MIN_SCENE = {"title": 3.5, "statement": 3.0, "recording": 2.0, "terminal": 3.0,
             "chart": 4.0, "media": 3.0, "outro": 4.0, "chat": 3.0,
             "tier": 6.0, "quiz": 7.0, "scoreboard": 7.0, "news": 6.0, "doc": 6.0, "race": 7.0,
             "flow": 6.0, "code": 6.0, "receipt": 7.0, "map": 7.0}
TIMED_TYPES = {"tier", "quiz", "scoreboard", "news", "doc", "race", "flow", "code", "receipt", "map"}
CAPTION_MAX = {"long": 28, "short": 13}  # characters per caption line
SHORT_MAX_SEC = 180  # YouTube Shorts limit; over 60 s is allowed but reaches fewer feeds


def audio_seconds(path: Path):
    if not path.is_file():
        return None
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "default=nw=1:nk=1", str(path)], capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return None


def spoken_len(text: str) -> int:
    return len(re.sub(r"\s+", "", text))



# Korean-aware caption breaks. Break only between 어절, prefer breaks after commas and
# connective endings (…고, …며, …는데, …지만, …면, …서, …니까, …요,), never leave a lone
# predicate or particle (e.g. "했습니다.") alone on a line, and keep lines balanced.
GOOD_END = re.compile(r"(,|고|며|는데|지만|면|면서|해서|어서|아서|니까|라서|도록|든|요|죠|다|지|인지|는지)$")
BOUND_NEXT = re.compile(r"^(위한|위해|위해서|대한|대해|통해|따라|관한|때문에|정도|수|것|거|중|때|같은지|같아|같습)")
def split_words(words, max_chars, key=lambda w: w):
    n = len(words)
    if n == 0:
        return []
    lens = [len(key(w)) for w in words]
    total = sum(lens) + n - 1
    if total <= max_chars:
        return [words]
    INF = float("inf")
    best = [INF] * (n + 1); back = [0] * (n + 1); best[0] = 0
    for j in range(1, n + 1):
        for i in range(j - 1, -1, -1):
            ln = sum(lens[i:j]) + (j - i - 1)
            if ln > max_chars + 5 and j - i > 1:
                break
            cost = (max_chars - ln) ** 2 if ln <= max_chars else 150 + (ln - max_chars) * 40
            if j - i == 1 or ln < 7:
                cost += 900   # a lone word / tiny tail line reads badly
            if j < n and isinstance(words[j - 1], dict) and words[j - 1].get("nobreak"):
                cost += 3000  # inside a highlighted keyword
            if j < n:
                last = re.sub(r"[\"'”’)]+$", "", key(words[j - 1]))
                ch = last[-1] if last else ""
                adnominal = "가" <= ch <= "힣" and (ord(ch) - 0xAC00) % 28 in (4, 8) and not re.search(r"(에서는|에는|에선|으로는|에게는|까지는|부터는|안에서는)$", last)  # ends in ㄴ/ㄹ: "쓴", "모르는", "할"
                nxt = re.sub(r"[\"'”’)]+$", "", key(words[j]))
                if (last.endswith(",") and len(last) <= 3) or len(nxt) <= 1 or len(last) <= 1 or BOUND_NEXT.match(nxt):
                    cost += 400  # inside a short list ("A, B, C") or before a one-syllable word
                if last.endswith(",") and len(last) >= 3:
                    cost -= 120
                elif adnominal and not GOOD_END.search(last):
                    cost += 70   # don't split a modifier from its noun
                elif GOOD_END.search(last):
                    cost -= 40
            if best[i] + cost < best[j]:
                best[j] = best[i] + cost; back[j] = i
    out, j = [], n
    while j > 0:
        i = back[j]; out.append(words[i:j]); j = i
    return out[::-1]

def chunk(text: str, max_chars: int):
    """Split narration into caption chunks: sentence first, then words up to max_chars."""
    out = []
    for sent in re.split(r"(?<=[.!?。…])\s+|\n+", text.strip()):
        sent = sent.strip()
        if not sent:
            continue
        for grp in split_words(sent.split(), max_chars):
            out.append(" ".join(grp))
    return out


def timed_captions(text: str, start: float, end: float, max_chars: int):
    """Spread chunks over [start, end] in proportion to their spoken length.
    Without word timestamps this is an approximation, but Korean TTS reads at a steady pace."""
    pieces = chunk(text, max_chars)
    total = sum(spoken_len(p) for p in pieces) or 1
    t = start
    caps = []
    for p in pieces:
        d = (end - start) * spoken_len(p) / total
        caps.append({"from": round(t * FPS), "to": round((t + d) * FPS), "text": p})
        t += d
    return caps


def word_captions(words, offset: float, max_chars: int, keywords=()):
    """Chunks from word timestamps ([{text, startMs, endMs}, ...]). Words are grouped into
    sentences, then each sentence is split at natural Korean break points (split_words)."""
    caps, sent = [], []
    sentences = []
    norm = lambda t: re.sub(r"[^\w]", "", t)
    flat, spans = "", []
    words = [dict(w) for w in words]
    for w in words:
        spans.append((len(flat), len(flat) + len(norm(w["text"]))))
        flat += norm(w["text"])
    for kw in keywords:
        k = flat.find(norm(kw))
        if k < 0:
            continue
        e = k + len(norm(kw))
        for idx, (a, b) in enumerate(spans):
            if a < e and b > k and b < e:   # word starts inside the keyword and the keyword continues after it
                words[idx]["nobreak"] = True
    for w in words:
        if not w["text"].strip():
            continue
        sent.append(w)
        if re.search(r"[.!?。…]$", w["text"].strip()):
            sentences.append(sent); sent = []
    if sent:
        sentences.append(sent)
    for sw in sentences:
        for grp in split_words(sw, max_chars, key=lambda w: w["text"].strip()):
            caps.append({"from": round((offset + grp[0]["startMs"] / 1000) * FPS),
                         "to": round((offset + grp[-1]["endMs"] / 1000) * FPS),
                         "text": " ".join(w["text"].strip() for w in grp)})
    # Hold each chunk until the next one starts, so captions don't blink off between words.
    for a, b in zip(caps, caps[1:]):
        if b["from"] - a["to"] < round(0.5 * FPS):
            a["to"] = b["from"]
    return caps


def win_past(beats: list) -> list:
    """Countdown shorts ("win" beats): a ladder beat without "past" gets the ranks revealed before
    it (rank + first logo), so the 9→1 ladder fills itself in; "total" defaults to the highest rank."""
    seen: dict = {}
    ranked = ("win", "desk")  # desk beats ("dock": true) collect revealed apps the same way
    top = max([b["r"] for b in beats if b.get("kind") in ranked and isinstance(b.get("r"), int)] or [0])
    for b in beats:
        if b.get("kind") not in ranked:
            continue
        shelf = b.get("ladder") or b.get("dock")
        if shelf and top:
            b.setdefault("total", top)
        if shelf and "past" not in b:
            b["past"] = [{"r": r, "icon": icon} for r, icon in seen.items() if r != b.get("r")]
        icon = (b.get("logo") or [None])[0] or b.get("icon")
        if b.get("r") and not b.get("mystery") and icon:
            seen.setdefault(b["r"], icon)
    return beats


def visual_min(scene: dict, rec: dict | None) -> float:
    kind = scene["type"]
    base = MIN_SCENE.get(kind, 3.0)
    if kind == "recording" and rec:
        return max(base, rec["duration"] / scene.get("playbackRate", 1) + 0.3)
    if kind == "terminal":
        typed = len(scene.get("command", "")) / 18 + 0.35 * len(scene.get("lines", []))
        return max(base, typed + 1.5)
    if kind == "chat":
        return max(base, 0.7 * len(scene.get("messages", [])) + 1.5)
    return base


def main():
    global LEAD_IN, PAD_OUT
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    project = Path(sys.argv[1]).resolve()
    scripts_only = "--scripts-only" in sys.argv
    ep = json.loads((project / "episode.json").read_text(encoding="utf-8"))
    # Shorts-only episodes split one read into several scenes; a tighter gap keeps the cuts snappy.
    LEAD_IN = float(ep.get("leadIn", LEAD_IN))
    PAD_OUT = float(ep.get("padOut", PAD_OUT))
    audio_dir = project / "public" / "audio"
    audio_dir.mkdir(parents=True, exist_ok=True)

    ids = [s["id"] for s in ep["scenes"] + ep.get("shortScenes", [])]
    if len(ids) != len(set(ids)):
        sys.exit("Scene ids must be unique.")

    # 1. Narration scripts for TTS. Only rewrite when the text changed, and drop the stale MP3
    #    so a changed line is never played with old audio.
    # Short-only scenes get a script only when they are voiced with TTS ("tts": true); others reuse
    # audio (audioFrom) or bring their own cut (e.g. excerpts), which must never be deleted here.
    for s in ep["scenes"] + [x for x in ep.get("shortScenes", []) if x.get("tts")]:
        txt = audio_dir / f"{s['id']}.txt"            # heard words; align_words.py matches against this
        tagged_txt = audio_dir / f"{s['id']}.tts.txt"  # with audio tags = what TTS was asked to say
        # "pronounce": {"TOP9": "탑 나인"} rewrites words for the voice only; captions keep the written form
        text = strip_tags(s.get("narration", "").strip())
        tagged = s.get("narration", "").strip()
        for k, v in (ep.get("pronounce") or {}).items():
            tagged = tagged.replace(k, v)
        if not text:
            continue
        old = (tagged_txt.read_text(encoding="utf-8").strip() if tagged_txt.is_file()
               else txt.read_text(encoding="utf-8").strip() if txt.is_file() else None)
        if old != tagged or not txt.is_file() or txt.read_text(encoding="utf-8").strip() != text:
            txt.write_text(text + "\n", encoding="utf-8")
            if tagged != text:
                tagged_txt.write_text(tagged + "\n", encoding="utf-8")
            elif tagged_txt.exists():
                tagged_txt.unlink()
        if old is not None and old != tagged:  # a changed tag changes the delivery too: re-voice it
            for stale in (audio_dir / f"{s['id']}.mp3", audio_dir / f"{s['id']}.captions.json"):
                if stale.exists():
                    stale.unlink()
                    print(f"narration changed, removed stale {stale.name}", file=sys.stderr)
    if scripts_only:
        print(f"wrote narration scripts to {audio_dir}")
        return

    # 2. Timeline
    scenes, warnings = [], []
    cursor = 0
    chapters = []
    pose_dir = project / "public" / "mascot" / "otter"
    known = {p.stem for p in pose_dir.glob("*.png")}
    def check_pose(where, pose):
        if known and pose and pose not in known:
            warnings.append(f"{where}: unknown otter pose '{pose}' (have: {', '.join(sorted(known))})")
    check_pose("thumbnail", (ep.get("thumbnail") or {}).get("pose"))
    src_by_id = {x["id"]: x for x in ep["scenes"]}
    short_scenes = []
    carry = {}  # (scene type, short-only) -> last chat messages / timed terminal lines
    for s in ep["scenes"] + [dict(x, shortOnly=True) for x in ep.get("shortScenes", [])]:
        sid, kind = s["id"], s["type"]
        m = (s.get("props") or {}).get("mascot") or s.get("mascot") or {}
        if m.get("character", "otter") == "otter":
            for bt in m.get("beats", []):
                check_pose(sid, bt.get("pose"))
        rec = None
        if kind == "recording":
            clicks_file = project / "record" / f"{sid}.clicks.json"
            if clicks_file.is_file():
                rec = json.loads(clicks_file.read_text(encoding="utf-8"))
                rec["video"] = f"rec/{sid}.mp4"
            else:
                warnings.append(f"{sid}: not recorded yet (run record.cjs); showing a placeholder")
        src_id = s.get("audioFrom", sid)
        text = strip_tags(src_by_id[src_id].get("narration", "") if "audioFrom" in s else s.get("narration", ""))
        audio = audio_dir / f"{src_id}.mp3"
        dur = audio_seconds(audio)
        estimated = dur is None and bool(text)
        if estimated:
            dur = spoken_len(text) / KOREAN_CHARS_PER_SEC
        speak = dur or 0.0
        if kind == "recording" and rec and "playbackRate" not in s:
            # Narration longer than the recording: slow the recording down (to 0.6x at most)
            # so the action spans the narration; any remainder holds the last frame.
            need = LEAD_IN + speak
            s = {**s, "playbackRate": round(max(0.6, min(1.0, rec["duration"] / need)), 3) if need > rec["duration"] else 1}
        seconds = max(LEAD_IN + speak + PAD_OUT, visual_min(s, rec), s.get("minSeconds", 0))
        frames = round(seconds * FPS)
        props = {k: v for k, v in s.items() if k not in ("id", "type", "narration", "steps", "minSeconds", "keywords", "marks", "beats", "audioFrom", "shortOnly", "continue")}
        words_file = audio_dir / f"{src_id}.captions.json"
        words = None
        if words_file.is_file() and audio.is_file() and words_file.stat().st_mtime >= audio.stat().st_mtime:
            data = json.loads(words_file.read_text(encoding="utf-8"))
            words = data if isinstance(data, list) else data.get("captions") or data.get("words")
        elif words_file.is_file():
            warnings.append(f"{sid}: {words_file.name} is older than the audio; re-run captions.py (using estimated timing)")
        if words:
            captions = {fmt: word_captions(words, LEAD_IN, n, s.get("keywords", []) if fmt == "long" else ()) for fmt, n in CAPTION_MAX.items()}
        else:
            captions = {fmt: timed_captions(text, LEAD_IN, LEAD_IN + speak, n) if text else [] for fmt, n in CAPTION_MAX.items()}
        # Timing from real word timings: keywords (caption line breaks never split them), on-screen
        # marks (highlighter), paragraph starts for "follow" text scenes, beats for short-only scenes.
        norm = lambda t: re.sub(r"[^\w]", "", t)
        if words:
            flat, starts = "", []
            for w in words:
                starts.append((len(flat), w))
                flat += norm(w["text"])
            def frame_at(char_pos):
                hit = [w for pos, w in starts if pos <= char_pos]
                w = hit[-1] if hit else words[0]
                return round((LEAD_IN + w["startMs"] / 1000) * FPS)
            hl = []
            for kw in s.get("keywords", []):
                pos = flat.find(norm(kw))
                if pos < 0:
                    warnings.append(f"{sid}: keyword '{kw}' not found in the spoken words")
                    continue
                hl.append({"text": kw, "from": frame_at(pos)})
            props["highlights"] = hl
            mk = []
            for m in s.get("marks", []):
                if "at" in m:
                    mk.append({"text": m["text"], "from": round((LEAD_IN + m["at"]) * FPS)}); continue
                pos = flat.find(norm(m.get("say", m["text"])))
                if pos < 0:
                    warnings.append(f"{sid}: mark trigger '{m.get('say')}' not found in the spoken words")
                    continue
                mk.append({"text": m["text"], "from": frame_at(pos)})
            props["marks"] = mk
            if s.get("follow") and s.get("text"):
                paras = [p for p in re.split(r"\n\s*\n", s["text"]) if p.strip()]
                pstarts, acc = [], 0
                body = norm(s["text"])
                for ptxt in paras:
                    k = body.find(norm(ptxt)[:12], acc)
                    k = acc if k < 0 else k
                    pstarts.append(frame_at(k))
                    acc = k + len(norm(ptxt))
                props["paraStarts"] = pstarts
        if not words and s.get("marks"):
            body = re.sub(r"\s+", "", text)
            props["marks"] = [{"text": m["text"], "from": round((LEAD_IN + (m["at"] if "at" in m else speak * max(0, body.find(m.get("say", m["text"]).replace(" ", ""))) / max(1, len(body)))) * FPS)} for m in s["marks"]]
        elif s.get("keywords"):
            # no word timing yet: spread by character position
            body = re.sub(r"\s+", "", text)
            props["highlights"] = [{"text": kw, "from": round((LEAD_IN + speak * max(0, body.find(kw.replace(" ", ""))) / max(1, len(body))) * FPS)} for kw in s["keywords"]]
        if words and s.get("beats"):
            bts = []; last = 0
            for b in s["beats"]:
                b = dict(b)
                if "say" in b:
                    # search after the previous beat's word, so a repeated word ("클로드" twice) hits the right one
                    say = b.pop("say"); pos = flat.find(norm(say), last)
                    if pos < 0:
                        pos = flat.find(norm(say))
                    if pos < 0:
                        warnings.append(f"{sid}: beat trigger '{say}' not found"); continue
                    last = pos + 1
                    b["from"] = 0 if not bts else frame_at(pos)
                else:
                    b["from"] = 0 if not bts else round((LEAD_IN + b.pop("at", 0)) * FPS)
                # items inside a beat (win facts/icons/rows/options, icons items) can start on a spoken
                # phrase too: {"say": "96센트"} → "at" = seconds into the beat; "stampSay" → "stampAt".
                ip = max(0, last - 1)
                for key in ("facts", "icons", "items", "rows", "options", "posts", "nodes", "checks", "bars", "lines"):
                    if not isinstance(b.get(key), list):
                        continue
                    b[key] = [dict(x) if isinstance(x, dict) else x for x in b[key]]
                    for it in b[key]:
                        if isinstance(it, dict) and "say" in it and "at" not in it:
                            say = it.pop("say"); p = flat.find(norm(say), ip)
                            if p < 0:
                                warnings.append(f"{sid}: {key} trigger '{say}' not found after beat start"); continue
                            it["at"] = round(max(0, frame_at(p) - b["from"]) / FPS, 2); ip = p + 1
                # any "<name>Say" on the beat (stampSay, proofSay, starSay …) → "<name>At"
                for k in [k for k in list(b) if k.endswith("Say") and isinstance(b[k], str)]:
                    say = b.pop(k); p = flat.find(norm(say), ip)
                    if p < 0:
                        warnings.append(f"{sid}: {k} '{say}' not found after beat start")
                    else:
                        b[k[:-3] + "At"] = round(max(0, frame_at(p) - b["from"]) / FPS, 2)
                bts.append(b)
            props["beats"] = win_past(bts)
        if not words and s.get("beats"):
            body = re.sub(r"\s+", "", text); bts = []
            for b in s["beats"]:
                b = dict(b); say = b.pop("say", None)
                pos = body.find(say.replace(" ", "")) if say else 0
                b["from"] = 0 if not bts else round((LEAD_IN + speak * max(0, pos) / max(1, len(body))) * FPS)
                for key in ("facts", "icons", "items", "rows", "options", "posts", "nodes", "checks", "bars", "lines"):
                    if isinstance(b.get(key), list):
                        b[key] = [{k: v for k, v in x.items() if k != "say"} if isinstance(x, dict) else x for x in b[key]]
                for k in [k for k in list(b) if k.endswith("Say")]:
                    b.pop(k)
                bts.append(b)
            props["beats"] = win_past(bts)
            warnings.append(f"{sid}: beats timed by estimate (no word timings)")
        # Timed lists: chat messages, timed terminal lines and stickers. An item with "say" appears
        # when that phrase is spoken (searched in order, so a repeated word hits its next use),
        # "at" = seconds into the narration, neither = 0.6 s after the previous item. Stickers also
        # take "until" (phrase) or "for" (seconds) for when they leave.
        def trigger(say, after):
            key = norm(say)
            hay = flat if words else norm(text)
            pos = hay.find(key, after)
            if pos < 0:
                pos = hay.find(key)
            if not key or pos < 0:
                return None, after
            f = frame_at(pos) if words else round((LEAD_IN + speak * pos / max(1, len(hay))) * FPS)
            return f, pos + len(key)
        for field in ("messages", "lines", "stickers", "stickersShort"):
            items = s.get(field)
            if not isinstance(items, list) or not any(isinstance(x, dict) for x in items):
                continue  # plain terminal lines (strings) keep the old line-by-line timing
            out, cur, last = [], 0, None
            for it in items:
                it = {"text": it} if isinstance(it, str) else dict(it)
                f = None
                if "say" in it:
                    say = it.pop("say")
                    f, cur = trigger(say, cur)
                    if f is None:
                        warnings.append(f"{sid}: {field} trigger '{say}' not found in the spoken words")
                elif "at" in it:
                    f = round((LEAD_IN + it.pop("at")) * FPS)
                if f is None:
                    f = last + round(0.6 * FPS) if last is not None else round(LEAD_IN * FPS)
                if "until" in it:
                    u = it.pop("until")
                    to, _ = trigger(u, cur)
                    if to is None:
                        warnings.append(f"{sid}: {field} 'until' trigger '{u}' not found")
                    else:
                        it["to"] = to
                elif "for" in it:
                    it["to"] = f + round(it.pop("for") * FPS)
                it["from"] = f
                last = f
                out.append(it)
            props[field] = out
        # New scene types (tier, quiz, scoreboard, news, doc, race, flow, code, receipt, map): any object
        # anywhere in their props with "say" (a phrase from the narration, searched in order) or "at"
        # (seconds into the narration) gets "from" = frame in the scene. Components fall back to
        # spreading items over the scene when "from" is missing.
        if kind in TIMED_TYPES:
            pos = [0]
            def walk(o):
                if isinstance(o, dict):
                    if isinstance(o.get("say"), str):
                        say = o.pop("say")
                        f, nxt = trigger(say, pos[0])
                        if f is None:
                            warnings.append(f"{sid}: trigger '{say}' not found in the spoken words")
                        else:
                            pos[0] = nxt
                            o["from"] = f
                    elif isinstance(o.get("at"), (int, float)) and "from" not in o:
                        o["from"] = round((LEAD_IN + o.pop("at")) * FPS)
                    for v in o.values():
                        walk(v)
                elif isinstance(o, list):
                    for v in o:
                        walk(v)
            for key in list(props):
                if key not in ("highlights", "marks", "mascot", "doodles", "doodlesShort", "stickers", "stickersShort", "keywords"):
                    props[key] = copy.deepcopy(props[key])
                    walk(props[key])
        # mascot beats can start on a spoken phrase too: {"on": "phrase", "pose": ..., "say": bubble}
        mas = props.get("mascot")
        if isinstance(mas, dict) and any("on" in b for b in mas.get("beats", [])):
            mas = copy.deepcopy(mas)
            for b in mas["beats"]:
                if "on" in b:
                    on = b.pop("on")
                    f, _ = trigger(on, 0)
                    if f is None:
                        warnings.append(f"{sid}: mascot trigger '{on}' not found")
                        b.setdefault("at", 1.0)
                    else:
                        b["at"] = round(f / FPS, 2)
            props["mascot"] = mas
        # "continue": true on a chat / timed terminal scene keeps the previous one's thread on screen
        # (already settled), so one conversation or one terminal can run across several scenes.
        if kind in ("chat", "terminal"):
            field = "messages" if kind == "chat" else "lines"
            if s.get("continue"):
                prev = [{k: v for k, v in x.items() if k not in ("stamp", "progress")} | {"from": -300} for x in carry.get((kind, bool(s.get("shortOnly"))), [])]
                props[field] = prev + list(props.get(field, []))
            if kind == "chat" or any(isinstance(x, dict) for x in props.get(field, [])):
                carry[(kind, bool(s.get("shortOnly")))] = props.get(field, [])
        (short_scenes if s.get("shortOnly") else scenes).append({
            "id": sid, "type": kind, "from": cursor, "frames": frames,
            "audio": f"audio/{src_id}.mp3" if audio.is_file() else None,
            "audioEstimated": estimated,
            "captionTiming": "words" if words else ("ratio" if text else "none"),
            "captions": captions,
            "rec": rec,
            "props": props,
        })
        if s.get("shortOnly"):
            continue
        if s.get("chapter"):
            chapters.append((cursor / FPS, s["chapter"]))
        cursor += frames

    shorts = []
    by_id = {s["id"]: s for s in scenes + short_scenes}
    for sh in ep.get("shorts", []):
        missing = [i for i in sh["scenes"] if i not in by_id]
        if missing:
            sys.exit(f"short {sh['id']}: unknown scenes {missing}")
        total = sum(by_id[i]["frames"] for i in sh["scenes"]) / FPS
        if total > SHORT_MAX_SEC:
            warnings.append(f"short {sh['id']}: {total:.1f}s is over {SHORT_MAX_SEC}s, the Shorts limit; drop a scene or tighten narration")
        elif total > 60:
            warnings.append(f"short {sh['id']}: {total:.1f}s (over 60 s is allowed, but some surfaces treat it as a regular video)")
        shorts.append({**sh, "seconds": round(total, 2)})

    timeline = {
        "fps": FPS,
        "title": ep.get("title", ""),
        "channel": ep.get("channel", ""),
        "episode": ep.get("episode", ""),
        "accent": ep.get("accent"),
        "music": ep.get("music") if ep.get("music") and (project / "public" / ep["music"]).is_file() else None,
        "musicVolume": ep.get("musicVolume", 0.08),
        "captionStyle": ep.get("captionStyle", "karaoke"),
        "hookStyle": ep.get("hookStyle", "slide"),
        "totalFrames": cursor,
        "leadInFrames": round(LEAD_IN * FPS),  # LongVideo/ShortVideo start each narration here
        "scenes": scenes,
        "shortScenes": short_scenes,
        "shorts": shorts,
        "thumbnail": ep.get("thumbnail", {"lines": [ep.get("title", "")], "sub": ep.get("channel", "")}),
    }
    (project / "src" / "timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=2), encoding="utf-8")

    # 3. YouTube chapters: first must be 0:00, at least 3, each at least 10s apart.
    out_dir = project / "out"
    out_dir.mkdir(exist_ok=True)
    if chapters:
        if chapters[0][0] != 0:
            chapters.insert(0, (0.0, "인트로"))
        lines = [f"{int(t // 60)}:{int(t % 60):02d} {name}" for t, name in chapters]
        (out_dir / "chapters.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
        gaps = [b[0] - a[0] for a, b in zip(chapters, chapters[1:])]
        if len(chapters) < 3 or any(g < 10 for g in gaps):
            warnings.append("chapters: YouTube needs 3+ chapters, each 10s+ long, or it ignores them")

    # 4. Upload text: title, description (with chapters) and tags, ready to paste into YouTube Studio.
    yt = [f"# {ep.get('title', '')}", "", ep.get("description", "").strip()]
    if chapters:
        yt += ["", "## 챕터", *[f"{int(t // 60)}:{int(t % 60):02d} {name}" for t, name in chapters]]
    if ep.get("tags"):
        yt += ["", "## 태그", ", ".join(ep["tags"])]
    for sh in shorts:
        yt += ["", f"## 쇼츠 {sh['id']}", f"제목: {sh.get('title') or sh['hook']}", f"길이: {sh['seconds']}초"]
    (out_dir / "youtube.md").write_text("\n".join(yt).strip() + "\n", encoding="utf-8")

    est = [s["id"] for s in scenes if s["audioEstimated"]]
    summary = {
        "long_seconds": round(cursor / FPS, 2),
        "scenes": [{"id": s["id"], "seconds": round(s["frames"] / FPS, 2),
                    "audio": "estimated" if s["audioEstimated"] else ("yes" if s["audio"] else "none"),
                    "captions": s["captionTiming"]} for s in scenes],
        "shorts": [{"id": s["id"], "seconds": s["seconds"]} for s in shorts],
        "warnings": warnings + ([f"no audio yet for: {', '.join(est)} (lengths estimated)"] if est else []),
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
