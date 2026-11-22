"""Procedural score + SFX for LAB-01 (no samples, no AI audio). Writes lab01-sound.wav (48 kHz stereo).
Timeline matches index.html (DUR = 20 s)."""
import numpy as np, wave, sys

SR = 48000
DUR = 20.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
L = np.zeros(N); Rch = np.zeros(N)
t_all = np.arange(N) / SR


def add(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N: return
    sig = sig[: N - i]
    l = np.cos((pan + 1) * np.pi / 4); r = np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(sig)] += sig * gain * l * 1.414
    Rch[i:i + len(sig)] += sig * gain * r * 1.414


def fft_filter(x, lo=None, hi=None, slope=6.0):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); H = np.ones_like(f)
    if hi: H *= 1 / np.sqrt(1 + (f / hi) ** slope)
    if lo: H *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** slope)
    return np.fft.irfft(X * H, len(x))


def env(n, a, d, sustain=1.0, rel=None):
    """attack/decay in seconds over n samples; optional release tail fraction"""
    t = np.arange(n) / SR; T = n / SR
    e = np.minimum(1, t / max(a, 1e-4))
    rel = rel if rel is not None else d
    e *= np.clip((T - t) / max(rel, 1e-4), 0, 1)
    return e * sustain


def noise(sec): return rng.standard_normal(int(sec * SR))


def nfreq(name):
    names = {'C': -9, 'C#': -8, 'D': -7, 'D#': -6, 'E': -5, 'F': -4, 'F#': -3, 'G': -2, 'G#': -1, 'A': 0, 'A#': 1, 'B': 2}
    n, o = name[:-1], int(name[-1])
    return 440 * 2 ** ((names[n] + 12 * (o - 4)) / 12)

# ───────────────────────── music
def pad_note(f, sec, amp):
    n = int(sec * SR); t = np.arange(n) / SR; s = np.zeros(n)
    for det in (-0.004, 0.0, 0.0045):
        vib = 1 + 0.0025 * np.sin(2 * np.pi * 4.6 * t + rng.random() * 6)
        ph = 2 * np.pi * np.cumsum(f * (1 + det) * vib) / SR
        for k in range(1, 9):
            s += np.sin(k * ph + rng.random()) / k ** 1.7
    return s * amp / 6


def chord(names, start, sec, amp, att=1.2, rel=1.4, pan_spread=0.5):
    for i, nm in enumerate(names):
        n = pad_note(nfreq(nm), sec + rel, amp)
        n *= env(len(n), att, 0, rel=rel)
        add(fft_filter(n, hi=2600 if amp < .5 else 4200), start, 1, pan=(i / max(1, len(names) - 1) - .5) * pan_spread)


chords = [
    (['D3', 'A3', 'E4', 'F#4'], 0.0, 2.6, .22),
    (['B2', 'F#3', 'D4', 'A4'], 2.6, 2.6, .25),
    (['G2', 'D3', 'B3', 'F#4'], 5.2, 2.5, .3),
    (['A2', 'E3', 'D4', 'A4'], 7.7, 1.2, .32),
    (['A2', 'E3', 'C#4', 'A4'], 8.9, 1.3, .34),
    (['B2', 'F#3', 'D4', 'B4'], 10.2, 2.2, .4),
    (['G2', 'D3', 'B3', 'G4', 'D5'], 12.4, 1.2, .45),
    (['A2', 'E3', 'D4', 'A4', 'E5'], 13.55, .8, .5),
    (['D2', 'A2', 'D3', 'F#3', 'A3', 'D4', 'F#4', 'A4', 'D5'], 14.35, 2.6, .62),
    (['G2', 'D3', 'B3', 'G4', 'D5'], 16.9, 1.4, .45),
    (['D2', 'A2', 'F#3', 'D4', 'A4', 'F#5'], 18.2, 1.6, .38),
]
for names, st, sec, amp in chords:
    chord(names, st, sec, amp, att=.9 if st < 14 else .25 if st == 14.35 else 1.0)


def flute(f, sec, amp):
    n = int(sec * SR); t = np.arange(n) / SR
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5.2 * t) * np.minimum(1, t / .35)
    ph = 2 * np.pi * np.cumsum(f * vib) / SR
    s = np.sin(ph) + .22 * np.sin(2 * ph) + .06 * np.sin(3 * ph)
    s += fft_filter(rng.standard_normal(n), lo=f * .8, hi=f * 3) * .05
    e = np.minimum(1, t / .09) * np.clip((sec - t) / .25, 0, 1)
    return s * e * amp


