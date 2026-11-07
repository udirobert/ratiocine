#!/usr/bin/env python3
"""micro1 Eval Hackathon — Morpheme Puzzle Eval runner.

Evaluates LLMs on deciphering rare-language morphology: given bilingual
evidence pairs and a morpheme inventory, compose the correct target form.

Each of the 10 puzzles in puzzles.json is one eval task; each puzzle has
several query items. Grading is deterministic:

  - em_decomp : parsed morpheme sequence == gold decomposition (exact)
  - em_surface: joined surface form == gold surface form (exact, incl.
                vowel-elision variants)
  - chrf      : chrF between predicted surface form and gold surface form
  - f1        : morpheme-set F1 between predicted and gold morphemes

Headline metrics exclude 'tutorial' queries (those are copied verbatim
from the evidence — they measure instruction-following, not deduction).

Usage:
    python3 eval-hackathon/run_eval.py --model openai/gpt-oss-120b --provider groq
    python3 eval-hackathon/run_eval.py --model <id> --provider <name> --output results/x.json
"""

import argparse
import json
import logging
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "hf-pipeline" / "submission"))
sys.path.insert(0, str(ROOT / "scripts"))

import llm_providers  # noqa: E402
from prompts import get_system_prompt, parse_answers  # noqa: E402
from run_models_for_ltb import (  # noqa: E402
    build_context,
    normalize_dashes,
    parse_morphemes,
    surface_forms,
)

PUZZLES_PATH = ROOT / "data" / "puzzles.json"
RESULTS_DIR = Path(__file__).resolve().parent / "results"


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    dotenv = ROOT / ".env"
    if dotenv.exists():
        for line in dotenv.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k] = v.strip().strip('"')
    return env


def extract_answer_text(raw: str, context: str) -> str:
    """First answer line, skipping bare tag artifacts.

    parse_answers can return a literal '<answers>' line when the model
    leaves the tag unterminated ('<answers>\\nni lernis' with no closing
    tag); that is markup, not an answer.
    """
    lines = parse_answers(raw, n_expected=1, task_type="translation", context=context)
    for ln in lines:
        s = ln.strip()
        if s and not re.fullmatch(r"</?[a-zA-Z_]+>", s):
            return s.strip(".!?;:，。")
    if "<answers>" in raw:
        tail = raw.rsplit("<answers>", 1)[1]
        for ln in tail.splitlines():
            s = ln.strip()
            if s and not re.fullmatch(r"</?[a-zA-Z_]+>", s):
                return s.strip(".!?;:，。")
    return ""


def chrf(pred: str, ref: str, beta: float = 2.0) -> float:
    """chrF character n-gram F-score (same implementation as the IOL scorer)."""
    pred, ref = pred.lower(), ref.lower()
    if not pred or not ref:
        return 0.0
    precisions, recalls = [], []
    for n in range(1, 5):
        pn: dict[str, int] = {}
        rn: dict[str, int] = {}
        for i in range(len(pred) - n + 1):
            g = pred[i : i + n]
            pn[g] = pn.get(g, 0) + 1
        for i in range(len(ref) - n + 1):
            g = ref[i : i + n]
            rn[g] = rn.get(g, 0) + 1
        overlap = sum(min(c, rn.get(g, 0)) for g, c in pn.items())
        if not pn or not rn:
            continue
        precisions.append(overlap / sum(pn.values()))
        recalls.append(overlap / sum(rn.values()))
    k = len(precisions)
    if not k:
        return 0.0
    p = sum(precisions) / k
    r = sum(recalls) / k
    if p + r == 0:
        return 0.0
    return (1 + beta**2) * p * r / (beta**2 * p + r)


def morpheme_f1(pred: list[str], gold: list[str]) -> float:
    """Multiset F1 over morpheme tokens (bag-of-morphemes)."""
    from collections import Counter

    p, g = Counter(pred), Counter(gold)
    if not p or not g:
        return 0.0
    overlap = sum((p & g).values())
    if overlap == 0:
        return 0.0
    prec, rec = overlap / sum(p.values()), overlap / sum(g.values())
    return 2 * prec * rec / (prec + rec)


