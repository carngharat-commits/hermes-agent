# Deploying TradePulse

One container serves the UI and the API; Caddy in front of it terminates TLS.
Everything that must outlive the container — accounts, sessions, the book,
the intelligence store — lives on one volume mounted at `/data`.

## What you need

- A host with Docker, and ports 80 and 443 reachable from the internet.
- A domain name pointed at that host.
- A `.env` at the repository root, copied from `apps/tradepulse/.env.example`.
  Nothing in it is required to start; each blank leaves a feature in stub
  mode and says so on screen.

## Start it

```bash
cp apps/tradepulse/.env.example .env            # then edit
TRADEPULSE_DOMAIN=tradepulse.example.com \
  docker compose -f apps/tradepulse/deploy/docker-compose.yml up -d --build
```

Open `https://tradepulse.example.com/`. The first visit offers to create the
first account, which becomes the owner. There is no open sign-up after that;
the owner adds accounts from Settings.

## What the pieces do

| Piece | Job |
| --- | --- |
| `deploy/Dockerfile` | Builds the UI with Node, then a Python image that serves it and the API on 8787 |
| `deploy/docker-compose.yml` | The app plus Caddy, with the domain wired into the OAuth callback and the cookie's Secure flag |
| `deploy/Caddyfile` | Automatic TLS, gzip, HSTS, and a reverse proxy to the app |

The backend serves `dist/` when `TRADEPULSE_STATIC_DIR` is set: hashed assets
cached for a year, `index.html` uncached so a deploy takes, and every non-API
path falls back to the page so deep links and reloads work. An unknown
`/api/...` path stays a JSON 404.

## Without Docker

```bash
npm run build --workspace=apps/tradepulse
cd apps/tradepulse/server
TRADEPULSE_STATIC_DIR=../dist TRADEPULSE_RELOAD=false TRADEPULSE_HOST=0.0.0.0 \
  PYTHONPATH=. .venv/bin/python -m tradepulse_server
```

Put a TLS-terminating proxy in front (the `Caddyfile` works standalone) and set
`TRADEPULSE_FRONTEND_URL` to the public origin. The session cookie is `Secure`
by default whenever that origin is not localhost, so plain HTTP will not sign
you in — that is the point.

## Things to do before real people use it

- **Back up `/data`** as you would a credential: the sessions file holds a
  live bearer token for a connected trading account.
- **Set `TRADEPULSE_STATE_SECRET`** if you will ever run more than one host.
- **Register the Kite redirect URL** on the Zerodha developer console exactly
  as `https://<domain>/api/kite/callback`.
- **Choose a quote vendor** (`TRADEPULSE_QUOTES_URL`) and a fundamentals
  provider; until then quotes are labelled stubs and valuations use hand-built
  inputs for eight names.
