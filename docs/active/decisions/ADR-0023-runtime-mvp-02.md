# ADR-0023 — v4 RUNTIME-MVP-02 合并提速收口

**状态**：Accepted
**日期**：2026-08-06
**取代**：ADR-0022（v4 RUNTIME-MVP 合并提速 — HTTP+PG）
**对应 v4 BOARD §6**：RUNTIME-OPT / RUNTIME-K8S-02 / IAM-COPILOT-04 / MARKETPLACE-05

## Context

v4 BOARD §6 路线原计划 5 个 Batch 共 19 周：

```
RUNTIME-HTTP-01 (4 周)  RUNTIME-K8S-02 (4 周)  RUNTIME-PG-03 (4 周)
IAM-COPILOT-04  (3 周)  MARKETPLACE-05      (4 周)
```

**ADR-0022**（2026-08-06）已把 RUNTIME-HTTP-01 + RUNTIME-PG-03 合并为 RUNTIME-MVP-01 并落地。main HEAD 收口 251/251 tests，e2e 5 endpoint 全 200，业务可 curl + 真持久化。

今日（2026-08-06）追加 **RUNTIME-MVP-02** —— 一次性把剩余 4 个 Batch 的"可验收"增量合并提速：

| 原 Batch | RUNTIME-MVP-02 内增量 |
|---|---|
| RUNTIME-OPT | ObjectSet 真在 PG 上跑（SQLCompiler + 完整 rid 字段名） |
| RUNTIME-K8S-02 | Function Sandbox 默认 backend = subprocess（`K8sSandboxRunner` 选 `backend="subprocess"`；`sys.platform == "win32"` 时 `import resource` 守卫） |
| IAM-COPILOT-04 | ManagerContext 走 dev profile（`LEGACY_LOGIN_COMPAT=1`），AGENT-EXT-01 super-copilot 可用 |
| MARKETPLACE-05 | 第三方 sandbox 占位：默认 subprocess；为 L3 MicroVM 留口子（`backend="microvm"` 待接） |

## 决策

**接受**：v4 剩余 4 个 Batch 用单次 PR RUNTIME-MVP-02 合并提速，对位 ADR-0022 的"少批量、端到端可验收"策略。

理由：

1. **每个增量都是验收层**，不是底层基础设施 —— SQLCompiler / subprocess sandbox / Manager dev profile / microvm 占位都是"业务可立即看到效果"的层；不存在依赖未达成的状态。
2. **不影响 v3.0/v3.1 GA 收口** —— 仅追加 PG 真查询、Sandbox 默认 backend、Manager dev 入口；13 硬规则守住（tenant guard / 无 fallback / secret scan / pyright-strict 全过）。
3. **MVP-01 的 PgOntologyRepository 是真持久化基座** —— RUNTIME-OPT 直接挂 SQLCompiler，不需要再等底层 schema 收敛。
4. **v3.1 SANDBOX-01 L1 进程级已收口** —— RUNTIME-K8S-02 把 `subprocess` 提为默认 backend，是把"占位实现"替换为"真进程隔离"，而非新建基础设施。

## 实施清单

| 文件 | 改动 |
|---|---|
| `packages/mate-kernel/src/mate_kernel/objectset/sql_compiler.py` | **NEW** —— CompiledFilter → 参数化 SQL WHERE + ORDER BY + LIMIT/OFFSET |
| `packages/mate-kernel/src/mate_kernel/objectset/__init__.py` | +`SQLCompiler`, `is_safe_identifier` |
| `packages/mate-kernel/src/mate_kernel/objectset/compiler.py` | FIELD regex 接受 `ont.<tenant>.prop.<slug>.v<n>` 完整 rid |
| `packages/mate-kernel/src/mate_kernel/sandbox/k8s.py` | `import resource` 守卫（win32）；`SubprocessExecutor` 真子进程（timeout + RLIMIT_AS） |
| `packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/pg_repo.py` | **NEW** —— PgOntologyRepository（psycopg2 sync + asyncio.to_thread） |
| `packages/mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py` | `_call()` helper + 7 handler 全部 `await _call(_repo(request), "method_name", ...)` |
| `packages/mate-tech-ont/tests/integration/test_v2_kernel_pg_e2e.py` | **NEW** —— 5 PG 真落地测试（含 ObjectSet filter 真 PG SQL） |
| `packages/mate-kernel/tests/test_objectset_sql_compiler.py` | **NEW** —— 15 SQLCompiler 单测 |
| `packages/mate-kernel/tests/test_sandbox_subprocess.py` | **NEW** —— 6 SubprocessExecutor 单测 |
| `packages/mate-kernel/tests/test_sandbox_k8s.py` | M —— test_submit_no_callable 接受 "no callable" / "NO_HANDLER" |
| `packages/mate-kernel/tests/e2e/test_kitchen_sink_e2e.py` | M —— test_handler_executes 接受 "42" in stdout |

## 验收

- `python -m pytest packages/mate-kernel/tests/ packages/mate-tech-ont/tests/ -q` → 511/514 pass（3 pre-existing failure 经 `git stash` 验证不在本 PR 范围）
- `PG_DSN=postgresql://meta:meta@localhost:5432/metaplatform_ont_test pytest ...test_v2_kernel_pg_e2e.py` → **5/5 pass**
- 13 硬规则 CI gate 全过（`forbid_legacy_fallback` / `forbid_raw_sql` / `require_evidence` / `pyright-strict`）

## 后续（不在本 Batch）

- `backend="microvm"`（Firecracker）真实接入（v4 后续）
- MANAGER 真鉴权（v3.0 SEC-IAM-01 已就位；kernel 层 ManagerContext 仍是 dev profile）
- Marketplace 真上架（v4 后续）

## 关联

- ADR-0022 —— RUNTIME-MVP-01（HTTP+PG 合并）
- ADR-0021 —— Kernel 12 基元
- ADR-0040 —— Sandbox 架构（Function L2 + 第三方 L3）
- ADR-0041 —— Session Sandbox
- v4 BOARD §6 —— v4 RUNTIME 路线