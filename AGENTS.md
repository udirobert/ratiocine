# AGENTS.md — ratiocine

Guidance for AI agents (and humans) working on this project.

## What this is

An IOL-AI 2026 competitor. The goal: submit a `script.py` to a public Hugging Face repo that solves International Linguistics Olympiad problems. Deadline: **July 26, 2026, 23:59 UTC** (the competition is only a few days long).

## Current status (as of 2026-07-26)

- Git repo at `github.com/udirobert/ratiocine` (branch `main`), pushed and up to date
- Pre-commit hooks: `detect-secrets`, `ruff` lint+format, file hygiene
- `pyproject.toml` configures ruff (py310, isort/bugbear/simplify; RUF001/002/003 disabled for linguistic data)
- Local `.env` holds: `HF_TOKEN`, `ARKOR_API_KEY`, `ARKOR_ENDPOINT_URL` (all gitignored)
- `.env.example` documents all env vars; Modal token configured (`~/.modal.toml`, workspace `ungethe`)
- Arkor endpoint verified: 6 models available (Gemma 4 31B, Gemini 3.6 Flash, GPT-5, etc.)
- 160 Linguini problems converted to training data in `data/synthetic/iol_train.jsonl`
- 160 CoT-augmented training examples generated in `data/synthetic/iol_cot_train.jsonl` (112 with full `<analysis>/<answers>` tags from GPT-5, 48 wrapped from Gemma 4)
- Task-specific prompting system in `hf-pipeline/submission/prompts.py` (5 task types + hybrid CoT for translation/fill_blanks)
- Local test harness in `hf-pipeline/test_local.py` (tests against Linguini via Arkor API)
- Zero-shot baseline: Score 0.235 (Gemma 4 31B, task-specific prompts, 160 Linguini problems)
- **Submitted to IOL-AI 2026** (8 submissions total)
- **Linguini validation**: Qwen2.5-14B-Instruct-AWQ + parser fix + hybrid CoT = **0.1255** (beats baseline 0.1227)
- **Best public score: 0.1141** (chrF=0.2314, EM=0.0563) — verbose `<analysis>/<answers>` CoT, 512 tokens, greedy decoding
- **Selected for private leaderboard**: 0.1141 (verbose CoT, high EM) + 0.0755 (direct, high chrF) — diversification strategy
- Submission config: hybrid CoT for translation/fill_blanks (512 tokens), direct for others (128-256 tokens), tiered max_new_tokens per task type, aggressive time guard fallback at 64 tokens
- Public/private split: 2 submissions selected for private leaderboard for hedging

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

## Lessons learned (IOL-AI 2026)

### What worked

1. **Bigger base model beats fine-tuned smaller model.** Our fine-tuned Qwen2.5-7B scored 0.075 on Linguini — worse than the stock Qwen2.5-14B-AWQ baseline (0.123). LoRA fine-tuning on 160 examples was not enough to overcome the base model's smaller size and weaker reasoning. The base 14B + parser fix scored 0.1255.

2. **Fix the parser before fine-tuning.** The v1 `parse_answers` had a `_looks_like_analysis` filter that dropped any answer starting with "The", "We", "There", "Where", "What", etc. This silently killed ~5% of correct translation answers. Removing it was the single biggest free win.

3. **Direct prompts beat CoT for this competition.** Qwen3 thinking mode (70s/problem) was too slow and produced lower chrF than Qwen2.5 direct prompting (5-8s/problem). The T4 30-min limit and chrF-heavy scoring favor fast direct answers over reasoning.

4. **Hybrid CoT is the sweet spot.** Pure CoT was too slow (17s/problem × 160 = ~30 min, exceeded budget). Pure direct gave EM=0.025 on the hidden test set (model was "almost right" but not exact). Hybrid CoT for translation/fill_blanks + direct for others is the best balance — CoT improves EM via careful reasoning on hard tasks; direct is fast for pattern-matching.

5. **Tiered max_new_tokens per task type.** Baseline uses 512 for everything; we use 512 for CoT tasks, 128 for short answers (match_letters/text_to_num), 256 for medium answers (num_to_text). This cuts total time by ~30% without sacrificing accuracy on hard tasks.

6. **Task-specific prompts help.** Gemma 4 31B with simple system prompts hit 0.235 on Linguini (vs ~0.12 for generic prompts). Translation, fill_blanks, match_letters, text_to_num, num_to_text each benefit from format-specific instructions.

### What didn't work

1. **Qwen3 thinking mode** — 70s/problem on T4 with thinking tokens, chrF dropped to 0.08-0.15. Too slow, too low quality.
2. **AWQ quantization of fine-tuned model** — OOM on T4/L4 for 14B bf16 → AWQ. Needs A100 40GB+ which requires payment method.
3. **GPT-5 rate limiting on Arkor** — consistently returns 429 on the free tier. Use the second Arkor endpoint or switch models.
4. **Claude Opus 5** — listed on the Arkor endpoint but returns "Upstream service error" on every call. Not actually serving.

### Critical submission gotchas

1. **Output path**: `script.py` must write to `/tmp/model/submission.csv`, NOT just `submission.csv` (relative path). The eval system reads from the absolute path and will fail with "is not a file on the local file system" if you only write relative.

2. **Tokenizer compatibility**: If you fine-tune with a newer transformers version and save the tokenizer, the saved `tokenizer.json` may use a format that the sandbox's older transformers can't parse ("data did not match any variant of untagged enum ModelWrapper"). Solution: keep the tokenizer from the base AWQ repo, don't replace it with one from a fresh `tokenizer.save_pretrained()`.

3. **Human jury track**: Always include an `explanation` column (short, human-readable) in `submission.csv`. Makes you eligible for IOL 2026 jury review on equal footing with human contestants. No effect on automatic score. `explanation_rate=100%` is required for jury consideration.

4. **Submission columns**: `id` (echo back unchanged), `pred` (JSON-serialized list of answer strings, one entry per numbered query item IN ORDER), optional `explanation` for human jury track. Missing or extra entries in `pred` score zero for those items.

5. **T4 16GB limit + Turing GPU**: Use 4-bit quantized models. 14B-AWQ (~10GB) fits. Full bf16 14B (~28GB) does not. **Use float16, NOT bfloat16** — T4 is Turing architecture with no native bfloat16 support.

6. **Time guard**: Always include a fallback for slow problems. Use `do_sample=False` (greedy) for reproducibility. With 160 problems and a 30-min limit, average ~10s per problem. If running low on time, reduce `max_new_tokens` to avoid timeout.

7. **Daily submission limit**: **3 submissions per day per team.** Reset at UTC midnight. The deadline is 23:59 UTC. Plan submissions carefully.

8. **Private leaderboard selection**: **Pick up to 2 submissions for private leaderboard** before the deadline. If you don't pick, your best 2 public submissions are used automatically. Diversify: pick your highest public score + one with different behavior (e.g., hybrid CoT + direct).

9. **Always emit your best guess**: The official docs tip: "Partial credit (chrF) means a roughly-right answer beats a blank, so always emit your best guess for every item." Never leave an item blank.

10. **PyPI is reachable**: The sandbox has no internet for HF Hub, but `pip install` still works. Useful for installing bitsandbytes for 4-bit inference if needed.

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
