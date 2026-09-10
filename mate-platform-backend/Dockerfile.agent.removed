# syntax=docker/dockerfile:1.7
# mate-tech-agent: the real LangGraph runtime used by the Agent/DW execution path.
# Build context: mate-platform-backend

FROM python:3.12 AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1

COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /uvx /usr/local/bin/
WORKDIR /app

COPY pyproject.toml uv.lock ./
COPY packages/ packages/

# The root project is a workspace shell. Install its locked runtime
# dependencies, then copy the service packages into site-packages so the
# image can run without relying on a host checkout.
RUN uv sync --frozen --no-install-project --no-dev

RUN SITE=/app/.venv/lib/python3.12/site-packages && \
    cp -r packages/mate-common/src/mate_common "$SITE/" && \
    cp -r packages/mate-platform/src/mate_platform "$SITE/" && \
    cp -r packages/mate-tech-db/src/mate_tech_db "$SITE/" && \
    cp -r packages/mate-tech-agent/src/mate_tech_agent "$SITE/"

FROM python:3.12 AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app/packages/mate-tech-agent/src:/app/packages/mate-platform/src:/app/packages/mate-tech-db/src:/app/packages/mate-common/src"

RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/packages/mate-common /app/packages/mate-common
COPY --from=builder /app/packages/mate-platform /app/packages/mate-platform
COPY --from=builder /app/packages/mate-tech-db /app/packages/mate-tech-db
COPY --from=builder /app/packages/mate-tech-agent /app/packages/mate-tech-agent

RUN useradd --create-home --shell /bin/bash appuser
USER appuser
WORKDIR /app

EXPOSE 8002

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=30s \
    CMD curl -fsS http://localhost:8002/healthz || exit 1

CMD ["uvicorn", "mate_tech_agent.api.app:app", "--host", "0.0.0.0", "--port", "8002"]
