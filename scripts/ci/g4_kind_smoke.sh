#!/usr/bin/env bash
# G4 K8s kind smoke test — manual run.
# Prereq: kind + helm installed locally.
set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:-mate-platform-e2e}"

echo "=== 1. kind cluster ==="
if ! kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
  kind create cluster --name "${CLUSTER_NAME}" --image kindest/node:v1.29.2 --wait 120s
fi
kind export kubeconfig --name "${CLUSTER_NAME}"

echo "=== 2. helm install ==="
helm install mate-platform infra/helm \
  --values infra/helm/values-local.yaml \
  --namespace metaplatform \
  --create-namespace \
  --wait --timeout 5m

echo "=== 3. smoke ==="
kubectl -n metaplatform get pods
kubectl -n metaplatform wait pod -l app.kubernetes.io/name=keycloak \
  --for=condition=Ready --timeout=180s
kubectl -n metaplatform wait pod -l app.kubernetes.io/name=otel-collector \
  --for=condition=Ready --timeout=180s
kubectl -n metaplatform get networkpolicy | grep default-deny

echo "=== 4. cleanup ==="
helm uninstall mate-platform --namespace metaplatform
kind delete cluster --name "${CLUSTER_NAME}"
echo "=== G4 kind smoke PASS ==="
