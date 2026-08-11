# syntax=docker/dockerfile:1.7
# =============================================================================
# mate-auth-service : JWT 验证 + 租户识别 (via Keycloak JWKS)
# GOVERN-02-FIX: 也承接 mate-tech-iam 的 dashboard/admin/users/orgs 路由
# =============================================================================
FROM python:3.12 AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc && \
    rm -rf /var/lib/apt/lists/*

# Install all deps via pip with Aliyun mirror (uv sync on this machine stalls
# indefinitely on the Aliyun mirror; pip is faster and more reliable).
RUN pip install --no-cache-dir \
    fastapi 'uvicorn[standard]' pydantic pydantic-settings httpx \
    pyjwt[crypto] redis tenacity structlog python-multipart \
    opentelemetry-api opentelemetry-sdk opentelemetry-exporter-otlp-proto-grpc \
    opentelemetry-instrumentation-fastapi \
    sqlmodel sqlalchemy aiosqlite 'passlib[bcrypt]' bcrypt \
    && echo "AUTH_DEPS_OK" || (echo "AUTH_DEPS_FAIL"; exit 1)

COPY services/ services/
COPY packages/ packages/

RUN SITE=/usr/local/lib/python3.12/site-packages && \
    cp -r services/auth-service/src/mate_auth_service "$SITE/" && \
    cp -r packages/mate-tech-iam/src/mate_tech_iam "$SITE/" && \
    cp -r packages/mate-common/src/mate_common "$SITE/" && \
    cp -r packages/mate-platform/src/mate_platform "$SITE/" && \
    cp -r packages/mate-kernel/src/mate_kernel "$SITE/" && \
    cp -r packages/mate-clients/src/mate_clients "$SITE/"

FROM python:3.12 AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8101

RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app /app
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

RUN useradd --create-home --shell /bin/bash appuser && \
    chown -R appuser:appuser /app
USER appuser
WORKDIR /app

EXPOSE 8101

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=30s \
    CMD curl -fsS http://localhost:8101/healthz || exit 1

CMD ["uvicorn", "mate_auth_service.main:app", "--host", "0.0.0.0", "--port", "8101"]
