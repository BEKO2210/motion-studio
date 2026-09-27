"""Example score: 120 bpm, a tick on every beat, an impact where the read lands."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib"))
from audio import *  # noqa: E402,F403

B = 0.5
here = Path(__file__).parent
mx = Mix(4.0)
for n in range(8):
    mx.add("fx", n * B, tick(n), 0.4)
mx.add("dry", 1 * B, impact(1), 0.9)
mx.add("fx", 3 * B, snap(2), 0.7)
mx.note(1 * B, 62, 0.6, 2.0, pedal=True)
print("LUFS", round(mx.render(here / "audio.wav"), 2))
write_cues(here / "cues.json", 120, [])
