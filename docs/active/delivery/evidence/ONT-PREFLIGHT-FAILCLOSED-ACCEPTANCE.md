# ONT-PREFLIGHT-FAILCLOSED 验收证据（预检状态词汇 + 执行前 fail-closed）

> **批次**：ONT-PREFLIGHT-FAILCLOSED（本体执行前校验异常放行收口）
> **日期**：2026-09-23
> **分支**：`fix/ont-preflight-fail-closed`（基于 `origin/main@1c012d7b`）
> **决策**：ADR-0072（`docs/active/decisions/ADR-0072-preflight-fail-closed-and-status-vocabulary.md`）
> **operationIds**：`ontProposeV2Instance` / `ontProposeV2ObjectType` / `ontProposeV2ActionType` /
> `ontGetV2Proposal` / `ontExecuteV2Proposal`（**均为既有端点，路径与契约未变**）
> **Requirement ID**：`FR-ONT-PREFLIGHT-FAILCLOSED`

## 1. 问题与根因

`_proposal_preflight`（`v2_kernel/api.py`）在**取数或计算异常**时把报告写成
`blocked: False`：

```python
except KeyError:   return {"blocked": False, ...}   # subject 类型/公理不可得
except Exception:  return {"blocked": False, ...}   # 计算异常
```

`execute_proposal` 的唯一闸门是 `if preflight.get("blocked")`。两者叠加 =
**任何校验异常都变成「放行」**（可提交、可落库、无成功执行记录可分辨）。
报告只有布尔 `blocked`，无法区分 通过 / 违规 / 不适用 / 部分完成 / 不可用。

## 2. 改动摘要与文件清单

**做了什么**：报告引入五值 `status` + `unavailable`；API 层**逐闸门**捕获异常，
失败之门标记不可用（不以空数据冒充通过）；`execute` 据 `status` 拒绝
（violation → `E409_PREFLIGHT_BLOCKED`；partial/unavailable → `E409_PREFLIGHT_UNAVAILABLE`）；
`GET` 仍展示故障但**不授权**。InMemory 补 `list_axiom_records` 对齐 PG，使 dev 闸门真跑。

**新增**：

| 文件 | 职责 |
| --- | --- |
| `mate-tech-ont/tests/integration/test_v2_kernel_preflight_unavailable.py` | 6 项（先红后绿）：passed / violation / 公理读失败→partial / 类型读失败→unavailable / SHACL 计算失败→partial / 不适用（merge）为 None |
| `docs/active/decisions/ADR-0072-...md` | 决策档（Accepted） |
| `docs/active/delivery/evidence/ONT-PREFLIGHT-FAILCLOSED-ACCEPTANCE.md` | 本文件 |

**修改**：

| 文件 | 改动 |
| --- | --- |
| `mate-kernel/src/mate_kernel/ontology/preflight.py` | 状态常量 + `PreflightReport.status/unavailable` + `_finish(status=...)`；新增逐闸门原语 `gate_schema_{instance,model,action}` / `gate_shacl_instance` / `gate_axioms_{instance,model}` 与 `build_gate_report`；三个 `preflight_*` 改为薄封装 |
| `mate-kernel/src/mate_kernel/ontology/in_memory.py` | 新增 `list_axiom_records`（与 PG 同形）——dev/InMemory 下公理闸真执行 |
| `mate-tech-ont/src/mate_tech_ont/v2_kernel/api.py` | `_proposal_preflight` 重写（逐闸门 `_gate`/`_fetch`）；`execute_proposal` 按 `status` 出码 |
| `mate-kernel/tests/test_preflight.py` | `test_to_dict_shape` 同步扩键（`status`/`unavailable`） |
| 前端 `apps/web/src/api/ont/kernel.ts` | `ProposalPreflight` 增可选 `status`/`unavailable`（与后端 `to_dict` 对齐） |

## 3. 实现要点与安全

- **fail-closed**：适用闸门全部不可用 → `unavailable`；部分 → `partial`；两者 `blocked=True`
  且 `execute` 409。**不再有 `blocked=false` 掩盖异常**。
- **违规优先**：有 violation 时 `status=violation`（即使另有闸门不可用）。
- **不冒充**：不可用闸门以 `checked=False` 占位，`schema_na`/`shacl_na` 显式标注「闸门未执行」，
  绝不传空公理集冒充「通过」。
- **预览可见、执行不授权**：`GET /proposals/{id}` 重算并展示故障报告；`execute` 重算并据
  status 拒绝——快照不作准。
- **dev 不误伤**：InMemory 补 `list_axiom_records`，避免修复后 dev 上一律 `unavailable`。

