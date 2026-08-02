"""Session storage and the OAuth state nonce.

STUB: sessions live in this process's memory, so a restart logs everyone out
and a second worker sees none of the first one's sessions. Before this runs
anywhere real, back ``SessionStore`` with Redis or a table — the interface
below is deliberately small enough to swap.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import threading
import time
from dataclasses import dataclass

from .kite import KiteSession

# Kite access tokens die at ~6am IST daily; nothing is gained by holding a
# session past that, so cap it at a day and let the API's 403 handle the rest.
SESSION_TTL_SECONDS = 24 * 60 * 60
STATE_TTL_SECONDS = 10 * 60


@dataclass
class StoredSession:
    kite: KiteSession
    created_at: float

    def expired(self, now: float | None = None) -> bool:
        return (now or time.time()) - self.created_at > SESSION_TTL_SECONDS


class SessionStore:
    """Opaque-id -> Kite session. Thread-safe; not process-safe."""

    def __init__(self) -> None:
        self._sessions: dict[str, StoredSession] = {}
        self._lock = threading.Lock()

    def create(self, kite: KiteSession) -> str:
        session_id = secrets.token_urlsafe(32)
        with self._lock:
            self._sessions[session_id] = StoredSession(kite=kite, created_at=time.time())
        return session_id

    def get(self, session_id: str | None) -> KiteSession | None:
        if not session_id:
            return None
        with self._lock:
            stored = self._sessions.get(session_id)
            if stored is None:
                return None
            if stored.expired():
                del self._sessions[session_id]
                return None
            return stored.kite

    def pop(self, session_id: str | None) -> KiteSession | None:
        if not session_id:
            return None
        with self._lock:
            stored = self._sessions.pop(session_id, None)
        return None if stored is None or stored.expired() else stored.kite

    def purge_expired(self) -> int:
        now = time.time()
        with self._lock:
            dead = [k for k, v in self._sessions.items() if v.expired(now)]
            for key in dead:
                del self._sessions[key]
        return len(dead)

    def __len__(self) -> int:
        with self._lock:
            return len(self._sessions)


def issue_state(secret: str) -> str:
    """Mint a signed, time-boxed nonce to carry through the Kite redirect.

    Kite has no ``state`` parameter, but it echoes ``redirect_params`` back on
    the callback — good enough to bind a callback to a login this app started,
    which is what stops a stray request_token from minting a session here.
    """
    nonce = secrets.token_urlsafe(16)
    issued = str(int(time.time()))
    signature = _sign(secret, f"{nonce}.{issued}")
    return f"{nonce}.{issued}.{signature}"


def verify_state(secret: str, state: str | None) -> bool:
    if not state:
        return False
    parts = state.split(".")
    if len(parts) != 3:
        return False
    nonce, issued, signature = parts
    if not hmac.compare_digest(signature, _sign(secret, f"{nonce}.{issued}")):
        return False
    try:
        age = time.time() - int(issued)
    except ValueError:
        return False
    return 0 <= age <= STATE_TTL_SECONDS


def _sign(secret: str, payload: str) -> str:
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
