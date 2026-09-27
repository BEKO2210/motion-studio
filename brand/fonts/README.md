# Fonts

Sora (display) and IBM Plex Mono (UI), plus Instrument Serif, each licensed under the
SIL Open Font License 1.1 (https://openfontlicense.org).

The files are subset to Latin, Latin-1 and common symbols (arrows, ×, Δ, ≤, dashes, quotes):

    pyftsubset ORIGINAL.woff2 --flavor=woff2 --layout-features='*' \
      --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0394,U+2000-206F,U+20AC,U+2122,U+2190-2199,U+2212,U+2215,U+2264-2265,U+FEFF,U+FFFD" \
      --output-file=FONT.woff2

Need another script (Cyrillic, Greek, CJK)? Replace the files with full versions; `film()` fails
loudly if a face cannot be loaded.
