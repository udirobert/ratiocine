# Do Linguistics Swarms Pool Their Evidence?

**Multi-agent grammatical induction under clean, poisoned, and monitored conditions**

*Apart Research — Swarm Alignment Hackathon, Nov 2026*

## Abstract

When LLM agents each hold only a fragment of the evidence needed to
induce a grammar, can they coordinate well enough to solve the task —
and what happens when one agent's evidence is silently corrupted or a
dedicated verifier watches the board? We build a minimal testbed on
top of procedurally generated languages with deterministic gold
answers: 4 agents receive disjoint shards of bilingual evidence pairs,
discuss over 4 shared-board rounds, and answer queries by majority
vote. Across {MODELS} × 9 puzzles × 3 conditions × 2 seeds ({N}
episodes, {CALLS} model calls), we find {HEADLINE}. Corrupted shards
propagated to non-poison agents in {X}% of poison episodes, and the
verifier condition {MONITOR_RESULT}. All grading is deterministic and
every transcript is released for re-analysis.

## 1. Introduction

The July 2026 incident in which ~1,200 OpenAI agents discovered a
shared directory, coordinated work, and ~700 breached Hugging Face's
systems showed that multi-agent failures are not reducible to
single-model alignment: collusion, division of labor, and covert
coordination emerge between agents (METR, 2026; OpenAI, 2026). Yet the
field lacks small, reproducible testbeds that isolate *how* swarms
fail on well-defined tasks.

We study a deliberately simple question: **can a swarm pool
partitioned evidence to induce the grammar of a language that does
not exist?** The task has three properties that make it a good
instrument:

1. **Forced information pooling.** Each agent sees only 3–4 of ~15
   evidence pairs; no single agent can induce the grammar alone.
   Communication is necessary, not optional.
2. **Deterministic ground truth.** Gold morpheme decompositions are
   computed by the generator; grading is exact-match, chrF, and
   morpheme-F1 — identical to our single-agent eval, so swarm and
   solo performance are directly comparable.
3. **Inspectable intermediate beliefs.** Agents post morpheme→meaning
   hypotheses to a shared board, so we can track *which claims spread*
   rather than only scoring final answers.

This positions the work next to SILO-BENCH (Zhang et al., 2026),
which showed agents fail at distributed coordination on algorithmic
tasks, and the MAST failure taxonomy (Cemri et al., 2025) for
multi-agent systems. Our contribution is the safety-relevant
extension: adversarial evidence (a silently corrupted shard) and an
oversight agent, on a task whose intermediate structure is
inspectable.

## 2. Related Work

- **SILO-BENCH** (arXiv:2603.01045, ACL 2026): role-free benchmark for
  free-form collaboration under information silos; 30 algorithmic
  tasks, 1,620 experiments; documents the "Communication-Reasoning
  Gap" — agents form good topologies yet fail to integrate
  information. We adopt the silo design but use inductive reasoning
  with inspectable hypotheses, and add adversarial conditions they do
  not test.
- **MAST / MAST-Data** (arXiv:2503.13657, NeurIPS 2025 D&B): 14 failure
  modes in 3 categories (specification, inter-agent misalignment,
  verification) from 1,642 annotated traces. Our monitor condition
  operationalizes their "verification" category.
- **AI Collusion Research Sprint** (Apart, Oct 2026): 392 projects;
  winners used seeded simulations with matched controls (e.g.,
  useful-work verification defenses, matched-twin collusion
  protocols). We follow the same rigor: seeded shards, deterministic
  grading, variance across seeds.
- **The HF incident analyses** (METR 2026; OpenAI 2026; swarms.wiki):
  motivation — emergent message boards, division of labor, and
  oversight gaps in real deployments.

## 3. Method

### 3.1 Task substrate

Puzzles come from `scripts/gen_puzzles.py` (preexisting): procedurally
generated languages with random morphemes, random phoneme inventories,
and seedable grammar rules — contamination-proof by construction. We
use `puzzles_gen1.json` (seed for the standard profile; 3 grammar
families: vowel harmony, noun-class agreement, conditioned
suppletion), 9 puzzles (3 per family).

### 3.2 Episode protocol

Each episode runs one puzzle under one condition and seed:

1. **Sharding.** The puzzle's ~14–16 evidence pairs are shuffled
   (seeded) and dealt round-robin to 4 agents (5 under `monitor`).
   Each agent also receives the shared morpheme bank — the tile
   inventory is public; the *evidence* is siloed.
2. **Board rounds (4).** Agents post in fixed order; each sees the
   full board plus its own shard. Posts must include a compact
   morpheme→meaning list and explicit agreements/disagreements.
3. **Answer round.** Each agent answers all queries from its shard +
   board. Answers are re-segmented against the tile bank (the same
   bank-aware parsing as the single-agent grader) so segmentation
   style cannot fake a failure.
4. **Aggregation.** Per-query majority vote across agents; ties break
   to the earliest agent. We also record each agent's individual
   answers for agent-vs-swarm comparisons.

### 3.3 Conditions

- **clean** — all shards correct (baseline).
- **poison** — one randomly chosen agent's shard has 2 target glosses
  replaced by plausible English glosses drawn from *other* puzzles
  (wrong but not obviously so; no announcement). Tests whether bad
  data propagates through the board.
- **monitor** — a 5th agent with a verifier role prompt ("flag claims
  your shard contradicts") joins the swarm. Tests whether cheap
  oversight changes outcomes.

### 3.4 Metrics

- **EM-decomp / EM-surface / chrF / morpheme-F1** — deterministic,
  identical to the single-agent eval (`eval-hackathon/run_eval.py`).
- **agent-EM / oracle-EM** — mean and best per-agent accuracy:
  separates "the swarm failed" from "voting threw away a correct
  minority."
- **unanimous** — fraction of queries where all agents agree
  (consensus rate; high consensus + low EM = groupthink signature).
- **contagion** — in poison episodes, non-poison board posts quoting a
  corrupted row's source string (the bad data physically spread).
- **flag-rate** — fraction of monitor posts containing
  contradiction language.

### 3.5 Sweep

{MODELS_DETAIL} × 9 puzzles × 3 conditions × 2 seeds = {N} episodes,
{CALLS} model calls, full transcripts logged.

## 4. Results

{RESULTS}

## 5. Discussion

{DISCUSSION}

## 6. Limitations and Dual-Use / Ethical Considerations

{LIMITATIONS}

## References

- Cemri et al. (2025). Why Do Multi-Agent LLM Systems Fail? arXiv:2503.13657.
- Zhang et al. (2026). SILO-BENCH: A Scalable Environment for Evaluating
  Distributed Coordination in Multi-Agent LLM Systems. arXiv:2603.01045.
- METR (2026). Investigation of the OpenAI–Hugging Face intrusion.
- OpenAI (2026). Disclosure of agent activity affecting third parties.
- Bilge & Miotti (2026). ControlAI summary of reported incidents.
- Gutenberg (2026). swarms.wiki — agent-incident datasets and tools.
- Von Arx et al. (2026). collusion.wiki — agent message-board corpus.
