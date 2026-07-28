# syntax=docker/dockerfile:1.7
# =============================================================================
# mate-tech-mcp : MCP server
# 闂傚倵鍋撴繝濠傚暙閸? python:3.12 闁诲海鎳撻張顒勫汲閿濆鍋?(per agent.md)
# Build context: monorepo 闂?(./mate-platform-backend)
# =============================================================================

FROM python:3.12 AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/

COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /uvx /usr/local/bin/

WORKDIR /app

RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list /etc/apt/sources.list.d/*.sources 2>/dev/null || true
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

COPY pyproject.toml uv.lock ./
COPY packages/ packages/
COPY services/ services/
COPY .wheels/ /app/wheels/

# Build venv with retry (Aliyun mirror is intermittent)
RUN rm -rf .venv && \
    for i in 1 2 3; do \
      uv sync --frozen --no-dev && break || \
      echo "=== uv sync attempt $i failed, retrying in 10s ===" && sleep 10; \
    done && \
    uv pip install --python .venv/bin/python --no-index --find-links /app/wheels/ structlog

FROM python:3.12 AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH=/app/src \
    PORT=8081

RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list /etc/apt/sources.list.d/*.sources 2>/dev/null || true
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app /app
COPY packages/mate-tech-mcp/src/mate_tech_mcp /app/src/mate_tech_mcp

RUN useradd --create-home --shell /bin/bash appuser && \
    chown -R appuser:appuser /app
USER appuser
WORKDIR /app

EXPOSE 8081

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=30s \
    CMD curl -fsS http://localhost:8081/healthz || exit 1

CMD ["uvicorn", "mate_tech_mcp.main:app", "--host", "0.0.0.0", "--port", "8081"]