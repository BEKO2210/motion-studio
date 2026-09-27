"""Per-frame spectrum of films/<name>/audio.wav for the on-screen waveform -> wave.json.
48 log-spaced bands (40 Hz - 14 kHz), 0..255 per band, plus peak level, packed as base64 uint8."""
import base64
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

film = Path(sys.argv[1])
fps = int(sys.argv[2]) if len(sys.argv) > 2 else 60
x, sr = sf.read(film / "audio.wav")
x = x.mean(1)
hop = sr // fps
win = 4096
n = int(np.ceil(len(x) / hop))
pad = np.pad(x, (win // 2, win))
edges = np.geomspace(40, 14000, 49)
freqs = np.fft.rfftfreq(win, 1 / sr)
idx = [np.where((freqs >= edges[i]) & (freqs < edges[i + 1]))[0] for i in range(48)]
w = np.hanning(win)
bands = np.zeros((n, 48))
peak = np.zeros(n)
for f in range(n):
    seg = pad[f * hop: f * hop + win] * w
    mag = np.abs(np.fft.rfft(seg))
    bands[f] = [mag[i].max() if len(i) else 0 for i in idx]
    peak[f] = np.abs(x[f * hop: (f + 1) * hop]).max(initial=0)
db = 20 * np.log10(bands + 1e-9)
db -= np.percentile(db, 99.5)
v = np.clip((db + 60) / 60, 0, 1)
pk = np.clip(peak / max(peak.max(), 1e-9), 0, 1)
data = np.concatenate([v, pk[:, None]], 1)
pack = base64.b64encode((data * 255).round().astype(np.uint8).tobytes()).decode()
(film / "wave.json").write_text(json.dumps({"fps": fps, "bands": 48, "frames": n, "data": pack}))
print(f"{film / 'wave.json'}: {n} frames")
