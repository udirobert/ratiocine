# Submission Repo Setup

## 1. Create a public Hugging Face model repository

Go to https://huggingface.co/new and create a public repo (e.g. `your-username/ratiocine`).

## 2. Ship model weights

```bash
# Clone the repo
git lfs install
git clone https://huggingface.co/your-username/ratiocine
cd ratiocine

# Copy the fine-tuned model (from hf-pipeline training output)
cp -r ../models/ratiocine-qwen/* .

# Copy the submission script
cp ../hf-pipeline/submission/script.py .

# Track with Git LFS
git lfs track "*.safetensors"
git lfs track "*.bin"
git add .
git commit -m "Add fine-tuned model and submission script"
git push
```

## 3. Enter the competition

Go to https://huggingface.co/spaces/iol-ai-challenge/iol-ai-2026 and enter your repo ID.

## 4. Validate

Test locally first:

```bash
# Prepare a sample test.csv
python hf-pipeline/dataset.py  # generates demo data

# Run the submission script locally
cd hf-pipeline/submission
HF_HUB_OFFLINE=0 python script.py  # local has internet, eval sandbox doesn't
```

## Important Notes

- The eval sandbox has **no internet** — all model weights must be in the repo
- 30 minute time limit — test inference speed before submitting
- T4 has 16GB — use 4-bit quantization
- Only `bitsandbytes` and `autoawq` are pre-installed for quantization
- Submit 2 final entries before the deadline (July 26, 23:59 UTC)
