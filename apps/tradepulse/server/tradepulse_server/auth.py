"""The app's own login, separate from the broker's.

Until this existed only the Kite routes checked a session. Every other screen
— the book, the watchlist, the AI calls, the performance record — was open to
anyone who reached the URL. That is fine on localhost and a blocker anywhere
else, and the gap is easy to miss precisely because the broker connection
*looks* like the login.

Design, deliberately minimal:

* **One shared passcode**, from the environment. This is a single-user app and
  a passcode is the smallest thing that is actually a lock. Multi-user comes
  with a users table, not with this module growing.
* **Never silently open.** With auth required and no passcode configured, one
  is generated at startup and printed to the log, the way Jupyter does it. A
  forgotten variable then costs a copy-paste, not an open door.
* **Constant-time compare and a lockout**, so the passcode cannot be brute
  forced through the login route. Failures are counted per client address.
* **Opaque session token in an HttpOnly cookie.** The passcode itself is never
  stored in the browser.

Sessions live in process memory here, same as the Kite ones; step 5 moves
both behind a persistent store.
"""

from __future__ import annotations

import hmac
import logging
import secrets
import threading
import time
from dataclasses import dataclass

logger = logging.getLogger("tradepulse.auth")

AUTH_TTL_SECONDS = 7 * 24 * 60 * 60
MAX_FAILURES = 5
LOCKOUT_SECONDS = 15 * 60

# Reachable without a session. Everything else under /api needs one.
OPEN_PATHS = frozenset({"/healthz", "/api/auth/login", "/api/auth/session"})


@dataclass
class AuthSession:
    user_name: str
    created_at: float

    def expired(self, now: float | None = None) -> bool:
        return (now or time.time()) - self.created_at > AUTH_TTL_SECONDS


class AuthStore:
    """Opaque token -> who is logged in. Thread-safe; not process-safe."""

    def __init__(self) -> None:
        self._sessions: dict[str, AuthSession] = {}
        self._failures: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def create(self, user_name: str) -> str:
        token = secrets.token_urlsafe(32)
        with self._lock:
            self._sessions[token] = AuthSession(user_name=user_name, created_at=time.time())
        return token

    def get(self, token: str | None) -> AuthSession | None:
        if not token:
            return None
        with self._lock:
            session = self._sessions.get(token)
            if session is None:
                return None
            if session.expired():
                del self._sessions[token]
                return None
            return session

    def pop(self, token: str | None) -> AuthSession | None:
        if not token:
            return None
        with self._lock:
            return self._sessions.pop(token, None)

    # -- brute-force guard ---------------------------------------------------

    def locked_out(self, client: str, now: float | None = None) -> bool:
        now = now or time.time()
        with self._lock:
            recent = [t for t in self._failures.get(client, []) if now - t < LOCKOUT_SECONDS]
            self._failures[client] = recent
            return len(recent) >= MAX_FAILURES

    def record_failure(self, client: str, now: float | None = None) -> None:
        with self._lock:
            self._failures.setdefault(client, []).append(now or time.time())

    def clear_failures(self, client: str) -> None:
        with self._lock:
            self._failures.pop(client, None)

    def __len__(self) -> int:
        with self._lock:
            return len(self._sessions)


def passcode_matches(expected: str, supplied: str) -> bool:
    """Constant-time equality so the compare itself leaks nothing."""
    return bool(expected) and hmac.compare_digest(expected.encode(), supplied.encode())


def resolve_passcode(configured: str, *, required: bool) -> str:
    """The passcode this process will accept.

    Empty and required: mint one and say so loudly, rather than run open.
    """
    if configured or not required:
        return configured
    generated = secrets.token_urlsafe(9)
    logger.warning(
        "TRADEPULSE_PASSCODE is not set. Login is required, so a one-time "
        "passcode was generated for this process:\n\n    %s\n\n"
        "Set TRADEPULSE_PASSCODE to choose your own.", generated,
    )
    return generated
