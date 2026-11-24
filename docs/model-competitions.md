# Model competitions beyond IOL-AI — Delta League & LTB leaderboard

Written 2026-11-23, during the RTX6000 grant-window review.
Status: **tracked — nothing submitted.**

## Delta League — https://deltaleague.ai

- **What:** open, explicitly agent-native competition for model-weight improvements
  ("can agents improve the weights themselves?"). Submit a LoRA, a sparse or dense
  weight diff, or full checkpoints against a registered parent checkpoint; a
  private-test score ranks each submission on a per-model leaderboard. A research PR
  is the default workflow, attached via `delta submit --pr <PR_URL>` — a good match
  for this project's documentation-heavy style.
- **Boards (as of 2026-11-23):** first competition was **Qwen3.5-0.8B** — already
  crowded (90+ verified submissions, best private-test ~54.7%). Also live: **Qwen 3.8
  27B NVFP4** (~10 verified — far less crowded, but NOT RTX6000-feasible: NVFP4 kernels
  target Blackwell-class hardware, and dequantized the model is ~54 GB > 24 GB), plus
  Astra and DeepSeek Flash 4.1 boards awaiting eval.
- **Scoring nuance:** author ranking uses "total gain" — the sum of your advances to
  the best private-test score. Incremental submissions accumulate credit, so submit
  working deltas early rather than holding for one big jump.
- **Prize:** none listed — leaderboard/reputation value only.
- **Fit:** the hf-pipeline LoRA/eval machinery transfers conceptually, with one
  caveat — `eval_14b_awq.py` pins `transformers==4.46.3`, which predates the Qwen3.5
  arch. The Delta League CLI handles inference (`pip install deltaleague`, `[local]`
  extras), so don't reuse the pinned env for it. 0.8 B is trivially inside a 24 GB
  card — the most GPU-feasible active item in the portfolio.
- **RTX6000 fit:** LoRA training + local public-eval sweeps are squarely in-budget for a
  ~50 h grant window.

### Verified on the grant box (2026-11-23, Quadro RTX 6000 / cc 7.5 / 23 GB)

- `pip install "deltaleague[local]"` (v0.5.0) installs torch+transformers only — no vLLM.
  `delta competition init qwen35-08b-v1` works **unauthenticated** (pulls 1.7 GB parent
  safetensors + `validation.json` + `evaluation.json`); `delta run` generates fine via
  plain transformers (~21 tok/s). `delta login --no-browser` is SSH-friendly (prints an
  auth URL) but interactive — required before any `delta submit`.
- **The pinned vLLM image DOES run on this card** — earlier "vLLM fails" guidance was
  Gemma4-specific (heterogeneous head dims → TRITON_ATTN smem overflow). For
  Qwen3.5-0.8B: bf16 hard-errors on cc<8.0, but `--dtype float16` (the only deviation
  from `delta public-eval serve-command`) boots in ~7 min (GDN triton warmup) and
  serves `/v1/*` incl. `prompt_logprobs`. Use `--device nvidia.com/gpu=all` (CDI) — the
  box has no `nvidia` docker runtime registered; sudo IS available.
- **Local advisory eval loop proven end-to-end:** serve checkpoint as `candidate` on
  127.0.0.1:8000, then `delta public-eval benchmark --protocol <p> --endpoint
  http://127.0.0.1:8000/v1 --tokenizer model --content-hash <from delta-model.json>
  --start <i> --end <j>` runs sharded items. Canary: arc_easy items 0-8 → acc_norm
  0.625, 33 s. Protocols come from `delta public-eval benchmark-config --benchmark <b>
  --generation <gen.json>` where gen.json carries the pinned sampling params
  (temp 1.0, top_p 0.95, top_k 20, presence_penalty 1.5, max_tokens 8192,
  enable_thinking — the eval runs WITH thinking on).
- **Eval deps want their own venv** (`delta_cli/public_eval/requirements.txt`):
  `lm-eval[ifeval,api,math]==0.4.13`, `bfcl-eval==2025.12.17`, `numpy==1.26.4`,
  `pyarrow==21.0.0`, `transformers==5.22.1`, `soundfile`, `qwen-agent`,
  `antlr4-python3-runtime==4.11`, `wasmtime==50.0.1`. Numpy 1.x conflicts with the
  main env — keep `~/delta-eval` separate. `delta evaluate` (non-sharded path)
  refuses `--limit`/`--benchmark` in pinned mode; use `public-eval benchmark` shards.
