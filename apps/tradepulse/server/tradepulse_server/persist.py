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

from .auth import (
    AUTH_TTL_SECONDS, ROLES, AuthSession, LockoutGuard, User, hash_password,
    normalise_username, verify_password,
)
from .kite import KiteSession
from .sessions import SESSION_TTL_SECONDS

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    name          TEXT NOT NULL,
    role          TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at    REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS login_sessions (
    token       TEXT PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at  REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS kite_sessions (
    session_id  TEXT PRIMARY KEY,
    payload     TEXT NOT NULL,
    created_at  REAL NOT NULL
);
-- Per-user documents: the book, the watchlist. JSON, replaced whole.
CREATE TABLE IF NOT EXISTS user_documents (
    user_id     INTEGER NOT NULL,
    name        TEXT NOT NULL,
    payload     TEXT NOT NULL,
    updated_at  REAL NOT NULL,
    PRIMARY KEY (user_id, name)
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
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA)
    return conn


def _user(row: sqlite3.Row) -> User:
    return User(id=row["id"], username=row["username"], name=row["name"],
                role=row["role"], created_at=row["created_at"])


class SqliteAuthStore:
    """Accounts and login sessions, on disk."""

    def __init__(self, path: str | Path = ":memory:") -> None:
        self._conn = _open(path)
        self._lock = threading.Lock()
        self.lockout = LockoutGuard()

    # -- users --------------------------------------------------------------

    def user_count(self) -> int:
        with self._lock:
            return self._conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]

    def users(self) -> list[User]:
        with self._lock:
            rows = self._conn.execute("SELECT * FROM users ORDER BY id").fetchall()
        return [_user(r) for r in rows]

    def find_user(self, username: str) -> User | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM users WHERE username = ?", (normalise_username(username),)
            ).fetchone()
        return None if row is None else _user(row)

    def get_user(self, user_id: int) -> User | None:
        with self._lock:
            row = self._conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return None if row is None else _user(row)

    def create_user(self, username: str, password: str, name: str, role: str = "member") -> User:
        if role not in ROLES:
            raise ValueError(f"unknown role {role!r}")
        username = normalise_username(username)
        with self._lock, self._conn:
            cursor = self._conn.execute(
                "INSERT INTO users (username, name, role, password_hash, created_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (username, name.strip() or username, role, hash_password(password), time.time()),
            )
            row = self._conn.execute("SELECT * FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()
        return _user(row)

    def verify(self, username: str, password: str) -> User | None:
        """The user if the password is right; None either way otherwise.

        The hash is checked even when the username is unknown, so the route
        takes the same time for a bad name as for a bad password.
        """
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM users WHERE username = ?", (normalise_username(username),)
            ).fetchone()
        stored = row["password_hash"] if row is not None else _DUMMY_HASH
        ok = verify_password(password, stored)
        return _user(row) if (ok and row is not None) else None

    def set_password(self, user_id: int, password: str) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                "UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(password), user_id)
            )

    def delete_user(self, user_id: int) -> bool:
        with self._lock, self._conn:
            return self._conn.execute("DELETE FROM users WHERE id = ?", (user_id,)).rowcount > 0

    # -- sessions -----------------------------------------------------------

    def create(self, user: User) -> str:
        token = secrets.token_urlsafe(32)
        with self._lock, self._conn:
            self._conn.execute(
                "INSERT INTO login_sessions (token, user_id, created_at) VALUES (?, ?, ?)",
                (token, user.id, time.time()),
            )
        return token

    def get(self, token: str | None) -> AuthSession | None:
        if not token:
            return None
        with self._lock:
            row = self._conn.execute(
                "SELECT s.created_at, u.id, u.username, u.name, u.role FROM login_sessions s "
                "JOIN users u ON u.id = s.user_id WHERE s.token = ?", (token,)
            ).fetchone()
        if row is None:
            return None
        session = AuthSession(user_id=row["id"], username=row["username"], user_name=row["name"],
                              role=row["role"], created_at=row["created_at"])
        if session.expired():
            self.pop(token)
            return None
        return session

    def pop(self, token: str | None) -> bool:
        if not token:
            return False
        with self._lock, self._conn:
            return self._conn.execute(
                "DELETE FROM login_sessions WHERE token = ?", (token,)
            ).rowcount > 0

    def purge_expired(self) -> int:
        cutoff = time.time() - AUTH_TTL_SECONDS
        with self._lock, self._conn:
            return self._conn.execute(
                "DELETE FROM login_sessions WHERE created_at < ?", (cutoff,)
            ).rowcount

    def __len__(self) -> int:
        with self._lock:
            return self._conn.execute("SELECT COUNT(*) FROM login_sessions").fetchone()[0]


# A hash to verify against when the username is unknown, so timing does not
# reveal which usernames exist.
_DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


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


# ------------------------------------------------------------ user documents

DOCUMENT_NAMES = frozenset({"book", "watchlist"})
MAX_DOCUMENT_BYTES = 4 * 1024 * 1024      # watchlist photos are data URLs


class SqliteUserDocuments:
    """A user's book and watchlist, on the server rather than in one browser.

    Until this existed both lived in localStorage, which meant a second device
    saw an empty app and a shared device showed the last person's book to the
    next. Documents are small JSON blobs replaced whole; nothing here needs
    row-level merging, and versioning them would be machinery without a
    problem to solve.
    """

    def __init__(self, path: str | Path = ":memory:") -> None:
        self._conn = _open(path)
        self._lock = threading.Lock()

    def get(self, user_id: int, name: str) -> dict | None:
        with self._lock:
            row = self._conn.execute(
                "SELECT payload, updated_at FROM user_documents WHERE user_id = ? AND name = ?",
                (user_id, name),
            ).fetchone()
        if row is None:
            return None
        return {"name": name, "data": json.loads(row["payload"]), "updated_at": row["updated_at"]}

    def put(self, user_id: int, name: str, data) -> dict:
        payload = json.dumps(data, separators=(",", ":"))
        if len(payload.encode()) > MAX_DOCUMENT_BYTES:
            raise ValueError(f"{name} is larger than {MAX_DOCUMENT_BYTES // (1024 * 1024)} MB")
        now = time.time()
        with self._lock, self._conn:
            self._conn.execute(
                "INSERT INTO user_documents (user_id, name, payload, updated_at) VALUES (?, ?, ?, ?) "
                "ON CONFLICT (user_id, name) DO UPDATE SET payload = excluded.payload, "
                "updated_at = excluded.updated_at",
                (user_id, name, payload, now),
            )
        return {"name": name, "data": data, "updated_at": now}

    def delete(self, user_id: int, name: str) -> bool:
        with self._lock, self._conn:
            return self._conn.execute(
                "DELETE FROM user_documents WHERE user_id = ? AND name = ?", (user_id, name)
            ).rowcount > 0