def call_model(
    context: str,
    query_prompt: str,
    model: str,
    env: dict,
    provider_name: str | None,
    max_tokens: int,
    task_type: str = "translation",
    temperature: float | None = None,
) -> tuple[str, str]:
    system = get_system_prompt(task_type)
    messages = [
        {"role": "system", "content": system},
        {
            "role": "user",
            "content": f"{context}\n\n{query_prompt}",
        },
    ]
    payload = llm_providers.build_payload(
        model, messages, max_tokens=max_tokens, temperature=temperature
    )
    if provider_name:
        provider = next(
            (p for p in llm_providers.PROVIDERS if p["name"] == provider_name), None
        )
        if provider is None or provider["env_key"] not in env:
            raise RuntimeError(f"provider {provider_name!r} unknown or key missing")
        return llm_providers.call_chat(env, provider, payload), provider["name"]
    return llm_providers.call_with_failover(env, payload)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--provider", default=None)
    ap.add_argument("--puzzles", default="", help="comma-separated puzzle ids")
    ap.add_argument(
        "--puzzles-file",
        type=Path,
        default=PUZZLES_PATH,
        help="puzzle JSON (e.g. obfuscated variant)",
    )
    ap.add_argument(
        "--shuffle-seed",
        type=int,
        default=0,
        help="permute evidence-pair order per puzzle (consistency probe)",
    )
    ap.add_argument("--max-tokens", type=int, default=2048)
    ap.add_argument(
        "--temperature",
        type=float,
        default=None,
        help="sampling temperature; default omits it (provider default)",
    )
    ap.add_argument(
        "--trial",
        type=int,
        default=0,
        help="trial index, recorded per record and in filename",
    )
    ap.add_argument(
        "--prompt-variant",
        default="no_hint",
        choices=["default", "decomposition", "no_hint", "no_bank"],
    )
    ap.add_argument("--output", type=Path, default=None)
    ap.add_argument(
        "--append",
        action="store_true",
        help="merge into existing output file instead of overwriting",
    )
    args = ap.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(message)s")
    env = load_env()

    puzzles = json.loads(args.puzzles_file.read_text())
    if args.shuffle_seed:
        import random

        for puzzle in puzzles:
            random.Random(f"{args.shuffle_seed}:{puzzle['id']}").shuffle(
                puzzle["pairs"]
            )
    if args.puzzles:
        wanted = set(args.puzzles.split(","))
        puzzles = [p for p in puzzles if p["id"] in wanted]

    tag = args.prompt_variant
    if args.puzzles_file != PUZZLES_PATH:
        tag += "_" + args.puzzles_file.stem.replace("puzzles_", "")
    if args.shuffle_seed:
        tag += f"_shuf{args.shuffle_seed}"
    if args.trial:
        tag += f"_t{args.trial}"
    out_path = args.output or (
        RESULTS_DIR / f"{args.model.replace('/', '_')}_{tag}.json"
    )
    RESULTS_DIR.mkdir(exist_ok=True)

    records: list[dict] = []
    if args.append and out_path.exists():
        records = json.loads(out_path.read_text())
        done = {(r["puzzle"], r["query"]) for r in records}
    else:
        done = set()

    total = sum(len(p["queries"]) for p in puzzles)
    n = 0
    for puzzle in puzzles:
        tiles = [m for group in puzzle["morphemeBank"] for m in group]
        for query in puzzle["queries"]:
            n += 1
            key = (puzzle["id"], query["id"])
            if key in done:
                logging.info(f"[{n}/{total}] {key} — already run")
                continue
            base_variant = (
                "no_hint" if args.prompt_variant == "no_bank" else args.prompt_variant
            )
            context = build_context(puzzle, query, base_variant)
            if args.prompt_variant == "no_bank":
                # Strip the tile bank: model must produce the target word
                # from scratch instead of composing from a closed inventory.
                context = "\n".join(
                    ln
                    for ln in context.splitlines()
                    if not ln.startswith("Available morphemes:")
                )
                context = context.replace(
                    "deduce the correct morpheme sequence",
                    "deduce the correct word in the target language",
                )
            t0 = time.time()
            try:
                raw, provider = call_model(
                    context,
                    query["prompt"],
                    args.model,
                    env,
                    provider_name=args.provider,
                    max_tokens=args.max_tokens,
                    temperature=args.temperature,
                )
                elapsed = time.time() - t0
            except Exception as e:
                logging.error(f"[{n}/{total}] {key} ERROR: {e}")
                records.append(
                    {
                        "puzzle": puzzle["id"],
                        "query": query["id"],
                        "difficulty": query.get("difficulty", "?"),
                        "prompt": query["prompt"],
                        "gold": query["answer"],
                        "gold_joined": query.get("answerJoined", ""),
                        "raw": "",
                        "error": str(e),
                        "model": args.model,
                        "provider": args.provider or "failover",
                        "prompt_variant": args.prompt_variant,
                        "trial": args.trial,
                        "puzzles_file": str(args.puzzles_file),
                        "shuffle_seed": args.shuffle_seed,
                    }
                )
                out_path.write_text(json.dumps(records, indent=1, ensure_ascii=False))
                continue

            answer_text = extract_answer_text(raw, context + "\n" + query["prompt"])
            morphemes = parse_morphemes(raw, query["answer"], tiles)
            # '+' never appears in gold data — treat it as a morpheme
            # boundary marker (models emit 'kylä+ssa' for 'kylässä').
            morphemes = [piece for m in morphemes for piece in m.split("+") if piece]
            gold = query["answer"]
            gold_joined = query.get("answerJoined") or "".join(gold)

            def _norm_surface(s: str) -> str:
                # Boundary notation (space, '+') and hyphens are stripped on
                # BOTH sides — 'anak-anak' and 'anak anak' are the same
                # surface form; no gold pair differs only by a hyphen.
                return (
                    normalize_dashes(s)
                    .replace(" ", "")
                    .replace("+", "")
                    .replace("-", "")
                    .strip(".!?;:，。")
                )

            em_decomp = morphemes == gold
            gold_surfaces = {_norm_surface(sf) for sf in surface_forms(gold)}
            em_surface = _norm_surface(answer_text) in gold_surfaces
            pred_joined = "".join(morphemes)
            score_chrf = chrf(pred_joined or answer_text, gold_joined)
            score_f1 = morpheme_f1(morphemes, gold)

            rec = {
                "puzzle": puzzle["id"],
                "query": query["id"],
                "difficulty": query.get("difficulty", "?"),
                "prompt": query["prompt"],
                "gold": gold,
                "gold_joined": gold_joined,
                "raw": raw,
                "answer_text": answer_text,
                "morphemes": morphemes,
                "em_decomp": em_decomp,
                "em_surface": em_surface,
                "chrf": round(score_chrf, 4),
                "morf1": round(score_f1, 4),
                "elapsed_s": round(elapsed, 1),
                "model": args.model,
                "provider": provider,
                "prompt_variant": args.prompt_variant,
                "trial": args.trial,
                "puzzles_file": str(args.puzzles_file),
                "shuffle_seed": args.shuffle_seed,
            }
            records.append(rec)
            mark = "OK" if (em_decomp or em_surface) else "--"
            logging.info(
                f"[{n}/{total}] {puzzle['id']}:{query['id']} "
                f"{rec['difficulty']:9s} {mark} dec={'Y' if em_decomp else 'n'} "
                f"surf={'Y' if em_surface else 'n'} chrf={score_chrf:.2f} "
                f"f1={score_f1:.2f} said={answer_text!r} ({elapsed:.1f}s)"
            )
            out_path.write_text(json.dumps(records, indent=1, ensure_ascii=False))

    summarize(records, args.model, args.prompt_variant)


