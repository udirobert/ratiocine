#!/usr/bin/env python3
"""Generate per-scene ElevenLabs v4 narration with character timestamps."""

import base64
import json
import os
import ssl
import urllib.request
from pathlib import Path

try:
    import certifi

    CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    CTX = ssl.create_default_context()

KEY = os.environ["ELEVENLABS_API_KEY"]
VOICE = "fFAtoTPtP0TtMyhbR3L9"  # Amara — Warm African-British Professional
MODEL = "eleven_v4"
HERE = Path(__file__).resolve().parent
OUT = HERE / "scenes"
OUT.mkdir(exist_ok=True)

script = json.loads((HERE / "script.json").read_text())
for sc in script:
    body = json.dumps({"text": sc["text"], "model_id": MODEL}).encode()
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{VOICE}/with-timestamps",
        data=body,
        method="POST",
        headers={"xi-api-key": KEY, "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=180, context=CTX) as r:
        res = json.load(r)
    audio = base64.b64decode(res["audio_base64"])
    n = sc["scene"]
    (OUT / f"scene{n:02d}.mp3").write_bytes(audio)
    al = res["alignment"]
    chars = al["characters"]
    starts = al["character_start_times_seconds"]
    ends = al["character_end_times_seconds"]
    words = []
    cur = ""
    ws = we = None
    for c, s, e in zip(chars, starts, ends, strict=True):
        if c.isspace():
            if cur:
                words.append([cur, ws, we])
                cur, ws, we = "", None, None
            continue
        if ws is None:
            ws = s
        cur += c
        we = e
    if cur:
        words.append([cur, ws, we])
    (OUT / f"scene{n:02d}.json").write_text(
        json.dumps({"words": words, "audio_end": ends[-1]})
    )
    print(
        f"scene {n}: {len(audio)}B audio, last char ends {ends[-1]:.1f}s, "
        f"{len(words)} words"
    )
