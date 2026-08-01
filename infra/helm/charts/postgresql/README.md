# postgresql

![Version: 0.1.0](https://img.shields.io/badge/Version-0.1.0-informational?style=flat-square)
![AppVersion: 16](https://img.shields.io/badge/AppVersion-16-informational?style=flat-square)

PostgreSQL 16 for MetaPlatform. StatefulSet with PVC persistence,
ConfigMap-driven connection pool parameters, and SealedSecret-based
credentials.

**Homepage:** <https://github.com/Bert0000000000/MetaPlatform>

## Maintainers

| Name | Email |
|------|-------|
| MetaPlatform Platform Owner | platform@metaplatform.local |

## TL;DR

```bash
# Render the chart locally
helm dependency update
helm template postgresql . -f values.yaml

# Lint
helm lint .

# Production overlay
helm template postgresql . -f ../../values-production.yaml
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│  StatefulSet (postgresql)                        │
│  ┌───────────────────────────────────────────┐  │
│  │  postgres:16 container                    │  │
│  │  env: POSTGRES_DB (ConfigMap)             │  │
│  │       POSTGRES_USER (ConfigMap)           │  │
│  │       POSTGRES_PASSWORD (Secret)          │  │
│  │       MATE_DB_URL (env var, $(PASSWORD))  │  │
│  │  probe: pg_isready                        │  │
│  │  volume: /var/lib/postgresql/data         │  │
│  └───────────────────────────────────────────┘  │
│  volumeClaimTemplates (PVC) or emptyDir          │
├─────────────────────────────────────────────────┤
│  ConfigMap     → database-name, pool params      │
│  SealedSecret  → password, mate-db-url (hashed)  │
│  Service       → postgresql:5432 (ClusterIP)     │
│  NetworkPolicy → default-deny, platform ns only  │
└─────────────────────────────────────────────────┘
```

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| fullnameOverride | string | `"postgresql"` | Forces service DNS name to `postgresql` for MATE_DB_URL |
| image.repository | string | `"postgres"` | Image repository |
| image.tag | string | `"16"` | PostgreSQL major version |
| image.pullPolicy | string | `"IfNotPresent"` | Image pull policy |
| replicaCount | int | `1` | Number of pods (2 in production) |
| database.name | string | `"metaplatform"` | Database name (POSTGRES_DB) |
| database.username | string | `"meta"` | Database user (POSTGRES_USER) |
| database.existingSecretName | string | `"postgresql-credentials"` | Secret name (SealedSecret) |
| database.existingSecretKey | string | `"password"` | Secret key holding the password |
| pool.size | int | `10` | SQLAlchemy pool_size (ConfigMap) |
| pool.maxOverflow | int | `20` | SQLAlchemy max_overflow (ConfigMap) |
| persistence.enabled | bool | `false` | Use PVC (true) or emptyDir (false) |
| persistence.size | string | `"50Gi"` | PVC size when enabled |
| persistence.storageClass | string | `""` | StorageClass (empty = cluster default) |
| service.type | string | `"ClusterIP"` | Service type |
| service.port | int | `5432` | PostgreSQL port |
| resources | object | `{"requests":{"cpu":"250m","memory":"256Mi"},"limits":{"cpu":"1000m","memory":"1Gi"}}` | Resource shape |
| probes.readiness.initialDelaySeconds | int | `15` | Readiness probe initial delay |
| probes.readiness.periodSeconds | int | `10` | Readiness probe period |
| probes.liveness.initialDelaySeconds | int | `30` | Liveness probe initial delay |
| probes.liveness.periodSeconds | int | `30` | Liveness probe period |
| networkPolicy.enabled | bool | `true` | Enable default-deny NetworkPolicy |
| networkPolicy.allowedIngressNamespaces | list | `["metaplatform","api-gateway"]` | Namespaces allowed to reach 5432 |
| sealedSecret.enabled | bool | `true` | Render SealedSecret placeholder template |

## Hard Rules Enforced

- **§13 rule 5** (production profile forbids SQLite fallback):
  The StatefulSet provides a real PostgreSQL instance; the
  `MATE_DB_URL` env var points the backend at `postgresql:5432`
  instead of any SQLite fallback.
- **§13 rule 8** (K8s readiness + rollback): StatefulSet has
  `livenessProbe` + `readinessProbe` (both `pg_isready`); PVC-backed
  `volumeClaimTemplates` ensure data survives pod restarts.
- **§13 rule 12** (Secret not in git): Credentials are delivered via
  `SealedSecret` (bitnami.com/v1alpha1). The template ships with
  placeholder `encryptedData` that MUST be regenerated with `kubeseal`
  before cluster apply. No plaintext secret ever enters git.
- **§13 rule 13** (NetworkPolicy default-deny): `policyTypes: [Ingress,
  Egress]` with ingress restricted to `metaplatform` and `api-gateway`
  namespaces on port 5432; egress restricted to DNS (kube-system:53).

## SealedSecret Provisioning

The rendered `SealedSecret` contains **placeholder** encrypted data.
Before applying to any cluster, regenerate it:

```bash
# 1. Create a local plaintext Secret (never commit this):
cat <<'EOF' > /tmp/pg-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: postgresql-credentials
  namespace: metaplatform
type: Opaque
stringData:
  password: "<your-strong-password>"
  mate-db-url: "postgresql://meta:<your-strong-password>@postgresql:5432/metaplatform"
EOF

# 2. Seal it:
kubeseal --format yaml < /tmp/pg-secret.yaml > templates/sealedsecret.yaml

# 3. Shred the plaintext:
shred -u /tmp/pg-secret.yaml
```

## References

- [ADR-0010: Platform K8s baseline](../../docs/active/decisions/ADR-0010-platform-k8s-baseline.md)
- [ADR-0015: GA Acceptance policy](../../docs/active/decisions/ADR-0015-ga-acceptance.md)
- [Production readiness design (13 hard rules)](../../docs/active/specs/2026-07-30-backend-production-readiness-design.md)
