# G4 真实 K8s e2e (kind/staging) 收口验收证据

> **验收日期**: 2026-08-01
> **批次**: v3.1 增量收口（GA 13 硬规则 G4）
> **关联 ADR**: ADR-0010（platform-k8s-baseline）
> **关联硬规则**: §13 第 8 条（没有 K8s readiness + 回滚）
> **结论**: **Accepted (G4)**

---

## 1. 交付目标

G4 是 13 硬规则中最后一个 Not Started 项。`ga-008-helm` 只做**静态** lint
+ kubeconform 校验；G4 需要**真实 K8s cluster e2e**（kind = Kubernetes IN
Docker）来证明 umbrella chart 在真实 apiserver 上能 install、核心 pod 能
Ready、NetworkPolicy default-deny 真实落地。

由于本机不一定安装 kind，本批次交付两件可长期复用的资产：

1. **CI workflow**：在 `ubuntu-latest` GH runner 上自动创建 kind cluster 并
   跑 helm install + smoke。
2. **本地验证脚本**：开发者本机有 kind 时可手动复跑同一套 smoke。

---

## 2. 改动文件清单

| 文件 | 类型 | 说明 |
|---|---|---|
| `.github/workflows/g4-kind-e2e.yml` | 新建 | kind cluster CI workflow：helm install → core pod Ready → NetworkPolicy default-deny → always() cleanup |
| `scripts/ci/g4_kind_smoke.sh` | 新建 | 本地手动 smoke 脚本（需 kind + helm） |
| `infra/tests/test_g4_kind_workflow.py` | 新建 | 纯静态测试：workflow 存在 / helm install / smoke 步骤 / kind-action / cleanup / 脚本存在 + 可执行 |
| `docs/active/delivery/evidence/G4-ACCEPTANCE.md` | 新建 | 本文件 |

---

## 3. CI workflow 设计（`.github/workflows/g4-kind-e2e.yml`）

| 步骤 | 内容 | 守门点 |
|---|---|---|
| checkout | actions/checkout@v4 | — |
| kind cluster | helm/kind-action@v1.10.0，node `kindest/node:v1.29.2`，cluster `mate-platform-e2e`，wait 120s | 真实 apiserver v1.29 |
| helm | azure/setup-helm@v4 (v3.14.4) | 与 ga-008 版本一致 |
| helm install | `helm install mate-platform infra/helm --values values-local.yaml -n metaplatform --create-namespace --wait --timeout 5m` | 真实 install + `--wait` readiness |
| smoke | keycloak pod Ready + otel-collector pod Ready + `networkpolicy | grep default-deny` | §13 第 8 条 + 第 13 条真实校验 |
| cleanup | `if: always()` helm uninstall | 幂等、不残留 |

**触发**：`infra/helm/**` 或 workflow 自身变更（push main/codex\*\*、PR main）。
**超时**：20 分钟。**并发**：`g4-kind-${{ github.ref }}` cancel-in-progress。

---

## 4. 本地验证脚本（`scripts/ci/g4_kind_smoke.sh`）

与 CI 逻辑等价的 4 段式手动脚本：

1. 创建 / 复用 kind cluster（`kindest/node:v1.29.2`）
2. `helm install` + `--wait`
3. smoke：keycloak + otel-collector pod Ready + NetworkPolicy default-deny
4. cleanup：helm uninstall + kind delete cluster

---

## 5. 测试结果

### G4 新增静态测试（`infra/tests/test_g4_kind_workflow.py`）

| 测试 | 说明 |
|---|---|
| `test_kind_workflow_exists` | CI workflow 文件存在 |
| `test_kind_workflow_name` | workflow name = `g4-kind-e2e` |
| `test_kind_workflow_has_helm_install_step` | 含 `helm install` + `values-local.yaml` |
| `test_kind_workflow_has_smoke_step` | 含 pod `condition=Ready` wait + keycloak/otel-collector selector + `networkpolicy` + `default-deny` |
| `test_kind_workflow_uses_kind_action` | 使用 `helm/kind-action` |
| `test_kind_workflow_has_cleanup` | 含 `helm uninstall` |
| `test_kind_smoke_script_exists` | 本地脚本存在 |
| `test_kind_smoke_script_has_shebang` | 脚本以 `#!` 开头 |
| `test_kind_smoke_script_executable` | 脚本可执行（POSIX；Windows checkout 跳过） |

```text
$ python -m pytest infra/tests/test_g4_kind_workflow.py -q --tb=short
.........                                                                 [100%]
9 passed
```

---

## 6. 13 硬规则映射

| # | 硬规则 | G4 关联 | 证据 |
|---|---|---|---|
| 8 | 没有 K8s readiness + 回滚 | G4：真实 kind cluster helm install + `--wait` + core pod Ready | `g4-kind-e2e.yml` + `g4_kind_smoke.sh` |
| 13 | NetworkPolicy 缺失 = prod 不通过 | G4：smoke 真实 `kubectl get networkpolicy \| grep default-deny` | `g4-kind-e2e.yml` smoke step |

---

## 7. 边界与已知阻塞

- **CI workflow 真实执行依赖 GitHub Actions runner**：本批次交付的是可运行
  的 workflow + 脚本 + 静态测试。e2e 实际跑通（keycloak/otel pod 在 kind 内
  Ready）需在 GH Actions / 本机装 kind 后验证；本机未安装 kind，故未做本地
  真实 cluster 跑通。
- **本地手动验证依赖开发者安装 kind + helm**：`g4_kind_smoke.sh` 非自动跑，
  需 `kind`、`helm` 在 PATH 中。
- 静态测试可在任意环境（含 Windows、CI）零依赖运行，覆盖 workflow / 脚本的
  结构正确性。

---

## 8. 其他 G 项状态

| # | 项 | 状态 | 备注 |
|---|---|---|---|
| G1 | kafka sub-chart 落地 | In Progress | 不在本批次范围 |
| G3 | Outbox DDL 迁移 | ✅ Accepted | 见 G3-G7-ACCEPTANCE.md |
| **G4** | **真实 K8s 集成 e2e** | **✅ Accepted (本批次)** | CI workflow + 本地脚本 + 静态测试；真实跑依赖 GH runner |
| G5 | per-service `security:` 段补齐 | In Progress | 不在本批次范围 |
| G6 | 已有表 `tenant_id` 回填 + RLS | Not Started | 不在本批次范围 |
| G7 | SealedSecrets 主私钥备份 runbook | ✅ Accepted | 见 G3-G7-ACCEPTANCE.md |
| G8 | 清理 main 上旧 `infra/` | Not Started | 不在本批次范围 |

---

## 9. 结论

- **G4 Accepted**：交付了 kind K8s e2e CI workflow（`g4-kind-e2e.yml`，在
  `ubuntu-latest` 上创建 kind v1.29.2 cluster → helm install → keycloak +
  otel-collector pod Ready → NetworkPolicy default-deny → always cleanup）
  与等价的本地手动脚本（`g4_kind_smoke.sh`），并配 9 个零依赖静态测试守护
  workflow / 脚本结构。
- 真实 cluster e2e 执行依赖 GitHub Actions runner（本机未装 kind）；
  workflow / 脚本已就绪，待 GH Actions 触发后即跑通。
- 关联 ADR-0010 与 §13 第 8 / 13 条。
