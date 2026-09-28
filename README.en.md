<p align="center">
  <img src="docs/media/hero.gif" width="100%" alt="The motion-studio logo, a running frame counter, a motion curve and a waveform with a playhead, as a seamless loop">
</p>

<p align="center">
  <a href="https://github.com/BEKO2210/motion-studio/actions/workflows/render.yml"><img alt="render" src="https://github.com/BEKO2210/motion-studio/actions/workflows/render.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT" src="https://img.shields.io/badge/license-MIT-D3F425?labelColor=191B15"></a>
  <a href="README.md"><img alt="Deutsch" src="https://img.shields.io/badge/lang-Deutsch-D3F425?labelColor=191B15"></a>
</p>

**Motion design films with Claude Code.** Picture, type and sound are made entirely in code: every frame
is a function of time, the score and the sound design are synthesized, and the renderer delivers H.264
at 1080p, 60 fps, with real motion blur. Claude builds the film, looks at a contact sheet, scores it,
fixes the three worst problems – and only then renders.

Every image on this page was rendered with this repo.

## Made with motion-studio

The Instagram reel that explains this repo – built entirely with this repo: picture, type, music (sampled
grand, pad, bass, drums) and every key press in the sound. [▶ Watch the whole reel](https://github.com/BEKO2210/motion-studio/raw/main/docs/media/reel.mp4) (60 s, 9:16).

<table>
  <tr>
    <td align="center" width="33%"><img src="docs/media/reel-hook.gif" width="100%" alt="Giant words slam in: DIESES, VIDEO, IST, then CODE. as a green block"><br><sub><b>Hook</b> · kinetic type</sub></td>
    <td align="center" width="33%"><img src="docs/media/reel-steps.gif" width="100%" alt="Step 02: the commands type themselves, each with a check mark"><br><sub><b>Steps</b> · typed, a sound per key</sub></td>
    <td align="center" width="33%"><img src="docs/media/reel-cta.gif" width="100%" alt="Everything free on GitHub, the address types itself"><br><sub><b>Call to action</b> · the URL types itself</sub></td>
  </tr>
</table>

## Quick start

You need Node.js 22+, ffmpeg, Python 3 and [Claude Code](https://claude.com/claude-code).

```bash
brew install node ffmpeg python                              # macOS
sudo apt install nodejs npm ffmpeg python3 python3-venv      # Debian/Ubuntu
```

```bash
git clone https://github.com/BEKO2210/motion-studio
cd motion-studio
npm install
npx playwright install chromium
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

npm run example                          # renders films/example/out.mp4
```

Then start Claude Code and give it a brief:

```bash
claude --model claude-opus-5-5           # pick the effort with /effort: xhigh, max for big films
```

> Make a 20-second 9:16 film about my project. Combo 191B15-D3F425, style grotesk.

Claude reads [`CLAUDE.md`](CLAUDE.md) and works by it.

## As a skill: `/motion-studio`

The whole workflow as one command in Claude Code – brief, colours and style, sound, contact-sheet loop,
render, delivery:

```bash
mkdir -p ~/.claude/skills && ln -s "$PWD/skill/motion-studio" ~/.claude/skills/motion-studio
```

Then in Claude Code: `/motion-studio 30-second reel about my café, combo 191B15-D3F425, style grotesk`.
If the brief misses something, the skill asks once – never more.

## The loop

<p align="center"><img src="docs/media/loop.gif" width="100%" alt="A token runs through score.py, beats.py, analyze.py, render --sheet and review; twice back to render --sheet, the third time score 8, then render and out.mp4"></p>

| | Step | Result |
|---|---|---|
| 01 | `score.py` synthesizes the score and sound design | `audio.wav`, -14 LUFS, true peak after AAC ≤ -1.2 dBTP |
| 02 | `beats.py` measures the beat grid | `beats.json` |
| 03 | `lib/analyze.py` splits the spectrum per frame | `wave.json` for the waveform |
| 04 | `render.mjs --sheet` renders one frame per beat | a contact sheet at phone width |
| 05 | Score it, fix the three worst problems | back to 04 until every score is ≥ 8 |
| 06 | `render.mjs` renders the film | `out.mp4`, H.264, yuv420p, CRF 16 |

## The contact sheet

<p align="center"><img src="docs/media/contact-sheet.png" width="100%" alt="The reel's contact sheet: eight portrait frames, each with its timestamp"></p>

One frame per beat, each image 412 px wide – the size the video has on a phone. Scored from 1 to 10:

| Criterion | Question |
|---|---|
| Hook | Does it grab you in the first two seconds? |
| Readability | Is every text readable on a phone – and on screen long enough? |
| Motion | Does every move feel intended, any stutter or ghosting? |
| Variety | Does something new happen every 2–4 seconds? |
| Brand | Are type, color and logo right? |
| Sync | Does every cut sit on the sound? |

## Colours and style per film

Every film brings its own colour pair and its own style. Two hex values are enough – for example
straight from the [Combo Studio](https://combo.it-handwerk-stuttgart.de/) – every shade for type,
lines and surfaces is derived in OKLCH, so the hue holds.

<p align="center"><img src="docs/media/styles.png" width="100%" alt="The same template in four styles: tech on Twilight Zone and Stadium Grass, grotesk light in violet, editorial italic on berry red, terminal in mint on black"></p>

| Style | Type | Pair in the image |
|---|---|---|
| `tech` | Sora · IBM Plex Mono | Twilight Zone × Stadium Grass `191B15-D3F425` |
| `grotesk` | Space Grotesk · JetBrains Mono | #567180 Voldemort × Ghost White `31135E-FBF9FF`, `--invert` |
| `editorial` | Instrument Serif italic · IBM Plex Mono | #567996 Berry Chocolate × Sefid White `3B071C-FCF1F3` |
| `terminal` | JetBrains Mono | #567868 Spindrift × Reversed Grey `73FFDA-050807` |

```bash
npm run new -- reel-02 --9x16 --combo 191B15-D3F425 --style grotesk            # dark ground
npm run new -- reel-03 --9x16 --combo "https://combo.it-handwerk-stuttgart.de/#191B15-D3F425" --invert
```

In code: `film({ ..., combo: '191B15-D3F425', style: 'editorial', invert: false })`. The darker colour
becomes the ground, the other type and lines; emphasis is always the inversion.

## Build your own film

```bash
npm run new -- my-film --9x16 --seconds 20 --bpm 120      # creates films/my-film/
npm run build -- my-film --sheet                          # sound, beats, waveform, contact sheet
npm run build -- my-film                                  # the finished video
```

A film is a function. No timeline, no state between frames:

```js
import { C, E, ease, text, film, drawBars } from '../../lib/stage.js';

function draw(ctx, t, d) {
  drawBars(ctx, d.wave, t, 120, 700, 1680, 160);                 // the score drives the waveform
  const p = ease(t, 0.5, 0.85, E.outExpo);                       // lands on beat 1
  text(ctx, 'Hello', 120, 460 + (1 - p) * 160, { size: 140 });
}

film({ width: 1920, height: 1080, fps: 60, duration: 10, blur: 6, draw });
```

Sound is made the same way:

```python
from audio import *                              # lib/audio.py
mx = Mix(10.0)
mx.note(0.5, 62, vel=0.6, dur=3.0, pedal=True)   # piano: MIDI note, velocity, duration
mx.add("dry", 0.5, impact(1), 0.9)               # a hit on beat 1
mx.render("films/my-film/audio.wav")             # -14 LUFS, AAC-safe limiter
```

| `lib/stage.js` | | `lib/audio.py` | |
|---|---|---|---|
| `film()` | runtime, motion blur, fonts | `Mix` | buses, reverb, loudness, limiter |
| `ease`, `E.*` | easing | `piano()` | string model with hammer and damper |
| `text`, `code`, `tokens` | type, syntax colors | `tick`, `click`, `bits` | mechanics, data clicks |
| `scramble` | characters resolve | `snap`, `impact`, `boom` | hits |
| `drawBars`, `drawTrace` | waveform from the sound | `pulse`, `riser`, `whoosh` | lows, transitions |
| `hash`, `mulberry32` | deterministic randomness | `Mix.silence()` | true silence, reverb included |

## The rules

The full rules live in [`CLAUDE.md`](CLAUDE.md). The most important ones:

- **Every frame is a function of time.** `window.seek(t)` paints frame `t`. No `Math.random`, no
  `setTimeout`, no CSS animation – the renderer counts violations and fails.
- **Reading time.** Text meant to be read holds still for at least 1.2 s, else 0.3 s per word plus 0.5 s.
- **Safe area.** 120 px in landscape, 90 px in portrait. Lines never run through text.
- **One accent.** One display face, one UI face.
- **Nothing unchecked.** No final render while any score is below 8.

## Two formats from one film

`npm run new -- <name> --both` creates both: `films/<name>` and `films/<name>-9x16`. The second sets `<html data-format="9x16">` and loads the same `film.js`. The code
branches on layout only (`V`) – timing and sound stay identical. Columns become stacks, type is fitted,
nothing is cropped.

## Renderer

| Command | |
|---|---|
| `node render.mjs films/x` | finished video `out.mp4` |
| `node render.mjs films/x --sheet` | contact sheet, one frame per beat (`sheet-NN.png`) |
| `node render.mjs films/x --at 1.5,3:4:0.25` | frames at given times (`strip-NN.png`) |
| `node render.mjs films/x --gif 960` | also `out.gif` as a loop |
| `node render.mjs films/x --at 2,5 --png` | full-size stills, e.g. for thumbnails |
| `node render.mjs films/x --lufs -18` | quieter, e.g. as an effects bed under your own music |
| `node render.mjs films/x --remux` | replace only the sound of a finished video |
| `node render.mjs films/x --jobs 4` | four browsers render in parallel (busy scenes, paper grain) |

## Pitfalls already solved

| Symptom | Cause | Fix in the repo |
|---|---|---|
| Wrong typeface although it reports "loaded" | a stylesheet without `text/css` is silently dropped | the renderer's server sets MIME types, `film()` fails when a font is missing |
| True peak above 0 dB although the WAV is clean | AAC overshoot on steep onsets and at stream start | 0.7 ms rise on every sound, 30 ms lead-in, the limiter measures after an AAC encode |
| Beat measurement jumps | dotted rhythms without a steady pulse | a quiet escapement tick on every beat |
| Numbers smear | motion blur mixes different digits | counters read the frame, not the blur sample |
| Ghosting on fast motion | too few blur samples | `blur` per film or as a function of time |

## Layout

| File | |
|---|---|
| `CLAUDE.md` | rules for Claude Code |
| `render.mjs` | renderer: server, contact sheet, video, GIF, remux |
| `build.mjs` · `new.mjs` | the chain in one command · a new film from a template |
| `lib/stage.js` | canvas runtime, `comboPalette`, styles |
| `lib/logo.js` · `films/brand` | the logo – rendered by the studio too (`brand/logo/`) |
| `lib/audio.py` · `lib/analyze.py` | sound synthesis and mix · spectrum per frame |
| `lib/instruments.py` · `lib/aesthetics.py` | sampled grand, pad, bass, drums · the "ear": scores a mix |
| `beats.py` | measures the beat grid |
| `skill/motion-studio` | the `/motion-studio` skill for Claude Code |
| `films/example` | the smallest runnable film |
| `films/readme-hero` · `films/readme-loop` · `films/reel-workflow` | the animations on this page and the reel |

## License

Colors: [Twilight Zone × Stadium Grass](https://combo.it-handwerk-stuttgart.de/#191B15-D3F425) – `#191B15` and `#D3F425`, a two-color system: Twilight ground, Grass type and lines in its own shades, emphasis by inversion.
Code: [MIT](LICENSE). Piano: [Salamander Grand Piano V3](https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html) by Alexander Holm, CC-BY 3.0 (`tools/fetch-samples.sh`). Fonts: Sora, IBM Plex Mono, Space Grotesk, JetBrains Mono, Instrument Serif – SIL Open Font License 1.1 (`brand/fonts/licenses`).
Built by [Belkis Aslani](https://github.com/BEKO2210) with Claude Code.
