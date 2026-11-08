# Eval Report — Grammar Induction in Novel Languages

**Submission for the micro1 Eval Hackathon.**

## The limitation being measured

Frontier LLMs are routinely claimed to "reason" about unfamiliar
languages. We measure the capability precisely — and find the boundary
is not where prior evals suggest.

Our suite separates three things that existing linguistics benchmarks
conflate:

1. **Scaffolded induction** — composing answers from a *given* morpheme
   inventory inside a fixed task frame.
2. **Unconstrained induction** — recovering the grammar itself
   (allomorphy, agreement, suppletion, harmony) from raw evidence, in a
   language that does not exist anywhere.
3. **External validity** — the same models on real olympiad problems
   (Linguini).

> **Given any scaffold — a morpheme bank, minimal evidence, obfuscated
> orthography, even leave-one-out segmentation — frontier models score
> ~0.93–1.00. In procedurally generated languages that cannot exist in
> any training set, the same models span 0.28–0.97 EM depending on the
> model and grammar family — with conditioned structure (suppletion,
> agreement, harmony) driving nearly all remaining errors. On real IOL
> problems they sit at 0.43–0.63.** On the generated suite the spread
> is 0.28 (open 80B) → 0.73 (claude) → 0.90 (gpt) → 0.97 (gemini) — the
> eval cleanly ranks induction ability.

The bottleneck is not pattern completion — it is *inducing conditioned
grammatical structure in a truly novel system*. Models reproduce the
shape of a paradigm but pick the wrong conditioned variant; they
interpolate the attested data instead of inducing the rule that
generates it.

## Eval 1 — Scaffolded morpheme induction (control: solved)

Ten hand-built puzzles (`data/puzzles.json`): bilingual evidence pairs,
a closed morpheme bank, and query items requiring composition. This arm
exists to *bound* the claim — it shows what "easy" looks like.

**Ablations, all on the same 10 puzzles:**

| Arm | Manipulation | Frontier EM |
|---|---|---|
| `canonical` | original orthography | 0.92–1.00 |
| `obf1` | per-character substitution cipher on target language | 0.93–1.00 |
| `shuf1` | evidence rows permuted | 0.93–1.00 |
| `min1` | minimal evidence cover (pairs cut ~8–10 → 2–8) | 0.83–0.97 |
| `seg` | leave-one-out morpheme segmentation (all other pairs shown analyzed) | 0.93–1.00 |

Every scaffold we could construct still solves the task. Orthographic
obfuscation costs nothing — models genuinely induce within a frame —
but *every* frame we gave them was enough. The scaffold is the hidden
variable.

## Eval 2 — Generated languages (PRIMARY)

`scripts/gen_puzzles.py` procedurally generates languages that do not
exist: random morphemes, random phoneme inventories, three grammar
families isolating distinct induction skills. Contamination is
impossible by construction; difficulty is a dial (evidence count,
conditioning depth).

- **`vharm`** — vowel harmony + *long-distance* harmony: the tense
  suffix harmonizes with the root's last vowel; a question enclitic
  harmonizes with the tense suffix's vowel (two-step induction).
- **`circ`** — discontinuous noun-class agreement: verbs carry a
  prefix+suffix circumfix determined by the subject noun's *final
  sound*. Queries give the noun stem and ask for the verb — held-out
  nouns force phonological class induction, not memorization.
- **`supp`** — conditioned suppletion: two verb stems selected by the
  subject prefix's final sound, plus tense allomorphy.

Gold is deterministic; every query's required morphemes are verified
attested in evidence (`puzzles_gen3.json`, seed 23: 24 puzzles / 184
queries; `gen1`/`gen2` are earlier seeds — ~7% underdetermined items
were found and fixed in gen3). `puzzles_gen5.json` (seed 43) adds a
fourth family — polypersonal agreement with conjunctive conditioning —
under the hard profile; it is the hardest family for every frontier
model tested, including Gemini (0.917).

**Results (EM-decomp, 2 trials, `no_hint` prompt):**

| Model | Overall | vowel-harmony | noun-class | suppletion |
|---|---|---|---|---|
| claude-opus-4-8 | **0.725** | 0.760 | 0.804 | 0.616 |
| gpt-5-6-sol | 0.903 | 0.938 | 0.964 | 0.812 |
| gemini-3-1-pro | 0.966 | 0.958 | 0.982 | 0.955 |
| qwen3-next-80b-a3b-instruct | **0.278** | 0.271 | 0.312 | 0.250 |

(gen1/gen2 corroborate across seeds: claude 0.68/0.66, gpt 0.73/0.79,
gemini 0.77/0.81 — same ordering, same family profile; those seeds had
~7% underdetermined items later fixed, so they are conservative lower
bounds.)

**Failure taxonomy** (`analyze_failures.py`): errors concentrate exactly
where the grammar is conditioned — wrong suppletive stem (~20–25% of
suppletion items), wrong agreement allomorph (~12%), harmony allomorph
selection. Models get the *shape* right (right morpheme count, right
slots) and pick the wrong conditioned variant — they interpolate the
attested paradigm instead of inducing the rule that generates it.

## Eval 3 — Linguini (external validation)

