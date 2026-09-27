"""Synthesizes the reel's soundtrack: a 120 BPM track plus sound design hits,
all locked to the visual cue times in reel.js. Output: out/reel-audio.wav

    python3 sfx.py

Everything is generated from oscillators and noise (no samples), so the
audio is royalty-free and reproducible (fixed random seed).
"""
import os
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt, sosfilt_zi

SR = 48000
DUR = 30.0
N = int(SR * DUR)
rng = np.random.default_rng(7)
BEAT = 0.5  # 120 BPM

music = np.zeros((N, 2))
sfx = np.zeros((N, 2))
verb_send = np.zeros((N, 2))


# ---------------------------------------------------------------- helpers
def tt(d):
    return np.arange(int(d * SR)) / SR


def noise(d):
    return rng.standard_normal(int(d * SR))


def filt(x, kind, f, order=2):
    sos = butter(order, f, btype=kind, fs=SR, output="sos")
    return sosfilt(sos, x)


def sweep_filter(x, kind, f_of_t, order=2, block=256):
    """Time-varying Butterworth filter. f_of_t maps time (s) -> cutoff (Hz or [lo, hi])."""
    out = np.zeros_like(x)
    zi = None
    for i in range(0, len(x), block):
        f = f_of_t(i / SR)
        sos = butter(order, f, btype=kind, fs=SR, output="sos")
        if zi is None:
            zi = sosfilt_zi(sos) * 0
        out[i:i + block], zi = sosfilt(sos, x[i:i + block], zi=zi)
    return out


def pan(x, p):
    """p in [-1, 1] (scalar or array) -> stereo, equal power."""
    a = (np.asarray(p) + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1)


def place(bus, sig, t0, gain=1.0, p=0.0, send=0.0):
    if sig.ndim == 1:
        sig = pan(sig, p)
    i0 = int(round(t0 * SR))
    if i0 >= N:
        return
    if i0 < 0:
        sig, i0 = sig[-i0:], 0
    n = min(len(sig), N - i0)
    bus[i0:i0 + n] += sig[:n] * gain
    if send:
        verb_send[i0:i0 + n] += sig[:n] * gain * send


def saw(freq_t):
    ph = np.cumsum(freq_t) / SR
    return 2 * (ph % 1.0) - 1


def sine(freq_t, phase=0.0):
    return np.sin(2 * np.pi * np.cumsum(freq_t) / SR + phase)


def adsr(n, a, r):
    env = np.ones(n)
    na, nr = int(a * SR), int(r * SR)
    if na:
        env[:na] = np.linspace(0, 1, na)
    if nr:
        env[-nr:] *= np.linspace(1, 0, nr)
    return env


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ---------------------------------------------------------------- drums
def kick(dur=0.45, punch=1.0):
    t = tt(dur)
    f = 44 + 120 * np.exp(-t / 0.032)
    body = sine(f) * np.exp(-t / 0.26)
    click = filt(noise(dur), "highpass", 2500) * np.exp(-t / 0.003) * 0.35
    return np.tanh(1.6 * punch * (body + click)) * 0.9


def clap(dur=0.35):
    t = tt(dur)
    n = filt(noise(dur), "bandpass", [900, 3200])
    env = np.zeros_like(t)
    for d in (0.0, 0.011, 0.022):
        m = t >= d
        env[m] += np.exp(-(t[m] - d) / 0.006)
    m = t >= 0.024
    env[m] += 0.8 * np.exp(-(t[m] - 0.024) / 0.11)
    return n * env * 0.35


def hat(open_=False):
    d = 0.3 if open_ else 0.08
    t = tt(d)
    return filt(noise(d), "highpass", 7500) * np.exp(-t / (0.09 if open_ else 0.022)) * 0.25


# ---------------------------------------------------------------- tonal
def supersaw(freqs, dur, cutoff, voices=5, detune=0.012):
    n = int(dur * SR)
    L, R = np.zeros(n), np.zeros(n)
    for f in freqs:
        for v in range(voices):
            d = (v - (voices - 1) / 2) / ((voices - 1) / 2) * detune
            s = saw(np.full(n, f * (1 + d))) * (1 / voices)
            p = (v / (voices - 1)) * 2 - 1
            L += s * np.cos((p + 1) * np.pi / 4)
            R += s * np.sin((p + 1) * np.pi / 4)
    L, R = filt(L, "lowpass", cutoff), filt(R, "lowpass", cutoff)
    return np.stack([L, R], axis=1) / len(freqs)


