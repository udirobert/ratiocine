// Ration solve proxy (async job pattern).
// POST /api/solve -> Modal submit endpoint: returns {job_id, phase:"queued"} instantly.
// GET  /api/status -> see status.mjs (polls job phases until done).
//
// The upstream URLs are pinned via env vars so the canister manifest's declared
// https_outcalls prefix (https://ratiocine.trustfall.xyz/api/) never changes.

const UPSTREAM =
  process.env.SOLVE_API_URL ||
  "https://ungethe--ratiocine-solve.modal.run/";
const TIMEOUT_MS = Number(process.env.SOLVE_TIMEOUT_MS || 20000);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, GET, OPTIONS",
  "access-control-allow-headers": "content-type",
};

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "POST") {
    return json(405, { error: "method not allowed; POST only" });
  }

  const body = await req.text();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(UPSTREAM, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: controller.signal,
    });
    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: { ...CORS, "content-type": "application/json" },
    });
  } catch (err) {
    if (err && err.name === "AbortError") {
      return json(504, { error: "submit timeout", timeout_ms: TIMEOUT_MS });
    }
    return json(502, { error: "upstream error: " + String(err) });
  } finally {
    clearTimeout(timer);
  }
};

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "content-type": "application/json" },
  });
}
