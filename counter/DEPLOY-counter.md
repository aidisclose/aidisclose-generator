# Global counter — Cloudflare Worker

A self-hosted, reliable replacement for the old counterapi.dev counter. It stores
a single total in Cloudflare KV and exposes:

- `GET  /` → `{ "count": <n> }` — read the total (used on page load)
- `POST /` → `{ "count": <n+1> }` — increment (used when a document is generated)

It includes a per-IP rate limit (one counted increment per IP per 60 s) so the
total can't be trivially inflated.

## Prerequisites

- A free [Cloudflare account](https://dash.cloudflare.com/sign-up).
- Node.js installed (for `npx wrangler`). No global install needed.

## Deploy (one time)

From this `counter/` directory:

```sh
# 1. Log in to Cloudflare
npx wrangler login

# 2. Create the KV namespace and copy the printed id
npx wrangler kv namespace create AID_COUNTER

# 3. Paste that id into wrangler.toml -> [[kv_namespaces]] id = "..."

# 4. Deploy
npx wrangler deploy
```

`wrangler deploy` prints the Worker URL, e.g.
`https://aidisclose-counter.<your-subdomain>.workers.dev`.

### First-party custom domain (important for Firefox)

`wrangler.toml` declares a custom domain `counter.aidisclose.org`. On
`wrangler deploy`, Cloudflare provisions the DNS record and TLS certificate
automatically (the zone is on the same account). The page calls this
first-party hostname instead of `*.workers.dev` — the latter is blocked by
Firefox Enhanced Tracking Protection as a third-party tracker, which made the
counter read as 0 in Firefox.

`COUNTER_URL` in `../index.html` is therefore set to
`https://counter.aidisclose.org`.

## Wire up the page

1. In `../index.html`, set `COUNTER_URL` to your deployed Worker URL (keep the
   trailing slash).
2. In `worker.js`, confirm `ALLOWED_ORIGINS` lists your site origin(s)
   (`https://aidisclose.org`). Add `http://localhost:...` while testing, then
   redeploy.

## Notes / tuning

- **Seed an initial value** (e.g. to carry over the old count):

  ```sh
  npx wrangler kv key put --binding AID_COUNTER count 1234
  ```

- **Reset** the same way with a different value.
- **Rate-limit window**: change `RATE_WINDOW` in `worker.js` (seconds per IP).
- **Free tier**: KV allows ~100k reads + 1k writes/day on the free plan — far
  more than this counter needs.
- The `GET` on page load only reads; only the four generate/Overleaf actions
  `POST`. If you'd rather count unique browsers, add a `localStorage` guard in
  `incrementGlobalCounter()` so each browser POSTs at most once.
