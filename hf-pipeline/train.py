"""
Fine-tune a model on IOL problems using Hugging Face SFTTrainer.
Target: Qwen2.5-7B (or 3B) at 4-bit, fits T4 16GB.
"""

import os

import torch
from dataset import load_synthetic_data
from datasets import Dataset
from dotenv import load_dotenv
from peft import LoraConfig
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
)
from trl import SFTTrainer

load_dotenv()

MODEL_NAME = os.getenv("MODEL_NAME", "Qwen/Qwen2.5-7B-Instruct")
DATASET_PATH = os.getenv("DATASET_PATH", "data/synthetic/iol_train.jsonl")
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "./models/ratiocine-qwen")
HF_REPO_ID = os.getenv("HF_REPO_ID", "")  # e.g. "your-username/ratiocine"

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


def format_chat_template(example: dict) -> dict:
    """Format a conversation into the tokenizer's chat template."""
    messages = example["messages"]
    text = tokenizer.apply_chat_template(messages, tokenize=False)
    return {"text": text}


def main():
    global tokenizer

    print(f"[train] Loading model: {MODEL_NAME}")
    print(f"[train] Device: {DEVICE}")

    # 4-bit quantization to fit T4 16GB
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_use_double_quant=True,
    )

    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME, trust_remote_code=True)
    tokenizer.padding_side = "right"

    model = AutoModelForCausalLM.from_pretrained(
        MODEL_NAME,
        quantization_config=bnb_config,
        device_map="auto",
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
    raw_examples = load_synthetic_data(DATASET_PATH)
    dataset = Dataset.from_list(raw_examples)
    dataset = dataset.map(format_chat_template)

    train_test = dataset.train_test_split(test_size=0.1, seed=42)

    # Training arguments
    training_args = TrainingArguments(
        output_dir=OUTPUT_DIR,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=4,
        num_train_epochs=3,
        learning_rate=2e-4,
        warmup_ratio=0.03,
        logging_steps=10,
        save_steps=50,
        evaluation_strategy="steps",
        eval_steps=50,
        fp16=True,
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

    # Push to Hugging Face Hub if repo ID is set
    if HF_REPO_ID:
        print(f"[train] Pushing to HF Hub: {HF_REPO_ID}")
        model.push_to_hub(HF_REPO_ID)
        tokenizer.push_to_hub(HF_REPO_ID)

    print("[train] Done!")


if __name__ == "__main__":
    main()