melody = [('F#5', 5.0, 1.1), ('E5', 6.1, .55), ('D5', 6.65, 1.2), ('A4', 8.0, .7), ('B4', 8.7, .55), ('D5', 9.25, 1.5),
          ('E5', 11.0, .5), ('F#5', 11.5, .5), ('A5', 12.0, 1.3), ('B5', 13.55, .8),
          ('D6', 14.4, 2.2), ('C#6', 16.6, .45), ('A5', 17.05, .6), ('F#5', 17.65, .7), ('D5', 18.35, 1.6)]
for nm, st, sec in melody:
    add(flute(nfreq(nm), sec, .16), st, 1, pan=.15)


def bell(f, sec, amp):
    n = int(sec * SR); t = np.arange(n) / SR; s = np.zeros(n)
    for ratio, a, dec in ((1, 1, 2.2), (2.76, .45, 3.5), (5.4, .25, 6), (8.93, .12, 9)):
        s += a * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t * dec)
    return s * amp * np.minimum(1, t / .004)

# ───────────────────────── ambience
bed = fft_filter(noise(DUR), hi=500, slope=4) * .05
wind_env = .6 + .25 * np.sin(2 * np.pi * t_all / 7.3) + 1.2 * np.clip((t_all - 14.3) / .5, 0, 1) * np.exp(-np.clip(t_all - 14.8, 0, None) / 3.5)
add(bed * wind_env, 0, 1, pan=-.2)
add(fft_filter(noise(DUR), lo=900, hi=3500, slope=4) * .012 * wind_env, 0, 1, pan=.3)


def chirp(kind):
    out = []
    for _ in range(rng.integers(2, 6)):
        d = rng.uniform(.04, .12); n = int(d * SR); t = np.arange(n) / SR
        f0 = rng.uniform(2600, 4200); f1 = f0 * rng.uniform(.65, 1.5)
        f = f0 + (f1 - f0) * (t / d) ** rng.uniform(.5, 2)
        s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 2
        out += [s, np.zeros(int(rng.uniform(.02, .09) * SR))]
    return np.concatenate(out)


tt = 0.4
while tt < 6.3:
    add(chirp(0), tt, rng.uniform(.03, .07), pan=rng.uniform(-.8, .8)); tt += rng.uniform(.35, 1.1)
tt = 16.2
while tt < 19.6:
    add(chirp(0), tt, rng.uniform(.02, .05), pan=rng.uniform(-.8, .8)); tt += rng.uniform(.4, 1.0)


def flap(n=6, rate=14):
    seg = []
    for i in range(n):
        b = fft_filter(noise(.05), lo=300, hi=2500) * np.hanning(int(.05 * SR))
        seg += [b, np.zeros(int(SR / rate) - len(b))]
    return np.concatenate(seg)

# bird lands on the shoulder, little chirp
add(flap(7, 15), 3.45, .12, pan=.6)
add(chirp(0), 4.2, .06, pan=.5); add(chirp(0), 5.95, .05, pan=.5)

# core flicker zaps + hum
for z in (5.4, 5.62, 5.82):
    s = fft_filter(noise(.06), lo=1500, hi=7000) * np.exp(-np.arange(int(.06 * SR)) / SR * 60)
    add(s, z, .25, pan=-.05)
hn = int((DUR - 6.0) * SR); th = np.arange(hn) / SR
hum = sum(np.sin(2 * np.pi * f * th) / k for k, f in enumerate((55, 110, 165, 220.5), 1))
hum *= np.minimum(1, th / .5) * .035 * (1 + .15 * np.sin(2 * np.pi * .7 * th)) * np.clip((15.3 - 6.0 - th) / .6, 0, 1)
add(hum, 6.0, 1, pan=-.05)
add(bell(nfreq('F#6'), 2.5, .09), 6.25, 1, pan=.1)
add(bell(nfreq('A6'), 2.5, .06), 6.34, 1, pan=-.1)


def rumble(sec, amp, sub=34):
    n = int(sec * SR); t = np.arange(n) / SR
    s = fft_filter(rng.standard_normal(n), lo=20, hi=110, slope=8) * 2.5 + .6 * np.sin(2 * np.pi * sub * t)
    return s * amp * np.minimum(1, t / .08) * np.clip((sec - t) / (sec * .6), 0, 1)


