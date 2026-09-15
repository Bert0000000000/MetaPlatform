# ADR-0064：Action 统一为 EditSet（ONT-ACT-05 补齐）

> **状态**：**Accepted + 已实施**（2026-09-15 评审拍板；S1–S4 收口记录见 §8）
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
| **兼容期（2026-09-15 拍板）** | `function_result` 回写**无限期保留**（长期兼容路径，不设废弃时间点）；audit 事件打 `is_compat` 标记观察采用率 |
| **规约①边界（2026-09-15 拍板）** | **禁止混用**：function 返回 `{"edits":[...]}` 时必须是纯 edits 对象，多余字段 → **422** |
| **编辑权限（2026-09-15 拍板）** | 统一执行器**完整接入**安全闸门：SEC-12 行/列策略 + G6 marking 血缘合取门 + G7 scoped session（X-Scope-Markings 收窄），写入前逐 edit 校验；无策略/无 marking 配置时默认放行（现网零行为变化） |
| **AI 工具名（2026-09-15 拍板）** | `propose_action_<slug>` **不改名**；S3 仅更新工具描述与实际行为一致 |

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
| 安全 | 行策略命中 → 该 edit 被拒（422/403，报具体策略）；列策略 → 属性写被拒；marking 合取门 → 拒写；X-Scope-Markings 收窄后越界 edit 被拒 |
| 安全 | 无任何策略/marking 配置时，执行结果与现状完全一致（零回归，27/27 不受影响） |

---

## 6. 分阶段实施（本 ADR 通过后）

| 阶段 | 内容 | 出口 |
| --- | --- | --- |
| **S1 · 模型层** | `function_ref` 可选；约束改「至少一个」；`_row_to_at` 去静默兜底；serde 补 `declarative_edits` 往返 | 三条单元验证绿 |
| **S2 · 执行器统一 + 安全闸门** | function 返回值按两规约解释（规约①必须纯 edits 对象，混用 422）→ 合并进 EditSet 同一事务；**写入前安全闸门完整接入**（行/列策略 + marking 合取门 + scoped session，逐 edit 校验）；audit 事件打 `is_compat` 标记 | 混合式 ActionType 端到端绿；策略拦截 / marking 拒写 / scoped 收窄各 ≥1 测试绿；无配置零回归 |
| **S3 · 入口与 AI 面** | `propose` 按 ActionType 声明分派（不再要求走对端点）；`propose_action_*` 工具描述与实际一致 | 走错端点不再 500 |
| **S4 · 契约与证据** | OpenAPI 更新 + ACCEPTANCE 段落 + 订正差距分析文档的 v1 1000 | 硬规则 2/10 覆盖 |

> 提交顺序遵循 CLAUDE.md：`docs/ADR → contract → failing tests → feature → deploy → acceptance evidence`。

---

## 7. 评审结论（2026-09-15 用户拍板，原 Open Questions 已全部关闭）

| # | 问题 | 结论 |
|---|---|---|
| 1 | 过渡期长度：`function_result` 直接回写保留多久？ | **无限期保留**；不设废弃时间点；audit 打 `is_compat` 标记观察采用率（与 ADR-0061「迁移完成前不删 legacy」纪律一致） |
| 2 | 规约①边界：返回 `{"edits":[...]}` 时可否混用普通字段？ | **禁止混用**；纯 edits 对象，多余字段 422 |
| 3 | 编辑权限：统一执行器是否接行/列级策略检查？ | **完整接入**（行/列策略 + marking 血缘合取门 + scoped session），写入前逐 edit 校验；见 §2 决策表与 S2 出口标准 |
| 4 | AI 工具命名：`propose_action_<slug>` 是否改名？ | **不改名**；S3 仅更新工具描述与实际行为一致 |

---

## 8. 实施记录（2026-09-15 S1–S4 收口）

> 分支 `feat/ont-act05-edit-set`；测试 `packages/mate-tech-ont/tests/test_ont_act05_unified.py` 27 项；
> 三包回归 **1410（基线）→ 1437**；契约 `contracts/tests` 34 绿 + bundle 重生成；
> 部署态冒烟 `scripts/smoke/act05u_deploy_smoke.py` 经网关 **SMOKE PASS（0 失败）**。

| 阶段 | Commit | 交付 |
|---|---|---|
| S1 模型层+契约 | `ec113971` | `function_ref: ClassRef \| None` + `__post_init__`「至少声明一个」；`_row_to_at` 去 noop 兜底；serde/DTO/契约（`ActionTypeV2`/`ActionTypeCreateV2`）可选化 + 补 `declarative_edits`/`title`/`description`（契约此前全缺） |
| S2 统一执行器+闸门 | `b2e1c9d1` | kernel `action/unified.py` 组装器（显式 body edits = 全集跳过 function；两规约：①纯 edits 混字段报错、②映射转 set_property 打 `is_compat`）；`ActionService.invoke_function`；`check_edit_permissions`（行/列/G6/G7，空 viewer 直通零回归）；PG/InMemory 双仓统一；legacy 路径恒 `is_compat=True` |
| S3 入口+AI 面 | `c717254a` | execute 端点 markings 参数 + `FunctionNotRegistered`/`WritePolicyError`→422；两 edit-set 端点只透传显式 edits（回落链在执行器）；InMemory 签名对齐；工具描述去端点绑死（D-7 不改名） |
| S4 契约+部署+证据 | 本 commit | bundle 重生成 + contracts/tests 34 绿；容器重启 + 部署态 A（纯声明式 propose→confirm→execute→revert）/ B（混合式双声明 + 显式 edits 执行）全过；`revert_proposal` 修复——kind=action 经统一执行器的 execution 带 inverse 即按 edit_set 补偿（legacy 无 inverse 自然 audit-only） |

**实测语义补充（实现固化）**：
- 显式 body edits 视为**全集**（替换声明式模板且跳过 function）——function 的职责是产出 edits，
  调用方自带时无需再算；kind=action 扁平参数恒走 ActionType 声明路径。
- kind=action 且声明式/混合式 → execute 分派统一执行器（`result.kind="edit_set"`）；
  纯 function 式 → legacy 回写（`result.kind="action"`, `is_compat=True`）。
- 无任何策略/marking 配置时执行结果与现状一致（27/27 零回归；安全闸门空 viewer markings 直通，
  与读端点 opt-in 同口径）。
