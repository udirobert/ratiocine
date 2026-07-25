# AGENTS.md — ratiocine

Guidance for AI agents (and humans) working on this project.

## What this is

An IOL-AI 2026 competitor. The goal: submit a `script.py` to a public Hugging Face repo that solves International Linguistics Olympiad problems. Deadline: **July 26, 2026, 23:59 UTC** (the competition is only a few days long).

## Current status (as of 2026-07-25)

- Git repo at `github.com/udirobert/ratiocine` (branch `main`), pushed and up to date
- Pre-commit hooks: `detect-secrets`, `ruff` lint+format, file hygiene
- `pyproject.toml` configures ruff (py310, isort/bugbear/simplify; RUF001/002/003 disabled for linguistic data)
- Local `.env` holds: `HF_TOKEN`, `ARKOR_API_KEY`, `ARKOR_ENDPOINT_URL` (all gitignored)
- `.env.example` documents all env vars; Modal token configured (`~/.modal.toml`, workspace `papaandthejimjams`)
- Arkor endpoint verified: 6 models available (Gemma 4 31B, Gemini 3.6 Flash, GPT-5, etc.)
- 160 Linguini problems converted to training data in `data/synthetic/iol_train.jsonl`
- Task-specific prompting system in `hf-pipeline/submission/prompts.py` (5 task types)
- Local test harness in `hf-pipeline/test_local.py` (tests against Linguini via Arkor API)
- Zero-shot baseline: Score 0.235 (Gemma 4 31B, task-specific prompts, 160 Linguini problems)
- **Fine-tuned Qwen2.5-7B-Instruct** with LoRA (r=16, 3 epochs) on Modal L4 GPU
- Merged model pushed to [Papajams/ratiocine](https://huggingface.co/Papajams/ratiocine) (public HF repo)
- `script.py` and `prompts.py` uploaded to the HF repo
- **Submitted to IOL-AI 2026** (9 submissions remaining today, deadline July 26 23:59 UTC)

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
