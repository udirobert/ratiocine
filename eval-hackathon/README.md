# Morpheme Induction Eval — micro1 Eval Hackathon submission

An eval measuring whether LLMs can **induce an unfamiliar language's
grammar from bare bilingual evidence** — across three escalating levels
of scaffolding, ending in languages that do not exist anywhere.

## The limitation being measured

IOL-style puzzles present ~7–10 example forms in a language, plus queries
requiring novel morphological composition. Two skills are conflated in
naive evaluations:

1. **Structural induction** — inferring morpheme boundaries, allomorphy and
   templatic patterns from the evidence alone.
2. **Language familiarity** — recognizing Turkish vowel harmony, Finnish
   cases, or Swahili concord because the language is in pre-training data.

Our puzzle set deliberately mixes low-resource languages (Apurinã, Nahuatl,
Māori, Quechua) with well-known ones (Turkish, Finnish, Esperanto,
Indonesian, Swahili, Zulu). The eval separates the two skills with three
conditions:

| Condition | What changes | What it isolates |
|---|---|---|
| `canonical` | original orthography | induction + familiarity |
| `obf1` | target-language strings replaced by an unguessable symbol bijection (English glosses intact) | pure structural induction — no memorized orthography can fire |
| `shuf1` | evidence rows permuted | induction *consistency* — does row order change the inferred paradigm? |

Obfuscation is a per-character bijection that preserves vowel/consonant
classes (vowel harmony stays inferable) and all equality structure, so every
obfuscated puzzle is provably the same reasoning problem — the approach is
inspired by LingOly-TOO (Bean et al., ICLR 2026), adapted to our own puzzle
format.

## Eval tasks

`data/puzzles.json` — 10 puzzles, 42 scored query items across three
difficulty tiers (`standard`, `curveball`; `tutorial` items that copy an
evidence row verbatim are excluded from headline metrics).

Each puzzle: bilingual evidence pairs, a closed morpheme inventory, and
queries. Gold answers are morpheme decompositions; grading also accepts
surface forms (incl. vowel-elision variants like `tu+li+imba → tulimba`).

A secondary, harder benchmark is included for context: the Linguini IOL test
split (160 problems, 5 task types) via `run_linguni_eval.py`.

### Generated languages (primary eval)

`data/puzzles_gen3.json` — 24 puzzles / 184 queries produced by
`scripts/gen_puzzles.py`, a procedural generator for languages that do
not exist (random morphemes, random phoneme inventories, seedable).
Three grammar families isolate distinct induction skills:

- `vharm` — vowel harmony incl. long-distance harmony (question enclitic
  harmonizes with the tense suffix's vowel)
- `circ` — discontinuous noun-class agreement conditioned on the subject
  noun's final sound; queries give the noun stem, forcing phonological
  class induction on held-out nouns
- `supp` — conditioned suppletion (two verb stems selected by the
  subject prefix's final sound) + tense allomorphy

Evidence coverage is guaranteed by construction: every person prefix,
verb root, conditioning cell (class × tense, harmony class × tense ×
question, both suppletive stems per verb) is attested. Earlier seeds
(`puzzles_gen1.json`, `puzzles_gen2.json`) are kept for corroboration —
~7% underdetermined items were found in them and fixed in gen3.

Two further ablations on the hand-built set: `puzzles_min1.json`
(minimal evidence cover via `scripts/make_min_pairs.py`) and the
leave-one-out segmentation eval (`run_seg_eval.py`).

## Grader

Deterministic, no LLM judge:

- `em_decomp` — predicted morpheme sequence == gold decomposition.
- `em_surface` — predicted surface form == gold, after normalizing boundary
  notation (spaces, `+`, `-` stripped on both sides; verified no two gold
  answers collide under this normalization).
- `chrf` — character n-gram F-score (β=2) for partial credit.
- `morf1` — bag-of-morphemes F1.

The parser tolerates `<answers>` tags, think-tags, numbered lists, joined
spellings (segmented back through the tile bank via longest-match
backtracking), and bracket-wrapped answers. Grader reliability was audited:
reference (gold) answers pass, deliberately corrupted answers fail, and the
normalization was checked for collisions across all 42 gold items.

## Running

```bash
# prerequisite: provider key in env (see .env.example)
# OPENROUTER_API_KEY / GROQ_API_KEY / NEON_AI_GATEWAY_TOKEN+BASE_URL / ...

# single run
python3 eval-hackathon/run_eval.py --model claude-opus-4-8 --provider neon \
    --puzzles-file eval-hackathon/data/puzzles_obf_1.json --trial 1

# full sweep: 3 conditions x 3 trials (canonical+obf), 1 trial (shuffle)
bash eval-hackathon/run_sweep.sh neon claude-opus-4-8 gpt-5-6-sol gemini-3-1-pro
bash eval-hackathon/run_sweep.sh groq openai/gpt-oss-120b qwen/qwen3.8-27b

# re-grade stored raw generations after grader changes (no API cost)
python3 eval-hackathon/regrade.py

# aggregate trials into the results table
python3 eval-hackathon/aggregate.py --markdown

# regenerate the obfuscated puzzle file
python3 scripts/obfuscate_puzzles.py --seed 1 \
    --output eval-hackathon/data/puzzles_obf_1.json

# regenerate / extend the generated-language suite
python3 scripts/gen_puzzles.py --seed 23 --per-family 8 \
    --out eval-hackathon/data/puzzles_gen3.json

# generated-language eval + per-family analysis
python3 eval-hackathon/run_eval.py --model gpt-5-6-sol --provider neon \
    --puzzles-file eval-hackathon/data/puzzles_gen3.json --trial 1
python3 eval-hackathon/analyze_gen.py eval-hackathon/data/puzzles_gen3.json
python3 eval-hackathon/analyze_failures.py eval-hackathon/data/puzzles_gen3.json

# minimal-evidence ablation + leave-one-out segmentation eval
python3 scripts/make_min_pairs.py --input data/puzzles.json \
    --output eval-hackathon/data/puzzles_min1.json
python3 eval-hackathon/run_seg_eval.py --model claude-opus-4-8 --provider neon --trial 1
```

## Results

See `RESULTS.md`.

## Provenance

The puzzle dataset (`data/puzzles.json`), the LLM provider registry
(`scripts/llm_providers.py`), the answer parser (`hf-pipeline/submission/
prompts.py`) and the morpheme-segmentation/grading logic
(`scripts/run_models_for_ltb.py`) all predate this hackathon — they were
built for the ratiocine IOL-AI project. Built during the hackathon: the
obfuscation transform (`scripts/obfuscate_puzzles.py`), the minimal-cover
ablation (`scripts/make_min_pairs.py`), the language generator
(`scripts/gen_puzzles.py`), the eval harness (`eval-hackathon/` — runners,
regraders, aggregation, failure taxonomy), the `neon` provider lane, all
generated puzzle files, all runs, analysis, and this report. AI
coding tools (Devin) drafted the harness code; every task, gold answer and
grading rule was written and verified by the author beforehand, and all
model transcripts were manually inspected.
