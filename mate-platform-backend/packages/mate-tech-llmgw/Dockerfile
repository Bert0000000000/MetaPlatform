# syntax=docker/dockerfile:1.7
# =============================================================================
# mate-tech-llmgw : LLM Gateway (multi-provider routing)
# Base: mate-api-gateway (monorepo .venv ?? fastapi/uvicorn/structlog/httpx)
# Build context: ./mate-platform-backend
# =============================================================================
FROM mate-api-gateway:dev

USER root
WORKDIR /app

# ?? llmgw + mate-common ??
COPY packages/mate-tech-llmgw/ /tmp/build/packages/mate-tech-llmgw/
COPY packages/mate-common/ /tmp/build/packages/mate-common/

# ? llmgw ???????LLM SDKs + ?? + ????
ENV PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple/
RUN pip install --no-cache-dir \
        langchain langchain-core langchain-openai langchain-anthropic \
        openai anthropic \
        redis pybreaker sse-starlette \
        tiktoken

# ? llmgw ?? venv site-packages
RUN SITE=/app/.venv/lib/python3.12/site-packages && \
    cp -r /tmp/build/packages/mate-tech-llmgw/src/mate_tech_llmgw "$SITE/"

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH=/app/src \
    PORT=8008

USER appuser
EXPOSE 8008

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=30s \
    CMD curl -fsS http://localhost:8008/healthz || exit 1

CMD ["uvicorn", "mate_tech_llmgw.main:app", "--host", "0.0.0.0", "--port", "8008"]
