"""Procedural sound for code animations — numpy only, no samples, no AI audio.

    from sound_lib import *
    m = Mix(dur=20)
    m.add(bed(20, hi=500) * .05, 0)                 # ambience
    m.chord(['D3', 'A3', 'F#4'], 0, 2.5, .25)        # music pad
    m.add(flute(nf('F#5'), 1.0, .16), 5.0, pan=.15)
    m.add(rumble(1.3, .35), 6.35)
    m.write('sound.wav')                            # render.sh normalises to -14 LUFS afterwards

Every generator returns a mono float array; Mix.add(sig, start_sec, gain, pan) places it. Keep cue times in sync
with the T = {...} block of scene.js.
"""
import numpy as np, wave

SR = 48000
_rng = np.random.default_rng(7)


def seed(s): global _rng; _rng = np.random.default_rng(s)
def noise(sec): return _rng.standard_normal(int(sec * SR))
def tt(sec): return np.arange(int(sec * SR)) / SR


def filt(x, lo=None, hi=None, slope=6.0):
    """zero-phase FFT band filter (Butterworth-like magnitude)."""
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR); H = np.ones_like(f)
    if hi: H *= 1 / np.sqrt(1 + (f / hi) ** slope)
    if lo: H *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** slope)
    return np.fft.irfft(X * H, len(x))


def env(n, a, rel, peak=1.0):
    t = np.arange(n) / SR; T = n / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.clip((T - t) / max(rel, 1e-4), 0, 1) * peak


_NOTES = {'C': -9, 'C#': -8, 'Db': -8, 'D': -7, 'D#': -6, 'Eb': -6, 'E': -5, 'F': -4, 'F#': -3, 'Gb': -3, 'G': -2,
          'G#': -1, 'Ab': -1, 'A': 0, 'A#': 1, 'Bb': 1, 'B': 2}
def nf(name): return 440 * 2 ** ((_NOTES[name[:-1]] + 12 * (int(name[-1]) - 4)) / 12)


# ───────────── music
def pad_note(f, sec, amp, bright=8):
    """warm detuned additive pad (strings/organ hybrid)."""
    t = tt(sec); s = np.zeros(len(t))
    for det in (-0.004, 0.0, 0.0045):
        vib = 1 + 0.0025 * np.sin(2 * np.pi * 4.6 * t + _rng.random() * 6)
        ph = 2 * np.pi * np.cumsum(f * (1 + det) * vib) / SR
        for k in range(1, bright + 1): s += np.sin(k * ph + _rng.random()) / k ** 1.7
    return s * amp / 6


def flute(f, sec, amp, vib=.006):
    t = tt(sec); v = 1 + vib * np.sin(2 * np.pi * 5.2 * t) * np.minimum(1, t / .35)
    ph = 2 * np.pi * np.cumsum(f * v) / SR
    s = np.sin(ph) + .22 * np.sin(2 * ph) + .06 * np.sin(3 * ph) + filt(_rng.standard_normal(len(t)), lo=f * .8, hi=f * 3) * .05
    return s * np.minimum(1, t / .09) * np.clip((sec - t) / .25, 0, 1) * amp


def pluck(f, sec, amp, damp=3.0):
    """harp / koto / piano-ish pluck (Karplus–Strong)."""
    n = int(sec * SR); p = max(2, int(SR / f)); buf = _rng.uniform(-1, 1, p); out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % p]; buf[i % p] = .5 * (buf[i % p] + buf[(i + 1) % p]) * (1 - damp / 1000)
    return out * amp


def bell(f, sec, amp):
    t = tt(sec); s = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for r, a, d in ((1, 1, 2.2), (2.76, .45, 3.5), (5.4, .25, 6), (8.93, .12, 9)))
    return s * amp * np.minimum(1, t / .004)


def drum(sec=.6, amp=1., f0=90, f1=45):
    """taiko / kick: pitch-dropping sine + noise skin."""
    t = tt(sec); f = f1 + (f0 - f1) * np.exp(-t * 18)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6) + filt(noise(sec), lo=200, hi=2000) * np.exp(-t * 40) * .3) * amp


