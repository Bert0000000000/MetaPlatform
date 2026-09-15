# ADR-0064：Action 统一为 EditSet（ONT-ACT-05 补齐）

> **状态**：**Proposed**（待评审）
> **日期**：2026-09-15
> **作者**：Claude + 用户协作
> **关联 ADR**：ADR-0021（Kernel 12 基元）、ADR-0040（沙箱架构 · Function L2）、ADR-0044（assisted action · HITL 唯一写路径）、ADR-0063（Function 源码解析）
> **关联硬规则**：硬规则 5（Production profile 禁止 fallback）、硬规则 9（审计/指标/trace）
> **来源**：`docs/active/specs/2026-09-09-ontology-gap-analysis-and-optimization.md` §5 Wave 2 · ONT-ACT-05 · 差距 G18
> **触发**：2026-09-15 核查发现「G18 ✅」只交付了设计的一半，且实现与设计原文不一致

---

## 1. 背景

### 1.1 Palantir 的模型（调研原文）

`docs/active/specs/palantir_ontology_dump/action-types.txt:7-10`：

> An action type defines **a set of changes or edits** to objects, property values, and links
> that a user can take **at once**, including side effects. Action types can be
> **backed by functions** (function-backed actions) **or** by **simple rules** that
> create/modify/delete objects or links. **Ontology edit functions must be configured as
> Actions (function-backed Actions) to take effect.**

即：**edits 是本体，function 是产生 edits 的一种 backing**——不是两条并列的路。

### 1.2 本仓自己的设计原文

差距分析 §5 Wave 2（ONT-ACT-05，第 200 行）：

> Action 升级为：parameters + **声明式 edits 列表**（set_property / create_object /
> delete_object / add_link / remove_link，每条带 target 选择器）+ **可选 function_ref
>（function 返回 edits）**；单事务原子提交；批量对象上限（v1 1000）
> 关键设计：**现有 function_result 回写模式保留为兼容路径**

### 1.3 实现的偏离（2026-09-15 核查）

| 设计原文 | 实现 | 差距 |
|---|---|---|
| edits 列表 | ✅ 有（5 算子 / 模板 / 单事务 / 逆编辑） | — |
| **`function_ref` 可选** | ❌ **必填**（`ActionTypeDTO.function_ref: str` 无默认值） | **A** |
| **function 返回 edits** | ❌ function 返回值走 `function_result` → 直接合并进 `target.props` | **B** |
| 两条来源汇入同一执行器 | ❌ 做成**两个平行端点**（`propose` / `propose-edit-set`），由 `proposal.kind` 分派 | **C** |
| `function_result` 回写保留为**兼容路径** | ⚠️ 它是**唯一被使用的路径**（27/27 ActionType 全为 function 式，`declarative_edits` 零采用） | **D** |

**实测后果**（均已复现）：

1. **纯声明式 ActionType 建不出来** —— 契约强制 `function_ref`，只能硬塞一个不存在的 rid。
2. **走错端点得 500** —— 声明式 ActionType 调 `propose`（action 路径）→ propose 200 → **execute 500**（`FunctionNotRegistered`）；调用方无从知道该换 `propose-edit-set`。
3. **AI 面已按 edits 设计、库里却没有** —— `agent_tool_schemas` 生成的 `propose_action_<slug>` 工具描述写明走 `propose-edit-set`（`schema_gen.py:193`），但库中 27 个 ActionType 无一可被该路径执行。
4. **`_row_to_at` 有静默兜底** —— `function_ref` 为空时凭空造 `ClassRef("ont.system.fn.noop.v1")`（与 ADR-0063 S2 删除的同类病）。
5. **serde 丢字段** —— `action_type_to_dict` / `from_dict` **完全不含 `declarative_edits`**，序列化往返即丢编辑模板。

---

## 2. 决策

**把 Action 的执行产物统一为 EditSet；`declarative_edits` 与 `function_ref` 是 edits 的两个来源，可并存、不互斥。补齐 ONT-ACT-05 设计原文，而非另立方案。**

| 维度 | 决策 |
| --- | --- |
| **执行产物** | 统一为 **EditSet**（5 算子 / 单事务 / 可逆） |
| **`function_ref`** | **可选**（`ClassRef \| None`） |
| **两者关系** | **可并存**；约束改为「**至少声明一个**」，**不互斥** |
| **function 返回值规约** | ① 返回 `{"edits": [...]}` → 直接作为 edits；② 返回普通映射 → 按 `ActionType.parameters` 映射为 `set_property`（**现有行为降级为默认规约**） |
| **合并语义** | 声明式 edits + function-edits **合并后同一事务**应用 |
| **`function_result` 回写** | **保留为兼容路径**（设计明确要求，**不删**） |
| **批量上限** | 沿用 **10000**（实现值，对齐 Palantir 真实上限）；**订正设计文档的 v1 1000** |
| **HITL** | **不变**（D3+D7：AI 强制确认 / 人工预览即确认，同一条 proposal 管道） |

### 2.1 关键子决策：不引入互斥约束

评审中曾倾向「`declarative_edits` 与 `function_ref` 互斥」——**本 ADR 明确否决**。理由：
- Palantir 原文与 ONT-ACT-05 设计**都允许并存**（function-backed action 亦可附带声明式 edits）；
- 互斥会把「实现偏差」固化成「架构约束」，使 Action 永远无法表达「声明式改几个字段 + function 算一个复杂值」这类组合；
- 正确做法是**统一执行器**，而不是禁止组合。

