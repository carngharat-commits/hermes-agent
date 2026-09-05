"""Runtime configuration for the TradePulse Kite backend.

Everything is read from the environment so no credential ever lands in the
repo. See ``.env.example`` at the app root for the full list.
"""

from __future__ import annotations

import os
from pathlib import Path
import secrets
from dataclasses import dataclass, field


def _flag(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    """Resolved settings for one process."""

    api_key: str = ""
    api_secret: str = ""

    # Where Kite sends the browser after login. Must match the redirect URL
    # registered on the Kite developer console, byte for byte.
    redirect_url: str = "http://127.0.0.1:5273/api/kite/callback"

    # Where the callback bounces the browser once a session exists.
    frontend_url: str = "http://127.0.0.1:5273/"

    cookie_name: str = "tradepulse_session"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    # The app's own login. Required by default; tests opt out explicitly so
    # that a forgotten variable can never quietly leave a deployment open.
    auth_required: bool = True
    passcode: str = ""
    auth_cookie_name: str = "tradepulse_auth"
    # Shown in the sidebar once logged in. A single-user app has one name.
    user_name: str = "Investor"

    # The AI chat drawer. Unset means the drawer says so rather than failing;
    # the key lives here and only here — the browser never sees it.
    anthropic_api_key: str = ""
    ai_model: str = "claude-opus-5"

    # Quotes without a broker: any JSON endpoint with a URL template and a
    # dotted path to the price. Unset means stub quotes, labelled as such.
    quotes_url: str = ""
    quotes_price_path: str = "price"
    quotes_change_path: str = ""
    quotes_auth_header: str = ""

    host: str = "127.0.0.1"
    port: int = 8787

    # Where the intelligence store lives. Defaults to a file: the whole point
    # of the recommendation record is that it outlives the process, and an
    # in-memory default silently made the performance and learning loops
    # unable to accumulate anything. Tests pass ":memory:" explicitly.
    intel_db_path: str = "data/tradepulse.db"

    # How often the orchestrator runs a full cycle. 0 disables the scheduler.
    intel_cycle_seconds: int = 900

    # Signs the OAuth state nonce. `load_settings` resolves an unset value to
    # a secret persisted under the data directory, so restarts and extra
    # workers sign and verify the same way; the random default here is for
    # settings built directly in tests.
    state_secret: str = field(default_factory=lambda: secrets.token_urlsafe(32))

    # Where login and broker sessions live. In memory by default for settings
    # built directly (tests); `load_settings` points it at a file so a
    # restart no longer logs everyone out.
    sessions_db_path: str = ":memory:"

    @property
    def configured(self) -> bool:
        """True when real Kite credentials are present.

        When false the app serves the same routes against a local stub so the
        whole redirect dance is exercisable without a Zerodha developer app.
        """
        return bool(self.api_key and self.api_secret)


def _is_local(url: str) -> bool:
    host = url.split("//", 1)[-1].split("/", 1)[0].split(":", 1)[0].lower()
    return host in {"localhost", "127.0.0.1", "::1", "0.0.0.0"}


def load_settings() -> Settings:
    from .persist import resolve_state_secret

    frontend_url = os.environ.get("TRADEPULSE_FRONTEND_URL", "http://127.0.0.1:5273/").strip()
    data_dir = os.environ.get("TRADEPULSE_DATA_DIR", "data").strip() or "data"
    return Settings(
        api_key=os.environ.get("KITE_API_KEY", "").strip(),
        api_secret=os.environ.get("KITE_API_SECRET", "").strip(),
        redirect_url=os.environ.get(
            "KITE_REDIRECT_URL", "http://127.0.0.1:5273/api/kite/callback"
        ).strip(),
        frontend_url=frontend_url,
        cookie_name=os.environ.get("TRADEPULSE_COOKIE_NAME", "tradepulse_session"),
        # Secure unless the UI is served from this machine. An explicit
        # variable still wins, but the default no longer leaves a public
        # deployment sending its session cookie over plain HTTP.
        cookie_secure=_flag("TRADEPULSE_COOKIE_SECURE", not _is_local(frontend_url)),
        cookie_samesite=os.environ.get("TRADEPULSE_COOKIE_SAMESITE", "lax"),
        auth_required=_flag("TRADEPULSE_AUTH_REQUIRED", True),
        passcode=os.environ.get("TRADEPULSE_PASSCODE", "").strip(),
        auth_cookie_name=os.environ.get("TRADEPULSE_AUTH_COOKIE_NAME", "tradepulse_auth"),
        user_name=os.environ.get("TRADEPULSE_USER_NAME", "Investor").strip() or "Investor",
        anthropic_api_key=os.environ.get("ANTHROPIC_API_KEY", "").strip(),
        ai_model=os.environ.get("TRADEPULSE_AI_MODEL", "claude-opus-5").strip() or "claude-opus-5",
        quotes_url=os.environ.get("TRADEPULSE_QUOTES_URL", "").strip(),
        quotes_price_path=os.environ.get("TRADEPULSE_QUOTES_PRICE_PATH", "price").strip() or "price",
        quotes_change_path=os.environ.get("TRADEPULSE_QUOTES_CHANGE_PATH", "").strip(),
        quotes_auth_header=os.environ.get("TRADEPULSE_QUOTES_AUTH_HEADER", "").strip(),
        host=os.environ.get("TRADEPULSE_HOST", "127.0.0.1"),
        port=int(os.environ.get("TRADEPULSE_PORT", "8787")),
        intel_db_path=os.environ.get("TRADEPULSE_INTEL_DB", "data/tradepulse.db").strip(),
        intel_cycle_seconds=int(os.environ.get("TRADEPULSE_CYCLE_SECONDS", "900")),
        state_secret=resolve_state_secret(
            os.environ.get("TRADEPULSE_STATE_SECRET", "").strip(), data_dir
        ),
        sessions_db_path=os.environ.get(
            "TRADEPULSE_SESSIONS_DB", str(Path(data_dir) / "sessions.db")
        ).strip(),
    )
