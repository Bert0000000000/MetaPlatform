#!/usr/bin/env bash
# staging 镜像预拉：daocloud/quay 镜像源拉取 → 重打原 tag → kind load
# 用法: bash scripts/staging_prepull.sh <kind-cluster-name>
set -u
CLUSTER="${1:-desktop}"
OUT=/tmp/prepull.log
: > $OUT

IMAGES=(
  "postgres:16"
  "bitnami/kafka:3.7.1"
  "bitnami/postgresql:16"   # postgresql subchart 若用 bitnami
  "trinodb/trino:435"
  "starrocks/fe-ubuntu:3.3"
  "starrocks/be-ubuntu:3.3"
  "apache/paimon:0.8"
  "apache/iceberg-rest-fixture:1.4"
  "acryldata/datahub-gms:0.13.0"
  "marquezproject/marquez:0.30.0"
  "great_expectations/great_expectations:1.0.0"
  "bytedance/deer-flow:latest"
  "otel/opentelemetry-collector-contrib:0.110.0"
)
QUAY_IMAGES=(
  "quay.io/debezium/server:2.7.0.Final"
  "quay.io/keycloak/keycloak:24.0"
)

pull_one() {
  img="$1"
  mirror="docker.m.daocloud.io/$img"
  echo "[$(date +%H:%M)] pulling $mirror" >> $OUT
  if docker pull "$mirror" >> $OUT 2>&1; then
    docker tag "$mirror" "$img" >> $OUT 2>&1
    echo "[$(date +%H:%M)] OK $img" >> $OUT
    return 0
  fi
  # 回退直连
  if docker pull "$img" >> $OUT 2>&1; then
    echo "[$(date +%H:%M)] OK(direct) $img" >> $OUT
    return 0
  fi
  echo "[$(date +%H:%M)] FAIL $img" >> $OUT
  return 1
}

pids=()
for img in "${IMAGES[@]}"; do
  pull_one "$img" &
  pids+=($!)
  # 最多 4 并发
  while [ "$(jobs -r | wc -l)" -ge 4 ]; do sleep 5; done
done
for img in "${QUAY_IMAGES[@]}"; do
  mirror="quay.m.daocloud.io/${img#quay.io/}"
  echo "[$(date +%H:%M)] pulling $mirror" >> $OUT
  if docker pull "$mirror" >> $OUT 2>&1; then
    docker tag "$mirror" "$img" >> $OUT 2>&1
    echo "[$(date +%H:%M)] OK $img" >> $OUT
  else
    echo "[$(date +%H:%M)] FAIL(quay) $img" >> $OUT
  fi
done
wait

echo "== LOAD INTO KIND ==" >> $OUT
for img in "${IMAGES[@]}"; do
  kind load docker-image "$img" --name "$CLUSTER" >> $OUT 2>&1 \
    && echo "LOADED $img" >> $OUT || echo "LOADFAIL $img" >> $OUT
done
for img in "${QUAY_IMAGES[@]}"; do
  kind load docker-image "$img" --name "$CLUSTER" >> $OUT 2>&1 \
    && echo "LOADED $img" >> $OUT || echo "LOADFAIL $img" >> $OUT
done
echo "ALL DONE $(date +%H:%M)" >> $OUT
