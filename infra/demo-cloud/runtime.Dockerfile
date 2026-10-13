FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ARG PIP_INDEX_URL=https://pypi.org/simple
COPY infra/demo-cloud/artifacts/requirements.txt /tmp/demo-requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --timeout 120 --retries 5 --index-url "$PIP_INDEX_URL" -r /tmp/demo-requirements.txt
COPY mate-platform-backend/packages/ /app/packages/
COPY mate-platform-backend/services/ /app/services/
COPY infra/demo-cloud/run_service.py /app/demo/run_service.py
COPY infra/demo-cloud/configure_schema.py /app/demo/configure_schema.py
COPY mate-platform-backend/alembic/versions/20261011_0021_apphub_publication.py /app/demo/migrations/20261011_0021_apphub_publication.py
COPY mate-platform-backend/alembic/versions/20261012_0022_mcp_key_scopes.py /app/demo/migrations/20261012_0022_mcp_key_scopes.py
RUN useradd --uid 10001 --create-home appuser && mkdir /data && chown appuser /data
USER appuser
ENTRYPOINT ["python", "/app/demo/run_service.py"]
