"""Sessions and secrets that survive a restart."""

from __future__ import annotations

import os
import stat
import time

from fastapi.testclient import TestClient

from tradepulse_server import config
from tradepulse_server.app import create_app
from tradepulse_server.config import Settings, load_settings
from tradepulse_server.kite import KiteSession
from tradepulse_server.persist import SqliteAuthStore, SqliteSessionStore, resolve_state_secret


def kite_session() -> KiteSession:
    return KiteSession(user_id="AB1234", user_name="Asha", access_token="tok-secret",
                       exchanges=("NSE", "BSE"))


# --- stores -----------------------------------------------------------------

def test_a_broker_session_survives_a_restart(tmp_path):
    path = tmp_path / "sessions.db"
    first = SqliteSessionStore(path)
    sid = first.create(kite_session())

    second = SqliteSessionStore(path)             # "the process came back"
    got = second.get(sid)
    assert got is not None and got.access_token == "tok-secret"
    assert got.exchanges == ("NSE", "BSE")         # tuple round-trips
    assert second.pop(sid).user_id == "AB1234"
    assert second.get(sid) is None


def test_an_account_and_its_login_survive_a_restart(tmp_path):
    path = tmp_path / "sessions.db"
    first = SqliteAuthStore(path)
    user = first.create_user("asha", "correct-horse-battery-9", "Asha Rao", role="owner")
    token = first.create(user)

    again = SqliteAuthStore(path)                 # "the process came back"
    assert again.get(token).user_name == "Asha Rao"
    assert again.verify("asha", "correct-horse-battery-9").id == user.id
    assert len(again) == 1
    again.pop(token)
    assert len(again) == 0


def test_expired_sessions_are_not_served(tmp_path, monkeypatch):
    store = SqliteSessionStore(tmp_path / "s.db")
    sid = store.create(kite_session())
    # Jump the clock a long way past the TTL, from the real now — not from
    # the monotonic clock, which is uptime and sits far below wall time.
    later = time.time() + 10**9
    monkeypatch.setattr(time, "time", lambda: later)
    assert store.get(sid) is None
    assert len(store) == 0


def test_the_sessions_file_is_owner_only(tmp_path):
    path = tmp_path / "sessions.db"
    SqliteSessionStore(path)
    assert stat.S_IMODE(os.stat(path).st_mode) == 0o600


def test_the_token_is_stored_but_never_in_a_response(tmp_path):
    app = create_app(Settings(auth_required=False, intel_db_path=":memory:",
                              state_secret="s", sessions_db_path=str(tmp_path / "s.db")))
    c = TestClient(app, follow_redirects=False)
    login = c.get("/api/kite/login")
    c.get(login.headers["location"])
    body = c.get("/api/kite/session")
    assert body.json()["authenticated"] is True
    assert "access_token" not in body.text
    assert "stub-access-token" not in body.text


# --- secrets ----------------------------------------------------------------

def test_state_secret_is_generated_once_and_reused(tmp_path):
    a = resolve_state_secret("", tmp_path)
    b = resolve_state_secret("", tmp_path)
    assert a == b and len(a) >= 32
    assert stat.S_IMODE(os.stat(tmp_path / "state_secret").st_mode) == 0o600


def test_an_explicit_state_secret_wins(tmp_path):
    assert resolve_state_secret("from-env", tmp_path) == "from-env"
    assert not (tmp_path / "state_secret").exists()


# --- defaults from the environment ----------------------------------------

def test_load_settings_persists_by_default(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADEPULSE_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("TRADEPULSE_SESSIONS_DB", raising=False)
    monkeypatch.delenv("TRADEPULSE_STATE_SECRET", raising=False)
    s = load_settings()
    assert s.sessions_db_path == str(tmp_path / "sessions.db")
    assert (tmp_path / "state_secret").exists()
    assert load_settings().state_secret == s.state_secret     # stable across "restarts"


def test_cookie_is_secure_unless_the_ui_is_local(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADEPULSE_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("TRADEPULSE_COOKIE_SECURE", raising=False)

    monkeypatch.setenv("TRADEPULSE_FRONTEND_URL", "http://127.0.0.1:5273/")
    assert load_settings().cookie_secure is False

    monkeypatch.setenv("TRADEPULSE_FRONTEND_URL", "https://tradepulse.example.com/")
    assert load_settings().cookie_secure is True

    monkeypatch.setenv("TRADEPULSE_COOKIE_SECURE", "false")    # explicit still wins
    assert load_settings().cookie_secure is False
