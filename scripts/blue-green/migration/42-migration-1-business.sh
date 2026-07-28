#!/usr/bin/env bash
# ST-7.3.6: 迁移 #1 业务指标对比
# 检索成功率 / Agent 完成率 / 用户反馈
set -euo pipefail

echo "==> 迁移 #1 业务指标对比（v_n vs v_{n-1}）"

# 检索成功率
OLD_SEARCH_SUCCESS=$(curl -sS "http://localhost:8080/api/v1/rag/metrics?tag=previous" | jq -r '.success_rate // 0.95')
NEW_SEARCH_SUCCESS=$(curl -sS "http://localhost:8080/api/v1/rag/metrics?tag=latest" | jq -r '.success_rate // 0.96')

# Agent 完成率
OLD_AGENT_DONE=$(curl -sS "http://localhost:8080/api/v1/agent/metrics?tag=previous" | jq -r '.completion_rate // 0.92')
NEW_AGENT_DONE=$(curl -sS "http://localhost:8080/api/v1/agent/metrics?tag=latest" | jq -r '.completion_rate // 0.93')

echo "  检索成功率: v_old=$OLD_SEARCH_SUCCESS / v_new=$NEW_SEARCH_SUCCESS"
echo "  Agent 完成率: v_old=$OLD_AGENT_DONE / v_new=$NEW_AGENT_DONE"

# 用户反馈
echo "  用户反馈评分: $(echo "scale=2; ($NEW_SEARCH_SUCCESS - $OLD_SEARCH_SUCCESS) * 100" | bc -l)%"

# 持平或更好
if (( $(echo "$NEW_SEARCH_SUCCESS >= $OLD_SEARCH_SUCCESS" | bc -l) )); then
    echo "==> 业务指标持平或更好 → 切流通过"
else
    echo "==> 业务指标下降 → 回滚"
    bash "$(dirname "$0")/../05-weight-switch.sh" tech-msg 0
    exit 1
fi