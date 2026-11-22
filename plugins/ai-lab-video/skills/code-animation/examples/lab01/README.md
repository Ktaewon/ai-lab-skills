# LAB-01 — anime-cel reference (20 s)

Self-contained (pre-engine) version, v3 (layered canopy, hoses, fingers, ear disc, vent grille): `lab01.html` has its own copy of the drawing code; `sound.py` is the
standalone synth that later became `scripts/sound_lib.py`.

Beats: 0–2.5 misty dawn · 2.6–4 bird lands on shoulder · 4.3 sunbeam hits face · 5.4 chest core flickers on ·
6.25 eyes light · 6.35 ground tremors, flock bursts · 7–9.4 head lifts (debris) · 10–12.6 stands up ·
13.55 thruster ignition, first wind ring · 14.35 launch (flash, big ring, leaf burst) · 15–20 light trail and falling leaves.

Patterns worth reusing: body split into back / head / front canvases; hero buried in a near foliage layer for
scale; `launch(t)` transform wrapping the whole character; `drawTrail` sampling past positions; analytic
debris spawned from body/head-local points; flicker via step keys.