add(rumble(1.3, .35), 6.35)
add(flap(14, 18), 6.6, .1, pan=-.4); add(flap(12, 16), 6.75, .08, pan=.4)
for k in range(8): add(chirp(0), 6.65 + k * .07, .04, pan=rng.uniform(-.9, .9))


def creak(sec, amp, f0=70):
    n = int(sec * SR); t = np.arange(n) / SR
    f = f0 * (1 + .25 * np.sin(2 * np.pi * .6 * t) + .08 * fft_filter(rng.standard_normal(n), hi=6, slope=4) * 8)
    ph = 2 * np.pi * np.cumsum(f) / SR
    saw = 2 * ((ph / (2 * np.pi)) % 1) - 1
    stick = (fft_filter(rng.standard_normal(n), hi=30, slope=4) * 40 > .8).astype(float)  # stick–slip grains
    s = fft_filter(saw * (.5 + stick), lo=120, hi=1800) + fft_filter(saw, lo=300, hi=900) * .6
    return s * amp * np.minimum(1, t / .3) * np.clip((sec - t) / .5, 0, 1)


add(creak(2.6, .14, 62), 7.0, pan=.1)
add(creak(2.8, .16, 48), 10.1, pan=-.05)
add(rumble(2.8, .3, 30), 10.1)


def rustle(sec, amp):
    n = int(sec * SR); t = np.arange(n) / SR
    g = (fft_filter(rng.standard_normal(n), hi=14, slope=4) * 30).clip(0, None)
    return fft_filter(rng.standard_normal(n), lo=1500, hi=8000) * g * amp * np.clip((sec - t) / .8, 0, 1)


add(rustle(2.4, .05), 7.3, pan=.3); add(rustle(2.8, .08), 10.3, pan=-.2)

# ignition: rising turbine whine + building roar
n = int((14.35 - 13.55) * SR); t = np.arange(n) / SR; T = n / SR
f = 220 + 1100 * (t / T) ** 1.6
whine = np.sin(2 * np.pi * np.cumsum(f) / SR) * .5 + np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * .2
add(whine * (t / T) ** 1.2 * .09, 13.55, pan=-.1)
add(fft_filter(noise(T), lo=80, hi=900) * (t / T) ** 2 * .35, 13.55, pan=-.1)
for z in (13.55, 13.72, 13.83): add(fft_filter(noise(.08), lo=200, hi=3000) * np.hanning(int(.08 * SR)), z, .25)


def whoosh(sec, amp, lo0=300, hi0=900, lo1=2500, hi1=7000):
    n = int(sec * SR); chunk = 2048; out = np.zeros(n + 2 * chunk)
    src = rng.standard_normal(n + 2 * chunk); win = np.hanning(2 * chunk)
    for i in range(0, n, chunk):  # overlap-add so the moving filter has no seams
        u = i / n
        out[i:i + 2 * chunk] += fft_filter(src[i:i + 2 * chunk] * win, lo=lo0 + (lo1 - lo0) * u, hi=hi0 + (hi1 - hi0) * u)
    out = out[:n]
    tt = np.arange(n) / SR
    return out * amp * np.sin(np.pi * np.clip(tt / sec, 0, 1)) ** 1.5


add(whoosh(1.4, .5), 13.95, pan=-.3)
# launch: boom, roar, upward doppler whoosh
add(rumble(2.5, .9, 28), 14.35)
n = int(3.2 * SR); t = np.arange(n) / SR
roar = fft_filter(rng.standard_normal(n), lo=60, hi=1800) * np.exp(-t / 1.1) * np.minimum(1, t / .03)
add(roar * .7, 14.35)
add(whoosh(1.2, .6, 1200, 3000, 200, 700), 14.4, pan=.4)
add(whoosh(2.2, .35), 14.5, pan=-.4)

# leaves settling + a last high chime
add(rustle(4.0, .04), 15.2, pan=.2)
add(bell(nfreq('D6'), 3.0, .06), 18.35, 1, pan=0)

# master: fades, soft clip
fade = np.minimum(1, t_all / .6) * np.clip((DUR - t_all) / .6, 0, 1)
L *= fade; Rch *= fade
m = max(np.abs(L).max(), np.abs(Rch).max())
L = np.tanh(L / m * 1.3) * .95; Rch = np.tanh(Rch / m * 1.3) * .95
out = (np.stack([L, Rch], 1) * 32767).astype(np.int16)
path = sys.argv[1] if len(sys.argv) > 1 else 'lab01-sound.wav'
with wave.open(path, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print('wrote', path)
