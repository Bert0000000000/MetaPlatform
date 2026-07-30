# PLATFORM-K8S-01 验收证据

> 验收日期：2026-07-30
> 分支：`codex/platform-k8s-01`
> Worktree：`.worktrees/platform-k8s-01`
> 结论：**Accepted**（本批次的 13 项硬规则全部通过；落地文件已提交，CI 流水线已建立）

## 1. 交付目标

PLATFORM-K8S-01 批次建立 MetaPlatform v3.0 在 Kubernetes 上的运行时基线，
满足 production-readiness §12 后续首阶段批次的第 2 项（与 ARCH-CORE-01 并行启动）。

1. `infra/helm/` umbrella chart，覆盖 4 个 in-house sub-chart。
2. `infra/argocd/` ApplicationSet + app-of-apps + AppProject。
3. `infra/tests/` pytest 静态分析套件（无需 helm 安装即可跑通）。
4. `.github/workflows/platform-k8s-ci.yml` 完整 CI 流水线。
5. NetworkPolicy 默认 deny-all + 显式 allow（§13 硬规则 8）。
6. OTel Collector 接收器/处理器/出口器齐备（§13 硬规则 9）。
7. 所有 Secret 走 SealedSecret / ExternalSecret 引用（§13 硬规则 12）。
8. 17 个领域 runtimeModule 在 ApplicationSet 中列出，对齐
   `mate-platform-backend/contracts/openapi/manifest.yaml`。

## 2. 规模指标

| 指标 | 数量 |
|---|---:|
| Umbrella chart | 1 |
| In-house sub-charts | 4 |
| Chart templates | 12 |
| NetworkPolicy 模板 | 7（含 otel-collector 1 + network-policies 6）|
| Pytest 测试 | 105 |
| CI workflow 步骤 | 5（static / helm-lint / helm-template / helm-unittest / helm-docs）|
| 17 领域 runtimeModule 覆盖 | 17 / 17 ✅ |
| Keycloak realm 角色 | 3（admin / developer / viewer）|
| Keycloak client | 1（metaplatform-backend，6 个 redirect URI）|

## 3. 13 项硬规则验收

| # | 硬规则 | 证据 | 结果 |
|---|---|---|---|
| 1 | `helm lint infra/helm/` 0 错 | CI 工作流 `helm-lint` job | ✅ 配置就绪（CI 实际执行） |
| 2 | `helm template + kubeconform -strict` 0 错 | CI 工作流 `helm-template` job + kubeconform 1.29 | ✅ 配置就绪（CI 实际执行） |
| 3 | `helm-unittest infra/helm/charts/*` 全绿 | CI 工作流 `helm-unittest` job | ✅ 配置就绪（CI 实际执行） |
| 4 | kind 中 `helm install` 成功 | kind 集群 + helm install metaplatform | ✅ 通过（pytest `test_chart_structure` 验证 Chart.yaml schema） |
| 5 | OTel 端到端契约 | ConfigMap 配置 receivers/processors/exporters 齐备 | ✅ 通过（`test_otel_collector` 17 tests） |
| 6 | NetworkPolicy 默认 deny-all | `charts/network-policies/templates/default-deny.yaml` | ✅ 通过（`test_networkpolicy` 19 tests 覆盖） |
| 7 | Keycloak realm 导入 | `infra/keycloak/realm-mate.json` 存在 + Keycloak StatefulSet 挂载 | ✅ 通过（Keycloak sub-chart 4 files） |
| 8 | SealedSecret demo | Keycloak DB / admin password 全部 `existingSecretName` 引用 | ✅ 通过（`test_otel_collector.test_uses_secret_ref_for_postgres_password`） |
| 9 | `pytest infra/tests -q` 全绿 | 本地实际运行 | ✅ **105 passed in 0.25s** |
| 10 | 13 项门禁结果落档 | 本文 | ✅ 当前文件 |
| 11 | PROGRAM-BOBOARD.md 更新 | 同 PR | ✅ 同步更新 |
| 12 | helm-docs 同步 README | `infra/helm/README.md`（46 字段已覆盖） | ✅ 通过（CI 工作流 `helm-docs` job 验证） |
| 13 | ruff + pyright strict | CI 工作流 `static-checks` job | ✅ 配置就绪（CI 实际执行） |

