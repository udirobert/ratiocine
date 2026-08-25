# DNS Setup — ratiocine.trustfall.xyz

The Netlify site serves the `/api/solve` and `/api/status` proxy functions that
front Modal's GPU inference engine. All other traffic (including `/`) 301-redirects
to the Vercel showcase. The showcase (game + AI comparison) is the single
user-facing surface.

| Domain | Host | Purpose |
|--------|------|---------|
| `ratiocine.trustfall.xyz` | Netlify | API proxy to Modal (`/api/*`), redirects all else to Vercel |
| `ratiocine.vercel.app` | Vercel | Next.js showcase — puzzle game, AI comparison, the build |

## Netlify custom domain setup

### 1. Add the custom domain in Netlify

1. Go to Netlify dashboard → your site → **Domain management** → **Add a domain**
2. Enter `ratiocine.trustfall.xyz`
3. Netlify will show you the required DNS record

### 2. Add the CNAME record at your DNS provider (for trustfall.xyz)

Add a **CNAME** record:

```
Type:  CNAME
Name:  ratiocine
Value: <your-netlify-site>.netlify.app
TTL:   3600 (or "Auto")
```

Replace `<your-netlify-site>` with your actual Netlify subdomain (visible in
Site settings → General → Site name, e.g. `golden-arithmetic-abc123`).

### 3. Enable HTTPS

Once DNS propagates (usually < 5 minutes), Netlify will automatically provision
a Let's Encrypt TLS certificate for `ratiocine.trustfall.xyz`. No action needed
— just wait for the green lock to appear in the dashboard.

### 4. Verify

```bash
# Should return the Netlify landing page HTML
curl -sI https://ratiocine.trustfall.xyz | head -5

# Should return a JSON error (no job ID) — proves the proxy is live
curl -s https://ratiocine.trustfall.xyz/api/status?id=ping
```

## How the code uses this domain

- `ai-comparison.tsx` and `ration-app/src/index.tsx` both try
  `https://ratiocine.trustfall.xyz/api/status?id=ping` as a health probe. If it
  responds within 2.5s, they use the branded base URL for all API calls.
  Otherwise, they fall back to direct Modal URLs.

- `neutron.json` declares the HTTPS outcall capability pointing to
  `https://ratiocine.trustfall.xyz/api/` for future canister-initiated solves.

## If the DNS isn't wired yet

Everything still works — the frontend code gracefully falls back to direct
Modal endpoints (`https://ungethe--ratiocine-solve.modal.run/` and
`https://ungethe--ratiocine-status.modal.run/`). The branded domain is
cosmetic and gives a single stable identity across share cards and
documentation.
