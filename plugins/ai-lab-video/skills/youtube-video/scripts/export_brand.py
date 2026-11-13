#!/usr/bin/env python3
"""Write the channel brand (assets/brand.json) into the other pipelines' style formats, so an
episode made with OpenMontage or the video toolkit looks like the rest of the channel.

  OpenMontage:   <OpenMontage>/styles/ai-lab.yaml            (style playbook; pass style_playbook="ai-lab")
  video toolkit: <toolkit>/brands/ai-lab/brand.json + voice.json (use brand "ai-lab")

Re-run after editing brand.json. Usage: py export_brand.py [--openmontage DIR] [--toolkit DIR]
"""
import argparse
import json
import os
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]
OM = Path(os.environ.get("OPENMONTAGE_DIR", Path(os.environ.get("VIDEO_TOOLS", Path.home() / "video-tools")) / "OpenMontage"))
TK = Path(os.environ.get("VIDEO_TOOLKIT", Path(os.environ.get("VIDEO_TOOLS", Path.home() / "video-tools")) / "claude-code-video-toolkit"))


def q(s: str) -> str:
    return json.dumps(s, ensure_ascii=False)


def openmontage_yaml(b: dict) -> str:
    c, f = b["colors"], b["fonts"]
    return f"""# Generated from the youtube-video skill's brand.json by export_brand.py. Edit brand.json, not this file.
identity:
  name: {q(b["name"])}
  category: motion-graphics
  mood: premium, playful, curious
  pace: fast
  best_for: "Korean AI/dev experiments, tool reviews and explainers with a felt otter mascot"

visual_language:
  color_palette:
    primary: [{q(c["accent"])}]
    accent: [{q(c["captionHighlight"])}, {q(c["mint"])}]
    background: {q(c["stage"])}
    text: {q(c["text"])}
    muted: {q(c["muted"])}
  composition: "left-weighted text and data, mascot bottom-right, generous negative space on a graphite stage"
  texture: "fine film grain (about 6%), one soft warm glow drifting behind content"

typography:
  headings:
    font: {q(f["display"]["family"])}
    weight: 400
    tracking: "0"
  body:
    font: {q(f["body"]["family"])}
    weight: 500
    line_height: 1.4
  code:
    font: {q(f["code"]["family"])}
    weight: 400
  stat_card:
    font: {q(f["display"]["family"])}
    weight: 400
    size_multiplier: 3.2
  scale_system: "perfect_fourth"
  weight_matrix:
    title: 400
    heading: 400
    body: 500
    caption: 600

motion:
  transitions: [cut, fade]
  animation_style: "smooth springs for stage, titles and data; doodles move in stop-motion steps (8-12 fps)"
  pacing_rules:
    min_scene_hold_seconds: 2.5
    max_scene_hold_seconds: 12
    text_card_hold_seconds: 3.5
    stat_card_hold_seconds: 3.0
    transition_duration_seconds: 0.3
  entrance: "rise 30px + fade over 0.4s; numbers count up; bars grow with a spring"
  exit: "cut"

audio:
  voice_style: "bright, clear Korean YouTuber tone, natural pace"
  music_mood: "light lo-fi / playful electronic, no vocals"
  music_volume: 0.08
  sfx_style: "soft pops on mascot pose changes, marker squeaks on doodles"
  ducking_threshold_db: -3

asset_generation:
  image_prompt_prefix: "clean product shot on a dark graphite background with a soft warm orange rim light, "
  image_negative_prompt: "cluttered, neon, cartoon outlines, text, watermark, low quality"
  diagram_style: "rounded dark panels (#111215) with thin #2A2C33 borders, orange accent for the key node"
  consistency_anchors:
    - "Graphite stage {c["stage"]} with one warm {c["accent"]} glow"
    - "Single data accent {c["accent"]}; other data in {c["barMuted"]}"
    - "Felt otter mascot reacts at key moments (sprites in the youtube-video skill)"
    - "Crude red ({c["doodle"]}) marker circles/arrows and yellow post-its as a scrappy layer"

overlays:
  stat_card:
    bg: {q(c["panel"])}
    border: {q(c["panelBorder"])}
    radius: 18
    shadow: "0 30px 80px rgba(0,0,0,0.45)"
  key_term:
    bg: {q(c["accent"])}
    text: "#111111"
    radius: 8
  code_block:
    bg: {q(c["panel"])}
    text: "#CFD3DC"
    highlight: {q(c["accent"])}

quality_rules:
  - "Korean text breaks between words (word-break: keep-all)"
  - "Shorts captions: Black Han Sans, white with thick black outline, spoken word in {c["captionHighlight"]}"
  - "One accent colour for data; never more than three colours on screen besides the stage"
  - "Mascot never covers data or captions"
  - "Final mix -14 LUFS"
"""


