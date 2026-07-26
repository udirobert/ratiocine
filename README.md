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
- [x] Fixed `parse_answers` bug that dropped ~5% of correct answers (filter was removing "The/We/There" prefixes)
- [x] Generated 160 CoT-augmented training examples (`data/synthetic/iol_cot_train.jsonl`) using GPT-5 + Gemma 4 on Arkor
- [x] Fine-tuned Qwen2.5-14B with CoT data via LoRA (loss 0.59, token accuracy 86%) — could not AWQ-quantize for T4
- [x] Deployed **Qwen2.5-14B-Instruct-AWQ** + parser fix + task-specific prompts to [Papajams/ratiocine](https://huggingface.co/Papajams/ratiocine)
- [x] Verified Linguini benchmark score: **0.1255** (beats baseline 0.1227, 66% better than previous 0.075)
- [x] Fixed `script.py` to write to `/tmp/model/submission.csv` (absolute path the eval system requires)
- [x] Included `explanation` column for IOL 2026 Human Evaluation Challenge
- [x] **Submitted to the competition**

## Submission

- **HF repo**: [Papajams/ratiocine](https://huggingface.co/Papajams/ratiocine)
- **Model**: Qwen2.5-14B-Instruct-AWQ (4-bit, 9.98 GB)
- **Script**: Task-specific prompting with fixed parser, time guard, explanation column
- **Eval**: Loads AWQ model, reads `/tmp/data/test.csv`, writes `/tmp/model/submission.csv`
- **Linguini benchmark**: 0.1255 (score = sqrt(0.0493 EM * 0.3196 chrF))

## Lessons learned

### What worked

1. **Bigger base model beats fine-tuned smaller model.** Our fine-tuned Qwen2.5-7B scored 0.075 on Linguini — worse than the stock Qwen2.5-14B-AWQ baseline (0.123). LoRA fine-tuning on 160 examples was not enough to overcome the base model's smaller size and weaker reasoning. The base 14B + parser fix scored 0.1255.

2. **Fix the parser before fine-tuning.** The v1 `parse_answers` had a `_looks_like_analysis` filter that dropped any answer starting with "The", "We", "There", "Where", "What", etc. This silently killed ~5% of correct translation answers. Removing it was the single biggest free win.

3. **Direct prompts beat CoT for this competition.** Qwen3 thinking mode (70s/problem) was too slow and produced lower chrF than Qwen2.5 direct prompting (5-8s/problem). The T4 30-min limit and chrF-heavy scoring favor fast direct answers over reasoning.

4. **Task-specific prompts help.** Gemma 4 31B with simple system prompts hit 0.235 on Linguini (vs ~0.12 for generic prompts). Each task type benefits from format-specific instructions.

### What didn't work

1. **Qwen3 thinking mode** — 70s/problem on T4 with thinking tokens, chrF dropped to 0.08-0.15. Too slow, too low quality.
2. **AWQ quantization of fine-tuned model** — OOM on T4/L4 for 14B bf16 → AWQ. Needs A100 40GB+ which requires payment method.
3. **GPT-5 rate limiting on Arkor** — consistently returns 429 on the free tier. Use the second Arkor endpoint or switch models.
4. **Claude Opus 5** — listed on the Arkor endpoint but returns "Upstream service error" on every call. Not actually serving.

### Critical submission gotchas

1. **Output path**: `script.py` must write to `/tmp/model/submission.csv`, NOT just `submission.csv` (relative path). The eval system reads from the absolute path and will fail with "is not a file on the local file system" if you only write relative.

2. **Tokenizer compatibility**: If you fine-tune with a newer transformers version and save the tokenizer, the saved `tokenizer.json` may use a format that the sandbox's older transformers can't parse ("data did not match any variant of untagged enum ModelWrapper"). Solution: keep the tokenizer from the base AWQ repo, don't replace it with one from a fresh `tokenizer.save_pretrained()`.

3. **Human jury track**: Always include an `explanation` column (short, human-readable) in `submission.csv`. Makes you eligible for IOL 2026 jury review on equal footing with human contestants. No effect on automatic score.

4. **Submission columns**: `id` (echo back unchanged), `pred` (JSON-serialized list of answer strings), optional `explanation` for human jury track.

5. **T4 16GB limit**: Use 4-bit quantized models. 14B-AWQ (~10GB) fits. Full bf16 14B (~28GB) does not.

6. **Time guard**: Always include a fallback for slow problems. Use `do_sample=False` (greedy) for reproducibility. If running low on time, reduce `max_new_tokens` to avoid the 30-min timeout.

## Honest Assessment

### What could go right
- Task-specific prompts significantly outperformed generic prompts in our Linguini testing
- The Qwen2.5-14B-AWQ base model (0.1255 on Linguini) is stronger than the fine-tuned 7B (0.075)
- Parser fix recovers ~5% of correct answers that v1 was silently dropping
- The `explanation` column makes us eligible for the Human Evaluation Challenge

### What could go wrong
1. **Linguini is public data** — the IOL 2026 hidden test set will have novel problems. Our Linguini scores (0.1255) are likely inflated vs. what the hidden test set will show. Expect scores to drop 30-50%.
2. **chrF-heavy scoring** — the geometric mean means a low chrF caps the score even with high EM. Single-letter answers (match_letters) have near-zero chrF unless exactly right.
3. **Model size** — Qwen2.5-14B is smaller than what top leaderboard teams likely used. Top scorers may be running 32B-70B models.

### Chances
- **Top 10 (score > 0.161)**: Moderate. Our 0.1255 is close to the gap. Top 10 cutoff may drop as the public leaderboard evolves.
- **Scoring above zero**: Very likely. The task-specific prompts + parser fix + Qwen2.5-14B-AWQ is a solid baseline.
- **Human jury track**: Eligible. Our `explanation` column is properly formatted.

## References

- [IOL-AI 2026](https://iolai.org)
- [Arkor Docs](https://docs.arkor.ai/introduction)
- [Competition HF Space](https://huggingface.co/spaces/iol-ai-challenge/iol-ai-2026)
- [Workshop repo + Colab](https://github.com/rita-berrada/iolai-2026-workshop)
- [Linguini format (Sánchez et al., 2024)](https://arxiv.org/html/2409.12126v1)