## 4. 测试命令与真实结果（2026-09-23 实测）

| 命令 / 用例 | 结果 |
| --- | --- |
| `pytest .../integration/test_v2_kernel_preflight_unavailable.py -q`（**修复前**） | **5 failed / 1 passed** —— 三个注入用例证实「异常=放行」（execute 返回 200），status 字段缺失 |
| 同上（**修复后**） | **6 passed** |
| `pytest .../test_v2_kernel_preflight_unavailable.py .../test_v2_kernel_preflight_gate.py -q` | **15 passed**（既有 violation 闸门无回归，仍 `E409_PREFLIGHT_BLOCKED`） |
| `pytest packages/mate-kernel/tests/test_preflight.py packages/mate-tech-ont/tests -q` | **533 passed / 0 failed / 0 skipped**（58.5s） |
| `ruff check` + `ruff format --check`（改动文件） | ✅ All checks passed / formatted |
| 前端 `npx tsc -b --noEmit` | **见 §4.1** |

### 4.1 前端类型检查

> `apps/web` → **`npx tsc -b --noEmit` ✅ exit 0**（`ProposalPreflight` 仅新增可选字段，
> 既有消费方零影响）。

## 5. 已知边界

1. **不可用粒度到闸门名**（schema/shacl/axioms），不到具体规则；足以区分「重试」与「改提案」。
2. **postflight 未纳入状态词汇**：`_proposal_postflight` 为落库后复核，失败语义是
   `needs_attention`（不改变执行成败），本批不动（ADR-0072 §3）。
3. **契约未含 `preflight`**：`ont.yaml` 的 proposal schema 本就不含该字段（既有债务），
   本批未补契约；登记为后续批次。**前端仅同步 TS 类型（可选字段），未改渲染逻辑**。
4. **SHACL 计算失败的注入用 monkeypatch 打桩**（`mate_kernel.ontology.shacl.validate_shacl`），
   非真实引擎崩溃；真实依赖故障由其等价路径（取数异常）覆盖。
5. **回滚**：`git revert` 本批提交即退回（纯增量 + 一处既有测试断言扩键）。

## 6. 结论

**准出达成**：执行前校验异常**不再放行**——`status` 五值可判定，`execute` 在
violation/partial/unavailable 下一律 409 且**零业务写入、提案停在 confirmed**；
既有违规闸门行为零回归；dev（InMemory）闸门真跑。

## CI 门禁与证据（LOOP-ROLLOUT-01 模板字段）

| job | 硬规则 | 本批状态 |
| --- | --- | --- |
| ga-001-openapi | 1 Swagger 没有接口不写 route | ⚠️ `preflight` 字段本就不在 `ont.yaml`（既有债务）；本批**不改路径、不改契约**，登记后续（§5.3） |
| ga-002-requirement-ids | 2 PRD 没有 Requirement ID | ✅ `FR-ONT-PREFLIGHT-FAILCLOSED`（本文件 §头部） |
| ga-003-tenant | 3 没有 tenant 上下文不访问 repository | ✅ 预检取数全走 `_call_scoped`（GOVERN-06）；测试用 PG 独立测试库 `metaplatform_ont_test` + 租户 `acme` |
| ga-004-acl-client | 4 外部系统没有 ACL Client | N/A 本批不新增外部调用 |
| ga-005-no-fallback | 5 Production profile 禁止 fallback | ✅ **本批核心**：校验不可用不再伪成功——`unavailable`/`partial` 一律阻断 |
| ga-006-static | 6 静态检查失败不合并 | ✅ `ruff check`/`format` 净；前端 `tsc` 见 §4.1 |
| ga-007-skip-tests | 7 契约或集成测试跳过不标记 Accepted | ✅ kernel+ont **0 skipped**（533 passed）；新增 6 项全真跑 |
| ga-008-helm | 8 没有 K8s readiness + 回滚 | N/A 本批无 K8s 改动；回滚见 §5.5 |
| ga-009-otel | 9 没有审计、指标、trace | ✅ 不可用/阻断写 `ont.preflight.gate_unavailable` / `ont.proposal.execute.blocked_by_preflight`（含 status） |
| ga-010-evidence | 10 所有状态以验收证据为准 | ✅ **本文件即数据源** |
| ga-011-helm-docs | 11 helm-docs 同步子 chart README | N/A 本批无 chart 改动 |
| ga-012-secret-scan | 12 Secret 不进 git | ✅ 无 secret 入 diff |
| ga-013-networkpolicy | 13 NetworkPolicy 缺失 = prod 不通过 | N/A 本批无网络策略改动 |

**证据**：本文件。**命令**：见 §4 测试表。
