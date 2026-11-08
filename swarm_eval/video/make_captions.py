#!/usr/bin/env python3
"""Build .srt + .ass captions from ElevenLabs word timestamps."""

import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
AUD = HERE / "audio" / "scenes"
DURS = {
    1: 28.68,
    2: 30.16,
    3: 23.92,
    4: 61.92,
    5: 12.92,
    6: 25.12,
    7: 22.60,
    8: 31.08,
    9: 35.36,
}
ORDER = sorted(DURS)

offsets = {}
t = 0.0
for n in ORDER:
    offsets[n] = t
    t += DURS[n]


def ts(s):
    s = max(0.0, s)
    h = int(s // 3600)
    s -= h * 3600
    m = int(s // 60)
    s -= m * 60
    return f"{h:02d}:{m:02d}:{s:06.3f}".replace(".", ",")


def ts_ass(s):
    s = max(0.0, s)
    h = int(s // 3600)
    s -= h * 3600
    m = int(s // 60)
    s -= m * 60
    sec = int(s)
    cs = int((s - sec) * 100)
    return f"{h}:{m:02d}:{sec:02d}.{cs:02d}"


def clean(w):
    return re.sub(r"[^\w'’.\-—]", "", w)


cues = []  # (start, end, text)
for n in ORDER:
    data = json.loads((AUD / f"scene{n:02d}.json").read_text())
    off = offsets[n]
    # data["words"] entries are [word, start, end]
    words = [(x[0], x[1], x[2]) for x in data["words"]]
    cur, cs, ce = [], None, None
    for w, s, e in words:
        cand = " ".join([*cur, w])
        if cur and (len(cand) > 46 or len(cur) >= 6):
            cues.append((off + cs, off + ce, " ".join(cur)))
            cur, cs, ce = [], None, None
        if cs is None:
            cs = s
        cur.append(w)
        ce = e
    if cur:
        cues.append((off + cs, off + ce, " ".join(cur)))

# merge tiny cues (<0.9s) forward into next when possible
merged = []
for c in cues:
    if merged and c[1] - c[0] < 0.9 and c[1] - merged[-1][0] < 4.5:
        merged[-1] = (merged[-1][0], c[1], merged[-1][2] + " " + c[2])
    else:
        merged.append(c)
cues = merged

# SRT
srt = []
for i, (s, e, txt) in enumerate(cues, 1):
    srt.append(f"{i}\n{ts(s)} --> {ts(e)}\n{txt}\n")
(HERE / "captions.srt").write_text("\n".join(srt))

# ASS — brand styling: Geist, white, soft shadow, bottom center
ass = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,Geist,50,&H00FFFFFF,&H00FFFFFF,&H96000000,&H96000000,0,0,0,0,100,100,0,0,1,2.5,1.5,2,140,140,96,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
for s, e, txt in cues:
    ass += f"Dialogue: 0,{ts_ass(s)},{ts_ass(e)},Cap,,0,0,0,,{txt}\n"
(HERE / "captions.ass").write_text(ass)
print(f"{len(cues)} cues -> captions.srt + captions.ass (total {t:.1f}s)")
