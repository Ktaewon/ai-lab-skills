# Sound — score and foley from code (`scripts/sound_lib.py`)

No samples and no AI audio: everything is synthesized with numpy so the piece stays "code only".
(If the user prefers real music/voice, the youtube-video skill has Lyria music and Gemini/ElevenLabs TTS —
ask before mixing those in, it changes the "code only" claim.)

## Workflow
1. Copy the beat times from `scene.js` `T = {...}` into `sound.py` (one cue per visual event).
2. Layers, quiet → loud: ambience bed (always) → music → foley → impacts.
3. `render.sh` runs it, then normalises to **-14 LUFS, true peak ≤ -1 dB**.
4. Verify numerically (RMS per second, max sample jump) — you cannot listen. Ask the user to listen in
   QuickTime (the app's inline player is muted).

## Music quick-picks
| mood | key / mode | progression (2–3 s per chord) | lead |
|---|---|---|---|
| wonder, warm | D or G major | I – vi – IV – V(sus) – I | `flute` |
| melancholy | A or E minor | i – VI – III – VII | `flute` low / `pluck` |
| eastern calm | D / A pentatonic (no 4th, 7th) | drone + open fifths | `pluck` (koto), breathy `flute` |
| playful | C or F major | I – IV – V – I, staccato | `pluck`, `bell` |
| tense | D minor / Phrygian | i – bII drone, low pulses | `drum`, low `pad_note` |
| triumphant | D major | IV – V – I with octave doubling at climax | `flute` high + full chord |
| tech / neon | F# minor | i – VI – III – VII, arpeggiated | bright `pad_note`, `pluck` arps |

Climax: add a full voicing across 3 octaves at the hit, lead holds its highest note; resolve after.

## Foley map
| visual | function |
|---|---|
| forest / outdoor | `wind`, `chirp` via `Mix.scatter` |
| rain / water / fire | `rain`, `water`, `fire` |
| bird / cloth / paper | `flap`, `rustle` |
| footsteps | `steps(heavy=True)` for giants |
| electric / magic on | `zap`, `hum`, `bell` |
| heavy movement | `creak` + `rumble` |
| ignition / power-up | `whine` + `riser` |
| impact / launch | `boom`, `whoosh` (swap ranges for falling) |

Pan sounds to where they happen on screen (−1 left … +1 right).
