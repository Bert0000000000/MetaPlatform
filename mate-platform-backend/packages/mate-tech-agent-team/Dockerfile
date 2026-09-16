# syntax=docker/dockerfile:1.7
# =============================================================================
# mate-tech-agent-team : Agent 产品层 1.0（超级大脑 + 数字员工）
# Base: python:3.12
# Build context: ./mate-platform-backend
# =============================================================================
FROM python:3.12

USER root
WORKDIR /app

RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list /etc/apt/sources.list.d/*.sources 2>/dev/null || true

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY packages/ /tmp/build/packages/

ENV PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple/
# langgraph + langgraph-checkpoint-postgres 是本服务的编排/持久化底座；
# psycopg[binary] 供 RLS 连接（同步建表 + 异步图跑）。
RUN pip install --no-cache-dir \
        fastapi pydantic uvicorn structlog \
        httpx pydantic-settings 'pyjwt[crypto]' \
        python-multipart sqlalchemy sqlmodel 'psycopg[binary]' \
        'langgraph>=1.2.9' 'langgraph-checkpoint-postgres>=3.1.2' \
        opentelemetry-api opentelemetry-sdk \
        opentelemetry-exporter-otlp-proto-grpc \
        opentelemetry-instrumentation-fastapi

RUN SITE=/usr/local/lib/python3.12/site-packages && \
    cp -r /tmp/build/packages/mate-tech-agent-team/src/mate_tech_agent_team "$SITE/" && \
    cp -r /tmp/build/packages/mate-kernel/src/mate_kernel "$SITE/" && \
    cp -r /tmp/build/packages/mate-common/src/mate_common "$SITE/" && \
    cp -r /tmp/build/packages/mate-platform/src/mate_platform "$SITE/" && \
    cp -r /tmp/build/packages/mate-clients/src/mate_clients "$SITE/" && \
    cp -r /tmp/build/packages/mate-tech-db/src/mate_tech_db "$SITE/"

ENV PATH="/usr/local/bin:$PATH" \
    PORT=8013

EXPOSE 8013

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=40s \
    CMD curl -fsS http://localhost:8013/healthz || exit 1

CMD ["uvicorn", "mate_tech_agent_team.main:app", "--host", "0.0.0.0", "--port", "8013"]
