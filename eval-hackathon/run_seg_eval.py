#!/usr/bin/env python3
"""Morpheme Segmentation Eval — the harder sibling of run_eval.py.

The composition eval hands models a closed morpheme bank; frontier models
solve it (~0.95+ EM even obfuscated). This eval removes the shortcut:
each evidence pair is shown WITH its gold morpheme analysis, one pair is
held out, and the model must segment the held-out word itself.

For every puzzle, every pair becomes one task (leave-one-out):
  evidence = all other pairs rendered as 'source → target = m1 + m2 + …'
  query    = segment 'source' of the held-out pair
  gold     = pair['morphemes']

Grading is deterministic: exact morpheme-sequence match (em_decomp),
chrF on the concatenated form, morpheme F1. No LLM judge.

Usage:
    python3 eval-hackathon/run_seg_eval.py --model claude-opus-4-8 --provider neon --trial 1
"""

import argparse
import json
import logging
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "hf-pipeline" / "submission"))
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "eval-hackathon"))

import llm_providers  # noqa: E402
from prompts import get_system_prompt  # noqa: E402
from run_eval import RESULTS_DIR, chrf, load_env, morpheme_f1  # noqa: E402
from run_models_for_ltb import normalize_dashes  # noqa: E402

PUZZLES_PATH = ROOT / "data" / "puzzles.json"

PROMPT = """\
You are a linguist doing fieldwork on an unfamiliar language.

Below are bilingual evidence pairs. Each pair shows the target-language
word/phrase, its English gloss, and its morpheme breakdown joined by ' + '.

{evidence}

Task: segment the word '{word}' ({gloss}) into its morphemes, using the
same morpheme inventory and conventions shown above.

Output ONLY the morpheme sequence with ' + ' between morphemes,
e.g. 'ka + a + kita'. No explanation, no other text.
"""


def build_prompt(puzzle: dict, held_idx: int) -> tuple[str, dict]:
    pair = puzzle["pairs"][held_idx]
    ev_lines = []
    for i, row in enumerate(puzzle["pairs"]):
        if i == held_idx:
            continue
        morphs = row.get("morphemes") or []
        seg = " + ".join(morphs) if morphs else "(not analyzed)"
        ev_lines.append(f"- {row['source']} → {row['target']} = {seg}")
    return PROMPT.format(
        evidence="\n".join(ev_lines),
        word=pair["source"],
        gloss=pair["target"],
    ), pair


def parse_seg(raw: str) -> list[str]:
    """Extract morpheme list from model output."""
    text = raw.strip()
    # prefer content after tags if present
    for tag in ("<answers>", "<answer>"):
        if tag in text:
            text = text.rsplit(tag, 1)[1]
            break
    text = text.split("</answers>")[0].split("</answer>")[0]
    # take the last non-empty line (models may add prose)
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    cand = lines[-1] if lines else text
    cand = cand.strip("`\"'.")
    parts = [p.strip() for p in cand.replace("+", " + ").split("+")]
    # also handle space-separated morphemes when no '+' present
    if len(parts) == 1 and " " in parts[0]:
        parts = parts[0].split()
    return [normalize_dashes(p) for p in parts if p]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--provider", default=None)
    ap.add_argument("--trial", default=None)
    ap.add_argument("--max-tokens", type=int, default=1024)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--output", type=Path, default=None)
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    env = load_env()
    puzzles = json.loads(PUZZLES_PATH.read_text())

    tag = "seg"
    if args.trial:
        tag += f"_t{args.trial}"
    out_path = (
        args.output
        or RESULTS_DIR / f"{args.model.replace('/', '_')}_no_hint_{tag}.json"
    )
    RESULTS_DIR.mkdir(exist_ok=True)

    records = []
    if args.output and out_path.exists():
        records = json.loads(out_path.read_text())
        done = {(r["puzzle"], r["query"]) for r in records}
    else:
        done = set()

    items = [(p["id"], i, p, i) for p in puzzles for i in range(len(p["pairs"]))]
    if args.limit:
        items = items[: args.limit]
    n = 0
    for pid, held, puzzle, _ in items:
        n += 1
        if (pid, held) in done:
            continue
        prompt, pair = build_prompt(puzzle, held)
        gold = pair.get("morphemes") or []
        t0 = time.time()
        try:
            payload = llm_providers.build_payload(
                args.model,
                [
                    {"role": "system", "content": get_system_prompt("translation")},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=args.max_tokens,
                temperature=None,
            )
            if args.provider:
                prov = next(
                    p for p in llm_providers.PROVIDERS if p["name"] == args.provider
                )
                raw = llm_providers.call_chat(env, prov, payload)
            else:
                raw, _ = llm_providers.call_with_failover(env, payload)
            elapsed = time.time() - t0
        except Exception as e:
            logging.error(f"[{n}] {pid}:{held} ERROR: {e}")
            records.append(
                {
                    "puzzle": pid,
                    "query": held,
                    "gold": gold,
                    "raw": "",
                    "error": str(e),
                    "model": args.model,
                    "provider": args.provider or "failover",
                    "prompt_variant": "seg",
                    "trial": args.trial,
                    "puzzles_file": str(PUZZLES_PATH),
                }
            )
            out_path.write_text(json.dumps(records, indent=1, ensure_ascii=False))
            continue

        pred = parse_seg(raw)
        joined_gold = "".join(gold)
        joined_pred = "".join(pred)
        rec = {
            "puzzle": pid,
            "query": held,
            "word": pair["source"],
            "gloss": pair["target"],
            "gold": gold,
            "pred": pred,
            "em_decomp": pred == gold,
            "chrf": round(chrf(joined_pred, joined_gold), 4),
            "morf1": round(morpheme_f1(pred, gold), 4),
            "raw": raw,
            "elapsed_s": round(elapsed, 1),
            "model": args.model,
            "provider": args.provider or "failover",
            "prompt_variant": "seg",
            "trial": args.trial,
            "puzzles_file": str(PUZZLES_PATH),
        }
        records.append(rec)
        out_path.write_text(json.dumps(records, indent=1, ensure_ascii=False))
        logging.info(
            f"[{n}/{len(items)}] {pid}:{held} {'OK' if rec['em_decomp'] else '--'} "
            f"f1={rec['morf1']:.2f} gold={gold} pred={pred} ({elapsed:.1f}s)"
        )

    ok = [r for r in records if "error" not in r]
    if ok:
        n_ok = len(ok)
        print(
            f"\nSEG SUMMARY — {args.model}: n={n_ok} "
            f"EM={sum(r['em_decomp'] for r in ok) / n_ok:.3f} "
            f"chrF={sum(r['chrf'] for r in ok) / n_ok:.3f} "
            f"morf1={sum(r['morf1'] for r in ok) / n_ok:.3f}"
        )


if __name__ == "__main__":
    main()