def toolkit_brand(b: dict) -> dict:
    c, f = b["colors"], b["fonts"]
    return {
        "name": b["name"],
        "description": "Generated from the youtube-video skill's brand.json (premium graphite stage, orange accent, felt otter mascot)",
        "version": "1.0.0",
        "colors": {
            "primary": c["accent"], "primaryLight": "#FF946F", "primaryDark": "#D9532A", "accent": c["captionHighlight"],
            "textDark": c["stage"], "textMedium": "#3A3C44", "textLight": c["muted"],
            "bgLight": c["lightStage"], "bgAlt": c["panel"], "bgDark": c["stage"],
            "bgOverlay": "rgba(27, 28, 33, 0.92)", "divider": c["panelBorder"], "shadow": "rgba(0, 0, 0, 0.45)",
        },
        "fonts": {
            "primary": f'"{f["body"]["family"]}", -apple-system, "Apple SD Gothic Neo", sans-serif',
            "display": f'"{f["display"]["family"]}", "{f["body"]["family"]}", sans-serif',
            "mono": f'"{f["code"]["family"]}", "SF Mono", Menlo, monospace',
        },
        "spacing": {"xs": 8, "sm": 16, "md": 24, "lg": 48, "xl": 80, "xxl": 120},
        "borderRadius": {"sm": 8, "md": 14, "lg": 22},
        "typography": {
            "h1": {"size": 120, "weight": 400}, "h2": {"size": 88, "weight": 400}, "h3": {"size": 56, "weight": 700},
            "body": {"size": 44, "weight": 500}, "label": {"size": 32, "weight": 600, "letterSpacing": 4},
        },
        "assets": {"mascot": str(SKILL / "assets" / "mascot"), "fonts": str(SKILL / "assets" / "fonts")},
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--openmontage", type=Path, default=OM)
    ap.add_argument("--toolkit", type=Path, default=TK)
    a = ap.parse_args()
    b = json.loads((SKILL / "assets" / "brand.json").read_text(encoding="utf-8"))
    done = []
    if (a.openmontage / "styles").is_dir():
        out = a.openmontage / "styles" / "ai-lab.yaml"
        out.write_text(openmontage_yaml(b), encoding="utf-8")
        done.append(str(out))
    if (a.toolkit / "brands").is_dir():
        d = a.toolkit / "brands" / "ai-lab"
        d.mkdir(exist_ok=True)
        (d / "brand.json").write_text(json.dumps(toolkit_brand(b), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        voice = d / "voice.json"
        if not voice.exists():  # keep any voice tuning the user did
            voice.write_text(json.dumps({
                "voiceId": os.environ.get("ELEVENLABS_VOICE_ID", ""),
                "description": "Channel ElevenLabs voice (default narration is Gemini TTS via the youtube-video skill)",
                "settings": {"stability": 0.6, "similarityBoost": 0.85, "style": 0.25, "useSpeakerBoost": True},
                "model": "eleven_multilingual_v2",
            }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        done += [str(d / "brand.json"), str(voice)]
    print(json.dumps({"wrote": done}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
