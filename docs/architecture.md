# Architecture & deployments

Two distinct halves under one brand.

## IOL-AI solver (competition)

- **Code**: `src/arkor/` (rapid prototyping) + `hf-pipeline/` (production HF
  pipeline). See [`docs/iolai-competition.md`](./iolai-competition.md).
- **Model**: Qwen2.5-14B-Instruct-AWQ on HF
  ([Papajams/ratiocine](https://huggingface.co/Papajams/ratiocine)).
- **Showcase**: `showcase/` — Next.js 3-scene WebGL demo of the build, deployed
  to **Vercel** as `ratiocine.vercel.app`.

## Ration — Neutron app (hackathon)

Ration turns AI answers into provable claims: an AI produces → the canister
grades (EM + chrF) → chain-key-signs a SHA-256 assertion → appends to a stable
ledger → publishes an immutable certified report anyone can verify. The canister
is the **verifier, not the compute**. Full plan: [`docs/neutron-plan.md`](./neutron-plan.md).

```
Canister (ICP) ──https_outcalls──► Netlify /api (ratiocine.trustfall.xyz) ──► Modal (GPU)
   ├─ grade EM+chrF in-canister         ├─ /       → public/index.html
   ├─ chain-key sign                    ├─ /api/solve  (POST proxy → Modal)
   ├─ stable ledger (v2)                └─ /api/status (GET proxy → Modal)
   └─ publish_report (certified asset)
```

## The three public surfaces

| Surface | Host | Role |
|---|---|---|
| `ratiocine.vercel.app` | Vercel | IOL-AI 3-scene build story (no canister) |
| `ratiocine.trustfall.xyz` | Netlify | Ration landing + `/api/solve` + `/api/status` proxy |
| Could be ICP | your canister | the app itself (grade/sign/ledger) |

## Building / running (Ration)

```bash
# sync source → neutron clone, build package, deploy to local PocketIC
./scripts/sync-ration-app.sh
cd neutron
npm --workspace neutron-ratiocine run package       # build + package
npm run provision -- ration-local.ndeploy.json serve     # terminal 1
npm run provision -- ration-local.ndeploy.json reinstall # terminal 2
```

Verified on local PocketIC: chain-key signing, `attest_entry` grades to
EM=1.0/chrF=1.0/score 1.0 with a 64-byte sig, `publish_report` serves an
immutable certified report over HTTP, and in-place upgrades preserve the ledger.

> `ration-app/` is the canonical source; `neutron/` is a gitignored local clone
> of `github.com/infu/neutron`. Motoko is a **patched** build — see
> `ration-app/README.md` for the non-obvious syntax (e.g. `:=` for reassignment,
> `Array.concat` for vec append, no `.vals()`).
