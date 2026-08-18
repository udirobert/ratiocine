"""
Save the merged CoT model as bitsandbytes-compatible and create a script.py
that loads it with bitsandbytes 4-bit quantization (pre-installed on T4).

This avoids the AWQ quantization step. The competition sandbox has
bitsandbytes pre-installed, so we just need to save the merged model
and have script.py use bitsandbytes to load it.
"""

import json
import os

import torch
from dotenv import load_dotenv
from huggingface_hub import HfApi, snapshot_download
from transformers import AutoModelForCausalLM, AutoTokenizer

load_dotenv()
api = HfApi(token=os.environ["HF_TOKEN"])

# Download the merged model
print("Downloading merged CoT model from Papajams/ratiocine...")
local_dir = os.path.expanduser("~/ratiocine-cot-merged")
snapshot_download(
    repo_id="Papajams/ratiocine",
    local_dir=local_dir,
    token=os.environ["HF_TOKEN"],
)
print(f"Downloaded to {local_dir}")

# Just verify it loads (don't quantize - just confirm it's there)
print("Loading merged model to verify...")
model = AutoModelForCausalLM.from_pretrained(
    local_dir,
    torch_dtype=torch.bfloat16,
    device_map="cpu",
    low_cpu_mem_usage=True,
)
tokenizer = AutoTokenizer.from_pretrained(local_dir)

print(f"Model loaded: {model.config.model_type}")
print(f"Vocab size: {model.config.vocab_size}")
print(f"Hidden size: {model.config.hidden_size}")

# Check size
total_size = sum(p.numel() * p.element_size() for p in model.parameters())
print(f"Model size: {total_size / 1e9:.1f} GB (bf16)")

# Save a config that signals to script.py to use bitsandbytes
config = model.config.to_dict()
config["quantization_config"] = {
    "method": "bitsandbytes",
    "bits": 4,
    "note": "Use bitsandbytes 4-bit (NF4) to load this model on T4 16GB",
}

with open(os.path.join(local_dir, "config.json"), "w") as f:
    json.dump(config, f, indent=2)

print("Config updated for bitsandbytes loading")
print()
print("IMPORTANT: The merged model is 28GB bf16. To use it on T4 16GB,")
print("script.py must load it with bitsandbytes 4-bit quantization.")
print("The sandbox has bitsandbytes pre-installed.")
print()
print("See: hf-pipeline/submission/script_bitsandbytes.py for the loader")