def bass_note(f, dur):
    t = tt(dur)
    s = 0.6 * saw(np.full(len(t), f)) + 0.6 * saw(np.full(len(t), f * 1.006)) + 0.8 * sine(np.full(len(t), f))
    s = sweep_filter(s, "lowpass", lambda x: 250 + 900 * np.exp(-x / 0.06), block=128)
    return np.tanh(1.3 * s) * adsr(len(t), 0.004, 0.03) * 0.5


def pluck(f, dur=0.35):
    t = tt(dur)
    s = np.sign(sine(np.full(len(t), f))) * 0.5 + saw(np.full(len(t), f * 2.003)) * 0.3
    s = filt(s, "lowpass", 3800) * np.exp(-t / 0.09)
    return s * 0.3


def bell(f, dur=1.4):
    t = tt(dur)
    s = sine(np.full(len(t), f)) + 0.4 * sine(np.full(len(t), f * 2.76)) * np.exp(-t / 0.2) + 0.2 * sine(np.full(len(t), f * 5.4)) * np.exp(-t / 0.08)
    return s * np.exp(-t / 0.5) * 0.25


# ---------------------------------------------------------------- sound design
def boom(dur=2.4, big=1.0):
    t = tt(dur)
    sub = sine(28 + 70 * np.exp(-t / 0.18)) * np.exp(-t / (0.9 * big))
    tom = sine(60 + 90 * np.exp(-t / 0.05)) * np.exp(-t / 0.25) * 0.6
    crack = filt(noise(dur), "lowpass", 3000) * np.exp(-t / 0.06) * 0.9
    rumble = filt(noise(dur), "lowpass", 180) * np.exp(-t / 0.7) * 1.2
    return np.tanh(1.8 * (sub + tom + crack + rumble)) * 0.95


def hit(dur=0.9):
    t = tt(dur)
    sub = sine(35 + 80 * np.exp(-t / 0.04)) * np.exp(-t / 0.3)
    snap = filt(noise(dur), "bandpass", [600, 5000]) * np.exp(-t / 0.05) * 0.7
    ring = sum(sine(np.full(len(t), f)) * a for f, a in ((523, 0.25), (784, 0.15), (1245, 0.1))) * np.exp(-t / 0.22)
    return np.tanh(1.6 * (sub + snap + ring)) * 0.8


def thump():
    t = tt(0.4)
    return np.tanh(2 * (sine(55 + 100 * np.exp(-t / 0.03)) * np.exp(-t / 0.14))) * 0.6


def riser(dur):
    t = tt(dur)
    x = t / dur
    nz = sweep_filter(noise(dur), "bandpass", lambda s: [300 * 30 ** (s / dur), 300 * 30 ** (s / dur) * 1.6])
    tone = saw(110 * 8 ** x * (1 + 0.01 * np.sin(2 * np.pi * 6 * t))) * 0.25
    tone = filt(tone, "lowpass", 4000)
    env = x ** 2.2
    return (nz * 0.9 + tone) * env * 0.8


def whoosh(dur=0.6, peak=0.6, lo=350, hi=4200):
    t = tt(dur)
    x = t / dur
    def fc(s):
        u = s / dur
        k = u / peak if u < peak else 1 - (u - peak) / (1 - peak) * 0.8
        c = lo * (hi / lo) ** max(0.0, min(1.0, k))
        return [c * 0.6, min(c * 1.6, SR / 2 - 100)]
    nz = sweep_filter(noise(dur), "bandpass", fc)
    env = np.where(x < peak, (x / peak) ** 2, np.exp(-(x - peak) / (1 - peak) * 4))
    return pan(nz * env * 1.1, np.linspace(-0.7, 0.7, len(t)))


def tick(f=3000):
    t = tt(0.03)
    return sine(np.full(len(t), f)) * np.exp(-t / 0.005) * 0.35


