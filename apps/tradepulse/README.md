# TradePulse

Trading intelligence dashboard — Vite + React frontend, FastAPI backend for
Zerodha Kite Connect.

This started life as a single 5,786-line React artifact. That file is now split
across `src/`, and holdings, orders and GTT triggers are synced live from a
connected Zerodha account. Everything else the UI renders is still the data
bundled with the artifact — the Portfolio and Orders tabs say which you are
looking at.

## Running it

Two processes. Backend first:

```bash
cd server
python3 -m venv .venv && ./.venv/bin/pip install -r requirements.txt
PYTHONPATH=. ./.venv/bin/python -m tradepulse_server
```

Then the frontend, from this directory:

```bash
npm install --workspace tradepulse   # or npm install from the repo root
npm run dev                          # http://127.0.0.1:5273
```

Vite proxies `/api` to the backend on `127.0.0.1:8787`, so the browser stays
same-origin and the session cookie set by the OAuth callback is kept.

With no `KITE_API_KEY` / `KITE_API_SECRET` set the backend serves a **stub**:
the redirect, the session cookie, logout, and fixture holdings/orders/GTTs
all work end to end against a fake account, so the whole path is testable
before a Zerodha developer app exists. Stub responses are tagged `mode: "stub"`
and the UI labels them as such — they are not a real book. Copy `.env.example`
to `.env` and fill it in to talk to the real thing.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on 5273 |
| `npm run build` | `tsc -b` then a production bundle into `dist/` |
| `npm run typecheck` | Types only |
| `npm run lint` | ESLint |
| `node scripts/smoke.mjs` | Drives every tab + the Kite flow in Chromium (see header for setup) |
| `node scripts/journeys.mjs` | Full add/edit/remove journeys with dummy data, every segment |
| `cd server && pytest` | Backend tests (186, no network) |
| `cd server && python simulate.py` | End-to-end simulation printing input and output at each stage |
| `cd server && python simulate_automation.py` | 12 orchestrated cycles over a simulated year — shows whether the loop learns |

## Layout

```
src/
  main.tsx                  entry point
  App.tsx                   root component: view routing, theme, holdings state
  api/kite.ts               client for the backend's Kite routes
  theme/                    design tokens (T) + theme context
  lib/                      formatting (₹/$/%), seeded chart generation, constants
  data/                     the artifact's bundled snapshot: holdings, market,
                            signals, risk, brokers, calendar, roadmap — plus
                            usePortfolio.ts / useOrders.ts, which merge live
                            Kite data over the Zerodha slice of it
  components/ui/            Card, Pill, Btn, Row, KV, Field, Stub, …
  components/shell/         Sidebar, TopBar, MarketTicker, Shell, nav map
  features/<area>/          one directory per tab — dashboard, portfolio,
                            intelligence, signals, opportunities, calendar,
                            risk, orders, algo, accounts, settings, plus the
                            shared chart and AI drawers
server/                     FastAPI Kite Connect backend — see server/README.md
```

98 modules were derived from the artifact. Hand-written since: `api/kite.ts`,
`data/useKiteResource.ts`, `data/usePortfolio.ts`, `data/useOrders.ts`,
`components/ui/SourceBadge.tsx`, `features/accounts/KiteConnectCard.tsx`,
`main.tsx`, and the config files.

### How the split was done

Mechanically, not by retyping: each top-level declaration was cut at its source
boundaries and moved verbatim into a module, with only the import header and
the `export` keyword generated. Everything else was driven by the compiler —
imports the text scan over-guessed (a symbol named in UI copy, say) were pruned
by feeding `tsc`'s unused-symbol diagnostics back into the generator.

A handful of deliberate edits were made on top, all of them things the artifact
never had to survive because it was never typechecked or linted:

- `new Date(a) - new Date(b)` → `+new Date(a) - +new Date(b)` (2 sites)
- empty object literals used as string-keyed accumulators got a
  `Record<string, number>` annotation (2 sites)
- `ThemeContext` got a value type so `setThemeMode("light")` typechecks
- four locals that were assigned and never read were deleted
- `f && f()` in statement position → `f?.()` (3 sites)
- a masked-key placeholder called `Math.random()` during render; it now derives
  the same filler deterministically from the broker key
- `AddSheet` seeded its broker state from an effect; the broker list is a
  constant, so it's hoisted to module scope and seeded in `useState` directly

## Typing roadmap

`tsconfig.app.json` runs with `strict: false` and component props annotated
`any` — the components came over untyped and annotating 5,786 lines up front
would have buried the actual migration. The intended path:

1. Type the domain models in `data/` (`Holding`, `Signal`, `Opportunity`, …).
2. Replace `({ … }: any)` with real prop types, directory by directory.
3. Flip `strict` on once `features/` is annotated.

## Roadmap

**Step 1 — Kite Connect authentication — done.** Login redirect, token
exchange, server-side session, logout, and a state nonce binding the callback
to a login this app started. Backed by tests; see `server/README.md`.

