"""
Modal script to download Qwen2.5-14B-AWQ from HuggingFace and push it to
our competition HF repo (Papajams/ratiocine) along with script.py and prompts.py.

This replaces the fine-tuned 7B weights with the stronger 14B-AWQ baseline.

Usage:
    modal run hf-pipeline/push_14b_awq.py

The 14B-AWQ model is ~8.5GB (4-bit quantized). It fits on T4 16GB.
"""

import modal

PROJECT_ROOT = "/Users/udingethe/Dev/ratiocine"

image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.4.0-devel-ubuntu22.04",
        add_python="3.11",
    )
    .pip_install(
        "huggingface_hub>=0.26.0",
        "transformers>=4.46.0",
        "autoawq>=0.2.0",
    )
    .add_local_dir(
        f"{PROJECT_ROOT}/hf-pipeline/submission",
        "/root/submission",
    )
)

app = modal.App("ratiocine-push-14b")

vol = modal.Volume.from_name("ratiocine-models", create_if_missing=True)


@app.function(
    image=image,
    volumes={"/root/models": vol},
    timeout=1800,
    secrets=[modal.Secret.from_name("huggingface")],
)
def push_model(
    source_model: str = "Qwen/Qwen3-14B-AWQ",
    hf_repo_id: str = "Papajams/ratiocine",
):
    """Download Qwen2.5-14B-AWQ and push to our HF repo with submission scripts."""
    import os

    from huggingface_hub import HfApi, login, snapshot_download

    hf_token = os.environ.get("HF_TOKEN", "")
    login(token=hf_token)
    print("[push] Authenticated with Hugging Face")

    # Download the 14B-AWQ model to the volume
    print(f"[push] Downloading {source_model}...")
    local_dir = "/root/models/qwen-14b-awq"
    snapshot_download(
        repo_id=source_model,
        local_dir=local_dir,
        token=hf_token,
    )
    print(f"[push] Downloaded to {local_dir}")

    # List what we got
    for item in os.listdir(local_dir):
        full = os.path.join(local_dir, item)
        size = os.path.getsize(full) if os.path.isfile(full) else "<dir>"
        print(f"  {item}: {size}")

    # Upload everything to the HF repo
    print(f"\n[push] Uploading to HF repo: {hf_repo_id}")
    api = HfApi()

    # Upload model weights
    api.upload_folder(
        folder_path=local_dir,
        repo_id=hf_repo_id,
        repo_type="model",
        token=hf_token,
    )
    print("[push] Model weights uploaded")

    # Upload script.py and prompts.py
    api.upload_file(
        path_or_fileobj="/root/submission/script.py",
        path_in_repo="script.py",
        repo_id=hf_repo_id,
        repo_type="model",
        token=hf_token,
    )
    api.upload_file(
        path_or_fileobj="/root/submission/prompts.py",
        path_in_repo="prompts.py",
        repo_id=hf_repo_id,
        repo_type="model",
        token=hf_token,
    )
    print("[push] script.py and prompts.py uploaded")

    print(f"\n[push] Done! Repo: https://huggingface.co/{hf_repo_id}")
    print("[push] Next: submit this repo ID to the competition Space")


@app.local_entrypoint()
def main(
    source_model: str = "Qwen/Qwen3-14B-AWQ",
    hf_repo_id: str = "Papajams/ratiocine",
):
    push_model.remote(
        source_model=source_model,
        hf_repo_id=hf_repo_id,
    )
