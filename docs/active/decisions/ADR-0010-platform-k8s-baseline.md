# ADR-0010：平台 K8s 运行时基线（PLATFORM-K8S-01）

> 状态：**Proposed**（待 PLATFORM-K8S-01 验收通过后转 Accepted）
> 日期：2026-07-30
> 关联批次：PLATFORM-K8S-01（PROGRAM-BOARD.md）
> 关联设计：docs/active/specs/2026-07-30-backend-production-readiness-design.md §12
> 上游依赖：API-GOV-01 ✅ Accepted（commit 1fa521fd）、ARCH-CORE-01 ✅ Accepted（commit eeaab5c5）
> 下游影响：SEC-IAM-01、SEC-TENANT-01、PLATFORM-EVENT-01、TECH-SERVICES、BUSINESS-SLICES、DATA-D0-D8、GA-ACCEPTANCE

---

## 1. Context

v3.0 Plan D Polyglot Microservice 已落地 ARCH-CORE-01，删除
`services/api-gateway`、`services/auth-service` 等重复源码，确立四层结构：

```
mate-platform-backend/packages/
├── mate-kernel/      # 纯域类型
├── mate-platform/    # 横切内核（auth / tenancy / observability / resilience / messaging）
├── mate-clients/     # ACL：所有外部系统的反防腐层
└── <app>-*/          # 业务应用
```

四层结构 + 17 个领域契约（API-GOV-01 落地）需要一个生产可用的 K8s 运行时基线。
本 ADR 锁定 PLATFORM-K8S-01 的 Helm chart 拓扑、Argo CD 应用编排、
身份基线、可观测与网络策略。

## 2. Decision

PLATFORM-K8S-01 采用以下技术栈与拓扑：

### 2.1 编排与发布

| 组件 | 版本 | 角色 |
|---|---|---|
| Kubernetes | ≥ 1.29 | 运行时 |
| Helm | 3.14+ | 模板与打包 |
| Argo CD | 2.11+ | GitOps 持续交付 |
| Argo CD ApplicationSet | 1.5+ | 多环境多 app 生成器 |
| Kustomize | 5.x | 仅作 Helm 内的 overlay |
| Helm Diff | 1.4+ | Argo CD 插件，PR 预览差异 |
| helm-docs | 1.13+ | chart README 同步 |

仓库布局：

```
infra/
├── helm/                              # umbrella chart
│   ├── Chart.yaml                     # apiVersion: v2, name: metaplatform
│   ├── values.yaml                    # 默认值
│   ├── values-{env}.yaml              # local/contract/integration/staging/pre-production/production
│   ├── charts/
│   │   ├── keycloak/
│   │   ├── postgres/
│   │   ├── redis/
│   │   ├── kafka/
│   │   ├── otel-collector/
│   │   ├── network-policies/
│   │   ├── service-templates/         # 业务服务模板（被 app 引用）
│   │   └── umbrella/                  # 全局 chart（默认 values 桥）
│   └── tests/                         # helm-unittest 快照
├── argocd/
│   ├── applicationset.yaml            # 覆盖 17 个领域 runtimeModule
│   ├── app-of-apps.yaml               # umbrella chart 入口
│   ├── repo-creds.yaml                # git+ssh 凭证
│   └── projects/                      # AppProject RBAC 拆分
├── observability/
│   └── otel-collector/                # config + dashboards
├── keycloak/
│   ├── realm-metaplatform.json        # realm + 6 client 导入
│   └── theme/                         # 自定义登录主题
└── tests/                             # kubeconform / helm lint / e2e
```

### 2.2 身份与密钥

| 组件 | 版本 | 角色 |
|---|---|---|
| Keycloak | 24.x | 唯一身份源 |
| PG（Keycloak 用） | 16 | Keycloak 持久化（与业务 PG 共享集群） |
| Bitnami Sealed Secrets | 2.16+ | git-friendly Secret 封装 |
| External Secrets Operator | 0.9+ | 对接 Vault / 云 KMS（production 强制） |

强制约束：
- Keycloak **禁用 embedded H2**，staging 以上必须外接 PG。
- 所有 Secret 走 SealedSecret（git）或 ExternalSecret（prod）。
- raw Secret 在 git 仓库中由 pre-commit hook 拒绝。

### 2.3 数据与消息

