"""One process serves the UI and the API; the API is never swallowed."""

from __future__ import annotations

from fastapi.testclient import TestClient

from tradepulse_server.app import create_app
from tradepulse_server.config import Settings


def build_dist(tmp_path):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><title>TradePulse</title><div id=root></div>")
    (dist / "assets" / "index-abc123.js").write_text("console.log('app')")
    (dist / "favicon.svg").write_text("<svg/>")
    return dist


def test_the_ui_and_its_assets_are_served(tmp_path):
    app = create_app(Settings(auth_required=False, intel_db_path=":memory:", state_secret="s",
                              static_dir=str(build_dist(tmp_path))))
    c = TestClient(app)
    assert app.state.serves_ui is True
    home = c.get("/")
    assert home.status_code == 200 and "<title>TradePulse" in home.text
    assert home.headers["cache-control"] == "no-cache"
    assert c.get("/assets/index-abc123.js").text == "console.log('app')"
    assert c.get("/favicon.svg").text == "<svg/>"


def test_deep_links_fall_back_to_the_page_but_api_paths_do_not(tmp_path):
    app = create_app(Settings(auth_required=False, intel_db_path=":memory:", state_secret="s",
                              static_dir=str(build_dist(tmp_path))))
    c = TestClient(app)
    assert "<title>TradePulse" in c.get("/portfolio/watchlist").text        # client-side route
    missing = c.get("/api/does-not-exist")
    assert missing.status_code == 404 and missing.json()["error_type"] == "NotFound"
    assert c.get("/api/auth/session").json()["authenticated"] is True     # real routes first
    assert c.get("/healthz").json()["ok"] is True


def test_paths_cannot_escape_the_static_dir(tmp_path):
    (tmp_path / "secret.txt").write_text("nope")
    app = create_app(Settings(auth_required=False, intel_db_path=":memory:", state_secret="s",
                              static_dir=str(build_dist(tmp_path))))
    c = TestClient(app)
    assert "nope" not in c.get("/../secret.txt").text
    assert "nope" not in c.get("/%2e%2e/secret.txt").text


def test_without_a_static_dir_nothing_changes():
    app = create_app(Settings(auth_required=False, intel_db_path=":memory:", state_secret="s"))
    assert app.state.serves_ui is False
    assert TestClient(app).get("/").status_code == 404
