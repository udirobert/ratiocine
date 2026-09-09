#!/usr/bin/env python3
"""Run IOL models on Ratiocine puzzles and capture LTB-style outputs."""

import argparse
import json
import logging
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(message)s")

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "hf-pipeline" / "submission"))

from prompts import (  # noqa: E402
    SYSTEM_PROMPT,
    USER_TEMPLATE,
    get_system_prompt,
    parse_answers,
)

PUZZLES_PATH = ROOT / "data" / "puzzles.json"
OUTPUTS_PATH = ROOT / "data" / "ltb_model_outputs.json"

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
    endpoint: str,
    api_key: str,
    max_tokens: int = 512,
    task_type: str = "translation",
) -> str:
    """Call the Arkor OpenAI-compatible chat endpoint."""
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

    # GPT-5 / o-series don't accept max_tokens or temperature
    if any(m in model for m in ["gpt-5", "o1", "o3"]):
        payload = {
            "model": model,
            "messages": messages,
        }
    else:
        payload = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0,
        }

    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )

    with urllib.request.urlopen(
        req, timeout=120, context=ssl._create_unverified_context()
    ) as resp:
        data = json.loads(resp.read())

    return data["choices"][0]["message"]["content"]


def build_context(puzzle: dict, query: dict) -> str:
    """Build IOL few-shot context for the model."""
    evidence = "\n".join(
        f"- {row['source']} → {row['target']}" for row in puzzle["pairs"]
    )
    tiles = [m for group in puzzle["morphemeBank"] for m in group]
    hints = "\n".join(h["text"] for h in puzzle["hints"])
    return (
        "Given the following bilingual evidence pairs and a tile bank of morphemes, "
        "deduce the correct morpheme sequence for the query.\n\n"
        f"Evidence:\n{evidence}\n\n"
        f"Available morphemes: {', '.join(tiles)}\n\n"
        f"Hint:\n{hints}\n\n"
        f"Query: {query['prompt']}"
    )


def parse_morphemes(raw: str, gold: list[str]) -> list[str]:
    """Parse a single answer string into morphemes."""
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
        "--model", default="Qwen/Qwen2.5-14B-Instruct-AWQ", help="Model ID on Arkor"
    )
    parser.add_argument(
        "--limit", type=int, default=0, help="Max queries to run (0 = all)"
    )
    parser.add_argument("--max-tokens", type=int, default=512, help="Max output tokens")
    args = parser.parse_args()

    env = load_env()
    endpoint = env.get("ARKOR_ENDPOINT_URL", os.getenv("ARKOR_ENDPOINT_URL", ""))
    api_key = env.get("ARKOR_API_KEY", os.getenv("ARKOR_API_KEY", ""))

    if not endpoint or not api_key:
        logging.error("Error: ARKOR_ENDPOINT_URL and ARKOR_API_KEY must be set in .env")
        sys.exit(1)

    with open(PUZZLES_PATH) as f:
        puzzles = json.load(f)

    selected = [p for p in puzzles if p["id"] in LTB_PUZZLE_IDS]
    if not selected:
        selected = puzzles[:5]

    # Load existing outputs (resume-safe)
    outputs: dict[str, list[dict]] = {}
    if OUTPUTS_PATH.exists():
        with open(OUTPUTS_PATH) as f:
            outputs = json.load(f)

    queries_to_run: list[tuple[dict, dict]] = []
    for puzzle in selected:
        for query in puzzle["queries"]:
            queries_to_run.append((puzzle, query))

    if args.limit:
        queries_to_run = queries_to_run[: args.limit]

    logging.info(f"[run] {len(queries_to_run)} queries with {args.model}")
    logging.info(f"[run] Endpoint: {endpoint}")

    for i, (puzzle, query) in enumerate(queries_to_run):
        key = f"{puzzle['id']}:{query['id']}"
        # Skip if this model already has a result for this query
        if key in outputs and any(o["model"] == args.model for o in outputs[key]):
            logging.info(f"  [{i + 1}/{len(queries_to_run)}] {key} — already run")
            continue

        context = build_context(puzzle, query)
        t0 = time.time()
        try:
            raw = call_model(
                context,
                query["prompt"],
                args.model,
                endpoint,
                api_key,
                max_tokens=args.max_tokens,
            )
            elapsed = time.time() - t0
            answer = parse_morphemes(raw, query["answer"])
            correct = answer == query["answer"]
            status = "✓" if correct else "✗"
            logging.info(
                f"  [{i + 1}/{len(queries_to_run)}] {key} {status} "
                f"({elapsed:.1f}s) answer={answer}"
            )
            outputs.setdefault(key, []).append(
                {
                    "model": args.model,
                    "raw": raw,
                    "answer": answer,
                }
            )
        except urllib.error.HTTPError as e:
            logging.error(
                f"  [{i + 1}/{len(queries_to_run)}] {key} HTTP {e.code}: {e.reason}"
            )
            # Save progress before stopping
            with open(OUTPUTS_PATH, "w") as f:
                json.dump(outputs, f, indent=2, ensure_ascii=False)
            raise
        except Exception as e:
            logging.error(f"  [{i + 1}/{len(queries_to_run)}] {key} ERROR: {e}")

        # Save after every query so we can resume
        with open(OUTPUTS_PATH, "w") as f:
            json.dump(outputs, f, indent=2, ensure_ascii=False)

    logging.info(f"[run] Done. Outputs saved to {OUTPUTS_PATH}")


if __name__ == "__main__":
    main()
