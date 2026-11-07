#!/bin/bash
# Trial sweep for the micro1 eval hackathon.
# Usage: bash eval-hackathon/run_sweep.sh <provider> <model> [model...]
# Runs each model across canonical / obfuscated / shuffled conditions,
# 3 trials on the first two arms and 1 on shuffle (consistency probe).
set -u
cd "$(dirname "$0")/.."

PROVIDER="$1"; shift
OBF="eval-hackathon/data/puzzles_obf_1.json"

for MODEL in "$@"; do
  for TRIAL in 1 2 3; do
    echo "=== $MODEL canonical trial $TRIAL ==="
    python3 eval-hackathon/run_eval.py --model "$MODEL" --provider "$PROVIDER" \
      --trial "$TRIAL" --max-tokens 4096
  done
  for TRIAL in 1 2 3; do
    echo "=== $MODEL obfuscated trial $TRIAL ==="
    python3 eval-hackathon/run_eval.py --model "$MODEL" --provider "$PROVIDER" \
      --puzzles-file "$OBF" --trial "$TRIAL" --max-tokens 4096
  done
  echo "=== $MODEL shuffled trial 1 ==="
  python3 eval-hackathon/run_eval.py --model "$MODEL" --provider "$PROVIDER" \
    --shuffle-seed 1 --trial 1 --max-tokens 4096
done
echo "SWEEP DONE ($PROVIDER)"
