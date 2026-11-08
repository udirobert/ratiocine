#!/usr/bin/env python3
"""Generate Figure 1: swarm EM by condition, from committed result JSONs.

Reads swarm_eval/results/*.json (no API calls) and writes
swarm_eval/fig1_conditions.svg — grouped bars, one group per model,
one bar per condition. Deterministic: same inputs -> same SVG.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESULTS = ROOT / "swarm_eval/results"
OUT = ROOT / "swarm_eval/fig1_conditions.svg"

CONDITIONS = ["clean", "poison", "monitor", "soloshard"]
CONDITION_LABEL = {
    "clean": "clean",
    "poison": "poison",
    "monitor": "monitor",
    "soloshard": "soloshard\n(no board)",
}
COLORS = {
    "clean": "#4c78a8",
    "poison": "#f58518",
    "monitor": "#54a24b",
    "soloshard": "#e45756",
}
MODELS = [
    ("claude-opus-4-8", "Claude Opus 4.8"),
    ("gpt-5-6-sol", "GPT-5"),
    ("gemini-3-1-pro", "Gemini 3.1 Pro"),
    ("openai/gpt-oss-20b", "GPT-OSS-20B"),
]

W, H = 560, 330
ML, MR, MT, MB = 46, 14, 30, 78
PW, PH = W - ML - MR, H - MT - MB


def cell_em(episodes):
    """Query-weighted EM-decomp across episodes in one file."""
    tot = hit = 0
    for e in episodes:
        qs = [q for q in e.get("queries", []) if q.get("difficulty") != "tutorial"]
        for q in qs:
            tot += 1
            hit += 1 if q.get("em_decomp") else 0
    return hit / tot if tot else 0.0


def main():
    # collect episodes per (model, condition)
    data = {(m, c): [] for m, _ in MODELS for c in CONDITIONS}
    for f in RESULTS.glob("*.json"):
        eps = json.loads(f.read_text())
        for e in eps:
            key = (e.get("model"), e.get("condition"))
            if key in data:
                data[key].append(e)

    # chart geometry: groups per model, bars per condition
    n_models, n_conds = len(MODELS), len(CONDITIONS)
    group_w = PW / n_models
    bar_w = group_w * 0.16
    gap = group_w * 0.05

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" '
        f'font-family="Georgia,serif">',
        f'<rect width="{W}" height="{H}" fill="white"/>',
    ]
    # y gridlines + labels
    for v in [0.0, 0.25, 0.5, 0.75, 1.0]:
        y = MT + PH * (1 - v)
        parts.append(
            f'<line x1="{ML}" y1="{y:.1f}" x2="{W - MR}" y2="{y:.1f}" stroke="#ddd"/>'
        )
        parts.append(
            f'<text x="{ML - 6}" y="{y + 4:.1f}" font-size="9" '
            f'text-anchor="end" fill="#555">{v:.2f}</text>'
        )
    parts.append(
        f'<text x="{ML - 34}" y="{MT - 10}" font-size="10" '
        f'text-anchor="middle" fill="#333">EM-decomp</text>'
    )

    max_v = 1.0
    for gi, (model, label) in enumerate(MODELS):
        gx = ML + gi * group_w + group_w / 2
        # group label
        parts.append(
            f'<text x="{gx:.1f}" y="{H - MB + 16}" font-size="10" '
            f'text-anchor="middle" fill="#222">{label}</text>'
        )
        start = gx - (n_conds * bar_w + (n_conds - 1) * gap) / 2
        for ci, cond in enumerate(CONDITIONS):
            eps = data.get((model, cond), [])
            v = cell_em(eps) if eps else 0.0
            h = PH * v / max_v
            x = start + ci * (bar_w + gap)
            y = MT + PH - h
            parts.append(
                f'<rect x="{x:.1f}" y="{y:.1f}" width="{bar_w:.1f}" '
                f'height="{h:.1f}" fill="{COLORS[cond]}"/>'
            )
            if v > 0.02:
                parts.append(
                    f'<text x="{x + bar_w / 2:.1f}" y="{y - 3:.1f}" '
                    f'font-size="8" text-anchor="middle" fill="#333">'
                    f"{v:.2f}</text>"
                )
    # legend
    lx = ML
    for ci, cond in enumerate(CONDITIONS):
        y = H - 14
        x = lx + ci * 105
        parts.append(
            f'<rect x="{x}" y="{y - 8}" width="9" height="9" fill="{COLORS[cond]}"/>'
        )
        parts.append(
            f'<text x="{x + 12}" y="{y}" font-size="9" fill="#333">'
            f"{CONDITION_LABEL[cond]}</text>"
        )
    parts.append("</svg>")
    OUT.write_text("\n".join(parts))
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
