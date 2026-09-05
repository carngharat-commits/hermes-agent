"""Sessions and secrets that outlive the process.

Until now both session stores were dictionaries: a restart logged everyone
out, a second worker saw none of the first one's sessions, and the OAuth
state secret was minted per process, so a deploy mid-login broke the login.
All three are fixed here with one small SQLite file and one small text file,
because that is what a single-host deployment actually needs — a Redis is
infrastructure without a problem to solve at this size.

The sessions file holds a live bearer token for a trading account. It is
created with owner-only permissions, kept apart from the analytics database,
and the token is the one field that is never read back into a response.
"""

from __future__ import annotations

import json
import os
import secrets
import sqlite3
import threading
import time
from dataclasses import asdict
from pathlib import Path

from .auth import AUTH_TTL_SECONDS, AuthSession, AuthStore
from .kite import KiteSession
from .sessions import SESSION_TTL_SECONDS

SCHEMA = """
CREATE TABLE IF NOT EXISTS auth_sessions (
    token       TEXT PRIMARY KEY,
    user_name   TEXT NOT NULL,
    created_at  REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS kite_sessions (
    session_id  TEXT PRIMARY KEY,
    payload     TEXT NOT NULL,
    created_at  REAL NOT NULL
);
"""


def _open(path: str | Path) -> sqlite3.Connection:
    if str(path) != ":memory:":
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        # Create it closed before SQLite touches it, so it is never world-readable.
        if not Path(path).exists():
            Path(path).touch(mode=0o600)
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


class SqliteAuthStore(AuthStore):
    """The app's login sessions, on disk. Lockout counters stay in memory —
    they are a brake on one process's login route, not a record."""

    def __init__(self, path: str | Path = ":memory:") -> None:
        super().__init__()
        self._conn = _open(path)
        self._db_lock = threading.Lock()

    def create(self, user_name: str) -> str:
        token = secrets.token_urlsafe(32)
        with self._db_lock, self._conn:
            self._conn.execute(
                "INSERT INTO auth_sessions (token, user_name, created_at) VALUES (?, ?, ?)",
                (token, user_name, time.time()),
            )
        return token

    def get(self, token: str | None) -> AuthSession | None:
        if not token:
            return None
        with self._db_lock:
            row = self._conn.execute(
                "SELECT user_name, created_at FROM auth_sessions WHERE token = ?", (token,)
            ).fetchone()
        if row is None:
            return None
        session = AuthSession(user_name=row["user_name"], created_at=row["created_at"])
        if session.expired():
            self.pop(token)
            return None
        return session

    def pop(self, token: str | None) -> AuthSession | None:
        if not token:
            return None
        with self._db_lock, self._conn:
            row = self._conn.execute(
                "SELECT user_name, created_at FROM auth_sessions WHERE token = ?", (token,)
            ).fetchone()
            self._conn.execute("DELETE FROM auth_sessions WHERE token = ?", (token,))
        return None if row is None else AuthSession(row["user_name"], row["created_at"])

    def purge_expired(self) -> int:
        cutoff = time.time() - AUTH_TTL_SECONDS
        with self._db_lock, self._conn:
            return self._conn.execute(
                "DELETE FROM auth_sessions WHERE created_at < ?", (cutoff,)
            ).rowcount

    def __len__(self) -> int:
        with self._db_lock:
            return self._conn.execute("SELECT COUNT(*) FROM auth_sessions").fetchone()[0]


class SqliteSessionStore:
    """Opaque id -> Kite session, on disk. Same four methods as before."""

    def __init__(self, path: str | Path = ":memory:") -> None:
        self._conn = _open(path)
        self._lock = threading.Lock()

    def create(self, kite: KiteSession) -> str:
        session_id = secrets.token_urlsafe(32)
        payload = json.dumps(asdict(kite))
        with self._lock, self._conn:
            self._conn.execute(
                "INSERT INTO kite_sessions (session_id, payload, created_at) VALUES (?, ?, ?)",
                (session_id, payload, time.time()),
            )
        return session_id

    def _row(self, session_id: str) -> sqlite3.Row | None:
        return self._conn.execute(
            "SELECT payload, created_at FROM kite_sessions WHERE session_id = ?", (session_id,)
        ).fetchone()

    def get(self, session_id: str | None) -> KiteSession | None:
        if not session_id:
            return None
        with self._lock:
            row = self._row(session_id)
        if row is None:
            return None
        if time.time() - row["created_at"] > SESSION_TTL_SECONDS:
            self.pop(session_id)
            return None
        return _to_session(row["payload"])

    def pop(self, session_id: str | None) -> KiteSession | None:
        if not session_id:
            return None
        with self._lock, self._conn:
            row = self._row(session_id)
            self._conn.execute("DELETE FROM kite_sessions WHERE session_id = ?", (session_id,))
        if row is None or time.time() - row["created_at"] > SESSION_TTL_SECONDS:
            return None
        return _to_session(row["payload"])

    def purge_expired(self) -> int:
        cutoff = time.time() - SESSION_TTL_SECONDS
        with self._lock, self._conn:
            return self._conn.execute(
                "DELETE FROM kite_sessions WHERE created_at < ?", (cutoff,)
            ).rowcount

    def __len__(self) -> int:
        with self._lock:
            return self._conn.execute("SELECT COUNT(*) FROM kite_sessions").fetchone()[0]


def _to_session(payload: str) -> KiteSession:
    data = json.loads(payload)
    data["exchanges"] = tuple(data.get("exchanges") or ())
    return KiteSession(**data)


def resolve_state_secret(configured: str, data_dir: str | Path) -> str:
    """The secret that signs OAuth state nonces.

    Explicit wins. Otherwise one is generated on first run and kept in a
    owner-only file, so a restart or a second worker signs and verifies the
    same way. A per-process secret broke every login that straddled a deploy.
    """
    if configured:
        return configured
    path = Path(data_dir) / "state_secret"
    if path.exists():
        existing = path.read_text(encoding="utf-8").strip()
        if existing:
            return existing
    path.parent.mkdir(parents=True, exist_ok=True)
    generated = secrets.token_urlsafe(32)
    path.touch(mode=0o600)
    path.write_text(generated, encoding="utf-8")
    os.chmod(path, 0o600)
    return generated
