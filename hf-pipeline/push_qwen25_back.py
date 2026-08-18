#!/usr/bin/env python3
"""Push Qwen2.5-14B-Instruct-AWQ back to the HF repo (Qwen3 was too slow)."""

import os

from dotenv import load_dotenv
from huggingface_hub import HfApi, snapshot_download

load_dotenv()
api = HfApi(token=os.environ["HF_TOKEN"])

# Delete Qwen3 files first
print("Removing Qwen3 files...")
qwen3_files = [
    "model-00001-of-00002.safetensors",
    "model-00002-of-00002.safetensors",
]
for f in qwen3_files:
    try:
        api.delete_file(f, "Papajams/ratiocine", repo_type="model")
        print(f"  Deleted: {f}")
    except Exception as e:
        print(f"  Error deleting {f}: {e}")

# Download Qwen2.5-14B-Instruct-AWQ
print("Downloading Qwen2.5-14B-Instruct-AWQ...")
local_dir = os.path.expanduser("~/qwen25-14b-awq")
snapshot_download(
    repo_id="Qwen/Qwen2.5-14B-Instruct-AWQ",
    local_dir=local_dir,
    token=os.environ["HF_TOKEN"],
)
print(f"Downloaded to {local_dir}")

for item in sorted(os.listdir(local_dir)):
    full = os.path.join(local_dir, item)
    if os.path.isfile(full):
        size_mb = os.path.getsize(full) / 1e6
        print(f"  {item}: {size_mb:.1f} MB")

# Upload model weights
print("Uploading model weights to Papajams/ratiocine...")
api.upload_folder(
    folder_path=local_dir,
    repo_id="Papajams/ratiocine",
    repo_type="model",
    token=os.environ["HF_TOKEN"],
)
print("Model weights uploaded!")

# Upload the simple (direct prompt) scripts
print("Uploading script.py and prompts.py...")
api.upload_file(
    path_or_fileobj="hf-pipeline/submission/script_fast.py",
    path_in_repo="script.py",
    repo_id="Papajams/ratiocine",
    repo_type="model",
    token=os.environ["HF_TOKEN"],
)
api.upload_file(
    path_or_fileobj="hf-pipeline/submission/prompts_simple.py",
    path_in_repo="prompts.py",
    repo_id="Papajams/ratiocine",
    repo_type="model",
    token=os.environ["HF_TOKEN"],
)
print("Scripts uploaded!")
print("Repo: https://huggingface.co/Papajams/ratiocine")