# ───────────── nature / ambience
def bed(sec, lo=None, hi=500): return filt(noise(sec), lo=lo, hi=hi, slope=4)
def wind(sec, amp=.05, gust=7.3):
    t = tt(sec); return filt(noise(sec), hi=500, slope=4) * amp * (.6 + .3 * np.sin(2 * np.pi * t / gust))
def rain(sec, amp=.05, density=60):
    s = filt(noise(sec), lo=2000, hi=9000) * .3; n = len(s)
    for i in _rng.integers(0, n - 400, int(sec * density)): s[i:i + 300] += filt(_rng.standard_normal(300), lo=1500, hi=7000) * np.exp(-np.arange(300) / 40) * _rng.uniform(.3, 1)
    return s * amp
def water(sec, amp=.05):
    t = tt(sec); g = (filt(noise(sec), hi=8, slope=4) * 20).clip(0, None); return filt(noise(sec), lo=300, hi=2500) * g * amp
def fire(sec, amp=.06):
    s = filt(noise(sec), hi=600) * .6; n = len(s)
    for i in _rng.integers(0, n - 200, int(sec * 25)): s[i:i + 120] += _rng.standard_normal(120) * np.exp(-np.arange(120) / 15) * _rng.uniform(.5, 2)
    return s * amp


def chirp():
    """one songbird phrase."""
    out = []
    for _ in range(_rng.integers(2, 6)):
        d = _rng.uniform(.04, .12); t = tt(d); f0 = _rng.uniform(2600, 4200); f1 = f0 * _rng.uniform(.65, 1.5)
        f = f0 + (f1 - f0) * (t / d) ** _rng.uniform(.5, 2)
        out += [np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 2, np.zeros(int(_rng.uniform(.02, .09) * SR))]
    return np.concatenate(out)


def flap(n=6, rate=14):
    seg = []
    for _ in range(n):
        b = filt(noise(.05), lo=300, hi=2500) * np.hanning(int(.05 * SR)); seg += [b, np.zeros(int(SR / rate) - len(b))]
    return np.concatenate(seg)


def steps(n=4, rate=2.2, heavy=False):
    seg = []
    for _ in range(n):
        s = drum(.35, 1, 70 if heavy else 160, 40 if heavy else 90) + filt(noise(.35), lo=800, hi=4000) * np.exp(-tt(.35) * 30) * .3
        seg += [s, np.zeros(max(0, int(SR / rate) - len(s)))]
    return np.concatenate(seg)


# ───────────── mechanical / impacts / transitions
def rumble(sec, amp, sub=34):
    t = tt(sec); s = filt(noise(sec), lo=20, hi=110, slope=8) * 2.5 + .6 * np.sin(2 * np.pi * sub * t)
    return s * amp * np.minimum(1, t / .08) * np.clip((sec - t) / (sec * .6), 0, 1)


def creak(sec, amp, f0=70):
    """metal / wood groan with stick–slip grains."""
    t = tt(sec); f = f0 * (1 + .25 * np.sin(2 * np.pi * .6 * t) + .08 * filt(noise(sec), hi=6, slope=4) * 8)
    ph = 2 * np.pi * np.cumsum(f) / SR; saw = 2 * ((ph / (2 * np.pi)) % 1) - 1
    stick = (filt(noise(sec), hi=30, slope=4) * 40 > .8).astype(float)
    s = filt(saw * (.5 + stick), lo=120, hi=1800) + filt(saw, lo=300, hi=900) * .6
    return s * amp * np.minimum(1, t / .3) * np.clip((sec - t) / .5, 0, 1)


def rustle(sec, amp):
    t = tt(sec); g = (filt(noise(sec), hi=14, slope=4) * 30).clip(0, None)
    return filt(noise(sec), lo=1500, hi=8000) * g * amp * np.clip((sec - t) / .8, 0, 1)


