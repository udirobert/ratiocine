# ratiocine

**Logical reasoning from linguistic fragments. Rat-i-o-cine: the process of reasoning.**

An AI that solves International Linguistics Olympiad (IOL) problems — deducing
grammar, vocabulary, and structure from a handful of examples in unfamiliar
languages. It ships two things:

1. **A competition solver and playable showcase** — IOL-AI 2026 entry
   (Qwen2.5-14B, best public score 0.1141) plus the Apurinã practice puzzle at
   [`ratiocine.vercel.app`](https://ratiocine.vercel.app).
2. **A verifiable evaluation logbook** — a Neutron app that, when installed in
   a user's canister, deterministically grades submitted AI outputs,
   chain-key-signs evaluation assertions, and can publish a certified report.
   The public Ration landing and unsigned solve preview are at
   [`ratiocine.trustfall.xyz`](https://ratiocine.trustfall.xyz).

## Quick links

- **Architecture & deployments** → [`docs/architecture.md`](docs/architecture.md)
- **IOL-AI competition** (pipeline, results, lessons) → [`docs/iolai-competition.md`](docs/iolai-competition.md)
- **Neutron / Ration hackathon plan** → [`docs/neutron-plan.md`](docs/neutron-plan.md)

## Layout

```
├── hf-pipeline/      # HF production pipeline (train + submit script.py)
├── src/arkor/         # Arkor rapid prototyping (TypeScript)
├── ration-app/        # Neutron app source (Motoko backend + React tile)  ← canonical
├── neutron/           # local clone of infu/neutron (gitignored) — for building
├── showcase/          # Next.js 3-scene build-story (Vercel)
├── data/synthetic/    # IOL training data
├── netlify/functions/ # /api/solve + /api/status proxy → Modal
└── docs/              # this readme's detail lives here
```

## Quick start

```bash
# Showcase (Vercel): 3D build-story site
cd showcase && npm install && npm run dev   # → http://localhost:3000

# Neutron app: sync → build → local PocketIC
./scripts/sync-ration-app.sh
cd neutron && npm --workspace neutron-ratiocine run package
```
