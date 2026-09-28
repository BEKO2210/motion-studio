"""Production instruments: a sampled grand piano, a warm pad, sub bass and a drum kit.

The piano plays the Salamander Grand Piano V3 (Alexander Holm, CC-BY 3.0) when its samples are
installed (tools/fetch-samples.sh, or MOTION_STUDIO_SAMPLES); otherwise it falls back to the
synthesized piano in audio.py, so every film still renders. Everything returns float arrays at SR;
stereo sources are shaped (n, 2)."""
import os
import re
from fractions import Fraction
from functools import lru_cache
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

from audio import SR, bp, hp, lp, noise, piano as synth_piano, secs

SAMPLES = Path(os.environ.get("MOTION_STUDIO_SAMPLES", Path.home() / ".cache/motion-studio/samples"))
SALAMANDER = SAMPLES / "SalamanderGrandPianoV3_48khz24bit"


# ---------------------------------------------------------------- sampled grand piano
@lru_cache(maxsize=1)
def _regions():
    sfz = SALAMANDER / "SalamanderGrandPianoV3.sfz"
    if not sfz.exists():
        return None
    out = []
    for line in sfz.read_text(errors="ignore").splitlines():
        if not line.startswith("<region>") or "lokey" not in line:
            continue
        kv = dict(re.findall(r"(\w+)=(\S+)", line))
        f = kv["sample"].replace("\\", "/")
        if "trigger" in kv or not re.search(r"/[A-G]#?\d+v\d+\.wav$", f):
            continue                                  # note samples only; release/pedal/resonance regions are separate
        out.append({"file": f, "lo": int(kv["lokey"]), "hi": int(kv["hikey"]), "lv": int(kv.get("lovel", 1)),
                    "hv": int(kv.get("hivel", 127)), "key": int(kv.get("pitch_keycenter", 60))})  # SFZ default key: 60
    return out


@lru_cache(maxsize=512)
def _sample(name):
    x, sr = sf.read(SALAMANDER / name, dtype="float32", always_2d=True)
    assert sr == SR, f"{name}: {sr} Hz"
    return x


def has_grand():
    return _regions() is not None


@lru_cache(maxsize=4096)
def _grand(m, vel, dur, pedal):
    regs = _regions()
    v = int(np.clip(round(vel * 127), 1, 127))
    reg = next(r for r in regs if r["lo"] <= m <= r["hi"] and r["lv"] <= v <= r["hv"])
    x = _sample(reg["file"])
    rel = 2.4 if pedal else 0.55
    need = int((dur + rel + 0.05) * SR)
    semis = m - reg["key"]
    if semis:
        # pitch by resampling: play the sample 2^(semis/12) faster
        f = Fraction(2 ** (-semis / 12)).limit_denominator(400)
        x = resample_poly(x[: int(need / f) + 64], f.numerator, f.denominator, axis=0)
    x = x[:need].copy()
    t = np.arange(len(x)) / SR
    env = np.ones(len(x), dtype=np.float32)
    k = t > dur
    env[k] = np.exp(-(t[k] - dur) / (rel / 4.5))  # damper
    x *= env[:, None]
    # the damper lands: the recorded key-release noise of this very key
    rn = SALAMANDER / "48khz24bit" / f"rel{m - 20}.wav"
    if rn.exists() and not pedal:
        r = _sample(f"48khz24bit/rel{m - 20}.wav")
        s = int(dur * SR)
        if s < len(x):
            n = min(len(r), len(x) - s)
            x[s:s + n] += r[:n] * 0.12 * vel
    return x * (0.55 + 0.45 * vel)  # sample layers already carry the dynamics; keep a gentle extra curve


def grand(m, vel=0.7, dur=1.0, pedal=False):
    """Stereo (n, 2) grand piano note; synthesized fallback when the samples are missing."""
    if not has_grand():
        mono = synth_piano(m, vel, dur, pedal)
        return np.stack([mono, mono], 1)
    return _grand(int(m), round(float(vel), 2), round(float(dur), 3), bool(pedal))


# ---------------------------------------------------------------- warm pad
def _saw(f, t, phase=0.0):
    """Band-limited sawtooth (polyBLEP)."""
    dt = f / SR
    p = (phase + f * t) % 1.0
    y = 2 * p - 1
    a = p < dt
    y[a] -= (p[a] / dt) * 2 - (p[a] / dt) ** 2 - 1
    b = p > 1 - dt
    q = (p[b] - 1) / dt
    y[b] -= q * q + 2 * q + 1
    return y


