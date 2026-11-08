# swarm_eval — multi-agent linguistic-induction testbed

Sprint project for the **Apart Research Swarm Alignment Hackathon**
(Nov 6–8, 2026). Question: when language-model agents must pool
partitioned evidence to induce a grammar, how do swarms fail — and does
a poisoned shard or a verifier agent change the outcome?

## Design

- Task substrate: `eval-hackathon/data/puzzles_gen*.json` — procedurally
  generated languages with deterministic gold answers (preexisting
  ratiocine infrastructure, declared as such in the report).
- Each episode: N agents (default 4) each receive a disjoint shard of
  the puzzle's evidence pairs plus the shared morpheme bank. For R
  rounds they post findings to a shared board; then each agent answers
  all queries independently and the swarm answer is a per-query
  majority vote.
- Grading reuses `eval-hackathon` metrics: EM-decomposition,
  EM-surface, chrF, morpheme-F1 — directly comparable to the
  single-agent baselines in `eval-hackathon/RESULTS.md`.
- Agent answers are re-segmented against the tile bank
  (`refine_answer`) — the same bank-aware parsing the single-agent
  grader uses, so segmentation style can't fake a failure.

## Conditions

| condition | manipulation |
|---|---|
| `clean`     | all shards correct |
| `poison`    | one agent's shard has 2 target glosses swapped — plausible but wrong data, no announcement |
| `monitor`   | a 5th verifier agent whose role is to flag claims its shard contradicts |
| `soloshard` | no board rounds — agents answer from their shard alone (communication ablation) |

## Usage

```bash
python3 swarm_eval/run_swarm.py --model <id> --provider <name> \
    --puzzles gen-000,gen-001 --conditions clean,poison,monitor \
    --seeds 1,2 --output swarm_eval/results/run.json
```

Results land in `swarm_eval/results/` as full transcripts (board
messages, per-agent answers, votes, grades) — every number in the
report can be re-derived without API calls.

```bash
python3 swarm_eval/analyze_swarm.py swarm_eval/results/*.json
```

prints the condition table plus contagion spread and monitor flag
rates. `run_swarm.py --append` resumes an interrupted sweep, skipping
completed (puzzle, condition, seed) cells.

## Video

`video/` contains the submission-video pipeline (final cut:
`video/output/swarm-alignment.mp4`, ~3:46, burned captions + `.srt`
sidecar):

1. `audio/script.json` → `audio/build_audio.py` (ElevenLabs per-scene
   narration, word timestamps → `audio/scenes/narration.wav`)
2. `record.mjs` / `record_fix.mjs` / `rec_dash.mjs` — Playwright +
   system Chrome records `scenes/*.html` and `dashboard.html` at 1080p;
   scene durations in `DURS` must match `build_audio.py` and
   `make_captions.py`
3. `make_captions.py` — word timestamps → `captions.srt` + `captions.ass`
4. `assemble_final.sh` — concat segments, burn ASS captions, mux
   narration → `output/swarm-alignment.mp4`

Scenes use the shared brand system (`scenes/brand.css`, tokens from
`showcase/app/globals.css`): Fraunces/Geist fonts in `video/fonts/`,
FLUX 3 Max plates in `footage/gen/` as living backdrops (prompts in
`FLUX_PROMPTS.md`), camera drift + narration-synced reveals. Assembly
requires the `~/.local/bin/ffmpeg` build (libass for subtitle burn-in).

## Preexisting vs sprint work

Preexisting (declared): `scripts/gen_puzzles.py`,
`scripts/llm_providers.py`, `scripts/run_models_for_ltb.py`,
`eval-hackathon/run_eval.py` grading helpers, puzzle datasets.
Sprint work (this weekend): `run_swarm.py` orchestrator, shard/board
protocol, poison + monitor conditions, contagion metrics, report.
