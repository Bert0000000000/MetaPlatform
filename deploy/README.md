# MetaPlatform Deployment Guide

Production-ready Kubernetes manifests, Helm chart, and ArgoCD configuration.

## Directory Layout

```
deploy/
├── kubernetes/
│   ├── base/                          # Raw K8s manifests (used by overlays)
│   │   ├── namespace.yaml             # Namespace + common labels
│   │   ├── configmap.yaml             # API env config (non-secret)
│   │   ├── secret.yaml                # API secret template (CHANGE_ME)
│   │   ├── api-deployment.yaml        # API Deployment (3 replicas)
│   │   ├── api-service.yaml           # ClusterIP Service
│   │   ├── frontend-deployment.yaml   # Static-site Deployment
│   │   ├── frontend-service.yaml      # ClusterIP Service
│   │   ├── frontend-config.yaml       # Nginx config + site ConfigMap
│   │   ├── ingress.yaml               # Ingress with TLS + security headers
│   │   ├── hpa.yaml                   # HPA (3-10) + PDB (min 2)
│   │   ├── servicemonitor.yaml        # ServiceMonitor + PrometheusRule
│   │   └── kustomization.yaml
│   └── overlays/
│       ├── dev/                       # dev overlay (1 replica, dev host)
│       └── prod/                      # prod overlay (5 replicas, prod host)
│
├── helm/
│   └── metaplatform/                  # Helm chart
│       ├── Chart.yaml
│       ├── values.yaml
│       └── templates/
│           ├── _helpers.tpl
│           ├── configmap.yaml
│           ├── api-deployment.yaml
│           ├── api-service.yaml
│           ├── frontend-deployment.yaml
│           ├── ingress.yaml
│           ├── hpa.yaml
│           └── servicemonitor.yaml
│
└── argocd/
    ├── app-dev.yaml                   # ArgoCD App for dev overlay
    └── app-prod.yaml                  # ArgoCD App for prod overlay + AppProject
```

## Prerequisites

