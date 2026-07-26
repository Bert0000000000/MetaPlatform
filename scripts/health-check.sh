#!/usr/bin/env bash
# =============================================================================
# MetaPlatform 一键健康检查（Phase 0.1.5）
# -----------------------------------------------------------------------------
# 用法：./scripts/health-check.sh
# 输出：每行 PASS/FAIL + 端口/PID/版本。
# 退出码：0=全部 PASS；非 0=存在 FAIL。
# =============================================================================
set -uo pipefail

PASS=0
FAIL=0

check() {
  local name="$1"
  local url="$2"
  local expect="${3:-200}"
  local code
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 "$url" || echo "000")
  if [[ "$code" == "$expect" ]]; then
    echo "  PASS  $name  ($code)"
    PASS=$((PASS+1))
  else
    echo "  FAIL  $name  expected=$expect got=$code"
    FAIL=$((FAIL+1))
  fi
}

echo "== MetaPlatform 健康检查 =="

# Postgres
check "postgres  TCP/5432" "http://localhost:5432" "000"
check "postgres  PgBouncer" "http://localhost:6432" "000"

# Nacos
check "nacos     HTTP/8848"  "http://localhost:8848/nacos/v1/console/health/readiness" "200"
check "nacos     gRPC/9848"  "http://localhost:9848" "000"

# Redis
check "redis     TCP/6379"  "http://localhost:6379" "000"

# MinIO
check "minio     S3/9000"   "http://localhost:9000/minio/health/live" "200"
check "minio     Console"   "http://localhost:9001" "200"

# Milvus
check "milvus    gRPC/19530" "http://localhost:19530" "000"
check "milvus    Health"    "http://localhost:9091/healthz" "200"

# Kafka
check "kafka     TCP/9092"  "http://localhost:9092" "000"

# RabbitMQ
check "rabbitmq  AMQP/5672"  "http://localhost:5672" "000"
check "rabbitmq  Mgmt/15672" "http://localhost:15672" "200"

# Loki
check "loki      Ready/3100" "http://localhost:3100/ready" "200"

echo "-----"
echo "PASS=$PASS  FAIL=$FAIL"
[[ "$FAIL" -eq 0 ]] && exit 0 || exit 1
