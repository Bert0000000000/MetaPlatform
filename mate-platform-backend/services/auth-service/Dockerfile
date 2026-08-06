# syntax=docker/dockerfile:1.7
# =============================================================================
# mate-auth-service : JWT 验证 + 租户识别 (via Keycloak JWKS)
# =============================================================================
FROM python:3.12 AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1

COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /uvx /usr/local/bin/

WORKDIR /app

ENV UV_HTTP_TIMEOUT=300 UV_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/

COPY pyproject.toml uv.lock ./
COPY packages/ packages/
COPY services/ services/

RUN uv sync --frozen --no-dev

RUN SITE=/app/.venv/lib/python3.12/site-packages && \
    cp -r services/auth-service/src/mate_auth_service "$SITE/" && \
    cp -r packages/mate-common/src/mate_common "$SITE/"

# Workaround: root pyproject sets package=false so ensure IAM auth-service runtime deps
RUN .venv/bin/python -m pip install --no-cache-dir --quiet \
    pyjwt[crypto] redis tenacity pydantic-settings \
    opentelemetry-api opentelemetry-sdk opentelemetry-exporter-otlp-proto-grpc \
    opentelemetry-instrumentation-fastapi structlog httpx \
    && echo "AUTH_DEPS_OK" || (echo "AUTH_DEPS_FAIL"; exit 1)

FROM python:3.12 AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH" \
    PORT=8101

RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app /app

RUN useradd --create-home --shell /bin/bash appuser && \
    chown -R appuser:appuser /app
USER appuser
WORKDIR /app

EXPOSE 8101

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=30s \
    CMD curl -fsS http://localhost:8101/healthz || exit 1

CMD ["uvicorn", "mate_auth_service.main:app", "--host", "0.0.0.0", "--port", "8101"]
