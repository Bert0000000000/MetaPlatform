# Custom fast Dockerfile for mate-tech-mcp
# Avoids slow uv sync + chown -R of monorepo
FROM python:3.12

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install MCP runtime deps via pip (Tsinghua mirror is fast)
ENV PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir \
        fastapi 'uvicorn[standard]' pydantic pydantic-settings \
        httpx structlog redis 'pyjwt[crypto]' tenacity sse-starlette \
        mcp pybreaker opentelemetry-api opentelemetry-sdk \
        opentelemetry-exporter-otlp-proto-grpc sqlalchemy sqlmodel

# Install mate-common (workspace dependency)
COPY packages/mate-common /tmp/mate-common
RUN pip install --no-cache-dir /tmp/mate-common

# Copy mate-platform source into site-packages
COPY packages/mate-platform/src/mate_platform /usr/local/lib/python3.12/site-packages/mate_platform

# Copy MCP source code (no need to chown - running as root)
COPY packages/mate-tech-mcp/src/mate_tech_mcp /usr/local/lib/python3.12/site-packages/mate_tech_mcp

# Clean up build artifacts
RUN rm -rf /tmp/mate-common

USER root
EXPOSE 8081

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=30s \
    CMD curl -fsS http://localhost:8081/healthz || exit 1

ENV PATH=/usr/local/bin:$PATH \
    PORT=8081

CMD ["uvicorn", "mate_tech_mcp.main:app", "--host", "0.0.0.0", "--port", "8081"]
