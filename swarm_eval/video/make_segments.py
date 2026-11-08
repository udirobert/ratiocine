#!/usr/bin/env python3
"""Convert fresh Playwright webm footage into exact-duration 25fps segments."""

import subprocess
from pathlib import Path

HERE = Path(__file__).resolve().parent
FOOTAGE = HERE / "footage"
SEG = HERE / "segments"
SEG.mkdir(exist_ok=True)

# record.mjs iterates scenes/ alphabetically; each context writes one webm.
SCENE_ORDER = [
    "01-title",
    "02-testbed",
    "03-conditions",
    "05-poison",
    "06-contagion",
    "06-failures",
    "07-monitor",
    "08-close",
]
# segment name -> exact duration
DURS = {
    "01-title": 22.5,
    "02-testbed": 29.0,
    "03-conditions": 22.8,
    "04-dashboard": 39.3,
    "05-contagion": 8.5,
    "06-poison": 20.3,
    "07-failures": 21.0,
    "08-monitor": 29.1,
    "09-close": 34.0,
}

webms = sorted(FOOTAGE.glob("page@*.webm"), key=lambda p: p.stat().st_mtime)
assert len(webms) >= 9, f"expected >=9 fresh webms, got {len(webms)}"
# first 8 alphabetically-recorded scenes, 9th = dashboard
by_scene = dict(zip(SCENE_ORDER, webms[:8], strict=True))
by_scene["04-dashboard"] = webms[8]

# segment name -> source scene key (note the poison/contagion file-number swap)
SRC = {
    "01-title": "01-title",
    "02-testbed": "02-testbed",
    "03-conditions": "03-conditions",
    "04-dashboard": "04-dashboard",
    "05-contagion": "06-contagion",
    "06-poison": "05-poison",
    "07-failures": "06-failures",
    "08-monitor": "07-monitor",
    "09-close": "08-close",
}

for seg, dur in DURS.items():
    src = by_scene[SRC[seg]]
    out = SEG / f"{seg}.mp4"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            str(src),
            "-vf",
            "fps=25,scale=1920:1080,setsar=1,tpad=stop_mode=clone:stop_duration=8",
            "-t",
            f"{dur}",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-crf",
            "18",
            "-preset",
            "fast",
            "-an",
            str(out),
        ],
        check=True,
    )
    print(seg, "<-", src.name, f"({dur}s)")
print("DONE")
