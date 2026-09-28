"""Workflow reel, 60 s, 9:16: music and sound design, both placed from cues.json.

Music: D minor, 120 bpm, Dm9 - Bbmaj9 - Fmaj7 - Cadd9, one chord per bar. Sampled grand piano
(Salamander, CC-BY 3.0), warm pad, sub bass, a tuned kick with the pad and bass ducking under it.
The arrangement follows the picture: piano stabs on the hook words, the drop on CODE., the groove
under the five steps, a breakdown on "Fertig.", the drop back for the call to action.
Sound design sits on top, sparse and tuned to D minor pentatonic. Stems: music and sfx."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib"))
from audio import *  # noqa: E402,F403
from instruments import clap, grand, hat, kick, pad, shaker, sub  # noqa: E402
from instruments import crash as _crash  # noqa: E402

here = Path(__file__).parent
cue = json.load(open(here / "cues.json"))
B = 60 / cue["bpm"]
b = lambda n: n * B  # noqa: E731
S, ev = cue["scenes"], cue["events"]
mx = Mix(60.0)
r = np.random.default_rng(11)
# mix knobs, overridable for A/B runs: MIX='{"crash": 0.5, "hat": 0.8}'
import os  # noqa: E402
K = {"crash": 1.0, "hat": 1.0, "pad": 0.25, "kick": 0.6, "bass": 1.0, "piano": 1.0, "arp": 1.0, "clap": 1.0, "sfx": 1.0,
     "send_piano": 0.34, "send_pad": 0.3, "send_perc": 0.12, "tone": 9000, **json.loads(os.environ.get("MIX", "{}"))}
mx.send.update({"piano": K["send_piano"], "pad": K["send_pad"], "perc": K["send_perc"]})
_add = mx.add
GAIN = {"drums": "kick", "bass": "bass", "pad": "pad", "sfx": "sfx"}
def add(bus, time, sig, gain=1.0, pan=0.0, kind=None):  # noqa: E302
    k = kind or GAIN.get(bus)
    _add(bus, time, sig, gain * (K[k] if k else 1.0), pan)
mx.add = add
crash = lambda seed, length=2.2: _crash(seed, length, K['tone'])  # noqa: E731

# ---------------------------------------------------------------- harmony
#            bass  left hand     right hand
CHORDS = [(38, (50, 57), (65, 69, 72, 76)),      # Dm9
          (34, (46, 53), (62, 65, 69, 72)),      # Bbmaj9
          (41, (53, 60), (64, 69, 72, 76)),      # Fmaj7
          (36, (48, 55), (62, 64, 67, 72))]      # Cadd9
chord = lambda beat: CHORDS[int(beat // 4) % 4]  # noqa: E731
PENTA = [62, 65, 67, 69, 72, 74, 77, 79, 81, 84, 86]  # D minor pentatonic for tuned sound design


def piano_chord(t, ch, vel, dur, pedal=True, rh=True, spread=0.012):
    _, lh, rhn = ch
    for i, m in enumerate(lh):
        mx.add("piano", t + i * spread, grand(m, vel * 0.9, dur, pedal), 0.8, -0.25, kind="piano")
    if rh:
        for i, m in enumerate(rhn):
            mx.add("piano", t + (i + 2) * spread, grand(m, vel, dur, pedal), 0.7, 0.05 + 0.08 * i, kind="piano")


# ---------------------------------------------------------------- hook: stabs on the words, the drop on CODE.
for i, n in enumerate(ev["hookWords"]):
    piano_chord(b(n), CHORDS[0], 0.62 + 0.08 * i, 0.35, pedal=False)
    mx.add("drums", b(n), kick(i, 43.7, 0.5), 0.8)
    mx.add("bass", b(n), sub(38, 0.35), 0.7)
mx.add("perc", b(ev["hookCode"]) - 1.0, crash(1, 1.0)[::-1].copy(), 0.55, kind="crash")       # reverse swell into the drop
mx.add("drums", b(ev["hookCode"]), kick(5, 41.2, 0.8, 1.2), 1.0)
mx.add("perc", b(ev["hookCode"]), crash(2, 2.4), 0.45, kind="crash")
mx.add("bass", b(ev["hookCode"]), sub(26, 3.2), 0.9)
piano_chord(b(ev["hookCode"]), CHORDS[0], 0.8, 3.0)
mx.add("pad", b(ev["hookCode"]), pad((50, 57, 60, 64, 69), b(S["claim"]) - b(ev["hookCode"]), 3, bright=1400), 0.9)
for k, m in enumerate((69, 72, 76, 74, 72, 69)):                                  # a quiet motif over the read
    mx.add("piano", b(ev["hookRead"] + 1 + k * 0.75), grand(m, 0.36, 0.7, True), 0.55, 0.2)
mx.add("perc", b(S["claim"]) - 2.0, crash(4, 2.0)[::-1].copy(), 0.35, kind="crash")

# ---------------------------------------------------------------- groove from the claim to the result
kicks = []
for bar_beat in range(int(S["claim"]), int(S["result"]), 1):
    beat = float(bar_beat)
    ch = chord(beat)
    in_bar = int(beat) % 4
    # one beat of air before every step title: no kick, a swell instead
    breath = any(abs(beat - (tb - 1)) < 1e-6 for tb in ev["titles"])
    if not breath:
        mx.add("drums", b(beat), kick(int(beat), 43.7, 0.42), 0.85)
        kicks.append(b(beat))
    if in_bar in (1, 3) and beat >= S["s1"]:
        mx.add("drums", b(beat), clap(int(beat)), 0.5, -0.05, kind="clap")
    for q in (0.25, 0.5, 0.75):                                                  # hats: offbeat accents
        vel = 1.0 if q == 0.5 else 0.45
        mx.add("perc", b(beat + q) + r.normal(0, 0.003), hat(int(beat * 4 + q * 4), False, vel), 0.55, 0.25, kind="hat")
    if beat >= S["s3"] and in_bar == 3:
        mx.add("perc", b(beat + 0.5), hat(int(beat), True, 0.7), 0.4, 0.3, kind="hat")
    if beat >= S["s4"]:
        mx.add("perc", b(beat + 0.25), shaker(int(beat), 0.8), 0.5, -0.3)
    # bass: root on the beat, octave pickup on the last eighth of the bar
    root = ch[0]
    mx.add("bass", b(beat), sub(root, 0.42), 0.75)
    if in_bar == 3:
        mx.add("bass", b(beat + 0.5), sub(root + 12, 0.2, 0.6), 0.6)
    if in_bar == 0:
        piano_chord(b(beat), ch, 0.5, b(3.8), rh=True)
        mx.add("pad", b(beat), pad(ch[1] + ch[2][:2], b(4) - 0.05, int(beat), bright=1500, attack=0.3, release=0.8), 0.55)
    # a soft eighth-note arpeggio in the right hand, a little quieter each off-beat
    arp = ch[2]
    for e in range(2):
        m = arp[(int(beat) * 2 + e) % len(arp)] + 12
        mx.add("piano", b(beat + e * 0.5) + 0.004, grand(m, 0.32 if e else 0.38, 0.4), 0.45, 0.3, kind="arp")
mx.duck(("pad", "bass"), kicks, depth_db=6.0, release=0.14)
mx.duck(("piano",), kicks, depth_db=1.5, release=0.12)

# step titles: a swell into each, a crash on it
for n in ev["titles"]:
    mx.add("perc", b(n) - 0.5, crash(int(n), 0.5)[::-1].copy(), 0.35, kind="crash")
    mx.add("perc", b(n), crash(int(n) + 50, 1.6), 0.28, kind="crash")

# ---------------------------------------------------------------- breakdown on "Fertig.", drop back for the call to action
for i, n in enumerate((S["result"], S["result"] + 4, S["result"] + 8)):
    ch = CHORDS[i % 4]
    piano_chord(b(n), ch, 0.55, b(3.9))
    mx.add("pad", b(n), pad(ch[1] + ch[2][:2], b(4), 60 + i, bright=1100, attack=0.8), 0.7)
mx.add("perc", b(S["cta"]) - 1.5, crash(70, 1.5)[::-1].copy(), 0.4, kind="crash")
for bar_beat in range(int(S["cta"]), int(S["cta"]) + 8):
    beat = float(bar_beat)
    ch = chord(beat)
    mx.add("drums", b(beat), kick(200 + int(beat), 43.7, 0.42), 0.85)
    kicks.append(b(beat))
    if int(beat) % 4 in (1, 3):
        mx.add("drums", b(beat), clap(int(beat)), 0.5, kind="clap")
    mx.add("perc", b(beat + 0.5), hat(int(beat), False, 1.0), 0.55, 0.25, kind="hat")
    mx.add("bass", b(beat), sub(ch[0], 0.42), 0.75)
    if int(beat) % 4 == 0:
        piano_chord(b(beat), ch, 0.55, b(3.8))
mx.add("perc", b(S["cta"]), crash(71, 2.2), 0.4, kind="crash")
end = S["cta"] + 8
piano_chord(b(end), CHORDS[0], 0.6, 60 - b(end) - 0.3)                         # the last chord rings out
mx.add("pad", b(end), pad((50, 57, 60, 64, 69), 60 - b(end) - 1.2, 90, bright=1200, attack=0.5, release=1.0), 0.7)
mx.add("bass", b(end), sub(26, 3.0), 0.8)
mx.add("piano", b(end + 2), grand(81, 0.4, 3.0, True), 0.6, 0.25)
mx.duck(("pad", "bass"), kicks[-8:], depth_db=6.0, release=0.14)

# ---------------------------------------------------------------- sound design: sparse, soft, tuned
for k, c in enumerate(cue["typing"]):
    chars = c["text"].replace("\n", "")
    t0 = b(c["at"])
    for i, ch in enumerate(chars):
        mx.add("sfx", t0 + i / c["cps"], lp(keypress(k * 997 + i, "space" if ch == " " else "key"), 7000), 0.22, float(np.sin(i * 1.7) * 0.1))
    mx.add("sfx", t0 + len(chars) / c["cps"] + 0.15, lp(keypress(k * 997 + 500, "enter"), 6000), 0.3, 0.1)
for i, n in enumerate(ev["claim"]):
    mx.add("sfx", b(n) - 0.2, swipe(0.4, 40 + i, i == 0, 300, 4500), 0.3)
for i, n in enumerate(ev["titles"]):
    mx.add("sfx", b(n) - 0.28, swipe(0.45, 50 + i, i % 2 == 0, 300, 4500), 0.35)
for i, n in enumerate(ev["chips"]):
    mx.add("sfx", b(n), pop(mtof(PENTA[4 + i]), 70 + i), 0.3, [-0.3, 0, 0.3][i])
for i, n in enumerate(ev["select"]):
    mx.add("sfx", b(n), lp(keypress(80 + i, "key"), 5000), 0.3)
mx.add("sfx", b(ev["confirm"]), pop(mtof(PENTA[7]), 85), 0.32)
for i, n in enumerate(ev["rules"]):
    mx.add("sfx", b(n), pop(mtof(PENTA[3 + i]), 90 + i), 0.3, -0.2 + 0.13 * i)
mx.add("sfx", b(ev["sheetIn"]), lp(shutter(96), 6000), 0.4)
for i, n in enumerate(ev["scores"]):
    mx.add("sfx", b(n), pop(mtof(PENTA[6 + i]), 100 + i, 0.09), 0.26)
mx.add("sfx", b(ev["done"]), bell(mtof(81), 2.4), 0.45)                          # A5
mx.add("sfx", b(ev["done"]) + 0.12, bell(mtof(86), 2.0), 0.28)                   # D6
mx.add("sfx", b(ev["ctaUrlDone"]), bell(mtof(86), 2.6), 0.4)
mx.add("sfx", b(ev["ctaUrlDone"]) + 0.14, bell(mtof(93), 2.2), 0.2)

MUSIC = ["piano", "pad", "bass", "drums", "perc"]
OUT = Path(os.environ.get("OUT", here / "audio.wav"))
print("LUFS", round(mx.render(OUT, stems={"music": MUSIC, "sfx": ["sfx"]}), 2))