def keyclick():
    t = tt(0.04)
    n = filt(noise(0.04), "bandpass", [1800, 7000]) * np.exp(-t / 0.004)
    thud = sine(np.full(len(t), 900 + rng.uniform(-150, 150))) * np.exp(-t / 0.006) * 0.4
    return (n + thud) * 0.45


def ding(f=1760):
    t = tt(1.0)
    return (sine(np.full(len(t), f)) + 0.5 * sine(np.full(len(t), f * 1.5))) * np.exp(-t / 0.28) * 0.18


def ping(f=1318.5):
    t = tt(1.4)
    return (sine(np.full(len(t), f)) + 0.35 * sine(np.full(len(t), f * 2))) * np.exp(-t / 0.35) * 0.3


def pop(f0=1400, f1=320):
    t = tt(0.08)
    return sine(f1 + (f0 - f1) * np.exp(-t / 0.012)) * np.exp(-t / 0.03) * 0.45


def shimmer(dur=2.0, n=36):
    t = tt(dur)
    out = np.zeros((len(t), 2))
    for _ in range(n):
        f = rng.uniform(2500, 9000)
        d = rng.uniform(0, 0.25)
        env = np.clip((t - d) / 0.05, 0, 1) * np.exp(-np.clip(t - d, 0, None) / rng.uniform(0.25, 0.8))
        s = sine(np.full(len(t), f), rng.uniform(0, 6.28)) * env * (0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(8, 16) * t))
        out += pan(s, rng.uniform(-0.9, 0.9))
    return out * 0.05


def glitch(dur=0.35):
    t = tt(dur)
    out = np.zeros(len(t))
    i = 0
    while i < len(t):
        n = int(rng.uniform(0.01, 0.04) * SR)
        f = rng.choice([180, 360, 720, 1440, 2880])
        seg = np.sign(np.sin(2 * np.pi * f * t[:n])) * rng.uniform(0.1, 0.4)
        if rng.random() < 0.35:
            seg *= 0
        out[i:i + n] = seg[: len(out[i:i + n])]
        i += n
    return np.round(out * 6) / 6 * 0.6


def reverse_swell(dur=0.55):
    t = tt(dur)
    x = t / dur
    cym = filt(noise(dur), "highpass", 4000) * x ** 3
    body = filt(noise(dur), "bandpass", [300, 2000]) * x ** 4 * 0.6
    return (cym + body) * 0.9


def gliss_up(dur=0.8, f0=280, f1=1800):
    t = tt(dur)
    f = f0 * (f1 / f0) ** (t / dur)
    s = sine(f) + 0.3 * sine(f * 2)
    return s * np.sin(np.pi * t / dur) ** 0.6 * 0.18


def scribble(dur):
    """pencil-on-glass texture for the wireframe draw."""
    t = tt(dur)
    n = filt(noise(dur), "bandpass", [2500, 8000])
    am = 0.5 + 0.5 * np.sin(2 * np.pi * 23 * t) * np.sin(2 * np.pi * 3.1 * t)
    return n * am * np.sin(np.pi * t / dur) * 0.12


# ================================================================ MUSIC
CHORDS = {  # midi notes
    "Am": [57, 60, 64, 69], "F": [53, 57, 60, 65], "C": [55, 60, 64, 67], "G": [55, 59, 62, 67],
}
ROOT = {"Am": 33, "F": 29, "C": 36, "G": 31}  # bass midi
PROG = ["Am", "F", "C", "G"]


