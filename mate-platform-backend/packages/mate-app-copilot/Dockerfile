# syntax=docker/dockerfile:1.7
# =============================================================================
# mate-app-copilot : AI business assistant (chat, NL2SQL, code-gen, scheduling)
# Base: python:3.12
# Build context: ./mate-platform-backend
# =============================================================================
FROM python:3.12

USER root
WORKDIR /app

# Use Aliyun mirror for apt
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list /etc/apt/sources.list.d/*.sources 2>/dev/null || true

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package sources to a temporary build directory
COPY packages/ /tmp/build/packages/

# Install Python dependencies
ENV PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple/
RUN pip install --no-cache-dir \
        fastapi pydantic sqlparse uvicorn structlog sqlalchemy sqlmodel \
        httpx pydantic-settings 'pyjwt[crypto]' redis tenacity \
        python-multipart psycopg2-binary \
        opentelemetry-api opentelemetry-sdk \
        opentelemetry-exporter-otlp-proto-grpc \
        opentelemetry-instrumentation-fastapi \
        sse-starlette

# Copy package source to system site-packages
RUN SITE=/usr/local/lib/python3.12/site-packages && \
    cp -r /tmp/build/packages/mate-app-copilot/src/mate_app_copilot "$SITE/" && \
    cp -r /tmp/build/packages/mate-app-arch/src/mate_app_arch "$SITE/" && \
    cp -r /tmp/build/packages/mate-tech-db/src/mate_tech_db "$SITE/" && \
    cp -r /tmp/build/packages/mate-common/src/mate_common "$SITE/" && \
    cp -r /tmp/build/packages/mate-platform/src/mate_platform "$SITE/" && \
    cp -r /tmp/build/packages/mate-clients/src/mate_clients "$SITE/"

ENV PATH="/usr/local/bin:$PATH" \
    PORT=8601

EXPOSE 8601

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=30s \
    CMD curl -fsS http://localhost:8601/healthz || exit 1

CMD ["uvicorn", "mate_app_copilot.main:app", "--host", "0.0.0.0", "--port", "8601"]
