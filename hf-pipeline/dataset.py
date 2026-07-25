"""
IOL dataset preparation — convert IOL problems into instruction fine-tuning format.

Can load from:
1. The Linguini HuggingFace dataset (facebook/linguini) — 160 problems
2. A local JSONL file with {context, query, answers} format
3. Demo examples (fallback)

Uses task-specific system prompts from prompts.py for better training signal.
"""

import ast
import json

# Task-specific prompts (imported from submission/prompts.py)
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).parent / "submission"))
from prompts import get_system_prompt


def format_chat(
    context: str,
    query: str,
    answers: list[str | list[str]],
    task_type: str = "",
) -> dict[str, Any]:
    """Format one IOL problem as a chat template example.

    Args:
        context: The problem data (bilingual examples, hints).
        query: The instruction + numbered items to answer.
        answers: List of answers. For multi-correct items, a list of lists
                 where each inner list is acceptable answers for that item.
                 We take the first acceptable answer for training.
        task_type: The task type (translation, fill_blanks, etc.) for
                   task-specific system prompts.
    """
    # Flatten multi-correct: take first acceptable answer per item
    flat_answers = []
    for a in answers:
        if isinstance(a, list):
            flat_answers.append(a[0] if a else "")
        else:
            flat_answers.append(a)

    system_prompt = get_system_prompt(task_type)

    return {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"{context}\n\n{query}"},
            {
                "role": "assistant",
                "content": "\n".join(flat_answers),
            },
        ]
    }


def load_linguini() -> list[dict[str, Any]]:
    """Load all 160 Linguini problems and format as training examples."""
    from datasets import load_dataset

    ds = load_dataset("facebook/linguini", split="test")
    examples = []

    for problem in ds:
        context = problem["context"]
        query = problem["query"]
        task_type = problem["task_type"]
        gold = problem["answer"]

        if isinstance(gold, str):
            gold = ast.literal_eval(gold)

        examples.append(format_chat(context, query, gold, task_type))

    print(f"[dataset] loaded {len(examples)} Linguini problems")
    return examples


def load_synthetic_data(path: str | Path) -> list[dict[str, Any]]:
    """Load synthetic IOL problems from a local JSONL file.

    Supports two formats:
    1. Chat format: { "messages": [{"role": ..., "content": ...}, ...] }
    2. Raw format: { "context": str, "query": str, "answers": [str, ...] }
    """
    examples = []
    path = Path(path)

    if not path.exists():
        print(f"[dataset] {path} not found — using demo examples")
        return _demo_examples()

    with open(path) as f:
        for line in f:
            item = json.loads(line)
            if "messages" in item:
                # Already in chat format — use as-is
                examples.append(item)
            else:
                # Raw format — convert to chat
                task_type = item.get("task_type", "")
                examples.append(
                    format_chat(
                        item["context"],
                        item["query"],
                        item["answers"],
                        task_type,
                    )
                )

    print(f"[dataset] loaded {len(examples)} examples from {path}")
    return examples


def _demo_examples() -> list[dict[str, Any]]:
    """Fallback demo examples if no dataset is provided."""
    return [
        format_chat(
            context="Here are sentences in Hakhun with English:\n"
            "ŋa ka kɤ ne | Do I go?\n"
            "nɤ ʒip tuʔ ne | Did you sleep?\n"
            "ŋa ʒip kɤ ne | I sleep.\n"
            "nɤ ka tuʔ ne | Did you go?",
            query="Translate into English:\n1. nɤ ʒip ku ne\n2. ŋa ka tuʔ ne",
            answers=["Do you sleep?", "Did I go?"],
            task_type="translation",
        ),
        format_chat(
            context="Squares of 1–10 in Ndom, in arbitrary order:\n"
            "mer an thef abo thonith\n"
            "nif thef abo tondor abo mer abo thonith\n"
            "mer an thef abo tondor abo ithin\n"
            "nif abo ithin\n"
            "nif abo tondor abo mer abo thonith\n"
            "mer an thef abo tondor abo tondor abo thonith\n"
            "mer abo thonith\n"
            "nif thef abo tondor abo tondor abo thonith\n"
            "nif thef abo mer abo thonith\n"
            "mer an thef abo tondor abo tondor abo ithin",
            query="Write in numerals:\n"
            "1. nif ithin abo ithin\n"
            "2. nif thef abo tondor abo mer abo thonith",
            answers=["111", "784"],
            task_type="text_to_num",
        ),
    ]


def save_as_jsonl(examples: list[dict[str, Any]], output_path: str | Path) -> None:
    """Save formatted examples as JSONL for Arkor or HF training."""
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w") as f:
        for ex in examples:
            f.write(json.dumps(ex, ensure_ascii=False) + "\n")

    print(f"[dataset] saved {len(examples)} examples to {output_path}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Prepare IOL training data")
    parser.add_argument(
        "--source",
        choices=["linguini", "file", "demo"],
        default="linguini",
        help="Data source: linguini (HF dataset), file (local JSONL), or demo",
    )
    parser.add_argument(
        "--input", type=str, help="Path to input JSONL (for --source file)"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="data/synthetic/iol_train.jsonl",
        help="Output JSONL path",
    )
    args = parser.parse_args()

    if args.source == "linguini":
        examples = load_linguini()
    elif args.source == "file" and args.input:
        examples = load_synthetic_data(args.input)
    else:
        examples = _demo_examples()

    save_as_jsonl(examples, args.output)
