"""Synthesized score and sound design. Everything is generated here, deterministic per seed."""
import json
from functools import lru_cache

import numpy as np
import soundfile as sf
from scipy.ndimage import minimum_filter1d
from scipy.signal import butter, fftconvolve, lfilter, resample_poly, sosfilt

SR = 48000


def secs(n):
    return np.arange(int(round(n * SR)), dtype=np.float64) / SR


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "bandpass", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "highpass", fs=SR, output="sos"), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, "lowpass", fs=SR, output="sos"), x)


def noise(n, seed):
    return np.random.default_rng(seed).standard_normal(n)


# ---------------------------------------------------------------- piano

@lru_cache(maxsize=4096)
def _piano(m, vel, dur, pedal, seed):
    """Additive piano string model: stiff-string partials, 1-3 detuned strings per note,
    two-stage decay (prompt + aftersound), hammer spectrum by velocity, damper on release."""
    r = np.random.default_rng(seed * 1000 + m)
    f0 = mtof(m)
    tau0 = float(np.clip(10.5 * (f0 / 65.0) ** -0.62, 0.45, 16.0))
    damped = m < 89
    rel = (1.4 if pedal else 0.16) if damped else 5 * tau0
    length = min(dur, 5.5 * tau0) + rel
    t = secs(length)
    B = 1.3e-4 * 2 ** ((m - 60) / 15)
    strings = 1 if m < 34 else 2 if m < 46 else 3
    det = [0.0] + list(r.uniform(-0.9, 0.9, strings - 1))
    bright = 2.2 - 1.1 * vel
    out = np.zeros_like(t)
    norm = 0.0
    for n in range(1, 70):
        fn = n * f0 * np.sqrt(1 + B * n * n)
        if fn > 15500:
            break
        a = abs(np.sin(np.pi * n * 0.119)) / n ** bright
        if a < 1e-4:
            continue
        tau = tau0 / (1 + (fn / 1700.0) ** 1.25 + 0.06 * (n - 1))
        env = 0.68 * np.exp(-t / (0.3 * tau)) + 0.32 * np.exp(-t / tau)
        s = np.zeros_like(t)
        for d in det:
            s += np.sin(2 * np.pi * fn * 2 ** (d / 1200) * t + r.uniform(0, 2 * np.pi))
        out += a * env * s / strings
        norm += a * a
    out /= np.sqrt(norm) * 2.2
    # hammer: 1.2 ms rise, felt thump and a short knock that brightens with velocity
    atk = np.minimum(1, t / 0.0012)
    knock = bp(noise(len(t), seed + m), 300 + f0, min(9000, 2500 + 6 * f0)) * np.exp(-t / 0.006) * 0.06 * vel
    thump = np.sin(2 * np.pi * min(f0, 110) * t) * np.exp(-t / 0.03) * 0.05
    out = out * atk + knock + thump
    if damped:
        k = t > dur
        out[k] *= np.exp(-(t[k] - dur) / (0.35 if pedal else 0.07))
    return (out * vel ** 1.5).astype(np.float32)


def piano(m, vel=0.7, dur=1.0, pedal=False, seed=1):
    return _piano(int(m), round(float(vel), 2), round(float(dur), 3), bool(pedal), seed)


def piano_pan(m):
    return float(np.clip((m - 64) / 48, -0.45, 0.45))


# ---------------------------------------------------------------- sound design

def tick(seed=0, bright=1.0):
    """Mechanical escapement tick: two tiny metallic clicks 6 ms apart."""
    t = secs(0.05)
    out = np.zeros_like(t)
    for off, g in ((0, 1.0), (0.006, 0.55)):
        k = t >= off
        tt = t[k] - off
        out[k] += g * (np.sin(2 * np.pi * 4200 * bright * tt) * np.exp(-tt / 0.0025)
                       + 0.6 * np.sin(2 * np.pi * 1350 * tt) * np.exp(-tt / 0.006))
    out += hp(noise(len(t), seed), 3000) * np.exp(-t / 0.0015) * 0.5
    return out * 0.5


