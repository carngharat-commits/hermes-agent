"""The app's own login: accounts with a username and a password.

The first version of this was one shared passcode — the smallest thing that
is actually a lock. It did its job for one person and is not an account: no
name of its own, nothing to attach a book or a watchlist to, no way to add a
second person without handing over the same secret. This is the next size up.

* **Accounts.** A user has a username, a display name, a role and a password
  hash. The first account is created on first run from the sign-in screen
  and becomes the owner; the owner adds everyone else from Settings. There
  is no open sign-up, because a public URL with open sign-up is a spam
  target before it is a product.
* **Passwords are hashed** with PBKDF2-HMAC-SHA256 from the standard library
  — 600,000 iterations, a fresh 16-byte salt, constant-time compare. Nothing
  reversible is stored and nothing reversible is logged.
* **Lockout** after five failures, counted per client address *and* username,
  so one attacker cannot lock out everyone and one victim cannot be locked
  out from everywhere.
* **Sessions** are opaque tokens in an HttpOnly cookie, tied to a user id.

Storage is `persist.SqliteAuthStore`; this module holds the rules.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
import threading
import time
from dataclasses import dataclass

AUTH_TTL_SECONDS = 7 * 24 * 60 * 60
MAX_FAILURES = 5
LOCKOUT_SECONDS = 15 * 60

PBKDF2_ITERATIONS = 600_000
MIN_PASSWORD_LENGTH = 10
USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{2,31}$")

# Reachable without a session. Everything else under /api needs one.
OPEN_PATHS = frozenset({"/healthz", "/api/auth/login", "/api/auth/session", "/api/auth/setup"})

ROLES = ("owner", "member")


@dataclass(frozen=True)
class User:
    id: int
    username: str
    name: str
    role: str
    created_at: float

    def public_view(self) -> dict:
        return {"id": self.id, "username": self.username, "name": self.name, "role": self.role}


@dataclass
class AuthSession:
    user_id: int
    username: str
    user_name: str
    role: str
    created_at: float

    def expired(self, now: float | None = None) -> bool:
        return (now or time.time()) - self.created_at > AUTH_TTL_SECONDS

    @property
    def is_owner(self) -> bool:
        return self.role == "owner"

    def public_view(self) -> dict:
        return {"username": self.username, "name": self.user_name, "role": self.role}


# ----------------------------------------------------------------- passwords

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return "pbkdf2_sha256$%d$%s$%s" % (
        PBKDF2_ITERATIONS,
        base64.b64encode(salt).decode(),
        base64.b64encode(digest).decode(),
    )


def verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations, salt_b64, digest_b64 = stored.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(digest_b64)
    except (ValueError, TypeError):
        return False
    actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, int(iterations))
    return hmac.compare_digest(actual, expected)


def validate_username(username: str) -> str | None:
    if not USERNAME_RE.match(username):
        return ("Usernames are 3–32 characters: lowercase letters, digits, "
                "dots, dashes or underscores, starting with a letter or digit.")
    return None


def validate_password(password: str) -> str | None:
    if len(password) < MIN_PASSWORD_LENGTH:
        return f"Passwords need at least {MIN_PASSWORD_LENGTH} characters."
    if password.strip() != password:
        return "Passwords cannot start or end with a space."
    return None


def normalise_username(username: str) -> str:
    return username.strip().lower()


# ------------------------------------------------------------------- lockout

class LockoutGuard:
    """Brute-force brake. Counters are per process on purpose — they are a
    brake on one process's login route, not a record worth persisting."""

    def __init__(self) -> None:
        self._failures: dict[str, list[float]] = {}
        self._lock = threading.Lock()

    def locked_out(self, key: str, now: float | None = None) -> bool:
        now = now or time.time()
        with self._lock:
            recent = [t for t in self._failures.get(key, []) if now - t < LOCKOUT_SECONDS]
            self._failures[key] = recent
            return len(recent) >= MAX_FAILURES

    def record_failure(self, key: str, now: float | None = None) -> None:
        with self._lock:
            self._failures.setdefault(key, []).append(now or time.time())

    def clear(self, key: str) -> None:
        with self._lock:
            self._failures.pop(key, None)
