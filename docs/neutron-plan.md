# Ration — ratiocine as a Neutron app (hackathon plan)

One-liner: **"A reasoning agent that keeps a certified logbook — every solve is
parsed, graded against ground truth, and signed by the subnet under a key no
single node ever holds. The evidence lives in *your* canister."**

ratiocine wins the demo axis (30-second, deterministic, exact-match-verifiable);
the canister wins the trust axis (certified ledger, chain-key-signed attestation,
user sovereignty). No on-platform rival: DeSci Labs Publish is human-centric
bundle publishing; PaperBench/CORE-Bench are evaluations, not tools.

## Why this is unique on ICP (the 3 pillars)

1. **Proof of reasoning, not proof of compute.** ICP's certified data makes
   *state* provable. ratiocine is the only engine whose output has an
   *objective machine-checkable grade* (exact match + chrF on Linguini format).
   The canister computes the grade locally (parser + EM + chrF in Motoko) and
   signs the (problem, attempt, grade) tuple. Anyone can verify any ledger
   entry against the ICP root key. A "logbook of agent reasoning where every
   entry is independently verifiable" does not exist elsewhere on ICP.
2. **The ledger is forge-resistant by construction.** State lives in the
   owner's canister (stable memory), every attestation is chain-key-signed
   (threshold, installation-isolated key), and published evidence is a
   certified asset (hash-tree root, witness-verified, absence provable).
   Demo trick: a "forge attempt" mode that lets the user try to inject a wrong
   answer — the canister logs it as FAIL, and the signed attestation proves
   the grade wasn't what the user wanted. Trust made visible.
3. **User-sovereign agent tool.** `solve_problem` / `grade_attempt` /
   `get_ledger` are typed Agent Mode tools on the kernel catalog. The stock
   resident Agent (or any backend agent) can call them across apps. Every
   invocation is journaled in the owner's own canister — a personal reasoning
   history the owner controls, with no account system and no shared server.

## Architecture

```
User's Neutron canister (SushiOS)
├── ratiocine app (Motoko backend module, compiled INTO the canister)
│   ├── solve(problem)        → https_outcall → hosted ratiocine API
│   ├── grade(attempt)        → pure Motoko: Linguini parser + EM + chrF(1–2)
│   ├── attest(entry)         → chain_key_signing: sign digest of
│   │                            {problem_id, prompt_hash, attempt, em, chrf, ts}
│   ├── ledger: stable memory (append-only entries + grades + sigs)
│   └── publish(report)       → certified_assets: hash-chain logbook, public
│                                read, verifiable against root key
└── Frontend tile: paste problem → solve → graded answer → ledger/logbook UI
    (+ "forge attempt" mode for the demo)

Hosted (ours): ratiocine inference API on Modal T4
    Qwen2.5-14B-AWQ + task-specific prompts (hf-pipeline/submission/prompts.py)
    POST /solve  {context, query, work_lang, task_lang, task_type} → {pred[]}
    The canister is the verifier, not the compute. Small verify step, big
    reasoning step — exactly the shape Neutron wants.
```

Fallback (no hosted API): app also declares the `openrouter` connection
provider (already in the kernel catalog — same as `apps/agent`), so the
frontend/background can solve via a 7–14B OpenRouter model with ratiocine's
prompt templates. Slower and less accurate, but removes the infra dependency.

## What we build

### A. Hosted solve API (1–2 days)
- Wrap the existing `hf-pipeline/submission/script.py` model loading +
  `prompts.py` task-specific prompts in a FastAPI service.
- Deploy on Modal (workspace `ungethe` already configured), T4, float16/AWQ.
- Greedy decoding, tiered `max_new_tokens` per task type (from IOL-AI lessons).
- Endpoint: `POST /solve`, returns `{"pred": [...], "model": "...", "tokens": n}`.

