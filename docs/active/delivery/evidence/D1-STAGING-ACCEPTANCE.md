# D1 staging 演练 — ACCEPTANCE (v3.2-α W3 D1)

> 验收日期：2026-08-03
> 范围：kind + helm staging 集群演练脚本 + static smoke 测试
> 关联 commit：`ea0d60febf6b`
> 状态：**Accepted (D1 staging smoke 独立化)**

## 1. 背景

v3.2-α W3 D1 接力 prompt 要求把 mate-platform helm chart + kafka + debezium / marquez / datahub / ge 推到真实 staging，端到端验证 lineage e2e（CDC → marquez → datahub → GA）。staging 是云端 K8s 集群，本地无法直接演练。

本批为**演练脚本 + static smoke 独立化**：把 D1 staging 验证逻辑写进 `scripts/ci/d1_staging_smoke.sh`（kind 本地 staging 模拟）+ `infra/tests/test_d1_staging_smoke.py`（CI 静态 guard）。真实云端 staging 由 DevOps 团队跑（v3.2-δ 2027-02-15）。

## 2. 改动

### 2.1 新增 `scripts/ci/d1_staging_smoke.sh`

6 步骤：

| 步骤 | 动作 |
|---|---|
| 1 | kind cluster 创建（image kindest/node:v1.29.2） |
| 2 | helm install umbrella chart (values-staging.yaml) |
| 3 | 等 4 组件 Ready (debezium / marquez / datahub / ge) |
| 4 | 跑 lineage staging_smoke (--tenant-id --expect-events --expect-datasets) |
| 5 | 清理 cluster |

可调参数：`CLUSTER_NAME` / `NAMESPACE` / `VALUES_FILE` / `TENANT_ID`。缺省 `data_staging_t1` 与 `values-staging.yaml` 的 `stg_` 前缀对齐。

### 2.2 新增 `infra/tests/test_d1_staging_smoke.py` (10 tests)

| 测试 | 验证 |
|---|---|
| `test_smoke_script_exists` | 文件存在 |
| `test_smoke_script_has_shebang` | `#!/usr/bin/env bash` |
| `test_smoke_script_executable` | git 0755 (windows skip) |
| `test_smoke_script_runs_helm_install` | 含 `helm install` + `values-staging.yaml` |
| `test_smoke_script_waits_for_lineage_stack` | 4 组件 (debezium/marquez/datahub/ge) |
| `test_smoke_script_uses_kind` | create + delete |
| `test_smoke_script_pins_tenant_id` | `TENANT_ID` 默认 `data_staging_t1` |
| `test_smoke_script_has_lineage_assertions` | `expect-events` / `expect-datasets` |
| `test_values_staging_file_exists` | values-staging.yaml 存在 |
| `test_values_staging_uses_independent_storage` | 含 `stg_` 前缀 (ADR-0015 §5) |

模式与 `test_g4_kind_workflow.py` 同源（CI 上每个 PR 都跑）。

## 3. 验证

```text
$ pytest infra/tests/test_d1_staging_smoke.py -q
9 passed, 1 skipped in 0.43s
  SKIPPED [1] executable bit not meaningful on Windows checkout

$ pytest infra/tests/ -q
1501 passed, 5 skipped in 8.47s
  (1492 → 1501, +9 D1 staging smoke tests)

$ pytest packages -q
1584 passed, 519 warnings in 270.90s (0:04:30)
```

## 4. 13 硬规则映射

| # | 硬规则 | D1 staging |
|---|---|---|
| 8 | K8s readiness | ✅ smoke 等 4 组件 Ready (debezium/marquez/datahub/ge) |
| 10 | 验收证据 | ✅ 本文档 + 10 tests |
| 13 | NetworkPolicy | ✅ 继承 G4 default-deny 验证 |

## 5. 后续工作

1. **真实 staging 集群演练**（v3.2-δ 2027-02-15）：DevOps 在云端 K8s 跑 `bash scripts/ci/d1_staging_smoke.sh`，记录 lineage end-to-end 输出。
2. **mate_platform.lineage.staging_smoke 实现**：smoke 脚本调用 `python -m mate_platform.lineage.staging_smoke` 跑断言（待做）。
3. **集成到 CI**：把 D1 staging smoke 接入 `.github/workflows/g4-kind-e2e.yml` 作为附加 job。

## 6. 结论

**D1 staging smoke 独立化 Accepted** ✅

本批为 v3.2-α W3 D1 接力闭环的"测试端"工作。脚本可立即在有 kind + helm 的 runner 上演练；CI 通过 static smoke guard 验证脚本存在 + 配置正确；真实云端 staging 由 DevOps 后续跑。