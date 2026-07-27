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
├── showcase/               # Next.js showcase site (deployed on Vercel)
│   ├── app/
│   │   ├── page.tsx        # Scene switcher root
│   │   └── scenes/
│   │       ├── problem/    # Scene 1: real IOL problem + rain refraction shader
│   │       ├── machine/    # Scene 2: R3F Mac GLB + CRT HTMLTexture screen
│   │       └── answer/     # Scene 3: Voronoi explosion + 3D answer reveal
│   └── components/         # SceneNav, GridBackground, wordmark
├── notebooks/              # Exploration and analysis
├── arkor.config.ts         # Arkor CLI config
├── vercel.json             # Vercel monorepo config (root → showcase/)
└── package.json
```

### Running the showcase locally

```bash
cd showcase
npm install
npm run dev   # → http://localhost:3000
```

Enable `chrome://flags/#canvas-draw-element` in Chrome Canary for the full HTMLTexture experience (rain shader on Scene 1, live DOM texture on the Mac screen in Scene 2). Everything works without it via fallback paths.

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
- [x] **Submitted to the competition** — best public score **0.1141** (chrF=0.2314, EM=0.0563) — rank ~25-28 from initial #35
- [x] **Private leaderboard**: 2 submissions selected for diversity (0.1141 verbose CoT + 0.0755 direct)
- [x] Built three-scene showcase site (`showcase/`) using React Three Fiber, html-in-canvas HTMLTexture API, and Voronoi explosion — deployed to Vercel

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

3. **Verbose CoT (`<analysis>/<answers>` format) won the public leaderboard.** Verbose CoT scored 0.0872 (EM=0.0458) on its first try and 0.1141 on a different public subset (EM=0.0563, chrF=0.2314). The longer reasoning helps the model produce exact answers — concise reasoning lost EM in our tests.

4. **Task-specific prompts help.** Gemma 4 31B with simple system prompts hit 0.235 on Linguini (vs ~0.12 for generic prompts). Each task type benefits from format-specific instructions.

5. **Tiered max_new_tokens per task type.** 512 for CoT (translation/fill_blanks), 256 for num_to_text, 128 for short (match_letters/text_to_num). Fits 160 problems in 30 min comfortably.

6. **Private leaderboard diversification.** Selecting 0.1141 (high-EM verbose CoT) + 0.0755 (high-chrF direct) hedges against private-test differences.

### What didn't work

1. **Qwen3 thinking mode** — 70s/problem on T4 with thinking tokens, chrF dropped to 0.08-0.15. Too slow, too low quality.
2. **AWQ quantization of fine-tuned model** — OOM on T4/L4 for 14B bf16 → AWQ. Needs A100 40GB+ which requires payment method.
3. **GPT-5 rate limiting on Arkor** — consistently returns 429 on the free tier. Use the second Arkor endpoint or switch models.
4. **Claude Opus 5** — listed on the Arkor endpoint but returns "Upstream service error" on every call. Not actually serving.
5. **Verbatim output instructions** — counterintuitive: telling the model "output VERBATIM, preserve every word form" consistently reduced EM from 0.0458 to 0.025 (3 consecutive submissions). Made the model too literal, hurting exact matches.
6. **Beam search (num_beams=2)** — catastrophic failure (0.0 score, 22% missing explanations). The 2x slowdown caused timeouts that left 35+ problems with empty outputs.
7. **Concise CoT** — 1-2 sentence reasoning gave up the EM gains from verbose CoT (0.071 score, EM=0.025).
8. **GPTQ quantization** — `auto-gptq` build failed on Modal (dependency conflict with newer transformers).

### Critical submission gotchas

1. **Output path**: `script.py` must write to `/tmp/model/submission.csv`, NOT just `submission.csv` (relative path). The eval system reads from the absolute path and will fail with "is not a file on the local file system" if you only write relative.

2. **Tokenizer compatibility**: If you fine-tune with a newer transformers version and save the tokenizer, the saved `tokenizer.json` may use a format that the sandbox's older transformers can't parse ("data did not match any variant of untagged enum ModelWrapper"). Solution: keep the tokenizer from the base AWQ repo, don't replace it with one from a fresh `tokenizer.save_pretrained()`.