def pad(notes, dur, seed=0, bright=1600, attack=0.6, release=1.4, width=0.8):
    """Warm supersaw pad: 5 detuned voices per note, low-passed, slow swell, wide. (n, 2)"""
    r = np.random.default_rng(seed)
    t = secs(dur + release)
    L = np.zeros_like(t); R = np.zeros_like(t)
    for m in notes:
        f0 = 440 * 2 ** ((m - 69) / 12)
        for k, det in enumerate((-11, -5, 0, 6, 12)):
            y = _saw(f0 * 2 ** (det / 1200), t, r.uniform())
            pan = 0.5 + width * 0.5 * (k - 2) / 2
            L += y * np.cos(pan * np.pi / 2); R += y * np.sin(pan * np.pi / 2)
    env = np.minimum(1, t / attack) * np.where(t > dur, np.exp(-(t - dur) / (release / 4)), 1.0)
    L = lp(lp(L, bright), bright * 1.3) * env; R = lp(lp(R, bright), bright * 1.3) * env
    g = 0.22 / max(1, len(notes)) ** 0.5
    return np.stack([L, R], 1) * g


# ---------------------------------------------------------------- bass
def sub(m, dur, vel=0.8):
    """Sub bass: sine plus a little second harmonic, softly saturated so it reads on phones."""
    f = 440 * 2 ** ((m - 69) / 12)
    t = secs(dur + 0.08)
    y = np.sin(2 * np.pi * f * t) + 0.18 * np.sin(4 * np.pi * f * t + 0.3)
    env = np.minimum(1, t / 0.006) * np.where(t > dur, np.exp(-(t - dur) / 0.02), 1.0)
    return np.tanh(1.4 * y) * env * 0.55 * vel


# ---------------------------------------------------------------- drums
def kick(seed=0, tune=46.0, length=0.45, punch=1.0):
    """Tuned kick: sine body with a fast pitch drop, a short beater click, gentle saturation."""
    t = secs(length)
    f = tune + tune * 2.4 * np.exp(-t / 0.028)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (length / 3.3))
    click = bp(noise(len(t), seed), 1500, 6000) * np.exp(-t / 0.0018) * 0.35 * punch
    return np.tanh(1.5 * (body + click)) * 0.9


def clap(seed=0):
    """Clap: three quick hand hits and a short tail, band-passed like a real room clap."""
    t = secs(0.35)
    out = np.zeros_like(t)
    for i, off in enumerate((0, 0.009, 0.018)):
        s = int(off * SR)
        tt = t[: len(t) - s]
        out[s:] += bp(noise(len(tt), seed + i), 900, 3200) * np.exp(-tt / 0.006) * (0.7 + 0.15 * i)
    out += bp(noise(len(t), seed + 9), 1000, 4500) * np.exp(-t / 0.07) * 0.35
    return out * 0.8


def hat(seed=0, open_=False, vel=1.0):
    """Metallic hat: six detuned square partials (the classic 808 recipe), band-passed high."""
    t = secs(0.5 if open_ else 0.12)
    y = sum(np.sign(np.sin(2 * np.pi * f * t + k)) for k, f in enumerate((205.3, 304.4, 369.6, 522.7, 540.0, 800.0)))
    y = bp(hp(y, 7000), 7000, 14000, order=2)
    env = np.exp(-t / (0.16 if open_ else 0.022))
    return y * env * 0.12 * vel


def shaker(seed=0, vel=1.0):
    t = secs(0.09)
    env = np.minimum(1, t / 0.012) * np.exp(-t / 0.03)
    return bp(noise(len(t), seed), 5000, 11000) * env * 0.25 * vel


def crash(seed=0, length=2.2, tone=9000):
    """Crash cymbal: inharmonic metal partials plus a noise wash, long decay, rolled off above `tone`
    so it shimmers instead of hissing. Reverse it for swells."""
    t = secs(length)
    r = np.random.default_rng(seed)
    metal = sum(np.sin(2 * np.pi * f * t + r.uniform(0, 6.28)) for f in r.uniform(2500, 9000, 24))
    wash = bp(noise(len(t), seed), 2500, tone)
    env = np.exp(-t / (length / 4)) * np.minimum(1, t / 0.002)
    return lp(bp(metal, 2500, tone) * 0.05 + wash * 0.5, tone, order=4) * env * 0.5
