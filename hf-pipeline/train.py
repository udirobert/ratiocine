"""
Fine-tune a model on IOL problems using Hugging Face SFTTrainer.
Target: Qwen2.5-7B (or 3B) at 4-bit, fits T4 16GB.

Free-GPU path: upload hf-pipeline/ + data/synthetic/ to a Kaggle Notebook
(T4/P100, 30 GPU-h/week free) and run:

    python train.py --data ../input/ratiocine-data/iol_train.jsonl --push your-username/ratiocine

--push logs in with HF_TOKEN (Kaggle Settings>API or `kaggle secrets`).
Local CPU/MPS smoke test: python train.py --limit 8 --epochs 1
"""

import argparse
import os

import torch
from dataset import load_synthetic_data
from datasets import Dataset
from dotenv import load_dotenv
from peft import LoraConfig
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    TrainingArguments,
)
from trl import SFTTrainer

load_dotenv()

MODEL_NAME = os.getenv("MODEL_NAME", "Qwen/Qwen2.5-7B-Instruct")
DATASET_PATH = os.getenv("DATASET_PATH", "data/synthetic/iol_train.jsonl")
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "./models/ratiocine-qwen")
HF_REPO_ID = os.getenv("HF_REPO_ID", "")  # e.g. "your-username/ratiocine"

DEVICE = (
    "cuda"
    if torch.cuda.is_available()
    else ("mps" if torch.backends.mps.is_available() else "cpu")
)


def format_chat_template(example: dict) -> dict:
    """Format a conversation into the tokenizer's chat template."""
    messages = example["messages"]
    text = tokenizer.apply_chat_template(messages, tokenize=False)
    return {"text": text}


def main():
    global tokenizer

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", default=DATASET_PATH, help="Training JSONL path")
    parser.add_argument(
        "--push", default=HF_REPO_ID, help="HF repo id to push the adapter to"
    )
    parser.add_argument(
        "--limit", type=int, default=0, help="Max examples (smoke test)"
    )
    parser.add_argument("--epochs", type=float, default=3)
    parser.add_argument(
        "--no-quant", action="store_true", help="Skip 4-bit (non-CUDA devices)"
    )
    args = parser.parse_args()

    print(f"[train] Loading model: {MODEL_NAME}")
    print(f"[train] Device: {DEVICE}")

    quant_config = None
    if not args.no_quant and DEVICE == "cuda":
        try:
            from transformers import BitsAndBytesConfig

            # 4-bit quantization to fit T4 16GB
            quant_config = BitsAndBytesConfig(
                load_in_4bit=True,
                bnb_4bit_compute_dtype=torch.float16,
                bnb_4bit_quant_type="nf4",
                bnb_4bit_use_double_quant=True,
            )
        except ImportError:
            print("[train] bitsandbytes unavailable, falling back to fp16")

    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, trust_remote_code=True)
    tokenizer.padding_side = "right"

    model = AutoModelForCausalLM.from_pretrained(
        MODEL_NAME,
        quantization_config=quant_config,
        device_map="auto" if DEVICE != "cpu" else None,
        trust_remote_code=True,
        torch_dtype=torch.float16,
    )

    # LoRA config
    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )

    # Load and format dataset
    raw_examples = load_synthetic_data(args.data)
    if args.limit:
        raw_examples = raw_examples[: args.limit]
    dataset = Dataset.from_list(raw_examples)
    dataset = dataset.map(format_chat_template)

    train_test = dataset.train_test_split(test_size=0.1, seed=42)

    # Training arguments
    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=4,
        num_train_epochs=args.epochs,
        learning_rate=2e-4,
        warmup_ratio=0.03,
        logging_steps=10,
        save_steps=50,
        evaluation_strategy="steps",
        eval_steps=50,
        fp16=DEVICE == "cuda",
        report_to="none",
        save_total_limit=2,
        remove_unused_columns=False,
    )

    trainer = SFTTrainer(
        model=model,
        args=training_args,
        train_dataset=train_test["train"],
        eval_dataset=train_test["test"],
        tokenizer=tokenizer,
        peft_config=lora_config,
        max_seq_length=2048,
        dataset_text_field="text",
    )

    print("[train] Starting training...")
    trainer.train()

    print(f"[train] Saving model to {OUTPUT_DIR}")
    trainer.save_model(OUTPUT_DIR)
    tokenizer.save_pretrained(OUTPUT_DIR)

    # Push to Hugging Face Hub if repo ID is set. push_to_hub on a 4-bit
    # quantized PEFT model re-quantizes wrongly — ship the saved adapter dir.
    if args.push:
        from huggingface_hub import login, upload_folder

        print(f"[train] Pushing adapter to HF Hub: {args.push}")
        if os.getenv("HF_TOKEN"):
            login(token=os.environ["HF_TOKEN"])
        upload_folder(repo_id=args.push, folder_path=OUTPUT_DIR)

    print("[train] Done!")


if __name__ == "__main__":
    main()
