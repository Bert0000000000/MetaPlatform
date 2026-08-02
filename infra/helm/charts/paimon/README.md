# paimon

![Version: 0.1.0](https://img.shields.io/badge/Version-0.1.0-informational?style=flat-square)
![AppVersion: 0.8](https://img.shields.io/badge/AppVersion-0.8-informational?style=flat-square)

Apache Paimon streaming data lake storage. Provides the REST
catalog server consumed by Flink / Spark table store workloads and
the CDC → data lake pipeline (D0 Debezium → Paimon tables).

**Homepage:** <https://github.com/Bert0000000000/MetaPlatform>

## Maintainers

| Name | Email |
|------|-------|
| MetaPlatform Platform Owner | platform@metaplatform.local |

## TL;DR

```bash
# Render the chart locally
helm template paimon . -f values.yaml

# Lint
helm lint . -f values.yaml

# Production overlay
helm template paimon . -f ../../values-production.yaml
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  StatefulSet (paimon)                                    │
│  ┌─────────────────────────────────────────────────┐    │
│  │  apache/paimon:0.8 container                    │    │
│  │  catalog mode: filesystem (S3 warehouse)        │    │
│  │  env: PAIMON_* (ConfigMap + CDC + tenant)       │    │
│  │  probe: httpGet /health/ready :8081             │    │
│  │  volume: /opt/paimon/data (PVC or emptyDir)     │    │
│  └─────────────────────────────────────────────────┘    │
│  volumeClaimTemplates (PVC) or emptyDir                   │
├─────────────────────────────────────────────────────────┤
│  ConfigMap     → catalog config (mode / warehouse / CDC)  │
│  Service       → paimon:8081 (ClusterIP)                  │
│  Service       → paimon-headless:8081 (clusterIP: None)   │
│  NetworkPolicy → default-deny, platform ns only           │
└─────────────────────────────────────────────────────────┘
```

## CDC Integration Path

```
PostgreSQL ──▶ Debezium ──▶ Kafka (mate.cdc.*) ──▶ Paimon lake tables
                (D0)            (CDC topics)        (tenant-isolated)
```

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| fullnameOverride | string | `"paimon"` | Forces service DNS name to `paimon` |
| replicaCount | int | `2` | Number of catalog servers |
| image.repository | string | `"apache/paimon"` | Image repository |
| image.tag | string | `"0.8"` | Image tag |
| image.pullPolicy | string | `"IfNotPresent"` | Image pull policy |
| catalog.mode | string | `"filesystem"` | Catalog mode (filesystem \| hive \| jdbc) |
| catalog.warehouse | string | `"s3://mate-platform/data-lake"` | Warehouse location |
| catalog.hive_metastore | string | `""` | Hive metastore URI (mode=hive) |
| resources.requests | object | `{memory:"1Gi",cpu:"500m"}` | Resource requests |
| resources.limits | object | `{memory:"2Gi",cpu:"1"}` | Resource limits |
| persistence.enabled | bool | `true` | Use PVC (true) or emptyDir (false) |
| persistence.size | string | `"100Gi"` | Volume size |
| persistence.storageClass | string | `""` | StorageClass (empty = cluster default) |
| tables.autoCreate | bool | `true` | Auto-create lake tables |
| tables.formats | list | `[orc, parquet]` | Supported table formats |
| tables.retention.enabled | bool | `true` | Enable table retention |
| tables.retention.days | int | `90` | Retention window (days) |
| cdc.enabled | bool | `true` | Enable CDC integration |
| cdc.debeziumConnector | string | `"mate-platform-debezium"` | Debezium connector name |
| cdc.topics.prefix | string | `"mate.cdc."` | CDC Kafka topic prefix |
| tenantIsolation.enabled | bool | `true` | Per-tenant table prefix isolation |
| tenantIsolation.tablePrefix | string | `"tenant_"` | Table prefix convention |
| service.type | string | `"ClusterIP"` | Service type |
| service.port | int | `8081` | REST catalog port |
| networkPolicy.enabled | bool | `true` | Enable default-deny NetworkPolicy |
| networkPolicy.allowedIngressNamespaces | list | `["metaplatform"]` | Namespaces allowed to reach 8081 |

## Hard Rules Enforced

- **§13 rule 8** (K8s readiness + rollback): StatefulSet has
  `livenessProbe` + `readinessProbe` (HTTP GET /health); PVC-backed
  `volumeClaimTemplates` ensure data survives pod restarts.
- **§13 rule 13** (NetworkPolicy default-deny): `policyTypes:
  [Ingress, Egress]` with ingress restricted to `metaplatform`
  namespace on port 8081; egress restricted to DNS.
- **§13 rule 3** (tenant context): tenantIsolation.enabled +
  per-tenant table prefix.

## References

- [ADR-0016: Business slices](../../docs/active/decisions/ADR-0016-business-slices.md)
- [Production readiness design (13 hard rules)](../../docs/active/specs/2026-07-30-backend-production-readiness-design.md)
