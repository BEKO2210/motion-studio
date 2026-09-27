# motion-studio

Motion-Design-Filme mit Claude Code: Bild, Schrift und Sound entstehen komplett im Code,
jedes Bild ist eine Funktion der Zeit. Claude baut den Film, rendert einen Kontaktbogen,
bewertet ihn, behebt die drei größten Fehler – und rendert erst dann das fertige Video.

## Was du brauchst

- Node.js 22 oder neuer
- ffmpeg
- Python 3
- [Claude Code](https://claude.com/claude-code)

```bash
# macOS
brew install node ffmpeg python
# Linux (Debian/Ubuntu)
sudo apt install nodejs npm ffmpeg python3 python3-venv
```

## Installieren

```bash
git clone https://github.com/BEKO2210/motion-studio
cd motion-studio
npm install
npx playwright install chromium
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Starten

```bash
claude --model claude-opus-5-5
```

Mit `/model` die Stufe wählen: `xhigh` für einzelne Filme, `max` für große Stücke.
Dann ein Briefing geben, zum Beispiel:

> Erstelle einen 10-Sekunden-Film im Format 9:16 über …

Claude liest die Regeln in [`CLAUDE.md`](CLAUDE.md) und hält sich daran.

## Der Ablauf

1. **Ton zuerst** – `films/<name>/score.py` erzeugt `audio.wav` (Klavier und Soundeffekte werden synthetisiert).
2. **Takt messen** – `.venv/bin/python beats.py films/<name>` schreibt `beats.json`.
3. **Wellenform** – `.venv/bin/python lib/analyze.py films/<name>` schreibt `wave.json`.
4. **Kontaktbogen** – `node render.mjs films/<name> --sheet` rendert ein Bild pro Beat.
5. **Bewerten und verbessern** – Hook, Lesbarkeit am Handy, Bewegung, Abwechslung, Marke, Sync: jede Note muss 8 oder besser sein.
6. **Fertiges Video** – `node render.mjs films/<name>` → `out.mp4`, H.264, 60 fps, mit Motion Blur, -14 LUFS.

Ein fertiges Beispiel liegt in [`films/example`](films/example):

```bash
.venv/bin/python films/example/score.py
.venv/bin/python lib/analyze.py films/example
.venv/bin/python beats.py films/example
node render.mjs films/example
```

## Die wichtigsten Regeln

- Jedes Bild ist eine Funktion der Zeit: `window.seek(t)` malt Bild `t`. Kein Zufall ohne Seed, keine CSS-Animationen.
- Text, der gelesen werden soll, steht lange genug still: mindestens 1,2 s, sonst 0,3 s pro Wort plus 0,5 s.
- Fester Sicherheitsrand, Linien laufen nie durch Text.
- Ein Akzent, eine Display-Schrift, eine UI-Schrift.
- Alle 2 bis 4 Sekunden passiert etwas Neues.

## Aufbau

| Datei | Aufgabe |
|---|---|
| `CLAUDE.md` | Regeln für Claude Code |
| `render.mjs` | Renderer: Kontaktbogen, fertiges Video, `--remux`, `--lufs` |
| `lib/stage.js` | Canvas-Laufzeit: Easing, Schrift, Wellenform, Motion Blur |
| `lib/audio.py` | Klavier-Synthese, Soundeffekte, Hall, Lautheit, Limiter |
| `lib/analyze.py` | Spektrum pro Bild für die Wellenform |
| `beats.py` | misst das Taktraster |

Schriften: Sora und IBM Plex Mono, SIL Open Font License 1.1 (siehe `brand/fonts/README.md`).
