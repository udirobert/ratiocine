#!/bin/bash
# Assemble the micro1 Eval Hackathon submission zip (code + stored raws).
# Preserves repo-relative paths because the runners resolve ROOT from
# __file__ (scripts/ -> repo root, eval-hackathon/ -> repo root).
set -euo pipefail
cd "$(dirname "$0")/.."

STAGE="$(mktemp -d)/ratiocine-eval"
ZIP="eval-hackathon-submission.zip"
rm -f "$ZIP"

mkdir -p "$STAGE"/{scripts,hf-pipeline/submission,data,eval-hackathon}

cp scripts/llm_providers.py scripts/run_models_for_ltb.py scripts/obfuscate_puzzles.py \
   scripts/gen_puzzles.py scripts/make_min_pairs.py "$STAGE/scripts/"
cp hf-pipeline/submission/prompts.py "$STAGE/hf-pipeline/submission/"
cp data/puzzles.json "$STAGE/data/"
cp -R eval-hackathon/. "$STAGE/eval-hackathon/"
find "$STAGE" -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null || true
find "$STAGE" -name "*.pyc" -delete
cp .env.example "$STAGE/"

cat > "$STAGE/README.md" <<'EOF'
# Morpheme Induction Eval — micro1 Eval Hackathon submission

See `eval-hackathon/README.md` for the full methodology and
`eval-hackathon/REPORT.md` for the eval report (limitation statement,
results, failure analysis, provenance).

Quick start:

```bash
python3 eval-hackathon/run_eval.py --model <model-id> --provider neon \
    --puzzles-file eval-hackathon/data/puzzles_obf_1.json --trial 1
python3 eval-hackathon/aggregate.py --markdown
python3 eval-hackathon/regrade.py   # re-grade stored raws, no API cost
```

Python 3.10+, standard library only. Provider keys via env vars — see
`.env.example`. Stored generations in `eval-hackathon/results/` let you
re-grade every reported number without any API access.
EOF

cd "$STAGE"
zip -qr "/Users/udingethe/Dev/ratiocine/$ZIP" .
cd - >/dev/null
echo "wrote $ZIP"
unzip -l "$ZIP" | tail -3
du -h "$ZIP"