### B. The `.neutron` app (the hackathon deliverable, 3–5 days)
- Work **inside a clone of `github.com/infu/neutron`** (apps install into the
  monorepo's local PocketIC fleet; no mainnet needed per the docs).
- Scaffold: `cp -R apps/hello apps/ratiocine`, then:
  - `neutron.json`: id `ratiocine`, tile, `func` map for
    `solve`/`grade`/`attest`/`get_ledger`/`list_ledger`, capabilities:
    `https_outcalls` (exact prefix = our Modal URL, POST, size bounds),
    `chain_key_signing` (api 1, bounded assertion), `certified_assets`,
    optionally `connections.openrouter` for the fallback path.
  - `backend/main.mo`:
    - stable memory: `List` of ledger entries
      `{id, problem_hash, problem, task_type, attempt, em: Bool, chrf: Float,
       sig: Blob, timestamp}`
    - Linguini parser + EM (normalized exact match) + chrF-1/2 in Motoko
      (port from the evaluation code; both are small).
    - `solve` → `env.capabilities.https_outcalls` POST to `/solve`.
    - `attest` → build the assertion digest, `chain_key_signing.sign(...)`.
    - `publish_report` → certified asset (JSON/HTML logbook).
  - `src/index.tsx` frontend (React, `neutron-design-system` SCSS):
    problem form, answer display with EM/chrF badge, ledger table with
    per-entry "verify signature" button, forge-attempt toggle.
- Local loop: `npm run build:all` → provisioner PocketIC →
  `http://<canister>.localhost:8000` → install via launcher → demo.

### C. Demo script (30–60s, live)
1. Open SushiOS launcher, install **Ration** (consent prompts show the
   declared capabilities — outcall prefix, chain-key, certified assets).
2. Paste a Linguini problem → "Solve" → typed answer with **EM ✓ / chrF 0.91**
   badge. Ledger entry appears; click it → subnet signature verified against
   the ICP root key.
3. Agent Mode: open the stock Agent tile, ask "solve this problem for me" →
   the agent discovers `ratiocine.solve` on the kernel catalog and calls it →
   another signed ledger entry.
4. Forge attempt: type a deliberately wrong answer through the app → logged
   **FAIL** → signed attestation shows the grade the canister computed, not
   what the user wanted.
5. Publish logbook → any visitor verifies the file's witness; explain
   "absence is provable too."

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Neutron is preproduction; chain-key signing & certified assets are "development" with release gates | Verify both work on local PocketIC early (day 1). Fallback: ledger entries store digests + a browser-side signed receipt; still a strong story. |
| `https_outcalls` on local PocketIC may not reach the real internet | Check `doc/provisioning-system.md` / capability docs early. Fallback 1: outcall to a local mock solver during demo. Fallback 2: OpenRouter connection path (kernel-catalogued, proven by `apps/agent`). |
| Motoko chrF/EM port bugs | Port from the exact IOL-AI eval code; unit-test against the 160 Linguini examples with known scores. |
| Scope creep | Ship A + B (solve → grade → sign → ledger) first. Agent Mode tools come free by exposing `func` in the manifest. vetKeys = stretch goal only. |
| Demo model latency (14B on T4, ~5–15s/problem) | Pre-load warm container on Modal; show a cached Linguini problem live; keep the API path live for credibility. |

## Milestones

- **M1 (day 1–2):** hosted `/solve` API live on Modal, tested with a
  Linguini CSV row.
- **M2 (day 2–3):** ratiocine app scaffold compiles, packages
  (`ratiocine.v0.1.0.neutron`), installs into local PocketIC SushiOS.
- **M3 (day 3–4):** end-to-end: solve → grade → sign → ledger → frontend.
- **M4 (day 5):** Agent Mode integration + certified logbook publish +
  forge-attempt demo polish.
- **M5:** hackathon submission (repo + local demo recording + optional mainnet
  deploy via the 2-ICP dispenser if time allows).

## Open questions (check in the neutron repo before building)

1. Does PocketIC support `https_outcalls` to the open internet locally?
   (`doc/app-developer-guide.md` §Use External Connections only covers the
   *Connections* consent path; the backend `https_outcalls` broker needs a
   local test.)
2. What is the exact bounded-assertion digest format for
   `chain_key_signing` V1? (`doc/app-isolated-chain-key-signing.md`)
3. Certified assets public-read policy + how the frontend verifies the witness
   (`doc/kernel-http-v2-and-certified-assets.md`).
4. Can we submit our app package (`.neutron` archive + repo fork) rather than
   a kernel fork? (Presumably yes — that's what third-party apps are.)
