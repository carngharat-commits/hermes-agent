# TradePulse

Trading intelligence dashboard — Vite + React frontend, FastAPI backend for
Zerodha Kite Connect authentication.

This started life as a single 5,786-line React artifact. That file is now split
across `src/`, and the first roadmap step (live Kite Connect login) is wired up
against a real backend.

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
the redirect, the session cookie, logout, and a small set of fixture holdings
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
| `cd server && pytest` | Backend tests (32, no network) |

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
                            usePortfolio.ts, which merges live Kite holdings
                            over the Zerodha slice of it
  components/ui/            Card, Pill, Btn, Row, KV, Field, Stub, …
  components/shell/         Sidebar, TopBar, MarketTicker, Shell, nav map
  features/<area>/          one directory per tab — dashboard, portfolio,
                            intelligence, signals, opportunities, calendar,
                            risk, orders, algo, accounts, settings, plus the
                            shared chart and AI drawers
server/                     FastAPI Kite Connect backend — see server/README.md
```

98 modules were derived from the artifact; `api/kite.ts`,
`features/accounts/KiteConnectCard.tsx`, `main.tsx`, and the config files are new.

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

**Step 3 — the rest of the surfaces.** Everything outside holdings is still
bundled data: signals, opportunities, the intelligence feed, the calendar, the
order book, risk scenarios. Orders are the natural next one — `ORDERS` and
`GTT_ORDERS` in `src/data/trading.ts` map onto Kite's `/orders` and
`/gtt/triggers`, and the passthrough route pattern is already there. Live
quotes (`/quote`) would replace the static `MARKET` block and make `dayPct`
move. Beyond that: multi-user sessions, and a real store behind `SessionStore`.
