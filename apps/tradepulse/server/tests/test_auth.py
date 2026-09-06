"""Accounts: the lock in front of every /api route, now with names on it."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from tradepulse_server.app import create_app
from tradepulse_server.auth import MAX_FAILURES, hash_password, verify_password
from tradepulse_server.config import Settings

SETTINGS = Settings(
    frontend_url="http://127.0.0.1:5273/",
    state_secret="test-secret",
    intel_db_path=":memory:",
)

OWNER = {"username": "asha", "password": "correct-horse-battery-9", "name": "Asha Rao"}


@pytest.fixture
def client() -> TestClient:
    return TestClient(create_app(SETTINGS), follow_redirects=False)


@pytest.fixture
def owner(client: TestClient) -> TestClient:
    assert client.post("/api/auth/setup", json=OWNER).status_code == 200
    return client


GATED = ["/api/kite/status", "/api/kite/session", "/api/intel/coverage",
         "/api/intel/performance", "/api/quotes?symbols=TCS"]


@pytest.mark.parametrize("path", GATED)
def test_every_api_route_is_closed_without_a_login(client: TestClient, path: str):
    response = client.get(path)
    assert response.status_code == 401
    assert response.json()["error_type"] == "LoginRequired"


def test_a_fresh_install_asks_for_the_first_account(client: TestClient):
    assert client.get("/healthz").status_code == 200
    body = client.get("/api/auth/session").json()
    assert body == {"authenticated": False, "required": True, "setup_required": True}


def test_setup_creates_the_owner_and_signs_them_in(client: TestClient):
    response = client.post("/api/auth/setup", json=OWNER)
    assert response.status_code == 200
    assert response.json()["user"] == {"username": "asha", "name": "Asha Rao", "role": "owner"}
    assert "tradepulse_auth" in response.cookies
    assert client.get("/api/intel/coverage").status_code == 200
    session = client.get("/api/auth/session").json()
    assert session["authenticated"] is True and session["setup_required"] is False


def test_setup_only_ever_works_once(owner: TestClient):
    again = owner.post("/api/auth/setup", json={**OWNER, "username": "someone"})
    assert again.status_code == 409


def test_setup_validates_what_it_is_given(client: TestClient):
    assert client.post("/api/auth/setup", json={**OWNER, "username": "A!"}).status_code == 400
    assert client.post("/api/auth/setup", json={**OWNER, "password": "short"}).status_code == 400
    assert client.get("/api/auth/session").json()["setup_required"] is True   # nothing created


def test_login_with_the_right_password(owner: TestClient):
    owner.post("/api/auth/logout")
    assert owner.get("/api/intel/coverage").status_code == 401
    response = owner.post("/api/auth/login", json={"username": "ASHA ", "password": OWNER["password"]})
    assert response.status_code == 200                       # username is case-insensitive
    assert owner.get("/api/intel/coverage").status_code == 200


def test_login_with_the_wrong_password_or_name_is_the_same_refusal(owner: TestClient):
    owner.post("/api/auth/logout")
    bad_pw = owner.post("/api/auth/login", json={"username": "asha", "password": "nope-nope-nope"})
    bad_user = owner.post("/api/auth/login", json={"username": "ghost", "password": OWNER["password"]})
    assert bad_pw.status_code == bad_user.status_code == 401
    assert bad_pw.json()["error"] == bad_user.json()["error"]     # no username enumeration


def test_repeated_failures_lock_the_account_out(owner: TestClient):
    owner.post("/api/auth/logout")
    for _ in range(MAX_FAILURES):
        owner.post("/api/auth/login", json={"username": "asha", "password": "nope-nope-nope"})
    response = owner.post("/api/auth/login", json={"username": "asha", "password": OWNER["password"]})
    assert response.status_code == 429


def test_logout_closes_the_app_and_the_broker_together(owner: TestClient):
    login = owner.get("/api/kite/login")
    owner.get(login.headers["location"])                     # the stub redirects straight back
    assert owner.get("/api/kite/session").json()["authenticated"] is True

    owner.post("/api/auth/logout")

    assert owner.get("/api/auth/session").json()["authenticated"] is False
    assert owner.get("/api/kite/session").status_code == 401
    assert len(owner.app.state.sessions) == 0


def test_the_owner_adds_members_and_members_cannot(owner: TestClient):
    added = owner.post("/api/auth/users", json={"username": "ravi", "password": "another-long-one",
                                                 "name": "Ravi"})
    assert added.status_code == 200 and added.json()["user"]["role"] == "member"
    assert owner.post("/api/auth/users", json={"username": "ravi", "password": "another-long-one"}).status_code == 409
    assert [u["username"] for u in owner.get("/api/auth/users").json()["users"]] == ["asha", "ravi"]

    member = TestClient(owner.app, follow_redirects=False)
    member.post("/api/auth/login", json={"username": "ravi", "password": "another-long-one"})
    assert member.get("/api/intel/coverage").status_code == 200
    assert member.get("/api/auth/users").status_code == 403
    assert member.post("/api/auth/users", json={"username": "x", "password": "y"}).status_code == 403


def test_a_user_can_change_their_own_password(owner: TestClient):
    wrong = owner.post("/api/auth/password", json={"current": "wrong", "new": "brand-new-password"})
    assert wrong.status_code == 401
    ok = owner.post("/api/auth/password", json={"current": OWNER["password"], "new": "brand-new-password"})
    assert ok.status_code == 200
    owner.post("/api/auth/logout")
    assert owner.post("/api/auth/login", json={"username": "asha", "password": OWNER["password"]}).status_code == 401
    assert owner.post("/api/auth/login", json={"username": "asha", "password": "brand-new-password"}).status_code == 200


def test_passwords_are_hashed_and_never_in_a_response(owner: TestClient):
    stored = owner.app.state.auth._conn.execute("SELECT password_hash FROM users").fetchone()[0]
    assert stored.startswith("pbkdf2_sha256$600000$")
    assert OWNER["password"] not in stored
    assert verify_password(OWNER["password"], stored)
    assert not verify_password("wrong", stored)
    for path in ("/api/auth/session", "/api/auth/users"):
        assert OWNER["password"] not in owner.get(path).text


def test_hashes_are_salted():
    assert hash_password("same") != hash_password("same")


def test_auth_can_be_switched_off_only_explicitly():
    c = TestClient(create_app(Settings(auth_required=False, intel_db_path=":memory:", state_secret="s")))
    assert c.get("/api/intel/coverage").status_code == 200
    assert c.get("/api/auth/session").json()["required"] is False
