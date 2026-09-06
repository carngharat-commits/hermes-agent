"""Each user's book and watchlist live on the server, and only they see them."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tradepulse_server.app import create_app
from tradepulse_server.config import Settings
from tradepulse_server.persist import MAX_DOCUMENT_BYTES, SqliteUserDocuments


def test_documents_round_trip_and_replace_whole(tmp_path):
    docs = SqliteUserDocuments(tmp_path / "s.db")
    assert docs.get(1, "book") is None
    docs.put(1, "book", {"IN_STOCKS": [{"sym": "TCS"}]})
    docs.put(1, "book", {"IN_STOCKS": []})                  # replaced, not merged
    assert docs.get(1, "book")["data"] == {"IN_STOCKS": []}
    assert SqliteUserDocuments(tmp_path / "s.db").get(1, "book")["data"] == {"IN_STOCKS": []}


def test_documents_have_a_size_cap():
    docs = SqliteUserDocuments()
    with pytest.raises(ValueError):
        docs.put(1, "watchlist", {"photo": "x" * (MAX_DOCUMENT_BYTES + 1)})


@pytest.fixture
def app():
    return create_app(Settings(intel_db_path=":memory:", state_secret="s"))


def signed_in(app, username: str, *, first: bool) -> TestClient:
    c = TestClient(app, follow_redirects=False)
    creds = {"username": username, "password": "a-long-enough-password", "name": username.title()}
    if first:
        assert c.post("/api/auth/setup", json=creds).status_code == 200
    else:
        assert c.post("/api/auth/login", json=creds).status_code == 200
    return c


def test_users_see_only_their_own_documents(app):
    asha = signed_in(app, "asha", first=True)
    asha.post("/api/auth/users", json={"username": "ravi", "password": "a-long-enough-password", "name": "Ravi"})
    ravi = signed_in(app, "ravi", first=False)

    assert asha.get("/api/me/book").json()["data"] is None
    asha.put("/api/me/book", json={"data": {"IN_STOCKS": [{"sym": "TCS", "qty": 5}]}})
    asha.put("/api/me/watchlist", json={"data": [{"id": "1", "sym": "INFY", "target": 1500}]})

    assert asha.get("/api/me/book").json()["data"]["IN_STOCKS"][0]["sym"] == "TCS"
    assert asha.get("/api/me/watchlist").json()["data"][0]["sym"] == "INFY"
    assert ravi.get("/api/me/book").json()["data"] is None                 # not Asha's
    assert ravi.get("/api/me/watchlist").json()["data"] is None


def test_documents_are_behind_the_login_and_named(app):
    anon = TestClient(app)
    assert anon.get("/api/me/book").status_code == 401
    asha = signed_in(app, "asha", first=True)
    assert asha.get("/api/me/diary").status_code == 404
    assert asha.put("/api/me/book", json={"nope": 1}).status_code == 400
    assert asha.put("/api/me/book", json={"data": {"x": "y" * (MAX_DOCUMENT_BYTES + 1)}}).status_code == 413
