#!/bin/bash
# usage: eval-gen.sh <checkpoint_dir> <label> <gpu_idx> <port>
DIR=$1; LABEL=$2; GPU=$3; PORT=$4
cd ~/delta/qwen35-workspace
NAME=vllm-srv-$LABEL
docker kill $NAME 2>/dev/null; docker rm $NAME 2>/dev/null
CH=$(sha256sum $DIR/model.safetensors | cut -c1-64)
nohup docker run --name $NAME --rm --gpus "device=$GPU" -p $PORT:8000 \
  -v $DIR:/model:ro \
  --entrypoint python3 \
  vllm/vllm-openai@sha256:befccf0e7e4089aa23926bb6f887a85c0d46c2a99e6de5c5ffdf5cb7957c5b34 \
  -m vllm.entrypoints.openai.api_server --model /model --served-model-name candidate \
  --host 0.0.0.0 --port 8000 --language-model-only --dtype bfloat16 \
  --max-model-len 34816 --gpu-memory-utilization 0.85 --max-num-seqs 32 \
  --no-enable-log-requests > ~/delta/vllm-$LABEL.log 2>&1 &
for i in $(seq 1 120); do
  sleep 10
  curl -s http://127.0.0.1:$PORT/v1/models 2>/dev/null | grep -q candidate && break
done
curl -s http://127.0.0.1:$PORT/v1/models | grep -q candidate || { echo "$LABEL: SERVER FAILED"; tail -5 ~/delta/vllm-$LABEL.log; exit 1; }
echo "$LABEL: server up"
# mmlu full + gsm8k 0-8
for spec in "mmlu FULL" "gsm8k 0-8"; do
  b=${spec%% *}; rng=${spec##* }
  ~/delta-eval/bin/delta public-eval benchmark-config --benchmark $b --generation gen.json > proto-gen-$LABEL-$b.json 2>/dev/null || { echo "$b PROTOCOL FAIL"; continue; }
  n=$(python3 -c "import json;print(json.load(open(\"proto-gen-$LABEL-$b.json\"))[\"expected_items\"])")
  if [ "$rng" = "FULL" ]; then s=0; e=$n; else s=${rng%-*}; e=${rng#*-}; fi
  ~/delta-eval/bin/delta public-eval benchmark --protocol proto-gen-$LABEL-$b.json --endpoint http://127.0.0.1:$PORT/v1 --tokenizer model --content-hash $CH --start $s --end $e --output benchgen-$LABEL-$b > run-gen-$LABEL-$b.log 2>&1
done
echo "=== GENRESULTS $LABEL ==="
for f in $(ls -t benchgen-$LABEL-*/result.json 2>/dev/null); do python3 -c "import json; r=json.load(open(\"$f\")); print(\"$f\", json.dumps(r)[:300])"; done
echo "=== DONE $LABEL ==="
