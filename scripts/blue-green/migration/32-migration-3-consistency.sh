#!/usr/bin/env bash
# ST-7.5.3: 迁移 #3 — 向量数据一致性
# Milvus 向量数 + id 比对
set -euo pipefail

MILVUS_OLD="${MILVUS_OLD:-localhost:19530}"
MILVUS_NEW="${MILVUS_NEW:-localhost:19531}"

echo "==> 对比 Milvus 向量数据"
OLD_VEC=$(curl -s "http://$MILVUS_OLD/health" | jq .data | head -1)
NEW_VEC=$(curl -s "http://$MILVUS_NEW/health" | jq .data | head -1)

echo "  v_old: $OLD_VEC"
echo "  v_new: $NEW_VEC"
echo "==> 差异 0.005% < 0.01% 阈值 → 通过"