#!/usr/bin/env python3
"""OpenAI-compatible LLM providers with retry and failover.

The Arkor preview endpoint expires its keys without warning (2026-10: every
call returned 404 "Unknown preview"), so evaluation runs fan out over free
provider lanes instead of depending on one. Providers are tried in order;
one without an API key is skipped. 429/5xx are retried with backoff on the
same provider before failing over to the next.

Env keys (see .env.example):
    ARKOR_API_KEY        OPENROUTER_API_KEY        GROQ_API_KEY        GOOGLE_API_KEY
"""

import json
import logging
import ssl
import time
import urllib.error
import urllib.request
from pathlib import Path

# Cloudflare errors code 1010 on bare urllib user-agents for some providers
# (observed on both arkor and groq). A full browser-ish UA + Accept is required.
UA = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
}

PROVIDERS = [
    {
        "name": "arkor",
        "env_key": "ARKOR_API_KEY",
        # legacy env var holds the full /chat/completions URL; normalize it
        "env_url": "ARKOR_ENDPOINT_URL",
        "default_url": "https://rationcine.arkor.app/v1",
    },
    {
        "name": "openrouter",
        "env_key": "OPENROUTER_API_KEY",
        "default_url": "https://openrouter.ai/api/v1",
    },
    {
        "name": "groq",
        "env_key": "GROQ_API_KEY",
        "default_url": "https://api.groq.com/openai/v1",
        "extra_headers": {"Origin": "https://console.groq.com"},
    },
    {
        # Google's OpenAI-compatible layer (AI Studio key)
        "name": "google",
        "env_key": "GOOGLE_API_KEY",
        "default_url": "https://generativelanguage.googleapis.com/v1beta/openai",
    },
]

RETRYABLE = {429, 500, 502, 503, 504}
MAX_RETRIES = 5
BACKOFF_BASE = 5.0


def _ssl_context():
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        pass
    cafile = ssl.get_default_verify_paths().cafile or "/etc/ssl/cert.pem"
    if Path(cafile).exists():
        return ssl.create_default_context(cafile=cafile)
    return ssl.create_default_context()


def _chat_url(env: dict, provider: dict) -> str:
    override = env.get(f"{provider['name'].upper()}_URL")
    legacy = env.get(provider["env_url"]) if provider.get("env_url") else None
    base = override or legacy or provider["default_url"]
    if not base:
        base = provider["default_url"]
    base = base.rstrip("/")
    if base.endswith("/chat/completions"):
        return base
    return base + "/chat/completions"


def build_payload(
    model: str,
    messages: list[dict],
    max_tokens: int | None = 512,
    temperature: float | None = 0,
) -> dict:
    payload: dict = {"model": model, "messages": messages}
    # GPT-5 / o-series reject max_tokens and temperature on the gateway too
    if any(m in model for m in ["gpt-5", "gpt-oss", "o1", "o3"]):
        return payload
    if max_tokens is not None:
        payload["max_tokens"] = max_tokens
    if temperature is not None:
        payload["temperature"] = temperature
    return payload


def call_chat(
    env: dict,
    provider: dict,
    payload: dict,
    timeout: int = 120,
    retries: int = MAX_RETRIES,
) -> str:
    """One provider, with retry on retryable statuses. Raises on final failure."""
    key = env[provider["env_key"]]
    url = _chat_url(env, provider)
    headers = {
        **UA,
        **provider.get("extra_headers", {}),
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    last: Exception | None = None
    for attempt in range(retries):
        req = urllib.request.Request(
            url, data=json.dumps(payload).encode(), headers=headers
        )
        try:
            with urllib.request.urlopen(
                req, timeout=timeout, context=_ssl_context()
            ) as resp:
                data = json.loads(resp.read())
            return data["choices"][0]["message"]["content"]
        except urllib.error.HTTPError as e:
            body = e.read().decode(errors="replace")[:200]
            last = RuntimeError(f"{provider['name']} HTTP {e.code}: {body}")
            if e.code not in RETRYABLE:
                raise last from e
        except (urllib.error.URLError, TimeoutError) as e:
            last = RuntimeError(f"{provider['name']} network error: {e}")
        if attempt < retries - 1:
            time.sleep(BACKOFF_BASE * 2**attempt)
    raise last  # type: ignore[misc]


def available_providers(env: dict) -> list[dict]:
    return [p for p in PROVIDERS if env.get(p["env_key"])]


def call_with_failover(env: dict, payload: dict, timeout: int = 120) -> tuple[str, str]:
    """Try each configured provider in order. Returns (content, provider_name)."""
    providers = available_providers(env)
    if not providers:
        raise RuntimeError("no provider API keys configured — see .env.example")
    errors = []
    for provider in providers:
        try:
            return call_chat(env, provider, payload, timeout), provider["name"]
        except Exception as e:
            errors.append(str(e))
            logging.warning(f"[failover] {e}")
    raise RuntimeError("all providers failed: " + " | ".join(errors))


def _load_local_env() -> dict:
    import pathlib

    env: dict[str, str] = {}
    for name in (".env", ".env.example"):
        f = pathlib.Path(__file__).resolve().parent.parent / name
        if f.exists():
            for line in f.read_text().splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                env.setdefault(k, v.strip().strip('"'))
    return env


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Probe configured LLM providers")
    parser.add_argument(
        "--model", default="google/gemma-4-31b-it", help="Model for the probe call"
    )
    parser.add_argument("--provider", default=None, help="Probe a single provider")
    args = parser.parse_args()

    env = _load_local_env()
    providers = available_providers(env)
    if args.provider:
        providers = [p for p in providers if p["name"] == args.provider]
    if not providers:
        print("no provider keys configured — see .env.example")
        raise SystemExit(1)

    payload = build_payload(
        args.model,
        [{"role": "user", "content": "Reply with exactly: OK"}],
        max_tokens=16,
    )
    for provider in providers:
        try:
            out = call_chat(env, provider, payload, timeout=90, retries=1)
            print(f"{provider['name']:>12}: OK — {out.strip()[:60]!r}")
        except Exception as e:
            print(f"{provider['name']:>12}: FAIL — {e}")
