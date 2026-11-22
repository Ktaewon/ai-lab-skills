"""Sound for this scene. Cue times mirror the T = {...} block in scene.js.
Run: python3 sound.py sound.wav   (render.sh does this and normalises to -14 LUFS)"""
import sys
sys.path.insert(0, "__SKILL_DIR__/scripts")
from sound_lib import *

DUR = 12
m = Mix(DUR)

# ambience bed (always on, quiet)
m.add(wind(DUR, .05), 0, pan=-.2)

# music — pick key/progression from the mood (references/sound.md)
m.chord(['D3', 'A3', 'E4', 'F#4'], 0.0, 4.0, .22)
m.chord(['B2', 'F#3', 'D4', 'A4'], 4.0, 4.0, .25)
m.melody([('F#5', 2.0, 1.0), ('E5', 3.0, .5), ('D5', 3.5, 1.4)])

# SFX — one line per visual event
# m.add(rumble(1.2, .35), 6.3)

m.write(sys.argv[1] if len(sys.argv) > 1 else 'sound.wav')
