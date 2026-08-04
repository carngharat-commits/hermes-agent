"""SQLite-backed intelligence store.

Chosen over the in-memory dicts the rest of the backend uses because the
recommendation record has to outlive the process — a performance engine that
forgets on restart cannot measure anything. SQLite keeps deployment to a file
path while giving real transactions and an append-only history.

The connection is per-thread (``check_same_thread`` stays on), which matches
how FastAPI's threadpool runs sync work.
"""

from __future__ import annotations

import json
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

SCHEMA_VERSION = 1
SCHEMA_PATH = Path(__file__).with_name("schema.sql")


def utcnow() -> str:
    """Timestamps are ISO-8601 UTC everywhere. Local time is a reporting concern."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class IntelStore:
    """Append-only store for valuations, recommendations, and their outcomes."""

    def __init__(self, path: str | Path = ":memory:"):
        self.path = str(path)
        self._local = threading.local()
        # An in-memory database is per-connection, so a shared one has to be
        # held open for the store's lifetime or each thread gets a fresh blank.
        self._shared: sqlite3.Connection | None = None
        if self.path == ":memory:":
            self._shared = self._new_connection()
        else:
            Path(self.path).parent.mkdir(parents=True, exist_ok=True)
        self._migrate()

    # -- connection handling ------------------------------------------------

    def _new_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    @property
    def conn(self) -> sqlite3.Connection:
        if self._shared is not None:
            return self._shared
        existing = getattr(self._local, "conn", None)
        if existing is None:
            existing = self._new_connection()
            self._local.conn = existing
        return existing

    def _migrate(self) -> None:
        with self.conn as conn:
            conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
            row = conn.execute("SELECT MAX(version) AS v FROM schema_version").fetchone()
            if row["v"] is None:
                conn.execute(
                    "INSERT INTO schema_version (version, applied_at) VALUES (?, ?)",
                    (SCHEMA_VERSION, utcnow()),
                )

    def close(self) -> None:
        if self._shared is not None:
            self._shared.close()
            self._shared = None

    # -- valuations ---------------------------------------------------------

    def record_valuation(self, valuation: dict[str, Any]) -> int:
        """Insert a valuation, or return the existing id for identical inputs.

        The uniqueness key is (symbol, as_of, fingerprint), so recomputing from
        unchanged financials is free and changed financials always land a new
        row — which is exactly the historical trend.
        """
        columns = (
            "symbol", "as_of", "computed_at", "fingerprint", "provider",
            "intrinsic_value", "fair_value", "dcf_value", "epv_value",
            "market_price", "margin_of_safety", "discount_premium",
            "financial_health", "business_quality", "detail",
        )
        values = [valuation.get(c) for c in columns]
        values[columns.index("computed_at")] = valuation.get("computed_at") or utcnow()
        values[columns.index("detail")] = json.dumps(valuation.get("detail", {}))

        with self.conn as conn:
            cursor = conn.execute(
                f"INSERT OR IGNORE INTO valuations ({', '.join(columns)}) "
                f"VALUES ({', '.join('?' * len(columns))})",
                values,
            )
            if cursor.lastrowid and cursor.rowcount:
                return int(cursor.lastrowid)
            existing = conn.execute(
                "SELECT id FROM valuations WHERE symbol = ? AND as_of = ? AND fingerprint = ?",
                (valuation["symbol"], valuation["as_of"], valuation["fingerprint"]),
            ).fetchone()
            return int(existing["id"])

    def latest_valuation(self, symbol: str) -> dict[str, Any] | None:
        row = self.conn.execute(
            "SELECT * FROM valuations WHERE symbol = ? ORDER BY as_of DESC, id DESC LIMIT 1",
            (symbol,),
        ).fetchone()
        return _row(row)

    def valuation_history(self, symbol: str, limit: int = 40) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT * FROM valuations WHERE symbol = ? ORDER BY as_of ASC LIMIT ?",
            (symbol, limit),
        ).fetchall()
        return [_row(r) for r in rows]

    # -- recommendations ----------------------------------------------------

    def record_recommendation(self, rec: dict[str, Any]) -> int:
        """Append a recommendation. Never updates an existing row.

        A new call on a symbol that already has one is a new row carrying the
        previous row's id in ``supersedes_id`` and an incremented version, so
        the full chain of what the AI thought and when stays readable.
        """
        previous = self.conn.execute(
            "SELECT id, version FROM recommendations WHERE symbol = ? "
            "ORDER BY version DESC, id DESC LIMIT 1",
            (rec["symbol"],),
        ).fetchone()

        columns = (
            "symbol", "action", "created_at", "version", "supersedes_id",
            "market_price", "intrinsic_value", "valuation_id", "confidence",
            "technical_score", "fundamental_score", "macro_score",
            "news_sentiment", "reasoning", "evidence", "engine_version",
        )
        payload = dict(rec)
        payload.setdefault("created_at", utcnow())
        payload["version"] = (previous["version"] + 1) if previous else 1
        payload["supersedes_id"] = previous["id"] if previous else None
        payload["evidence"] = json.dumps(rec.get("evidence", {}))
        payload.setdefault("engine_version", "0.1.0")

        with self.conn as conn:
            cursor = conn.execute(
                f"INSERT INTO recommendations ({', '.join(columns)}) "
                f"VALUES ({', '.join('?' * len(columns))})",
                [payload.get(c) for c in columns],
            )
            return int(cursor.lastrowid)

    def recommendation(self, rec_id: int) -> dict[str, Any] | None:
        return _row(
            self.conn.execute(
                "SELECT * FROM recommendations WHERE id = ?", (rec_id,)
            ).fetchone()
        )

    def recommendations(
        self, symbol: str | None = None, limit: int = 200
    ) -> list[dict[str, Any]]:
        if symbol:
            rows = self.conn.execute(
                "SELECT * FROM recommendations WHERE symbol = ? "
                "ORDER BY created_at DESC, id DESC LIMIT ?",
                (symbol, limit),
            ).fetchall()
        else:
            rows = self.conn.execute(
                "SELECT * FROM recommendations ORDER BY created_at DESC, id DESC LIMIT ?",
                (limit,),
            ).fetchall()
        return [_row(r) for r in rows]

    def current_recommendation(self, symbol: str) -> dict[str, Any] | None:
        """The newest call for a symbol; superseded ones stay queryable."""
        return _row(
            self.conn.execute(
                "SELECT * FROM recommendations WHERE symbol = ? "
                "ORDER BY version DESC, id DESC LIMIT 1",
                (symbol,),
            ).fetchone()
        )

    # -- agent outputs ------------------------------------------------------

    def record_agent_outputs(
        self, recommendation_id: int | None, outputs: Iterable[dict[str, Any]]
    ) -> int:
        rows = [
            (
                recommendation_id,
                o["symbol"],
                o["agent"],
                o.get("created_at") or utcnow(),
                o["stance"],
                o.get("score"),
                o.get("confidence"),
                o.get("summary", ""),
                json.dumps(o.get("detail", {})),
            )
            for o in outputs
        ]
        with self.conn as conn:
            conn.executemany(
                "INSERT INTO agent_outputs (recommendation_id, symbol, agent, "
                "created_at, stance, score, confidence, summary, detail) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                rows,
            )
        return len(rows)

    def agent_outputs(self, recommendation_id: int) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT * FROM agent_outputs WHERE recommendation_id = ? ORDER BY agent",
            (recommendation_id,),
        ).fetchall()
        return [_row(r) for r in rows]

    # -- prices -------------------------------------------------------------

    def record_price(self, symbol: str, price: float, *, observed_at: str | None = None,
                     source: str = "kite") -> None:
        with self.conn as conn:
            conn.execute(
                "INSERT OR REPLACE INTO price_marks (symbol, observed_at, price, source) "
                "VALUES (?, ?, ?, ?)",
                (symbol, observed_at or utcnow(), price, source),
            )

    def record_prices(self, marks: Iterable[tuple[str, float]], *, source: str = "kite") -> int:
        stamp = utcnow()
        rows = [(sym, stamp, price, source) for sym, price in marks]
        with self.conn as conn:
            conn.executemany(
                "INSERT OR REPLACE INTO price_marks (symbol, observed_at, price, source) "
                "VALUES (?, ?, ?, ?)",
                rows,
            )
        return len(rows)

    def price_series(self, symbol: str, since: str | None = None) -> list[dict[str, Any]]:
        if since:
            rows = self.conn.execute(
                "SELECT * FROM price_marks WHERE symbol = ? AND observed_at >= ? "
                "ORDER BY observed_at ASC",
                (symbol, since),
            ).fetchall()
        else:
            rows = self.conn.execute(
                "SELECT * FROM price_marks WHERE symbol = ? ORDER BY observed_at ASC",
                (symbol,),
            ).fetchall()
        return [_row(r) for r in rows]

    # -- outcomes -----------------------------------------------------------

    def record_outcome(self, outcome: dict[str, Any]) -> None:
        """Replace a recommendation's evaluation.

        Unlike everything else here this is derived, not historical: it is what
        the prices say today about a call made earlier, so recomputing it is
        correct and keeping old copies would just be noise.
        """
        columns = (
            "recommendation_id", "evaluated_at", "current_price", "holding_days",
            "entry_price", "absolute_return", "cagr", "max_drawdown",
            "gain_missed", "loss_avoided", "capital_protected", "opportunity_cost",
            "verdict", "detail",
        )
        payload = dict(outcome)
        payload.setdefault("evaluated_at", utcnow())
        payload["detail"] = json.dumps(outcome.get("detail", {}))
        with self.conn as conn:
            conn.execute(
                f"INSERT OR REPLACE INTO outcomes ({', '.join(columns)}) "
                f"VALUES ({', '.join('?' * len(columns))})",
                [payload.get(c) for c in columns],
            )

    def outcome(self, recommendation_id: int) -> dict[str, Any] | None:
        return _row(
            self.conn.execute(
                "SELECT * FROM outcomes WHERE recommendation_id = ?",
                (recommendation_id,),
            ).fetchone()
        )

    def outcomes(self) -> list[dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT o.*, r.symbol, r.action, r.confidence, r.created_at "
            "FROM outcomes o JOIN recommendations r ON r.id = o.recommendation_id "
            "ORDER BY o.evaluated_at DESC"
        ).fetchall()
        return [_row(r) for r in rows]

    # -- learned weights ----------------------------------------------------

    def record_weights(self, weights: Iterable[dict[str, Any]]) -> int:
        stamp = utcnow()
        rows = [
            (w["agent"], w["weight"], w.get("hit_rate"), w.get("sample_size", 0),
             stamp, w.get("rationale", ""))
            for w in weights
        ]
        with self.conn as conn:
            conn.executemany(
                "INSERT INTO signal_weights (agent, weight, hit_rate, sample_size, "
                "computed_at, rationale) VALUES (?, ?, ?, ?, ?, ?)",
                rows,
            )
        return len(rows)

    def latest_weights(self) -> dict[str, dict[str, Any]]:
        rows = self.conn.execute(
            "SELECT w.* FROM signal_weights w JOIN ("
            "  SELECT agent, MAX(id) AS id FROM signal_weights GROUP BY agent"
            ") latest ON latest.id = w.id"
        ).fetchall()
        return {r["agent"]: _row(r) for r in rows}


def _row(row: sqlite3.Row | None) -> dict[str, Any] | None:
    """sqlite3.Row -> plain dict, with JSON columns already decoded."""
    if row is None:
        return None
    out = dict(row)
    for key in ("detail", "evidence"):
        if isinstance(out.get(key), str):
            try:
                out[key] = json.loads(out[key])
            except json.JSONDecodeError:
                pass
    return out
