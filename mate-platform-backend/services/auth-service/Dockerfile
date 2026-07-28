# syntax=docker/dockerfile:1.7
# =============================================================================
# mate-auth-service : JWT ?? + ???? (via Keycloak JWKS)
# Base: mate-api-gateway (monorepo .venv already has fastapi/uvicorn/structlog/httpx)
# =============================================================================
FROM mate-api-gateway:dev

USER root
WORKDIR /app

# ? auth-service ?????pyjwt[crypto]?redis?opentelemetry?tenacity?
# api-gateway ? venv ??? fastapi/uvicorn/structlog/httpx/pydantic
ENV PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple/

# ????
COPY packages/ /tmp/build/packages/
COPY services/auth-service/ /tmp/build/services/auth-service/

# ???????? .wheels/?offline??????? mirror
RUN pip install --no-cache-dir \
        --find-links /app/wheels/ --no-index \
        pyjwt[crypto] redis tenacity pydantic-settings \
        opentelemetry-api opentelemetry-sdk opentelemetry-exporter-otlp-proto-grpc opentelemetry-instrumentation-fastapi \
    || pip install --no-cache-dir \
        pyjwt[crypto] redis tenacity pydantic-settings \
        opentelemetry-api opentelemetry-sdk opentelemetry-exporter-otlp-proto-grpc opentelemetry-instrumentation-fastapi

# ?? auth-service ?? venv site-packages
RUN SITE=/app/.venv/lib/python3.12/site-packages && \
    cp -r /tmp/build/services/auth-service/src/mate_auth_service "$SITE/"

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH=/app/src \
    PORT=8101

USER appuser
EXPOSE 8101

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=20s \
    CMD curl -fsS http://localhost:8101/healthz || exit 1

CMD ["uvicorn", "mate_auth_service.main:app", "--host", "0.0.0.0", "--port", "8101"]