3. **Human jury track**: Always include an `explanation` column (short, human-readable) in `submission.csv`. Makes you eligible for IOL 2026 jury review on equal footing with human contestants. No effect on automatic score. `explanation_rate=100%` is required for jury consideration.

4. **Submission columns**: `id` (echo back unchanged), `pred` (JSON-serialized list of answer strings, one entry per numbered query item IN ORDER), optional `explanation` for human jury track. Missing or extra entries in `pred` score zero for those items.

5. **T4 16GB limit + Turing GPU**: Use 4-bit quantized models. 14B-AWQ (~10GB) fits. Full bf16 14B (~28GB) does not. **Use float16, NOT bfloat16** — T4 is Turing architecture with no native bfloat16 support.

6. **Time guard**: Always include a fallback for slow problems. Use `do_sample=False` (greedy) for reproducibility. With 160 problems and a 30-min limit, average ~10s per problem. If running low on time, reduce `max_new_tokens` to avoid timeout. Beam search breaks the time budget — stick with greedy.

7. **Daily submission limit**: **3 submissions per day per team.** Reset at UTC midnight. The deadline is 23:59 UTC. Plan submissions carefully.

8. **Private leaderboard selection**: **Pick up to 2 submissions for private leaderboard** before the deadline. If you don't pick, your best 2 public submissions are used automatically. Diversify: pick your highest public score + one with different behavior (e.g., high-EM verbose CoT + high-chrF direct).

9. **Always emit your best guess**: The official docs tip: "Partial credit (chrF) means a roughly-right answer beats a blank, so always emit your best guess for every item." Never leave an item blank.

10. **PyPI is reachable**: The sandbox has no internet for HF Hub, but `pip install` still works. Useful for installing bitsandbytes for 4-bit inference if needed.

11. **Public leaderboard uses subsets**: Different submissions evaluate on different problem subsets, so the same code can produce different public scores. Don't over-fit to a single public score.

## Honest Assessment

### Final result
- **Public score: 0.1141** (chrF=0.2314, EM=0.0563) — rank ~25-28 from initial #35 (0.0755)
- **Private leaderboard**: 0.1141 (verbose CoT) + 0.0755 (direct) selected for diversification
- **+51% improvement over initial public score** (0.0755 → 0.1141)

### What could go right
- Verbose CoT reasoning produced both higher EM AND higher chrF on the final subset
- The Qwen2.5-14B-AWQ base model (0.1255 on Linguini) is stronger than the fine-tuned 7B (0.075)
- Parser fix recovers ~5% of correct answers that v1 was silently dropping
- The `explanation` column makes us eligible for the Human Evaluation Challenge
- Diversified private LB picks hedge against private-test differences

### What could go wrong
1. **Hidden test set is harder** — our Linguini scores (0.1255) are on public data; the IOL 2026 hidden test had novel problems where we scored 0.0755-0.1141. Private LB could go either way.
2. **chrF-heavy scoring** — the geometric mean means a low chrF caps the score even with high EM. Our 0.1141 (chrF=0.2314, EM=0.0563) has chrF close to direct mode but EM above direct.
3. **Model size** — Qwen2.5-14B is smaller than what top leaderboard teams likely used. Top scorers (0.2245) may be running 32B-70B models.

### Chances
- **Top 20 (score > 0.1409)**: Unlikely from rank 25-28, but possible if private subset favors our diversified pick.
- **Top 30**: Likely with 0.1141.
- **Human jury track**: Eligible. Our `explanation` column is properly formatted with reasoning extracted from CoT output.

## References

- [IOL-AI 2026](https://iolai.org)
- [Arkor Docs](https://docs.arkor.ai/introduction)
- [Competition HF Space](https://huggingface.co/spaces/iol-ai-challenge/iol-ai-2026)
- [Workshop repo + Colab](https://github.com/rita-berrada/iolai-2026-workshop)
- [Linguini format (Sánchez et al., 2024)](https://arxiv.org/html/2409.12126v1)
