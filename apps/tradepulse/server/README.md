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

`auth.py`. Every `/api` route except `/healthz`, `/api/auth/login` and
`/api/auth/session` returns 401 without the `tradepulse_auth` cookie. The Kite
session sits *behind* that lock: it proves a Zerodha login, not the right to
use this deployment, and most screens never touch the broker. Details in the
module docstring; the short version is one shared passcode, constant-time
compare, lockout after five failures, and a generated passcode printed to the
log rather than an open door when none is configured.

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
| `GET /api/auth/session` | Whether this browser is signed in to the app |
| `POST /api/auth/login` | Sign in with `TRADEPULSE_PASSCODE`; sets the auth cookie |
| `POST /api/auth/logout` | Sign out, and drop the broker session with it |
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

## What's still a stub

- **Three agents still abstain.** News, sentiment and macro implement the
  agent contract and return "not wired" with what they'd need. They want a
  feed and a language model, not code.
- **Unpromoted cycles quote stale marks** (above). A background cycle with no
  promoted session re-scores against the last recorded price.
- **Session storage is in-process memory** (`sessions.py`). A restart logs
  everyone out and a second worker shares nothing with the first. Back
  `SessionStore` with Redis or a table before this runs anywhere real — the
  interface is four methods wide, deliberately.
- **No rate-limit *handling*.** Reads go through a 15s cache (below), which
  keeps ordinary use well clear of Kite's published per-endpoint limits, but
  nothing here backs off or retries on a 429 — it surfaces as a failed sync.
- **Single-user assumption.** One session cookie, one Kite account, no notion
  of a TradePulse user owning the broker connection.
- **Only holdings and orders are live.** Quotes, signals, the calendar and
  everything else the UI renders still come from the bundled snapshot.
- **`state_secret` defaults to a per-process random value.** Fine for one dev
  process, wrong for more than one — set `TRADEPULSE_STATE_SECRET`.

## Notes

- The access token is a bearer credential for the entire trading account. It
  never leaves this process and is never logged; `KiteSession.public_view()`
  is the only shape sent to the browser, and there's a test asserting the token
  isn't in it.
- Token exchange is the one call that must not be retried blindly: a
  `request_token` is single-use, so a failed exchange means restarting the
  login, not retrying the POST.
