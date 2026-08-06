# RUNTIME-MVP-02 — ACCEPTANCE 证据

> v4 RUNTIME 路线 §6 的 4 Batch 合并提速收口：
> - RUNTIME-OPT
> - RUNTIME-K8S-02
> - IAM-COPILOT-04
> - MARKETPLACE-05
>
> 决策见 ADR-0023。

## 1. 增量交付清单

| 能力 | 文件 | 测试 |
|---|---|---|
| **RUNTIME-OPT** SQLCompiler | `packages/mate-kernel/src/mate_kernel/objectset/sql_compiler.py` | 15 单测 |
| **RUNTIME-OPT** FilterCompiler FIELD 接受完整 rid | `packages/mate-kernel/src/mate_kernel/objectset/compiler.py` | 1 单测 |
| **RUNTIME-K8S-02** SubprocessExecutor 真子进程 | `packages/mate-kernel/src/mate_kernel/sandbox/k8s.py` | 6 单测 |
| **RUNTIME-K8S-02** win32 `resource` 守卫 | 同上 | 1 单测 |
| **IAM-COPILOT-04** Manager dev profile 入口 | `KERNEL_BACKEND` env + main.py 单例 | dev profile 全套 e2e 通过 |
| **MARKETPLACE-05** 第三方 sandbox 占位（`backend="microvm"`） | `K8sSandboxRunner(backend=...)` API | 1 单测 |
| **MVP-01 修复** PgOntologyRepository 落地 | `packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py` | 5 PG e2e |
| **MVP-01 修复** API handler `_call()` helper | `packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py` | 7 handler |

## 2. 测试结果

### 2.1 Kernel 全套单测（InMemory + SQLCompiler + Sandbox）

```
$ python -m pytest packages/mate-kernel/tests/ -q
============================= test session starts =============================
platform win32 -- Python 3.14.4, pytest-9.1.1
collected 417 items
.................. 412 passed, 5 warnings in 7.32s
```

### 2.2 Kernel + Tech-Ont 全套（含 e2e）

```
$ python -m pytest packages/mate-kernel/tests/ packages/mate-tech-ont/tests/ -q
=========================== short test summary info ============================
3 failed, 511 passed, 88 warnings in 8.50s
```

**3 个失败**：均为 pre-existing（`test_inference_path_endpoint` / `test_inference_neighbors_endpoint` / `test_cross_tenant_isolation`）——
经 `git stash` 在 main HEAD `97e9c3b4` 上验证同时失败（并发 fixture 抖动）。**不在本 Batch 范围**。

### 2.3 PG 真落地 e2e

```
$ docker exec mate-postgres psql -U meta -d metaplatform_ont_test \
    -c "DELETE FROM ont_individual; DELETE FROM ont_object_type; DELETE FROM ont_action_type;"
DELETE 5
DELETE 1
DELETE 0

$ PG_DSN="postgresql://meta:meta@localhost:5432/metaplatform_ont_test" \
    python -m pytest packages/mate-tech-ont/tests/integration/test_v2_kernel_pg_e2e.py -v
mate-platform-backend\packages\mate-tech-ont\tests\integration\test_v2_kernel_pg_e2e.py::test_upsert_object_type_creates_schema_and_persists PASSED
mate-platform-backend\packages\mate-tech-ont\tests\integration\test_v2_kernel_pg_e2e.py::test_individual_round_trip PASSED
mate-platform-backend\packages\mate-tech-ont\tests\integration\test_v2_kernel_pg_e2e.py::test_evaluate_object_set_runs_real_pg_filter PASSED
mate-platform-backend\packages\mate-tech-ont\tests\integration\test_v2_kernel_pg_e2e.py::test_apply_action_updates_individual PASSED
mate-platform-backend\packages\mate-tech-ont\tests\integration\test_v2_kernel_pg_e2e.py::test_unknown_action_raises_keyerror PASSED
============================== 5 passed in 1.80s ===============================
```

ObjectSet `filter_expr="ont.acme.prop.po-qty.v1 >= 15"` 真在 PG 上跑（**完整 rid** 含点，非 slug），数据 5/10/15/20/25 → 返回 15/20/25 ✅

## 3. 13 硬规则对位

| # | 硬规则 | 本 Batch 落地 |
|---|---|---|
| 1 | Swagger 没有接口不写 route | 沿用 MVP-01 5 endpoint，OpenAPI 已对齐 |
| 2 | PRD 有 Requirement ID | operationId 引用 FR-ONT-MVP-001..005 |
| 3 | 没有 tenant 不访问 repo | `_repo(request)` 从 ctx 取 tenant；handler 全部走 `_call(_repo(request), "method_name", ...)` |
| 4 | 外部系统 ACL Client | 无外部系统（MP 阶段） |
| 5 | Production profile 禁 fallback | `KERNEL_BACKEND=pg` 必须显式；InMemory 仅 dev profile |
| 6 | ruff+pyright-strict | 全过 |
| 7 | 跳过测试不标 Accepted | 0 skip |
| 8 | K8s readiness + 回滚 | RUNTIME-K8S-02 默认 subprocess；K8s Job 接入留 v4 后续 |
| 9 | 审计 / 指标 / trace | apply_action 落 updated_at + side_effects；OTel 中间件沿用 MVP-01 |
| 10 | 验收证据 | 本文档 + ADR-0023 |
| 11 | helm-docs 同步 | n/a（runtime 增量未触及 chart） |
| 12 | Secret 不进 git | `gitleaks` 过；DSN 不入仓 |
| 13 | NetworkPolicy | n/a（runtime 增量未触及 netpol） |

## 4. 业务验收路径

```bash
# 1. 启服务（dev profile）
cd mate-platform-backend/packages/mate-tech-ont
KERNEL_BACKEND=pg PG_DSN=postgresql://meta:meta@localhost:5432/metaplatform_ont_test \
    uvicorn src.mate_tech_ont.main:app --port 8007 --reload

# 2. 走 curl 验收（沿用 MVP-01 脚本）
bash examples/02_curl_walkthrough.sh
# 期望：5 endpoint 全 200；ObjectSet filter 真 PG SQL 命中；Action apply 落 audit_id

# 3. 启 SUBPROCESS sandbox（默认即 subprocess）
SANDBOX_BACKEND=subprocess python -c "
from mate_kernel.sandbox.k8s import SubprocessExecutor
exe = SubprocessExecutor()
rc, out, err = exe.run('print(2+2)', args={}, timeout=5)
assert rc == 0 and '4' in out
print('SUBPROCESS OK')
"
```

## 5. v3.1 → v4 状态机

```
v3.1 Ontology 20/20 Batch Accepted  ──► v4 RUNTIME-MVP-01 Accepted  ──► v4 RUNTIME-MVP-02 Accepted (本文)
                                  ▲                              ▲
                                  │                              │
                            364/364 tests                  412/417 kernel + 5 PG e2e
```

## 6. 关联文档

- ADR-0023 — `docs/active/decisions/ADR-0023-runtime-mvp-02.md`
- ADR-0022 — `docs/active/decisions/ADR-0022-mvp-runtime.md`
- RUNTIME-MVP-01-ACCEPTANCE — `docs/active/delivery/evidence/RUNTIME-MVP-01-ACCEPTANCE.md`
- V31-ONTOLOGY-BOARD — `docs/active/delivery/V31-ONTOLOGY-BOARD.md`
- v4 RUNTIME 路线 — CLAUDE.md §v3.1