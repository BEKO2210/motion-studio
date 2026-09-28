#!/usr/bin/env bash
# Sampled instruments for lib/instruments.py (not in the repo: 1.9 GB).
# Salamander Grand Piano V3, 48 kHz/24 bit, by Alexander Holm, CC-BY 3.0 – credit it in your film's description.
set -euo pipefail
DEST="${MOTION_STUDIO_SAMPLES:-$HOME/.cache/motion-studio/samples}"
mkdir -p "$DEST" && cd "$DEST"
if [ ! -f SalamanderGrandPianoV3_48khz24bit/SalamanderGrandPianoV3.sfz ]; then
  curl -fL -o salamander.tar.xz "https://freepats.zenvoid.org/Piano/SalamanderGrandPiano/SalamanderGrandPianoV3+20161209_48khz24bit.tar.xz"
  tar -xJf salamander.tar.xz && rm salamander.tar.xz
fi
echo "samples ready in $DEST"
