# IOL-AI 2026 competition

An AI that solves International Linguistics Olympiad problems — deducing grammar,
vocabulary, and structure from minimal examples in unfamiliar languages.

## Competition format

- **Event**: [IOL-AI 2026](https://iolai.org)
- **Submission**: public Hugging Face repo with `script.py`; reads
  `/tmp/data/test.csv`, writes `submission.csv`
- **Hardware**: T4 16GB, 30-minute limit, no internet at eval time
- **Scoring**: `score = √(exact_match_weighted · chrF)` — geometric mean of
  weighted exact match and character n-gram overlap
- **Data**: Linguini format per row (`id`, `context`, `query`, `work_lang`,
  `task_lang`, `task_type`, `eval_type`)

## Pipeline (`hf-pipeline/`)

```bash
cd hf-pipeline
pip install -r requirements.txt
python dataset.py          # build training data (data/synthetic/)
python train.py            # SFTTrainer fine-tune (Qwen2.5-7B/3B, 4-bit bitsandbytes)
# then follow submission/README.md to push to HF
```

- **Rapid prototyping**: `src/arkor/` (TypeScript) validates training-data format
  in ~10-minute runs (`pnpm dev` → Studio at localhost:4000).
- **Task-specific prompting**: `hf-pipeline/submission/prompts.py` (5 task types
  + hybrid CoT for translation/fill_blanks).
- **Local harness**: `hf-pipeline/test_local.py` evaluates against Linguini via
  the Arkor API.

## Results & lessons

- Best public score **0.1141** (chrF 0.2314, EM 0.0563), rank ~25-28 (started #35,
  +51% improvement). Two submissions picked for a private leaderboard at
  0.1141 (verbose CoT) + 0.0755 (direct) for diversification.
- **HF repo**: [Papajams/ratiocine](https://huggingface.co/Papajams/ratiocine);
  model Qwen2.5-14B-Instruct-AWQ (4-bit); script reads `/tmp/data/test.csv`,
  writes `/tmp/model/submission.csv`.

### What worked

1. **Bigger base beats fine-tuned smaller.** Fine-tuned Qwen2.5-7B scored 0.075
   vs the stock 14B-AWQ baseline 0.123; 14B + parser fix hit 0.1255.
2. **Fix the parser before fine-tuning.** v1 `parse_answers` silently dropped
   ~5% of correct translation answers (any answer starting "The/We/There/…").
   Removing that filter was the biggest free win.
3. **Verbose CoT (`<analysis>/<answers>`) won the public LB** — longer reasoning
   improved exact match; concise reasoning lost EM.
4. **Task-specific prompts** — 5 task types (+ hybrid CoT for
   translation/fill_blanks) beat generic prompts.
5. **Tiered `max_new_tokens`** — 512 CoT, 256 num_to_text, 128 short. Fits 160
   problems in 30 min.
6. **Private-LB diversification** — pick high-EM + high-chrF submissions.

### What didn't work

- **Qwen3 thinking mode** — 70s/problem, chrF dropped. Too slow, too low.
- **AWQ of a fine-tuned 14B** — OOM on T4/L4 bf16→AWQ (needs A100 40GB+).
- **GPT-5 rate limiting** on Arkor free tier (429); Claude Opus 5 returns
  "Upstream service error".
- **"Output VERBATIM" instructions** — made the model too literal, hurt EM.
- **Beam search (num_beams=2)** — 2× slowdown caused timeouts; catastrophic.
- **Concise CoT** — gave up the EM gains of verbose CoT.
- **GPTQ quantization** — build failed (transformers conflict).

### Submission gotchas (bring your own)

1. `script.py` must write `/tmp/model/submission.csv` (absolute path).
2. Keep the base tokenizer (don't `save_pretrained` a fresh one).
3. Include an `explanation` column to stay eligible for the human jury track.
4. `pred` = JSON list of answers, one per numbered query item, in order.
5. Use float16, NOT bfloat16 (T4 = Turing, no native bfloat16).
6. Greedy decoding (`do_sample=False`) + a time guard fallback.
7. 3 submissions/day/team, reset at UTC midnight.
8. Always emit your best guess — partial credit beats a blank.
