# syntax=docker/dockerfile:1.7
# =============================================================================
# mate-tech-metrics : Task12 部署 — 数据平台 ETL/调度/指标服务
# Base: python:3.12
# Build context: ./mate-platform-backend
# =============================================================================
FROM python:3.12

USER root
WORKDIR /app

# Use Aliyun mirror for apt
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list /etc/apt/sources.list.d/*.sources 2>/dev/null || true

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl     && rm -rf /var/lib/apt/lists/*

# Copy package sources to a temporary build directory
COPY packages/ /tmp/build/packages/

# Install Python dependencies
ENV PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple/
RUN pip install --no-cache-dir         fastapi pydantic uvicorn structlog         httpx pydantic-settings 'pyjwt[crypto]'         python-multipart sqlalchemy sqlmodel psycopg2-binary         opentelemetry-api opentelemetry-sdk         opentelemetry-exporter-otlp-proto-grpc         opentelemetry-instrumentation-fastapi

# Copy package source to system site-packages
RUN SITE=/usr/local/lib/python3.12/site-packages &&     cp -r /tmp/build/packages/mate-tech-metrics/src/mate_tech_metrics "$SITE/" &&     cp -r /tmp/build/packages/mate-tech-db/src/mate_tech_db "$SITE/" &&     cp -r /tmp/build/packages/mate-common/src/mate_common "$SITE/" &&     cp -r /tmp/build/packages/mate-platform/src/mate_platform "$SITE/" &&     cp -r /tmp/build/packages/mate-clients/src/mate_clients "$SITE/"

ENV PATH="/usr/local/bin:$PATH"     PORT=8024

EXPOSE 8024

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=30s     CMD curl -fsS http://localhost:8024/api/v1/metrics/health || exit 1

CMD ["uvicorn", "mate_tech_metrics.main:app", "--host", "0.0.0.0", "--port", "8024"]
