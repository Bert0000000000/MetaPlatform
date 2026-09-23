# ADR-0072：预检报告状态词汇与执行前 fail-closed

- **状态**：Accepted（2026-09-23）
- **日期**：2026-09-23
- **关联**：ONT-GATE-01（三闸门预检）、ADR-0044（assisted action）、
  13 硬规则 #5（production 禁止 fallback / 不得伪成功）

## 1. 背景

ONT-GATE-01 的 `_proposal_preflight`（`v2_kernel/api.py`）在**取数或计算失败**时
把异常吞成一份「通过」报告：

```python
except KeyError:  # subject 类型/公理不可得
    return {"blocked": False, ...}          # ← 静默放行
except Exception as e:
    return {"blocked": False, ...}          # ← 静默放行
```

而 `execute_proposal` 的唯一闸门是：

```python
if preflight is not None and preflight.get("blocked"):  # 409
```

即 **校验不可用 = blocked False = 允许提交**。任何一次类型/公理/SHACL 的读取或计算
异常（依赖抖动、RLS、超时、代码缺陷）都会把「机器预检」这道 HITL 之后的强制底线
变成**放行**。同时报告只有 `blocked` 布尔，无法区分「通过 / 违规 / 不适用 / 部分完成 /
不可用」——运维与前端都无法判断该「改提案」还是「等依赖恢复重试」。

## 2. 决策

### 2.1 报告引入五值状态词汇

`PreflightReport` 增加 `status` 与 `unavailable`：

| status | 含义 | blocked | execute |
| --- | --- | --- | --- |
| `passed` | 所有**适用**闸门跑过且通过 | false | 放行 |
| `violation` | 至少一项 violation 级发现 | true | 409 `E409_PREFLIGHT_BLOCKED` |
| `not_applicable` | 该 kind 不设闸（报告返回 `None`） | — | 放行 |
| `partial` | 适用闸门**部分**不可用（其余已跑） | true | 409 `E409_PREFLIGHT_UNAVAILABLE` |
| `unavailable` | 适用闸门**全部**不可用 | true | 409 `E409_PREFLIGHT_UNAVAILABLE` |

`blocked = status ∈ {violation, partial, unavailable}`；`violation` **优先于**不可用
（有断言胜过无断言）。

### 2.2 逐闸门捕获异常

API 层不再整体 try/except，而是**按闸门**分别捕获：取数失败（`_fetch`）或纯计算失败
（`_gate`）只把**该闸**登记为不可用，并传「未执行」占位（`checked=False`），**绝不以空
数据冒充通过**。类型取不到 → 依赖它的三闸全不可用（`unavailable`）；仅公理或仅 SHACL
失败 → `partial`。闸门原语（`gate_schema_*` / `gate_shacl_instance` / `gate_axioms_*`）
与 `build_gate_report` 落在 `mate_kernel/ontology/preflight.py`，与既有 `preflight_*`
便捷封装共用同一实现源。

### 2.3 预览可见、执行不可授权

`GET /proposals/{id}` 仍返回含故障的报告（供 UI 展示），但 `execute_proposal` **重算**
报告并据 `status` 拒绝——快照不作准，`blocked=false` 不再掩盖异常。

### 2.4 InMemory 对齐

`InMemoryOntologyRepository` 补 `list_axiom_records`（与 PG 同形），使 dev/InMemory
profile 下公理闸真正执行，而不是恒「不可用」——避免修复后把 dev 流程误伤成一律阻断。

## 3. 不做的

- **不改 postflight**：`_proposal_postflight` 是**落库后**复核，其失败语义已是
  `needs_attention`（不改变执行成败），不在本批「执行前 fail-closed」范围内。
- 不新增闸门种类 / 不改三闸门判定规则 / 不改契约（`preflight` 字段本就不在
  OpenAPI schema 中，属既有债务）。
- 不改前端渲染逻辑（`ProposalConfirmDrawer` 已按 `blocked` 禁用按钮并展示 `summary`；
  仅同步 TS 类型新增可选字段）。

## 4. 实施与验证

- **实现**：`mate_kernel/ontology/preflight.py`（状态词汇 + 逐闸门原语 + `build_gate_report`）、
  `mate_kernel/ontology/in_memory.py`（`list_axiom_records`）、
  `mate_tech_ont/v2_kernel/api.py`（`_proposal_preflight` 重写 + execute 状态感知拒绝）。
- **测试**：`packages/mate-tech-ont/tests/integration/test_v2_kernel_preflight_unavailable.py`
  6 项（先红后绿）；`packages/mate-kernel/tests/test_preflight.py::test_to_dict_shape` 同步扩键。
- **证据**：`docs/active/delivery/evidence/ONT-PREFLIGHT-FAILCLOSED-ACCEPTANCE.md`。

## 5. 已知边界

- **`unavailable` 的判定粒度到闸门名**（schema/shacl/axioms），不到具体规则；足以驱动
  「重试」与「改提案」的区分，但不做逐规则错误定位。
- **postflight 未纳入状态词汇**（见 §3），后续若需要可独立批次。
- **契约未含 `preflight`**：本批未把该字段补进 OpenAPI（既有债务），登记为后续批次。