**Step 2 — real portfolio data — done.** `GET /api/kite/portfolio` returns
holdings already mapped to the UI's shape, plus positions, margins and a
summary. `data/usePortfolio.ts` merges them into what the app renders.

The merge rule matters: **Kite speaks for one broker, so a live sync replaces
exactly the Zerodha slice.** ABML, INDmoney, mutual funds, crypto and metals
stay on the bundled snapshot, because nothing has been connected that could
speak for them. Manually added holdings sit on top of both. The Portfolio tab
carries a badge saying which of the three you're looking at — snapshot, live,
or stub fixtures — and tapping it explains the caveat.

Two mapping decisions worth knowing (`server/tradepulse_server/mapping.py`):
`qty` sums `quantity` and `t1_quantity`, so a portfolio doesn't shrink for a
day after every buy; `pledged` is `collateral_quantity > 0`, since Kite reports
pledging as a quantity split rather than a flag.

**Step 3 — live orders and GTTs — done.** `GET /api/kite/orders` returns the
order book and GTT triggers mapped to the shapes the Orders tab reads, and
`data/useOrders.ts` merges them on the same rule as holdings. Two translations
to know about: Kite reports a dozen order states and the UI understands three,
so anything still in flight reads PENDING with Kite's own status kept on
`kiteStatus`; and a two-leg GTT (stop-loss + target) splits into one row per
leg, which is how the bundled snapshot already represented such pairs.

Reads now go through a 15-second per-session cache (`server/cache.py`) — one
page load fans out to five Kite endpoints, and Kite publishes per-endpoint
rate limits.

## Sign-in

Only the broker routes used to check a session; every other screen — the
book, the watchlist, the AI calls, the performance record — was open to anyone
who reached the URL. The gap is easy to miss because the broker connection
*looks* like a login. It is not one: it proves a Zerodha account, not that
this person may use this deployment.

The backend now refuses every `/api` route without its own session cookie,
issued by `POST /api/auth/login` against `TRADEPULSE_PASSCODE`. One shared
passcode is the smallest thing that is actually a lock for a single-user app;
multi-user arrives with a users table, not with this growing. The compare is
constant-time, five failures lock a client out for fifteen minutes, and an
unset passcode never means open — the backend prints a one-time one at start,
the way Jupyter does. Signing out drops the broker session too, so a shared
browser cannot inherit a live token for the trading account.

The published prototype has no backend, so it cannot sign anyone in and has
nothing private behind it. It offers a read-only preview and says so on
screen the whole time.

## The AI chat is answered by the server

The "Ask AI" drawer on signals and opportunities used to call Anthropic's API
straight from the page. With no key that fails; with a key the key would ship
in the bundle to everyone who loads it. The call now goes through
`POST /api/ai/chat`: the key is read from `ANTHROPIC_API_KEY` on the server,
the system prompt lives in `server/tradepulse_server/ai.py`, and the browser
sends only the context block and the conversation. With no key configured the
drawer says so in words rather than failing, and nothing else on the screen
depends on it.

## The book starts empty

The first version shipped a real person's holdings as bundled constants that
eight views imported directly. Fine for a personal dashboard; a blocker for
anything public, since every visitor saw that book.

Holdings now live in `src/data/book.ts`: an external store that starts empty,
persists in this browser's localStorage only, and is what every view reads.
A first-time visitor sees "Your book is empty" with three ways in — add a
position, connect Zerodha, or load the demo book. The demo (`demoBook.ts`) is
sample data, labelled as such on the source badge, and can be cleared with one
click. Rows a user types in land in the same store, so the risk, calendar and
intelligence views see them exactly as they see a demo or a broker sync.

No name, location or filing status is baked in anywhere; the sidebar shows a
placeholder until a login exists.

## Where the AI shows up

Every AI call in the UI can be opened. The pill on a holding or watchlist row
reads `AI BUY 39% · why?`, and the drawer behind it shows how the score was
reached, each agent's own score and reasoning, which agents applied a
portfolio brake, which sat the question out and what they'd need, and the
provenance of the call. It is assembled from the recommendation's stored
evidence rather than regenerated, so an old call reads in the terms it was
actually made and the explanation cannot drift from the arithmetic.

That is a requirement, not a nicety: a bare `AI HOLD 32%` with nowhere to
click is an unexplained decision, and it is worst on the calls that most need
explaining — the ones a brake pulled back from a BUY.

Valuation only ever renders against a real market price. A watchlist row saved
with just a target gets no intrinsic-value comparison, because the target is
what the user hopes to pay and calling the gap a discount to market would be a
made-up number. Where a market price exists, the row also says how the target
compares to intrinsic value — the question a watchlist actually asks.

**Step 4 — what's left.** Live quotes (`/quote`) would replace the static
`MARKET` block and make `dayPct` move; that one needs its own cache policy,
since 15 seconds of staleness is fine for holdings and not for a ticker.
Zerodha tokens expire around 6am IST and there's no refresh — you re-login.
Signals, opportunities, the intelligence feed, the calendar and risk scenarios
are synthetic and have no Kite equivalent; they need their own sources.
Underneath all of it: multi-user sessions and a real store behind
`SessionStore`.
