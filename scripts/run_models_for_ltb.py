#!/usr/bin/env python3
"""Run IOL models on Ratiocine puzzles and capture LTB-style outputs."""

import argparse
import json
import logging
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(message)s")

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "hf-pipeline" / "submission"))
sys.path.insert(0, str(ROOT / "scripts"))

import llm_providers  # noqa: E402
from prompts import (  # noqa: E402
    SYSTEM_PROMPT,
    USER_TEMPLATE,
    get_system_prompt,
    parse_answers,
)

PUZZLES_PATH = ROOT / "data" / "puzzles.json"
OUTPUTS_PATH = ROOT / "data" / "ltb_model_outputs.json"

# The stock IOL system prompt asks for "the EXACT target-language form", so a
# model that answers `tulimba` is following instructions while our gold is the
# tile decomposition. This arm makes the required output format explicit so the
# two representations can be measured against the same recordings.
DECOMPOSITION_INSTRUCTION = (
    "Answer format (REQUIRED): for the query, output ONLY its morphemes taken from "
    "the available morphemes list, separated by single spaces, in order. Never "
    "write the combined word."
)

# First 5 rare-language puzzles (matching export_to_ltb.py)
LTB_PUZZLE_IDS = [
    "apurina-verb-agreement",
    "swahili-person-tense",
    "turkish-vowel-harmony",
    "quechua-person-endings",
    "nahuatl-both-ends",
]


def load_env() -> dict[str, str]:
    """Read .env from repo root (no python-dotenv dependency)."""
    env: dict[str, str] = {}
    dotenv = ROOT / ".env"
    if not dotenv.exists():
        dotenv = ROOT / ".env.example"
    if dotenv.exists():
        with open(dotenv) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                env[key] = value.strip().strip('"')
    return env


def call_model(
    context: str,
    query: str,
    model: str,
    env: dict[str, str],
    provider_name: str | None = None,
    max_tokens: int = 512,
    task_type: str = "translation",
) -> tuple[str, str]:
    """Call an OpenAI-compatible endpoint with retry/failover.

    Returns (raw_output, provider_name). provider_name=None tries every
    configured provider in registry order.
    """
    system = (
        get_system_prompt(task_type)
        if task_type
        in ("translation", "fill_blanks", "text_to_num", "num_to_text", "match_letters")
        else SYSTEM_PROMPT
    )

    messages = [
        {"role": "system", "content": system},
        {
            "role": "user",
            "content": USER_TEMPLATE.format(
                context=context.strip(), query=query.strip()
            ),
        },
    ]

    # CoT traces run long; 512 truncated them mid-analysis in the first sweep
    payload = llm_providers.build_payload(model, messages, max_tokens=max_tokens)

    if provider_name:
        provider = next(
            (p for p in llm_providers.PROVIDERS if p["name"] == provider_name), None
        )
        if provider is None or provider["env_key"] not in env:
            raise RuntimeError(f"provider {provider_name!r} unknown or key missing")
        return llm_providers.call_chat(env, provider, payload), provider["name"]
    return llm_providers.call_with_failover(env, payload)


def build_context(puzzle: dict, query: dict, prompt_variant: str = "default") -> str:
    """Build IOL few-shot context for the model."""
    evidence = "\n".join(
        f"- {row['source']} → {row['target']}" for row in puzzle["pairs"]
    )
    tiles = [m for group in puzzle["morphemeBank"] for m in group]
    hints = "\n".join(h["text"] for h in puzzle["hints"])
    if prompt_variant == "no_hint":
        hints = "(none — deduce the pattern from the evidence alone)"
    context = (
        "Given the following bilingual evidence pairs and a tile bank of morphemes, "
        "deduce the correct morpheme sequence for the query.\n\n"
        f"Evidence:\n{evidence}\n\n"
        f"Available morphemes: {', '.join(tiles)}\n\n"
        f"Hint:\n{hints}\n\n"
        f"Query: {query['prompt']}"
    )
    if prompt_variant == "decomposition":
        context += "\n\n" + DECOMPOSITION_INSTRUCTION
    return context


