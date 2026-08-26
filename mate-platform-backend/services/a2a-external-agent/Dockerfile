# a2a-external-agent : demonstration A2A 1.0 endpoint for SuperAI dispatch
#
# This is a *client* service used by the SuperAI orchestrator to verify the
# orchestrator's outbound A2A delegation path end-to-end. It replaces the
# placeholder "外部对账桥接" registration that pointed at a non-existent
# port. The agent card served at `/.well-known/agent-card.json` advertises
# three skills (finance-recon / kb-curator / data-analyst) and the executor
# selects a skill based on the message metadata's `role_slug` field.
#
# Build context: ./mate-platform-backend
# The configured local registry mirror currently returns 401 for the slim
# manifest. Keep the runtime compatible with the verified Task5 Agent image.
FROM python:3.12

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple/
COPY services/a2a-external-agent/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements.txt

COPY services/a2a-external-agent/src/ /app/src/

ENV PYTHONPATH=/app/src \
    A2A_EXTERNAL_AGENT_PORT=8701

EXPOSE 8701

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=20s \
    CMD curl -fsS http://localhost:8701/healthz || exit 1

CMD ["uvicorn", "mate_a2a_external_agent.server:app", "--host", "0.0.0.0", "--port", "8701"]
