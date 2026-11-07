# Video walkthrough script (~4 min)

Screen recording + voiceover. Terminal visible throughout; results tables
from `aggregate.py --markdown` on screen.

## 0:00–0:40 — The claim

> "Every linguistics eval hands the model a scaffold — a morpheme bank, a
> worked example. We asked: what happens when the language doesn't exist
> at all? These are procedurally generated grammars — random morphemes,
> random phoneme inventories, conditioned rules. Memorization is impossible
> by construction."

Show `scripts/gen_puzzles.py` docstring (the four families) + one generated
puzzle's evidence pairs.

## 0:40–1:30 — The task

Open `eval-hackathon/data/puzzles_gen3.json` → one puzzle per family:
- vharm: evidence pairs, query, morpheme bank
- circ: discontinuous agreement
- supp: conditioned suppletion

Show `run_eval.py` invocation + one stored raw generation + grader verdict.

## 1:30–2:30 — Results: the boundary

`aggregate.py --markdown` — the money table:

| Eval | claude | gpt | gemini | qwen |
|---|---|---|---|---|
| scaffolded (all ablations) | ~0.94 | ~0.97 | ~1.00 | ~0.93 |
| generated languages | 0.73 | 0.90 | 0.97 | 0.28 |
| Linguini (real IOL) | 0.43 | 0.60 | 0.63 | — |

> "Same models. The only thing that changed is whether the problem had to
> be discovered or could be looked up."

Per-family breakdown: errors concentrate on conditioned allomorphy —
show `analyze_failures.py` output (36% wrong suppletive stem etc.).

## 2:30–3:15 — gen4/gen5: harder conditioning

> "We made it harder — consonant-class harmony, then polypersonal
> agreement where one verb answers to two nouns at once."

Show gen4 table (claude 0.78 / gpt 0.89 / gemini 0.96) + gen5 syn-family
results when available.

## 3:15–3:45 — Grader integrity + reproduce

```bash
python3 eval-hackathon/regrade.py          # re-grade raws, $0
python3 eval-hackathon/aggregate.py --markdown
python3 scripts/gen_puzzles.py --seed 99 --per-family 6 --out /tmp/fresh.json
```

Gold 42/42 pass, corrupted 0/19 false-pass, stored raws → every number
verifiable without API keys. Fresh seed = fresh languages judges can test.

## 3:45–4:15 — Close

> "The limitation isn't that models can't do morphology — they ace it
> when you hand them the frame. It's that they can't reliably discover
> conditioned structure in a language that has never existed. That's the
> eval."

End card: repo path + `eval-hackathon/REPORT.md` + submission zip.
