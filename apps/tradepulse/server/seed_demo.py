#!/usr/bin/env python3
"""Put one explained AI call in the intelligence store, for the demo book.

The UI's "why?" drawer reads a stored recommendation. A fresh install has
none, so the demo book shows valuations but no AI call to open. This records
sixty days of marks for four demo holdings — the two banks sharing a shock so
the cross-market agent has something to find — and asks the running backend
for a recommendation on each, so the explanation drawer has real evidence.

    cd server && PYTHONPATH=. ./.venv/bin/python seed_demo.py

Idempotent: marks are keyed by (symbol, day) and a new recommendation simply
supersedes the last. Needs the backend up on TRADEPULSE_PORT (default 8787)
and, since the routes are behind the login, an account to sign in with:
TRADEPULSE_TEST_USER / TRADEPULSE_TEST_PASSWORD (defaults match journeys.mjs).
The store path follows TRADEPULSE_DATA_DIR unless TRADEPULSE_INTEL_DB is set.
"""

from __future__ import annotations

import http.cookiejar
import json
import os
import random
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

from tradepulse_server.intel.store import IntelStore

BASE = f"http://127.0.0.1:{os.environ.get('TRADEPULSE_PORT', '8787')}"
DATA_DIR = os.environ.get("TRADEPULSE_DATA_DIR", "data")
DB = os.environ.get("TRADEPULSE_INTEL_DB", str(Path(DATA_DIR) / "tradepulse.db"))
USER = os.environ.get("TRADEPULSE_TEST_USER", "asha")
PASSWORD = os.environ.get("TRADEPULSE_TEST_PASSWORD", "correct-horse-battery-9")

# One cookie jar for the run, so the login's session cookie rides on every call.
_opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

# Prices match the demo book so the holdings screen and the call agree.
HOLDINGS = [
    {"sym": "AXISBANK", "qty": 13, "ltp": 1235.40},
    {"sym": "CANBK", "qty": 300, "ltp": 121.50},
    {"sym": "RELIANCE", "qty": 40, "ltp": 1275.90},
    {"sym": "TCS", "qty": 8, "ltp": 3120.00},
]
COUPLED = {"AXISBANK", "CANBK"}


def post(path: str, body: dict) -> dict:
    req = urllib.request.Request(
        BASE + path, method="POST", data=json.dumps(body).encode(),
        headers={"content-type": "application/json"},
    )
    with _opener.open(req, timeout=30) as resp:
        return json.load(resp)


def sign_in() -> None:
    """Sign in, or create the first account if this is a fresh install."""
    session = json.load(_opener.open(BASE + "/api/auth/session", timeout=10))
    if not session.get("required"):
        return
    creds = {"username": USER, "password": PASSWORD, "name": "Asha Rao"}
    try:
        post("/api/auth/setup" if session.get("setup_required") else "/api/auth/login", creds)
    except urllib.error.HTTPError as exc:
        sys.exit(f"could not sign in as {USER}: HTTP {exc.code} — set TRADEPULSE_TEST_USER/PASSWORD")


def main() -> int:
    sign_in()
    store = IntelStore(DB)
    random.seed(7)
    paths = {h["sym"]: h["ltp"] * 0.82 for h in HOLDINGS}   # walk up into today
    base = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    base -= timedelta(days=60)
    for day in range(60):
        shock = random.uniform(-0.010, 0.014)
        for sym in paths:
            own = random.uniform(-0.010, 0.014)
            move = 0.75 * shock + 0.25 * own if sym in COUPLED else own
            paths[sym] *= 1 + move
            store.record_price(
                sym, round(paths[sym], 2), source="seed",
                observed_at=(base + timedelta(days=day)).isoformat(timespec="seconds"),
            )

    for h in HOLDINGS:
        rec = post("/api/intel/recommend",
                   {"symbol": h["sym"], "price": h["ltp"], "holdings": HOLDINGS})
        ev = rec["evidence"]
        spoke = ",".join(c["agent"] for c in ev["contributing"])
        print(f'{rec["symbol"]:<10}{rec["action"]:<8}conf {rec["confidence"]:>5.1f}  '
              f'forecast {ev.get("forecast_score"):>7}  x{ev.get("restraint_factor")}  '
              f'-> {ev.get("blended_score"):>7}   {spoke}')

    # One deliberately cheap call, so the drawer's "held back by portfolio
    # exposure" branch — the one that most needs explaining — has an example.
    rec = post("/api/intel/recommend",
               {"symbol": "AXISBANK", "price": 400.0,
                "holdings": [{**h, "ltp": 400.0} if h["sym"] == "AXISBANK" else h
                             for h in HOLDINGS]})
    print(f'AXISBANK@400 -> {rec["action"]} (restraint x{rec["evidence"]["restraint_factor"]})')
    return 0


if __name__ == "__main__":
    sys.exit(main())