def click(freq=2600, seed=0, length=0.012):
    t = secs(length)
    # band-limited square (odd harmonics below 12 kHz): a naive sign() square overshoots after AAC
    sq = sum(np.sin(2 * np.pi * freq * k * t) / k for k in range(1, int(12000 / freq) + 1, 2)) * 4 / np.pi
    return (sq * 0.35 + bp(noise(len(t), seed), 2000, 12000) * 0.3) * np.exp(-t / (length / 4))


def bits(pattern, step, seed=0, lo=1800, hi=3400):
    """Binary clicks: one square blip per step, pitch by bit value, '.' = rest."""
    out = np.zeros(int((len(pattern) * step + 0.05) * SR))
    for i, c in enumerate(pattern):
        if c == ".":
            continue
        b = click(hi if c == "1" else lo, seed + i, 0.009)
        s = int(i * step * SR)
        out[s:s + len(b)] += b * 0.8
    return out


def snap(seed=0):
    """Data snap: bright transient + short pitched ping."""
    t = secs(0.08)
    return (bp(noise(len(t), seed), 4500, 12000) * np.exp(-t / 0.0022) * 1.2
            + np.sin(2 * np.pi * 2350 * t) * np.exp(-t / 0.012) * 0.45
            + np.sin(2 * np.pi * 180 * t) * np.exp(-t / 0.015) * 0.4)


def impact(seed=0, depth=1.0, length=0.9):
    """Key impact: pitched-down body, transient, filtered tail."""
    t = secs(length)
    f = 42 + 120 * np.exp(-t / 0.035)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.22 * depth))
    tr = hp(noise(len(t), seed), 1200) * np.exp(-t / 0.004) * 0.9
    tail = lp(noise(len(t), seed + 1), 900) * np.exp(-t / 0.09) * 0.35
    return np.tanh(1.4 * (body * 1.1 + tr + tail)) * 0.9


def pulse(freq=46, length=0.6, seed=0):
    """Low-frequency pulse: sub sine with soft attack and slight harmonic drive."""
    t = secs(length)
    env = np.minimum(1, t / 0.012) * np.exp(-t / (length / 3.2))
    return np.tanh(1.6 * np.sin(2 * np.pi * freq * t)) * env * 0.8


def hat(seed=0, length=0.05, open_=False):
    t = secs(length * (4 if open_ else 1))
    return hp(noise(len(t), seed), 7000) * np.exp(-t / (0.03 if open_ else 0.008)) * 0.35


def riser(length, seed=0, top=9000):
    """Noise riser with sweeping band and rising tone; ends exactly at its length."""
    t = secs(length)
    p = t / length
    n = noise(len(t), seed)
    seg = 256
    # sweeping one-pole lowpass, cutoff updated every 256 samples
    y = np.zeros_like(n)
    z = 0.0
    for i in range(0, len(t), seg):
        f = 250 * (top / 250) ** p[i]
        a = np.exp(-2 * np.pi * f / SR)
        blk, zi = lfilter([1 - a], [1, -a], n[i:i + seg], zi=[z])
        y[i:i + seg] = blk
        z = zi[0]
    y = hp(y, 150)
    tone = np.sin(2 * np.pi * np.cumsum(200 * 4 ** p) / SR) * 0.15
    return (y * 3 + tone) * p ** 2.2 * 0.8


def boom(seed=0, length=3.0):
    t = secs(length)
    f = 28 + 60 * np.exp(-t / 0.18)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.9)
    crack = hp(noise(len(t), seed), 800) * np.exp(-t / 0.012) * 0.8
    air = bp(noise(len(t), seed + 3), 200, 3000) * np.exp(-t / 0.5) * 0.18
    return np.tanh(1.3 * (body + crack + air)) * 0.95


