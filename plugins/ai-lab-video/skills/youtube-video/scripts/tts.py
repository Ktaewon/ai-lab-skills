#!/usr/bin/env python3
"""Generate narration with the voice chosen for this episode.

Reads episode.json "voice": { "provider": "gemini" | "elevenlabs" | "local", ... } and voices every
scene that has narration (plus shortScenes with "tts": true), writing public/audio/<id>.mp3,
levelled to -16 LUFS so scenes sound even whichever engine made them.

By default only scenes WITHOUT an mp3 are generated (prepare.py deletes the mp3 of any scene
whose narration changed), so re-running never pays twice. --only picks scenes, --all redoes all.

Usage:  py tts.py <project> [--only id1,id2] [--all]

  gemini      Google Gemini TTS via OpenMontage (voice: Kore, Puck, Charon, Aoede, ...; style: delivery note)
  elevenlabs  ElevenLabs via the video toolkit. Options on "voice" (and on each role):
                voice (voiceId), model (default eleven_v4 | eleven_v3 | eleven_multilingual_v2), speed (0.7–1.2),
                stability (default 0.5), similarity (default 0.75). Audio tags in the narration
                ("[장난스럽게] …", "[나지막이 웃음] …") direct the delivery on v3/v4; captions never show them.
                stability (0–1, lower = more emotion), style (0–1, v2 only), similarity (0–1)
              Roles: a scene with "voice": "<role>" uses voice.roles[<role>] on top of the base
              voice — e.g. a second speaker reading a letter or a toast:
                "voice": {"provider": "elevenlabs", "speed": 0.9,
                          "roles": {"toast": {"voice": "XrExE9yKIg1WjnnlVkGX", "model": "eleven_v4", "stability": 0.55}}}
  local       MeloTTS Korean on this computer, offline after a one-time setup (scripts/setup_local_tts.sh)
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

# ElevenLabs v3/v4 audio tags ("[장난스럽게]", "[나지막이 웃음]"): sent to TTS, never to captions.
TAG_RE = re.compile(r"\[[^\[\]\n]{1,40}\]")


def strip_tags(text: str) -> str:
    return re.sub(r"[ \t]{2,}", " ", re.sub(r" *\n *", "\n", TAG_RE.sub("", text))).strip()

HERE = Path(__file__).resolve().parent
TOOLKIT = Path(os.environ.get("VIDEO_TOOLKIT", Path(os.environ.get("VIDEO_TOOLS", Path.home() / "video-tools")) / "claude-code-video-toolkit"))
EL_FLAGS = {"voice": "--voice-id", "model": "--model", "speed": "--speed", "stability": "--stability",
            "style": "--style", "similarity": "--similarity"}


def level(mp3: Path):
    tmp = mp3.with_suffix(".lvl.mp3")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(mp3), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                    "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "192k", str(tmp)], check=True)
    tmp.replace(mp3)


def role_settings(voice: dict, role: str | None) -> dict:
    base = {k: v for k, v in voice.items() if k not in ("provider", "roles", "toast", "name")}
    if not role:
        return base
    extra = (voice.get("roles") or {}).get(role) or voice.get(role)  # voice.<role> kept for older episodes
    if not extra:
        sys.exit(f'scene voice "{role}" has no settings: add voice.roles.{role} to episode.json')
    return {**base, **{k: v for k, v in extra.items() if k != "name"}}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project", type=Path)
    ap.add_argument("--only", help="comma-separated scene ids")
    ap.add_argument("--all", action="store_true", help="regenerate every scene, even ones that already have audio")
    a = ap.parse_args()
    project = a.project.resolve()
    ep = json.loads((project / "episode.json").read_text(encoding="utf-8"))
    voice = ep.get("voice") or {}
    provider = voice.get("provider")
    if provider not in ("gemini", "elevenlabs", "local"):
        sys.exit('episode.json needs "voice": {"provider": "gemini" | "elevenlabs" | "local"} — ask the user which voice to use.')
    audio = project / "public" / "audio"
    audio.mkdir(parents=True, exist_ok=True)

    # Which scenes: narration present; --only filter; otherwise skip scenes that already have audio.
    voiced = [s for s in ep["scenes"] + [x for x in ep.get("shortScenes", []) if x.get("tts")] if s.get("narration", "").strip()]
    if a.only:
        keep = set(a.only.split(","))
        unknown = keep - {s["id"] for s in voiced}
        if unknown:
            sys.exit(f"--only: no narrated scene called {', '.join(sorted(unknown))}")
        todo = [s for s in voiced if s["id"] in keep]
    elif a.all:
        todo = voiced
    else:
        todo = [s for s in voiced if not (audio / f"{s['id']}.mp3").is_file()]
    if not todo:
        print("nothing to generate: every narrated scene has audio (use --only or --all to redo some)")
        return
    # Gemini/local read <id>.txt and alignment matches it, so it never holds audio tags;
    # ElevenLabs gets the tagged narration through its own batch folder below.
    for s in todo:
        (audio / f"{s['id']}.txt").write_text(strip_tags(s["narration"]) + "\n", encoding="utf-8")
    tagged = [s for s in todo if TAG_RE.search(s["narration"])]
    if provider == "elevenlabs":
        # Channel default: eleven_v4 follows audio tags; v2 reads flat and ignores them.
        voice = {"model": "eleven_v4", "stability": 0.5, "similarity": 0.75, **voice}
        if tagged and voice["model"] not in ("eleven_v3", "eleven_v4"):
            print(f'warning: {len(tagged)} scenes have [audio tags] but {voice["model"]} ignores them; use eleven_v4', file=sys.stderr)
        if voice["model"] in ("eleven_v3", "eleven_v4") and voice.get("speed") not in (None, 1, 1.0):
            print(f'note: {voice["model"]} ignores speed={voice["speed"]}; set the pace with tags like [차분하게] / [천천히]', file=sys.stderr)
    elif tagged:
        print(f"note: {provider} can't follow [audio tags]; removed them in {len(tagged)} scenes", file=sys.stderr)
    chars = sum(len(s["narration"].strip() if provider == "elevenlabs" else strip_tags(s["narration"])) for s in todo)
    print(f"{provider}: {len(todo)} scenes, {chars} characters → {', '.join(s['id'] for s in todo)}")
    py = [sys.executable, "-I"]
    ids = ",".join(s["id"] for s in todo)

    if provider in ("gemini", "local"):
        if any(s.get("voice") for s in todo):
            print(f"note: per-scene voice roles are only supported with elevenlabs; {provider} uses the base voice", file=sys.stderr)
        if provider == "gemini":
            cmd = [*py, str(HERE / "tts_gemini.py"), "--scene-dir", str(audio), "--voice", voice.get("voice", "Kore"), "--only", ids]
            if voice.get("style"):
                cmd += ["--style", voice["style"]]
        else:
            cmd = [*py, str(HERE / "tts_local.py"), "--scene-dir", str(audio), "--only", ids, "--preset", voice.get("preset", "lively")]
            if voice.get("speed"):
                cmd += ["--speed", str(voice["speed"])]
        sys.exit(subprocess.run(cmd).returncode)

    # ElevenLabs: one fresh batch folder per role, so nothing left over from an earlier run is billed again.
    groups: dict[str | None, list] = {}
    for s in todo:
        groups.setdefault(s.get("voice"), []).append(s)
    for role, scenes in groups.items():
        cfg = role_settings(voice, role)
        work = project / "record" / f"tts-{role or 'narrator'}"
        shutil.rmtree(work, ignore_errors=True)
        work.mkdir(parents=True)
        for s in scenes:
            (work / f"{s['id']}.txt").write_text(s["narration"].strip() + "\n", encoding="utf-8")
        cmd = ["uv", "run", "tools/voiceover.py", "--scene-dir", str(work), "--json"]
        for key, flag in EL_FLAGS.items():
            if cfg.get(key) is not None:
                cmd += [flag, str(cfg[key])]
        print(f"[{role or 'narrator'}] {len(scenes)} scenes · " + ", ".join(f"{k}={cfg[k]}" for k in EL_FLAGS if k in cfg))
        # Windows: the default cp949 codec can't read Korean script files, so force UTF-8.
        r = subprocess.run(cmd, cwd=TOOLKIT, capture_output=True, text=True, encoding="utf-8", errors="replace",
                           env={**os.environ, "PYTHONUTF8": "1", "PYTHONIOENCODING": "utf-8"})
        (project / "record" / f"tts-{role or 'narrator'}.json").write_text(r.stdout, encoding="utf-8")
        if r.returncode != 0:
            sys.stderr.write(r.stderr[-2000:])
            if "quota_exceeded" in r.stderr:
                sys.exit("ElevenLabs quota exceeded. The limit is usually the API KEY's own credit limit "
                         "(ElevenLabs → Developers → API Keys → edit the key → Credit limit), not the account balance. "
                         "Nothing from this batch was saved; raise the limit and run the same command again.")
            sys.exit(r.returncode)
        for s in scenes:
            mp3 = work / f"{s['id']}.mp3"
            if mp3.is_file():
                shutil.copy(mp3, audio / mp3.name)
                level(audio / mp3.name)
    print(f"done: {len(todo)} scenes. Next: align_words.py {audio}  then  prepare.py {project}")


if __name__ == "__main__":
    main()
