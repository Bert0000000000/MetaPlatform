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
        neo4j owlready2 rdflib sqlalchemy sqlmodel psycopg2-binary pydantic pydantic-settings httpx "pyjwt[crypto]"

# 把 ont / kernel / common / platform 源码拷到 gate 镜像的 system site-packages。
# 运行时由 docker-compose.yml 挂载 ./mate-platform-backend/packages 到 /app/packages 并加
# PYTHONPATH；image 内的 cp 是 fallback。脚本 /tmp/copy_sources.sh 由下面 COPY 写入。
COPY packages/mate-tech-ont/copy_sources.sh /tmp/copy_sources.sh
RUN bash /tmp/copy_sources.sh

ENV PATH="/usr/local/bin:$PATH" \
    PORT=8007

USER root
EXPOSE 8007

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=20s \
    CMD curl -fsS http://localhost:8007/healthz || exit 1

CMD ["uvicorn", "mate_tech_ont.main:app", "--host", "0.0.0.0", "--port", "8007"]
