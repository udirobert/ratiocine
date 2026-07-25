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
- [x] `.gitignore` covering Node, Python, HF model artifacts, secrets, caches
- [x] Pre-commit hooks: `detect-secrets` (baseline), `ruff` lint+format, file hygiene (large-file guard, private-key detection)
- [x] `pyproject.toml` with ruff config
- [x] Arkor live endpoint verified working (`ARKOR_API_KEY` + `ARKOR_ENDPOINT_URL` in `.env`)
- [x] `train.py` auto-loads `.env` via `python-dotenv`
- [ ] **Add HF token to `.env`** (`HF_TOKEN=` is blank)
- [ ] Fix model name in `trainer.ts` (`gemma-4-E4B-it` → `google/gemma-4-31b-it`)
- [ ] Generate substantially more synthetic training data (currently only 2 examples)
- [ ] Run Arkor prototyping to validate prompt/data format
- [ ] Fine-tune Qwen2.5-7B on a GPU node
- [ ] Test `script.py` end-to-end with the workshop Colab
- [ ] Push model weights to HF Hub and submit

## Next Steps (priority order)

1. **Add HF token** — create a token at https://huggingface.co/settings/tokens with read+write scope, paste into `.env`.
2. **Fix the Arkor model name** — `trainer.ts` references `gemma-4-E4B-it`; the verified live-endpoint ID is `google/gemma-4-31b-it`.
3. **Expand synthetic data** — only 2 training examples exist. Past IOL problems (from ioling.org archives) can be reformatted via `dataset.py` into the instruction format. Target: 50-100+ examples covering translation, text_to_num, num_to_text, fill_blanks, and match_letters task types.
4. **Validate with Arkor** — run `pnpm dev`, kick off a training run, and check whether the checkpoint can solve the sample IOL problem in the `onCheckpoint` callback.
5. **Baseline the HF pipeline** — before fine-tuning, run `script.py` with a stock Qwen2.5 model to get a baseline score on the workshop Colab. The current leaderboard shows the Qwen2.5-7B baseline scores ~0.000 EM / ~0.147 chrF, so there is a lot of room to improve.
6. **Fine-tune** — run `train.py` on a GPU (Colab T4 or a rented GPU). Start with Qwen2.5-7B-Instruct, 3 epochs, LoRA r=16.
7. **Test locally with Linguini** — use the [workshop Colab](https://github.com/rita-berrada/iolai-2026-workshop) to run `script.py` on real Linguini problems and see the score before submitting.
8. **Submit** — push weights + `script.py` to a public HF repo, enter the repo ID in the [competition Space](https://huggingface.co/spaces/iol-ai-challenge/iol-ai-2026). You get 3 submissions/day and pick 2 for the private leaderboard.

## References

- [IOL-AI 2026](https://iolai.org)
- [Arkor Docs](https://docs.arkor.ai/introduction)
- [Competition HF Space](https://huggingface.co/spaces/iol-ai-challenge/iol-ai-2026)
- [Workshop repo + Colab](https://github.com/rita-berrada/iolai-2026-workshop)
- [Linguini format (Sánchez et al., 2024)](https://arxiv.org/html/2409.12126v1)
