"""GPTQ quantization of fine-tuned Qwen2.5-14B for T4 deployment.

GPTQ is faster than AWQ and uses less memory during quantization.
A100-40GB is enough for 14B bf16 → 4-bit GPTQ (model is 28GB, with
quantization overhead ~35GB peak, fits on A100-40GB).

Usage:
    modal run hf-pipeline/gptq_quantize.py
"""

import modal

PROJECT_ROOT = "/Users/udingethe/Dev/ratiocine"

image = modal.Image.from_registry(
    "nvidia/cuda:12.4.0-devel-ubuntu22.04",
    add_python="3.11",
).pip_install(
    "torch>=2.4.0",
    "transformers==4.46.3",
    "accelerate>=1.1.0",
    "datasets>=3.1.0",
    "huggingface_hub>=0.26.0",
    "sentencepiece>=0.2.0",
    # GPTQ-specific
    "auto-gptq==0.7.1",
    "optimum>=1.20.0",
    "gptqmodel>=2.0.0",
)

app = modal.App("ratiocine-gptq")

vol = modal.Volume.from_name("ratiocine-models", create_if_missing=True)


@app.function(
    image=image,
    gpu="A100-40GB",  # Need 40GB+ for bf16 14B (28GB) + overhead
    volumes={"/root/models": vol},
    timeout=3600 * 2,  # 2 hours max
    secrets=[modal.Secret.from_name("huggingface")],
)
def gptq_quantize(
    base_model: str = "Qwen/Qwen2.5-14B-Instruct",
    quantized_output_dir: str = "/root/models/qwen2.5-14b-gptq-4bit",
    bits: int = 4,
    group_size: int = 128,
    desc_act: bool = True,
    hf_repo_id: str = "Papajams/ratiocine-gptq",
):
    """GPTQ quantize Qwen2.5-14B-Instruct to 4-bit for T4 deployment."""
    import os

    import torch
    from auto_gptq import AutoGPTQForCausalLM, BaseQuantizeConfig
    from transformers import AutoTokenizer

    print(f"[gptq] Base model: {base_model}")
    print(f"[gptq] Output: {quantized_output_dir}")
    print(f"[gptq] Bits: {bits}, group_size: {group_size}, desc_act: {desc_act}")

    # --- Quantization config ---
    quantize_config = BaseQuantizeConfig(
        bits=bits,
        group_size=group_size,
        desc_act=desc_act,
        sym=True,
    )

    # --- Load tokenizer ---
    print("[gptq] Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    # --- Quantize ---
    print("[gptq] Loading model for GPTQ (this may take a few minutes)...")
    model = AutoGPTQForCausalLM.from_pretrained(
        base_model,
        quantize_config=quantize_config,
        trust_remote_code=True,
        low_cpu_mem_usage=True,
        device_map="auto",
        torch_dtype=torch.float16,
    )

    # Use a small calibration set (Linguini samples are perfect)
    print("[gptq] Preparing calibration data from Linguini...")
    import json

    # Load Linguini examples for calibration
    calib_examples = []
    try:
        with open("/root/data/synthetic/iol_train.jsonl") as f:
            for i, line in enumerate(f):
                if i >= 128:  # 128 samples is enough for calibration
                    break
                item = json.loads(line)
                # Extract just the assistant response for calibration
                if "messages" in item:
                    msgs = item["messages"]
                    for m in msgs:
                        if m["role"] == "assistant":
                            calib_examples.append(m["content"])
                            break
    except FileNotFoundError:
        print("[gptq] No calibration data found, using empty calibration")
        calib_examples = ["The quick brown fox jumps over the lazy dog."] * 32

    print(f"[gptq] Calibrating with {len(calib_examples)} examples...")
    model.quantize(calib_examples, batch_size=1, use_triton=False)

    # --- Save ---
    print(f"[gptq] Saving quantized model to {quantized_output_dir}")
    os.makedirs(quantized_output_dir, exist_ok=True)
    model.save_pretrained(quantized_output_dir)
    tokenizer.save_pretrained(quantized_output_dir)

    # --- Push to HF ---
    hf_token = os.environ.get("HF_TOKEN", "")
    if hf_token and hf_repo_id:
        print(f"[gptq] Pushing to {hf_repo_id}...")
        from huggingface_hub import HfApi, create_repo

        create_repo(
            hf_repo_id, repo_type="model", private=False, exist_ok=True, token=hf_token
        )
        model.push_to_hub(hf_repo_id, token=hf_token)
        tokenizer.push_to_hub(hf_repo_id, token=hf_token)

        # Also push our submission scripts
        api = HfApi(token=hf_token)
        api.upload_file(
            path_or_fileobj="/root/hf-pipeline/submission/script.py",
            path_in_repo="script.py",
            repo_id=hf_repo_id,
            repo_type="model",
            token=hf_token,
        )
        api.upload_file(
            path_or_fileobj="/root/hf-pipeline/submission/prompts.py",
            path_in_repo="prompts.py",
            repo_id=hf_repo_id,
            repo_type="model",
            token=hf_token,
        )
        print(f"[gptq] Pushed to {hf_repo_id}")

    print("[gptq] Done!")


@app.local_entrypoint()
def main(
    base_model: str = "Qwen/Qwen2.5-14B-Instruct",
    hf_repo_id: str = "Papajams/ratiocine-gptq",
):
    """Run GPTQ quantization on Modal A100."""
    gptq_quantize.remote(
        base_model=base_model,
        hf_repo_id=hf_repo_id,
    )