| 组件 | 版本 | 角色 |
|---|---|---|
| PostgreSQL | 16 | 业务主存储（与 R5 报告兼容） |
| Redis | 7.2+ | 缓存 / 限流 / 队列 |
| Kafka | 3.7+ | 事件流（Outbox、DLQ） |
| Schema Registry | Confluent 7.6 | Kafka schema 治理 |
| Zookeeper | ❌ 弃用 | 改用 KRaft 模式（Kafka 3.7+） |

### 2.4 可观测

| 组件 | 版本 | 角色 |
|---|---|---|
| OpenTelemetry Collector | 0.104+ | trace/metric/log 汇聚 |
| OpenTelemetry Operator | 0.104+ | sidecar / daemonset 自动注入 |
| Prometheus | 2.52+ | 指标存储 |
| Loki | 3.0+ | 日志聚合 |
| Tempo | 2.5+ | trace 存储（与 OTel 直连） |
| Grafana | 11.x | 仪表盘 |

OTel collector 接收：
- `otlp`（HTTP + gRPC，应用侧）
- `prometheus`（业务 / 主机指标）
- `kafkametrics`（broker 侧）
- `postgresql`（Exporter）
- `redis`（Exporter）

处理器：`batch` / `memory_limiter` / `tail_sampling` / `attributes`
（注入 `tenant.id` 与 `trace.id`）。

出口：`otlphttp`（traces → Tempo）+ `prometheusremotewrite`（metrics）。

### 2.5 网络

NetworkPolicy 强制：
- 默认 `deny-all` ingress + egress。
- 显式 allow：
  - ingress：api-gateway namespace 内的所有 Service。
  - egress：kube-dns（UDP/TCP 53）+ Keycloak + OTel collector + PG / Redis / Kafka 集群。
- 命名空间 `production` 默认额外禁用 pod-to-pod（必须经过 Service Mesh）。

### 2.6 提交顺序（强约束，沿用 production-readiness §10）

```
docs/ADR → contract → failing tests → feature → infrastructure → deploy → acceptance evidence
```

每个 PR 必须包含：
- ADR 引用（本文件 §X）
- operationId 引用（API-GOV-01 bundled.yaml）
- 验收证据链接（13 项门禁结果）

## 3. Alternatives

### A. 纯 Kustomize 替代 Helm + Argo CD

- **优点**：无模板逻辑，纯声明。
- **缺点**：多环境复用能力弱；与 operator（cert-manager、ExternalSecrets）
  组合时缺少生命周期钩子；维护 OTel Collector 这类需要复杂配置的组件时
  Kustomize 表达力不足。
- **否决理由**：本项目 17 个领域 + 6 套环境，参数化需求重。

### B. OpenShift 替代裸 K8s

- **优点**：内置 CI/CD、Service Mesh、Registry，集成度高。
- **缺点**：锁定红帽生态；与本项目 v3.0 多云中立目标冲突；
  Keycloak 在 OpenShift 上要走 OCP operator，社区模板分裂。
- **否决理由**：与"开放技术栈 + 自建治理"原则冲突。

### C. 托管 K8s 服务（EKS / AKS / CKE）独占

- **优点**：免运维控制面。
- **缺点**：与 R4/R5 报告里"四层结构 + 私有部署兼容"目标不兼容；
  local → contract → integration → staging → pre-production → production
  六环境下，托管服务的 API 差异会拉高维护成本。
- **否决理由**：本项目交付目标是"自建可运行 + 可上云"，不能被某朵云绑定。

### D. Sealed Secrets vs Hashicorp Vault

- **优点（SealedSecrets）**：与 git 集成最自然，零运维。
- **优点（Vault）**：动态 secret、租赁、审计。
- **决策**：SealedSecrets 用于 staging 及以下，ExternalSecrets + Vault
  用于 production。混合方案，控制复杂度在可接受范围。

## 4. Consequences

### 4.1 正面

- 9 个 chart 子包组成 umbrella，统一管理 6 套环境。
- Argo CD ApplicationSet 把 17 个领域 runtimeModule 全部自动化同步。
- OTel Collector 一处升级、全栈生效；属性注入 `tenant.id` 满足 §13
  硬规则 9（"没有审计、指标和 trace 不算业务闭环"）。
- NetworkPolicy 默认 deny-all 满足 §13 硬规则 8（"没有 K8s readiness
  和回滚不算生产完成"）。
- SealedSecrets + ExternalSecrets 双轨避免 secret 进 git。

### 4.2 负面 / 风险

- Helm 模板调试链路长（template → kubeconform → helm-unittest → real
  cluster），需 CI 闭环。
