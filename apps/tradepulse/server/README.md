# TradePulse backend — Kite Connect OAuth

FastAPI service handling roadmap step 1: authenticating a Zerodha account via
Kite Connect and holding the access token server-side.

## Run

```bash
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
PYTHONPATH=. ./.venv/bin/python -m tradepulse_server     # 127.0.0.1:8787
./.venv/bin/python -m pytest                             # 186 tests, no network
```

Configuration is entirely environmental — see `../.env.example`. With
`KITE_API_KEY` and `KITE_API_SECRET` unset the app swaps in `StubKiteClient`
and serves the identical routes against a fake account.

## The app's own lock

`auth.py` holds the rules, `persist.py` the storage. Every `/api` route except
`/healthz`, `/api/auth/session`, `/api/auth/setup` and `/api/auth/login`
returns 401 without the `tradepulse_auth` cookie. Accounts are username +
password (PBKDF2-HMAC-SHA256, 600k iterations, per-user salt); the first one
is created by `POST /api/auth/setup`, which works exactly once and makes that
account the owner. The owner adds accounts with `POST /api/auth/users`; anyone
changes their own password with `POST /api/auth/password`. Lockout after five
failures per client address and per username. The Kite session sits *behind*
this lock: it proves a Zerodha login, not the right to use this deployment.

## The login flow

Kite Connect's handshake ([docs](https://kite.trade/docs/connect/v3/user/#login-flow)):

1. `GET /api/kite/login` mints a signed state nonce and redirects the browser to
   `kite.zerodha.com/connect/login?v=3&api_key=…&redirect_params=tp_state=…`.
2. Zerodha authenticates the user and redirects back to the app's registered
   redirect URL with `request_token`, `action`, and `status` — plus whatever
   was in `redirect_params`.
3. `GET /api/kite/callback` verifies the nonce, then POSTs `/session/token`
   with `checksum = sha256(api_key + request_token + api_secret)` and gets an
   `access_token` valid until roughly 6am IST the next morning.
4. The token is stored server-side; the browser gets an opaque session id in an
   HttpOnly cookie and is bounced back to the UI.

Kite has no `state` parameter of its own, which is why the nonce rides along in
`redirect_params`. Verifying it on the way back is what stops a stray
`request_token` from minting a session here.

## Routes

| Route | Purpose |
| --- | --- |
| `GET /healthz` | Liveness, mode, live session count |
| `GET /api/auth/session` | Signed in? First-run setup needed? Who? |
| `POST /api/auth/setup` | Create the first account (owner); works once |
| `POST /api/auth/login` | Username + password; sets the auth cookie |
| `POST /api/auth/logout` | Sign out, and drop the broker session with it |
| `POST /api/auth/password` | Change your own password |
| `GET/POST /api/auth/users` | Owner: list and add accounts |
| `GET/PUT /api/me/{book,watchlist}` | The signed-in user's own documents, replaced whole |
| `GET /api/quotes?symbols=A,B` | Latest price per symbol and its source (kite / http / stub) |
| `GET /api/quotes/status` | Which quote source is in use |
| `GET /api/ai/status` | Whether a model is configured for the chat drawer |
| `POST /api/ai/chat` | One reply for the drawer; key and prompt stay server-side |
| `GET /api/kite/status` | Whether real credentials are configured |
| `GET /api/kite/login` | Step 1 — redirect into the Kite login |
| `GET /api/kite/callback` | Steps 2–4 — verify, exchange, set cookie, bounce back |
| `GET /api/kite/session` | Current session's profile, or `authenticated: false` |
| `POST /api/kite/logout` | Invalidate the Kite token and drop the session |
| `GET /api/kite/portfolio` | Holdings/positions/margins mapped to the UI's shapes |
| `GET /api/kite/orders` | Order book + GTT triggers, mapped |
| `GET /api/kite/{holdings,positions,margins}` | Raw, unmapped passthrough, for debugging a sync |

Failures on the callback don't render an error page — they redirect back to the
UI with `?kite_error=<reason>`, which `KiteConnectCard` turns into a banner.

## Automation

`orchestrator.py` runs one cycle: **prices → valuations → recommendations →
outcomes → learning**. The order is load-bearing — valuations and the technical
agent read prices, outcomes score against the marks just recorded, learning
reads the outcomes. Each stage is idempotent (a retry after a crash is safe),
isolated (a failing stage is recorded and the cycle carries on), and audited to
the `runs` table.

`run_cycle` takes an optional `observed_at` — when these prices were seen. It
defaults to now, which is right for a live cycle; a caller replaying history
passes the timestamp the marks belong to. Price marks are keyed by
`(symbol, observed_at)` at second resolution, so without it a replay's cycles
merge into each other depending on how fast the machine runs. That is what
made the "deterministic" simulation harness disagree with itself.

`scheduler.py` drives it on `TRADEPULSE_CYCLE_SECONDS` (0 disables). The first
cycle waits one interval so a slow pipeline can never block startup, and
shutdown awaits the task rather than abandoning a cycle mid-write. A failing
cycle backs off exponentially instead of hammering a broken dependency.

Agents fan out concurrently with a per-agent timeout. Today the five
deterministic ones return in microseconds, but news, sentiment and macro will
each be a network call or a model round-trip, and serial execution would make
the ensemble's latency the sum of all of them.

They are two different kinds of agent and the consolidator treats them as
such. **Forecasts** (fundamental, technical, and the three pending ones) claim
a direction and set the blended score between them. **Brakes** (portfolio
risk, cross-market correlation, sector diversification) claim only that the
user already carries the exposure; they scale a bullish score down and are
ignored on a bearish one. So a brake can cap a BUY at a HOLD but can never
produce a REDUCE — owning something is not a reason to sell it. Averaging the
two kinds together, which is what the first version did, made every added
brake drag the ensemble bearish by construction: a simulated year returned 0
BUY calls out of 96 and 26 REDUCEs driven purely by concentration.

