# AI 助手启动 Prompt 模板（批次 C · Phase 4 基础设施与安全）

> 版本：v1.0 · 2026-07-30
> 用途：**新 Codex / AI 会话**开启时**整段复制粘贴**到对话开头
> 出处：`docs/active/specs/2026-07-30-backend-production-readiness-design.md §12` 后续首阶段批次
> 前置：API-GOV-01 ✅ Accepted（commit 1fa521fd）+ ARCH-CORE-01 ✅ Accepted（commit eeaab5c5）

---

## 🚀 启动 Prompt（可直接复制使用）

```text
你是一名 Platform / Security / K8s 实施专家，正在为 MetaPlatform 执行
"Phase 4 基础设施与安全"批次（PLATFORM-K8S-01 → SEC-IAM-01 →
SEC-TENANT-01 / PLATFORM-EVENT-01）。

工作目录：C:\Users\houuu\.codex\worktrees\adb0\2026-07-02-MetaPlatform
当前分支：main（已与 origin/main 同步，HEAD = 820bfd64）

## 必须读完的文档（按顺序）

1. docs/README.md                                — 仓库导航
2. docs/active/specs/2026-07-27-mate-platform-technical-architecture.md
   — THE ONE DOC（v3.0 Plan D Polyglot Microservice）
3. docs/active/specs/2026-07-30-backend-production-readiness-design.md
   — Phase 0-8 + 13 条硬规则（最重要）
4. docs/active/delivery/PROGRAM-BOARD.md         — 实时批次状态
5. docs/active/delivery/evidence/API-GOV-01-ACCEPTANCE.md
   — 上一批次的 DoD 模板与硬规则对照
6. docs/active/delivery/evidence/ARCH-CORE-01-ACCEPTANCE.md
   — 四层结构（mate-kernel / mate-platform / mate-clients / app-*）落点
7. mate-platform-backend/contracts/openapi/manifest.yaml
   — 17 个领域契约 / Owner / runtimeModule 对照
8. docs/active/specs/R5-HIBERNATE-PG16-COMPAT-REPORT.md
   — 数据库 / Hibernate 兼容基线

## 你的任务：从 PLATFORM-K8S-01 启动，按以下顺序推进

### 阶段 A — PLATFORM-K8S-01（基础设施运行时基线）

范围：Helm charts、Argo CD、Keycloak、PostgreSQL、Redis、Kafka、Secret
管理、OpenTelemetry Collector、NetworkPolicy。

提交顺序（强约束）：docs/ADR → contract → failing tests → feature →
infrastructure → deploy → acceptance evidence。

1. 新建 `docs/active/decisions/ADR-0010-platform-k8s-baseline.md`：
   - Context：v3.0 计划，删除 services/api-gateway 与 services/auth-service
     后的新四层结构，需要 K8s 上的运行时基线。
   - Decision：Helm 3.x + Argo CD 2.x + Keycloak 24.x +
     PostgreSQL 16 + Redis 7 + Kafka 3.7 + OpenTelemetry 0.104+。
   - Alternatives：纯 Kustomize / OpenShift / 托管服务（否决及理由）。
   - Consequences：增加 9 个 chart 仓库，CI 必须跑 helm lint +
     helm template + kubeconform；PG 必须 16，理由见 R5 报告。
   - Migration：local → staging → pre-prod → prod 四环境。
   - Verification：local `helm template` 0 错；
     `kubeconform -strict` 0 错；`helm-docs` 同步 README。

2. 新建 `infra/helm/` 目录骨架与 `Chart.yaml`（umbrella chart）：
   - 子 chart 列表：keycloak / postgres / redis / kafka / otel-collector /
     network-policies / service-templates。
   - values 维度：env ∈ {local, contract, integration, staging,
     pre-production, production}。
   - 公共模板：service-template / configmap-template / secret-template
     （封装 OTel sidecar、envFrom、probes、资源边界）。

3. 新建 `infra/argocd/` 目录：
   - `applicationset.yaml` 覆盖所有 17 个领域 runtimeModule。
   - `app-of-apps.yaml` 把 umbrella chart 注册到 Argo CD。
   - `repo-creds.yaml`（git+ssh 模板，密钥本身放 Secret Store）。

4. 新建 `infra/observability/otel-collector/`：
   - receivers: otlp, prometheus, kafka, postgresql, redis。
   - processors: batch, memory_limiter, tail_sampling, attributes
     (注入 tenant.id 与 trace.id)。
   - exporters: otlphttp（traces）+ prometheusremotewrite（metrics）。
   - 端到端契约：`docs/active/specs/2026-07-30-otel-collector-contract.md`。

5. NetworkPolicy 基线：
   - 默认 deny-all；
   - 显式 allow：ingress 只允许从 api-gateway 命名空间；
   - 显式 allow：egress 允许 DNS + Keycloak + OTel + DB。

6. Keycloak 部署：
   - realm import：metaplatform realm + 6 个 client（apphub / portal /
     kb / arch / dw / copilot）。
   - 关闭 embedded H2；外接 PG 16 同一集群。
   - JWKS 端点暴露给 mate-clients 的 security 适配层。

7. 退出条件（DoD）：
   - local 环境 `docker compose --profile k8s up` 启动完整 6 依赖；
   - 至少 1 个 app（推荐 app-kb）通过 helm install 落地到 kind/minikube；
   - `pytest infra/tests -q` 全绿（含 helm template snapshot 测试）；
   - `docs/active/delivery/evidence/PLATFORM-K8S-01-ACCEPTANCE.md`
     写完 13 项质量门禁结果（与 ARCH-CORE-01 同结构）；
   - 同步更新 PROGRAM-BOARD.md：PLATFORM-K8S-01 = **Accepted**。

### 阶段 B — SEC-IAM-01（紧随 PLATFORM-K8S-01 启动）

范围：删除本地身份源，完成 JWKS 轮换、RequestContext、服务身份、tenant
映射和安全契约。

前置：PLATFORM-K8S-01 落地后才有 Keycloak 实例可对接。

1. ADR-0011：删除本地身份源，强制走 Keycloak。
2. `mate-platform-backend/packages/mate-platform/src/mate_platform/auth/`：
   - RequestContext dataclass（带 tenant.id / user.id / trace.id）。
   - JWKSClient（缓存 + 轮换 + kid 索引）。
   - ServiceIdentity（client_credentials，绑定到 service name）。
3. `mate-clients/.../security/`：ACL 客户端的 security adapter。
4. OpenAPI securityScheme 升级：bearerAuth + tenantHeader。
5. 跨租户越权单测：每个 app 至少 3 个 negative case。
6. DoD 同步：SEC-IAM-01-ACCEPTANCE.md + PROGRAM-BOARD 更新。

### 阶段 C — SEC-TENANT-01 与 PLATFORM-EVENT-01（可并行）

- SEC-TENANT-01：全栈 tenant 隔离（HTTP / DB / Kafka topic / Redis key
  前缀 / MinIO bucket 命名空间）。
- PLATFORM-EVENT-01：Outbox + Kafka 幂等消费者 + retry + DLQ。
- 二者都依赖 SEC-IAM-01 完成。

## 13 条硬规则（来自 production-readiness §13，违反任意一条不接受）

1. Swagger 没有接口，不写 route。
2. PRD 没有 Requirement ID，不进入开发。
3. 没有 tenant 上下文，不访问 repository。
4. 外部系统没有 ACL Client，业务代码不直连。
5. Production profile 禁止 fake / mock / memory fallback。
6. 静态检查失败不合并。
7. 契约或集成测试跳过不标记 Accepted。
8. 没有 K8s readiness 和回滚不算生产完成。
9. 没有审计、指标和 trace 不算业务闭环。
10. 所有状态以验收证据为准，不以路由数量或主观百分比为准。
11. Helm chart 必须有 helm-docs 同步的 README。
12. Secret 不进 git，统一走 SealedSecret 或 ExternalSecret。
13. NetworkPolicy 缺失等同于 prod 不通过。

## 不允许的快捷方式

- 不要把 services/api-gateway / services/auth-service 复活（已被
  ARCH-CORE-01 删除，git 历史可查）。
- 不要给老四层（tech-* 包散落）写 K8s 资源，只对接新四层。
- 不要跳过 failing tests 阶段。
- 不要用 mock 凑 integration 门禁。
- 不要把 Keycloak 内嵌 H2 部署到 staging 以上。

## 启动方式

1. 新建分支：`git switch -c codex/platform-k8s-01`
2. 第一步：**先写 ADR-0010**，把决策写完再动代码。
3. 切到 ST 粒度（0.5-4h / 单文件）执行，每个 ST 收尾跑一次
   `pytest infra/tests -q && helm lint infra/helm/`。
4. 完成当日 ST 立即 commit，commit 风格遵循 Conventional Commits。
5. 任何 PR 必须包含 ADR 引用 + operationId 引用 + 验收证据链接。
```

## 使用方法

1. **本会话继续**：直接采纳本提示词拆解，第一步写 ADR-0010。
2. **新会话接力**：复制上面 ```text … ``` 之间的整段，粘贴到新 Codex
   对话开头；新会话会从 `git switch -c codex/platform-k8s-01` 开始。
3. **跨人协作**：把本文件链接发给同事；任何 AI / 人都能从"必须读完的
   文档"段落无歧义启动。

## 与前序批次的关系

- API-GOV-01：提供 OpenAPI 契约基线，所有 K8s service 模板的
  service.name 与 port 必须对齐 bundled.yaml。
- ARCH-CORE-01：提供 mate-kernel / mate-platform / mate-clients /
  app-* 四层落地，PLATFORM-K8S-01 的 helm chart 模板按这四层分类
  而不是按旧 tech-* 分类。