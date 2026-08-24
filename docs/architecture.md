# Architecture & deployments

ratiocine has two complementary product surfaces under one brand: **Ratiocine**
teaches and tests linguistic deduction; **Ration** records a canister-evaluated
AI attempt as a signed, publishable evaluation event.

## IOL-AI solver (competition)

- **Code**: `src/arkor/` (rapid prototyping) + `hf-pipeline/` (production HF
  pipeline). See [`docs/iolai-competition.md`](./iolai-competition.md).
- **Model**: Qwen2.5-14B-Instruct-AWQ on HF
  ([Papajams/ratiocine](https://huggingface.co/Papajams/ratiocine)).
- **Showcase**: `showcase/` — a Next.js build story and playable Apurinã
  deduction puzzle, deployed to **Vercel** as
  [`ratiocine.vercel.app`](https://ratiocine.vercel.app).

The showcase puzzle is practice mode: each answer is supported by the examples,
hints are unlimited, and the timer/progress record is browser-local. It is not
a live model execution or a durable human attestation.

## Ration — Neutron app (hackathon)

Ration separates expensive remote inference from deterministic, canister-owned
evaluation:

1. The **browser** submits a puzzle to the solver and polls for the candidate
   answer. The GPU engine is not inside a canister.
2. A user's **Neutron canister** deterministically grades the submitted output
   against supplied ground truth using EM + chrF.
3. The canister SHA-256-hashes its evaluation assertion, chain-key-signs it,
   appends it to stable memory, and can publish the ledger as a content-addressed
   certified HTTP asset.

The canister is the **verifier, not the compute**. A receipt attests that a
specific canister evaluated a submitted output against supplied reference data
at a recorded time. It does **not** independently prove which remote model
created the output, who solved a browser puzzle, or that submitted model
metadata is truthful. Full plan: [`docs/neutron-plan.md`](./neutron-plan.md).

```text
Vercel showcase ──human practice result──► Ration handoff (planned)
Browser / Neutron tile ──POST /api/solve──► Netlify ──► Modal GPU
Browser / Neutron tile ◄──GET /api/status── Netlify ◄── Modal job status
Neutron canister ──grade + sign + ledger──► certified report (on publication)
```

## Public surfaces

| Surface | Host | Current role |
|---|---|---|
| [`ratiocine.vercel.app`](https://ratiocine.vercel.app) | Vercel | IOL-AI story and playable Apurinã practice puzzle |
| [`ratiocine.trustfall.xyz`](https://ratiocine.trustfall.xyz) | Netlify | Ration landing, live unsigned solve preview at `/demo/`, and `/api/solve` / `/api/status` GPU proxies |
| User's Neutron canister | ICP / Neutron | Ration tile: deterministic grade, chain-key signature, stable ledger, and certified report publication |

The Netlify **live solve preview** intentionally is not a receipt: it displays a
candidate inference result and a local comparison only. A signed evaluation is
created exclusively when a Ration tile calls `attest_entry` in an installed
Neutron canister.

## Seamless human-to-AI receipt journey

The code now implements the first four stages of the product sequence:

```text
play the canonical Apurinã puzzle
  → emit a bounded browser-declared human outcome
  → solve the exact same versioned case and five ordered prompts with AI
  → compare human declaration, AI candidate, and reference before attestation
  → grade and sign the ordered AI evaluation in Ration
  → publish a content-addressed certified report (after canister deployment)
```

`showcase/app/play/canonical-apurina.ts` defines the allowlisted
`apurina-verb-agreement@1` case and its SHA-256 hash. The URL handoff contains
only a bounded human declaration—ordered answers, attempts, hint count, elapsed
time, and gated-context state—not the context or answer key. The Ration tile
and Netlify demo independently use the bundled canonical case after validating
that version/hash declaration.

Ration stable-memory **v3** binds new attestations to `context_hash`,
`prompt_hash`, `ground_truth_hash`, `case_version`, `case_hash`, and
`human_outcome_hash`. The v2→v3 migration preserves historical entries with
those new fields marked absent. `ration/ordered-v1` requires equal answer
counts and grades each prediction against the same-numbered reference; it does
not use the former best-match-across-reference-set behavior. `get_pubkey`
returns the chain-key public key and fingerprint as hexadecimal JSON.

## Remaining public signed-demo work

Before this can be advertised as a **true public signed demo**, the following
production work remains:

1. Deploy the packaged v3 Ration app to a public Neutron/ICP canister and set
   `NEXT_PUBLIC_RATION_TILE_URL` in Vercel to its stable tile URL. The checked-in
   deployment manifest is PocketIC-only.
2. Publish a report from that public canister and implement a verifier that
   validates the certified HTTP witness against the ICP root key, report content
   hash, assertion hash, and secp256k1 signature using the exposed public key.
3. Keep the trust boundary visible: a receipt binds a canister evaluation and a
   browser-declared outcome, not a person's identity or remote-model provenance.

Until the public canister and verifier exist, product copy must say **signed
evaluation** or **certified report**, not “independently verified model
provenance.”

## Building / running Ration locally

```bash
# Sync canonical source → local Neutron clone, then package for PocketIC.
./scripts/sync-ration-app.sh
cd neutron
npm --workspace neutron-ratiocine run package
npm run provision -- ration-local.ndeploy.json serve     # terminal 1
npm run provision -- ration-local.ndeploy.json reinstall # terminal 2
```

Verified on local PocketIC: chain-key signing, `attest_entry` grading,
64-byte signatures, `publish_report` over certified HTTP, and in-place
upgrade persistence.

> `ration-app/` is canonical source; `neutron/` is a gitignored local clone of
> `github.com/infu/neutron`. Its Motoko compiler is patched—see
> `ration-app/README.md` for syntax differences including `:=` reassignment,
> `Array.concat` vector append, and no `.vals()`.
