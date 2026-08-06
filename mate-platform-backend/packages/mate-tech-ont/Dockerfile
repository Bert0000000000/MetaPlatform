# syntax=docker/dockerfile:1.7
# =============================================================================
# mate-tech-ont : 本体引擎 (Neo4j + OWL + SPARQL)
# Base: mate-api-gateway:dev (already has fastapi/uvicorn/structlog/httpx)
# Build context: ./mate-platform-backend
# =============================================================================
FROM mate-api-gateway:dev

USER root
WORKDIR /app

# 拷贝 ont 源码
COPY packages/ /tmp/build/packages/

# 安装 ont 特有依赖：neo4j + owlready2 + rdflib
# structlog 已经在 api-gateway 的 system site-packages 里
ENV PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple/
RUN pip install --no-cache-dir \
        neo4j owlready2 rdflib sqlalchemy sqlmodel psycopg2-binary

# 把 ont / kernel / common / platform 源码拷到 gate 镜像的 system site-packages
RUN SITE=/usr/local/lib/python3.12/site-packages && \
    cp -r /tmp/build/packages/mate-tech-ont/src/mate_tech_ont "$SITE/" && \
    cp -r /tmp/build/packages/mate-kernel/src/mate_kernel "$SITE/" && \
    cp -r /tmp/build/packages/mate-common/src/mate_common "$SITE/" && \
    cp -r /tmp/build/packages/mate-platform/src/mate_platform "$SITE/" 2>/dev/null || true

ENV PATH="/usr/local/bin:$PATH" \
    PORT=8007

USER root
EXPOSE 8007

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=20s \
    CMD curl -fsS http://localhost:8007/healthz || exit 1

CMD ["uvicorn", "mate_tech_ont.main:app", "--host", "0.0.0.0", "--port", "8007"]
