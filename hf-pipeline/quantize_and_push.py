"""
Modal script to quantize the merged CoT model to AWQ and push to HF.

The merged Qwen2.5-14B model is bf16 (~28GB) - won't fit on T4 16GB.
This script quantizes it to 4-bit AWQ (~8.5GB) which fits.

Usage:
    modal run hf-pipeline/quantize_and_push.py
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
    "autoawq==0.2.7.post1",
    "sentencepiece>=0.2.0",
    "huggingface_hub>=0.26.0",
)

app = modal.App("ratiocine-quantize")

vol = modal.Volume.from_name("ratiocine-models", create_if_missing=True)


@app.function(
    image=image,
    gpu="L4",  # L4 works for AWQ quantization, just slower than A100
    volumes={"/root/models": vol},
    timeout=3600,
    secrets=[modal.Secret.from_name("huggingface")],
)
def quantize_and_push(
    merged_model_dir: str = "/root/models/ratiocine-cot-merged",
    hf_repo_id: str = "Papajams/ratiocine",
):
    """Quantize merged model to AWQ and push to HF Hub."""
    import os

    import torch
    from awq import AutoAWQForCausalLM
    from huggingface_hub import HfApi, snapshot_download
    from transformers import AutoTokenizer

    hf_token = os.environ.get("HF_TOKEN", "")

    print(f"[quant] Loading merged model from {merged_model_dir}")
    if not os.path.exists(merged_model_dir):
        # Download from HF if not on volume
        print(f"[quant] Downloading merged model from {hf_repo_id}")
        snapshot_download(
            repo_id=hf_repo_id,
            local_dir=merged_model_dir,
            token=hf_token,
        )

    # List files
    for f in sorted(os.listdir(merged_model_dir)):
        full = os.path.join(merged_model_dir, f)
        if os.path.isfile(full):
            size_mb = os.path.getsize(full) / 1e6
            print(f"  {f}: {size_mb:.1f} MB")

    # Load model for AWQ quantization
    model_path = merged_model_dir
    quant_path = "/root/models/ratiocine-cot-awq"

    print("[quant] Loading model with AutoAWQ for AWQ quantization...")
    # AWQ quantization needs to load the full bf16 model (~28GB)
    # Use CPU first to avoid OOM, then quantize layer-by-layer
    from transformers import AutoModelForCausalLM

    print("[quant] Loading bf16 model on CPU...")
    model = AutoModelForCausalLM.from_pretrained(
        model_path,
        torch_dtype=torch.bfloat16,
        device_map="cpu",
        low_cpu_mem_usage=True,
        trust_remote_code=True,
    )
    tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)

    # Use AWQ's quantize method
    awq_model = AutoAWQForCausalLM.from_pretrained(
        model_path,
        safetensors=True,
        device_map="cpu",
        low_cpu_mem_usage=True,
    )
    awq_model.model = model  # Replace internal model

    quant_config = {
        "zero_point": True,
        "q_group_size": 128,
        "w_bit": 4,
        "version": "GEMM",
    }

    print("[quant] Running AWQ quantization on CPU (slow but avoids OOM)...")
    awq_model.quantize(tokenizer, quant_config=quant_config)

    print(f"[quant] Saving quantized model to {quant_path}")
    model.save_quantized(quant_path)
    tokenizer.save_pretrained(quant_path)

    vol.commit()
    print("[quant] Saved to volume")

    # List files
    for f in sorted(os.listdir(quant_path)):
        full = os.path.join(quant_path, f)
        if os.path.isfile(full):
            size_mb = os.path.getsize(full) / 1e6
            print(f"  {f}: {size_mb:.1f} MB")

    # Upload to HF
    print(f"[quant] Uploading AWQ model to {hf_repo_id}")
    api = HfApi(token=hf_token)

    # Delete old non-quantized model files (6 shards)
    old_files = [f"model-{i:05d}-of-00006.safetensors" for i in range(1, 7)] + [
        "model.safetensors.index.json",
    ]
    for f in old_files:
        try:
            api.delete_file(f, hf_repo_id, repo_type="model")
            print(f"  Deleted old: {f}")
        except Exception as e:
            print(f"  Error deleting {f}: {e}")

    # Upload new AWQ files
    api.upload_folder(
        folder_path=quant_path,
        repo_id=hf_repo_id,
        repo_type="model",
        token=hf_token,
    )

    # Re-upload scripts
    api.upload_file(
        path_or_fileobj=f"{PROJECT_ROOT}/hf-pipeline/submission/script_fast.py",
        path_in_repo="script.py",
        repo_id=hf_repo_id,
        repo_type="model",
        token=hf_token,
    )
    api.upload_file(
        path_or_fileobj=f"{PROJECT_ROOT}/hf-pipeline/submission/prompts_simple.py",
        path_in_repo="prompts.py",
        repo_id=hf_repo_id,
        repo_type="model",
        token=hf_token,
    )

    print(f"[quant] Done! https://huggingface.co/{hf_repo_id}")


@app.local_entrypoint()
def main():
    quantize_and_push.remote()