VOWELS = set("aeiouã")


def segment_from_bank(joined: str, tiles: list[str]) -> list[str] | None:
    """Segment a joined word using the puzzle's tile bank.

    Longest-tile-first with backtracking: a greedy prefix walk silently fails on
    banks with overlapping tiles ('a' inside 'kaa'), which is what made the first
    sweeps grade correct answers as wrong.
    """
    bank = sorted(set(tiles), key=len, reverse=True)
    memo: dict[int, list[str] | None] = {}

    def walk(i: int) -> list[str] | None:
        if i == len(joined):
            return []
        if i in memo:
            return memo[i]
        for tile in bank:
            if joined.startswith(tile, i):
                rest = walk(i + len(tile))
                if rest is not None:
                    memo[i] = [tile, *rest]
                    return memo[i]
        memo[i] = None
        return None

    return walk(0)


def surface_forms(morphs: list[str]) -> set[str]:
    """Joined spellings a model may legitimately produce for a decomposition.

    Includes the vowel-elided form, because Bantu-style boundary phonology makes
    'tu'+'li'+'imba' surface as 'tulimba', not 'tuliimba'.
    """
    exact = "".join(morphs)
    elided = ""
    for m in morphs:
        if elided and elided[-1] in VOWELS and m and m[0] in VOWELS:
            elided += m[1:]
        else:
            elided += m
    return {exact, elided}


def parse_morphemes(
    raw: str, gold: list[str], tiles: list[str] | None = None
) -> list[str]:
    """Parse a single answer string into morphemes."""
    tiles = tiles or []
    # Extract first line from model output (parse_answers returns per-item answers)
    parsed = parse_answers(raw, n_expected=1, task_type="translation")
    if not parsed:
        return []
    answer = parsed[0].strip()
    # Strip punctuation and split on whitespace
    answer = answer.strip(".!?;:，。")
    # Some models join morphemes with no spaces; if the gold answer is a known
    # segmentation, try to recover by finding contiguous morpheme pieces.
    if " " not in answer:
        segmented = segment_from_bank(answer.replace("-", ""), tiles) or []
        if segmented:
            return segmented
        return split_joined_morphemes(answer, gold)
    return [m.strip() for m in re.split(r"\s+", answer) if m.strip()]


def split_joined_morphemes(joined: str, gold: list[str]) -> list[str]:
    """Attempt to split a joined answer into known morphemes."""
    result: list[str] = []
    remaining = joined
    for morph in gold:
        if remaining.startswith(morph):
            result.append(morph)
            remaining = remaining[len(morph) :]
    if not remaining:
        return result
    # Fallback: return the joined string as a single token if we can't segment
    return [joined]


