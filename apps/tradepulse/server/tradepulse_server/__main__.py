"""`python -m tradepulse_server` — run the dev server."""

from __future__ import annotations

import uvicorn

from .config import load_settings


def main() -> None:
    settings = load_settings()
    if not settings.configured:
        print(
            "KITE_API_KEY / KITE_API_SECRET are unset — serving the Kite stub. "
            "The login redirect works end to end; portfolio routes return 501."
        )
    if settings.static_dir:
        print(f"Serving the UI from {settings.static_dir} on http://{settings.host}:{settings.port}/")
    uvicorn.run(
        "tradepulse_server.app:app",
        host=settings.host,
        port=settings.port,
        reload=settings.reload,
        # Behind Caddy or nginx the client address arrives in X-Forwarded-For;
        # the lockout counters and the cookie's Secure flag rely on it.
        proxy_headers=True,
        forwarded_allow_ips="*",
    )


if __name__ == "__main__":
    main()
