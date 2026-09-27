# Motion studio rules

## Render contract
- Every film is a pure function of time: `window.seek(t)` paints frame t.
- No CSS transitions, no setTimeout, no requestAnimationFrame in render mode,
  no state carried between frames. Seeded noise only (mulberry32), never Math.random.
- Render with `node render.mjs`, encode H.264 yuv420p, CRF 16.

## Look
- Banned defaults: centered title on gradient, everything fading in,
  corner labels and frame borders, glow on UI chrome, generic particle bursts.
- One display face, one UI face. One accent color unless the brief says otherwise.
- Studio palette (default in lib/stage.js): Twilight Zone #191B15 x Stadium Grass #D3F425, a two-color
  system. Ground Twilight, type and lines Grass and its OKLCH shades, dividers tints of Twilight.
  Emphasis is inversion (Grass fill, Twilight type). A brief with its own brand passes `palette` to film().
- Instagram Reels: keep every read inside x 90..920, y 250..1500 (the app's UI covers the rest).
- Every 2 to 4 seconds something new must happen on screen.
- Reading time: any text meant to be read holds still for at least
  max(1.2 s, 0.3 s per word + 0.5 s) before it moves or leaves. Per shot at most one
  such read (≤ 6 words); everything else is texture (smaller, dimmer, not needed to follow).
  A cut or transition never lands before the read of the previous shot is done.
- Safe area: every text and UI element stays inside a margin of 120 px (16:9) / 90 px (9:16)
  on all sides. Scrolling or streaming content is clipped at the margin, never at the frame edge.
- Lines never cross text. Route connectors to start and end outside labels; any text drawn near
  lines gets a background-colored halo (text(..., { halo })) so lines visibly stop before it.

## Sound
- Score and SFX are synthesized in code unless a track is supplied.
- Place hits on the measured beat grid (beats.json). Loudness -14 LUFS.

## Loop before you show me anything
1. Render one frame per beat as a contact sheet and LOOK at it.
2. Score it 1-10 on: hook in first 2s, readability at phone size (incl. reading time),
   motion quality, variety, brand accuracy, sound sync.
3. Fix the 3 worst problems. Repeat until every score is 8+.
4. Only then do the full render.

## Layout and tools
- Every film gets its own colours and style from the brief: `npm run new -- <name> --combo <hexA-hexB | combo link>
  [--invert] --style tech|grotesk|editorial|terminal`, in code `film({ combo, invert, style })`.
  `comboPalette()` derives all shades in OKLCH; use `DISPLAY()`, `SANS`, `MONO` so the style applies.
- `npm run new -- <name> [--9x16] [--seconds N] [--bpm N]` creates a film from a template;
  `npm run build -- <name> [render flags]` runs score -> analyze -> beats -> render.
- One folder per film: `films/<name>/`
  - `index.html` sets `window.FILM = { width, height, fps, duration }` and `window.seek(t)`.
    `?render=1` in the URL means render mode.
  - `audio.wav` (optional) is the score, synthesized by a script in the same folder.
  - `beats.json` is written by `.venv/bin/python beats.py films/<name>`.
- `node render.mjs films/<name> --sheet` writes `sheet-NN.png` (one frame per beat; a half-second grid
  without beats.json). `--at` writes `strip-NN.png`, so it never replaces the beat sheet.
- `node render.mjs films/<name>` writes `out.mp4`: H.264 yuv420p CRF 16, audio two-pass
  loudnorm to -14 LUFS. Contract violations (Math.random, rAF, setTimeout) are counted
  and make the render fail.
- Two formats from one film: `films/<name>-9x16/index.html` sets `<html data-format="9x16">`,
  loads `../<name>/film.js` and symlinks audio.wav, wave.json, beats.json, cues.json. The film code
  branches on `V` for layout only; timing and sound stay identical. Re-layout, never crop.
- `node render.mjs films/<name> --remux` replaces only the sound of an existing out.mp4.
- Audio: `Mix.render` normalizes to -14 LUFS and limits until the AAC encode stays under -1.2 dBTP.
- mulberry32:
  ```js
  const mulberry32 = a => () => { a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  ```