### 2.2 兼容性边界

`function_result` 回写是现网 27/27 的唯一路径，**必须保持可用**。因此本 ADR **是加法而非替换**：
- 规约②（普通映射 → set_property）在语义上**等价于**现有回写；
- 过渡期内 `function_result` 直接回写保留，两条规约结果一致。

---

## 3. 理由

1. **回到设计原文**：ONT-ACT-05 早已写明「可选 function_ref（function 返回 edits）」，本 ADR 是补齐，不是新设计——减少评审面。
2. **消除静默歧义**：「同一 ActionType 走哪个端点决定行为」是当前最大的坑（走错 → 500），统一后端点按 ActionType 实际声明分派，不再有歧义。
3. **解锁 AI 面**：`propose_action_<slug>` 工具本就按 edits 模型设计，统一后它才真正可用。
4. **edits 是事务与可逆的基础**：只有把 function 的产物也纳入 EditSet，才能获得单事务原子性 + 逆编辑（revert）+ 批量上限的一致语义。
5. **不破坏现网**：`function_result` 回写保留为兼容路径（决策 §2.2）。

---

## 4. 后果

### 4.1 已接受的限制（须如实说明）

- **本章不含** 出站三通道（MCP / API / A2A）——那属独立议题（Action 执行的**外向**扩展），本 ADR 只收敛**内向**写路径统一。
- **不做** `declarative_edits` 的跨对象批量 target 选择器（Palantir 有 target selector；当前仍是单 `target_iid`）——记为后续。

### 4.2 破坏性影响

| 影响面 | 说明 |
|---|---|
| `ActionType.function_ref` 由必填变可选 | kernel dataclass 字段顺序变化（`on` 需补默认值）；所有构造点已用关键字参数，风险可控 |
| `ont_action_type.function_ref` 列 | 保持 `NOT NULL DEFAULT ''`，空串 = 声明式 |
| `_row_to_at` 不再造 `ont.system.fn.noop.v1` | 若库中存在依赖该兜底的行，读回后 `function_ref=None` → 需**至少声明一个**校验；实测库中 27 行全有真 function_ref，无影响 |
| OpenAPI 契约 | `ActionTypeDTO.function_ref` 变可选 → 需重新 bundle |
| `FunctionNotRegistered` 的 500 | 统一后该路径应消失；若仍出现应映射 **422** 而非 500 |

### 4.3 被否决的替代方案

| 方案 | 否决理由 |
| --- | --- |
| 两者**互斥**（约束固化） | 把实现偏差当架构；禁止声明式 + function 组合；与设计原文冲突（§2.1） |
| 只放开契约、不改执行器 | 治标：`function_ref` 可选了，但 function 产物仍不是 edits，统一性没兑现 |
| 删除 `function_result` 回写路径 | 违反设计原文「保留为兼容路径」，且会打断现网 27/27 |
| 新建第三套执行器 | 与「单一合法写入口」冲突 |

---

## 5. 验证

| 层 | 验证项 |
| --- | --- |
| 单元 | `ActionType` 允许 `function_ref=None` + `declarative_edits` 非空；允许两者并存；两者都空 → 报错 |
| 单元 | function 返回 `{"edits":[...]}` → 走 EditSet；返回普通映射 → 规约为 set_property（**与旧回写结果一致**） |
| 单元 | `serde` 往返保留 `declarative_edits` |
| 回归 | 现网 27/27 function 式 ActionType 的 apply 行为**不变**（兼容路径） |
| 端到端 | 声明式 ActionType：`propose → confirm → execute → revert`（2026-09-15 已实测通过，本 ADR 后须保持） |
| 端到端 | **混合式** ActionType（声明式 edits + function 计算值）→ 单事务落库，两者都生效 |
| 契约 | `contracts/openapi/services/ont.yaml` 的 `ActionTypeDTO.function_ref` 可选 + 重新 bundle |

---

## 6. 分阶段实施（本 ADR 通过后）

| 阶段 | 内容 | 出口 |
| --- | --- | --- |
| **S1 · 模型层** | `function_ref` 可选；约束改「至少一个」；`_row_to_at` 去静默兜底；serde 补 `declarative_edits` 往返 | 三条单元验证绿 |
| **S2 · 执行器统一** | function 返回值按两规约解释 → 合并进 EditSet；声明式与 function-edits 同一事务 | 混合式 ActionType 端到端绿 |
| **S3 · 入口与 AI 面** | `propose` 按 ActionType 声明分派（不再要求走对端点）；`propose_action_*` 工具描述与实际一致 | 走错端点不再 500 |
| **S4 · 契约与证据** | OpenAPI 更新 + ACCEPTANCE 段落 + 订正差距分析文档的 v1 1000 | 硬规则 2/10 覆盖 |

> 提交顺序遵循 CLAUDE.md：`docs/ADR → contract → failing tests → feature → deploy → acceptance evidence`。

---

## 7. 待评审问题（Open Questions）

1. **过渡期长度**：`function_result` 直接回写保留多久？是否设废弃时间点？
2. **规约①的边界**：function 返回 `{"edits":[...]}` 时，是否仍允许同时返回普通字段（即两种规约混用）？
3. **编辑权限**：EditSet 可改 1 万对象，是否需要在统一执行器里加**行/列级策略**检查？（关联差距 G5，属 Wave 4 SEC-12）
4. **AI 工具命名**：`propose_action_<slug>` 统一后是否改名（当前名暗示 action 路径，实际会走 edits）？
