#!/usr/bin/env bash
# ST-7.1.5: 验证影子流量 — trace_id 关联
set -euo pipefail

# 1. 模拟生产请求
RESP=$(curl -sS -X POST http://localhost:8080/api/v1/msg/publish \
    -H "Content-Type: application/json" \
    -H "X-Trace-Id: test-trace-001" \
    -d '{"topic":"t","payload":{"x":1}}')

# 2. 检查 staging 日志
sleep 2
if docker logs mate-tech-msg-staging 2>/dev/null | grep -q "test-trace-001"; then
    echo "==> 影子流量 trace_id 关联成功"
    exit 0
else
    echo "==> 影子流量未找到 trace_id"
    exit 1
fi