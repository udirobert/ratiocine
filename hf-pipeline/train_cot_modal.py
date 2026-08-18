"""
Modal training script for fine-tuning Qwen3-14B on IOL problems with CoT data.

Trains on the 160 CoT-augmented examples (GPT-5 generated reasoning + answers).
The model learns to reason about IOL problems using the <analysis>/<answers> format.

Usage:
    modal run hf-pipeline/train_cot_modal.py

This runs on Modal's serverless GPUs. The fine-tuned model is saved to
a Modal Volume, merged, and pushed to Hugging Face Hub.

Cost estimate (A100 80GB at $2.50/hr):
    - Model loading + tokenization: ~3 min
    - Training (160 examples, 3 epochs, LoRA): ~20-30 min
    - Saving + merge + push: ~10 min
    - Total: ~40 min = ~$1.67
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
        "transformers==4.46.3",
        "datasets>=3.1.0",
        "accelerate>=1.1.0",
        "peft>=0.14.0",
        "bitsandbytes>=0.45.0",
        "trl>=0.12.0",
        "autoawq==0.2.7.post1",
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

app = modal.App("ratiocine-train-cot")

vol = modal.Volume.from_name("ratiocine-models", create_if_missing=True)


@app.function(
    image=image,
    gpu="L4",
    volumes={"/root/models": vol},
    timeout=3600,
    secrets=[modal.Secret.from_name("huggingface")],
)
def train(
    model_name: str = "Qwen/Qwen2.5-14B-Instruct",
    dataset_path: str = "/root/data/synthetic/iol_cot_train.jsonl",
    output_dir: str = "/root/models/ratiocine-cot",
    hf_repo_id: str = "Papajams/ratiocine",
    num_epochs: int = 3,
    lora_r: int = 32,
    lora_alpha: int = 64,
    learning_rate: float = 1e-4,
    max_seq_length: int = 2048,
):
    """Fine-tune Qwen3-14B on IOL CoT data with LoRA + 4-bit quantization."""
    import os
    import sys

    sys.path.insert(0, "/root/hf-pipeline/submission")

    import torch
    from datasets import Dataset
    from peft import LoraConfig
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        BitsAndBytesConfig,
    )
    from trl import SFTConfig, SFTTrainer

    hf_token = os.environ.get("HF_TOKEN", "")
    if hf_token:
        from huggingface_hub import login

        login(token=hf_token)
        print("[train] Authenticated with Hugging Face")

    print(f"[train] Model: {model_name}")
    print(f"[train] Dataset: {dataset_path}")
    print(f"[train] Output: {output_dir}")
    print(f"[train] Epochs: {num_epochs}, LoRA r={lora_r}, lr={learning_rate}")

    # --- Load dataset ---
    import json

    examples = []
    with open(dataset_path) as f:
        for line in f:
            item = json.loads(line)
            # Only keep messages, drop metadata
            examples.append({"messages": item["messages"]})

    print(f"[train] Loaded {len(examples)} training examples")

    # Check data quality
    has_analysis = sum(
        1 for e in examples if "<analysis>" in e["messages"][-1]["content"]
    )
    has_answers = sum(
        1 for e in examples if "<answers>" in e["messages"][-1]["content"]
    )
    print(f"[train] Examples with <analysis>: {has_analysis}")
    print(f"[train] Examples with <answers>: {has_answers}")

    dataset = Dataset.from_list(examples)

    # --- 4-bit quantization ---
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
    )

    print("[train] Loading tokenizer and model...")
    tokenizer = AutoTokenizer.from_pretrained(
        model_name, trust_remote_code=True, token=hf_token
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
        torch_dtype=torch.bfloat16,
        token=hf_token,
    )
    print(f"[train] Model loaded. Memory: {torch.cuda.memory_allocated() / 1e9:.1f} GB")

    # --- LoRA config (higher rank for better capacity) ---
    lora_config = LoraConfig(
        r=lora_r,
        lora_alpha=lora_alpha,
        target_modules=[
            "q_proj",
            "k_proj",
            "v_proj",
            "o_proj",
            "gate_proj",
            "up_proj",
            "down_proj",
        ],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )

    # --- Training ---
    training_args = SFTConfig(
        output_dir=output_dir,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=4,
        num_train_epochs=num_epochs,
        learning_rate=learning_rate,
        warmup_ratio=0.05,
        logging_steps=5,
        save_steps=50,
        bf16=True,
        report_to="none",
        save_total_limit=2,
        remove_unused_columns=False,
        gradient_checkpointing=True,
        max_length=max_seq_length,
        dataset_text_field="text",
    )

    trainer = SFTTrainer(
        model=model,
        args=training_args,
        train_dataset=dataset,
        processing_class=tokenizer,
        peft_config=lora_config,
    )

    print("[train] Starting training...")
    trainer.train()

    # --- Save model ---
    print(f"[train] Saving model to {output_dir}")
    trainer.save_model(output_dir)
    tokenizer.save_pretrained(output_dir)
    vol.commit()
    print("[train] Model saved to Modal volume")

    # --- Merge LoRA and push to HF Hub ---
    if hf_repo_id:
        print(f"[train] Merging LoRA and pushing to HF Hub: {hf_repo_id}")
        from peft import PeftModel

        # Load base model in full precision for merging
        base_model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.bfloat16,
            device_map="auto",
            trust_remote_code=True,
            token=hf_token,
        )

        merged_model = PeftModel.from_pretrained(base_model, output_dir)
        merged_model = merged_model.merge_and_unload()

        # Save merged model
        merged_dir = f"{output_dir}-merged"
        merged_model.save_pretrained(merged_dir, torch_dtype=torch.bfloat16)
        tokenizer.save_pretrained(merged_dir)

        # Push to HF
        merged_model.push_to_hub(hf_repo_id, token=hf_token)
        tokenizer.push_to_hub(hf_repo_id, token=hf_token)

        # Also push the submission scripts
        from huggingface_hub import HfApi

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

        print(f"[train] Pushed merged model + scripts to {hf_repo_id}")

    print("[train] Done!")


@app.function(image=image, volumes={"/root/models": vol})
def list_models():
    """List saved models on the Modal volume."""
    import os

    models_dir = "/root/models"
    if os.path.exists(models_dir):
        for item in os.listdir(models_dir):
            full_path = os.path.join(models_dir, item)
            size = 0
            for root, _dirs, files in os.walk(full_path):
                for f in files:
                    size += os.path.getsize(os.path.join(root, f))
            print(f"  {item}: {size / 1e9:.2f} GB")
    else:
        print("No models found")


@app.local_entrypoint()
def main(
    model_name: str = "Qwen/Qwen2.5-14B-Instruct",
    hf_repo_id: str = "Papajams/ratiocine",
    epochs: int = 3,
    lora_r: int = 32,
    lr: float = 1e-4,
):
    """Run CoT fine-tuning on Modal.

    Args:
        model_name: Base model to fine-tune (Qwen3-14B, not AWQ, for training).
        hf_repo_id: HF repo to push the merged model.
        epochs: Number of training epochs.
        lora_r: LoRA rank (32 for more capacity than the v1 r=16).
        lr: Learning rate (1e-4, lower than v1's 2e-4 for stability).
    """
    train.remote(
        model_name=model_name,
        hf_repo_id=hf_repo_id,
        num_epochs=epochs,
        lora_r=lora_r,
        learning_rate=lr,
    )