def chord_at(t):
    if t < 2.5:
        return "Am"
    return PROG[int((t - 2.5) // 2.0) % 4]


# intro drone + pad (0 - 2.5)
d = supersaw([midi(m) for m in [45, 57, 64]], 3.0, 700)
d *= adsr(len(d), 1.4, 0.6)[:, None]
place(music, d, 0.0, 0.55)
t = tt(3.0)
place(music, sine(np.full(len(t), 55.0)) * adsr(len(t), 1.2, 0.5) * 0.35, 0.0)

# main pad per bar (2.5 - 25.5)
bar = 2.5
while bar < 25.5:
    ch = chord_at(bar + 0.01)
    L = min(2.0, 25.5 - bar) + 0.35
    cut = 1200 if bar < 6 else 2400
    p = supersaw([midi(m) for m in CHORDS[ch]], L, cut)
    p *= adsr(len(p), 0.06, 0.35)[:, None]
    place(music, p, bar, 0.42, send=0.25)
    bar += 2.0

# drums
beats = np.arange(2.5, 25.5 - 1e-6, BEAT)
for b in beats:
    j = int(round((b - 2.5) / BEAT))
    if 9.49 < b < 9.99:
        continue  # breath before the platform slam
    if b < 3.4 and b > 2.6:
        continue
    place(music, kick(), b, 0.95)
    if b >= 6.0 and j % 4 in (1, 3):
        place(music, clap(), b, 0.8, p=0.05, send=0.2)
    if b >= 6.0:
        place(music, hat(open_=(j % 2 == 1)), b + 0.25, 0.55, p=0.25)
    if b >= 13.0:
        for k in (0.125, 0.375):
            place(music, hat(), b + k, 0.28, p=-0.3)

# bass eighths with sidechain feel (note starts just after kick)
e = 6.0
while e < 25.5 - 1e-6:
    if not (9.5 <= e < 10.0):
        f = midi(ROOT[chord_at(e + 0.01)] + (12 if int(round(e * 4)) % 4 == 2 else 0))
        place(music, bass_note(f, 0.22), e + 0.02, 0.75)
    e += BEAT / 2

# arp (13 - 25.5)
pat = [0, 1, 2, 3, 2, 1, 2, 3]
s = 13.0
i = 0
while s < 25.5 - 1e-6:
    ch = CHORDS[chord_at(s + 0.01)]
    note = ch[pat[i % 8]] + 12
    place(music, pluck(midi(note)), s, 0.55, p=0.35 * np.sin(i * 0.7), send=0.35)
    s += BEAT / 4
    i += 1

# finale (26.0 - 30): resolve to C major
fin = supersaw([midi(m) for m in [48, 55, 60, 64, 67, 72]], 4.0, 3000)
fin *= (adsr(len(fin), 0.02, 2.2))[:, None]
place(music, fin, 26.0, 0.6, send=0.4)
t = tt(3.6)
place(music, sine(np.full(len(t), midi(24))) * np.exp(-t / 1.6) * 0.5, 26.0)
for k, m in enumerate([72, 76, 79, 84, 88]):
    place(music, bell(midi(m), 2.0), 26.6 + k * 0.25, 0.9, p=(k - 2) * 0.3, send=0.6)

# ================================================================ SOUND DESIGN
# S1 boot: typing, riser, glitch
for k in range(21):
    place(sfx, keyclick(), 0.3 + k * 0.055, 0.8, p=rng.uniform(-0.3, 0.3))
place(sfx, riser(1.9), 0.6, 0.9, send=0.2)
for k in range(11):
    place(sfx, tick(2000 + k * 180), 1.5 + k * 0.06, 0.35)
place(sfx, glitch(0.33), 2.12, 0.6)

# S2 logo
place(sfx, boom(2.8), 2.5, 1.0, send=0.5)
place(sfx, shimmer(2.2), 2.55, 1.0, send=0.5)
for k in range(5):
    place(sfx, thump(), 2.53 + k * 0.07, 0.35)
place(sfx, whoosh(0.7, 0.5, 600, 6000), 2.95, 0.35)
place(sfx, whoosh(0.8, 0.5, 900, 7000), 3.75, 0.3)

# transitions (streaks at cuts) + stat slides
for c in (6.0, 7.0, 8.0, 9.0):
    place(sfx, whoosh(0.55, 0.62), c - 0.34, 0.85 if c == 6.0 else 0.6, send=0.15)
for k in range(4):
    s0 = 6.0 + k
    for j in range(16):
        place(sfx, tick(1800 + j * 90), s0 + 0.05 + j * 0.034, 0.3, p=0.1)
    place(sfx, ding(1760 if k % 2 == 0 else 2093), s0 + 0.6, 1.0, send=0.4)

# S4 platforms
place(sfx, whoosh(0.7, 0.75, 250, 6000), 9.5, 0.9)
place(sfx, riser(0.45), 9.55, 0.5)
for k in range(6):
    place(sfx, hit(), 10.0 + k * 0.5, 0.95 if k == 0 else 0.8, send=0.3)
place(sfx, boom(1.5, 0.6), 10.0, 0.6)

# S5 pillars
place(sfx, whoosh(0.55, 0.62), 12.66, 0.8)
for k in range(3):
    place(sfx, whoosh(0.45, 0.55, 500, 5000), 13.25 + k * 0.3 - 0.2, 0.55)
    place(sfx, pop(1200 + k * 200, 400), 13.4 + k * 0.3, 0.6)
place(sfx, shimmer(1.2, 18), 14.3, 0.6)
place(sfx, whoosh(0.5, 0.5, 400, 4500), 16.45, 0.6)

# S6 design -> develop -> launch -> grow
place(sfx, whoosh(0.55, 0.62), 16.66, 0.8)
for tw in (17.0, 18.3, 19.3, 20.3):
    place(sfx, thump(), tw, 0.8)
place(sfx, scribble(1.2), 17.05, 1.0)
for k in range(6):
    place(sfx, pop(900, 500), 17.35 + k * 0.12 + 0.3, 0.3)
for k in range(28):
    place(sfx, keyclick(), 18.4 + k * 0.034, 0.45, p=-0.4)
for k in range(6):
    place(sfx, pop(1500, 700), 18.3 + k * 0.1 + 0.1, 0.35, p=0.3)
place(sfx, whoosh(0.5, 0.6, 400, 5000), 19.1, 0.7)
place(sfx, ding(2637), 19.55, 0.9, send=0.3)
place(sfx, ding(3520), 19.66, 0.6, send=0.3)
place(sfx, gliss_up(0.8), 20.35, 1.0, send=0.3)
place(sfx, ding(2093), 21.1, 0.8, send=0.4)

# S7 globe
place(sfx, whoosh(0.55, 0.62), 21.16, 0.8)
place(sfx, whoosh(1.2, 0.45, 200, 2500), 21.5, 0.5)
for tp, f in ((22.2, 1318.5), (22.5, 1568.0), (23.2, 1760.0), (24.0, 2093.0)):
    place(sfx, ping(f), tp, 1.0, send=0.6)
    place(sfx, whoosh(0.5, 0.5, 1500, 8000), tp, 0.25)
place(sfx, whoosh(0.6, 0.35, 300, 3500), 23.45, 0.35)
for k in range(3):
    place(sfx, pop(1600, 600), 24.45 + k * 0.15, 0.6)

# S8 finale
place(sfx, reverse_swell(0.52), 25.5, 1.0)
place(sfx, whoosh(0.5, 0.95, 200, 7000), 25.5, 0.6)
place(sfx, boom(3.8, 1.3), 26.0, 1.1, send=0.6)
place(sfx, shimmer(3.0, 48), 26.05, 1.2, send=0.6)
place(sfx, whoosh(0.6, 0.4, 700, 6000), 26.9, 0.35)
for k in range(20):
    place(sfx, keyclick(), 27.2 + k * 0.045, 0.45, p=0.2)
place(sfx, shimmer(1.8, 20), 28.0, 0.5, send=0.5)

# ================================================================ MIX
t = tt(2.4)
ir = rng.standard_normal((len(t), 2)) * np.exp(-t / 0.5)[:, None]
ir[:, 0] = filt(ir[:, 0], "lowpass", 6000)
ir[:, 1] = filt(ir[:, 1], "lowpass", 6000)
ir /= np.sqrt((ir ** 2).sum(axis=0))
wet = np.stack([fftconvolve(verb_send[:, c], ir[:, c])[:N] for c in range(2)], axis=1)

mix = music * 0.55 + sfx * 0.9 + wet * 0.5
mix = np.stack([filt(mix[:, c], "highpass", 25) for c in range(2)], axis=1)
# gentle glue + soft clip, then fade the last beat
mix = np.tanh(mix * 1.4) / 1.4
fade = np.ones(N)
nf = int(0.9 * SR)
fade[-nf:] = np.linspace(1, 0, nf) ** 2
mix *= fade[:, None]
mix *= 10 ** (-1 / 20) / np.max(np.abs(mix))

os.makedirs(os.path.join(os.path.dirname(__file__), "out"), exist_ok=True)
path = os.path.join(os.path.dirname(__file__), "out", "reel-audio.wav")
with wave.open(path, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype("<i2").tobytes())
print("wrote", path)
