"""
IOL dataset preparation — convert IOL problems into instruction fine-tuning format.
"""

import json
from pathlib import Path
from typing import Any

SYSTEM_PROMPT = (
    "You solve International Linguistics Olympiad problems. "
    "Answer every numbered item. Put each answer on its own line, "
    "in order, with no numbering and no extra text."
)


def format_chat(context: str, query: str, answers: list[str]) -> dict[str, Any]:
    """Format one IOL problem as a chat template example."""
    return {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"{context}\n\n{query}"},
            {
                "role": "assistant",
                "content": "\n".join(answers),
            },
        ]
    }


def load_synthetic_data(path: str | Path) -> list[dict[str, Any]]:
    """Load synthetic IOL problems from a JSONL file.

    Each line: { "context": str, "query": str, "answers": [str, ...] }
    """
    examples = []
    path = Path(path)

    if not path.exists():
        print(f"[dataset] {path} not found — using demo examples")
        return _demo_examples()

    with open(path) as f:
        for line in f:
            item = json.loads(line)
            examples.append(
                format_chat(item["context"], item["query"], item["answers"])
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

    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=str, help="Path to input JSONL")
    parser.add_argument("--output", type=str, default="data/iol_train.jsonl")
    args = parser.parse_args()

    examples = load_synthetic_data(args.input) if args.input else _demo_examples()
    save_as_jsonl(examples, args.output)
