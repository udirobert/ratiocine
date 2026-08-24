# Architecture & deployment status

ratiocine has two complementary product surfaces under one brand: **Ratiocine**
teaches linguistic deduction; **Ration** records a canister-evaluated AI attempt
as a signed, publishable evaluation event.

## IOL-AI solver and showcase

- **Code**: `src/arkor/` (rapid prototyping) and `hf-pipeline/` (production HF
  pipeline). See [`iolai-competition.md`](./iolai-competition.md).
- **Model artifact**: the solver code defaults to the configured
  `Papajams/ratiocine` HF model artifact. Public model/revision claims must be
  tied to a captured Modal deployment before being treated as release evidence.
- **Showcase**: `showcase/` provides the Vercel-hosted Apurinã practice puzzle
  at [`ratiocine.vercel.app`](https://ratiocine.vercel.app). Its progress,
  attempts, and hints are browser-local unless the user explicitly hands a
  bounded result to Ration.

## Ration: package, preview, and attestation are separate

Ration separates expensive remote inference from deterministic,
canister-owned evaluation:

```text
browser (Vercel showcase or a Neutron tile)
  └─ POST /api/solve → Netlify → Modal GPU worker
       GET /api/status ← Netlify ← Modal job store
  └─ receives a candidate answer and optional browser-declared human outcome

installed Ration app in the user's Neutron canister
  └─ ordered EM + chrF grade against supplied references
  └─ SHA-256 commitments + chain-key signature + stable ledger append
  └─ optional immutable certified ledger report publication
```

The canister is the **verifier, not the compute**. A receipt proves that the
specific installed canister evaluated submitted data at a recorded time. It
does **not** prove the identity of a browser user, the provenance of a remote
model, or the truthfulness of caller-supplied ground truth/model labels.

### Verified delivery snapshot — 24 August 2026

| Surface | Verified fact | What it does **not** establish |
|---|---|---|
| Neutron Hackathon | Week 1 package submitted as `ratiocine_l.neutron`, v1, reported as 272 KB with five screenshots. | A public Ration canister installation or a public report. |
| Netlify | [`ratiocine.trustfall.xyz`](https://ratiocine.trustfall.xyz) returns HTTP 200; `/api/status` is live and rejects a missing job ID without dispatching a solve. | That a candidate answer is a signed receipt. |
| Modal | `ratiocine-solve` is deployed with a scale-to-zero L4 worker and had no active containers at inspection. | An outage: zero active containers is the intended idle state. |
| Ration attestation | The local PocketIC canister verifies ordered grades, chain-key signatures, certified report publication, and v3 stable-memory migration. | Mainnet/ICP availability. The recorded canister is local only. |

The first row is the submitted product artifact; the second and third rows are
the live inference-preview path; the fourth row is the verified attestation
implementation. These must not be presented as one already-public signed
service.

### Current browser solve path

The Netlify functions proxy the browser's `POST /api/solve` and `GET
/api/status` requests to Modal. The CPU submit/status functions track jobs for
one hour; only `run_solve` starts an L4 GPU worker. This makes a zero-activity
Modal dashboard expected between demonstrations. The public preview uses CORS
for browser access and has Netlify function timeouts, so it is a convenience
surface rather than a durable or private data store.

The Netlify **live solve preview** intentionally is not a receipt: it shows a
candidate inference result and a local comparison. A signed evaluation is
created only when an installed Ration app calls `attest_entry`.

## Canonical human-to-AI comparison

The code implements the product sequence below for the versioned
`apurina-verb-agreement@1` case:

```text
play the canonical Apurinã puzzle
  → emit a bounded browser-declared human outcome
  → solve the exact same five ordered prompts with AI
  → compare human declaration, AI candidate, and reference
  → attest the ordered AI evaluation in Ration
  → publish a content-addressed certified report (after public deployment)
```

`showcase/app/play/canonical-apurina.ts` defines the allowlisted case and its
SHA-256 hash. The handoff carries ordered answers, attempts, hints, elapsed
time, and gated-context state—not the puzzle context or answer key. Ration
stable-memory **v3** binds new attestations to the context, prompt, reference,
canonical case, and human-outcome commitments. `ration/ordered-v1` requires
equal answer counts and position-by-position matching. `get_pubkey` returns
hex-encoded public-key material for an external verifier.

## Neutron app and Agent Mode

The submitted source declares the following narrow Agent Mode entrypoints:

| Tool | Purpose |
|---|---|
| `ration_attest` | Grade and sign a supplied evaluation input. |
| `ration_ledger` | Read the ledger. |
| `ration_report` | Publish a certified content-addressed report. |

They are present in the manifest and generated package schema. A stock-agent
catalog discovery and cross-app invocation remain a separate runtime test; the
documentation does not claim that proof yet.

## Public ICP deployment remains pending

There is no verified public Ration canister principal, tile URL, certified
report URL, or certificate-aware verifier result. The committed
`ration-app/deploy/neutron/` templates deliberately fail closed until an owner
supplies a target subnet, funded deployment identity, CMC payment amount,
controller policy, and exact Kernel/Ration archive pins.

The remaining sequence is:

1. Produce and retain the exact release archives, checksums, byte counts, and
   package versions.
2. Install the Neutron production provisioner identity tooling, select/fund a
   deployment identity, and fill the reviewed production manifest locally.
3. Run `status` and non-executing `create` preflight.
4. Obtain explicit approval immediately before `create --execute`, which funds,
   creates, and installs stateful public infrastructure.
5. Record the resulting canister/tile/report URLs, set
   `NEXT_PUBLIC_RATION_TILE_URL`, and run a real certificate-witness plus
   secp256k1 verification against the deployed report.

Until then, say **submitted package**, **live unsigned solve preview**, or
**locally verified attestation**—not “public signed demo” or “independently
verified model provenance.”

## Local development

```bash
./scripts/sync-ration-app.sh
cd neutron
npm --workspace neutron-ratiocine run package
npm run provision -- ration-local.ndeploy.json serve
npm run provision -- ration-local.ndeploy.json reinstall
```

`ration-app/` is canonical source; `neutron/` is an ignored local clone of
`github.com/infu/neutron`. Its Motoko compiler is patched; see
[`ration-app/README.md`](../ration-app/README.md) for its syntax constraints.
