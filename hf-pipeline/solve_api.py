"""
Ration solve API — async job engine for the Neutron app.

Architecture (cost-sensitive, scale-to-zero):
  POST /        -> accepts a problem, spawns a GPU job, returns job_id  (CPU container)
  GET  /status  -> returns live job phase + result                      (CPU container)
  GPU container only bills during the actual solve.

Phases (real data, drives the frontend "Deduction Theatre"):
  queued -> waking -> loading -> deducing (live token count) -> done | error

Endpoints after deploy:
  https://ungethe--ratiocine-solve.modal.run/         (POST submit)
  https://ungethe--ratiocine-status.modal.run/?id=    (GET poll)

The Netlify proxy (ratiocine.trustfall.xyz/api/) forwards both.
"""

import contextlib
import json
import os
import sys
import time
import uuid

PROJECT_ROOT = "/Users/udingethe/Dev/ratiocine"
MODEL_ID = os.environ.get("RATION_MODEL_ID", "Papajams/ratiocine")
JOB_TTL_S = 3600  # purge jobs older than 1h

import fastapi  # noqa: E402
import modal  # noqa: E402

image = (
    modal.Image.from_registry(
        "nvidia/cuda:12.4.0-devel-ubuntu22.04",
        add_python="3.11",
    )
    .pip_install(
        "torch>=2.4.0",
        "transformers==4.46.3",
        "accelerate>=1.1.0",
        "sentencepiece>=0.2.0",
        "huggingface_hub>=0.26.0",
        "fastapi",
        "uvicorn",
        "pydantic>=2.0",
    )
    # Exact pins from the working eval_14b_awq.py image: transformers 4.46.3
    # loads AWQ via the autoawq backend without needing gptqmodel.
    # autoawq must install after torch (its setup imports torch).
    .pip_install("autoawq==0.2.7.post1")
    .add_local_dir(
        f"{PROJECT_ROOT}/hf-pipeline",
        "/root/hf-pipeline",
    )
)

# Lightweight CPU-only image for the submit/status endpoints (no GPU billing).
cpu_image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "fastapi==0.104.1", "pydantic==2.5.0", "uvicorn"
)

# Image for the model cache population step (no GPU needed).
download_image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "huggingface_hub>=0.26.0"
)

app = modal.App("ratiocine-solve")
jobs = modal.Dict.from_name("ration-jobs", create_if_missing=True)

# Shared volume caches the 8.5GB model weights so a cold start loads from
# disk instead of re-downloading from HF (~1-2min instead of ~3min+).
model_cache = modal.Volume.from_name("ration-model-cache", create_if_missing=True)
CACHE_DIR = "/model_cache"

# Lazy globals inside the GPU container.
_state: dict = {}

COT_TASKS = {"translation", "fill_blanks"}
SHORT_TASKS = {"match_letters", "text_to_num"}


def _default_max_tokens(task_type: str) -> int:
    if task_type in COT_TASKS:
        return 512
    if task_type in SHORT_TASKS:
        return 128
    return 256


def _write_job(job_id: str, phase: str, detail: str = "", result=None):
    entry = {
        "phase": phase,
        "detail": detail,
        "ts": round(time.time(), 2),
    }
    if result is not None:
        entry["result"] = result
    jobs[job_id] = json.dumps(entry)


def _read_job(job_id: str):
    try:
        raw = jobs[job_id]
    except KeyError:
        return None
    return json.loads(raw)


def _purge_old_jobs():
    now = time.time()
    try:
        for key in list(jobs.keys()):
            try:
                entry = json.loads(jobs[key])
                if now - float(entry.get("ts", now)) > JOB_TTL_S:
                    del jobs[key]
            except Exception:
                continue
    except Exception:
        pass


class PhaseStreamer:
    """transformers streamer that reports live token count to the job dict."""

    def __init__(self, job_id: str):
        self.job_id = job_id
        self.n = 0

    def put(self, value):
        self.n += 1
        if self.n % 32 == 0:
            with contextlib.suppress(Exception):
                _write_job(self.job_id, "deducing", f"{self.n} tokens of reasoning")

    def end(self):
        pass


def _load_model(job_id: str):
    if "model" in _state:
        return _state["tokenizer"], _state["model"]

    _write_job(job_id, "loading", f"Loading {MODEL_ID} into GPU memory")
    sys.path.insert(0, "/root/hf-pipeline/submission")
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer

    hf_token = os.environ.get("HF_TOKEN", "")

    t0 = time.time()
    tokenizer = AutoTokenizer.from_pretrained(
        MODEL_ID, token=hf_token, trust_remote_code=True, cache_dir=CACHE_DIR
    )
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    model = AutoModelForCausalLM.from_pretrained(
        MODEL_ID,
        device_map="auto",
        trust_remote_code=True,
        torch_dtype=torch.float16,
        token=hf_token,
        cache_dir=CACHE_DIR,
    )
    model.eval()
    # Persist any newly-downloaded weights into the shared volume.
    with contextlib.suppress(Exception):
        model_cache.commit()
    print(f"[ration] loaded {MODEL_ID} in {time.time() - t0:.1f}s", flush=True)

    _state["tokenizer"] = tokenizer
    _state["model"] = model
    return tokenizer, model


@app.function(
    image=download_image,
    timeout=600,
    secrets=[modal.Secret.from_name("huggingface")],
    volumes={CACHE_DIR: model_cache},
)
def download_model():
    """Populate the shared volume with model weights (CPU-free, run once).

    Uses snapshot_download so no GPU/RAM is needed — just pulls files to disk.
    """
    from huggingface_hub import snapshot_download

    hf_token = os.environ.get("HF_TOKEN", "")
    t0 = time.time()
    path = snapshot_download(MODEL_ID, cache_dir=CACHE_DIR, token=hf_token)
    model_cache.commit()
    print(
        f"[ration] cached {MODEL_ID} -> {path} in {time.time() - t0:.1f}s", flush=True
    )


