# Mate Platform app-kb business aggregation (facade over RAG + Agent)
# (Restored after GOVERN-07 cleanup accidentally removed it; the original had
#  a broken indented `RUN` line after ENV which failed Dockerfile parsing.)
FROM python:3.12 AS builder

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 UV_LINK_MODE=copy UV_COMPILE_BYTECODE=1

COPY --from=ghcr.io/astral-sh/uv:0.5.11 /uv /uvx /usr/local/bin/
WORKDIR /app

COPY pyproject.toml uv.lock ./
COPY packages/ packages/

ENV UV_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/
RUN uv sync --frozen --no-dev

RUN SITE=/app/.venv/lib/python3.12/site-packages && \
    cp -r packages/mate-common/src/mate_common "$SITE/" && \
    cp -r packages/mate-platform/src/mate_platform "$SITE/" && \
    cp -r packages/mate-clients/src/mate_clients "$SITE/" && \
    cp -r packages/mate-tech-db/src/mate_tech_db "$SITE/" && \
    cp -r packages/mate-tech-rag/src/mate_tech_rag "$SITE/" && \
    cp -r packages/mate-app-kb/src/mate_app_kb "$SITE/"

FROM python:3.12 AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PATH="/app/.venv/bin:$PATH"

RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list /etc/apt/sources.list.d/*.sources 2>/dev/null || true
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app /app

RUN useradd --create-home --shell /bin/bash appuser
USER appuser
WORKDIR /app

EXPOSE 8003

ENV RAG_URL="http://mate-tech-rag:8001"
ENV AGENT_URL="http://mate-tech-agent:8002"

CMD ["uvicorn", "mate_app_kb.api.app:app", "--host", "0.0.0.0", "--port", "8003"]
