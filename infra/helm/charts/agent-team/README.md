# agent-team

![Version: 0.1.0](https://img.shields.io/badge/Version-0.1.0-informational?style=flat-square)
![AppVersion: 2.1.0](https://img.shields.io/badge/AppVersion-2.1.0-informational?style=flat-square)

Mate Platform Agent 产品层（`mate-tech-agent-team`）：超级大脑（langgraph 任务图）
+ 数字员工运行时。本 chart 是 `MP-REPLICA-READINESS-01` 的交付——在此之前这个
服务**从来没能起过第二个副本**（compose 用固定 `container_name`、
`infra/helm/charts/` 下没有它的 chart、K8s 集群上零 MetaPlatform workload）。

它同时是 2.1-B 的**硬前置**：租约（B-1）、跨副本取消（B-3）、事件续传（B-2）
这些性质，只有在"真的有两个以上副本同时在跑"时才有意义。

**Homepage:** <https://github.com/Bert0000000000/MetaPlatform>

## Maintainers

| Name                        | Email                       |
| --------------------------- | --------------------------- |
| MetaPlatform Platform Owner | platform@metaplatform.local |

## TL;DR

```bash
# 渲染（含 B-8 的沙箱 Job 模板）
helm template agent-team . -f values.yaml --set sandboxJob.enabled=true

# Lint
helm lint . -f values.yaml

# 默认就是 3 副本
helm template agent-team . | grep -A1 'kind: Deployment' -A3 | grep replicas
```

## Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│  Deployment (mate-tech-agent-team, replicas: 3)               │
│  ┌──────────────────────────────────────────────────┐        │
│  │  agent-team container, port 8013 (/healthz)       │        │
│  │  envFrom: ConfigMap（非密配置）                    │        │
│  │  env:     Secret（两个 DSN + SERVICE_CLIENT_SECRET）│       │
│  │  probe:   HTTP GET /healthz :8013                 │        │
│  │  security: 非 root / 只读根 / drop ALL / seccomp  │        │
│  └──────────────────────────────────────────────────┘        │
│  topologySpreadConstraints → 尽量摊到不同节点                 │
├──────────────────────────────────────────────────────────────┤
│  ConfigMap     → 非密配置（Keycloak / 各服务 URL / 租约 TTL） │
│  Service       → mate-tech-agent-team:8013 (ClusterIP)        │
│  ServiceAccount→ 不挂 API token（最小权限）                    │
│  NetworkPolicy → 默认拒绝；入站限平台/网关命名空间             │
├──────────────────────────────────────────────────────────────┤
│  sandboxJob.enabled=true（B-8）                               │
│  Job + 独立 ServiceAccount + **默认拒绝一切出站** 的 NetworkPolicy│
└──────────────────────────────────────────────────────────────┘
```

## Values

| Key                                                | Type   | Default                | Description                                                          |
| -------------------------------------------------- | ------ | ---------------------- | -------------------------------------------------------------------- |
| `fullnameOverride`                                 | string | `"mate-tech-agent-team"` | 固定 Service DNS 名                                                  |
| `image.registry`                                   | string | `"docker.io"`          | 镜像仓库                                                             |
| `image.repository`                                 | string | `"meta-agent-team"`    | 镜像名                                                               |
| `image.tag`                                        | string | `"dev"`                | 镜像 tag                                                             |
| `image.pullPolicy`                                 | string | `"IfNotPresent"`       | 拉取策略                                                             |
| `replicaCount`                                     | int    | `3`                    | **副本数**——本 chart 存在的理由                                      |
| `topologySpreadConstraints.enabled`                | bool   | `true`                 | 摊到不同节点（单节点故障不该带走所有副本）                           |
| `resources.requests.cpu`                           | string | `"250m"`               | CPU 请求                                                             |
| `resources.requests.memory`                        | string | `"512Mi"`              | 内存请求                                                             |
| `resources.limits.cpu`                             | string | `"1"`                  | CPU 上限                                                             |
| `resources.limits.memory`                          | string | `"1Gi"`                | 内存上限                                                             |
| `config.keycloak.url`                              | string | `"http://keycloak:8080"` | Keycloak 地址                                                      |
| `config.keycloak.realm`                            | string | `"metaplatform"`       | realm                                                                |
| `config.gatewayUrl`                                | string | `"http://mate-api-gateway:8100"` | 网关地址                                                   |
| `config.poolMax`                                   | string | `"8"`                  | B-5：PG 连接池上限（0 = 不池化）                                     |
| `config.leaseTtlSeconds`                           | string | `"30"`                 | B-1：租约 TTL（秒）                                                  |
| `config.rescanSeconds`                             | string | `"10"`                 | 2.1-C：周期接管扫描间隔（秒）；0 = 关。只扫一次多副本下没人发现孤儿 run |
| `config.heartbeatGraceSeconds`                     | string | `""`                   | 2.1-C："心跳已停"宽限；**留空 = 跟随 TTL**（只调 TTL 不调它会被反过来压住） |
| `config.gateRequiredRoles`                         | string | `""`                   | B-6：HITL 闸门层级（逗号分隔）；留空 = 单级任意角色                  |
| `config.gateRequiredApprovals`                     | string | `"1"`                  | B-6：每级需要的不同审批人数（>1 = 会签）                             |
| `secretRef.name`                                   | string | `"agent-team-secret"`  | 装着两个 DSN、控制面 DSN 与 SERVICE_CLIENT_SECRET 的 Secret          |
| `secretRef.keys.appDsn`                            | string | `"MATE_AGENT_TEAM_DSN"` | 受 RLS 约束的 app 角色（上业务面）                                   |
| `secretRef.keys.controlDsn`                        | string | `"MATE_AGENT_TEAM_CONTROL_DSN"` | 控制面身份：只读检查点，跨租户恢复扫描                        |
| `secretRef.keys.adminDsn`                          | string | `"MATE_AGENT_TEAM_ADMIN_DSN"` | **只给迁移 Job**（B-4）；运行 Pod 里没有它                     |
| `migration.enabled`                                | bool   | `true`                 | B-4：渲染建表/授权的一次性 Job（pre-install/pre-upgrade hook）        |
| `migration.controlRole`                            | string | `"mate_control"`       | 控制面角色名（迁移 Job 建它并授"只读 checkpoints"）                  |
| `migration.controlPassword`                        | string | `""`                   | 控制面角色口令（本地验证用；生产应改走 Secret 引用）                 |
| `service.type`                                     | string | `"ClusterIP"`          | Service 类型                                                         |
| `service.port`                                     | int    | `8013`                 | HTTP 端口                                                            |
| `serviceAccount.create`                            | bool   | `true`                 | 建 ServiceAccount                                                    |
| `serviceAccount.automountServiceAccountToken`      | bool   | `false`                | 不挂 API token                                                       |
| `healthcheck.enabled`                              | bool   | `true`                 | 起 startup/readiness/liveness 探针                                   |
| `healthcheck.path`                                 | string | `"/healthz"`           | 探针路径                                                             |
| `networkPolicy.enabled`                            | bool   | `true`                 | 默认拒绝的 NetworkPolicy                                             |
| `networkPolicy.allowedIngressNamespaces`           | list   | `["metaplatform","api-gateway"]` | 允许入站的命名空间                                        |
| `networkPolicy.allowedEgressPorts`                 | list   | `[5432,8008,8007,8081,8100,4317]` | 允许出站的端口（PG / llmgw / ont / mcp / 网关 / OTel）    |
| `sandboxJob.enabled`                               | bool   | `false`                | B-8：渲染外部 Runtime 的沙箱 Job 模板                                |
| `sandboxJob.command`                               | list   | `["sh","-c"]`          | Job 命令（默认只打印自己的环境 = A-4 的断言桩）                      |
| `sandboxJob.args`                                  | list   | `["env \| sort"]`      | Job 参数                                                             |
| `sandboxJob.activeDeadlineSeconds`                 | int    | `300`                  | 超时即杀                                                             |
| `sandboxJob.resources.*`                           | string | `100m / 128Mi`         | 沙箱的 CPU / 内存限额                                                |

## Hard Rules Enforced

- **§13 rule 8**（K8s readiness + 回滚）：Deployment 带
  `startupProbe` + `readinessProbe` + `livenessProbe`（都打 `/healthz`）。
- **§13 rule 12**（Secret 不进 git）：两个 DSN 与 `SERVICE_CLIENT_SECRET`
  只从 `secretRef` 指向的 Secret 注入，chart 里没有任何密钥值。
- **§13 rule 13**（NetworkPolicy 默认拒绝）：`policyTypes: [Ingress, Egress]`，
  入站限 `metaplatform` / `api-gateway` 命名空间，出站限 DNS + 集群内服务端口。
- **§13 rule 5**（生产 profile 禁止 fallback）：`LEGACY_LOGIN_COMPAT=false`
  与 `INSECURE_SKIP_SIGNATURE=false` 写死在 Deployment 里，不留给 values 关掉。

## B-8：沙箱 Job 为什么要单独一个模板

外部 Runtime（Claude CLI 等）跑的是**不受信的代码**。A-4 在近端做的是"子进程
看不到宿主凭据"（环境变量白名单，`runtimes/sandbox_env.py`）；B-8 把它换成
**一次性 Pod**：

- 独立 ServiceAccount + `automountServiceAccountToken: false` —— 拿不到 API token；
- 环境变量只有编码/路径那几项（**刻意不 envFrom 服务的 ConfigMap/Secret**）；
- 只读根 + `emptyDir` 工作区、`seccompProfile: RuntimeDefault`、非 root、`drop: ALL`；
- CPU / 内存限额 + `activeDeadlineSeconds`；
- 配套 NetworkPolicy：**默认拒绝一切出站**。

判据与 A-4 **同一套**（按名按值断言没有 DSN / Service Secret / Keycloak 配置），
只是这回那个"子进程"是一个 Pod。
