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

# PyPI 镜像做成 ARG：各镜像源在不同网络下可用性不同（实测本机 tsinghua 会
# SSL EOF，aliyun / pypi.org 可用）。用 --build-arg PIP_INDEX_URL=... 覆盖。
ARG PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/
ENV PIP_INDEX_URL=${PIP_INDEX_URL}
# langgraph + langgraph-checkpoint-postgres 是本服务的编排/持久化底座；
# psycopg[binary] 供 RLS 连接（同步建表 + 异步图跑）。
#
# langchain / langchain-core / langchain-mcp-adapters 是 1.2 迁移引入的执行层
# （`create_agent` + 16 个中间件 + 协议面 MCP 工具转换）。**镜像必须跟着涨**：
# 1.2 只改了代码没改这里，重建出来的镜像一启动就 ModuleNotFoundError:
# langchain —— 源码是 bind mount 的，本地跑得好好的，只有真重建才暴露。
# 版本对齐 1.2 验证过的组合（中间件行为有版本差异，浮动升级会静默改变轮次预算
# 与摘要时机）。
RUN pip install --no-cache-dir \
        fastapi pydantic uvicorn structlog \
        httpx pydantic-settings 'pyjwt[crypto]' \
        python-multipart sqlalchemy sqlmodel 'psycopg[binary]' \
        'langgraph>=1.2.9' 'langgraph-checkpoint-postgres>=3.1.2' \
        'langchain==1.3.14' 'langchain-core==1.5.1' 'langchain-mcp-adapters==0.3.2' \
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