def main():
    parser = argparse.ArgumentParser(
        description="Run models on Ratiocine puzzles for LTB"
    )
    parser.add_argument(
        "--model",
        default="Qwen/Qwen2.5-14B-Instruct-AWQ",
        help="Model ID on the provider",
    )
    parser.add_argument(
        "--provider",
        default=None,
        help="Pin a provider (arkor|openrouter|groq|featherless|google); default: try all configured",
    )
    parser.add_argument(
        "--limit", type=int, default=0, help="Max queries to run (0 = all)"
    )
    parser.add_argument(
        "--max-tokens",
        type=int,
        default=2048,
        help="Max output tokens (512 truncated CoT traces in the first sweep)",
    )
    parser.add_argument(
        "--outputs",
        type=Path,
        default=OUTPUTS_PATH,
        help="Output JSON to read/append (use one file per model to run sweeps "
        "in parallel, then merge)",
    )
    parser.add_argument(
        "--prompt-variant",
        choices=["default", "decomposition", "no_hint"],
        default="default",
        help="default: stock IOL prompt (asks for the target-language form); "
        "decomposition: same prompt + explicit space-separated tile output; "
        "no_hint: evidence only, hint block withheld",
    )
    args = parser.parse_args()

    env = load_env()
    providers = llm_providers.available_providers(env)
    if not providers:
        logging.error(
            "Error: no provider keys set in .env — configure one of "
            "ARKOR_API_KEY / OPENROUTER_API_KEY / GROQ_API_KEY / FEATHERLESS_API_KEY"
            " / GOOGLE_API_KEY"
        )
        sys.exit(1)

    with open(PUZZLES_PATH) as f:
        puzzles = json.load(f)

    selected = [p for p in puzzles if p["id"] in LTB_PUZZLE_IDS]
    if not selected:
        selected = puzzles[:5]

    # Load existing outputs (resume-safe)
    outputs: dict[str, list[dict]] = {}
    if args.outputs.exists():
        with open(args.outputs) as f:
            outputs = json.load(f)

    queries_to_run: list[tuple[dict, dict]] = []
    for puzzle in selected:
        for query in puzzle["queries"]:
            queries_to_run.append((puzzle, query))

    if args.limit:
        queries_to_run = queries_to_run[: args.limit]

    logging.info(f"[run] {len(queries_to_run)} queries with {args.model}")
    logging.info(
        f"[run] Prompt variant: {args.prompt_variant} | Providers: "
        + (args.provider or ", ".join(p["name"] for p in providers))
    )

    for i, (puzzle, query) in enumerate(queries_to_run):
        key = f"{puzzle['id']}:{query['id']}"
        tiles = [m for group in puzzle["morphemeBank"] for m in group]
        # Skip if this model+variant already has a result for this query
        if key in outputs and any(
            o["model"] == args.model
            and o.get("prompt_variant", "default") == args.prompt_variant
            for o in outputs[key]
        ):
            logging.info(f"  [{i + 1}/{len(queries_to_run)}] {key} — already run")
            continue

        context = build_context(puzzle, query, args.prompt_variant)
        t0 = time.time()
        try:
            raw, provider = call_model(
                context,
                query["prompt"],
                args.model,
                env,
                provider_name=args.provider,
                max_tokens=args.max_tokens,
            )
            elapsed = time.time() - t0
            lines = parse_answers(raw, n_expected=1, task_type="translation")
            answer_text = lines[0].strip().strip(".!?;:，。") if lines else ""
            answer = parse_morphemes(raw, query["answer"], tiles)
            # Two independent grades from one recording: does the answer equal the
            # tile decomposition, and does it equal an attested surface form?
            em_decomp = answer == query["answer"]
            em_surface = answer_text.replace(" ", "").replace("-", "") in (
                surface_forms(query["answer"])
            )
            status = f"{'✓' if em_decomp else '✗'}dec {'✓' if em_surface else '✗'}surf"
            logging.info(
                f"  [{i + 1}/{len(queries_to_run)}] {key} {status} "
                f"({elapsed:.1f}s) said={answer_text!r} segmented={answer}"
            )
            outputs.setdefault(key, []).append(
                {
                    "model": args.model,
                    "provider": provider,
                    "prompt_variant": args.prompt_variant,
                    "raw": raw,
                    "answer": answer,
                    "answer_text": answer_text,
                }
            )
        except urllib.error.HTTPError as e:
            logging.error(
                f"  [{i + 1}/{len(queries_to_run)}] {key} HTTP {e.code}: {e.reason}"
            )
            # Save progress before stopping
            with open(args.outputs, "w") as f:
                json.dump(outputs, f, indent=2, ensure_ascii=False)
            raise
        except Exception as e:
            logging.error(f"  [{i + 1}/{len(queries_to_run)}] {key} ERROR: {e}")

        # Save after every query so we can resume
        with open(args.outputs, "w") as f:
            json.dump(outputs, f, indent=2, ensure_ascii=False)

    logging.info(f"[run] Done. Outputs saved to {args.outputs}")


if __name__ == "__main__":
    main()
