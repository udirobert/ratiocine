# Q3 entry pack — Ration (Qualifier 3, closes 6 Sept 2026 12:39 BST)

Submit BEFORE 11:39 BST — the final-hour lock freezes revisions.
Profile → Entries → upload the `.neutron` file + materials below.
Reward wallet must be set before submitting.

## Package

`neutron/apps/ratiocine/ratiocine.v0.4.0.neutron` (281,053 bytes; limit 1.9 MB)
Rebuilt 5 Sept from current `ration-app/` and verified on fresh local PocketIC
(sign → grade → ledger → certified report, all green).

## Title

Ration — certified reasoning logbook

## Summary (paste)

Ration is a certified reasoning logbook for AI problem-solving. A 14B model
tackles real linguistics puzzles; the canister then grades every answer
deterministically in-canister (exact match + chrF), SHA-256-hashes the
evidence, chain-key-signs the receipt (ecdsa_secp256k1), and appends it to a
stable ledger that survives upgrades.

New since our last entry:

- Ten real IOL-style language problems ship in the app — Apurinã, Swahili,
  Turkish, Quechua, Nahuatl, plus Esperanto, Indonesian, Finnish, Māori and
  Zulu — every one with ground truth, so the canister grades before signing.
- One-click instant demo: a canned perfect answer produces a signed receipt
  in seconds, no GPU wait. Judges see grade → sign → ledger immediately.
- Honest-scope receipts: every certificate states exactly what it attests
  (this output, this reference, this time) and marks model provenance
  unverified — plus an "altered claim" mode that proves tampering changes
  the grade instead of the signature.
- Agent Mode entrypoints (`ration_attest`, `ration_ledger`, `ration_report`)
  expose the whole logbook to the kernel agent catalog, covered by an
  integration test (`test/agent_entrypoints.test.ts`).
- Certified reports: paginated, content-addressed, served over HTTP as
  immutable JSON any third party can fetch and verify.

Cold GPU start is deliberate "honest compute": no 24/7 GPU, the engine wakes
only when asked. Play the same puzzles as a daily game at the link below and
compare your own score against the machine.

## Links (paste, up to 6)

1. https://ratiocine.trustfall.xyz/play — play the same 10 puzzles daily, beat the machine
2. https://github.com/udirobert/ratiocine — source (app: `ration-app/`)
3. https://cvrwv-mqaaa-aaaai-ax4pa-cai.icp0.io/ — mainnet canister
4. https://ntron.net — built on Neutron (agent entrypoints + certified assets)

## Screenshots (`entry-screenshots/`, all < 100 KB)

1. `1-problem-bank.png` — ten graded language problems
2. `2-live-answer.png` — real 14B answer, timeline complete
3. `3-honesty-demo.png` — new languages + altered-claim demo mode
4. `4-deduction-theatre.png` — live GPU run with insight cards

## Icon

`ration-app/public/static/icon.png` (81 KB; limit 100 KB)

## Pre-submit checklist

- [ ] Hacker role on, reward wallet set
- [ ] Package uploaded (v0.4.0, 281,053 bytes)
- [ ] 4 screenshots + icon uploaded
- [ ] Summary + links pasted
- [ ] Submitted well before 11:39 BST 6 Sept (moderation buffer)