The same split governs the learning loop, which grades only forecasts. Both
read `agents.NON_DIRECTIONAL`, derived from the agents themselves.

`simulate_automation.py` drives twelve cycles over a simulated year against a
rigged market, and is the harness that found the bearish-blend defect above.
It reports three things per run that unit tests cannot: which agents actually
*spoke* (an agent can pass every test and abstain on every real run because
nothing populates the context it reads — both new agents shipped in exactly
that state), what the ensemble *recommended* as a distribution, and whether
any weight moved off its default.

`seed_demo.py` records sixty days of marks for four demo holdings and asks the
running backend for a call on each, so a fresh install has an AI call the UI
can open and explain. The two banks share a shock so the cross-market agent has
something to find, and one deliberately cheap call exercises the "held back by
portfolio exposure" branch.

`quotes.py` is the user-facing quote path: Kite when promoted, else the HTTP
provider from `TRADEPULSE_QUOTES_URL`, else labelled stub quotes; fifteen
seconds of cache per symbol. `PriceFeed` takes the same HTTP provider as a
fallback, so unattended cycles quote without a broker too.

`prices.py` gives the scheduler a price source. A Kite session belongs to a
browser, not a process, so a session must be explicitly **promoted** before
background cycles quote with it — deliberate and revocable, since the token is
a bearer credential for the whole account. With nothing promoted, cycles run
over stored marks rather than not running.

| Route | Purpose |
| --- | --- |
| `POST /api/intel/run` | Run one cycle now |
| `GET /api/intel/runs` | Run history + scheduler status |
| `POST /api/intel/price-feed/promote` | Let background cycles quote with this session |
| `POST /api/intel/price-feed/revoke` | Stop them |

## Mapping (`mapping.py`)

Pure functions, dicts in and dicts out, turning Kite's vocabulary into the
shape `src/data/holdings.ts` uses. Two calls are decisions rather than renames:

- **`qty` sums `quantity` and `t1_quantity`.** T1 stock is bought and paid for
  but still settling; excluding it makes a portfolio shrink for a day after
  every buy.
- **`pledged` is `collateral_quantity > 0`.** Kite reports pledging as a
  quantity split rather than a flag, so any collateralised quantity marks the
  whole row — the same granularity the UI's existing ABML rows use.

`/api/kite/portfolio` treats holdings as load-bearing and positions/margins as
best-effort: a user without F&O access gets a 403 on `/portfolio/positions`,
and that must not take the sync down. Failed side calls are named in
`unavailable` so the UI can say what's missing instead of quietly showing less.

## Caching (`cache.py`)

Kite publishes per-endpoint rate limits, and one page load fans out to five
endpoints. Reads go through a 15-second TTL cache keyed by
`(session id, path)` — never global, so two users can't see each other's book.
Errors are not cached, so a transient Kite failure isn't replayed for the rest
of the window, and logout drops that session's entries so a later login can't
be served the previous one's data. `/healthz` reports hits, misses and live
entries.

Holdings and orders don't move fast enough for 15 seconds of staleness to
matter. Anything that does — live quotes — will want its own path.

## Serving the UI (`static.py`)

With `TRADEPULSE_STATIC_DIR` pointing at a `vite build` output this process
serves it too: hashed assets, `index.html` uncached for every non-API path so
deep links and reloads work, and `/api/*` never swallowed by the fallback. The
Dockerfile in `../deploy` sets it; development leaves it blank and lets Vite
serve the UI. uvicorn trusts `X-Forwarded-For` so the lockout counters see the
real client behind a proxy.

## Sessions and secrets (`persist.py`)

Login and broker sessions live in an owner-only SQLite file
(`TRADEPULSE_SESSIONS_DB`, default `data/sessions.db`), so a restart no longer
logs everyone out and a second worker on the same host sees the same sessions.
The OAuth state secret is generated once on first run and kept next to it, so
a login that straddles a deploy still verifies; set `TRADEPULSE_STATE_SECRET`
to share it across hosts. The session cookie is `Secure` by default unless
`TRADEPULSE_FRONTEND_URL` is this machine. The sessions file holds a live
bearer token for the trading account — keep it out of backups you would not
treat as a credential.

## What's still a stub

- **Three agents still abstain.** News, sentiment and macro implement the
  agent contract and return "not wired" with what they'd need. They want a
  feed and a language model, not code.
- **Fundamentals are hand-built** for eight names. The valuation maths is
  real; the inputs are not filings. A `FundamentalsProvider` backed by a data
  vendor extends coverage to any listed script.
- **Unpromoted cycles quote through the HTTP provider or stale marks.** With
  neither a promoted session nor `TRADEPULSE_QUOTES_URL`, a background cycle
  re-scores against the last recorded price.
- **No rate-limit *handling*.** Reads go through a 15s cache, which keeps
  ordinary use well clear of Kite's published per-endpoint limits, but
  nothing here backs off or retries on a 429 — it surfaces as a failed sync.
- **Single-user assumption.** One passcode, one Kite account, no notion of a
  TradePulse user owning the broker connection. Multi-user comes with a users
  table.
- **One host.** SQLite-backed sessions share across workers on a machine, not
  across machines.

## Notes

- The access token is a bearer credential for the entire trading account. It
  never leaves this process and is never logged; `KiteSession.public_view()`
  is the only shape sent to the browser, and there's a test asserting the token
  isn't in it.
- Token exchange is the one call that must not be retried blindly: a
  `request_token` is single-use, so a failed exchange means restarting the
  login, not retrying the POST.
