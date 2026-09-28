"""Score audio with Meta's Audiobox Aesthetics (CC-BY 4.0): production quality (PQ), production
complexity (PC), content enjoyment (CE), content usefulness (CU), each about 1-10. I cannot hear,
so this is the ear in the loop: compare versions, keep what scores higher.
usage: .venv/bin/python lib/aesthetics.py file.wav [more.wav ...] [--from 12 --to 30]"""
import json
import sys
import tempfile

import soundfile as sf

import torch
from audiobox_aesthetics import infer


def _read(meta):
    # soundfile instead of torchaudio.load (which needs torchcodec); mono, channels first
    x, sr = sf.read(meta["path"], always_2d=True, dtype="float32")
    return torch.from_numpy(x.mean(1, keepdims=True).T.copy()), sr


infer.read_wav = _read
initialize_predictor = infer.initialize_predictor

args = sys.argv[1:]
cut = {}
for flag in ("--from", "--to"):
    if flag in args:
        i = args.index(flag); cut[flag] = float(args[i + 1]); del args[i:i + 2]
pred = initialize_predictor()
for path in args:
    src = path
    if cut:
        x, sr = sf.read(path)
        a = int(cut.get("--from", 0) * sr); b = int(cut.get("--to", len(x) / sr) * sr)
        tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False); sf.write(tmp.name, x[a:b], sr); src = tmp.name
    r = pred.forward([{"path": src}])[0]
    print(json.dumps({"file": path, **{k: round(v, 2) for k, v in r.items()}}))
