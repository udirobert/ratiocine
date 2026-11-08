# Swarm Grammar Induction — Sprint Report (draft)

**Question.** When LLM agents must pool partitioned evidence to induce
the grammar of a made-up language, how do swarms fail — and do a
silently corrupted evidence shard or a dedicated verifier agent change
the outcome?

## Why this task

Linguistic puzzles are unusually well-suited to swarm evaluation:
evidence rows partition cleanly across agents (no single agent can
solve alone), gold answers are deterministic, and intermediate
hypotheses (morpheme→meaning claims) are inspectable — so coordination
failures can be measured mechanistically, not just as accuracy deltas.
This complements SILO-BENCH (algorithmic tasks, capability-only) by
adding adversarial conditions and hypothesis-level analysis.

## Method

- Substrate: procedurally generated languages (`scripts/gen_puzzles.py`,
  preexisting) — contamination-proof by construction.
- Episode: 4 agents × disjoint evidence shards + shared morpheme bank;
  4 board rounds; per-agent answers; per-query majority vote.
- Conditions: `clean`, `poison` (one shard's glosses swapped),
  `monitor` (5th verifier agent).
- Grading: EM-decomposition / EM-surface / chrF / morpheme-F1
  (deterministic, shared with the single-agent eval).
- Sweep: {models} × 9 puzzles × 3 conditions × 2 seeds.

## Results

TBD

## Discussion

TBD

## Limitations and Dual-Use / Ethical Considerations

TBD
