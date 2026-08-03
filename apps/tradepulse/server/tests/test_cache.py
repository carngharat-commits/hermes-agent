"""The read cache in front of Kite."""

from __future__ import annotations

import asyncio

import pytest

from tradepulse_server.cache import TTLCache


def test_second_read_does_not_call_the_loader():
    cache = TTLCache(ttl=60)
    calls = []

    async def loader():
        calls.append(1)
        return {"value": len(calls)}

    first = asyncio.run(cache.fetch("k", loader))
    second = asyncio.run(cache.fetch("k", loader))

    assert first == second == {"value": 1}
    assert len(calls) == 1
    assert cache.hits == 1 and cache.misses == 1


def test_entries_expire():
    cache = TTLCache(ttl=0.01)
    calls = []

    async def loader():
        calls.append(1)
        return len(calls)

    assert asyncio.run(cache.fetch("k", loader)) == 1
    import time

    time.sleep(0.02)
    assert asyncio.run(cache.fetch("k", loader)) == 2


def test_a_failing_loader_is_not_cached():
    """A transient Kite error must not be replayed for the rest of the TTL."""
    cache = TTLCache(ttl=60)
    attempts = []

    async def flaky():
        attempts.append(1)
        if len(attempts) == 1:
            raise RuntimeError("kite blew up")
        return "ok"

    with pytest.raises(RuntimeError):
        asyncio.run(cache.fetch("k", flaky))
    assert asyncio.run(cache.fetch("k", flaky)) == "ok"
    assert len(attempts) == 2


def test_keys_are_independent():
    cache = TTLCache(ttl=60)

    async def loader(value):
        return value

    assert asyncio.run(cache.fetch("a", lambda: loader(1))) == 1
    assert asyncio.run(cache.fetch("b", lambda: loader(2))) == 2
    assert cache.get("a") == 1


def test_invalidate_prefix_drops_only_that_session():
    cache = TTLCache(ttl=60)
    cache.put("sess-a:/orders", ["a"])
    cache.put("sess-a:/portfolio/holdings", ["a"])
    cache.put("sess-b:/orders", ["b"])

    assert cache.invalidate_prefix("sess-a:") == 2
    assert cache.get("sess-a:/orders") is None
    assert cache.get("sess-b:/orders") == ["b"]


def test_len_ignores_expired_entries():
    cache = TTLCache(ttl=0.01)
    cache.put("k", 1)
    import time

    time.sleep(0.02)
    assert len(cache) == 0
