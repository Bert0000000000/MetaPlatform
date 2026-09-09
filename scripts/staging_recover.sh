#!/usr/bin/env bash
# staging 恢复编排：等 apiserver → realm CM → helm upgrade（trino 修复）→ 重启异常 pod → 等待 Ready
OUT=/tmp/staging-recover.log
: > $OUT
log() { echo "[$(date +%H:%M:%S)] $*" >> $OUT; }

wait_apiserver() {
  for i in $(seq 1 40); do
    if kubectl get ns --request-timeout=10s >/dev/null 2>&1; then return 0; fi
    sleep 20
  done
  return 1
}

log "waiting for apiserver"
wait_apiserver || { log "APISERVER NEVER CAME BACK"; exit 1; }
log "apiserver up"

log "apply realm configmap"
for i in $(seq 1 10); do
  kubectl apply --validate=false -f infra/helm/crds/keycloak-realm-configmap.yaml -n mate-staging >> $OUT 2>&1 && break
  sleep 15
done

log "helm upgrade (trino chart fix)"
for i in $(seq 1 6); do
  helm upgrade mate-staging infra/helm -f infra/helm/values-local.yaml -n mate-staging \
    --set marketplace.enabled=false --set kafka.enabled=false --set datahub.enabled=false \
    --set paimon.enabled=false --set iceberg.enabled=false --set marquez.enabled=false \
    --set ge.enabled=false --set deerflow-engine.enabled=false --set starrocks.enabled=false \
    --set debezium.enabled=false --set otel-collector.serviceMonitor.enabled=false \
    --set keycloak.image.tag=25.0 --set otel-collector.image.tag=0.110.0 \
    --timeout 300s >> $OUT 2>&1 && { log "upgrade OK"; break; }
  log "upgrade retry $i"
  wait_apiserver
  sleep 10
done

log "delete failing pods to force recreate"
for p in trino-coordinator trino-worker; do
  kubectl delete pod -n mate-staging -l app.kubernetes.io/component=$p --force --grace-period=0 >> $OUT 2>&1
done
kubectl delete pod -n mate-staging mate-staging-keycloak-0 mate-staging-otel-collector-69c7458b57-9nc9n --force --grace-period=0 >> $OUT 2>&1

log "waiting for readiness (10 min)"
for i in $(seq 1 40); do
  R=$(kubectl get pods -n mate-staging --no-headers 2>/dev/null | grep -c "1/1")
  T=$(kubectl get pods -n mate-staging --no-headers 2>/dev/null | wc -l)
  log "ready $R/$T"
  if [ "$T" -gt 0 ] && [ "$R" -eq "$T" ]; then log "ALL PODS READY"; break; fi
  sleep 15
done
kubectl get pods -n mate-staging >> $OUT 2>&1
log "done"