- fp16 ≠ pinned bf16, so local scores are advisory-twice-removed — fine for iteration
  signal, and server-side scoring (validation + private test) is authoritative anyway.
  Generation-heavy benchmarks (8192-token thinking at temp 1.0) will be slow on
  Turing; shard or run overnight.

### Parent-model baseline, public suite, fp16-on-Turing (2026-11-24)

Likelihood benchmarks (fast: ~30 s per 64 items, `prompt_logprobs`):

| arc_easy | arc_challenge | boolq | piqa | hellaswag | winogrande | commonsense_qa | openbookqa |
|---|---|---|---|---|---|---|---|
| 64.06 | 32.81 | 65.62 | 70.31 | 46.88 | 57.81 | 54.69 | 29.69 |

Generative benchmarks (thinking on, ~9 s/item at concurrency 8):

| mmlu | mmlu_pro (70 items, 630 s, 391k comp. tokens) | gsm8k probe 0–4 |
|---|---|---|
| 46.49 (114 items, 155 s) | 22.86 | 25.00 (83 s, ~6.1k tok/item, 2/4 hit 8192 cap) |

Timing verdict: a full 1,110-item pass is ~2–5 h on this card, dominated by
gsm8k/math500/ifeval/coding/BFCL generation. Likelihood-side iteration is effectively
free (~5 min for all 8). Runs are under `~/delta/qwen35-workspace/bench-*/` on the
box; protocols under `proto-*.json`; scripts `run-likelihood-baseline.sh` /
`run-rest.sh`.

### Leaderboard forensics + first candidate set (2026-11-24)

CLI authenticated as `udirobert` (GitHub OAuth; 3 submissions/day, 4 trust points).
Leaderboard lineage is a single tree — every top entry descends through
`fdad0374` → `fb984a19` → `eff1e1b7` → `917d6b4f`.

Verified by tensor diff (`safetensors`, 488 keys each, fp16 storage noise ~3e-5):

- `eff1e1b7` vs `fb984a19`: differs in exactly **3 tensors, all layer 23** — the
  advertised "rollback of phase-gated neurons" is literally a 3-tensor L23 patch.
- `917d6b4f` vs `eff1e1b7`: 249 tensors differ, all in **layers 0–22** plus a
  ~1.5e-5 `embed_tokens` nudge — exactly the advertised "50/50 Model Soup
  layers 0-22 (pure eff1e1b7 L23)". On layers 0–22 `fb984a19 ≡ eff1e1b7`, so the
  soup partner is indistinguishable from {fb984a19, original parent} at fp16
  precision — the early layers barely changed across the lineage anyway.
- Implication: the frontier recipe is **small, surgically-scoped weight edits**,
  not retraining. Reproducing/extending is CPU-cheap (read two safetensors, blend,
  write one) — the expensive half is eval, which the likelihood shard makes ~free.

Candidates built on the box under `~/delta/v-cand-*` (all parented to `917d6b4f`),
each testing one hypothesis, scored locally on the 8-benchmark likelihood shard:

- `v-cand-l23`: extend the soup to L23 at α=0.15 toward the original parent —
  probes whether "keep L23 pure" is load-bearing or superstition.
- `v-cand-soup2`: 0.5·917d6b4f + 0.5·a6eb9f13 — soup across two complementary
  delta families (GRPO seed soup vs layer soup).
- `v-cand-extra`: 917d6b4f + 0.15·(917d6b4f − eff1e1b7) — mild extrapolation
  along the proven soup direction (prior 1.3× extrapolation regressed on the
  board; 1.15× is gentler).

Eval runner: `eval-cand.sh` (committed at `scripts/delta/eval-cand.sh`, plus
`eval-gen.sh` for generative shards) cycles a checkpoint dir through the pinned
vLLM container and runs the 8 likelihood benchmarks.

### First submission (2026-11-24)

