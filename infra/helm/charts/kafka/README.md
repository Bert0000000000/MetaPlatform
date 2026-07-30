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
helm template kafka . -f values-local.yaml

# Lint
helm lint . -f values-local.yaml
```

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| image.registry | string | `"docker.io"` | Image registry |
| image.repository | string | `"bitnami/kafka"` | Image repository |
| image.tag | string | `"3.7.1"` | Image tag (KRaft mode) |
| image.pullPolicy | string | `"IfNotPresent"` | Image pull policy |
| kraft.enabled | bool | `true` | Use KRaft (no Zookeeper) |
| kraft.clusterId | string | `"metaplatform-kraft-cluster"` | KRaft cluster id |
| replicaCount | int | `1` | Number of brokers (3 in production) |
| resources | object | `{"requests":{"cpu":"250m","memory":"512Mi"},"limits":{"cpu":"1000m","memory":"1Gi"}}` | Resource shape |
| persistence.enabled | bool | `true` | Use persistent volume |
| persistence.size | string | `"8Gi"` | Volume size |
| config.auto.create.topics.enable | string | `"false"` | Topics are explicit (PLATFORM-EVENT-01) |
| config.default.replication.factor | string | `"1"` | 3 in production |
| config.num.partitions | string | `"6"` | Default partition count |
| config.log.retention.hours | string | `"72"` | Retention |
| config.compression.type | string | `"producer"` | Producer-side compression |
| topics.preCreate | bool | `true` | Pre-create 17 domain topics at install |
| topics.domains | list | 17 domains | Partition defaults per domain |
| service.type | string | `"ClusterIP"` | Service type |
| service.ports.client | int | `9092` | Client port |
| schemaRegistry.enabled | bool | `true` | Confluent Schema Registry |
| schemaRegistry.image.repository | string | `"confluentinc/cp-schema-registry"` | |
| schemaRegistry.image.tag | string | `"7.6.1"` | |
| schemaRegistry.service.port | int | `8081` | Schema Registry port |

## Hard Rules Enforced

- §13 rule 8 (K8s readiness + rollback): StatefulSet has
  livenessProbe + readinessProbe; default replicaCount=1 for
  dev, 3 in production (per values-production.yaml).
- §13 rule 13 (NetworkPolicy): default-deny with explicit allow
  from metaplatform namespace to 9092 (client) + 8081 (schema
  registry), plus DNS egress.
- §13 rule 12 (Secret not in git): KRaft cluster id is a value
  override, not embedded in the chart.

## References

- [ADR-0015: GA Acceptance policy](../../docs/active/decisions/ADR-0015-ga-acceptance.md)
- [ADR-0013: PLATFORM-EVENT-01 Outbox](../../docs/active/decisions/ADR-0013-platform-event-outbox.md)
- [ADR-0010: Platform K8s baseline](../../docs/active/decisions/ADR-0010-platform-k8s-baseline.md)