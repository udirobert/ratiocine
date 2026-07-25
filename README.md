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

## References

- [IOL-AI 2026](https://iolai.org)
- [Arkor Docs](https://docs.arkor.ai/introduction)
- [Competition HF Space](https://huggingface.co/spaces/iol-ai-challenge/iol-ai-2026)
- [Workshop repo + Colab](https://github.com/rita-berrada/iolai-2026-workshop)
- [Linguini format (Sánchez et al., 2024)](https://arxiv.org/html/2409.12126v1)
