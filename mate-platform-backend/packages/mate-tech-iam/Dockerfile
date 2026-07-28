# syntax=docker/dockerfile:1.7
# mate-tech-iam: 后台管理服务 (用户/角色/权限/组织/审计/配置)
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

RUN uv sync --frozen --no-dev

RUN mkdir -p /app/.venv/lib/python3.12/site-packages
RUN SITE=/app/.venv/lib/python3.12/site-packages && cp -r packages/mate-tech-iam/src/mate_tech_iam "$SITE/"
RUN SITE=/app/.venv/lib/python3.12/site-packages && cp -r packages/mate-common/src/mate_common "$SITE/"

FROM python:3.12 AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH=/app/.venv/bin:$PATH \
    PORT=8102 \
    IAM_DATA_DIR=/data

RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app /app

RUN mkdir -p /data && useradd --create-home --shell /bin/bash appuser && \
    chown -R appuser:appuser /app /data
USER appuser
WORKDIR /app

EXPOSE 8102

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=20s \
    CMD curl -fsS http://localhost:8102/healthz || exit 1

CMD ["uvicorn", "mate_tech_iam.main:app", "--host", "0.0.0.0", "--port", "8102"]
