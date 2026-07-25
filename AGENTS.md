# AGENTS.md — ratiocine

Guidance for AI agents (and humans) working on this project.

## What this is

An IOL-AI 2026 competitor. The goal: submit a `script.py` to a public Hugging Face repo that solves International Linguistics Olympiad problems. Deadline: **July 26, 2026, 23:59 UTC** (the competition is only a few days long).

## Current status (as of 2025-07-25)

- Git repo initialized and pushed to `github.com/udirobert/ratiocine` (branch `main`)
- Pre-commit hooks installed: `detect-secrets` (with baseline), `ruff` lint+format, and `pre-commit-hooks` (large-file guard, private-key check, YAML/TOML/JSON validation, whitespace hygiene)
- `pyproject.toml` configures ruff (py310 target, isort/bugbear/simplify; RUF001/002/003 disabled because linguistic data legitimately uses glottal stops, IPA, en dashes)
- Local `.env` (gitignored) holds credentials; `.env.example` (tracked) documents the variables
- Arkor live endpoint verified working: `https://rationcine.arkor.app/v1/chat/completions` with key `ARKOR_API_KEY`
- Available models on the Arkor endpoint: `anthropic/claude-opus-5`, `google/gemini-3-1-pro-preview`, `google/gemini-3-5-flash-lite`, `google/gemini-3-6-flash`, `google/gemma-4-31b-it`, `openai/gpt-5-6-sol`
- **HF token still needed** in `.env` (`HF_TOKEN=` is blank) — required before training or pushing the submission repo
- Only 2 synthetic training examples exist in `data/synthetic/iol_train.jsonl` — far too few for real fine-tuning

## Two-track approach

### Track 1: Arkor rapid prototyping (`src/arkor/`)

Arkor is a TypeScript fine-tuning framework. Use it to validate training data format and model approach in ~10 min runs.

```bash
pnpm dev           # opens Studio at localhost:4000
```

The `trainer.ts` has a `onCheckpoint` callback that does mid-run evaluation against a sample IOL problem. If the model can solve the sample, the approach works. The `translate` template is the closest starting point.

**Model note:** `trainer.ts` references `gemma-4-E4B-it`, but the verified model ID on the Arkor live endpoint is `google/gemma-4-31b-it`. Update before running training.

**Limitations:** Arkor can't export trained models or self-host inference. Use it only for fast validation, not the final submission.

### Track 2: HF production pipeline (`hf-pipeline/`)

The actual submission pipeline. Fine-tune Qwen2.5-7B (or 3B) with `SFTTrainer` + 4-bit bitsandbytes, push to HF Hub, and wrap in `script.py`.

```bash
cd hf-pipeline
pip install -r requirements.txt
python dataset.py                      # generate training data
python train.py                        # fine-tune (needs GPU)
# then follow submission/README.md to push to HF
```

`train.py` auto-loads `.env` via `python-dotenv` before reading `MODEL_NAME`, `DATASET_PATH`, `OUTPUT_DIR`, `HF_REPO_ID`.

The submission format:
- Model weights + `script.py` in a **public** HF model repo
- `script.py` reads `/tmp/data/test.csv`, writes `submission.csv`
- No internet at eval time — everything must be in the repo
- T4 16GB, 30 min limit, bitsandbytes + autoawq pre-installed

## Data format

The competition uses the Linguini format. Each row of `test.csv` has:
- `id` — problem ID (echo back unchanged)
- `context` — problem data (bilingual examples, hints)
- `query` — numbered items to answer
- `work_lang` — instruction language (FLORES code)
- `task_lang` — problem language (FLORES code)
- `task_type` — e.g. translation, fill_blanks, text_to_num
- `eval_type` — single or multi (multi accepts multiple correct answers)

Training data lives in `data/synthetic/iol_train.jsonl` as chat-format messages. Add more synthetic problems to improve the model.

## Scoring

score = √(exact_match_weighted · chrF)

Geometric mean of weighted exact match and character n-gram overlap. Both needed — exact hits alone or fuzzy overlap alone won't score well. Add an `explanation` column to opt into the human jury track.

## Synthetic data generation

To create more training data:
1. Find past IOL problems (ioling.org has archives)
2. Reformat into the instruction format in `dataset.py`
3. Add to `data/synthetic/iol_train.jsonl`

## Project structure

```
ratiocine/
├── src/arkor/              # Arkor rapid prototyping (TypeScript)
│   ├── index.ts            # createArkor entry point
│   └── trainer.ts          # createTrainer for IOL fine-tuning
├── data/synthetic/         # Training data
├── hf-pipeline/            # Hugging Face production pipeline
│   ├── dataset.py          # Data preparation
│   ├── train.py            # SFTTrainer fine-tuning
│   ├── requirements.txt
│   └── submission/
│       ├── script.py       # Competition submission harness
│       └── README.md       # HF repo setup instructions
├── notebooks/              # Exploration
├── .env.example            # Tracked template for env vars
├── .gitignore
├── .pre-commit-config.yaml # Secrets + linting hooks
├── .secrets.baseline       # detect-secrets baseline
├── AGENTS.md
├── README.md
├── package.json
├── pyproject.toml          # ruff config
├── tsconfig.json
└── arkor.config.ts
```