The original RTX6000 host was reclaimed mid-eval (grant credit intact — $46.16
of $50 remaining). Replaced with **2× NVIDIA L40 (cc 8.9, 46 GB each),
hyperstack/montreal-canada-2, $2.80/hr** via the AGH dashboard. L40 runs the
**official pinned bf16 eval unmodified** — local scores are now apples-to-apples
with server-side. Instance access note: AGH partner instances use
password-only SSH emailed nowhere visible; workaround is a startup script that
injects a public key (see `scripts/delta/`). Second GPU lets two checkpoints
eval in parallel (one vLLM container per GPU, ports 8000/8001).

Candidate results vs rank-1 `917d6b4f` (official bf16 pipeline, 64-item shards):

| benchmark | ref917 | extra (×1.15 extrap) | l23 (α=0.15 L23) | soup2 (0.5·a6eb9f13) |
|---|---|---|---|---|
| arc_easy | 71.88 | 71.88 | 70.31 | **73.44** |
| arc_challenge | 26.56 | 26.56 | 26.56 | 26.56 |
| boolq | 64.06 | 64.06 | 64.06 | 64.06 |
| piqa | 71.88 | 71.88 | 71.88 | 71.88 |
| hellaswag | 45.31 | 45.31 | 45.31 | 45.31 |
| winogrande | 62.50 | 64.06 | 60.94 | 62.50 |
| commonsense_qa | 54.69 | 56.25 | 57.81 | 54.69 |
| openbookqa | 32.81 | 34.38 | 35.94 | 35.94 |
| **mean** | 53.71 | 54.30 | 54.10 | **54.30** |
| mmlu (114) | 47.37 | 47.37 | — | 46.49 |
| gsm8k probe (8) | 87.5/62.5 strict | 75.0/37.5 strict | — | **100.0/62.5 strict** |

Per-benchmark σ ≈ ±6 (64 items) — directional, not conclusive. `extra` regressed
on gsm8k strict; `l23` showed L23 is not fragile but offered no edge; `soup2`
(mean of rank-1 layer-soup and a6eb9f13's GRPO seed-soup) was best overall.

**Submitted:** `96b67023-ce48-4cfa-be8c-8db86694f154`, parent `917d6b4f`,
sparse diff 246 tensors / 91 MB (`delta patch build --parent v-917d6b4f
--modified v-cand-soup2/model.safetensors`), title "917d6b4f + a6eb9f13 50/50
model soup (GRPO seed-soup x layer-soup blend)". 1/3 daily submissions used;
7200 GPU-s reserved for server eval.

## Last Translation Benchmark — https://last-translation-benchmark.vilda.net/

- **What:** live benchmark collecting rolling submissions through end-2026; also hosts a
  model leaderboard. LTBv1 = 3,456 human-authored hard-to-translate examples across
  many language pairs (text-only eval slice: ~911 examples, 39 source / 14 target
  languages); co-authorship on the live publication at 10 approved contributions.
- **Leaderboard entry path:** models on the board are evaluated by the organizers —
  entry means submitting the model to them, not self-reporting a local run. A local
  LTBv1 eval is still worth doing first (canary below), but set expectations: the
  board is verifier-judged MT and `Papajams/ratiocine` is morphology-tuned, not an MT
  model — expect a near-bottom score. The value is an honest datapoint plus adjacency
  to our problem contributions, not placement.
- **Fit:** closest live venue to the linguistic-reasoning line; our contribution pipeline
  and export schema already exist (`docs/ltb_submission_summary.md`,
  `docs/ltb-export-schema.md`).
- **RTX6000 fit:** a 14B-AWQ eval fits comfortably in 24 GB (~8.5 GB weights). Turing
  risk is lower than it looks — `eval_14b_awq.py` loads via plain
  `AutoModelForCausalLM` (no `fuse_layers`, sdpa attention by default), the portable
  path — but Modal runs were on L4 (Ada), so sm75 is a genuinely new arch for this
  repo. Run a ~5-item canary before any batch.

## Explicitly closed / not a target

- **IOL-AI 2026** — closed 2026-07-26 (our run archived in `docs/iolai-competition.md`
  and `docs/iol-2026-technical-report.md`). No 2027 call yet.
- **ARC Prize 2026** — closed 2026-11-02.
- **Inverse Translation · AICC R10** (Kaggle) — late-submission only (ended ~Nov 2026).
- **Santa 2026 "Elf Calculator"** (Kaggle, $50k, ends ~Jan 2027) — arithmetic-program
  synthesis, not our model lane; would be a new project, not a reuse.
