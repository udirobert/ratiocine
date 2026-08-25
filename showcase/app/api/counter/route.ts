// Daily solve counter — lightweight social proof.
// In-memory store per serverless instance. Resets on cold start (acceptable
// for social proof; swap to Vercel KV for persistence if needed).

const store = new Map<string, number>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

export async function GET() {
  const key = todayKey();
  const count = store.get(key) || 0;
  return Response.json({ count, date: key });
}

export async function POST() {
  const key = todayKey();
  const count = (store.get(key) || 0) + 1;
  store.set(key, count);
  return Response.json({ count, date: key });
}
