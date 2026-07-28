# syntax=docker/dockerfile:1.7
# =============================================================================
# mate-tech-ont : ???? (Neo4j + OWL + SPARQL)
# Base: mate-api-gateway (already has fastapi/uvicorn/structlog/httpx)
# Build context: ./mate-platform-backend
# =============================================================================
FROM mate-api-gateway:dev

USER root
WORKDIR /app

# ?? ont ??
COPY packages/ /tmp/build/packages/

# ? ont ???????neo4j ???owlready2?rdflib
# structlog ?? api-gateway ? venv ??????
ENV PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple/
RUN pip install --no-cache-dir \
        neo4j owlready2 rdflib

# ? ont ?? venv site-packages
RUN SITE=/app/.venv/lib/python3.12/site-packages && \
    cp -r /tmp/build/packages/mate-tech-ont/src/mate_tech_ont "$SITE/" && \
    cp -r /tmp/build/packages/mate-common/src/mate_common "$SITE/" 2>/dev/null || true

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH=/app/src \
    PORT=8007

USER appuser
EXPOSE 8007

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=20s \
    CMD curl -fsS http://localhost:8007/healthz || exit 1

CMD ["uvicorn", "mate_tech_ont.main:app", "--host", "0.0.0.0", "--port", "8007"]
