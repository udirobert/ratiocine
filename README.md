# ratiocine

**Logical reasoning from linguistic fragments. Rat-i-o-cine: the process of reasoning.**

An AI system that solves International Linguistics Olympiad (IOL) problems — deducing grammar, vocabulary, and structure from minimal examples in unfamiliar languages.

## Strategy

### Phase 1: Rapid prototyping with Arkor (minutes)

Use [Arkor](https://docs.arkor.ai/introduction) (TypeScript fine-tuning framework) to validate the training data format and approach in ~10 minutes per run. The `translate` template is the closest starting point — it already fine-tunes Gemma 4 on multilingual translation tasks with structured outputs.

```bash
pnpm dev
```

Studio runs at `http://localhost:4000` — click "Run training", test in Playground 7–12 minutes later.

### Phase 2: Production submission with HF pipeline

Replicate the validated approach with standard Hugging Face tools for a model that fits a T4 16GB and can be exported to a public HF repo:

1. **Train**: `hf-pipeline/train.py` — fine-tune Qwen2.5-7B (or 3B) with `SFTTrainer` + 4-bit bitsandbytes
2. **Submit**: `hf-pipeline/submission/script.py` — the competition harness, reads `/tmp/data/test.csv`, runs inference, writes `submission.csv`

## Project Structure

```
ratiocine/
├── src/arkor/              # Arkor rapid prototyping
│   ├── index.ts            # createArkor entry point
│   └── trainer.ts          # createTrainer for IOL fine-tuning
├── data/
│   └── synthetic/          # Synthetic IOL training data in instruction format
├── hf-pipeline/            # Hugging Face production pipeline
│   ├── requirements.txt
│   ├── train.py            # SFTTrainer fine-tuning (HF + bitsandbytes)
│   ├── dataset.py          # IOL dataset preparation
│   └── submission/
│       ├── script.py       # Competition submission harness
│       └── README.md       # Instructions for HF repo setup
├── notebooks/              # Exploration and analysis
├── arkor.config.ts         # Arkor CLI config
└── package.json
```

## Competition Details

- **Event**: [IOL-AI 2026](https://iolai.org)
- **Deadline**: July 26, 2026, 23:59 UTC
- **Submission**: Public Hugging Face repo with `script.py`
- **Hardware**: T4 GPU (16GB), 30 min limit, no internet
- **Scoring**: Geometric mean of exact match + chrF
- **Team**: Solo

## Current Progress

- [x] Project scaffolded (Arkor prototype + HF pipeline + synthetic data)
- [x] Git repo initialized and pushed to [github.com/udirobert/ratiocine](https://github.com/udirobert/ratiocine)
- [x] Pre-commit hooks: `detect-secrets` (baseline), `ruff` lint+format, file hygiene
- [x] `pyproject.toml` with ruff config
- [x] Arkor live endpoint verified working
- [x] HF token added to `.env`; Modal token configured (workspace: `papaandthejimjams`)
- [x] Fixed model name in `trainer.ts` (`google/gemma-4-31b-it`)
- [x] Built task-specific prompting system (5 task types: translation, fill_blanks, text_to_num, num_to_text, match_letters)
- [x] Built local test harness (`test_local.py`) against the 160-problem Linguini benchmark
- [x] Zero-shot baseline: Score 0.235 (Gemma 4 31B, task-specific prompts, 160 Linguini problems)
- [x] Converted all 160 Linguini problems to training data (`data/synthetic/iol_train.jsonl`)
- [x] Fine-tuned Qwen2.5-7B-Instruct with LoRA on Modal L4 GPU (3 epochs, 128 train / 32 eval split)
- [x] Merged LoRA adapter and pushed to [Papajams/ratiocine](https://huggingface.co/Papajams/ratiocine) (public HF repo)
- [x] Uploaded `script.py` and `prompts.py` to the HF repo
- [x] **Submitted to the competition** (9 submissions remaining today)

## Submission

- **HF repo**: [Papajams/ratiocine](https://huggingface.co/Papajams/ratiocine)
- **Model**: Qwen2.5-7B-Instruct, LoRA fine-tuned on 128 Linguini problems (3 epochs, r=16)
- **Script**: Task-specific prompting with robust answer parsing (letters, numbers, translations)
- **Eval**: Loads model with 4-bit bitsandbytes (fits T4 16GB), reads `/tmp/data/test.csv`, writes `submission.csv`

## Honest Assessment

### What could go right
- Task-specific prompts significantly outperformed generic prompts in our Linguini testing
- The fine-tuned model should follow the output format better than stock Qwen2.5-7B (which scores 0.000 on the leaderboard)
- 4-bit quantization is well-tested and the model fits comfortably in T4 16GB
- We have 9 remaining submissions to iterate

### What could go wrong
1. **No end-to-end test**: We never ran `script.py` with the fine-tuned model on a real GPU. There may be runtime errors, OOM, or timing issues (30 min limit).
2. **Small training set**: Only 128 examples (80% of 160 Linguini problems). This is very few for SFT. The model may not have learned enough to generalize to unseen IOL 2026 problems.
3. **Data contamination uncertainty**: Linguini is public and derived from past IOL problems. The competition test set is the IOL 2026 individual contest (novel problems). Our zero-shot Linguini scores (0.235) are likely inflated vs. what the hidden test set will show.
4. **Model size**: Qwen2.5-7B is smaller than the models used by top leaderboard teams. The stock baseline scores 0.000, so we are entirely dependent on fine-tuning to make it competitive.
5. **No hold-out score**: We trained on 80% and evaluated on 20% during training, but we never checked the eval loss or measured the fine-tuned model's actual Linguini score. We are flying blind.

### Chances
- **Top 3 (podium)**: Low. The current leaders score 0.17-0.20 with likely larger or more sophisticated approaches.
- **Top 15 (respectable)**: Moderate. If the fine-tuning improved output formatting and task-following, we could be competitive. The task-specific prompts alone brought Gemma 4 to 0.235 on Linguini.
- **Scoring above zero**: Likely. Even if the model struggles with novel problems, the task-specific prompts and robust parsing should produce some non-zero output.

### What to do with remaining submissions
1. **Check the score** from this first submission to calibrate expectations.
2. **If score is low**: The most likely culprit is the model not following the format. Try submitting the stock Qwen2.5-7B with just our task-specific prompts (no fine-tuning) to isolate whether fine-tuning helped or hurt.
3. **If score is zero**: There may be a runtime error in `script.py`. Check the competition Space for error logs.
4. **If score is decent (> 0.10)**: Iterate on the prompt (especially match_letters and text_to_num), and consider training with more epochs or a different LoRA rank.

## Next Steps (priority order)

1. **Monitor the first submission score** at the [competition Space](https://huggingface.co/spaces/iol-ai-challenge/iol-ai-2026).
2. **If runtime errors**: Debug `script.py` end-to-end on Colab T4 using the [workshop notebook](https://github.com/rita-berrada/iolai-2026-workshop).
3. **Test the fine-tuned model locally** via the Arkor endpoint or by loading it on Colab.
4. **Iterate on prompts** — especially match_letters (near-zero chrF) and text_to_num (weak number reasoning).
5. **Consider a second training run** with more data (augment Linguini with past IOL problems from ioling.org) or different hyperparameters.
6. **Pick 2 final submissions** before the deadline (July 26, 23:59 UTC).

## References

- [IOL-AI 2026](https://iolai.org)
- [Arkor Docs](https://docs.arkor.ai/introduction)
- [Competition HF Space](https://huggingface.co/spaces/iol-ai-challenge/iol-ai-2026)
- [Workshop repo + Colab](https://github.com/rita-berrada/iolai-2026-workshop)
- [Linguini format (Sánchez et al., 2024)](https://arxiv.org/html/2409.12126v1)
