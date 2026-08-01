# kafka

![Version: 0.1.0](https://img.shields.io/badge/Version-0.1.0-informational?style=flat-square)
![AppVersion: 3.7.1](https://img.shields.io/badge/AppVersion-3.7.1-informational?style=flat-square)

Apache Kafka 3.7 in KRaft mode (no Zookeeper). Closes the
PLATFORM-K8S-01 / PLATFORM-EVENT-01 placeholder.

**Homepage:** <https://github.com/Bert0000000000/MetaPlatform>

## Maintainers

| Name | Email |
|------|-------|
| MetaPlatform Platform Owner | platform@metaplatform.local |

## TL;DR

```bash
# Render the chart locally
helm dependency update
helm template kafka . -f values.yaml

# Lint
helm lint . -f values.yaml

# Production overlay
helm template kafka . -f ../../values-production.yaml
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  StatefulSet (kafka)                                     │
│  ┌─────────────────────────────────────────────────┐    │
│  │  bitnami/kafka:3.7.1 container                  │    │
│  │  KRaft: process.roles=controller,broker         │    │
│  │  env: KAFKA_CFG_* (ConfigMap + dynamic)         │    │
│  │  probe: tcpSocket :9092                         │    │
│  │  volume: /bitnami/kafka (PVC or emptyDir)       │    │
│  └─────────────────────────────────────────────────┘    │
│  volumeClaimTemplates (PVC) or emptyDir                   │
├─────────────────────────────────────────────────────────┤
│  ConfigMap     → broker tuning (partitions, retention)    │
│  Service       → kafka:9092 (ClusterIP)                   │
│  Service       → kafka-headless:9092 (clusterIP: None)    │
│  NetworkPolicy → default-deny, platform ns only           │
│  ZooKeeper     → (optional, kraft.enabled=false)          │
└─────────────────────────────────────────────────────────┘
```

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| fullnameOverride | string | `"kafka"` | Forces service DNS name to `kafka` for bootstrap servers |
| image.registry | string | `"docker.io"` | Image registry |
| image.repository | string | `"bitnami/kafka"` | Image repository |
| image.tag | string | `"3.7.1"` | Image tag (KRaft mode) |
| image.pullPolicy | string | `"IfNotPresent"` | Image pull policy |
| kraft.enabled | bool | `true` | Use KRaft (no Zookeeper) |
| kraft.clusterId | string | `"metaplatform-kraft-cluster"` | KRaft cluster id |
| replicaCount | int | `3` | Number of brokers (G1 default; 1 in local dev) |
| resources | object | `{"requests":{"cpu":1,"memory":"2Gi"},"limits":{"cpu":2,"memory":"4Gi"}}` | Resource shape (prod 4Gi/2CPU) |
| persistence.enabled | bool | `true` | Use PVC (true) or emptyDir (false) |
| persistence.size | string | `"50Gi"` | Volume size |
| persistence.storageClass | string | `""` | StorageClass (empty = cluster default) |
| autoScaling.enabled | bool | `true` | Resource governance flag (requests/limits declared) |
| tenantIsolation.enabled | bool | `true` | Per-tenant topic prefix isolation |
| tenantIsolation.topicPrefix | string | `"tenant"` | Topic prefix convention |
| config.auto.create.topics.enable | string | `"false"` | Topics are explicit (PLATFORM-EVENT-01) |
| config.default.replication.factor | string | `"1"` | 3 in production |
| config.num.partitions | string | `"6"` | Default partition count |
| config.log.retention.hours | string | `"72"` | Retention |
| config.compression.type | string | `"producer"` | Producer-side compression |
| topics.preCreate | bool | `true` | Pre-create 17 domain topics at install |
| topics.domains | list | 17 domains | Partition defaults per domain |
| service.type | string | `"ClusterIP"` | Service type |
| service.ports.client | int | `9092` | Client port |
| service.ports.internal | int | `9094` | Internal port |
| schemaRegistry.enabled | bool | `true` | Confluent Schema Registry |
| schemaRegistry.image.repository | string | `"confluentinc/cp-schema-registry"` | |
| schemaRegistry.image.tag | string | `"7.6.1"` | |
| schemaRegistry.service.port | int | `8081` | Schema Registry port |
| zookeeper.replicaCount | int | `1` | ZK replicas (only when kraft.enabled=false) |
| zookeeper.image.repository | string | `"bitnami/zookeeper"` | ZK image |
| zookeeper.image.tag | string | `"3.9.2"` | ZK image tag |
| zookeeper.persistence.enabled | bool | `false` | ZK PVC toggle |
| probes.readiness.initialDelaySeconds | int | `10` | Readiness probe initial delay |
| probes.readiness.periodSeconds | int | `10` | Readiness probe period |
| probes.liveness.initialDelaySeconds | int | `30` | Liveness probe initial delay |
| probes.liveness.periodSeconds | int | `30` | Liveness probe period |
| networkPolicy.enabled | bool | `true` | Enable default-deny NetworkPolicy |
| networkPolicy.allowedIngressNamespaces | list | `["metaplatform","api-gateway"]` | Namespaces allowed to reach 9092 |

## Hard Rules Enforced

- **§13 rule 8** (K8s readiness + rollback): StatefulSet has
  `livenessProbe` + `readinessProbe` (both tcpSocket :9092);
  PVC-backed `volumeClaimTemplates` ensure data survives pod
  restarts (production); default replicaCount=1 for dev, 3 in
  production (per values-production.yaml).
- **§13 rule 13** (NetworkPolicy default-deny): `policyTypes:
  [Ingress, Egress]` with ingress restricted to `metaplatform`
  and `api-gateway` namespaces on port 9092 (+ 9093 controller
  in KRaft mode); egress restricted to DNS (kube-system:53).
- **§13 rule 12** (Secret not in git): KRaft cluster id is a
  value override, not embedded in the chart. SASL_SSL credentials
  would be delivered via SealedSecret (not included in this chart).
- **§13 rule 11** (helm-docs sync): This README is kept in sync
  with values.yaml; CI job `ga-011-helm-docs` verifies.

## KRaft vs ZooKeeper

The chart defaults to **KRaft mode** (no ZooKeeper dependency),
which is the production preference per ADR-0013. To fall back to
ZooKeeper mode (e.g. for older Kafka < 3.3):

```yaml
kraft:
  enabled: false
zookeeper:
  replicaCount: 3
  persistence:
    enabled: true
    size: 4Gi
```

When `kraft.enabled: false`, the `zookeeper.yaml` template renders
a ZooKeeper StatefulSet + headless Service, and the Kafka broker
connects to `<release>-kafka-zookeeper-headless:2181`.

## References

- [ADR-0015: GA Acceptance policy](../../docs/active/decisions/ADR-0015-ga-acceptance.md)
- [ADR-0013: PLATFORM-EVENT-01 Outbox](../../docs/active/decisions/ADR-0013-platform-event-outbox.md)
- [ADR-0010: Platform K8s baseline](../../docs/active/decisions/ADR-0010-platform-k8s-baseline.md)
- [Production readiness design (13 hard rules)](../../docs/active/specs/2026-07-30-backend-production-readiness-design.md)
