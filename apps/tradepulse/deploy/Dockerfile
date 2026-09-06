# TradePulse — one container: the FastAPI backend serving the built UI.
#
#   docker build -f apps/tradepulse/deploy/Dockerfile -t tradepulse .
#   docker run -p 8787:8787 -v tradepulse-data:/data --env-file .env tradepulse
#
# Build from the repository root so the npm workspace resolves.

# ---- stage 1: the UI -------------------------------------------------------
FROM node:22-slim AS ui
WORKDIR /repo
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json ./
COPY apps/tradepulse/package.json apps/tradepulse/package.json
RUN npm ci --workspace=apps/tradepulse --include-workspace-root
COPY apps/tradepulse apps/tradepulse
RUN npm run build --workspace=apps/tradepulse

# ---- stage 2: the server ---------------------------------------------------
FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY apps/tradepulse/server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY apps/tradepulse/server/tradepulse_server tradepulse_server
COPY --from=ui /repo/apps/tradepulse/dist /app/ui

# Everything that must outlive the container lives under /data.
RUN useradd --system --create-home tradepulse && mkdir -p /data && chown tradepulse /data
USER tradepulse
VOLUME ["/data"]

ENV TRADEPULSE_HOST=0.0.0.0 \
    TRADEPULSE_PORT=8787 \
    TRADEPULSE_STATIC_DIR=/app/ui \
    TRADEPULSE_DATA_DIR=/data \
    TRADEPULSE_RELOAD=false \
    TRADEPULSE_FRONTEND_URL=http://localhost:8787/
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8787/healthz')"
CMD ["python", "-m", "tradepulse_server"]