- Keycloak + PG 16 部署资源较重，local 环境至少 4 GB 内存。
- OTel Collector 配置多（receivers/processors/exporters），
  错误配置会导致 trace 全量丢失，必须有端到端契约测试。
- SealedSecrets 的私钥丢失 = 全部 Secret 不可恢复，必须在
  `infra/sealed-secrets-master.yaml` 外做异地备份。

### 4.3 缓解

- CI 强制 `helm lint` + `helm template` + `kubeconform -strict` +
  `helm-unittest` 四件套；任何一项失败不允许合并。
- 关键依赖（Keycloak、PG、Redis、Kafka）做 helm snapshot 测试，
  CI 中用 kind 跑 upgrade / rollback。
- OTel Collector 配置变更必须配 trace 端到端契约测试
  （`infra/tests/test_otel_e2e.py`）。
- SealedSecrets 私钥用 `infra/sealed-secrets-master.yaml.sops` 加密
  备份到独立凭据库（仅限 SRE）。

## 5. Migration

按环境顺序推进（与 production-readiness §10 一致）：

```
local → contract → integration → staging → pre-production → production
```

| 阶段 | 交付 | 验证 |
|---|---|---|
| local | docker compose + kind + Helm 本地 install | helm lint + kubectl get all |
| contract | helm template snapshot 测试 | helm-unittest 全绿 |
| integration | kind 集群 + Argo CD + Keycloak | 6 app 跑通 e2e smoke |
| staging | 真实 K8s + Argo CD | 完整 E2E + 性能基线 |
| pre-production | 真实 K8s + 真实数据 | DR 演练 + 备份恢复 |
| production | GA 切流 | 全部 §13 门禁 + SLO 达标 |

Keycloak realm 迁移：先用 `realm-metaplatform.json` 导入，运行时通过
Admin REST API 增量修改；任何 admin 改动通过 export → commit → apply 三步
留痕，禁止 console 直接改。

## 6. Verification

PLATFORM-K8S-01 退出条件（与 ARCH-CORE-01 同结构，对应 §13 硬规则 1-13）：

1. `helm lint infra/helm/` 0 错。
2. `helm template infra/helm/ > /tmp/rendered.yaml` + `kubeconform -strict`
   0 错。
3. `helm-unittest infra/helm/charts/*` 全绿。
4. kind 集群中 `helm install metaplatform infra/helm/` 成功；`kubectl get
   all -n metaplatform` 显示 Keycloak / PG / Redis / Kafka / OTel collector
   5 个核心组件 Running。
5. OTel 端到端契约：模拟一个 app 发 trace → collector → Tempo → Grafana
   可见（`infra/tests/test_otel_e2e.py`）。
6. NetworkPolicy 默认 deny-all：同 namespace 内 pod-to-pod curl 失败。
7. Keycloak realm 导入 6 client；用 apphub client 拿 token 成功。
8. SealedSecret demo：把一个明文 secret 通过 `kubeseal` 加密 → apply →
   pod 内能读到。
9. `pytest infra/tests -q` 全绿（含 snapshot + 端到端 + 越权 negative）。
10. `docs/active/delivery/evidence/PLATFORM-K8S-01-ACCEPTANCE.md` 写完
    13 项质量门禁结果。
11. PROGRAM-BOARD.md：PLATFORM-K8S-01 = **Accepted**。
12. helm-docs 同步每个子 chart 的 README（强制 CI）。
13. ruff + pyright strict 在 `infra/tests/*.py` 0 错。

## 7. References

- `docs/active/specs/2026-07-27-mate-platform-technical-architecture.md`（v3.0 THE ONE DOC）
- `docs/active/specs/2026-07-30-backend-production-readiness-design.md`（Phase 0-8 + §13 硬规则）
- `docs/active/specs/2026-07-30-ai-launch-prompt-batchC-platform-k8s.md`（本批次的 AI 启动 prompt）
- `docs/active/delivery/PROGRAM-BOARD.md`（批次跟踪表）
- `docs/active/delivery/evidence/API-GOV-01-ACCEPTANCE.md`（上一批次的 DoD 模板）
- `docs/active/delivery/evidence/ARCH-CORE-01-ACCEPTANCE.md`（四层结构 + 13 门禁参考）
- `docs/active/specs/R5-HIBERNATE-PG16-COMPAT-REPORT.md`（PG 16 兼容基线）
- `mate-platform-backend/contracts/openapi/manifest.yaml`（17 个领域契约 / Owner / runtimeModule）