# Showcase Setup Guide

Quick setup instructions for the Ratiocine showcase (Next.js + Three.js game).

---

## Prerequisites

- Node.js 18+ (check: `node --version`)
- npm or pnpm

---

## Installation

```bash
cd showcase
npm install
```

---

## Environment Variables

Create a `.env` file in the `showcase/` directory:

```bash
# Generate a random 32-char salt for session ID hashing
TRACE_SALT=$(openssl rand -hex 16)

# Add to .env
echo "TRACE_SALT=$TRACE_SALT" > .env
```

Or manually:
1. Generate: `openssl rand -hex 16` (or `node -e "console.log(crypto.randomBytes(16).toString('hex'))"`)
2. Copy the output
3. Create `showcase/.env` with `TRACE_SALT=<your-salt>`

---

## Development

```bash
npm run dev
```

Open http://localhost:3000

---

## Build

```bash
npm run build
```

---

## Testing Phase 1 (Solver Trace Collection)

### 1. Start dev server
```bash
npm run dev
```

### 2. Test consent flow
- Visit http://localhost:3000/play
- Wait 5 seconds → consent banner should appear
- Click "I'm in" → verify badge appears in top-right
- Check browser console: should see session ID generated
- Check localStorage: `ration-research-consent` should be `"true"`

### 3. Test privacy page
- Click "Learn more about data use" in banner
- Verify `/privacy` page loads and explains data collection

### 4. Test trace logging
- Play through one puzzle (study → solve → submit)
- Check browser console for `[TRACE]` logs (development mode only)
- On Unix systems, check `/tmp/solver-traces.jsonl`:
  ```bash
  tail -f /tmp/solver-traces.jsonl
  ```
- Each line should be a valid JSON object with event, timestamp, session_id, etc.

### 5. Verify privacy compliance
- Inspect a trace in `/tmp/solver-traces.jsonl`
- Verify NO IP address is logged
- Verify NO user agent is logged
- Verify session_id is a long hex string (SHA-256 hash)
- Verify no PII

---

## Common Issues

### "command not found: next"
Solution: Run `npm install` first to install dependencies.

### "Module not found: @/components/ConsentBanner"
Solution: Check that `tsconfig.json` has `"paths": { "@/*": ["./*"] }` configured.

### Consent banner doesn't appear
Solution: Wait 5 seconds after page load. Check browser console for errors.

### Traces not logging
Solution:
1. Check consent is granted (localStorage)
2. Check browser console for errors
3. Verify `/api/log-trace` route exists
4. Check Network tab for 200 OK responses to `/api/log-trace`

---

## Deployment (Vercel)

### 1. Install Vercel CLI (optional)
```bash
npm i -g vercel
```

### 2. Deploy
```bash
vercel
```

Or push to GitHub — Vercel will auto-deploy if connected.

### 3. Set Environment Variables in Vercel
- Go to Vercel project settings → Environment Variables
- Add `TRACE_SALT` with your generated salt
- Redeploy if already deployed

### 4. Test on Production
- Visit your Vercel URL `/play`
- Test consent flow
- Check Vercel logs for trace events
- Verify no errors

---

## Migration to Vercel Blob (Production Storage)

Once testing is complete and you're ready for production storage:

### 1. Install Vercel Blob
```bash
npm install @vercel/blob
```

### 2. Uncomment in `app/api/log-trace/route.ts`
```typescript
// Uncomment this block:
const { put } = await import('@vercel/blob');
const filename = `traces/${entry.event}-${Date.now()}.json`;
await put(filename, JSON.stringify(entry), { access: 'private' });
```

### 3. Remove /tmp fallback
```typescript
// Remove or comment out the fs/promises block
```

### 4. Test
- Deploy to Vercel
- Submit a trace
- Check Vercel Blob dashboard for stored files

---

## Next Steps

Once Phase 1 testing is complete:
1. **Instrument game components** — add `trackSolverEvent()` calls to study/solve/submit
2. **Deploy to production** — merge to main, announce to users
3. **Monitor for 1 week** — aim for 20+ opt-ins, 500+ events
4. **Proceed to Phase 2** — LTB export + SOTA model testing

See `PHASE1_IMPLEMENTATION_STATUS.md` for full checklist.