def whoosh(length=0.5, seed=0):
    t = secs(length)
    p = t / length
    env = np.sin(np.pi * p) ** 2
    return bp(noise(len(t), seed), 600, 6000) * env * 0.5


def keypress(seed=0, kind="key"):
    """Mechanical keyboard switch: stem click, bottom-out thock with case resonance, then the
    softer key-up. kind: "key", "space" (longer, deeper), "enter" (firmer)."""
    r = np.random.default_rng(seed)
    t = secs(0.16)
    pitch = r.uniform(0.92, 1.08) * {"key": 1.0, "space": 0.72, "enter": 0.85}[kind]
    level = r.uniform(0.8, 1.0) * {"key": 1.0, "space": 1.15, "enter": 1.25}[kind]
    out = np.zeros_like(t)
    # stem click: tight bright transient
    out += bp(noise(len(t), seed), 2500 * pitch, 9000) * np.exp(-t / 0.0012) * 0.9
    # bottom-out 4-7 ms later: thock body plus a short plate ring
    d = int(r.uniform(0.004, 0.007) * SR)
    tt = t[: len(t) - d]
    thock = (np.sin(2 * np.pi * 210 * pitch * tt) * np.exp(-tt / 0.018) * 0.9
             + np.sin(2 * np.pi * 1150 * pitch * tt) * np.exp(-tt / 0.006) * 0.35
             + bp(noise(len(tt), seed + 1), 400, 3000) * np.exp(-tt / 0.004) * 0.6)
    out[d:] += thock
    # key-up 60-90 ms later, quieter and higher
    u = int(r.uniform(0.06, 0.09) * SR)
    tu = t[: len(t) - u]
    out[u:] += (bp(noise(len(tu), seed + 2), 3000, 8000) * np.exp(-tu / 0.001) * 0.35
                + np.sin(2 * np.pi * 320 * pitch * tu) * np.exp(-tu / 0.01) * 0.2)
    return out * level * 0.5


def pop(freq=880, seed=0, length=0.12):
    """UI pop: a short upward pitch blip with a soft body; tuned, so pops can play a scale."""
    t = secs(length)
    f = freq * (0.7 + 0.3 * (1 - np.exp(-t / 0.012)))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (length / 4))
    return (body + 0.35 * np.sin(4 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (length / 8))
            + hp(noise(len(t), seed), 5000) * np.exp(-t / 0.0015) * 0.3) * 0.6


def bell(freq=1318.5, length=2.0, seed=0):
    """Small bell: inharmonic partials (1, 2.76, 5.40, 8.93), each decaying on its own."""
    t = secs(length)
    out = np.zeros_like(t)
    for k, (ratio, amp, tau) in enumerate(((1, 1, 0.9), (2.76, 0.45, 0.45), (5.40, 0.25, 0.22), (8.93, 0.12, 0.12))):
        if freq * ratio > 9000:
            continue                                          # keep it sweet, not shrill
        out += amp * np.sin(2 * np.pi * freq * ratio * t + k) * np.exp(-t / (tau * length / 2))
    return out * np.minimum(1, t / 0.002) * 0.35


def swipe(length=0.45, seed=0, left_to_right=True, lo=350, hi=7000):
    """Stereo swipe: a bank of 12 steep noise bands whose envelopes peak one after another,
    low to high, while the image travels across the field. Clean, no hiss above `hi`. (n, 2)."""
    t = secs(length)
    p = t / length
    edges = np.geomspace(lo, hi, 13)
    y = np.zeros_like(t)
    for k in range(12):
        band = bp(noise(len(t), seed * 31 + k), edges[k], edges[k + 1], order=4)
        c = (k + 0.5) / 12                                  # when this band peaks
        env = np.exp(-((p - c * 0.8 - 0.1) / 0.16) ** 2)
        y += band * env * (1.0 - 0.35 * c)
    y *= np.sin(np.pi * p) ** 0.8 * 2.2
    pan = 0.15 + 0.7 * (p if left_to_right else 1 - p)
    return np.stack([y * np.cos(pan * np.pi / 2), y * np.sin(pan * np.pi / 2)], 1)


