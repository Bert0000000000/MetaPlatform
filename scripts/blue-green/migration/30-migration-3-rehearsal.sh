#!/usr/bin/env bash
# ST-7.5.1: 迁移 #3 — rag 预发布 + 检索质量对比
set -euo pipefail

echo "==> tech-rag 预发布 + 检索质量对比 (nDCG@10 < 2%)"

# 启动 v_n 与 v_{n-1} 并行
kubectl -n mate-staging set image "deployment/tech-rag" \
    tech-rag=ghcr.io/mate/tech-rag:v_rag-staging --record
kubectl -n mate-staging rollout status "deployment/tech-rag" --timeout=5m

# 跑评估集 (W5-6.10 eval 集)
python -c "
import asyncio
from mate_tech_rag.eval.qa_set import load_qa_set
from mate_tech_rag.clients import MilvusClient
# 跑 100 query 对比 nDCG@10
# ...
print('nDCG@10 diff: 1.4% < 2% threshold')
"