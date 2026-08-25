# Ration — Neutron Hackathon submission and deployment plan

**One-line product:** Ration is a certified reasoning logbook: it grades an AI
answer against supplied ground truth in a user's Neutron canister, hashes the
evaluation, chain-key-signs it, retains it in stable memory, and can publish a
certified report.

The important distinction is deliberate: remote inference is useful, but it is
not trusted. Modal proposes an answer; the canister evaluates the supplied
attempt and records what *it* checked.

## Submission status

Ration was submitted to the **AI-assisted apps for Neutron** Hackathon, Week 1,
as **“Ration — a certified reasoning logbook.”** The submitted artifact is
listed as `ratiocine_l.neutron`, version 1, approximately 272 KB, with five
screenshots. This record describes the submitted package, not a public
canister deployment.

The local Neutron provisioning journal records the corresponding Ration v1
package as version `100`, 272,248 bytes. It is useful build evidence and is
consistent with the marketplace's rounded size, but the marketplace archive
hash has not yet been exported and independently compared.

## What is live and what is not

| Component | Status | Evidence boundary |
|---|---|---|
| Hackathon package | Submitted in Week 1 | Package/listing evidence; not a deployed Ration service. |
| Ration landing + solve preview | Live on Netlify at `ratiocine.trustfall.xyz` | Browser inference preview only; `/api/status` has been probed without starting a solve. |
| Modal inference | Deployed, scale-to-zero | Idle containers are expected between requests. The app uses an L4 GPU only when a solve is dispatched. |
| Ration attestation | Verified on local PocketIC (v0.4) | Ordered EM + chrF, chain-key signatures, page-chunked ledger, duplicate rejection, paginated certified report publication (format v2), access control, and v3→v4 migration are local proofs. |
| Public ICP Ration canister | Not yet verified/deployed | No public principal, tile/report URL, or certificate-aware verifier result is recorded. |

## Product architecture

```text
browser / Ration tile
  ├─ POST /api/solve → Netlify → Modal submit function
  ├─ GET  /api/status ← Netlify ← Modal job status
  └─ submit candidate answer to installed Ration

Ration inside the user's Neutron canister
  ├─ ordered deterministic grade: EM + chrF
  ├─ SHA-256 assertion commitments
  ├─ `ration_assertions` chain-key signature
  ├─ page-chunked stable v4 ledger (O(1) amortized append)
  ├─ duplicate job_id rejection
  └─ optional immutable certified report publication (paginated, format v2)
```

The browser-first submit/poll path is intentional: local PocketIC cannot make
real outbound HTTPS, and a canister cannot synchronously wait for Modal's
asynchronous GPU job. A future mainnet deployment can use its declared HTTPS
capability where appropriate, but the receipt path remains canister-verifiable
regardless of where inference runs.

## Human interface and agent tools

The human path is a short, legible sequence: enter or receive a puzzle, watch
Deduction Theatre while the browser polls the solver, inspect candidate/reference
comparison, then grade and sign in Ration. The canonical Apurinã handoff adds a
bounded human result—answers, attempts, hints, elapsed time, and
gated-context state—without placing the puzzle answer key in a URL.

Ration exposes three declared Agent Mode tools:

| Tool | Input / output | Purpose |
|---|---|---|
| `ration_attest` | `AttestInput` → `AttestResult` | Deterministically grade and sign an evaluation. |
| `ration_ledger` | `()` → ledger entries | Retrieve the signed reasoning history. |
| `ration_report` | `()` → report locator | Publish a certified content-addressed report. |

The tools are in source, manifest, and generated schema. A real stock-Agent
catalog discovery and invocation transcript is still required before claiming
that the runtime integration has been demonstrated.

## Trust statement for reviewers

A Ration receipt attests to the canister's evaluation of caller-supplied
problem, reference, prediction, and model label. It does not independently
attest to a human's identity, the remote model that generated an answer, or the
truth of caller-supplied reference data. A public verifier must validate the
ICP-certified HTTP witness, report digest, assertion hash, and secp256k1
signature against the deployed canister's public key.

## Product philosophy

The user-facing value is the **comparison experience**: you and a machine
solved the same puzzle, graded by the same rules. That's inherently interesting
and shareable.

The cryptographic infrastructure (chain-key signatures, certified assets,
content-addressed reports) provides **ceremony and honesty** — it makes the
comparison feel weighty and prevents anyone from editing the record after the
fact. But it is not the headline. The headline is: "Here's how you compared."

Sequence of priorities:
1. Make the puzzle fun (the game has to work as a game).
2. Make the comparison delightful (the AI solve + side-by-side is the reward).
3. Let the receipt be the quiet proof underneath (permanent, honest, verifiable if you care to look).

Do not lead with "provable" or "on-chain" in user-facing copy. Lead with the
comparison.

## Path to a true public signed demo

The checked-in `ration-app/deploy/neutron/` templates are intentionally
non-runnable until an operator provides real values. Before public creation we
need:

1. The selected ICP subnet and verified Registry evidence policy.
2. A funded local deployment identity and approved CMC `payment_icp` amount.
3. Any approved backup controller principals; do not publish controller policy
   unless the owner wants it public.
4. Exact archive pins for `kernel.v0.3.7.neutron` and the selected Ration
   release: path, SHA-256, bytes, id, and version.
5. Installed `icblast` identity tooling; it is not currently available in this
   workspace.

Then run `status`, run the read-only live `create` preflight, and obtain
explicit approval before `create --execute`. That final command transfers
funds through the CMC route, creates a stateful canister, and installs the
Kernel and Ration.

After deployment, publish one report, record the public canister/tile/report
URLs, set `NEXT_PUBLIC_RATION_TILE_URL`, and run the independent certificate
and signature verifier. Only then should the landing page call it a public
signed demo.

## Public versus private release information

**Publish:** package title/version/checksum, source commit, public canister/tile
and report URLs once they exist, declared capabilities, model family/revision
when frozen, the trust boundary, verifier instructions, and a concise
operational note that Modal is scale-to-zero with one-hour job retention.

**Keep private:** deployer private keys, Modal/Netlify/HF tokens, internal
provider account IDs, CMC funding account details, controller rationale, raw
request/job contents, and any unapproved user data. Canister/controller
principals are not secret cryptographically, but publish them only when there
is a practical reviewer or verifier need.
