# Craft — what makes code-drawn frames look hand-made

Lessons from building LAB-01 (first pass looked like a toy; these fixed it).

## Composition
- Decide the **one image** each shot must read as, thumbnail-small. Silhouette first, detail last.
- 4–6 depth layers: sky → far ridge → far foliage → mid → hero → near foliage → foreground framing (branch,
  grass, window frame). Far layers: lighter, bluer/hazier, smaller marks. Near: darker, saturated, bigger marks.
- **Sell scale with occlusion and haze**, not size alone: bury a giant's lower half in near trees, put mist in
  front of its legs, put a tiny bird on its shoulder.
- Rule of thirds; hero faces into open space; leave a quiet area for the eye to rest.
- Foreground framing element on one edge (branch, pillar, curtain) makes a frame feel "shot", not "drawn".

## Light & colour
- One key light direction for everything (`E.light`). Shadows are cool (violet/blue), light warm; never grey.
- Cel shading via `E.part`: shadow crescent = shape minus shape shifted toward the light; thin rim highlight
  on the light side. Shadow depth `d` ≈ 15–25 % of the part's width.
- Glows (eyes, cores, lanterns) = flat bright fill + additive `E.glow`; also tint nearby surfaces.
- Palette: pick 2 hues + neutrals per scene; accent used in ≤ 3 places.

## Drawing characters
- **Forms**: mechanical = chamfered (`round:1`), organic = `round:2–3`. Rounding everything = pill toy.
- Lines 3–5 px at 1080p for heroes, 2 px interior lines, thicker on the shadow side, tapered open lines.
- Material tells: panel lines, rivets, chips, rust streaks running *down*, moss on *top* surfaces only.
- Build every part that might be revealed later (legs hidden in trees still need to exist for the launch).
- Split a character into back / middle / front canvases when parts move between (head between body and arm).
- Pre-render drawings into offscreen canvases per **variant** (0–2) for boil; holds use variant 0 (no boil).

## Animating
- Characters **on twos** (`E.twos`); camera, mist, light and particles on ones.
- Key poses + holds. Anticipation (small opposite move) before every big move; overshoot-and-settle after.
- Large rotations of a whole bitmap read as a puppet. Prefer: (a) pose interpolation — store key poses as point
  arrays and redraw each drawing with `E.key(t, [[t0, ptsA], [t1, ptsB]])`; (b) a squash/settle on the rotated
  part; (c) secondary motion (debris, vines, hair) to hide the pivot.
- Overlapping action: things attached to a moving body lag and settle (vines, cloth, leaves, falling moss).
- Weight: big things start slow, rumble, shake the camera (`E.shake`, 2–12 px, on twos), drop debris.
- Fast moves: 2–4 drawings across the screen + trail/smear + flash; do not tween slowly.

## Backgrounds
- Paint once in `build()`; never per frame.
- Foliage: `E.foliage` for far rows; `E.canopy` near the camera (layered crowns: lit top shifted toward the sun,
  cool underside, serrated edge, per-tree hue variation, random overlap order). Uniform round clumps read as
  broccoli; flat ellipse bases read as bonsai/pancakes — both happened on LAB-01.
- Clouds: small light offsets (3–9 px) or they look misregistered.
- Mist strips (`E.mist`) between layers give depth for free; slow drift only.

## FX
- Anime FX are **shapes with hard edges** (flame tongues, impact rings, speed lines) plus a glow — not just gradients.
- Particles: deterministic (seeded) with analytic motion so any frame can be rendered alone (`renderAt(t)`).
- Speed lines can read as rain; prefer a trail + flash + shake for launches.

## Performance & determinism
- `render(t)` must be a pure function of t (no state carried between frames) — capture renders out of order.
- All randomness through `E.rng(seed)`; per-drawing randomness seeded by `Math.floor(t*12)`.

## Gotchas
- Headless capture: GPU off (`capture.cjs` does it) or offscreen canvases draw black.
- Don't redeclare `const` names inside `render` when patching; the whole page fails silently in capture.
- `g.filter='blur()'` only for building textures, never per frame.
- The desktop app's inline video card plays muted — open the MP4 in QuickTime when handing over.
