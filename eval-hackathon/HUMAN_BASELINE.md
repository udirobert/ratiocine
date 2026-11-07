# Human baseline protocol

Purpose: prove the generated-language puzzles require *expert judgment*, not
pattern-matching luck — and measure the human/model gap on identical items.

## Materials

Three puzzles from `eval-hackathon/data/puzzles_gen3.json` (seed 23, the
primary eval set), chosen one per family:

| Family | Puzzle id (in file order) | Why |
|---|---|---|
| vowel-harmony | `gen-000`–`gen-005` range | two-step long-distance harmony |
| noun-class agreement | `gen-006`–`gen-011` range | discontinuous circumfix |
| conditioned suppletion | `gen-012`–`gen-017` range | two stacked conditioned rules |

Exact ids are stable — the file is committed and deterministic.

## Procedure

1. Give the solver **only** the puzzle JSON (or a rendered page showing the
   evidence pairs, morpheme bank, hints, and queries — the same context the
   models received in the `no_hint` condition).
2. Time them. Record: total time, per-query correctness, whether they used
   the hints, and any query they could not solve.
3. Score answers with the same deterministic grader:
   `python3 eval-hackathon/regrade.py` accepts stored model raws; for human
   answers, compare `answerJoined` strings directly (join the morphemes with
   no separator) or run them through `run_eval.py`'s scoring path.

## What to report

- EM-decomp per puzzle and overall (exclude `tutorial` queries, as the model
  tables do).
- Time-on-task.
- Qualitative notes: which family was hardest, where they got stuck
  (this feeds the failure taxonomy — human vs model error profiles).

## Solver criteria

Linguistics-curious, comfortable with pattern-finding puzzles (IOL-style).
Not the eval author — blindness matters; the author knows the generative
rules.
