# ADR-0070：Axiom 运行时违规检查端点（POST /v2/axioms/validate）

- **状态**：Accepted（2026-09-24）
- **日期**：2026-09-24
- **关联**：ADR-0069（IA v2）、ADR-0021（Kernel 12 基元）、IA 审视项 F

## 1. 背景

12 基元中 Axiom 目前只有 CRUD 清单页，无「这条公理在当前数据上是否被违反」的运行时检查能力。
SHACL validate（`POST /v2/shacl/validate`）验证的是 **ObjectType 定义合成 shapes** 的实例合规，
不消费 Axiom 公理。公理驱动的违规检查是独立能力。

## 2. 决策

新增端点 `POST /api/v1/ont/v2/axioms/validate`（operationId `ontValidateV2Axioms`）：

```
body: { axiom_rid?: string, target_class?: string }
→ { conforms: boolean, violations: [...], stats: { checked, violated, skipped } }
```

Core 第一批检查规则（AxiomKind 子集，其余 skipped）：

| kind | 检查逻辑 |
| --- | --- |
| `disjoint` | 个体通过 parent_class 链同时属于两个不相交类 → violation |
| `has_key` | 同类下两个实例 primary_key 相同 → violation |
| `subclass` | sub == super 或循环 → violation（公理结构错误） |

不检查的 kind → `skipped`（计数不计红）。与 SHACL 报告结构一致：`{conforms, violations, stats}`。

## 3. 不做的

- 不做完整 OWL 2 推理机——Core 三条规则是可立即消费的最小集。
- 不做公理间的冲突检测（如 disjoint vs subclass 交叉）。
- 不改 Axiom CRUD 契约。

## 4. 前端接入

公理页（AxiomsPage）加「运行时校验」按钮 → SheetDetail 抽屉显示 conforms/violations/stats。

## 5. 实施与验证

- **实现**：`mate_tech_ont/v2_kernel/axiom_validation.py`（纯函数，无 IO）+
  `v2_kernel/api.py::validate_axioms_endpoint`（`_scoped_repo` 走 GOVERN-06 tenant 三层
  防线；`axiom_rid` / `target_class` 均做 `ont.<tenant>.` 前缀守门 → 跨租户 403）。
- **测试**：`packages/mate-tech-ont/tests/test_axiom_validation.py` 16 项（10 单元 +
  6 HTTP：200 / 401 无 ctx / 403 跨租户 ×2 / axiom_rid 过滤 / 违规命中）。
- **契约**：`contracts/openapi/services/ont.yaml` + `platform.yaml` + 
  `generated/bundled.yaml` 三处同步；`compare_runtime.py` `missingInRuntime: []`。
- **真实链路**：容器热更后，经网关 + 真实 JWT 实测 `{}` → 200
  （`checked:82, violated:0, skipped:0`）、跨租户 → 403；浏览器点「运行时校验」
  抽屉渲染同数字。
- **证据**：`docs/active/delivery/evidence/ONT-AXIOM-VALIDATE-ACCEPTANCE.md`。

### 已知边界

1. 单次校验对每个实例逐级回查 `get_object_type`（类链），未做批量预取——租户实例
   规模上千时是 N+1，属可优化项，不影响正确性。
2. `subclass` 规则只判成环（自环/二级环），不做「A ⊑ B 但 B 与 A 不相交」这类公理间
   交叉冲突（见 §3）。
3. 三个 Core kind 之外的公理（`transitivity` / `property_chain` / `functional` …）
   恒计入 `skipped`，不产生违规判定。
4. 违规态（`conforms: false`）的浏览器渲染未用真实数据实证——只在共享 dev 库里
   造违规实例才行，会污染租户数据；违规判定本身由单元 + HTTP 测试覆盖。