- Kubernetes 1.27+
- Ingress controller (e.g. [ingress-nginx](https://kubernetes.github.io/ingress-nginx/))
- cert-manager (for the `letsencrypt-prod` ClusterIssuer referenced in Ingress annotations)
- Prometheus Operator (for `ServiceMonitor` and `PrometheusRule` CRDs)
- ArgoCD (if using GitOps path)

## Quick Start — Kustomize (no Helm)

```bash
# Apply dev overlay
kubectl apply -k deploy/kubernetes/overlays/dev

# Apply prod overlay
kubectl apply -k deploy/kubernetes/overlays/prod
```

## Quick Start — Helm

```bash
# Install with default values
helm install metaplatform deploy/helm/metaplatform \
  --namespace metaplatform --create-namespace

# Install with custom values
helm install metaplatform deploy/helm/metaplatform \
  --namespace metaplatform --create-namespace \
  -f my-values.yaml \
  --set replicaCount=5 \
  --set autoscaling.maxReplicas=20

# Upgrade
helm upgrade metaplatform deploy/helm/metaplatform -n metaplatform

# Render templates locally
helm template metaplatform deploy/helm/metaplatform > rendered.yaml
```

## Quick Start — ArgoCD (GitOps)

```bash
# Apply the AppProject + Applications
kubectl apply -f deploy/argocd/

# Then in ArgoCD UI:
# - metaplatform-dev  →  metaplatform-dev namespace
# - metaplatform-prod →  metaplatform-prod namespace
```

## Secrets Management

The provided `secret.yaml` is a **template only** — every value contains `CHANGE_ME`.
In production, replace it with one of:

- **Sealed Secrets** (`kubeseal` + `SealedSecret` controller)
- **External Secrets Operator** (pulls from AWS Secrets Manager / Vault / GCP Secret Manager)
- **HashiCorp Vault** with the Vault CSI provider

Example using External Secrets:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: metaplatform-api-secret
  namespace: metaplatform
spec:
  secretStoreRef: { name: vault, kind: ClusterSecretStore }
  target: { name: metaplatform-api-secret }
  data:
    - secretKey: JWT_SECRET
      remoteRef: { key: metaplatform/api, property: jwt_secret }
    - secretKey: LLM_API_KEY
      remoteRef: { key: metaplatform/api, property: openai_key }
```

## Container Image

The manifests reference `metaplatform/api:1.5.0`. Build & push:

```bash
cd metaplatform-api
docker build -t metaplatform/api:1.5.0 .
docker push metaplatform/api:1.5.0
```

(See `metaplatform-api/Dockerfile` if present; otherwise generate with `npm run build` then
use a standard `node:20-slim` runtime image.)

## Backend Storage Services

The chart assumes the following services exist in the cluster (configured via `backends.*`):

| Backend       | Service name (default)         | Provisioned by                                |
|---------------|--------------------------------|-----------------------------------------------|
| PostgreSQL    | metaplatform-postgres          | Bitnami Helm chart / Cloud SQL / RDS          |
| Redis         | metaplatform-redis             | Bitnami Helm chart / ElastiCache              |
| Neo4j         | metaplatform-neo4j             | Neo4j Helm chart / Neo4j Aura                |
| Elasticsearch | metaplatform-elasticsearch     | Elastic Helm chart / ECK                      |
| MinIO         | metaplatform-minio             | MinIO Operator / AKS S3 / Rook-Ceph          |
| Kafka         | metaplatform-kafka             | Strimzi / Confluent                           |
| ClickHouse    | metaplatform-clickhouse        | Altinity clickhouse-operator / ClickHouse Cloud |

The dev docker-compose in the repo root can stand up local versions for testing.

## Observability

The chart installs:

- A `ServiceMonitor` so Prometheus Operator scrapes `/api/observability/metrics`
- A `PrometheusRule` with 4 alerts:
  - **MetaPlatformAPIDown** — instance unreachable for 2m (critical)
  - **MetaPlatformBackendUnreachable** — any backend down 5m (warning)
  - **MetaPlatformHighErrorRate** — 5xx > 5% for 10m (warning)
  - **MetaPlatformHighLatency** — p95 latency > 1s for 10m (warning)

Grafana dashboards can import the metrics directly:
- `rate(metaplatform_http_requests_total[5m])` for request rate
- `histogram_quantile(0.95, sum by (route, le) (rate(metaplatform_http_request_duration_seconds_bucket[5m])))` for p95 latency
- `metaplatform_backend_up` for backend health matrix
- `metaplatform_cdc_events_emitted_total` for CDC pipeline throughput

## Capacity Planning

Production sizing (per pod):

| Tier    | CPU req | CPU limit | Memory req | Memory limit |
|---------|---------|-----------|------------|--------------|
| dev     | 100m    | -         | 256Mi      | -            |
| staging | 250m    | 1000m     | 512Mi      | 1.5Gi        |
| prod    | 500m    | 2000m     | 1Gi        | 3Gi          |

HPA scales on CPU (70%) and memory (75%). Default `min: 3 / max: 10`; tune in
`values.yaml` or `hpa.yaml` for your workload.

## Validation

A standalone Python validator (`scripts/validate-k8s.py`) checks every YAML:

```bash
python scripts/validate-k8s.py .
# Expected: "All K8s manifests valid!"
```

It verifies:
- Valid YAML syntax
- Required K8s fields (`apiVersion`, `kind`, `metadata.name`)
- `metadata.name` matches K8s naming rules
- Namespaced resources have `metadata.namespace`
- Kustomize overlays reference real base resources
- Helm chart has `Chart.yaml`, `values.yaml`, `templates/`
- Helm templates render to at least one valid K8s document

## Upgrade Strategy

1. Bump `image.tag` and `Chart.yaml` version
2. Update `Chart.yaml` `appVersion`
3. Commit to `main`
4. ArgoCD detects the change and syncs (auto-sync enabled)
5. Rolling update: `maxSurge: 1`, `maxUnavailable: 0` (zero downtime)
6. Verify with `kubectl rollout status deployment/metaplatform-api`

## Rollback

- **ArgoCD UI** → click History → Rollback to previous revision
- **Helm CLI**: `helm rollback metaplatform <revision>`
- **Kustomize**: `kubectl rollout undo deployment/metaplatform-api -n metaplatform`

## Manifest Validation (Phase 6 Test Result)

Last run: **26 files / 17 K8s objects / 0 errors / 0 warnings** — see
`test-phase6-v2.py` for the validator script.