# TradePulse backend — Kite Connect OAuth

FastAPI service handling roadmap step 1: authenticating a Zerodha account via
Kite Connect and holding the access token server-side.

## Run

```bash
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
PYTHONPATH=. ./.venv/bin/python -m tradepulse_server     # 127.0.0.1:8787
./.venv/bin/python -m pytest                             # 14 tests, no network
```

Configuration is entirely environmental — see `../.env.example`. With
`KITE_API_KEY` and `KITE_API_SECRET` unset the app swaps in `StubKiteClient`
and serves the identical routes against a fake account.

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
| `GET /api/kite/status` | Whether real credentials are configured |
| `GET /api/kite/login` | Step 1 — redirect into the Kite login |
| `GET /api/kite/callback` | Steps 2–4 — verify, exchange, set cookie, bounce back |
| `GET /api/kite/session` | Current session's profile, or `authenticated: false` |
| `POST /api/kite/logout` | Invalidate the Kite token and drop the session |
| `GET /api/kite/{holdings,positions,margins}` | Authenticated passthrough to Kite |

Failures on the callback don't render an error page — they redirect back to the
UI with `?kite_error=<reason>`, which `KiteConnectCard` turns into a banner.

## What's still a stub

- **Session storage is in-process memory** (`sessions.py`). A restart logs
  everyone out and a second worker shares nothing with the first. Back
  `SessionStore` with Redis or a table before this runs anywhere real — the
  interface is four methods wide, deliberately.
- **Portfolio routes return Kite's payloads raw.** They prove the token works;
  mapping them onto the shapes in `src/data/holdings.ts` is step 2.
- **Single-user assumption.** One session cookie, one Kite account, no notion
  of a TradePulse user owning the broker connection.
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
