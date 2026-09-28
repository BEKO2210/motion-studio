"""Measure the beat grid of films/<name>/audio.wav and write beats.json.

When the score wrote a music stem (audio-music.wav), the grid is measured on it: a voice-over and
off-grid sound design make the tracker drift. The planned tempo from cues.json, if any, seeds it."""
import json
import sys
from pathlib import Path

import librosa

film = Path(sys.argv[1])
src = film / "audio-music.wav" if (film / "audio-music.wav").exists() else film / "audio.wav"
cues = film / "cues.json"
bpm = json.loads(cues.read_text()).get("bpm") if cues.exists() else None
y, sr = librosa.load(src, sr=None, mono=True)
kw = {"start_bpm": bpm, "tightness": 300, "trim": False} if bpm else {}
tempo, frames = librosa.beat.beat_track(y=y, sr=sr, **kw)
beats = [round(float(t), 4) for t in librosa.frames_to_time(frames, sr=sr)]
out = {"bpm": round(float(tempo[0] if hasattr(tempo, "__len__") else tempo), 2), "beats": beats}
(film / "beats.json").write_text(json.dumps(out, indent=1))
print(f"{film / 'beats.json'}: {out['bpm']} bpm, {len(beats)} beats (measured on {src.name})")
