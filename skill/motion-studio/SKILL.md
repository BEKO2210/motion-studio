---
name: motion-studio
description: >
  Make a finished motion-design video with motion-studio: code-drawn picture (canvas, kinetic type,
  data choreography, procedural geometry) and synthesized sound, reviewed on contact sheets until every
  score is 8+, rendered as H.264 1080p60 with motion blur in 16:9 and/or 9:16, then delivered. Use when
  the user types /motion-studio, or asks for a reel, Instagram/TikTok reel, showreel, intro, explainer
  animation, kinetic typography, animated logo or any motion graphic built in code – also in German:
  Reel, Intro-Video, Erklärvideo, Motion-Grafik, animiertes Video, Showreel. Not for product videos cut
  from website screenshots or recordings (that is video-shotcraft).
allowed-tools: Bash, Read, Write, Edit, AskUserQuestion, SendUserFile
---

# /motion-studio

You are the director, the motion designer and the sound designer. The studio is code; you write the
film, look at it, judge it honestly and only then render it.

## 0. Studio and prerequisites

Resolve the absolute path once and put `cd <abs> &&` in front of **every** later command – the shell
does not keep `cd` or variables between calls.

```bash
STUDIO=$(realpath "${MOTION_STUDIO:-$HOME/motion-studio}"); echo "$STUDIO"
command -v ffmpeg ffprobe node python3 || echo "MISSING TOOLS"
node -e 'process.exit(+process.versions.node.split(".")[0] < 22)' || echo "NODE < 22"
test -f "$STUDIO/render.mjs" || git clone https://github.com/BEKO2210/motion-studio "$STUDIO"
cd "$STUDIO" && git pull --ff-only 2>/dev/null
test -d node_modules || { npm install && npx playwright install chromium; }
test -x .venv/bin/python || { python3 -m venv .venv && .venv/bin/pip install -r requirements.txt; }
cat CLAUDE.md
```

Missing ffmpeg or Node < 22: tell the user the install command (`brew install node ffmpeg python` /
`sudo apt install nodejs npm ffmpeg python3 python3-venv`) and stop. `CLAUDE.md` holds the rules;
read it every time, it wins over anything below.

## 1. Brief

Take what the user already said. Ask **once** (one AskUserQuestion, max four questions) only for what
is missing:

| Needed | Default if the user does not care |
|---|---|
| Topic and the one thing the viewer must remember | – (always required) |
| Format | 9:16 for Reels/TikTok/Shorts, 16:9 otherwise, both (`--both`) when asked |
| Length | 30 s |
| Colours | two hex values or a combo.it-handwerk-stuttgart.de link (`--combo`), `--invert` for a light ground |
| Style | `tech` · `grotesk` · `editorial` · `terminal` (`--style`) |
| Sound | full score (-14 LUFS), sound design only for the user's own music (-18 LUFS), or a supplied track |
| Language | the user's language |

Every film gets its own combo and style from the brief. Never reuse the last film's look by default.

## 2. Beat map – in the conversation, no files yet

Pick a tempo where a beat is a whole number of frames (120 bpm = 30 frames, 150 bpm = 24) and write
the beat map as a short table: scene, start beat, the one read, the visual technique, the sound.

- Hook in the first 2 s. Something new every 2–4 s.
- One read per scene, at most 6 words, held for max(1.2 s, 0.3 s per word + 0.5 s).
- Safe margin 120 px (16:9) / 90 px (9:16). Instagram 9:16: every read inside x 90..920, y 250..1500.
- Lines never cross text. End on the call to action or the identity, held long enough to read.

## 3. Scaffold, then the timeline

```bash
cd <abs> && npm run new -- <name> [--9x16 | --both] --seconds <n> --bpm <n> --combo <A-B> [--invert] --style <style>
```

`--both` creates `films/<name>` (responsive: `V`, `W`, `H`, `M` already branch on the format) and
`films/<name>-9x16` with relative symlinks to the sound files. Re-layout for 9:16, never crop.

Only now write `films/<name>/cues.json` from the beat map (scenes, typed lines, events in beats), and
make `film.js` and `score.py` both read it – see `films/reel-workflow` (`cue = json.load(...)` in the
score, `await fetch('cues.json')` in the film). Nothing may write cues.json automatically.

## 4. Sound

| Case | What to do |
|---|---|
| Full score | `score.py` with `Mix`, `piano()` and sound design; `mx.render(path)` → -14 LUFS |
| Sound design only | same, but `mx.render(path, target=-18)` and **always** render with `--lufs -18` |
| Supplied track | put it at `films/<name>/audio.wav` (48 kHz); delete `score.py` or keep it for SFX mixed onto the track |

Sound design set: `keypress`, `pop`, `swipe`, `bell`, `shutter`, `tick`, `click`, `bits`, `snap`,
`impact`, `pulse`, `riser`, `whoosh`, `boom`. Every visual hit gets a sound on the same beat. Keep the
quiet clock tick from the template (lower it if needed) so the beat grid can be measured.

```bash
cd <abs> && npm run build -- <name> --sheet      # score -> analyze -> beats -> contact sheet, one command
```

For music, use the sampled grand (`from instruments import grand, pad, sub, kick, clap, hat, crash`;
run `tools/fetch-samples.sh` once) and duck pad and bass under the kick (`mx.duck`). Ask `mx.render(...,
stems={"music": [...], "sfx": ["sfx"]})` for separate stems.

You cannot hear. Check sound with numbers: `.venv/bin/python lib/aesthetics.py films/<name>/audio.wav`
(needs `pip install -r requirements-quality.txt`; aim for CE ≥ 7.5 and PQ ≥ 8.0, A/B mix knobs and keep
the winner), loudness and true peak (printed at render), measured beats within one frame of the plan,
and a spectrogram – no noise walls, no shrill partials, hits where planned:

```bash
cd <abs> && ffmpeg -y -loglevel error -i films/<name>/audio.wav -lavfi showspectrumpic=s=1400x500:legend=1 films/<name>/spec.png
```

## 5. The loop – before the user sees anything

1. Read every `films/<name>/sheet-NN.png` (one frame per beat).
2. For transitions: `node render.mjs films/<name> --at 0.1,1:3:0.25` → read `strip-NN.png`
   (strips never delete the beat sheet).
3. With `--both`, do 1–2 for `films/<name>-9x16` too and score each format on its own.
4. Score 1–10: hook, readability at phone size **including reading time**, motion (ghosting, stutter),
   variety, brand (combo and style exact), sync. Fix the three worst, repeat until every score is 8+.

Check every round:
- text crossed by a line or a moving element → route around it or `text(..., { halo })`
- anything outside the safe area, a stray glyph, a label on top of another
- numbers changing under motion blur → read the frame (`Math.floor(t * fps) / fps`), not `t`
- fonts: `film()` fails loudly on a missing face – never accept a fallback

## 6. Render and verify

```bash
cd <abs> && node render.mjs films/<name> [--lufs -18]        # and films/<name>-9x16 with the same flag
cd <abs> && ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,duration -of csv=p=0 films/<name>/out.mp4
```

Busy or grainy scenes capture slowly: add `--jobs 4`. Loudness on target ±0.2 LU, true peak ≤ -1.2 dBTP.
Optional: `--gif 960` for a loop, `--at 2.5 --png`
for a thumbnail.

## 7. Deliver

Send every finished file with SendUserFile right away (the video; for sound design only also
`audio.wav` as the stem). Without SendUserFile, print the absolute paths. Report in short points:
format, length, loudness, the final scores, and honestly what is illustrative (made-up example numbers)
or unverified (you cannot hear the mix).
