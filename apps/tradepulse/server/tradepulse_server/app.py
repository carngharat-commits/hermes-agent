"""FastAPI app exposing the Kite Connect login flow to the TradePulse UI.

Roadmap step 1 scope: authentication only. The portfolio routes at the bottom
are wired to the real API but the UI still renders its bundled snapshot — see
server/README.md for what step 2 has to replace.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode

from fastapi import Cookie, Depends, FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from .cache import TTLCache
from .config import Settings, load_settings
from .kite import KiteClient, KiteError, StubKiteClient
from .mapping import (
    map_gtts,
    map_holdings,
    map_margins,
    map_orders,
    map_positions,
    summarize,
)
from .sessions import SessionStore, issue_state, verify_state

STATE_PARAM = "tp_state"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    store = SessionStore()
    client: KiteClient = (
        KiteClient(settings.api_key, settings.api_secret)
        if settings.configured
        else StubKiteClient()
    )

    app = FastAPI(title="TradePulse Kite backend", version="0.1.0")
    app.state.settings = settings
    app.state.sessions = store
    app.state.kite = client
    app.state.cache = TTLCache()

    # The Vite dev server proxies /api, so the browser is same-origin in the
    # normal setup. CORS is here only for the case where the UI is served from
    # a different host; credentials are required either way for the cookie.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_url.rstrip("/")],
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )

    def current_settings() -> Settings:
        return app.state.settings

    def current_store() -> SessionStore:
        return app.state.sessions

    def current_client() -> KiteClient:
        return app.state.kite

    @app.exception_handler(KiteError)
    async def _kite_error(_: Request, exc: KiteError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status,
            content={"error": exc.message, "error_type": exc.error_type},
        )

    @app.get("/healthz")
    async def healthz(cfg: Settings = Depends(current_settings)) -> dict[str, Any]:
        return {
            "ok": True,
            "mode": "live" if cfg.configured else "stub",
            "sessions": len(app.state.sessions),
            "cache": {
                "entries": len(app.state.cache),
                "hits": app.state.cache.hits,
                "misses": app.state.cache.misses,
            },
        }

    @app.get("/api/kite/status")
    async def status(cfg: Settings = Depends(current_settings)) -> dict[str, Any]:
        """What the UI needs to decide whether to offer a Connect button."""
        return {
            "configured": cfg.configured,
            "mode": "live" if cfg.configured else "stub",
            "redirect_url": cfg.redirect_url,
        }

    @app.get("/api/kite/login")
    async def login(
        request: Request,
        cfg: Settings = Depends(current_settings),
        kite: KiteClient = Depends(current_client),
    ) -> RedirectResponse:
        """Step 1 — hand the browser to Kite (or to the stub's own callback)."""
        state = issue_state(cfg.state_secret)
        redirect_params = urlencode({STATE_PARAM: state})
        target = kite.login_url(redirect_params=redirect_params)
        if target.startswith("?"):  # stub mode: bounce back to our callback
            target = str(request.url_for("callback")) + target
        return RedirectResponse(target, status_code=307)

    @app.get("/api/kite/callback", name="callback")
    async def callback(
        request_token: str = Query("", alias="request_token"),
        status_param: str = Query("", alias="status"),
        state: str = Query("", alias=STATE_PARAM),
        cfg: Settings = Depends(current_settings),
        kite: KiteClient = Depends(current_client),
        store: SessionStore = Depends(current_store),
    ) -> RedirectResponse:
        """Step 2/3 — verify the round trip, then exchange the request token."""
        if not verify_state(cfg.state_secret, state):
            return _bounce(cfg, "state_mismatch")
        if status_param and status_param != "success":
            return _bounce(cfg, "login_cancelled")
        if not request_token:
            return _bounce(cfg, "missing_request_token")

        try:
            session = await kite.exchange_request_token(request_token)
        except KiteError as exc:
            return _bounce(cfg, "exchange_failed", detail=exc.message)

        session_id = store.create(session)
        response = _bounce(cfg, None)
        response.set_cookie(
            cfg.cookie_name,
            session_id,
            httponly=True,
            secure=cfg.cookie_secure,
            samesite=cfg.cookie_samesite,
            max_age=24 * 60 * 60,
            path="/",
        )
        return response

    @app.get("/api/kite/session")
    async def read_session(
        cfg: Settings = Depends(current_settings),
        store: SessionStore = Depends(current_store),
        session_cookie: str | None = Cookie(default=None, alias="tradepulse_session"),
    ) -> dict[str, Any]:
        session = store.get(session_cookie)
        if session is None:
            return {"authenticated": False, "mode": "live" if cfg.configured else "stub"}
        return {
            "authenticated": True,
            "mode": "live" if cfg.configured else "stub",
            "profile": session.public_view(),
        }

    @app.post("/api/kite/logout")
    async def logout(
        cfg: Settings = Depends(current_settings),
        store: SessionStore = Depends(current_store),
        kite: KiteClient = Depends(current_client),
        session_cookie: str | None = Cookie(default=None, alias="tradepulse_session"),
    ) -> JSONResponse:
        session = store.pop(session_cookie)
        if session is not None:
            await kite.invalidate(session.access_token)
        # Cached reads outlive the session otherwise, and a later login
        # reusing the id would serve the previous user's book.
        app.state.cache.invalidate_prefix(f"{session_cookie}:")
        response = JSONResponse({"authenticated": False})
        response.delete_cookie(cfg.cookie_name, path="/")
        return response

    @app.get("/api/kite/portfolio")
    async def portfolio(
        cfg: Settings = Depends(current_settings),
        store: SessionStore = Depends(current_store),
        kite: KiteClient = Depends(current_client),
        session_cookie: str | None = Cookie(default=None, alias="tradepulse_session"),
    ) -> Any:
        """Everything the UI needs to replace its Zerodha slice, in one call.

        Holdings are the load-bearing part; positions and margins are fetched
        alongside but must not sink the response if they fail, since a user
        with no F&O access gets an error on /portfolio/positions.
        """
        session = store.get(session_cookie)
        if session is None:
            return _unauthenticated()

        holdings = map_holdings(
            await _read(app, session_cookie, kite, session.access_token, "/portfolio/holdings")
        )

        extras: dict[str, Any] = {"positions": [], "margins": {}}
        partial: list[str] = []
        for label, path, mapper in (
            ("positions", "/portfolio/positions", map_positions),
            ("margins", "/user/margins", map_margins),
        ):
            try:
                raw = await _read(app, session_cookie, kite, session.access_token, path)
            except KiteError:
                partial.append(label)
                continue
            extras[label] = mapper(raw)

        return {
            "mode": "live" if cfg.configured else "stub",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "broker": "Zerodha",
            "holdings": holdings,
            "positions": extras["positions"],
            "margins": extras["margins"],
            "summary": summarize(holdings),
            # Names the UI can mention instead of silently showing less.
            "unavailable": partial,
        }

    @app.get("/api/kite/orders")
    async def orders(
        cfg: Settings = Depends(current_settings),
        store: SessionStore = Depends(current_store),
        kite: KiteClient = Depends(current_client),
        session_cookie: str | None = Cookie(default=None, alias="tradepulse_session"),
    ) -> Any:
        """The order book and GTT triggers, in the shapes the Orders tab reads.

        Same split as /portfolio: the order book is load-bearing, GTTs are
        best-effort — a Kite app without the GTT scope 403s on /gtt/triggers
        and the order book should still render.
        """
        session = store.get(session_cookie)
        if session is None:
            return _unauthenticated()

        order_rows = map_orders(
            await _read(app, session_cookie, kite, session.access_token, "/orders")
        )

        gtts: list[Any] = []
        partial: list[str] = []
        try:
            gtts = map_gtts(
                await _read(app, session_cookie, kite, session.access_token, "/gtt/triggers")
            )
        except KiteError:
            partial.append("gtt")

        return {
            "mode": "live" if cfg.configured else "stub",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
            "broker": "Zerodha",
            "orders": order_rows,
            "gtts": gtts,
            "unavailable": partial,
        }

    # ---- raw passthrough --------------------------------------------------
    # Unmapped Kite responses, kept for debugging a sync against what the API
    # actually returned. /api/kite/portfolio is what the UI consumes.
    for name, path in (
        ("holdings", "/portfolio/holdings"),
        ("positions", "/portfolio/positions"),
        ("margins", "/user/margins"),
    ):
        _mount_passthrough(app, name, path, current_store, current_client)

    return app


def _unauthenticated() -> JSONResponse:
    return JSONResponse(
        status_code=401,
        content={"error": "Not connected to Kite.", "error_type": "TokenException"},
    )


async def _read(app: FastAPI, session_id: str | None, kite: KiteClient,
                access_token: str, path: str) -> Any:
    """Cached Kite GET, scoped to the session so users never share a response."""
    return await app.state.cache.fetch(
        f"{session_id}:{path}", lambda: kite.get(path, access_token)
    )


def _mount_passthrough(app: FastAPI, name: str, kite_path: str, get_store, get_client) -> None:
    async def handler(
        store: SessionStore = Depends(get_store),
        kite: KiteClient = Depends(get_client),
        session_cookie: str | None = Cookie(default=None, alias="tradepulse_session"),
    ) -> Any:
        session = store.get(session_cookie)
        if session is None:
            return JSONResponse(
                status_code=401,
                content={"error": "Not connected to Kite.", "error_type": "TokenException"},
            )
        return {"data": await kite.get(kite_path, session.access_token)}

    handler.__name__ = f"kite_{name}"
    app.get(f"/api/kite/{name}")(handler)


def _bounce(cfg: Settings, error: str | None, *, detail: str = "") -> RedirectResponse:
    """Send the browser back to the UI, carrying any failure in the query."""
    target = cfg.frontend_url
    if error:
        params = {"kite_error": error}
        if detail:
            params["kite_detail"] = detail
        target = f"{target}{'&' if '?' in target else '?'}{urlencode(params)}"
    else:
        target = f"{target}{'&' if '?' in target else '?'}kite=connected"
    return RedirectResponse(target, status_code=303)


app = create_app()
