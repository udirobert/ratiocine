"""
Modal training script for fine-tuning Qwen2.5-7B on IOL Linguini problems.

Usage:
    modal run hf-pipeline/train_modal.py

This runs on Modal's serverless GPUs. The fine-tuned model is saved to
a Modal Volume, and optionally pushed to Hugging Face Hub.

Cost estimate (A100 80GB at $2.50/hr):
    - Model loading + tokenization: ~2 min
    - Training (160 examples, 3 epochs, LoRA): ~15-20 min
    - Saving + push to HF: ~5 min
    - Total: ~25 min = ~$1.04
"""

import modal

PROJECT_ROOT = "/Users/udingethe/Dev/ratiocine"

# --- Modal setup ---

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

app = modal.App("ratiocine-train")

# Volume to persist the trained model
vol = modal.Volume.from_name("ratiocine-models", create_if_missing=True)


@app.function(
    image=image,
    gpu="A100-80GB",
    volumes={"/root/models": vol},
    timeout=1800,  # 30 min max
    secrets=[modal.Secret.from_name("huggingface")],
)
def train(
    model_name: str = "Qwen/Qwen2.5-7B-Instruct",
    dataset_path: str = "/root/data/synthetic/iol_train.jsonl",
    output_dir: str = "/root/models/ratiocine-qwen",
    hf_repo_id: str = "",
    num_epochs: int = 3,
    lora_r: int = 16,
    lora_alpha: int = 32,
    learning_rate: float = 2e-4,
    max_seq_length: int = 2048,
):
    """Fine-tune a model on IOL Linguini problems with LoRA + 4-bit quantization."""
    import os
    import sys

    sys.path.insert(0, "/root/hf-pipeline/submission")
    sys.path.insert(0, "/root/hf-pipeline")

    import torch
    from datasets import Dataset
    from peft import LoraConfig
    from transformers import (
        AutoModelForCausalLM,
        AutoTokenizer,
        BitsAndBytesConfig,
        TrainingArguments,
    )
    from trl import SFTTrainer

    # Authenticate with HF if token is available
    hf_token = os.environ.get("HF_TOKEN", "")
    if hf_token:
        from huggingface_hub import login

        login(token=hf_token)
        print("[train] Authenticated with Hugging Face")

    print(f"[train] Model: {model_name}")
    print(f"[train] Dataset: {dataset_path}")
    print(f"[train] Output: {output_dir}")
    print(f"[train] Epochs: {num_epochs}, LoRA r={lora_r}, lr={learning_rate}")

    # --- Load and format dataset ---
    from dataset import load_synthetic_data

    raw_examples = load_synthetic_data(dataset_path)
    print(f"[train] Loaded {len(raw_examples)} training examples")

    # --- 4-bit quantization ---
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
    )

    print("[train] Loading tokenizer and model...")
    tokenizer = AutoTokenizer.from_pretrained(
        model_name, trust_remote_code=True, token=hf_token
    )
    tokenizer.padding_side = "right"
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        quantization_config=bnb_config,
        device_map="auto",
        trust_remote_code=True,
        torch_dtype=torch.float16,
        token=hf_token,
    )
    print(f"[train] Model loaded. Memory: {torch.cuda.memory_allocated() / 1e9:.1f} GB")

    # --- Format chat template ---
    def format_chat_template(example):
        messages = example["messages"]
        text = tokenizer.apply_chat_template(messages, tokenize=False)
        return {"text": text}

    dataset = Dataset.from_list(raw_examples)
    dataset = dataset.map(format_chat_template)

    # 80/20 train/test split for generalization check
    train_test = dataset.train_test_split(test_size=0.2, seed=42)
    print(f"[train] Train: {len(train_test['train'])}, Eval: {len(train_test['test'])}")

    # --- LoRA config ---
    lora_config = LoraConfig(
        r=lora_r,
        lora_alpha=lora_alpha,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )

    # --- Training ---
    training_args = TrainingArguments(
        output_dir=output_dir,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        num_train_epochs=num_epochs,
        learning_rate=learning_rate,
        warmup_ratio=0.03,
        logging_steps=5,
        save_steps=50,
        eval_strategy="steps",
        eval_steps=50,
        fp16=True,
        report_to="none",
        save_total_limit=2,
        remove_unused_columns=False,
        gradient_checkpointing=True,
    )

    trainer = SFTTrainer(
        model=model,
        args=training_args,
        train_dataset=train_test["train"],
        eval_dataset=train_test["test"],
        tokenizer=tokenizer,
        peft_config=lora_config,
        max_seq_length=max_seq_length,
        dataset_text_field="text",
    )

    print("[train] Starting training...")
    trainer.train()

    # --- Save model ---
    print(f"[train] Saving model to {output_dir}")
    trainer.save_model(output_dir)
    tokenizer.save_pretrained(output_dir)

    # Commit to volume
    vol.commit()
    print("[train] Model saved to Modal volume")

    # --- Push to Hugging Face Hub ---
    if hf_repo_id:
        print(f"[train] Pushing to HF Hub: {hf_repo_id}")
        # Merge LoRA adapter with base model for a standalone repo
        from peft import PeftModel

        merged_model = PeftModel.from_pretrained(
            AutoModelForCausalLM.from_pretrained(
                model_name,
                torch_dtype=torch.float16,
                device_map="auto",
                trust_remote_code=True,
                token=hf_token,
            ),
            output_dir,
        )
        merged_model = merged_model.merge_and_unload()
        merged_model.save_pretrained(f"{output_dir}-merged", torch_dtype=torch.float16)
        tokenizer.save_pretrained(f"{output_dir}-merged")

        merged_model.push_to_hub(hf_repo_id, token=hf_token)
        tokenizer.push_to_hub(hf_repo_id, token=hf_token)
        print(f"[train] Pushed merged model to {hf_repo_id}")

    # Print final eval metrics
    if trainer.eval_metrics:
        print("[train] Final eval metrics:")
        for k, v in trainer.eval_metrics.items():
            print(f"  {k}: {v}")

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
            for root, dirs, files in os.walk(full_path):
                for f in files:
                    size += os.path.getsize(os.path.join(root, f))
            print(f"  {item}: {size / 1e9:.2f} GB")
    else:
        print("No models found")


@app.local_entrypoint()
def main(
    model_name: str = "Qwen/Qwen2.5-7B-Instruct",
    hf_repo_id: str = "",
    epochs: int = 3,
    lora_r: int = 16,
    lr: float = 2e-4,
):
    """Run the training job on Modal.

    Args:
        model_name: Base model to fine-tune.
        hf_repo_id: HF repo to push the merged model (e.g. "Papajams/ratiocine").
                    Leave empty to skip pushing.
        epochs: Number of training epochs.
        lora_r: LoRA rank.
        lr: Learning rate.
    """
    train.remote(
        model_name=model_name,
        hf_repo_id=hf_repo_id,
        num_epochs=epochs,
        lora_r=lora_r,
        learning_rate=lr,
    )
