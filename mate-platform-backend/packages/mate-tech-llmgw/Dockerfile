# syntax=docker/dockerfile:1.7
# =============================================================================
# mate-tech-llmgw : LLM Gateway (multi-provider routing)
# Base: mate-api-gateway (pip-installed globally to /usr/local/lib/...)
# Build context: ./mate-platform-backend
# =============================================================================
FROM mate-api-gateway:dev

USER root
WORKDIR /app

# Copy llmgw + mate-common + mate-platform + mate-clients source
COPY packages/mate-tech-llmgw/ /tmp/build/packages/mate-tech-llmgw/
COPY packages/mate-common/ /tmp/build/packages/mate-common/
COPY packages/mate-platform/ /tmp/build/packages/mate-platform/
COPY packages/mate-clients/ /tmp/build/packages/mate-clients/

# Install llmgw-specific runtime deps (LLM SDKs + redis + pybreaker).
# opentelemetry-api/sdk: mate_platform.observability (journey/tracing) requires
# them, but the base image (mate-api-gateway) no longer carries them.
ENV PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple/
RUN pip install --no-cache-dir \
        opentelemetry-api opentelemetry-sdk \
        langchain langchain-core langchain-openai langchain-anthropic \
        openai anthropic \
        redis pybreaker sse-starlette \
        tiktoken sqlalchemy sqlmodel

# Install llmgw source into the SAME global site-packages the base image uses
# (api-gateway installs to /usr/local/lib/python3.12/site-packages, NOT a venv)
# v3.2 W2: mate-clients needed for AIProviderConfigService (BearerAuth + outgoing ACL)
# Use cp -r for the workspace packages so no wheel build / hatchling is required
# at runtime (the base image does not install hatchling).
RUN SITE=/usr/local/lib/python3.12/site-packages && \
    cp -r /tmp/build/packages/mate-tech-llmgw/src/mate_tech_llmgw "$SITE/" && \
    cp -r /tmp/build/packages/mate-common/src/mate_common "$SITE/" && \
    cp -r /tmp/build/packages/mate-platform/src/mate_platform "$SITE/" && \
    cp -r /tmp/build/packages/mate-clients/src/mate_clients "$SITE/" && \
    rm -rf /tmp/build

ENV PATH="/usr/local/bin:$PATH" \
    PYTHONPATH=/app/src \
    PORT=8008

EXPOSE 8008

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=30s \
    CMD curl -fsS http://localhost:8008/healthz || exit 1

CMD ["uvicorn", "mate_tech_llmgw.main:app", "--host", "0.0.0.0", "--port", "8008"]