@app.function(
    image=image,
    gpu="L4",
    timeout=600,
    secrets=[modal.Secret.from_name("huggingface")],
    volumes={CACHE_DIR: model_cache},
)
def run_solve(
    job_id: str, context: str, query: str, task_type: str, max_new_tokens: int
):
    """GPU worker: load model, generate, report live phases."""
    sys.path.insert(0, "/root/hf-pipeline/submission")
    import torch
    from prompts import (
        USER_TEMPLATE,
        count_query_items,
        extract_analysis,
        get_system_prompt,
        parse_answers,
    )

    try:
        _write_job(job_id, "waking", "GPU container is booting")
        t0 = time.time()
        tokenizer, model = _load_model(job_id)

        _write_job(job_id, "deducing", "Reading the problem")
        messages = [
            {"role": "system", "content": get_system_prompt(task_type)},
            {
                "role": "user",
                "content": USER_TEMPLATE.format(
                    context=context.strip(), query=query.strip()
                ),
            },
        ]
        text = tokenizer.apply_chat_template(
            messages, add_generation_prompt=True, tokenize=False
        )
        inputs = tokenizer(text, return_tensors="pt")
        input_ids = inputs["input_ids"].to(model.device)

        streamer = PhaseStreamer(job_id)
        with torch.no_grad():
            out = model.generate(
                input_ids,
                max_new_tokens=max_new_tokens,
                do_sample=False,
                pad_token_id=tokenizer.eos_token_id,
                streamer=streamer,
            )

        generated = tokenizer.decode(
            out[0][input_ids.shape[-1] :], skip_special_tokens=True
        ).strip()
        n_items = count_query_items(query)
        answers = parse_answers(generated, n_expected=n_items, task_type=task_type)
        explanation = extract_analysis(generated)
        elapsed = round(time.time() - t0, 2)

        print(f"[ration] solve done task={task_type or '?'} in {elapsed}s", flush=True)
        _write_job(
            job_id,
            "done",
            f"Solved in {elapsed}s",
            result={
                "pred": answers,
                "explanation": explanation,
                "model": MODEL_ID,
                "elapsed_s": elapsed,
            },
        )
    except Exception as exc:
        _write_job(job_id, "error", str(exc)[:400])


CORS_HEADERS = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
}


def _json_response(data: dict, status_code: int = 200):
    """Return a plain Response to avoid FastAPI jsonable_encoder recursion bugs."""
    from starlette.responses import Response

    return Response(
        content=json.dumps(data),
        status_code=status_code,
        media_type="application/json",
        headers=CORS_HEADERS,
    )


@app.function(image=cpu_image)
@modal.fastapi_endpoint(method="POST", label="ratiocine-solve")
async def submit(request: fastapi.Request):
    body = json.loads((await request.body()) or b"{}")
    context = body.get("context", "")
    query = body.get("query", "")
    task_type = body.get("task_type", "")
    if not context or not query:
        return _json_response({"error": "context and query required"}, 400)
    try:
        max_new_tokens = int(
            body.get("max_new_tokens") or _default_max_tokens(task_type)
        )
    except (TypeError, ValueError):
        max_new_tokens = _default_max_tokens(task_type)

    _purge_old_jobs()
    job_id = uuid.uuid4().hex[:16]
    _write_job(job_id, "queued", "Waiting for a GPU worker")
    run_solve.spawn(job_id, context, query, task_type, max_new_tokens)

    return _json_response(
        {
            "job_id": job_id,
            "status_url": "https://ungethe--ratiocine-status.modal.run/?id=" + job_id,
            "phase": "queued",
        }
    )


@app.function(image=cpu_image)
@modal.fastapi_endpoint(method="GET", label="ratiocine-status")
async def status(id: str = ""):
    if not id:
        return _json_response({"error": "id required"}, 400)
    entry = _read_job(id)
    if entry is None:
        return _json_response({"error": "unknown or expired job"}, 404)
    return _json_response(entry)


@app.local_entrypoint()
def warm_cache():
    """Run once to populate the model volume cache: modal run solve_api.py --warm-cache"""
    download_model.remote()


@app.local_entrypoint()
def check():
    """End-to-end smoke test: submit, poll until done, print result."""
    import urllib.parse
    import urllib.request

    submit_url = submit.web_url("/")
    status_base = status.web_url("/")
    print(f"submit: {submit_url}")
    print(f"status: {status_base}")

    payload = json.dumps(
        {
            "context": (
                "suna: sun; bade: big; suna bade: big sun; me: my; me suna: my sun"
            ),
            "query": "Translate into the unfamiliar language: 1. the big sun",
            "task_type": "translation",
        }
    ).encode()
    req = urllib.request.Request(
        submit_url, data=payload, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        job = json.loads(resp.read().decode())
    print(f"job_id: {job['job_id']}")

    poll_url = status_base + "?id=" + urllib.parse.quote(job["job_id"])
    for i in range(120):
        time.sleep(5)
        with urllib.request.urlopen(poll_url, timeout=30) as resp:
            entry = json.loads(resp.read().decode())
        print(f"  [{i * 5:>4}s] {entry['phase']}: {entry.get('detail', '')}")
        if entry["phase"] in ("done", "error"):
            print(json.dumps(entry, indent=2, ensure_ascii=False))
            break
