#!/usr/bin/env bash
# D1 staging smoke — data lineage end-to-end on real K8s.
#
# Scope (per v3.2-α W3 D1 staging):
#   1. Spin up (or reuse) a kind cluster.
#   2. Install the umbrella helm chart with values-staging.yaml
#      (which loads kafka + debezium + marquez + datahub + ge).
#   3. Wait for lineage stack: debezium, marquez, datahub, ge.
#   4. Insert a CDC event into the source DB, confirm it appears in
#      marquez + datahub with tenant=tenant-staging.
#   5. Run a cross-domain lineage query and assert the dataset +
#      job + run + lineage edge are visible in the staging namespace.
#   6. Clean up.
#
# Prereqs: kind + helm + kubectl installed locally. Network access
# to the container registry. ``KUBECONFIG`` must point at a cluster
# the user can ``helm install`` into.
set -euo pipefail

CLUSTER_NAME="${CLUSTER_NAME:-mate-platform-staging}"
NAMESPACE="${NAMESPACE:-metaplatform-staging}"
VALUES_FILE="${VALUES_FILE:-infra/helm/values-staging.yaml}"

echo "=== 1. kind cluster ==="
if ! kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
  kind create cluster --name "${CLUSTER_NAME}" \
    --image kindest/node:v1.29.2 --wait 120s
fi
kind export kubeconfig --name "${CLUSTER_NAME}"

echo "=== 2. helm install (staging profile) ==="
helm install mate-platform infra/helm \
  --values "${VALUES_FILE}" \
  --namespace "${NAMESPACE}" \
  --create-namespace \
  --wait --timeout 8m

echo "=== 3. wait for lineage stack ==="
for component in debezium marquez datahub ge; do
  echo "  - waiting for ${component} pod ready"
  kubectl -n "${NAMESPACE}" wait pod \
    -l app.kubernetes.io/name="${component}" \
    --for=condition=Ready --timeout=300s
done

echo "=== 4. lineage smoke ==="
# Tenant marker; matches the data_staging_t1 used by values-staging.yaml.
TENANT_ID="${TENANT_ID:-data_staging_t1}"
kubectl -n "${NAMESPACE}" exec deploy/mate-platform-lineage \
  -- python -m mate_platform.lineage.staging_smoke \
  --tenant-id "${TENANT_ID}" \
  --expect-events 1 \
  --expect-datasets 1

echo "=== 5. cleanup ==="
helm uninstall mate-platform --namespace "${NAMESPACE}"
kind delete cluster --name "${CLUSTER_NAME}"
echo "=== D1 staging smoke PASS ==="