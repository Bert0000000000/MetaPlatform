#!/usr/bin/env bash
# ST-7.3.2: 迁移 #1 — 数据双写
# 生产 tech-msg 同时写 v_n + v_{n-1}（用于对比）
set -euo pipefail

echo "==> 启用数据双写（生产端 tech-msg v_n + v_{n-1}）"

# 部署 v_n 与 v_{n-1} 并行
kubectl -n mate-prod set image "deployment/tech-msg-v_new" \
    tech-msg=ghcr.io/mate/tech-msg:v_msg-new --record
kubectl -n mate-prod set image "deployment/tech-msg-v_old" \
    tech-msg=ghcr.io/mate/tech-msg:v_msg-old --record

# 两个版本同时运行
kubectl -n mate-prod scale deployment/tech-msg-v_new --replicas=1
kubectl -n mate-prod scale deployment/tech-msg-v_old --replicas=1

# 双写开关（env）
echo "==> 设置 DUAL_WRITE=true 环境变量"
kubectl -n mate-prod set env deployment/tech-msg-v_new DUAL_WRITE=true
kubectl -n mate-prod set env deployment/tech-msg-v_old DUAL_WRITE=true

echo "==> 双写期：3 天后比较两端数据差异"
echo "  比较脚本：bash 11-migration-1-check-diff.sh"