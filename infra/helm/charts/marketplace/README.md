# marketplace

![Version: 0.1.0](https://img.shields.io/badge/Version-0.1.0-informational?style=flat-square)

Mate Platform Cloud Marketplace Consumer — API + Worker 双 deployment,
拉 SaaS marketplace HTTP API + OCI Distribution Spec v2 数据面,把 MCP /
Agent / Ontology 三类资产 install 到本地 mate-tech-* 服务。

**Homepage:** <https://github.com/Bert0000000000/MetaPlatform>

## Maintainers

| Name | Email |
|------|-------|
| MetaPlatform Marketplace Owner | marketplace@metaplatform.local |

## TL;DR

```bash
helm template marketplace . -f values.yaml
helm lint . -f values.yaml
helm template marketplace . -f values-staging.yaml
```

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│  Deployment (api)                                          │
│   └─ marketplace-api  (HTTP :8080)                          │
│      routes: /api/v1/marketplace/*                          │
│      SaaS HTTP API(控制面) + OCI pull 数据面               │
├────────────────────────────────────────────────────────────┤
│  Deployment (worker, replicas=2)                           │
│   └─ marketplace-worker                                     │
│      celery 消费 marketplace.install.requested              │
│      跑 orchestrator 状态机                                 │
├────────────────────────────────────────────────────────────┤
│  Service marketplace-api (ClusterIP :8080)                  │
│  ServiceAccount marketplace                                 │
│  NetworkPolicy default-deny + 白名单 SaaS egress            │
└────────────────────────────────────────────────────────────┘
```

## Values

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| image.registry | string | `docker.io` | Image registry |
| image.repository | string | `mate/marketplace` | Image repository |
| image.tag | string | `latest` | Image tag |
| saas.baseUrl | string | `https://market.example` | SaaS marketplace HTTP API(控制面) |
| saas.registry | string | `registry.example.com` | OCI Distribution Spec v2 registry |
| saas.allowedEgressCidrs | list | `["0.0.0.0/0"]` | NetworkPolicy 允许的 Egress CIDR |
| api.replicas | int | `1` | API deployment replicas |
| api.resources | object | 见 values.yaml | API resource shape |
| worker.replicas | int | `2` | Worker deployment replicas |
| worker.resources | object | 见 values.yaml | Worker resource shape |
| networkPolicy.enabled | bool | `true` | 启用 NetworkPolicy |

## Hard Rules Enforced

- **§13 rule 8**(K8s readiness + rollback):deployment 配 `readinessProbe`
  + `livenessProbe`(api),worker replicas 默认 2 用于滚动回滚。
- **§13 rule 13**(NetworkPolicy default-deny):`policyTypes: [Ingress,
  Egress]`,默认隐式 deny;ingress 仅允许 `api-gateway` 命名空间;
  egress 白名单 SaaS CIDR + postgres/redis 内部端口 + kube-dns。
- **§13 rule 12**(Secret not in git):SaaS license key 不进 chart,
  通过 SealedSecret / ExternalSecret 注入。
- **§13 rule 11**(helm-docs sync):本 README 与 values.yaml 同步;
  CI job `ga-011-helm-docs` 校验。

## References

- [ADR-0020: Marketplace consumer dual-repo split](../../docs/active/decisions/ADR-0020-marketplace-consumer.md)
- [Production readiness design (13 hard rules)](../../mate-platform-backend/docs/active/specs/2026-07-30-backend-production-readiness-design.md)