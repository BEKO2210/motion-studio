"""Measure the beat grid of films/<name>/audio.wav and write beats.json."""
import json
import sys
from pathlib import Path

import librosa

film = Path(sys.argv[1])
y, sr = librosa.load(film / "audio.wav", sr=None, mono=True)
tempo, frames = librosa.beat.beat_track(y=y, sr=sr)
beats = [round(float(t), 4) for t in librosa.frames_to_time(frames, sr=sr)]
out = {"bpm": round(float(tempo[0] if hasattr(tempo, "__len__") else tempo), 2), "beats": beats}
(film / "beats.json").write_text(json.dumps(out, indent=1))
print(f"{film / 'beats.json'}: {out['bpm']} bpm, {len(beats)} beats")