def shutter(seed=0):
    """Mechanical shutter: two metal clicks 40 ms apart with a short spring rattle."""
    t = secs(0.12)
    out = np.zeros_like(t)
    for off, g in ((0, 1.0), (0.04, 0.7)):
        k = int(off * SR)
        tt = t[: len(t) - k]
        out[k:] += g * (bp(noise(len(tt), seed + k), 2000, 9000) * np.exp(-tt / 0.002)
                        + np.sin(2 * np.pi * 2900 * tt) * np.exp(-tt / 0.004) * 0.4)
    return out * 0.6


def reverse(x):
    return x[::-1].copy()


# ---------------------------------------------------------------- mix

def reverb_ir(seconds=2.4, seed=7, damp=0.55):
    """Stereo room: decaying noise, high band dies faster, 18 ms predelay, a few early reflections."""
    t = secs(seconds)
    ir = []
    for ch in range(2):
        n = noise(len(t), seed + ch)
        lo = lp(n, 1200) * np.exp(-t * 6.9 / seconds)
        hi = hp(n, 1200) * np.exp(-t * 6.9 / (seconds * damp))
        x = lo + 0.6 * hi
        x = np.concatenate([np.zeros(int(0.018 * SR)), x])
        for d, g in ((0.011, 0.5), (0.019 + ch * 0.004, 0.35), (0.031, 0.25)):
            x[int(d * SR)] += g * 30 / np.sqrt(len(t))
        ir.append(x / np.sqrt(np.sum(x ** 2)))
    return ir


def k_weight(x):
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1, -1.99004745483398, 0.99007225036621]
    return lfilter(b2, a2, lfilter(b1, a1, x))


def lufs(st):
    """Integrated loudness, ITU-R BS.1770-4 gating."""
    z = [k_weight(c) ** 2 for c in st]
    blk, hop = int(0.4 * SR), int(0.1 * SR)
    ms = np.array([sum(c[i:i + blk].mean() for c in z) for i in range(0, len(z[0]) - blk, hop)])
    ld = -0.691 + 10 * np.log10(ms + 1e-12)
    g = ms[ld > -70]
    rel = -0.691 + 10 * np.log10(g.mean()) - 10
    g = ms[(ld > -70) & (ld > rel)]
    return -0.691 + 10 * np.log10(g.mean())


def limit(st, ceiling_db=-2.0, look=0.004, release=0.08):
    c = 10 ** (ceiling_db / 20)
    # true peak: 4x oversampled, max over each sample's four sub-samples
    tp = [np.abs(resample_poly(ch, 4, 1))[: 4 * len(ch)].reshape(-1, 4).max(1) for ch in st]
    peak = np.maximum(tp[0], tp[1])
    g = np.minimum(1, c / np.maximum(peak, 1e-9))
    n = int(look * SR)
    g = minimum_filter1d(g, 2 * n + 1)
    a = np.exp(-1 / (release * SR))
    sm = np.empty_like(g)
    z = 1.0
    # one-pole release, instant attack (attack handled by look-ahead min filter)
    for i in range(0, len(g), 4096):
        blk = g[i:i + 4096]
        out, _ = lfilter([1 - a], [1, -a], blk, zi=[z * a])
        out = np.minimum(out, blk)
        sm[i:i + 4096] = out
        z = out[-1]
    sm = minimum_filter1d(sm, n + 1)
    return [np.clip(ch * sm, -c, c) for ch in st]


def aac_true_peak(path):
    import subprocess
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".m4a") as f:
        subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", str(path), "-c:a", "aac", "-b:a", "256k", f.name], check=True)
        r = subprocess.run(["ffmpeg", "-hide_banner", "-i", f.name, "-af", "ebur128=peak=true", "-f", "null", "-"],
                           capture_output=True, text=True).stderr
    return float(r.rsplit("Peak:", 1)[1].split()[0])


