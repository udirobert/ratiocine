"""
Try AWQ quantization on T4 with smart memory management.

Key: Use autoawq's `quantize` method which processes layers sequentially,
not all at once. This should fit on T4 22GB even for 14B model.
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

app = modal.App("ratiocine-awq-quant")

vol = modal.Volume.from_name("ratiocine-models", create_if_missing=True)


@app.function(
    image=image,
    gpu="T4",
    volumes={"/root/models": vol},
    timeout=3600,
    secrets=[modal.Secret.from_name("huggingface")],
)
def quantize_awq(
    source_hf_repo: str = "Papajams/ratiocine",
    source_local_dir: str = "/root/models/ratiocine-cot-merged",
):
    """AWQ quantize the merged model and push to HF."""
    import os

    from awq import AutoAWQForCausalLM
    from transformers import AutoTokenizer

    hf_token = os.environ.get("HF_TOKEN", "")

    # Use the merged model from the volume (saved by training job)
    model_path = source_local_dir

    if not os.path.exists(model_path):
        from huggingface_hub import snapshot_download

        print(f"[quant] Downloading merged model from {source_hf_repo}")
        snapshot_download(repo_id=source_hf_repo, local_dir=model_path, token=hf_token)

    print(f"[quant] Loading model from {model_path}")
    # Use balanced device_map for AWQ - splits across GPU and CPU
    model = AutoAWQForCausalLM.from_pretrained(
        model_path,
        safetensors=True,
        device_map="balanced",  # Spread across GPU + CPU to avoid OOM
    )
    tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)

    quant_config = {
        "zero_point": True,
        "q_group_size": 128,
        "w_bit": 4,
        "version": "GEMM",
    }

    print("[quant] Running AWQ quantization...")
    model.quantize(tokenizer, quant_config=quant_config)

    quant_path = "/root/models/ratiocine-cot-awq"
    print(f"[quant] Saving to {quant_path}")
    model.save_quantized(quant_path)
    tokenizer.save_pretrained(quant_path)
    vol.commit()

    # Upload to HF
    from huggingface_hub import HfApi

    api = HfApi(token=hf_token)

    print("[quant] Deleting old bf16 files from HF...")
    old_files = [f"model-{i:05d}-of-00006.safetensors" for i in range(1, 7)]
    old_files += ["added_tokens.json", "special_tokens_map.json"]
    for f in old_files:
        try:
            api.delete_file(f, source_hf_repo, repo_type="model")
            print(f"  Deleted: {f}")
        except Exception:
            pass

    print("[quant] Uploading AWQ model to HF...")
    api.upload_folder(
        folder_path=quant_path,
        repo_id=source_hf_repo,
        repo_type="model",
        token=hf_token,
    )
    print(f"[quant] Done! https://huggingface.co/{source_hf_repo}")


@app.local_entrypoint()
def main():
    quantize_awq.remote()
