#!/usr/bin/env python3
"""Assemble narration track: each scene's TTS padded to scene duration."""

import json
import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCENES = HERE / "scenes"
# scene durations must match record.mjs / assemble order
DURS = {
    1: 22.5,
    2: 29.0,
    3: 22.8,
    4: 39.3,
    5: 8.5,
    6: 20.3,
    7: 21.0,
    8: 29.1,
    9: 34.0,
}
ORDER = sorted(DURS)

starts = {}
t = 0.0
for n in ORDER:
    starts[n] = t
    t += DURS[n]
TOTAL = t
print("total duration:", TOTAL)

seg_files = []
for n in ORDER:
    mp3 = SCENES / f"scene{n:02d}.mp3"
    seg = SCENES / f"seg{n:02d}.wav"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(mp3),
            "-af",
            f"apad,atrim=0:{DURS[n]}",
            "-ar",
            "48000",
            "-ac",
            "2",
            str(seg),
        ],
        check=True,
    )
    seg_files.append(seg)

listfile = SCENES / "concat.txt"
listfile.write_text("".join(f"file '{f.name}'\n" for f in seg_files))
out = SCENES / "narration.wav"
subprocess.run(
    [
        "ffmpeg",
        "-y",
        "-v",
        "error",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(listfile),
        "-c",
        "copy",
        str(out),
    ],
    check=True,
)
print("wrote", out)

words = []
for n in ORDER:
    d = json.loads((SCENES / f"scene{n:02d}.json").read_text())
    for w, s, e in d["words"]:
        words.append([starts[n] + s, starts[n] + e, w])
(SCENES / "timeline.json").write_text(
    json.dumps({"starts": starts, "durs": DURS, "words": words})
)
print("words:", len(words))
