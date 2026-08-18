// Ration status poll proxy.
// GET /api/status?id=<job_id> -> Modal status endpoint.
// Returns live job phases: queued -> waking -> loading -> deducing -> done | error.
// This endpoint drives the frontend "Deduction Theatre".

const UPSTREAM =
  process.env.STATUS_API_URL ||
  "https://ungethe--ratiocine-status.modal.run/";
const TIMEOUT_MS = Number(process.env.STATUS_TIMEOUT_MS || 15000);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "access-control-allow-headers": "content-type",
};

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }
  if (req.method !== "GET") {
    return json(405, { error: "method not allowed; GET only" });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id") || "";
  if (!id) {
    return json(400, { error: "id query param required" });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const resp = await fetch(`${UPSTREAM}/?id=${encodeURIComponent(id)}`, {
      signal: controller.signal,
    });
    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: { ...CORS, "content-type": "application/json" },
    });
  } catch (err) {
    if (err && err.name === "AbortError") {
      return json(504, { error: "status timeout", timeout_ms: TIMEOUT_MS });
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