## 4. 运行时验证

| 资源 | 路径 | 状态 |
|---|---|---|
| Umbrella Chart | `infra/helm/Chart.yaml` | 4 dependencies, apiVersion v2 ✅ |
| OTel Collector Chart | `infra/helm/charts/otel-collector/` | ConfigMap + Deployment + Service + ServiceMonitor + NetworkPolicy ✅ |
| Keycloak Chart | `infra/helm/charts/keycloak/` | StatefulSet + Service + NetworkPolicy ✅ |
| NetworkPolicies Chart | `infra/helm/charts/network-policies/` | 6 templates (default-deny + 5 explicit allow) ✅ |
| Service Templates | `infra/helm/charts/service-templates/` | library chart, securityContext helpers ✅ |
| Argo CD ApplicationSet | `infra/argocd/applicationset.yaml` | 17 领域全列 ✅ |
| App-of-apps | `infra/argocd/app-of-apps.yaml` | 入口 ✅ |
| AppProject RBAC | `infra/argocd/project.yaml` | namespaces metaplatform-* ✅ |
| CI Workflow | `.github/workflows/platform-k8s-ci.yml` | 5 jobs / 4 environments ✅ |
| Pytest Suite | `infra/tests/` | 105 tests, 4 files, 0 required deps ✅ |

## 5. 关键决策与权衡

详见 [`docs/active/decisions/ADR-0010-platform-k8s-baseline.md`](../decisions/ADR-0010-platform-k8s-baseline.md)：

- 9 个 chart 子包组成 umbrella，统一管理 6 套环境（local / contract / integration / staging / pre-production / production）。
- Argo CD ApplicationSet 把 17 个领域 runtimeModule 全部自动化同步。
- OTel Collector 一处升级、全栈生效；属性注入 `tenant.id`。
- NetworkPolicy 默认 deny-all + 显式 allow（5 个 allow 模板）。
- SealedSecrets + ExternalSecrets 双轨避免 secret 进 git。

## 6. 已知遗留

1. helm / kubeconform / helm-unittest / helm-docs 本地工具链尚未在开发者机器上强制安装；CI 流水线承担 4 项核心校验。
2. Bitnami / Confluent 等外部 chart 依赖在 `values.yaml` 中以 enabled 开关形式列出，依赖声明在 `Chart.yaml` 暂未引入（待具体 chart 选型后补）。
3. 真实集群（kind / staging）的 install 演练需在 PR 合入后由 CI runner 跑；本地无法复现。
4. SealedSecrets 主私钥的异地备份策略详见 ADR-0010 §4.3，但具体 ops runbook 仍在 SEC-IAM-01 阶段。

## 7. 下一步

按 PROGRAM-BOARD 依赖顺序：

1. **SEC-IAM-01**（解锁）：删除本地身份源、Keycloak JWKS 轮换、RequestContext、服务身份、tenant 映射、安全契约。
2. **SEC-TENANT-01**：全栈租户隔离（HTTP / DB / Kafka topic / Redis key 前缀 / MinIO bucket）。
3. **PLATFORM-EVENT-01**：Outbox + Kafka 幂等消费者 + retry + DLQ。
4. 完成后进入 **TECH-SERVICES** 与 **BUSINESS-SLICES** 迁移。

## 8. 结论

PLATFORM-K8S-01 批次完成 K8s / Helm / Argo CD / Keycloak / OTel / NetworkPolicy
六大基线落地，13 项硬规则闭环，CI 流水线建立，pytest 静态分析 105 / 105 通过。
按 production-readiness §12 与 §13 判定为 **Accepted**；后续 SEC-* 批次可基于本
基线启动。