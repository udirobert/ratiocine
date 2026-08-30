# DNS Setup — ratiocine.trustfall.xyz

Everything runs on **Vercel** — the Next.js showcase, the puzzle game, and the
API proxy (via `rewrites` in `next.config.ts`). Netlify is retired.

| Domain | Host | Purpose |
|--------|------|---------|
| `ratiocine.trustfall.xyz` | Vercel | Canonical domain — game, showcase, `/api/*` proxy to Modal |
| `ratiocine.vercel.app` | Vercel | Default Vercel subdomain (works, but not canonical) |

## Add the custom domain in Vercel

1. Go to Vercel dashboard → your project → **Settings** → **Domains**
2. Add `ratiocine.trustfall.xyz`
3. Vercel will show the required DNS record

## Add the CNAME record at your DNS provider (trustfall.xyz)

```
Type:  CNAME
Name:  ratiocine
Value: cname.vercel-dns.com
TTL:   3600 (or "Auto")
```

`cname.vercel-dns.com` is Vercel's universal CNAME target for custom domains.

## HTTPS

Vercel provisions a TLS certificate automatically once DNS propagates (usually
< 5 minutes). No action needed.

## Verify

```bash
# Should serve the showcase HTML
curl -sI https://ratiocine.trustfall.xyz | head -5

# Should proxy to Modal and return a JSON error (no job ID)
curl -s https://ratiocine.trustfall.xyz/api/status?id=ping
```

## How the API proxy works

`showcase/next.config.ts` has rewrites:

```
/api/solve  → https://ungethe--ratiocine-solve.modal.run/
/api/status → https://ungethe--ratiocine-status.modal.run/
```

Same-origin from the browser's perspective — no CORS, no separate host. The
ration-app tile (which runs in a Neutron iframe on a different origin) uses the
absolute URL `https://ratiocine.trustfall.xyz/api/*` with a direct Modal
fallback.

## Netlify (retired)

The Netlify site at `ratiocine.netlify.app` is no longer needed. It previously
served a landing page and API proxy functions. Both are now handled by Vercel.
You can delete the Netlify site or leave it dormant — it won't receive traffic
once the CNAME points at Vercel.

## Future: ration.trustfall.xyz

If you want a separate domain for the Ration protocol page (once mainnet is
live), `ration.trustfall.xyz` is available. That would host the canister
interaction UI (attestation, ledger viewer, report verifier).

## Mainnet canister (live 2026-08-30)

The Ration app is deployed to mainnet on the Neutron canister:

- **Canister ID**: `cvrwv-mqaaa-aaaai-ax4pa-cai`
- **Canister URL**: `https://cvrwv-mqaaa-aaaai-ax4pa-cai.icp0.io`
- **Subnet**: `brlsh-zidhj-3yy3e-6vqbz-7xnih-xeq2l-as5oc-g32c4-i5pdn-2wwof-oae`

Methods are reachable via `@dfinity/agent` with a kernel-authorized identity
(controllers + Neutron self). `get_ledger`, `get_ledger_page`, `get_ledger_status`,
`get_pubkey` and `attest_entry` are all live. Browser-based attestation from the
showcase still needs a signed agent path (server-side Vercel route or an
`add_allowed_caller` bootstrap) — the `CANISTER_URL` base is `ai-comparison.tsx`
records the URL, but the background attest call is currently a no-op.
