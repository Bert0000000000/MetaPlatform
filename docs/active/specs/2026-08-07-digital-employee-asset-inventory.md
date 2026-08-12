# 数字员工资产清单 + 运行时原理（skills / prompt / action）

> 状态：**Draft v0.1** · 日期：2026-08-07 · 关联：ADR-0028（prompt 单一数据源）/ ADR-0029（DW tenant 命名空间）/ 蓝图 v0.4 §4.1（7+1 数字员工）
> 目的：盘点数字员工模块现有资产，并确定 skills / prompt / action 三大件在数字员工中的**使用原理**与接线路径。

---

## 1. 资产清单（现状盘点）

| 资产 | 状态 | 位置 | 说明 |
|---|---|---|---|
| **Agent（角色类）** | ✅ 有（stub） | `mate-kernel/src/mate_kernel/agent/*.py` | 7 类员工类 + copilot + orchestrator，均为 rule-based stub（docstring 注明 M3 接 AIP-GATEWAY-01 后 LLM 替换） |
| **prompt（身份）** | ✅ 有（权威） | `mate-kernel/agent/prompts.py:SYSTEM_PROMPTS` | 7+1 类五段式 prompt，单一数据源（ADR-0028）；`IntentRouter.prompt(role)` 官方取值 |
| **action（落库引擎）** | 🟡 有协议、未接员工 | `mate-kernel/action/engine.py:ActionService` | `ActionType.apply`：submission_criteria 评估 + side_effects outbox + 审计 + FunctionExecutor（GOVERN-05）；**M3/SANDBOX-02 才接真实 runtime** |
| **skills（技能库）** | ❌ 无数字员工专属 | 前端 `MOCK_TOOLS` 仅 mock | 无后端 skill 注册表，无 MCP/Function 工具真实接线 |
| **soul（人格文件）** | ❌ 无 | — | 全仓搜不到 soul/persona 定义；数字员工 = prompt 驱动身份，无独立人格层 |
| **执行层** | 🟡 存在未接通 | `mate-tech-agent/` LangGraph | guard/retrieve/planner/worker/synthesizer/persist 节点 + `get_rag_tool()`；S1-S4 场景图可用，但**未消费 kernel prompt / ActionService** |
| **编排平面** | ✅ 有（骨架） | `mate-kernel/agent/copilot.py:SuperAICopilot` | IntentRouter → AgentInvoker（当前 NullAgentInvoker）→ PlanSpec/PlanStep + HITL token + 审计 |

**结论**：数字员工目前只有 **身份（prompt）+ 角色类（agent stub）**，缺 **技能（skills）+ 动作执行（action 接线）+ 灵魂（soul）**——这就是"数字员工还没真正跑起来"的本质。

---

## 2. 运行时原理：prompt / skills / action 如何被数字员工使用

### 2.1 三层抽象

```
┌─────────────────────────────────────────────────────────────┐
│  ① prompt（身份）——"我是谁，能做什么，边界在哪"              │
│     SYSTEM_PROMPTS[role] → system message                   │
├─────────────────────────────────────────────────────────────┤
│  ② skills（能力）——"我有哪些工具可调"                       │
│     tool registry → LLM tool_calling 注入                   │
├─────────────────────────────────────────────────────────────┤
│  ③ action（落库）——"我怎么把结果写进系统"                   │
│     ActionType.apply（唯一写入入口，HITL+审计）             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 完整数据流（TD-6 后的目标形态）

```
用户 query
   │
   ▼
SuperAICopilot ── IntentRouter.route(query) ──► AgentRole
   │                                              │
   │ ① 取 prompt                                ▼
   ├── SYSTEM_PROMPTS[role] ────────► system message
   │
   │ ② 装配 skills
   ├── employee.capability.tools ──► tool registry
   │        （MCP / Function / Flow 三类工具）
   │
   ▼
AgentInvoker（runtime 在 platform 层实现，当前 Null）
   │
   ├── ③ 执行：LLM 带 system_message + tools 调用
   │        ├─ 只读操作 → ObjectSet / Function 查询
   │        └─ 写操作 ──► ActionType.apply
   │                ├─ submission_criteria 评估
   │                ├─ side_effects → outbox
   │                ├─ HITL token 守门（决策 B3）
   │                └─ 审计留痕（决策 C3 / 硬规则 #9）
   │
   ▼
PlanState + StepResult ──► 用户确认 / 完成
```

### 2.3 三层各自的职责与接线点

| 层 | 职责 | 接线位置（现状 → TD-6） |
|---|---|---|
| **prompt** | 定义员工身份、边界、输出规范 | ✅ 已在 `prompts.py`；DW 已从 kernel 取；TD-6 让 `mate-tech-agent` 也取 |
| **skills** | 声明员工可用工具（MCP/Function/Flow） | ❌ 前端 `MOCK_TOOLS` → TD-6 建**后端 skill 注册表**（`mate_kernel` 或 `mate-tech-agent`），tool_calling 注入 |
| **action** | 唯一的写路径（AI 输出 → 系统） | 🟡 kernel 协议就绪 → TD-6 由 AgentInvoker 把 `StepResult` 接到 `ActionService.apply` |

### 2.4 关键原则

1. **AI 不直连业务表**：数字员工的一切写操作汇聚到 `ActionType.apply`（蓝图三大原理 #3 + 13 硬规则），这是唯一合法写入入口
2. **prompt 是身份、不是逻辑**：skills/action 决定"能干什么"，prompt 决定"用什么身份干"
3. **skills 声明与 action 解耦**：员工只声明"有哪些 skill"（能力清单），具体执行时 skill 内部通过 `Function`/`ActionType.apply` 落库
4. **HITL 全程守门**：每个 plan ≥1 个 HITL 步骤（决策 B3），写动作必须用户 token 确认
5. **审计默认 discard、opt-in 7d**（决策 C3），全链路 OTel + ADS（硬规则 #9）

---

## 3. 缺口清单 + TD-6 补办项

| # | 缺口 | TD-6 补办 |
|---|---|---|
| 1 | 数字员工**无后端 skill 注册表** | 新建 `skill` 实体（name/category/endpoint/input_schema_rid/output_schema_rid），MCP 工具注册 |
| 2 | **action 未接员工执行** | AgentInvoker 接 `ActionService.apply`；StepResult.function_result 回流 |
| 3 | **`mate-tech-agent` 未消费 kernel prompt** | ChatRequest 加员工人格字段 → 取 `SYSTEM_PROMPTS[role]` 注入 system message |
| 4 | **soul/persona 文件缺失** | 评估是否引入独立 persona 层（可选，当前 prompt 已承载身份） |
| 5 | **DW 持久化（in-memory → PG）** | ADR-0029 已定 `(tenant_id, id)` 复合主键；员工/capability/tools 落 PG |
| 6 | **skills 前端解 mock** | `MOCK_TOOLS` → 后端真实 skill 列表；`Employee.capability.tools` 绑定 skill rid |

---

## 4. 参考

- `docs/active/specs/2026-08-06-ontology-kernel-blueprint.md` §4.1（7+1）/ §8（M3 Batch 路线）
- `docs/active/decisions/ADR-0028-digital-employee-prompt-source.md`
- `docs/active/decisions/ADR-0029-dw-employee-tenant-namespacing.md`
- `mate_kernel/agent/prompts.py` / `mate_kernel/action/engine.py` / `mate_kernel/agent/copilot.py`
- `mate-tech-agent/src/mate_tech_agent/graph.py`（执行层）
- `metaplatform-frontend/apps/web/src/api/dw/types/index.ts`（EmployeeCapability 前端形态）