def summarize(records: list[dict], model: str, variant: str) -> None:
    ok = [r for r in records if "error" not in r]
    scored = [r for r in ok if r.get("difficulty") != "tutorial"]
    if not scored:
        scored = ok

    def agg(rows):
        n = len(rows)
        em_d = sum(r["em_decomp"] for r in rows) / n if n else 0
        em_s = sum(r["em_surface"] for r in rows) / n if n else 0
        ch = sum(r["chrf"] for r in rows) / n if n else 0
        f1 = sum(r["morf1"] for r in rows) / n if n else 0
        return em_d, em_s, ch, f1

    print("\n" + "=" * 64)
    print(f"EVAL SUMMARY — {model} ({variant})")
    print("=" * 64)
    print(
        f"{'split':12s} {'n':>3s} {'EM-decomp':>10s} {'EM-surf':>9s} "
        f"{'chrF':>7s} {'morf1':>7s}"
    )
    for name, rows in [
        ("all", scored),
        ("standard", [r for r in scored if r["difficulty"] == "standard"]),
        ("curveball", [r for r in scored if r["difficulty"] == "curveball"]),
    ]:
        if not rows:
            continue
        em_d, em_s, ch, f1 = agg(rows)
        print(f"{name:12s} {len(rows):3d} {em_d:10.3f} {em_s:9.3f} {ch:7.3f} {f1:7.3f}")

    print("\nper-puzzle (non-tutorial):")
    for p in sorted({r["puzzle"] for r in scored}):
        rows = [r for r in scored if r["puzzle"] == p]
        em_d, em_s, ch, f1 = agg(rows)
        print(
            f"  {p:28s} n={len(rows):2d} EMd={em_d:.2f} EMs={em_s:.2f} "
            f"chrF={ch:.2f} f1={f1:.2f}"
        )


if __name__ == "__main__":
    main()
