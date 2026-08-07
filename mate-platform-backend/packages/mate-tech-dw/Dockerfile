# syntax=docker/dockerfile:1.7
# mate-tech-dw: 数字员工聚合查询服务 (FR-DW-001..015)
# Build context: monorepo 根 (./mate-platform-backend)

FROM python:3.12 AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1

COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /uvx /usr/local/bin/

WORKDIR /app

COPY pyproject.toml uv.lock ./
COPY packages/ packages/

ENV UV_HTTP_TIMEOUT=300 UV_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/
RUN uv sync --frozen --no-dev
# Workaround: root pyproject has package=false so uv sync by default does not materialize
# workspace member runtime deps into the venv. Reinstall DW-specific runtime deps.
# 不要 install 内部包（mate-platform / mate-clients），这些是 workspace 内部包，下面通过 cp 注入。
RUN uv pip install --python .venv/bin/python fastapi pydantic httpx uvicorn structlog "pyjwt[crypto]" python-multipart opentelemetry-api opentelemetry-sdk opentelemetry-exporter-otlp-proto-grpc opentelemetry-instrumentation-fastapi sqlalchemy aiosqlite

RUN SITE=/app/.venv/lib/python3.12/site-packages && \
    cp -r packages/mate-tech-dw/src/mate_tech_dw "$SITE/" && \
    cp -r packages/mate-tech-db/src/mate_tech_db "$SITE/" && \
    cp -r packages/mate-common/src/mate_common "$SITE/" && \
    cp -r packages/mate-platform/src/mate_platform "$SITE/" && \
    cp -r packages/mate-clients/src/mate_clients "$SITE/" && \
    cp -r packages/mate-kernel/src/mate_kernel "$SITE/"

FROM python:3.12 AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/app/.venv/bin:$PATH \
    PORT=8021

RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Tell `mate_platform.auth` to accept the dev-mode short-circuit token format.
ENV LEGACY_LOGIN_COMPAT=true \
    INSECURE_SKIP_SIGNATURE=true

COPY --from=builder /app /app

WORKDIR /app

EXPOSE 8021

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=20s \
    CMD curl -fsS http://localhost:8021/healthz || exit 1

CMD ["uvicorn", "mate_tech_dw.main:app", "--host", "0.0.0.0", "--port", "8021"]
