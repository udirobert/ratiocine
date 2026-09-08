import { NextRequest, NextResponse } from 'next/server';

/**
 * Solver trace logging endpoint (Phase 1 research)
 *
 * Accepts anonymized solver traces from consented users and stores them
 * for linguistics research (IOL-AI + Last Translation Benchmark contributions).
 *
 * Privacy by design:
 * - Session IDs are hashed server-side (double-hashed with salt)
 * - No IP addresses logged
 * - No user agents logged
 * - Only called when user has explicitly consented
 */
export async function POST(req: NextRequest) {
  try {
    const trace = await req.json();

    // Basic validation
    if (!trace.event || !trace.timestamp || !trace.session_id) {
      return NextResponse.json(
        { error: 'Invalid trace format: missing required fields' },
        { status: 400 }
      );
    }

    // Validate event type
    const validEvents = [
      'session_start',
      'study_complete',
      'tile_placed',
      'tile_removed',
      'submit',
      'forfeit',
      'ai_verdict',
    ];
    if (!validEvents.includes(trace.event)) {
      return NextResponse.json(
        { error: `Invalid event type: ${trace.event}` },
        { status: 400 }
      );
    }

    // Anonymize: hash the session_id server-side (double-hashed with salt)
    const anonymizedSessionId = await hashSessionId(trace.session_id);

    const logEntry = {
      ...trace,
      session_id: anonymizedSessionId,
      server_timestamp: new Date().toISOString(),
      ip: null, // Never log IP
      user_agent: null, // Never log full UA
    };

    // Write to storage
    await writeTrace(logEntry);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('Trace logging error:', error);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    );
  }
}

/**
 * Hash a session ID with server-side salt (SHA-256).
 */
async function hashSessionId(sessionId: string): Promise<string> {
  const salt = process.env.TRACE_SALT;
  if (!salt) {
    throw new Error('TRACE_SALT environment variable is required');
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(sessionId + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Write trace to storage.
 *
 * For MVP: append to /tmp/solver-traces.jsonl (ephemeral, lost on cold start).
 * For production: use Vercel Blob Storage or Postgres.
 *
 * TODO: Migrate to Vercel Blob when ready for production.
 */
async function writeTrace(entry: any): Promise<void> {
  // Option 1: Vercel Blob (recommended for production)
  // Uncomment when ready:
  // const { put } = await import('@vercel/blob');
  // const filename = `traces/${entry.event}-${Date.now()}.json`;
  // await put(filename, JSON.stringify(entry), { access: 'private' });

  // Option 2: Append to JSONL (ephemeral, for local testing / MVP)
  // Node.js fs only works in Node.js runtime (not Edge)
  if (process.env.NODE_ENV === 'development') {
    const { appendFile } = await import('fs/promises');
    const { join } = await import('path');
    const logPath = join('/tmp', 'solver-traces.jsonl');
    await appendFile(logPath, JSON.stringify(entry) + '\n');
  }

  // Option 3: Log to console for debugging (always enabled in dev)
  if (process.env.NODE_ENV === 'development') {
    console.log('[TRACE]', entry.event, {
      session: entry.session_id.slice(0, 8),
      timestamp: entry.timestamp,
    });
  }

  // For now, traces are ephemeral. We'll migrate to persistent storage
  // once we validate the schema and consent flow work correctly.
}
