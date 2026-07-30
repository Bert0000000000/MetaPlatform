# metaplatform

![Version: 0.1.0](https://img.shields.io/badge/Version-0.1.0-informational?style=flat-square)
![AppVersion: 3.0.0](https://img.shields.io/badge/AppVersion-3.0.0-informational?style=flat-square)

MetaPlatform v3.0 umbrella chart - Helm baseline for the PLATFORM-K8S-01
batch. Bundles Keycloak, Postgres, Redis, Kafka, OpenTelemetry
Collector, Prometheus, Grafana, and NetworkPolicy defaults. Targets
production-readiness 13 hard rules 1, 8, 9, 12.

**Homepage:** <https://github.com/Bert0000000000/MetaPlatform>

## Maintainers

| Name | Email |
|------|-------|
| MetaPlatform Platform Owner | platform@metaplatform.local |

## Source Code

* <https://github.com/Bert0000000000/MetaPlatform>

## TL;DR

```bash
# Render the chart locally (requires helm 3.14+)
helm dependency update
helm template metaplatform . -f values-local.yaml

# Lint (CI runs this on every PR)
helm lint . -f values-local.yaml

# Strict schema check (CI)
helm template metaplatform . -f values-local.yaml | \
  kubeconform -strict -summary -kubernetes-version 1.29.0
```

## Prerequisites

- Kubernetes 1.29+
- Helm 3.14+
- For CI: helm-docs, helm-unittest, kubeconform

## Installing the Chart

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm dependency update
helm install metaplatform . -f values-production.yaml
```

## Uninstalling the Chart

```bash
helm uninstall metaplatform
```

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| global.labels | object | `{"app.kubernetes.io/part-of":"metaplatform",...}` | Labels applied to every resource. |
| global.podSecurityStandards.enforce | string | `"restricted"` | Pod Security Standards enforcement level. |
| imageRegistry | string | `"docker.io"` | Default image registry. |
| imagePullSecrets | list | `[]` | Image pull secrets. |
| serviceAccount.create | bool | `true` | Whether to create the metaplatform service account. |
| serviceAccount.name | string | `"metaplatform"` | Service account name. |
| network-policies.enabled | bool | `true` | Master switch for the network-policies sub-chart. |
| network-policies.defaultDeny.ingress | bool | `true` | Default-deny ingress for the namespace. |
| network-policies.defaultDeny.egress | bool | `true` | Default-deny egress for the namespace. |
| network-policies.allowedEgress.dns.enabled | bool | `true` | Allow DNS egress to kube-dns. |
| network-policies.allowedEgress.keycloak.enabled | bool | `true` | Allow egress to Keycloak for OIDC validation. |
| network-policies.allowedEgress.otelCollector.enabled | bool | `true` | Allow egress to the OTel collector. |
| network-policies.allowedEgress.dataPlane.enabled | bool | `true` | Allow egress to Postgres / Redis / Kafka. |
| network-policies.allowedIngress.apiGateway.enabled | bool | `true` | Allow ingress from the api-gateway namespace. |
| otel-collector.enabled | bool | `true` | Master switch for the otel-collector sub-chart. |
| otel-collector.replicaCount | int | `2` | Number of collector replicas. |
| otel-collector.image.repository | string | `"otel/opentelemetry-collector-contrib"` | OTel collector image. |
| otel-collector.image.tag | string | `"0.104.0"` | OTel collector tag (matches ADR-0010). |
| otel-collector.resources | object | `{"requests":{"cpu":"100m","memory":"256Mi"},"limits":{"cpu":"500m","memory":"512Mi"}}` | Resource requests/limits. |
| otel-collector.receivers.otlp.grpc.port | int | `4317` | OTLP gRPC port. |
| otel-collector.receivers.otlp.http.port | int | `4318` | OTLP HTTP port. |
| otel-collector.processors.batch.timeout | string | `"5s"` | Batch processor timeout. |
| otel-collector.processors.batch.sendBatchSize | int | `1000` | Batch size. |
| otel-collector.exporters.otlphttp.tracesEndpoint | string | `"http://tempo:4318"` | OTLP HTTP traces endpoint. |
| otel-collector.exporters.prometheusremotewrite.endpoint | string | `"http://prometheus:9090/api/v1/write"` | Prometheus remote write endpoint. |
| keycloak.enabled | bool | `true` | Master switch for the keycloak sub-chart. |
| keycloak.replicas | int | `1` | Keycloak replicas (3+ in production per HA). |
| keycloak.database.existingSecretName | string | `"keycloak-db"` | SealedSecret / ExternalSecret for DB password. |
| keycloak.database.existingSecretKey | string | `"password"` | Key within the secret. |
| keycloak.admin.existingSecretName | string | `"keycloak-admin"` | SealedSecret / ExternalSecret for admin password. |
| keycloak.realm.import.enabled | bool | `true` | Auto-import the metaplatform realm at startup. |
| keycloak.realm.import.existingConfigMap | string | `"keycloak-realm-metaplatform"` | ConfigMap holding the realm JSON. |
| service-templates.enabled | bool | `true` | Master switch for the service-templates library chart. |
| service-templates.defaults.replicaCount | int | `2` | Default replica count for app charts. |
| service-templates.defaults.podDisruptionBudget.minAvailable | int | `1` | PDB min available. |
| service-templates.defaults.resources | object | `{"requests":{"cpu":"100m","memory":"256Mi"},"limits":{"cpu":"1000m","memory":"1Gi"}}` | Default resource shape. |
| service-templates.defaults.securityContext.runAsNonRoot | bool | `true` | Hard rule: every pod runs as non-root. |
| service-templates.defaults.securityContext.readOnlyRootFilesystem | bool | `true` | Hard rule: read-only root filesystem. |
| service-templates.defaults.securityContext.capabilities.drop | list | `["ALL"]` | Hard rule: drop all capabilities. |

## Sub-Charts

| Name | Version | Condition | Description |
|------|---------|-----------|-------------|
| otel-collector | 0.1.0 | `otel-collector.enabled` | OpenTelemetry Collector (contrib) for trace/metric/log aggregation. |
| keycloak | 0.1.0 | `keycloak.enabled` | Keycloak 24.x identity provider. |
| network-policies | 0.1.0 | `network-policies.enabled` | Default-deny + explicit-allow NetworkPolicy set. |
| service-templates | 0.1.0 | `service-templates.enabled` | Library chart with shared securityContext helpers. |

## Hard Rules Enforced

This chart enforces the production-readiness design 13 hard rules:

- **Rule 1** (Swagger without interface, no route): all services are wired through the OpenAPI contract; no imperative routing.
- **Rule 6** (static checks): the `platform-k8s-ci.yml` workflow runs ruff + pyright strict on `infra/tests/`.
- **Rule 8** (no K8s readiness, no production): `network-policies/default-deny` is enabled and the chart refuses to install without explicit allows.
- **Rule 9** (no audit/metrics/trace, no closed loop): OTel collector is enabled by default; every workload has resource attributes injected.
- **Rule 12** (Secret in git): all secrets are referenced via `existingSecretName`; no raw values are templated. SealedSecret/ExternalSecret are produced out-of-band.
- **Rule 13** (evidence-based acceptance): PLATFORM-K8S-01 is not Accepted until `evidence/PLATFORM-K8S-01-ACCEPTANCE.md` lists 13 quality gates as PASS.

## Development

```bash
# From repo root:
cd infra/helm
helm dependency update
helm lint . -f values-local.yaml
helm template metaplatform . -f values-local.yaml > /tmp/rendered.yaml
kubeconform -strict -summary -kubernetes-version 1.29.0 /tmp/rendered.yaml

# Run the local pytest suite (no helm required)
cd ../tests
pytest -v
```

## References

- [ADR-0010: Platform K8s runtime baseline](../../docs/active/decisions/ADR-0010-platform-k8s-baseline.md)
- [Production-readiness design 13 hard rules](../../docs/active/specs/2026-07-30-backend-production-readiness-design.md#13-不可绕过的硬规则)
- [AI Launch Prompt Batch C](../../docs/active/specs/2026-07-30-ai-launch-prompt-batchC-platform-k8s.md)
- [PROGRAM-BOARD.md](../../docs/active/delivery/PROGRAM-BOARD.md)