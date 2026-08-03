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
    uvicorn.run(
        "tradepulse_server.app:app",
        host=settings.host,
        port=settings.port,
        reload=True,
    )


if __name__ == "__main__":
    main()
