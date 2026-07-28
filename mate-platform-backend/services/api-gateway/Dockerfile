# mate-api-gateway : L7 ?? + ?? + Redis ??
# Build context: ./mate-platform-backend
FROM python:3.12

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ???
ENV PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple/
COPY pyproject.toml uv.lock* ./
COPY packages/ packages/
COPY services/ services/

# ??? pip install???? uv sync + ?? dockerfile syntax 1.7 ?????
# ? --no-build-isolation ????? setuptools?????????
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir fastapi 'uvicorn[standard]' pydantic pydantic-settings \
        httpx structlog redis 'pyjwt[crypto]' tenacity sse-starlette

# ????
RUN SITE=/app/.venv/lib/python3.12/site-packages 2>/dev/null; \
    SITE=/usr/local/lib/python3.12/site-packages && \
    cp -r /app/services/api-gateway/src/mate_api_gateway "$SITE/"

# mate-common ? workspace ??????
COPY packages/mate-common /tmp/mate-common
RUN pip install --no-cache-dir /tmp/mate-common

USER root
EXPOSE 8100

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=20s \
    CMD curl -fsS http://localhost:8100/healthz || exit 1

ENV PATH="/usr/local/bin:$PATH" \
    PYTHONPATH=/app/src \
    PORT=8100

CMD ["uvicorn", "mate_api_gateway.main:app", "--host", "0.0.0.0", "--port", "8100"]
