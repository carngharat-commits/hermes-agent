"""A short-TTL read cache in front of Kite.

Kite publishes per-endpoint rate limits, and every page load in the UI fans out
to several endpoints. Without this, opening two tabs or hitting refresh a few
times is enough to start collecting 429s on a single account.

Deliberately small: read-through, per (session, path), no invalidation beyond
expiry, and it never caches an error. Holdings and orders do not change often
enough for a few seconds of staleness to matter, and the alternative — a real
cache with keys the app has to remember to bust — buys nothing yet.

STUB: in-process, like SessionStore. It shares that module's fate when this
grows past one worker.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

DEFAULT_TTL_SECONDS = 15.0


@dataclass
class _Entry:
    value: Any
    expires_at: float


class TTLCache:
    """Read-through cache keyed by an opaque string."""

    def __init__(self, ttl: float = DEFAULT_TTL_SECONDS):
        self.ttl = ttl
        self._entries: dict[str, _Entry] = {}
        self._lock = threading.Lock()
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> Any | None:
        now = time.monotonic()
        with self._lock:
            entry = self._entries.get(key)
            if entry is None or entry.expires_at <= now:
                if entry is not None:
                    del self._entries[key]
                self.misses += 1
                return None
            self.hits += 1
            return entry.value

    def put(self, key: str, value: Any) -> None:
        with self._lock:
            self._entries[key] = _Entry(value, time.monotonic() + self.ttl)

    async def fetch(self, key: str, loader: Callable[[], Awaitable[Any]]) -> Any:
        """Return the cached value, or await ``loader`` and cache what it gives.

        A raising loader is not cached: a transient Kite error must not be
        replayed for the rest of the TTL.
        """
        cached = self.get(key)
        if cached is not None:
            return cached
        value = await loader()
        self.put(key, value)
        return value

    def invalidate_prefix(self, prefix: str) -> int:
        """Drop everything for one session — used on logout."""
        with self._lock:
            dead = [k for k in self._entries if k.startswith(prefix)]
            for key in dead:
                del self._entries[key]
        return len(dead)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()

    def __len__(self) -> int:
        now = time.monotonic()
        with self._lock:
            return sum(1 for e in self._entries.values() if e.expires_at > now)