def zap(sec=.06, amp=.25): return filt(noise(sec), lo=1500, hi=7000) * np.exp(-tt(sec) * 60) * amp
def hum(sec, amp=.035, base=55):
    t = tt(sec); return sum(np.sin(2 * np.pi * base * k * t) / k for k in (1, 2, 3, 4)) * np.minimum(1, t / .5) * amp * (1 + .15 * np.sin(2 * np.pi * .7 * t))
def whine(sec, f0=220, f1=1300, amp=.09):
    t = tt(sec); f = f0 + (f1 - f0) * (t / sec) ** 1.6
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * .5 + np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * .2) * (t / sec) ** 1.2 * amp


def whoosh(sec, amp, lo0=300, hi0=900, lo1=2500, hi1=7000):
    """moving band-pass noise (overlap-add so the sweep has no seams). Swap lo/hi ends for a falling whoosh."""
    n = int(sec * SR); chunk = 2048; out = np.zeros(n + 2 * chunk); src = _rng.standard_normal(n + 2 * chunk); win = np.hanning(2 * chunk)
    for i in range(0, n, chunk):
        u = i / n; out[i:i + 2 * chunk] += filt(src[i:i + 2 * chunk] * win, lo=lo0 + (lo1 - lo0) * u, hi=hi0 + (hi1 - hi0) * u)
    return out[:n] * amp * np.sin(np.pi * np.clip(tt(sec) / sec, 0, 1)) ** 1.5


def boom(sec=2.5, amp=.9):
    t = tt(sec); return rumble(sec, amp, 28) + filt(noise(sec), lo=60, hi=1800) * np.exp(-t / 1.1) * np.minimum(1, t / .03) * amp * .7


def riser(sec, amp=.2): return whoosh(sec, amp, 200, 500, 3000, 9000) * np.linspace(0, 1, int(sec * SR)) ** 2


# ───────────── mixer
class Mix:
    def __init__(self, dur):
        self.dur = dur; self.N = int(dur * SR); self.L = np.zeros(self.N); self.R = np.zeros(self.N)

    def add(self, sig, start, gain=1.0, pan=0.0):
        i = int(start * SR)
        if i >= self.N or i < 0: return
        sig = np.asarray(sig)[: self.N - i]; l = np.cos((pan + 1) * np.pi / 4) * 1.414; r = np.sin((pan + 1) * np.pi / 4) * 1.414
        self.L[i:i + len(sig)] += sig * gain * l; self.R[i:i + len(sig)] += sig * gain * r

    def chord(self, names, start, sec, amp, att=1.0, rel=1.4, spread=.5, hi=None):
        for i, nm in enumerate(names):
            s = pad_note(nf(nm), sec + rel, amp); s *= env(len(s), att, rel)
            self.add(filt(s, hi=hi or (2600 if amp < .5 else 4200)), start, 1, pan=(i / max(1, len(names) - 1) - .5) * spread)

    def melody(self, notes, inst=flute, amp=.16, pan=.15):
        """notes: [(name, start, sec), ...]"""
        for nm, st, sec in notes: self.add(inst(nf(nm), sec, amp), st, 1, pan)

    def scatter(self, gen, t0, t1, every=(.35, 1.1), gain=(.03, .07), pan=.8):
        t = t0
        while t < t1:
            self.add(gen(), t, _rng.uniform(*gain), _rng.uniform(-pan, pan)); t += _rng.uniform(*every)

    def write(self, path, fade=.6):
        t = np.arange(self.N) / SR; f = np.minimum(1, t / fade) * np.clip((self.dur - t) / fade, 0, 1)
        L, R = self.L * f, self.R * f; m = max(np.abs(L).max(), np.abs(R).max(), 1e-9)
        L = np.tanh(L / m * 1.3) * .95; R = np.tanh(R / m * 1.3) * .95
        with wave.open(str(path), 'wb') as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.stack([L, R], 1) * 32767).astype(np.int16).tobytes())
        print('wrote', path)


__all__ = [k for k in dir() if not k.startswith('_') and k not in ('np', 'wave')]
