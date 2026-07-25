"""
Modal evaluation script — test the fine-tuned model against the Linguini benchmark.

This downloads the model from HuggingFace, loads it with 4-bit quantization
(simulating the competition T4 environment), and scores it against the 160
Linguini problems.

Usage:
    modal run hf-pipeline/eval_modal.py
    modal run hf-pipeline/eval_modal.py --limit 20
    modal run hf-pipeline/eval_modal.py --task-type match_letters
"""

import modal

PROJECT_ROOT = "/Users/udingethe/Dev/ratiocine"

image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.4.0-devel-ubuntu22.04",
        add_python="3.11",
    )
    .pip_install(
        "torch>=2.4.0",
        "transformers>=4.46.0",
        "datasets>=3.1.0",
        "accelerate>=1.1.0",
        "peft>=0.14.0",
        "bitsandbytes>=0.45.0",
        "trl>=0.12.0",
        "sentencepiece>=0.2.0",
        "huggingface_hub>=0.26.0",
    )
    .add_local_dir(
        f"{PROJECT_ROOT}/hf-pipeline",
        "/root/hf-pipeline",
    )
    .add_local_dir(
        f"{PROJECT_ROOT}/data",
        "/root/data",
    )
)

app = modal.App("ratiocine-eval")


@app.function(
    image=image,
    gpu="L4",
    timeout=1800,
    secrets=[modal.Secret.from_name("huggingface")],
)
def evaluate(
    model_id: str = "Papajams/ratiocine",
    limit: int = 0,
    task_type: str = "",
    max_new_tokens: int = 512,
):
    """Evaluate the fine-tuned model against the Linguini benchmark."""
    import ast
    import os
    import sys
    import time

    sys.path.insert(0, "/root/hf-pipeline/submission")

    import torch
    from datasets import load_dataset
    from prompts import (
        USER_TEMPLATE,
        count_query_items,
        get_system_prompt,
        parse_answers,
    )
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

    hf_token = os.environ.get("HF_TOKEN", "")

    # --- Scoring functions (from test_local.py) ---

    def normalize(s):
        return s.strip().lower().rstrip(".!?").strip()

    def chrf(pred, ref):
        pred = pred.lower()
        ref = ref.lower()
        if not pred or not ref:
            return 0.0
        beta = 2.0
        precisions = []
        recalls = []
        for n in range(1, 5):
            pred_ngrams = {}
            ref_ngrams = {}
            for i in range(len(pred) - n + 1):
                g = pred[i : i + n]
                pred_ngrams[g] = pred_ngrams.get(g, 0) + 1
            for i in range(len(ref) - n + 1):
                g = ref[i : i + n]
                ref_ngrams[g] = ref_ngrams.get(g, 0) + 1
            if not pred_ngrams or not ref_ngrams:
                precisions.append(0.0)
                recalls.append(0.0)
                continue
            overlap = 0
            for g, c in pred_ngrams.items():
                overlap += min(c, ref_ngrams.get(g, 0))
            precisions.append(overlap / sum(pred_ngrams.values()))
            recalls.append(overlap / sum(ref_ngrams.values()))
        avg_p = sum(precisions) / len(precisions) if precisions else 0.0
        avg_r = sum(recalls) / len(recalls) if recalls else 0.0
        if avg_p + avg_r == 0:
            return 0.0
        return (1 + beta**2) * (avg_p * avg_r) / (beta**2 * avg_p + avg_r)

    def exact_match(pred, refs):
        n_pred = normalize(pred)
        return any(n_pred == normalize(r) for r in refs)

    # --- Load model ---

    print(f"[eval] Loading model: {model_id}", flush=True)
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
    )

    tokenizer = AutoTokenizer.from_pretrained(model_id, token=hf_token)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        model_id,
        quantization_config=bnb_config,
        device_map="auto",
        torch_dtype=torch.bfloat16,
        token=hf_token,
    )
    model.eval()
    print(
        f"[eval] Model loaded. Memory: {torch.cuda.memory_allocated() / 1e9:.1f} GB",
        flush=True,
    )

    # --- Load Linguini dataset ---

    print("[eval] Loading Linguini dataset...", flush=True)
    ds = load_dataset("facebook/linguini", split="test")
    problems = list(ds)

    if task_type:
        problems = [p for p in problems if p["task_type"] == task_type]
    if limit:
        problems = problems[:limit]

    print(f"[eval] Testing {len(problems)} problems", flush=True)
    print()

    all_em = []
    all_chrf = []
    by_type = {}

    for i, problem in enumerate(problems):
        pid = problem["id"]
        context = problem["context"]
        query = problem["query"]
        tt = problem["task_type"]
        gold = problem["answer"]
        if isinstance(gold, str):
            gold = ast.literal_eval(gold)

        system_prompt = get_system_prompt(tt)
        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": USER_TEMPLATE.format(
                    context=context.strip(), query=query.strip()
                ),
            },
        ]

        try:
            t0 = time.time()
            input_ids = tokenizer.apply_chat_template(
                messages, add_generation_prompt=True, return_tensors="pt"
            )
            # Ensure we get a raw tensor, not BatchEncoding
            if hasattr(input_ids, "input_ids"):
                input_ids = input_ids.input_ids
            input_ids = input_ids.to(model.device)

            with torch.no_grad():
                out = model.generate(
                    input_ids,
                    max_new_tokens=max_new_tokens,
                    do_sample=False,
                    pad_token_id=tokenizer.eos_token_id,
                )

            text = tokenizer.decode(
                out[0][input_ids.shape[-1] :], skip_special_tokens=True
            ).strip()
            elapsed = time.time() - t0

            n_expected = count_query_items(query)
            if not n_expected:
                n_expected = len(gold) if isinstance(gold, list) else 1

            pred_answers = parse_answers(text, n_expected=n_expected, task_type=tt)

            # Score
            em_scores = []
            chrf_scores = []
            for j, pred in enumerate(pred_answers):
                if j < len(gold):
                    ref = gold[j]
                    refs = ref if isinstance(ref, list) else [ref]
                    em_scores.append(float(exact_match(pred, refs)))
                    chrf_scores.append(max(chrf(pred, r) for r in refs))

            all_em.extend(em_scores)
            all_chrf.extend(chrf_scores)

            if tt not in by_type:
                by_type[tt] = {"em": [], "chrf": []}
            by_type[tt]["em"].extend(em_scores)
            by_type[tt]["chrf"].extend(chrf_scores)

            em_pct = sum(em_scores) / len(em_scores) * 100 if em_scores else 0
            avg_chrf = sum(chrf_scores) / len(chrf_scores) * 100 if chrf_scores else 0
            status = "OK" if any(em_scores) else "chrf"

            print(
                f"  [{i + 1}/{len(problems)}] {pid} {tt:15s} "
                f"EM={em_pct:5.1f}% chrF={avg_chrf:5.1f}% "
                f"({len(pred_answers)} ans, {elapsed:.1f}s) [{status}]",
                flush=True,
            )

        except Exception as e:
            import traceback

            print(f"  [{i + 1}/{len(problems)}] {pid} ERROR: {e}", flush=True)
            traceback.print_exc()
            all_em.append(0.0)
            all_chrf.append(0.0)

    # Summary
    print()
    print("=" * 60)
    print("OVERALL SCORE")
    print("=" * 60)
    mean_em = sum(all_em) / len(all_em) if all_em else 0
    mean_chrf = sum(all_chrf) / len(all_chrf) if all_chrf else 0
    score = (mean_em * mean_chrf) ** 0.5 if (mean_em + mean_chrf) > 0 else 0
    print(f"  Exact match:  {mean_em:.4f} ({sum(all_em)}/{len(all_em)} items)")
    print(f"  chrF:         {mean_chrf:.4f}")
    print(f"  Score (geo):  {score:.4f}")
    print()

    print("BY TASK TYPE")
    print("-" * 60)
    print(f"  {'Type':20s} {'EM':>8s} {'chrF':>8s} {'Score':>8s} {'Items':>6s}")
    print("-" * 60)
    for ttype, scores in sorted(by_type.items()):
        em = sum(scores["em"]) / len(scores["em"]) if scores["em"] else 0
        ch = sum(scores["chrf"]) / len(scores["chrf"]) if scores["chrf"] else 0
        sc = (em * ch) ** 0.5 if (em + ch) > 0 else 0
        print(f"  {ttype:20s} {em:8.4f} {ch:8.4f} {sc:8.4f} {len(scores['em']):6d}")


@app.local_entrypoint()
def main(
    model_id: str = "Papajams/ratiocine",
    limit: int = 0,
    task_type: str = "",
    max_new_tokens: int = 512,
):
    """Run evaluation on Modal.

    Args:
        model_id: HF model repo to evaluate.
        limit: Max problems to test (0 = all 160).
        task_type: Filter by task type.
        max_new_tokens: Max generation tokens per problem.
    """
    evaluate.remote(
        model_id=model_id,
        limit=limit,
        task_type=task_type,
        max_new_tokens=max_new_tokens,
    )
