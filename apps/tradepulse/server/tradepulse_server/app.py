"""FastAPI app exposing the Kite Connect login flow to the TradePulse UI.

Roadmap step 1 scope: authentication only. The portfolio routes at the bottom
are wired to the real API but the UI still renders its bundled snapshot — see
server/README.md for what step 2 has to replace.
"""

from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode

from fastapi import Cookie, Depends, FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse

from .cache import TTLCache
from .config import Settings, load_settings
from .intel.agents import DETERMINISTIC_AGENTS, PENDING_AGENTS
from .intel.orchestrator import Orchestrator
from .intel.prices import PriceFeed
from .intel.scheduler import CycleScheduler
from .intel.service import IntelService
from .intel.store import IntelStore
from .kite import KiteClient, KiteError, StubKiteClient
from .mapping import (
    map_gtts,
    map_holdings,
    map_margins,
    map_orders,
    map_positions,
    summarize,
)
from .ai import AIChat, build_client
from .auth import (
    OPEN_PATHS, AuthSession, validate_password, validate_username,
)
from .persist import DOCUMENT_NAMES, SqliteAuthStore, SqliteSessionStore, SqliteUserDocuments
from .quotes import QuotePriceSource, QuoteService, build_http_provider
from .static import mount_ui
from .sessions import SessionStore, issue_state, verify_state

