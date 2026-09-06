"""Serve the built UI from the same process as the API.

In development Vite serves the UI and proxies `/api` here. For a deployment
that is a second process, a second port and a reverse-proxy rule for
something that is, at this size, one small app. When `TRADEPULSE_STATIC_DIR`
points at a `vite build` output this module serves it: hashed assets with a
long cache life, and `index.html` for every other non-API path so the
client-side router works on a deep link and a reload.

`/api/*` is never swallowed by the fallback — an unknown API path stays a
JSON 404, not a page.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles


def mount_ui(app: FastAPI, static_dir: str | Path) -> bool:
    root = Path(static_dir)
    index = root / "index.html"
    if not index.is_file():
        return False

    assets = root / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=str(assets)), name="assets")

    # Vite names assets by content hash, so they can be cached forever; the
    # HTML that points at them must not be, or a deploy would not take.
    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str):
        if path.startswith("api/") or path == "healthz":
            return JSONResponse(status_code=404, content={"error": "Not found", "error_type": "NotFound"})
        candidate = root / path
        if path and candidate.is_file() and candidate.resolve().is_relative_to(root.resolve()):
            return FileResponse(str(candidate))
        return FileResponse(str(index), headers={"Cache-Control": "no-cache"})

    return True
