"""Workflow reel, 60 s, 9:16. Sound design only (the music is added later): every key press,
every reveal and every cut is placed from cues.json, the same timeline the picture reads.
Delivered at -18 LUFS so there is room for a music bed."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "lib"))
from audio import *  # noqa: E402,F403

here = Path(__file__).parent
cue = json.load(open(here / "cues.json"))
B = 60 / cue["bpm"]
b = lambda n: n * B  # noqa: E731
ev = cue["events"]
mx = Mix(60.0)

# ---------------------------------------------------------------- typing: one switch per character
for k, c in enumerate(cue["typing"]):
    chars = c["text"].replace("\n", "")
    t0 = b(c["at"])
    for i, ch in enumerate(chars):
        kind = "space" if ch == " " else "key"
        mx.add("fx", t0 + i / c["cps"], keypress(k * 997 + i, kind), 0.55, float(np.sin(i * 1.7) * 0.12))
    mx.add("fx", t0 + len(chars) / c["cps"] + 0.15, keypress(k * 997 + 500, "enter"), 0.7, 0.1)

# ---------------------------------------------------------------- hook: three words slam, CODE lands inverted
for i, n in enumerate(ev["hookWords"]):
    mx.add("dry", b(n), impact(10 + i, depth=0.9, length=0.5), 0.8)
    mx.add("dry", b(n), pulse(41 + 4 * i, 0.4), 0.6)
    mx.add("fx", b(n) - 0.12, swipe(0.16, 20 + i, i % 2 == 0), 0.35)
n = ev["hookCode"]
mx.add("fx", b(n) - 0.35, reverse(whoosh(0.35, 30)), 0.6)
mx.add("dry", b(n), boom(31, 2.5), 0.9)
mx.add("fx", b(n), shutter(32), 0.7)
mx.add("fx", b(n) + 0.02, bits("1101101", B / 16, 33, 1600, 4200), 0.35)
mx.add("fx", b(ev["hookRead"]), pop(660, 34), 0.5)

# ---------------------------------------------------------------- claim
for i, n in enumerate(ev["claim"]):
    mx.add("fx", b(n) - 0.2, swipe(0.4, 40 + i, i == 0), 0.55)
    mx.add("fx", b(n), pop([587, 880][i], 42 + i), 0.55)

# ---------------------------------------------------------------- step titles: a swipe and a low thump, direction alternates
for i, n in enumerate(ev["titles"]):
    mx.add("fx", b(n) - 0.25, swipe(0.45, 50 + i, i % 2 == 0), 0.7)
    mx.add("dry", b(n), impact(55 + i, depth=0.6, length=0.4), 0.55)
    mx.add("fx", b(n) + 0.05, pop(1175, 60 + i, 0.08), 0.35)

# ---------------------------------------------------------------- UI moments
for i, n in enumerate(ev["chips"]):
    mx.add("fx", b(n), pop([784, 988, 1175][i], 70 + i), 0.55, [-0.3, 0, 0.3][i])
for i, n in enumerate(ev["select"]):
    mx.add("fx", b(n), click(3200 + 200 * i, 80 + i, 0.01), 0.4)
mx.add("fx", b(ev["confirm"]), pop(1318, 85), 0.6)
mx.add("fx", b(ev["confirm"]), keypress(86, "enter"), 0.5)
mx.add("fx", b(ev["reads"]), pop(523, 87, 0.1), 0.4)
for i, n in enumerate(ev["rules"]):
    mx.add("fx", b(n), pop([659, 784, 988, 1175][i], 90 + i), 0.55, -0.2 + 0.13 * i)
mx.add("fx", b(ev["sheetIn"]) - 0.2, swipe(0.35, 95, True), 0.55)
mx.add("fx", b(ev["sheetIn"]), shutter(96), 0.7)
for i, n in enumerate(ev["scores"]):
    mx.add("fx", b(n), pop([1047, 1319, 1568][i], 100 + i, 0.09), 0.5)
# render progress: ticks that speed up, a riser underneath, the bell when it is done
p0, p1 = (b(x) for x in ev["progress"])
for k in range(24):
    mx.add("fx", p0 + (p1 - p0) * (k / 24) ** 0.8, tick(110 + k, 1.0 + 0.02 * k), 0.3)
mx.add("fx", p0, riser(p1 - p0, 111, 6000), 0.35)
mx.add("fx", b(ev["done"]), bell(1318.5, 2.4), 0.8)
mx.add("fx", b(ev["done"]) + 0.12, bell(1975.5, 2.0), 0.45)
mx.add("dry", b(ev["done"]), pulse(55, 0.5), 0.5)

# ---------------------------------------------------------------- result and call to action
mx.add("fx", b(ev["result"]) - 0.25, swipe(0.5, 120, False), 0.6)
mx.add("dry", b(ev["result"]), impact(121, depth=1.0), 0.6)
mx.add("fx", b(ev["cta"]) - 0.3, reverse(whoosh(0.3, 130)), 0.6)
mx.add("dry", b(ev["cta"]), impact(131, depth=1.2), 0.75)
mx.add("fx", b(ev["ctaUrlDone"]), bell(1568, 2.6), 0.7)
mx.add("fx", b(ev["ctaUrlDone"]) + 0.1, pop(2093, 132, 0.1), 0.4)

print("LUFS", round(mx.render(here / "audio.wav", target=-18.0), 2))
