#!/usr/bin/env python3
"""Push Qwen3-14B-AWQ to the HF repo."""

import os

from dotenv import load_dotenv
from huggingface_hub import HfApi, snapshot_download

load_dotenv()
api = HfApi(token=os.environ["HF_TOKEN"])

# Upload updated script.py and prompts.py
api.upload_file(
    path_or_fileobj="hf-pipeline/submission/script.py",
    path_in_repo="script.py",
    repo_id="Papajams/ratiocine",
    repo_type="model",
)
api.upload_file(
    path_or_fileobj="hf-pipeline/submission/prompts.py",
    path_in_repo="prompts.py",
    repo_id="Papajams/ratiocine",
    repo_type="model",
)
print("Uploaded updated script.py and prompts.py for Qwen3")

# Download Qwen3-14B-AWQ
print("Downloading Qwen3-14B-AWQ...")
local_dir = os.path.expanduser("~/qwen3-14b-awq")
snapshot_download(
    repo_id="Qwen/Qwen3-14B-AWQ",
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
print("Repo: https://huggingface.co/Papajams/ratiocine")