STATE_PARAM = "tp_state"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    store = SqliteSessionStore(settings.sessions_db_path)
    client: KiteClient = (
        KiteClient(settings.api_key, settings.api_secret)
        if settings.configured
        else StubKiteClient()
    )


    @asynccontextmanager
    async def lifespan(_: FastAPI):
        app.state.scheduler.start()
        try:
            yield
        finally:
            # Awaited, so a cycle in flight unwinds rather than being abandoned
            # part-way through a write.
            await app.state.scheduler.stop()

    app = FastAPI(title="TradePulse Kite backend", version="0.1.0", lifespan=lifespan)
    app.state.settings = settings
    app.state.sessions = store
    app.state.auth = SqliteAuthStore(settings.sessions_db_path)
    app.state.documents = SqliteUserDocuments(settings.sessions_db_path)
    app.state.ai = AIChat(build_client(settings.anthropic_api_key), settings.ai_model)
    app.state.kite = client
    app.state.cache = TTLCache()
    # The intelligence store outlives the process when a path is set; the
    # default in-memory database keeps tests and demos self-contained.
    app.state.intel = IntelService(store=IntelStore(settings.intel_db_path))
    app.state.orchestrator = Orchestrator(app.state.intel)
    http_quotes = build_http_provider(
        settings.quotes_url, settings.quotes_price_path,
        settings.quotes_change_path, settings.quotes_auth_header,
    )
    app.state.prices = PriceFeed(
        app.state.intel.store, client,
        fallback=QuotePriceSource(http_quotes) if http_quotes else None,
    )
    app.state.quotes = QuoteService(app.state.prices, http_quotes, app.state.intel.store)

    async def refresh_cycle_inputs() -> dict[str, float]:
        """Quote the covered book so the next cycle has something current."""
        symbols = app.state.intel.covered_symbols()
        prices = await app.state.prices.quote(symbols)
        app.state.cycle_prices = prices
        return prices

    app.state.refresh_cycle_inputs = refresh_cycle_inputs

    def holdings_for_cycle() -> list[dict[str, Any]]:
        """The owner's book, flattened to what the agents read.

        Before the book lived on the server the cycle ran with no holdings
        at all, so every portfolio brake abstained and the unattended calls
        — which supersede the ones made from the UI — carried no portfolio
        context. The explanation drawer then had nothing to say about the
        book. A cycle must reason over the same holdings the user sees.
        """
        if app.state.cycle_holdings:
            return app.state.cycle_holdings          # set explicitly by /api/intel/run
        doc = app.state.documents.owner_document(app.state.auth, "book")
        book = ((doc or {}).get("data") or {}).get("book") or {}
        rows: list[dict[str, Any]] = []
        for segment_rows in book.values():
            for row in segment_rows or []:
                sym = str(row.get("sym") or "").upper()
                if sym and float(row.get("qty") or 0) > 0:
                    rows.append({"sym": sym, "qty": float(row.get("qty") or 0),
                                 "ltp": float(row.get("ltp") or 0)})
        return rows

    def cycle_context() -> dict[str, Any]:
        """Read at fire time, not at startup, so each cycle sees today's state."""
        return {
            "prices": app.state.cycle_prices,
            "holdings": holdings_for_cycle(),
            "refresh": app.state.refresh_cycle_inputs,
        }

    app.state.cycle_prices = {}
    app.state.cycle_holdings = []
    app.state.scheduler = CycleScheduler(
        app.state.orchestrator, settings.intel_cycle_seconds, context=cycle_context
    )

    # The Vite dev server proxies /api, so the browser is same-origin in the
    # normal setup. CORS is here only for the case where the UI is served from
    # a different host; credentials are required either way for the cookie.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_url.rstrip("/")],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def require_login(request: Request, call_next):
        """Every /api route needs the app's own session, bar the login itself.

        The broker session is not enough: it proves a Zerodha login, not
        that this person may use this deployment. And most screens never
        touch the broker at all.
        """
        cfg: Settings = app.state.settings
        path = request.url.path
        if not cfg.auth_required or path in OPEN_PATHS or not path.startswith("/api/"):
            return await call_next(request)
        token = request.cookies.get(cfg.auth_cookie_name)
        if app.state.auth.get(token) is None:
            return JSONResponse(
                status_code=401,
                content={"error": "Sign in to TradePulse first.", "error_type": "LoginRequired"},
            )
        return await call_next(request)

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

    # -- the app's own login ------------------------------------------------

    def _client_address(request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _current_user(request: Request) -> AuthSession | None:
        cfg: Settings = app.state.settings
        if not cfg.auth_required:
            # The lock is off: everyone is the owner. Tests and nothing else.
            return AuthSession(user_id=0, username="local", user_name="Investor",
                               role="owner", created_at=0.0)
        return app.state.auth.get(request.cookies.get(cfg.auth_cookie_name))

    def _signed_in(session: AuthSession, cfg: Settings) -> JSONResponse:
        token = app.state.auth.create(app.state.auth.get_user(session.user_id))
        response = JSONResponse({"authenticated": True, "required": True,
                                 "setup_required": False, "user": session.public_view()})
        response.set_cookie(
            cfg.auth_cookie_name, token, httponly=True, secure=cfg.cookie_secure,
            samesite=cfg.cookie_samesite, max_age=7 * 24 * 60 * 60, path="/",
        )
        return response

    def _bad(status: int, message: str, error_type: str) -> JSONResponse:
        return JSONResponse(status_code=status, content={"error": message, "error_type": error_type})

    def _session_for(user) -> AuthSession:
        import time as _time
        return AuthSession(user_id=user.id, username=user.username, user_name=user.name,
                           role=user.role, created_at=_time.time())

    @app.get("/api/auth/session")
    async def auth_session(request: Request, cfg: Settings = Depends(current_settings)) -> dict[str, Any]:
        if not cfg.auth_required:
            return {"authenticated": True, "required": False, "setup_required": False,
                    "user": _current_user(request).public_view()}
        setup_required = app.state.auth.user_count() == 0
        session = app.state.auth.get(request.cookies.get(cfg.auth_cookie_name))
        if session is None:
            return {"authenticated": False, "required": True, "setup_required": setup_required}
        return {"authenticated": True, "required": True, "setup_required": False,
                "user": session.public_view()}

    @app.post("/api/auth/setup")
    async def auth_setup(payload: dict[str, Any], cfg: Settings = Depends(current_settings)) -> Any:
        """Create the first account. Only ever works once."""
        if app.state.auth.user_count() > 0:
            return _bad(409, "An account already exists. Sign in, or ask the owner to add you.",
                        "SetupDone")
        username = str(payload.get("username") or "").strip().lower()
        password = str(payload.get("password") or "")
        name = str(payload.get("name") or "").strip()[:60]
        problem = validate_username(username) or validate_password(password)
        if problem:
            return _bad(400, problem, "Invalid")
        user = app.state.auth.create_user(username, password, name or username, role="owner")
        return _signed_in(_session_for(user), cfg)

    @app.post("/api/auth/login")
    async def auth_login(request: Request, payload: dict[str, Any],
                         cfg: Settings = Depends(current_settings)) -> Any:
        username = str(payload.get("username") or "").strip().lower()
        password = str(payload.get("password") or "")
        guard = app.state.auth.lockout
        keys = (f"ip:{_client_address(request)}", f"user:{username}")
        if any(guard.locked_out(k) for k in keys):
            return _bad(429, "Too many attempts. Try again in 15 minutes.", "LockedOut")
        user = app.state.auth.verify(username, password)
        if user is None:
            for k in keys:
                guard.record_failure(k)
            return _bad(401, "That username and password don't match.", "BadCredentials")
        for k in keys:
            guard.clear(k)
        return _signed_in(_session_for(user), cfg)

    @app.post("/api/auth/logout")
    async def auth_logout(request: Request, cfg: Settings = Depends(current_settings),
                          store: SessionStore = Depends(current_store),
                          kite: KiteClient = Depends(current_client)) -> JSONResponse:
        """Sign out of the app, and drop the broker session with it.

        A signed-out browser must not keep a live bearer token for the
        trading account behind a cookie the next person could inherit.
        """
        app.state.auth.pop(request.cookies.get(cfg.auth_cookie_name))
        kite_cookie = request.cookies.get(cfg.cookie_name)
        session = store.pop(kite_cookie)
        if session is not None:
            await kite.invalidate(session.access_token)
            app.state.cache.invalidate_prefix(f"{kite_cookie}:")
            app.state.prices.revoke()
        response = JSONResponse({"authenticated": False})
        response.delete_cookie(cfg.auth_cookie_name, path="/")
        response.delete_cookie(cfg.cookie_name, path="/")
        return response

    @app.post("/api/auth/password")
    async def auth_password(request: Request, payload: dict[str, Any]) -> Any:
        me = _current_user(request)
        if me is None or me.user_id == 0:
            return _bad(401, "Sign in first.", "LoginRequired")
        current = str(payload.get("current") or "")
        new = str(payload.get("new") or "")
        if app.state.auth.verify(me.username, current) is None:
            return _bad(401, "Your current password is not right.", "BadCredentials")
        problem = validate_password(new)
        if problem:
            return _bad(400, problem, "Invalid")
        app.state.auth.set_password(me.user_id, new)
        return {"ok": True}

    @app.get("/api/auth/users")
    async def auth_users(request: Request) -> Any:
        me = _current_user(request)
        if me is None or not me.is_owner:
            return _bad(403, "Only the owner can see accounts.", "OwnerOnly")
        return {"users": [u.public_view() for u in app.state.auth.users()]}

    @app.post("/api/auth/users")
    async def auth_add_user(request: Request, payload: dict[str, Any]) -> Any:
        me = _current_user(request)
        if me is None or not me.is_owner:
            return _bad(403, "Only the owner can add accounts.", "OwnerOnly")
        username = str(payload.get("username") or "").strip().lower()
        password = str(payload.get("password") or "")
        name = str(payload.get("name") or "").strip()[:60]
        role = str(payload.get("role") or "member")
        if role not in ("owner", "member"):
            return _bad(400, "Role must be owner or member.", "Invalid")
        problem = validate_username(username) or validate_password(password)
        if problem:
            return _bad(400, problem, "Invalid")
        if app.state.auth.find_user(username) is not None:
            return _bad(409, "That username is taken.", "Taken")
        user = app.state.auth.create_user(username, password, name or username, role=role)
        return {"user": user.public_view()}

    # -- the signed-in user's own documents ---------------------------------

    @app.get("/api/me/{name}")
    async def me_get(name: str, request: Request) -> Any:
        me = _current_user(request)
        if me is None:
            return _bad(401, "Sign in first.", "LoginRequired")
        if name not in DOCUMENT_NAMES:
            return _bad(404, f"No such document: {name}", "NotFound")
        return app.state.documents.get(me.user_id, name) or {"name": name, "data": None, "updated_at": None}

    @app.put("/api/me/{name}")
    async def me_put(name: str, request: Request, payload: dict[str, Any]) -> Any:
        me = _current_user(request)
        if me is None:
            return _bad(401, "Sign in first.", "LoginRequired")
        if name not in DOCUMENT_NAMES:
            return _bad(404, f"No such document: {name}", "NotFound")
        if "data" not in payload:
            return _bad(400, "Send {\"data\": …}.", "Invalid")
        try:
            return app.state.documents.put(me.user_id, name, payload["data"])
        except ValueError as exc:
            return _bad(413, str(exc), "TooLarge")

    # -- quotes, with or without a broker ------------------------------------

    @app.get("/api/quotes/status")
    async def quotes_status() -> dict[str, Any]:
        return app.state.quotes.status()

    @app.get("/api/quotes")
    async def quotes(symbols: str = Query(default="")) -> dict[str, Any]:
        """Latest price per symbol, and where it came from."""
        wanted = [s for s in symbols.split(",") if s.strip()][:200]
        return await app.state.quotes.quotes(wanted)

    # -- AI chat, server-side ---------------------------------------------

    @app.get("/api/ai/status")
    async def ai_status() -> dict[str, Any]:
        return app.state.ai.status()

    @app.post("/api/ai/chat")
    async def ai_chat(payload: dict[str, Any]) -> dict[str, Any]:
        """One reply for the drawer. The key and the system prompt stay here."""
        context = str(payload.get("context") or "")
        history = payload.get("messages") or []
        if not isinstance(history, list):
            history = []
        # The SDK call is blocking; keep it off the event loop.
        reply = await asyncio.to_thread(app.state.ai.reply, context, history)
        return reply.as_dict()

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
        # A promoted token belongs to the session that granted it.
        if session is not None:
            app.state.prices.revoke()
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

    # ---- intelligence layer ----------------------------------------------
    # Additive: none of the existing routes change. The UI reads these to
    # decorate screens it already renders.

    @app.get("/api/intel/coverage")
    async def intel_coverage() -> dict[str, Any]:
        """Which symbols the valuation provider can answer for, and by whom."""
        return {
            "provider": app.state.intel.provider.name,
            "symbols": app.state.intel.covered_symbols(),
            "agents": {
                "active": [a.name for a in DETERMINISTIC_AGENTS],
                "pending": [
                    {"agent": a.name, "needs": getattr(a, "requirement", "")}
                    for a in PENDING_AGENTS
                ],
            },
        }

    @app.get("/api/intel/valuation/{symbol}")
    async def intel_valuation(symbol: str, price: float = Query(0.0)) -> Any:
        result = app.state.intel.valuation_for(symbol.upper(), price)
        if result is None:
            return JSONResponse(
                status_code=404,
                content={
                    "error": f"No fundamentals for {symbol.upper()}.",
                    "error_type": "NotCovered",
                },
            )
        return {
            "valuation": result,
            "history": app.state.intel.valuation_history(symbol.upper()),
        }

    @app.post("/api/intel/enrich")
    async def intel_enrich(payload: dict[str, Any]) -> dict[str, Any]:
        """Batch valuation + current call for a watchlist or holdings table.

        One request per screen rather than one per row — the watchlist would
        otherwise fan out to dozens of calls on every render.
        """
        service = app.state.intel
        rows = payload.get("symbols") or []
        out = []
        for row in rows:
            symbol = str(row.get("sym", "")).upper()
            if not symbol:
                continue
            price = float(row.get("ltp") or 0)
            result = service.valuation_for(symbol, price)
            current = service.store.current_recommendation(symbol)
            out.append({
                "sym": symbol,
                "covered": result is not None,
                "valuation": result,
                "recommendation": current,
            })
        return {"provider": service.provider.name, "rows": out}

    @app.post("/api/intel/recommend")
    async def intel_recommend(payload: dict[str, Any]) -> Any:
        symbol = str(payload.get("symbol", "")).upper()
        if not symbol:
            return JSONResponse(status_code=400, content={"error": "symbol is required"})
        return await app.state.intel.recommend(
            symbol,
            float(payload.get("price") or 0),
            holdings=payload.get("holdings") or [],
        )

    @app.get("/api/intel/recommendations")
    async def intel_recommendations(symbol: str | None = None, limit: int = 200) -> Any:
        return {"recommendations": app.state.intel.history(symbol, limit)}

    @app.get("/api/intel/performance")
    async def intel_performance() -> Any:
        return app.state.intel.performance()

    @app.post("/api/intel/refresh")
    async def intel_refresh(payload: dict[str, Any]) -> Any:
        """Re-score every stored call against the prices supplied."""
        prices = {
            str(k).upper(): float(v) for k, v in (payload.get("prices") or {}).items()
        }
        return {"scored": app.state.intel.refresh_outcomes(prices)}

    @app.post("/api/intel/learn")
    async def intel_learn() -> Any:
        return app.state.intel.learn()

    @app.post("/api/intel/run")
    async def intel_run(payload: dict[str, Any] | None = None) -> Any:
        """Run one full cycle now, rather than waiting for the scheduler."""
        payload = payload or {}
        supplied = {str(k).upper(): float(v)
                    for k, v in (payload.get("prices") or {}).items()}
        # No prices given: quote them rather than silently re-scoring old marks.
        prices = supplied or await refresh_cycle_inputs()
        result = await app.state.orchestrator.run_cycle(
            prices=prices,
            # No holdings given: the owner's book, the same as a scheduled run.
            holdings=payload.get("holdings") or holdings_for_cycle(),
            trigger="manual",
        )
        return result.as_dict()

    @app.post("/api/intel/price-feed/promote")
    async def promote_price_feed(
        store: SessionStore = Depends(current_store),
        session_cookie: str | None = Cookie(default=None, alias="tradepulse_session"),
    ) -> Any:
        """Let unattended cycles quote using this browser session's token.

        Explicit and revocable on purpose. A background job silently borrowing
        whichever session logged in last would be a surprise, and the token it
        borrows is a bearer credential for the whole trading account.
        """
        session = store.get(session_cookie)
        if session is None:
            return _unauthenticated()
        app.state.prices.promote(session.access_token, session.user_id)
        return {"promoted": True, **app.state.prices.status()}

    @app.post("/api/intel/price-feed/revoke")
    async def revoke_price_feed() -> Any:
        app.state.prices.revoke()
        return {"promoted": False, **app.state.prices.status()}

    @app.get("/api/intel/price-feed")
    async def price_feed_status() -> Any:
        return app.state.prices.status()

    @app.get("/api/intel/runs")
    async def intel_runs(limit: int = 50) -> Any:
        return {
            "scheduler": app.state.scheduler.status(),
            "price_feed": app.state.prices.status(),
            "runs": app.state.intel.store.runs(limit),
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

    # Last, so every API route above is matched before the page fallback.
    app.state.serves_ui = bool(settings.static_dir) and mount_ui(app, settings.static_dir)

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
