#!/usr/bin/env python3
"""Strip errored records from eval result files so `--append` reruns refill them.

Usage:
    python3 eval-hackathon/retry_errors.py --dry-run   # list commands only
    python3 eval-hackathon/retry_errors.py --apply     # strip errors in place

After --apply, run the printed commands (or --run) to refill missing queries.
Only files with >=1 error record are touched; files that are simply partial
(fewer than 42 records, no errors) are left alone — --append refills them too.
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESULTS = Path(__file__).resolve().parent / "results"
PUZZLES = ROOT / "data" / "puzzles.json"
OBF1 = ROOT / "eval-hackathon" / "data" / "puzzles_obf_1.json"

# model ids as they appear in filenames ( '/' -> '_' )
KNOWN_MODELS = [
    "claude-opus-4-8",
    "gpt-5-6-sol",
    "gemini-3-1-pro",
    "gemini-3.1-pro",
    "gpt-oss-120b",
    "openai_gpt-oss-120b",
    "qwen_qwen3.8-27b",
    "qwen3-next-80b-a3b-instruct",
]


def split_name(stem: str):
    """Return (model_filepart, tag) for a result filename."""
    for m in sorted(KNOWN_MODELS, key=len, reverse=True):
        if stem.startswith(m + "_"):
            return m, stem[len(m) + 1 :]
    raise ValueError(f"unknown model prefix in {stem}")


VARIANTS = ("no_hint", "no_bank", "decomposition", "default")


def args_for(model_filepart: str, tag: str):
    """Reconstruct run_eval.py CLI args from a result-file tag.

    Tag layout (see run_eval.py): {variant}[_obf_N|_shufN][_tN]
    e.g. no_hint_obf_1_t2, no_hint_shuf1_t1, no_hint_t3, no_hint
    """
    provider = "groq" if model_filepart.startswith(("openai_", "qwen_")) else "neon"
    model = (
        model_filepart.replace("_", "/", 1)
        if model_filepart.startswith(("openai_", "qwen_"))
        else model_filepart
    )
    rest = tag
    trial = None
    if rest.endswith(tuple(f"_t{i}" for i in range(1, 10))):
        head, _, t = rest.rpartition("_t")
        if t.isdigit():
            rest, trial = head, t
    shuffle = None
    if "_shuf" in rest:
        rest, _, s = rest.rpartition("_shuf")
        shuffle = s
    puzzles_file = PUZZLES
    variant = "default"
    for v in VARIANTS:
        if rest == v:
            variant = v
            rest = ""
            break
        if rest.startswith(v + "_"):
            variant = v
            rest = rest[len(v) + 1 :]
            break
    if rest:  # e.g. "obf_1"
        puzzles_file = ROOT / "eval-hackathon" / "data" / f"puzzles_{rest}.json"
    cmd = [
        sys.executable,
        str(ROOT / "eval-hackathon" / "run_eval.py"),
        "--model",
        model,
        "--provider",
        provider,
        "--prompt-variant",
        variant,
        "--append",
        "--max-tokens",
        "4096",
    ]
    if puzzles_file != PUZZLES:
        cmd += ["--puzzles-file", str(puzzles_file)]
    if shuffle:
        cmd += ["--shuffle-seed", shuffle]
    if trial:
        cmd += ["--trial", trial]
    return cmd, provider, model


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--run", action="store_true", help="execute the refill commands")
    args = ap.parse_args()

    for path in sorted(RESULTS.glob("*.json")):
        if "linguni" in path.name:
            continue
        try:
            recs = json.loads(path.read_text())
        except json.JSONDecodeError:
            print(f"SKIP {path.name}: corrupt json (still being written?)")
            continue
        errs = [r for r in recs if r.get("error")]
        if not errs:
            continue
        print(f"{path.name}: {len(errs)}/{len(recs)} errored -> strip + refill")
        if args.apply:
            kept = [r for r in recs if not r.get("error")]
            path.write_text(json.dumps(kept, indent=1, ensure_ascii=False))
        try:
            cmd, _provider, _model = args_for(*split_name(path.stem))
        except ValueError as e:
            print(f"  !! {e}")
            continue
        print("   ", " ".join(cmd[1:]))
        if args.run and args.apply:
            subprocess.run(cmd, cwd=ROOT)


if __name__ == "__main__":
    main()
