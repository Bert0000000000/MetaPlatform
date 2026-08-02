# deerflow-engine

![Version: 0.1.0](https://img.shields.io/badge/Version-0.1.0-informational?style=flat-square)
![AppVersion: latest](https://img.shields.io/badge/AppVersion-latest-informational?style=flat-square)

ByteDance DeerFlow deep-research engine. Runs as an external Docker
service in `docker-compose.yml` under the `research` and `ai` profiles
(PR-5). This Helm chart mirrors the compose service for production K8s
deployments — Deployment + Service + ConfigMap (non-secret LLM / search
config) + NetworkPolicy (default-deny, hard rule 13).

**Homepage:** <https://github.com/Bert0000000000/MetaPlatform>

## Maintainers

| Name | Email |
|------|-------|
| MetaPlatform Platform Owner | platform@metaplatform.local |

## TL;DR

```bash
# Render the chart locally
helm template deerflow-engine . -f values.yaml

# Lint
helm lint . -f values.yaml
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Deployment (deerflow-engine)                            │
│  ┌─────────────────────────────────────────────────┐    │
│  │  bytedance/deer-flow:latest container           │    │
│  │  port: 8001 (http)                              │    │
│  │  envFrom: ConfigMap (LLM_BASE_URL, LLM_MODEL,   │    │
│  │           SEARCH_PROVIDER)                      │    │
│  │  env:     Secret (LLM_API_KEY, SEARCH_API_KEY)  │    │
│  │  probe:   HTTP GET /healthz :8001               │    │
│  │  volume:  /data (PVC or emptyDir)               │    │
│  └─────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────┤
│  ConfigMap     → non-secret LLM / search config          │
│  Service       → deerflow-engine:8001 (ClusterIP)        │
│  NetworkPolicy → default-deny, platform ns + api-gw only │
└─────────────────────────────────────────────────────────┘
```

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| fullnameOverride | string | `"deerflow-engine"` | Forces service DNS name |
| image.registry | string | `"docker.io"` | Image registry |
| image.repository | string | `"bytedance/deer-flow"` | Image repository |
| image.tag | string | `"latest"` | Image tag |
| image.pullPolicy | string | `"IfNotPresent"` | Image pull policy |
| replicaCount | int | `1` | Number of replicas |
| resources.requests.cpu | string | `"500m"` | CPU request |
| resources.requests.memory | string | `"1Gi"` | Memory request |
| resources.limits.cpu | string | `"1"` | CPU limit |
| resources.limits.memory | string | `"2Gi"` | Memory limit |
| autoScaling.enabled | bool | `false` | HPA toggle |
| llm.baseUrl | string | `"https://api.openai.com/v1"` | LLM endpoint (non-secret) |
| llm.model | string | `"gpt-4o"` | LLM model |
| search.provider | string | `"tavily"` | Search provider |
| secretRef.name | string | `"deerflow-engine-secret"` | Secret with LLM_API_KEY + SEARCH_API_KEY |
| service.type | string | `"ClusterIP"` | Service type |
| service.port | int | `8001` | HTTP port |
| healthcheck.enabled | bool | `true` | Enable startup/readiness/liveness probes |
| healthcheck.path | string | `"/healthz"` | Probe path |
| healthcheck.port | int | `8001` | Probe port |
| persistence.enabled | bool | `false` | PVC toggle (emptyDir when false) |
| persistence.size | string | `"5Gi"` | PVC size |
| networkPolicy.enabled | bool | `true` | Enable default-deny NetworkPolicy |
| networkPolicy.allowedIngressNamespaces | list | `["metaplatform","api-gateway"]` | Namespaces allowed to reach 8001 |

## Hard Rules Enforced

- **§13 rule 8** (K8s readiness + rollback): Deployment has
  `startupProbe` + `readinessProbe` + `livenessProbe` (all HTTP GET
  `/healthz`); PVC-backed volume when `persistence.enabled` is true.
- **§13 rule 12** (Secret not in git): `LLM_API_KEY` and
  `SEARCH_API_KEY` are injected from a Secret (`secretRef.name`);
  no secret values are embedded in the chart.
- **§13 rule 13** (NetworkPolicy default-deny): `policyTypes:
  [Ingress, Egress]` with ingress restricted to `metaplatform` and
  `api-gateway` namespaces on port 8001; egress restricted to DNS
  (kube-system:53) + HTTPS (:443) for external LLM/search providers.
- **§13 rule 11** (helm-docs sync): This README is kept in sync
  with values.yaml; CI job `ga-011-helm-docs` verifies.

## References

- [PR-5: DeerFlow Engine docker-compose + research profile](../../docs/active/specs/2026-08-02-deerflow-pr-prompts.md)
- [Production readiness design (13 hard rules)](../../docs/active/specs/2026-07-30-backend-production-readiness-design.md)
