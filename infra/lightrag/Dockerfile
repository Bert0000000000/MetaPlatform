# LightRAG HTTP server (HKUDS/LightRAG)
# 官方仓库: https://github.com/HKUDS/LightRAG
# pip 包提供了 lightrag-server 命令, 启动后默认监听 9621

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 安装 lightrag (含 HTTP server 子命令)
RUN pip install --no-cache-dir "lightrag-hku[api]==1.4.0" || \
    pip install --no-cache-dir "lightrag==1.4.0"

# 数据目录
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 9621

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=30s \
    CMD curl -fsS http://localhost:9621/health || exit 1

# 注意: lightrag-server 命令在 lightrag>=1.3 提供
# 若你的版本没有, 改成: CMD ["uvicorn", "lightrag.api.lightrag_server:app", "--host", "0.0.0.0", "--port", "9621"]
CMD ["lightrag-server", "--host", "0.0.0.0", "--port", "9621"]