class Mix:
    def __init__(self, duration):
        self.n = int(round(duration * SR))
        self.bus = {k: [np.zeros(self.n), np.zeros(self.n)] for k in ("piano", "fx", "dry")}
        self.send = {"piano": 0.34, "fx": 0.16, "dry": 0.0}

    def add(self, bus, time, sig, gain=1.0, pan=0.0):
        s = int(round(time * SR))
        if s >= self.n:
            return
        sig = np.asarray(sig, dtype=np.float64)
        if s < 0:
            sig, s = sig[-s:], 0
        sig = sig[: self.n - s]
        ramp = min(len(sig), int(0.0007 * SR))  # no vertical onsets: they overshoot after AAC
        sig = sig.copy()
        sig[:ramp] *= np.linspace(0, 1, ramp, endpoint=False)[:, None] if sig.ndim == 2 else np.linspace(0, 1, ramp, endpoint=False)
        gl, gr = np.cos((pan + 1) * np.pi / 4) * np.sqrt(2), np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
        left, right = (sig[:, 0], sig[:, 1]) if sig.ndim == 2 else (sig, sig)  # stereo sources keep their own image
        self.bus[bus][0][s:s + len(sig)] += left * gain * gl
        self.bus[bus][1][s:s + len(sig)] += right * gain * gr

    def note(self, time, m, vel, dur, pedal=False, gain=1.0):
        self.add("piano", time, piano(m, vel, dur, pedal), gain, piano_pan(m))

    def silence(self, a, b, fade=0.006):
        """Hard silence on the master between a and b (reverb tails included), 6 ms fades."""
        self.mute = getattr(self, "mute", []) + [(a, b, fade)]

    def render(self, path, target=-14.0):
        ir = reverb_ir()
        out = [np.zeros(self.n), np.zeros(self.n)]
        for k, (l, r) in self.bus.items():
            if k == "piano":
                l, r = lp(l, 11000), lp(r, 11000)
            out[0] += l
            out[1] += r
            if self.send[k]:
                wet = [fftconvolve(hp(ch, 180), ir[i])[: self.n] for i, ch in enumerate((l, r))]
                out[0] += wet[0] * self.send[k]
                out[1] += wet[1] * self.send[k]
        out = [lp(hp(ch, 24), 18000) for ch in out]
        # a full-scale hit on sample 0 overshoots in the AAC encoder's first frame: 30 ms lead-in
        lead = int(0.030 * SR)
        for ch in out:
            ch[:lead] *= np.sin(np.linspace(0, np.pi / 2, lead)) ** 2
        for a, b, fade in getattr(self, "mute", []):
            t = np.arange(self.n) / SR
            g = np.clip(np.maximum((a - t) / fade, (t - b) / fade), 0, 1)
            out = [ch * g for ch in out]
        ceiling = -2.0
        import os
        for _ in range(1 if os.environ.get("MIX_PROBE") else 4):
            g = 1.0
            for _ in range(6):
                g *= 10 ** ((target - lufs(limit([ch * g for ch in out], ceiling))) / 20)
            final = limit([ch * g for ch in out], ceiling)
            sf.write(path, np.stack(final, 1).astype(np.float32), SR, subtype="PCM_24")
            # the delivery is AAC: its overshoot on bright transients decides the real true peak
            tp = aac_true_peak(path)
            print(f"  ceiling {ceiling:.2f} -> AAC true peak {tp:.1f}")
            if tp <= -1.2:
                break
            ceiling -= tp + 1.2 + 0.15
        print(f"ceiling {ceiling:.2f} dBFS, true peak after AAC {tp:.1f} dBTP")
        return lufs(final)


def write_cues(path, bpm, events):
    json.dump({"bpm": bpm, "beat": 60 / bpm, "events": events}, open(path, "w"), indent=1)
