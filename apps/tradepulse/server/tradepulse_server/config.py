"""Runtime configuration for the TradePulse Kite backend.

Everything is read from the environment so no credential ever lands in the
repo. See ``.env.example`` at the app root for the full list.
"""

from __future__ import annotations

import os
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

    host: str = "127.0.0.1"
    port: int = 8787

    # Where the intelligence store lives. ":memory:" keeps a run
    # self-contained; point it at a file to keep recommendation history,
    # which the performance and learning loops need to mean anything.
    intel_db_path: str = ":memory:"

    # Signs the OAuth state nonce. Generated per process when unset, which is
    # fine for a single dev instance but means restarts invalidate in-flight
    # logins — set it explicitly once you run more than one worker.
    state_secret: str = field(default_factory=lambda: secrets.token_urlsafe(32))

    @property
    def configured(self) -> bool:
        """True when real Kite credentials are present.

        When false the app serves the same routes against a local stub so the
        whole redirect dance is exercisable without a Zerodha developer app.
        """
        return bool(self.api_key and self.api_secret)


def load_settings() -> Settings:
    return Settings(
        api_key=os.environ.get("KITE_API_KEY", "").strip(),
        api_secret=os.environ.get("KITE_API_SECRET", "").strip(),
        redirect_url=os.environ.get(
            "KITE_REDIRECT_URL", "http://127.0.0.1:5273/api/kite/callback"
        ).strip(),
        frontend_url=os.environ.get(
            "TRADEPULSE_FRONTEND_URL", "http://127.0.0.1:5273/"
        ).strip(),
        cookie_name=os.environ.get("TRADEPULSE_COOKIE_NAME", "tradepulse_session"),
        cookie_secure=_flag("TRADEPULSE_COOKIE_SECURE", False),
        cookie_samesite=os.environ.get("TRADEPULSE_COOKIE_SAMESITE", "lax"),
        host=os.environ.get("TRADEPULSE_HOST", "127.0.0.1"),
        port=int(os.environ.get("TRADEPULSE_PORT", "8787")),
        intel_db_path=os.environ.get("TRADEPULSE_INTEL_DB", ":memory:").strip(),
        state_secret=os.environ.get("TRADEPULSE_STATE_SECRET", "")
        or secrets.token_urlsafe(32),
    )