`facebook/linguini` test split: 160 problems / ~894 questions, raw
IOL-style, no scaffold. Scores post-`regrade_linguni.py` (recovers
answers emitted outside the `<answers>` protocol; missing = wrong).

| Model | EM | chrF | geo score |
|---|---|---|---|
| claude-opus-4-8 | 0.434 | 0.590 | 0.506 |
| gpt-5-6-sol | 0.598 | 0.649 | 0.623 |
| gemini-3-1-pro | 0.633 | 0.618 | 0.625 |

## Metrics (all deterministic, no LLM judge)

- `em_decomp` — predicted morpheme sequence equals gold.
- `em_surface` — normalized surface form equals gold (unicode dashes,
  spacing, hyphenation normalized; vowel-elision variants accepted).
- `chrf` (β=2), `morf1` — fuzzy metrics on joined forms / morphemes.
- `consistency`, `pass^k-all` — across 3 trials per arm.

## Grader audit

- Gold answers pass: **42/42** hand-built + all generated golds
  structurally validated (morphemes concatenate to source exactly).
- Deliberately corrupted decompositions: **0/19 false passes**.
- Parser fixes applied mid-eval, all re-verified against stored raw
  generations with zero re-spend: morpheme-boundary recovery, unicode
  dash normalization, unterminated `<answers>` recovery, vowel-elision
  segmentation, short-string chrF guard.
- Generated-set validity: every query's content morphemes verified
  attested in evidence; conditioning cells (person × tense × question,
  class × tense, both suppletive stems per verb) guaranteed covered.

## Failure analysis (representative)

### F1 — Wrong conditioned allomorph, right frame (generated `supp`)

Gold `['tula','woja','lo']`, model emits `['tula','nawo','lo']` —
correct person prefix, correct tense suffix, wrong suppletive stem.
The model reproduces the *shape* of the paradigm but picks the stem
variant attested for a different prefix class. Reproduced across
trials and models.

### F2 — Agreement allomorph error on held-out noun class (`circ`)

Gold `['runan','no','nepe','li','su']`, model emits the stop-class
agreement `['rapok','ru',...]` pattern for a nasal-final noun — it
fails to condition the circumfix on the noun's final sound even though
every class is attested in evidence.

### F3 — Long-distance harmony collapse (`vharm`, gen1 curveball)

Question enclitic must harmonize with the *tense suffix's* vowel, not
the root's — a two-step dependency. Claude curveball EM on this item
type: **0.125** (gen1). Even gpt-5-6-sol, strongest overall, shows its
lowest family score here relative to its other results on earlier
seeds.

### F4 — Linguini numeral systems (claude-opus-4-8)

`num_to_text`/`text_to_num` require inducing an entire numeral system
from raw IOL data — the weakest task types (EM ~0.2–0.5 vs ~0.43–0.63
overall).

### F5 — Scaffolded-task systematic errors (custom puzzles)

Even at ~0.95+ EM, failures are structured: Apurinã tense-allomorph
confusion (`kaakutataka` — picks the attested word-final shape over
composition), Turkish vowel-harmony misapplication (`kızler` for
`kızlar` — states the rule correctly, applies it wrong), Zulu
noun-class prefix drop (`ikolo` for `izikolo`). Models pattern-match
attested shapes rather than verify compositional rules — the same
failure mode that becomes fatal once the frame itself must be induced.

## Reproduce

```bash
# scaffolded eval (canonical / obf / shuf / min1)
python3 eval-hackathon/run_eval.py --model claude-opus-4-8 --provider neon \
    --puzzles-file eval-hackathon/data/puzzles.json --trial 1

# generated languages (primary)
python3 scripts/gen_puzzles.py --seed 23 --per-family 8 \
    --out eval-hackathon/data/puzzles_gen3.json
python3 eval-hackathon/run_eval.py --model gpt-5-6-sol --provider neon \
    --puzzles-file eval-hackathon/data/puzzles_gen3.json --trial 1

# Linguini
python3 eval-hackathon/run_linguni_eval.py --model gpt-5-6-sol --provider neon

# analysis (no API cost)
python3 eval-hackathon/aggregate.py --markdown
python3 eval-hackathon/analyze_gen.py eval-hackathon/data/puzzles_gen3.json
python3 eval-hackathon/analyze_failures.py eval-hackathon/data/puzzles_gen3.json
python3 eval-hackathon/regrade.py && python3 eval-hackathon/regrade_linguni.py
```

Dependencies: Python 3.10+, stdlib only. Provider keys via env vars
(`NEON_AI_GATEWAY_TOKEN`, … — see `.env.example`). Runtime: ~5–15 min
per model per 200-query arm. Cost: low hundreds of small completions.

## Provenance

Pre-hackathon (disclosed): `data/puzzles.json`, the Linguini-derived
training pipeline, `scripts/llm_providers.py`, `hf-pipeline/submission/
prompts.py`, and the project's earlier IOL-AI work. Built for this
submission: `eval-hackathon/` (all runners, graders, regraders,
analysis), `scripts/obfuscate_puzzles.py`, `scripts/make_min_pairs.py`,
`scripts/gen_puzzles.py`, the `neon` provider lane, all generated
puzzle files, all runs, analysis, and this report.
