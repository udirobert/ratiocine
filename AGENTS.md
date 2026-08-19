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

## Neutron / Ration track (ntron.net hackathon)

"Ration" = a **certified reasoning logbook**. The 14B model (hosted on Modal) solves an IOL problem; the Neutron canister then **grades it deterministically in-canister (EM + chrF), SHA-256-hashes the problem + assertion, chain-key-signs the receipt (ecdsa_secp256k1, slot `ration_assertions`), and appends it to a stable ledger**. Cold GPU start is a deliberate "Deduction Theatre / Honest Compute" feature, not a bug.

### Architecture
- **Canister = verifier, not compute.** 14B can't run in a canister. Motoko backend does grading + signing + storage only. No outcalls needed for the solve path → works on local PocketIC.
- **Modal = invisible GPU engine.** `hf-pipeline/solve_api.py`: `POST /` (submit → instant `job_id`), `GET /?id=` (poll → live phase + result), `run_solve` (L4 GPU worker), Modal Volume `ration-model-cache` caches the 8.5GB weights. Scales to zero (~$0 idle).
- **Frontend-driven solve, canister-verified.** Browser polls the API directly (CORS); canister only grades + signs + stores.
- **Netlify** = brand front (`ratiocine.trustfall.xyz`) + `/api/solve` + `/api/status` proxies → Modal. Frontend auto-falls back to direct `modal.run` until the branded DNS is live.

### Layout & build
- **Canonical source: `ration-app/`** (committed). `neutron/` is a gitignored local clone of `github.com/infu/neutron`.
- `bash scripts/sync-ration-app.sh` copies `ration-app/` → `neutron/apps/ratiocine/` and runs `mops install` on first sync.
- Build + install: `cd neutron && npm --workspace neutron-ratiocine run package` then `npm run provision -- ration-local.ndeploy.json reinstall`.
- Local PocketIC canister: `mqrdp-r7777-77775-qaaaq-cai` at `http://localhost:8000`. App methods are exposed namespaced as `app_ratiocine__<method>`.
- Memory is **v2** (`LedgerEntry` ledger) with a v1→v2 migration declared in `neutron.json`.

### Verified working on local PocketIC (as of 2026-07-26)
- Chain-key signing (`sign_probe`, 64-byte secp256k1 sig), public-key fetch, HTTPS-outcall validation.
- **M3 backend**: `attest_entry` (grade → sign → append) and `get_ledger`. A perfect answer grades EM=1.0, chrF=1.0, score=1.0 (score = sqrt(em·chrf)), 64-byte signature, SHA-256 context + assertion hashes.
- **M4 certified report**: `publish_report` publishes the ledger as an immutable content-addressed certified asset, served over HTTP at `/app/ratiocine/_route/protocol/v1/ledger/report/<sha256>` (HTTP 200, valid JSON, idempotent re-publish).
- Smoke tests: `neutron/smoke_ledger.ts`, `neutron/smoke_report.ts` (raw `@dfinity/agent`, `verifyQuerySignatures:false` + `fetchRootKey()` for PocketIC; HTTP fetch needs the canister-ID subdomain URL).
- **Blocked**: branded Netlify DNS (user to wire), and a non-destructive upgrade to demonstrate ledger persistence (reinstall is destructive and resets the ledger).

### Vendored Motoko compiler gotchas (this is NOT stock Motoko — expect surprises)
The Neutron workspace compiles with a **patched Motoko (mo:core v2.6.0)** whose syntax differs from the Motoko most people know. Cost ~2 hours to discover; do not "fix" these back to stock syntax:
1. **Reassignment is `:=`, not `=`.** Local `var` reassignment AND stable-field writes both use `:=` (`x := ...`, `mem.ledger := ...`). Declaration still uses `=` (`var x = init`). Stock Motoko uses `=` for locals — here `=` on an existing binding is a *parse error*.
2. **`#` is text-concat only.** Vector append `vec # elem` and `vec ++ vec` are **not** defined. To append to a stable vec, use `Array.concat(v, [x])` (`import Array "mo:core/Array"`).
3. **No `.vals()` on vec/Blob/Text.** Iterate with an index `while` loop (`for (x in v.vals())` is a type error).
4. **`float` is not a primitive type.** Lowercase `float` is unbound; use `Float` from `import Float "mo:core/Float"` (write `?Float` / `: Float`). Same for other numerics in type positions.
5. **Type coercion `<T> expr` is not supported** (`unexpected token '<'`). Build values in the exact target type instead. Note: structurally-identical records from different modules DO unify for assignment/`Array.concat` (so a local `LedgerEntry` can be stored into a `Memory.LedgerEntry` vec).
6. **A record field named `query` breaks the Candid parser** (`query` is a Candid keyword). Rename to `prompt` (or anything but a Candid keyword) in both the app type and the memory schema.
7. **Block-scoped `let` shadows by name across the whole block** even before its textual declaration — a local `let chrf = ...` shadows a same-named `func chrf`. Avoid local names that collide with helper function names.
8. **`Nat32`/`Nat` are distinct.** `Char.toNat32` returns `Nat32`; convert with `Nat32.toNat(...)` (import it) before using as an array index. `fromNat32`/`fromNat` still work but are deprecated.
9. **Schema tool** (`method_schema.ts`) regex-parses `public type X = ...` bodies from `main.mo` source and only understands primitives / records / variants / tuples / opt / vec inline. So a method's public wire type must be a **full record declared in main.mo**, not a reference to the memory module's type. Keep the memory `LedgerEntry` and the app `LedgerEntry` structurally identical.
10. **`mogen.ts`** rewrites `main.mo` in place between `/*---NEUTRON GENERATED BEGIN/END---*/` markers, adding `<method>_Input`/`<method>_Output` type aliases. Don't hand-edit that block.
11. **Variant values inside record literals use paren/bare form, not `{ #tag = ... }`.** `{ #put = {...} }` is a parse error; write `#put({...})` (payload) or `#absent` (unit). Bare `#tag(x)` expressions outside records were always fine.
12. **No `Blob.blobArray` / `Blob.slice`** in this core. To build small blobs, accumulate hex/text and `Text.encodeUtf8` (or index bytes into a string). `Array.concat` exists for vecs.
13. To get a real compiler error **location** (the wrapper only prints the message), temporarily patch the diagnostic `.map(({message}) => message)` in `packages/neutron-motoko-wasm/src/index.ts` to include `d.source:d.range.start.line` — revert before committing.

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
├── showcase/               # Next.js showcase site (Vercel)
│   ├── app/
│   │   ├── page.tsx        # Scene switcher (problem → machine → answer)
│   │   └── scenes/
│   │       ├── problem/    # Real IOL problem + rain refraction shader (postprocessing)
│   │       ├── machine/    # Mac GLB + CRT HTMLTexture screen + partner logos
│   │       └── answer/     # Voronoi explosion + 3D answer reveal (Text3D)
│   ├── components/         # SceneNav, GridBackground, Wordmark
│   └── public/             # mac.glb, inter.json (font for Text3D), grid.svg
├── notebooks/              # Exploration
├── .env.example            # Tracked template for env vars
├── .gitignore
├── .pre-commit-config.yaml # Secrets + linting hooks
├── .secrets.baseline       # detect-secrets baseline
├── vercel.json             # Monorepo deploy config (root → showcase/)
├── AGENTS.md
├── README.md
├── package.json
├── pyproject.toml          # ruff config
├── tsconfig.json
└── arkor.config.ts
```
