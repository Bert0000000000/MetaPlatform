# ADR-0066：数字员工 Agent Team —— 统一角色配置面与任务作用域子 agent 编排

> **状态**：**Accepted**（2026-09-16 评审拍板，三轮；决议项与签字位见 §10）
> **日期**：2026-09-16
> **作者**：Claude + 用户协作
> **关联 ADR**：ADR-0021（Kernel 12 基元）、ADR-0028（数字员工 prompt 单一数据源）、ADR-0029（员工租户命名空间）、ADR-0040/0041（沙箱）、ADR-0042（组合内核）、ADR-0043（all-in-one 集成核心）、ADR-0044（assisted action · HITL 唯一写路径）、ADR-0061（Temporal 作为 Workflow 引擎）、ADR-0064（Action 统一 EditSet）、ADR-0065（SuperAI Context-Awareness）
> **关联硬规则**：硬规则 1（Swagger 先行）、硬规则 2（Requirement ID）、硬规则 3（无 tenant 上下文不访问 repository）、硬规则 4（外部系统必须有 ACL Client）、硬规则 7（跳过测试不标 Accepted）、硬规则 9（审计/指标/trace）、硬规则 12（Secret 不进 git）
> **来源**：`docs/active/reports/REPORT-LangChain与AgentNative调研-2026-09-16.md`（开源对位调研）+ 同日 SuperAI/数字员工调度现状差距分析 + 同日 L2 运行时六候选选型调研（§1.4）
> **触发**：确认「SuperAI 是 agent 之一，后续需集成 dsh / Codex / Claude 等客户端」后，发现现有角色定义散落三处、无运行时抽象；进一步明确目标为「可实例化 agent + 可动态加载 + 统一动态调用」

**命名约定**：本文 `D1–D7` 指 §1.2 的**现状差距**；`R1–R10` 指 §10 的**评审决议**；`F1–F9` 指 §10 的**自审发现**。

---

## 1. 背景

### 1.1 目标能力

「agent team 协同 + Agent 编排」拆成四件可分别验证的事：

| # | 能力 | 判据 |
| --- | --- | --- |
| 1 | **编排** | 一个自然语言任务，能被拆成有依赖/并行的任务图并可靠执行 |
| 2 | **协同** | 多个 agent 能互相通信（派活、追问、取结果），而非并行发出后各干各的 |
| 3 | **实例化** | 能创建持久、命名、可列举的 agent（如 "Ontology Agent"），挂角色/技能/工具面 |
| 4 | **动态加载与调用** | 能临场装一个 agent 并立即调用；**实例化来的与临场加载的在调用面完全等价** |

> 目标表述来自用户 2026-09-16：「我可以实例化一些 agent，例如 Ontology Agent；也可以动态加载一些；最终都可以实现动态调用。」对位参考：WorkBuddy（腾讯云数字员工平台）的 Agent Swarm ——「统一框架下发，各自开工，互不干扰」，无硬性并行上限。

### 1.2 现状差距（2026-09-16 实测）

| # | 差距 | 证据 |
| --- | --- | --- |
| **D1** | **无团队通信协议** | 全仓无 `spawn`/`status`/`read-result`/`send`/`list` 任一原语；`dispatch` 是单向 fire-and-forget |
| **D2** | **无子 agent 执行** | 无任何路径用员工自己的 prompt+tools 跑一轮 LLM。A2A 内部 agent 是 **stub echo**（`mate-app-a2a/delegate.py:141-151` 把 message 原样回填标 completed）；dispatcher `worker_kind="http"` **直接抛错**；`local` 是 `deferred` 占位 |
| **D3** | **计划不持久化** | `SuperAIOrchestrator._plans` 是**纯内存 dict**（`mate-kernel/agent/orchestrator.py:98`），orchestrator 的 `repositories/` 无 plan 表，服务重启即丢 |
| **D4** | **无并行组** | `PlanRunner` 支持顺序 + HITL，`scheduling/generate` 的 `parallelGroups` **恒为 `[]`** |
| **D5** | **角色定义散落三处** | ① kernel `SYSTEM_PROMPTS`（8 类身份）② `role_registry.CapabilityBinding`（能力+执行位置耦合）③ `dw_employees`（system_prompt/tools/model）。三者**零代码耦合**（grep `dw_employee` 在 orchestrator 中零命中） |
| **D6** | **无运行时抽象** | 全仓 grep `dsh` / `codex` / `claude_code` **零命中**；编排与 SuperAI 硬耦合 |
| **D7** | **无身份装配概念** | 无「定义 vs 实例」分层；skill 如何进入 agent 上下文未定义；无声明式导入入口；无 profile 权限模型 |

### 1.3 开源对位结论（调研摘要）

| 参考 | 结论 | 依据 |
| --- | --- | --- |
| **langchain**（146K★ / MIT / Python） | ❌ 不引入 | `langgraph` 是 `langchain>=1.0` 硬依赖；与 ADR-0061（Temporal）及 v6 草案（明确弃 LangChain）双向冲突；与本仓 `agent_loop.py` 功能重叠约 80%；不解决 D1–D7 |
| **agent-native**（4.8K★ / 子包 MIT / TS） | ❌ 不引入代码，✅ **借鉴协议** | 平台级框架（自带 db/org/identity/oauth/deploy），引入 = TS 重写全栈；其 Agent Teams 是唯一完整验证过的团队协议 |
| **WorkBuddy**（腾讯云，闭源） | ✅ **借鉴形态** | Agent Swarm「统一框架下发，各自开工」；「子 agent 指令极度简单明确，信息传递不变形」（→ §5.4 上下文裁剪）；并行无硬上限（→ R7） |
| 本仓领先项 | ✅ 保持自研 | 5 层租户隔离、proposal 三闸门、统一执行器（ADR-0064）、`SemanticRouter`、Outbox+OTel —— 参考实现都没有对等物 |

### 1.4 L2 执行运行时选型结论（2026-09-16 六候选调研）

> 用户 2026-09-16 决定「最好引入一个成熟的组件」后，对 L2 执行层做六候选调研。方法：GitHub API 真实数据 → License 读实际文件 → 读核心源码（LICENSE / pyproject / agent 抽象 / 子 agent 原语 / HITL / 流式 / provider / 持久化假设）→ 对 ADR-0066 需求矩阵打分。

| ⭐ Stars | 🍴 Forks | 📅 Last push | License | 候选 | 判定 |
| --- | --- | --- | --- | --- | --- |
| 61,002 | 9,216 | 2026-04-15 | **CC-BY-4.0** ⚠️ | microsoft/autogen | ❌ 内容许可（非软件许可）+ 停更 5 个月 |
| 58,630 | 8,469 | 2026-09-15 | MIT | crewAIInc/crewAI | ❌ HITL 只在自有 Flow 引擎内（=第二套编排）；核心硬拖 Chroma+LanceDB |
| 42,192 | 5,940 | 2026-09-15 | Apache-2.0 | agno-agi/agno | 🟡 备选（见 §9） |
| 41,721 | 7,052 | 2026-09-15 | MIT | langchain-ai/langgraph | ❌ 硬拖 `langchain-core`（=§1.3 已否决的 langchain）；HITL 强制配置 checkpointer（执行模型有状态，须绑定持久化）；Pregel 会**取代** `PlanRunner`（§5.7 映射 + HITL-合一需重写）；**团队原语不在核心**——supervisor/swarm 是独立仓库（各 ~1.6K★，2026-07 后未动） |
| **29,474** | 4,745 | 2026-09-15 | **MIT** | **openai/openai-agents-python** | ✅ **选中** |
| 29,340 | 2,968 | 2026-08-25 | Apache-2.0 | huggingface/smolagents | ⚪ 未评（代码 agent 库，团队/HITL 维度最弱） |
| 21,547 | 4,012 | 2026-09-16 | Apache-2.0 | google/adk-python | ❌ 强制 `session_service` + 自带 workflow 引擎 + 无 Temporal 路径 |
| 19,971 | 2,718 | 2026-09-16 | MIT | pydantic/pydantic-ai | 🟡 备选（见 §9） |

**选中 `openai-agents` 的理由（按 R9 记录）**：它是唯一同时满足「**持久化中立**」与「**不抢团队语义**」的候选——`Session` 是 Protocol、`RunState` 可 JSON 化、无自带引擎；团队语义留给我们自建的 TeamBus。而 agno 虽团队原语最全，却**自己要拥有一套**（Team/TaskList/`/approvals` REST），与 TeamBus 语义重叠。

**一处独立发现（与选型无关，但需修）**：本仓 `mate-app-a2a/pyproject.toml:12` 声明 `a2a-sdk>=0.1.0`，实际运行 **1.1.2**，**声明地板与实际相差一个多版本且无上界**。建议收紧到 `~=1.1.2`（可复现性，独立于本 ADR）。

**Codex 作为未来 runtime 的可行性已预验**：`openai/codex` 的 `docs/` 提供 `AGENTS.md`（角色下放）、`.codex/skills/` + `docs/skills.md`（skill 下放）、`docs/config.md`（工具面下放）、`docs/exec.md` → **非交互模式**（可被 spawn 的前提）。故 §5.8 预留的 `RuntimeKind.CODEX` 有真实挂载面（具体参数留 S6 验证）。

---

## 2. 决策

**引入「Team Definition Plane」身份装配面 +「Team Lead / Team Member / Team Bus」三层，把 SuperAI 降为可替换的运行时之一。L2 执行层引入成熟组件 `openai-agents`；其余三层、身份装配面与五动作协议全部自研，落在既有 Python 服务 + 既有 PG。不引入第二套编排控制面——Temporal（ADR-0061）保持唯一。**

| 维度 | 决策 |
| --- | --- |
| **角色实体** | 新增 `AgentProfile` 统一实体，**与 `dw_employees` 合并为一张表**（用户 2026-09-16 拍板）。现有 `DwEmployeeORM` 已是 AgentProfile 的 ~80%，合并以**加列**为主 |
| **角色 × 运行时** | **正交两轴**。`baseRole: AgentRole`（8 枚举之一，决定 kernel 语义与默认 prompt）+ `runtimes: [RuntimeKind]`（执行位置）。**`AgentRole` 枚举不扩**，市场第三方角色 = 一个 profile |
| **首个 runtime** | **`superai`（原生）**。`RuntimeKind` 抽象与 Projection Adapter 契约本 ADR 定义，但**只实现 superai adapter**；`dsh` / `codex` / `claude_code` 为后续增量（用户 2026-09-16 拍板：异构后置） |
| **定义 / 实例分层**（R8） | **定义层** `AgentProfile`（蓝图）与**实例层** `team_task`（一次运行）是两层。「实例化」与「动态加载」都只是**产生定义的方式**；「动态调用」只看实例 |
| **统一调用面**（R8） | `spawn` 接受 `profileId` **或** `inlineProfile`，两条路产出**同一种实例**，五动作对二者一视同仁 |
| **身份 / 权限双层**（R4） | `Role Identity`（prompt + skill 引用，低风险）+ `Authority Envelope`（工具面/数据面/Action 面，高风险），两轴分离 |
| **能力衰减不变量**（R4） | **子 agent 权限包络 ⊆ 父 agent 包络**，衰减链的**根 = 发起用户**（SuperAI 不是超级用户） |
| **审批档位**（R5） | **不扩权即免审，扩权才审**。提权授权**只限本次任务 / 该 profile**，不做 blanket grant |
| **skill 挂载**（R6） | profile 挂 skill；投影只出**清单**（name + description），子 agent 用 `read_skill` **按需拉全文** |
| **子 agent** | **任务作用域**：`(profile_projection, tool_scope, context_digest, thread_id, runtime_kind)` + `parent_task_id`。**不新建注册表实体**——动态性发生在任务层，不在角色层 |
| **团队协议** | **五动作** `spawn` / `status` / `read-result` / `send` / `list`（对标 agent-native）；闸门 `max_depth`（默认 2）+ **并发无硬上限**（R7，靠 llmgw 背压） |
| **L2 执行运行时**（R9） | **引入 `openai/agents`（MIT）** 作子 agent 执行引擎（§1.4）。`ProjectionAdapter` 产出其 `Agent` 构造参数（instructions / tools）+ `ModelProvider` 指向自研 llmgw。**框架留在 adapter 之后** |
| **编排引擎** | **复用本仓 `PlanRunner`**，不引 langgraph。`TeamLead` 接口化，首个实现 `SuperAITeamLead`（其下由 `openai-agents` 执行） |
| **框架隔离纪律**（R10） | 五动作与 `team_task` schema 必须 **runtime 中立**——`openai-agents` 的 `as_tool` / `handoff` / `RunState` / `Session` 是**实现手段、不是接口**；其类型**不得出现在 TeamBus 公开契约中** |
| **状态持久化** | 计划与任务**落 PG**（`orchestrator_plan` / `team_task`），修掉 D3 内存 dict |
| **HITL** | 保留 B3 不变量（PlanSpec ≥1 HITL 步骤）；PROPOSE/APPLY_ACTION 步计入 |
| **与 Temporal 的关系** | Team Bus 管**秒–分钟级同步协同**；Temporal 管**小时–周级可靠编排**（ADR-0061）。二者互补，S1 不依赖 Sprint 1A |
| **子 agent 规划权**（R3） | 默认**不含 `spawn` 工具**（子 agent 只执行不规划）；需再委派时由 `maxDepth` 显式放开 |
| **工具收敛**（F4） | `dispatch_employee` ≡ `spawn` 的**单员工语法糖**，**底层同一实现**，不维护两套 |

### 2.1 关键子决策（10 条）

1. **不自动执行子 agent 之间的导航/跳转**——保持「AI 输出 = proposal」本仓哲学（同 ADR-0065 §2.1）。
2. **不引入 agent-native 的 `application_state` 通用 KV 表**——本仓用**专用表**（`team_task` / `orchestrator_plan`），保持 schema 可治理、可索引、可审计，不用自由 JSON 兜底。
3. **不重复造 langchain middleware，也不引入它**——R9 引入 `openai-agents` 后，**工具循环 / 重试 / 流式事件分类 / tool 审批**由框架提供；本仓只保留三件**领域相关**护栏：证据限流、上下文裁剪、租户包装（`agent_loop.py` 单体里的对应逻辑随之退役）。
4. **HITL 只允许出现在并行组边界**（R1）——组内节点标 `hitl=True` 在**计划校验期直接拒绝**。理由：组内挂起会产生「部分并行已完成但整组未推进」的中间态，现有 `PlanRunner` 状态机表达不了；边界 HITL 覆盖真实场景（先并行干活，再人工裁决汇总）。
5. **`send` 走队列、在迭代边界投递**（R2）——对齐 agent-native「排队，在安全续跑点应用」。已终态任务 `send` 返回 409，**不隐式起新轮**（否则一次 spawn 变隐式多轮，与 `depth` 语义打架）。
6. **并发不设硬上限**（R7）——对齐 WorkBuddy Agent Swarm；改由 llmgw 既有冷却/限流信号做**自然背压**（超限排队而非失败），不新建配额体系。
7. **不照抄 agent-native 的文件式 profile**（R8）——它是文件系统且无租户概念；本仓采用**声明式格式 + DB 存储**：导入时像贴一份 YAML 一样轻，存储时是带 `tenant_id` 的行（硬规则 #3）。
8. **上下文也要裁剪，不只是工具面**——下发给子 agent 的是 `instruction` + 裁剪过的上下文摘要（`context_digest`），**不是主 agent 的全上下文**。对齐 WorkBuddy「指令极度简单明确，信息传递不变形」。
9. **框架必须待在 adapter 之后，TeamBus 语义 runtime 中立**（R10）——这是引入 `openai-agents` 后用不翻车的前提。若五动作的语义长得像某个框架的概念，将来 `RuntimeKind.CODEX` / `DSH` 的子 agent 在 TeamBus 看来就会**行为不一致**（Codex 没有 `RunState`）。
10. **自觉接受 `openai>=3.0` 硬依赖**（R9）——功能上无害（llmgw 本就是 OpenAI 兼容协议，`OpenAIProvider(base_url=…)` 直指它），但这是「引入厂商包」的**明确决定**，不是可忽略的细节；记录在此以便将来复审。

---

## 3. 身份装配面（Identity Plane）

### 3.1 定义层 vs 实例层

```
定义层（AgentProfile）                实例层（team_task）
──────────────────────────            ─────────────────────
① 实例化 → 持久 profile（命名）   ┐
                                   ├─→ 同一个 spawn ─→ 每次一个**实例**
② 动态加载 → 临时 profile         ┘

③ 动态调用 = 调用只看**实例**，不看定义从哪来
```

「实例化」与「动态加载」**不是两种 agent，是产生定义的两种方式**。这解释了为什么"最终都可以动态调用"——调用面只认实例。

### 3.2 身份来源三档

| 档 | 来源 | 产生方式 | 生命周期 | 审批 |
| --- | --- | --- | --- | --- |
| ① | **既有 profile**（含 7 内置 + 实例化新建） | 引用 `profileId` | 持久 | 免审（不扩权） |
| ② | **DW 员工记录** | 引用 `profileId`（合并后即 ①） | 持久 | 免审（不扩权） |
| ③ | **临场装配** | `inlineProfile`（LLM 或调用方现场给定） | **任务作用域**，用完即弃 | **不扩权免审 / 扩权才审**（R5） |

### 3.3 身份 / 权限双层（R4）

把「角色身份」拆成两个正交维度——**它们动态度与风险完全不同**：

| 维度 | 内容 | 风险 | 默认审批 |
| --- | --- | --- | --- |
| **Role Identity** | 它是谁 / 什么口吻 / 什么职责 → **prompt** + skill 引用 | 低（**不扩权**） | 免审 |
| **Authority Envelope** | 能碰什么 → `(tools, action_rids, kb_ids, markings)` | 高（读谁的数据、写什么） | **扩张才审** |

**不变量（能力衰减）**：

```
用户权限包络  ⊇  Team Lead 包络  ⊇  子 agent 包络  ⊇  子子 agent 包络
```

链的**根是发起用户**，不是父 agent——**SuperAI 只是代用户行事，不是超级用户**。

**可判定性**：包络是四类集合的并，子集检查就是集合运算；本仓已有 markings 合取检查的底子（`ontology_tools.py`），不是从零造。

### 3.4 审批档位（R5）

| 场景 | 处置 |
| --- | --- |
| 临场装一个「订单分析师」（新 prompt + **用户已授权**的工具/数据子集） | **直接 spawn**，不打断 |
| 需要**用户不具备**的能力（如调一个未授权的 A2A） | 触发 proposal（ADR-0044 通道），**授权范围只限本次任务 / 该 profile** |

即把本仓「AI 输出 = proposal」精确化为「**扩权才 proposal**」。

### 3.5 skill 挂载：profile 挂 + 按需读（R6）

| 层 | 产物 |
| --- | --- |
| 投影（system prompt） | **清单**：`- sk-xxx（name）：description`（**不含全文**） |
| 运行时 | 子 agent 用 **`read_skill(skillId)`** 按需拉全文 |
| 清单外发现 | **`search_skill`** 兜底 |

**复用既有资产**：`bootstrap.py` 里 `app` role 已绑 `search_skill` / `read_skill` 两个 MCP 工具（`CapabilityBinding(name="read_skill", worker_kind="mcp", ref="read_skill")`），推广到所有挂 skill 的 profile 即可，**零新增机制**。且 prompt 不被撑爆。

### 3.6 声明式导入（实例化的轻入口）

`POST /api/v1/dw/profiles/import` —— 贴一份 YAML/Markdown 即得一个 AgentProfile：

```yaml
name: Ontology Agent
baseRole: ontology            # kernel 8 枚举之一
systemPrompt: |               # 省略则取 SYSTEM_PROMPTS[baseRole]
  你是本租户的本体管理员……
skills:    [sk-obj-modeling, sk-query-tuning]
tools:     [ont_list_classes, ont_inspect_class, ont_object_query]
knowledge: [kb-ont-docs]
authority:                    # 权限包络；必须是导入者包络的子集
  actions: [ont.create_link]
runtimes:  [superai]
```

**格式声明式、存储 DB 化**——理由见 §2.1-7。

### 3.7 profile 的权限模型

| 项 | 规则 |
| --- | --- |
| 谁能定义 | 需 `agent_admin` actor role |
| 不得提权 | 导入 / 装配产出的权限包络**必须 ⊆ 创建者包络**，否则 403 |
| 谁能被调度 | 既有 `allowed_actor_roles`（谁能 spawn 这个 profile） |
| 审计 | 每次创建 / 导入 / 装配写审计行（硬规则 #9） |

---

## 4. 数据模型

### 4.1 `dw_employees` 扩展（合并 AgentProfile）

现有 `DwEmployeeORM` 已有 `id / tenant_id / name / code / role / status / model_id / kb_ids / is_builtin / system_prompt / tools / action_rids / temperature / max_tokens / top_p / retrieval_method / top_k / rerank`。**合并以加列为主**：

| 新列 | 类型 | 语义 |
| --- | --- | --- |
| `skills` | TEXT（换行分隔，同 `tools` 约定） | 绑定的 skillhub skill id 列表（R6） |
| `runtimes` | TEXT（换行分隔） | 允许的运行时，默认 `superai` |
| `allowed_actor_roles` | TEXT（换行分隔） | 允许调度该 profile 的 actor role |
| `authority_actions` | TEXT（换行分隔） | 权限包络：Action rid 白名单（§3.3） |
| `authority_markings` | TEXT（换行分隔） | 权限包络：数据 marking 集合 |
| `origin` | TEXT | `builtin` / `instantiated` / `imported` / `inline`（§3.2 三档 + 内置） |

**语义映射**：`id` ≙ `profileId`；`role` ≙ `baseRole`（列名保留，避免破坏既有 API 与前端）；`tools` / `kb_ids` 即包络的另两维。`is_builtin=True` 的 7 行即 7 个内置 profile（已与 kernel `AgentRole` 对齐，见 ADR-0028 §3.2）。

### 4.2 新增表

| 表 | 关键列 | 用途 |
| --- | --- | --- |
| `orchestrator_plan` | `plan_id` PK / `tenant_id` / `status` / `current_step_idx` / `steps`(JSON) / `history`(JSON) / `created_at` / `updated_at` | 修 D3：计划持久化，跨重启存活 |
| `team_task` | `task_id` PK / `tenant_id` / `parent_task_id` / `root_task_id` / `depth` / `profile_id` / **`inline_profile`(JSON)** / `runtime_kind` / `thread_id` / `status` / `input`(JSON) / **`context_digest`(JSON)** / `result`(JSON) / `inbox`(JSON) / `error` / `created_at` / `updated_at` | 子 agent **实例** + 五动作状态源；`inline_profile` 存临场定义（§3.2 档③）；`depth` 支撑深度闸门；`root_task_id` 支撑 `list`；`inbox` 支撑 `send`（§5.5）；`context_digest` 支撑上下文裁剪（§5.4） |
| `profile_projection` | `id` PK / `tenant_id` / `profile_id` / `runtime_kind` / `bundle_digest` / `applied_at` / `applied_by` | 下放审计与回滚依据。**S0 起每次下放即写审计行**（即使 `runtime_kind` 只有 `superai`），不留空表（F8） |

**约定**：所有三表均带 `tenant_id` 且访问必经 `require_tenant`（硬规则 #3）。

---

## 5. 协议设计

### 5.1 TeamBus REST（`/api/v1/orchestrator/team`）

| 动作 | 端点 | 语义 |
| --- | --- | --- |
| `spawn` | `POST /team/spawn` | 起子 agent 任务 → `{taskId, threadId, status}` |
| `status` | `GET /team/tasks/{taskId}` | 查运行中任务进度 |
| `read-result` | `GET /team/tasks/{taskId}/result` | 取已完成任务产出 |
| `send` | `POST /team/tasks/{taskId}/messages` | 给运行中子 agent 发消息 |
| `list` | `GET /team/tasks?rootTaskId=&parentTaskId=` | 列当前用户的子任务 |

### 5.2 统一调用面（R8）

```jsonc
POST /team/spawn
{
  // ── 定义：二选一 ──
  "profileId": "EMP-ONT-001",        // ① 实例化来的（持久）
  // "inlineProfile": {               // ② 动态加载的（任务作用域）
  //   "baseRole": "ontology",
  //   "systemPrompt": "你是……",
  //   "skills": ["sk-obj-modeling"]
  // },

  "runtimeKind": "superai",          // 本 ADR 枚举里只有 superai 有实现
  "instruction": "核对这份对账单的差异项",
  "toolScope": ["ont_object_query"], // 省略 = 取 profile 的 tools；**只能收窄，不能扩**
  "parentTaskId": "task-abc",        // 顶层 spawn 可省
  "maxDepth": 2
}
```

**两条路产出同一种实例**——`status` / `read-result` / `send` / `list` 对它们一视同仁。这正是"最终都可以动态调用"的实现。

### 5.3 五动作对模型暴露为 FC 工具

`spawn` / `status` / `read-result` / `send` / `list` 同时注册为 copilot agent loop 的工具（与既有 `dispatch_employee` 并列），使主 agent 可在对话中自主组建并使用团队。`dispatch_employee` **保留**（单员工快路径），`spawn` 为团队路径。**二者是同一实现的两种语法**（F4）——`dispatch_employee(profileId, message)` ≡ `spawn(profileId, instruction, parentTaskId=null)`，路由到**同一 TeamBus 服务层**，不维护两套并行实现（避免 LLM 面前出现两个语义重叠的工具，即 `SemanticRouter` 那批要解决的 prompt dilution）。

### 5.4 上下文裁剪

下发给子 agent 的**不是主 agent 的全上下文**，而是：

```
instruction（该子任务做什么）
  + context_digest（从父上下文裁剪出的必要片段，如相关对象 rid / 上游步骤产出）
  + profile 投影（prompt + skill 清单 + 工具面）
```

理由：对齐 WorkBuddy「每个 Agent 的指令极度简单明确，信息传递不变形」；同时避免多子 agent 时上下文爆炸与串味。

### 5.5 `send` 投递语义（R2）

- `send` 写入目标 `team_task` 的 **inbox**（`team_task.inbox` JSON 列）
- 子 agent 在**下一轮迭代边界**消费 inbox（runtime 中立表述：一次 LLM 决策循环的边界；`superai` 下即 `openai-agents` 的 run turn 边界）；消费即清空
- 任务已终态 → `409 Conflict`（`E_TASK_TERMINAL`），**不隐式起新轮**
- 子 agent 回问父级：写父任务 inbox，**同一机制反向**

### 5.6 并发与背压（R7）

- **不设硬性并发上限**（对齐 WorkBuddy Agent Swarm）
- 超限由 **llmgw 既有冷却 / 限流信号**做自然背压：`spawn` **排队**而非失败
- 复用既有 `AGENT_TOOLS_BUDGET` 同类护栏思路，**不新建配额体系**

### 5.7 TeamPlan（任务图）

```jsonc
{
  "goal": "…",
  "nodes": [
    {"nodeId": "n1", "profileId": "EMP-ONT-001", "runtimeKind": "superai",
     "instruction": "…", "dependsOn": [], "hitl": false},
    {"nodeId": "n2", "profileId": "EMP-DATA-001", "dependsOn": ["n1"], "hitl": false}
  ],
  "parallelGroups": [["n2", "n3"]],
  "hitlNodes": ["n4"]
}
```

映射到既有 `PlanSpec`：node → `PlanStep(kind=CALL_AGENT, target=profileId)`；`parallelGroups` 为 `PlanRunner` **新增能力**（修 D4）；`hitlNodes` 满足 B3 硬校验。

**并行组 × HITL 约束（R1）**：`hitlNodes` 只允许落在并行组**边界**（组前 / 组后）；组内节点标 `hitl=True` 在**计划校验期直接拒绝**（`PlanValidationError`）。

### 5.8 RuntimeKind 与 Projection Adapter

```python
class RuntimeKind(StrEnum):
    SUPERAI = "superai"        # 本 ADR 唯一实现
    # 后续增量：DSH / CODEX / CLAUDE_CODE / EXTERNAL_A2A

class ProjectionAdapter(Protocol):
    def render(self, profile: AgentProfile, *, tool_scope: Sequence[str]) -> RuntimeBundle: ...
```

**`superai` 的投影**（R9 后）= 供 `openai-agents` 构造 `Agent` 的参数：`instructions`（profile 覆盖值，缺省取 `SYSTEM_PROMPTS[baseRole]`）+ skill 清单（§3.5）+ `tools`（由 `tool_scope` 裁剪）+ `ModelProvider`（`OpenAIProvider(base_url=<llmgw>)`）。`agent_loop.py` 退为**迁移基线**，不再是 S1 的复用点。

**框架隔离纪律（R10）**：`RuntimeBundle` 是**本仓类型**，其字段是本仓概念（instructions / tools / provider endpoint），**不暴露 `openai-agents` 的类型**。`openai-agents` 只允许出现在 `ProjectionAdapter` 的 `superai` 实现内部与执行调用点。将来新增 `codex` / `dsh` adapter 时，`RuntimeBundle` 契约不变。

**安全约束（下放）**：

- bundle 只带**引用**（`skillId` / `toolName` / `kbId`），**绝不内联密钥**（硬规则 #12）
- 下放动作写 `profile_projection` 审计行；写入外部客户端工作区属副作用，需可回滚
- 每次下放走租户守门（硬规则 #3）

**子 agent 工具面（R3）**：spawn 出的子 agent **默认不含 `spawn` / `dispatch_employee`**——只执行不规划。需多层委派时，由父级在 `spawn` 请求里显式提高 `maxDepth`，Projection 相应追加 spawn 工具。

---

## 6. 实施切片

| 切片 | 内容 | 依赖 | 估时 |
| --- | --- | --- | --- |
| **S0** | **`AgentProfile` 合并**：`dw_employees` 加 `skills`/`runtimes`/`allowed_actor_roles`/`authority_*`/`origin`；`RuntimeKind` 枚举 + `ProjectionAdapter` 协议（只实现 superai）；orchestrator 从 DW 读 profile 取代 `role_registry` 直读。**前置：新增 `mate-clients/dw/DwEmployeeClient`**（F1，见下方前置项） | 无 | 1.5 周 |
| **S1** | **TeamBus 最小闭环**：`spawn`/`status`/`read-result` + `team_task` 落库 + 深度闸门 + `POST /team/sweep`（F6）；子 agent 执行**在 `openai-agents` 之上实现**（`RuntimeBundle` → `Agent(instructions/tools)` + `ModelProvider` 指向 llmgw）；**自建项仅两件：深度闸门 + 租户上下文包装**（R9） | S0 | 1.5 周 |
| **S2** | **TeamLead Planner**：`TeamLead` 接口 + `SuperAITeamLead`；LLM 任务图 + `parallelGroups` + `orchestrator_plan` 落库 | S1 | 1.5 周 |
| **S3** | **双向消息 + chip UI**：`send` + 子 agent 回问；前端 chip 内联预览（可展开） | S1 | 1 周 |
| **S4** | **身份装配面**：`inlineProfile`（档③）+ 权限包络衰减检查（§3.3/R4）+ 审批档位（§3.4/R5）+ `POST /profiles/import`（§3.6） | S1 | 1.5 周 |
| **S5** | **skill 按需读**：profile.skills → 投影清单 + `read_skill` 工具推广到全 profile（§3.5/R6） | S0 | 0.5 周 |
| **S6**（deferred） | **首个异构 runtime**：实现 `claude_code` 或 `codex` 的 `ProjectionAdapter`，端到端验证「配置 → 下放 → 客户端执行 → 结果回 Team Bus」 | S2/S3 | 另立 |

**S1 是关键路径**——它同时解掉 D1 + D2。S0 是异构前提，且本身在修 D5。

**提交顺序（强约束）**：`ADR → OpenAPI contract（硬规则 #1）→ failing tests → feature → infrastructure → deploy → acceptance evidence`。

契约落点：`mate-platform-backend/contracts/`（F9）。

**S0 前置项（F1，硬规则 #4）**：`mate-clients/` 下**没有 DW client**（现有仅 `a2a/ mcp/ ragflow/ lightrag/ minio/ redis/ kafka/ marketplace/ ...`），而 `scripts/ci/forbid_bare_httpx.py` 禁止 app-* / mate-platform / **mate-clients** 业务代码出现裸 `httpx.AsyncClient(`。S0 必须**先新增 `mate-clients/dw/DwEmployeeClient`**（BearerAuth + `OutgoingAuthMiddleware` + 租户透传），否则第一步即被 pre-commit 拦截。copilot 现有的 `list_dw_employees`（`mate_app_copilot/clients/base.py:282`）是**服务本地实现**，不复用、不迁移。

---

## 7. 验收标准

1. **端到端**：一句 NL → `SuperAITeamLead` 出任务图 → **并行 spawn ≥2 个子 agent**（各自 profile 身份/工具面）→ **真实执行**（非 echo 回填）→ 汇总
2. **协同**：主 agent 可 `read-result` 取产出；可 `send` 追问；`list` 可见全部子任务
3. **持久化**：orchestrator 重启后，计划与任务仍可查（`orchestrator_plan` / `team_task`）
4. **闸门负例**：深度超 `maxDepth` 的 spawn 被拒
5. **HITL 不变量**：TeamPlan 仍满足 B3（≥1 HITL 步骤），且可审
6. **跨租户 negative**：A 租户不能 spawn/读取 B 租户的 profile 或 team_task
7. **无密钥泄露**：`profile_projection` bundle 与下放产物不含任何密钥（gitleaks + 单测断言）
8. **审计**：每次 spawn / 下放 / 装配 / 导入有 OTel 事件 + 审计行（硬规则 #9）
9. **零回归**：既有 pytest 套件（kernel + ont + copilot + orchestrator）全绿
10. **协议稳定**：换 `TeamLead` 实现时，`TeamPlan` / TeamBus 协议与前端零改动（S6 验证）
11. **并行组 HITL 边界（R1）**：并行组**内**节点标 `hitl=True` → 计划校验期抛 `PlanValidationError`（negative）
12. **`send` 语义（R2）**：运行中任务 `send` → 下一轮迭代边界生效；**终态任务 `send` → 409 `E_TASK_TERMINAL`**；不隐式起新轮
13. **子 agent 无规划权（R3）**：spawn 出的子 agent 工具面**不含** `spawn`/`dispatch_employee`（断言其 FC 工具清单）
14. **统一调用面（R8）**：同一个「订单分析」任务，分别用 `profileId`（实例化）与 `inlineProfile`（动态加载）spawn → **`read-result` 返回结构一致**，五动作行为无差异
15. **能力衰减（R4）**：spawn 一个 `toolScope` 含**父级/用户不具备**能力的子 agent → **403**（negative）；只收窄 → 放行
16. **审批档位（R5）**：不扩权的临场装配**不产生 proposal**；扩权的临场装配产生 proposal 且**授权只作用于该 task**
17. **skill 按需读（R6）**：投影的 system prompt **含 skill 清单但不含全文**；子 agent 调用 `read_skill` 后才拿到正文
18. **import 幂等与守门（§3.6）**：同一 YAML 重复导入结果一致；导入 `authority` 超出导入者包络 → **403**
19. **框架隔离（R10）**：TeamBus 公开契约（OpenAPI）与 `team_task` schema 中**不出现任何 `openai-agents` 类型**；`openai` 包只被 `superai` adapter 引用（CI 断言 import 边界）
20. **`RuntimeBundle` 契约稳定（R10）**：新增一个测试用假 adapter（`fake_runtime`）→ 五动作行为与 `superai` 一致，**不改任何 TeamBus 契约**。这是 S6 接 Codex/dsh 不返工的前置证明

---

## 8. 影响

**正向**
- 修掉 D1–D7 全部七条差距，其中 D3/D5/D7 是既有缺陷
- 角色定义从三处收敛为一张表，ADR-0028 的「单一数据源」原则从 prompt 扩展到完整 profile
- 「实例化 / 动态加载 / 统一调用」三种体验共用一层机制，**M+N 演进不必改协议**（对上蓝图「7 + N」）
- `RuntimeKind` 抽象就位后，接入 dsh / Codex / Claude Code 是**加 adapter**，不动协议与前端
- 复用既有资产：`PlanRunner`（数据流 + HITL 合一）、**`openai-agents`**（L2 执行，R9）、`SkillHub`（skill content 即 SKILL.md）、MCP 中心（工具面 + `read_skill`）、proposal 通道（扩权人审）
- L2 引入成熟组件后，S1 自建项收敛为**两件**（深度闸门 + 租户包装），其余（FC 循环 / 流式事件 / provider 抽象 / tool 审批 / handoff）由框架提供

**负向 / 风险**
- `dw_employees` 加列与 orchestrator 改读 DW，触及两个服务的既有契约，需契约先行
- 「并发无硬上限」把压力全推给 llmgw —— 需实测其背压在大扇出下是否够；不够时需回到可配上限（R7 回退路径见 §9 备选）
- 权限包络的**子集检查若实现有漏洞即为提权漏洞** —— 必须有专门 negative 用例矩阵（验收 #15/#18），并复用既有 markings 检查而非另起一套
- 「任务作用域子 agent」若被滥用会产生大量短命 task 行 —— **已收口（F6）**：加 `POST /team/sweep`，TTL 语义对齐既有 `SessionEvolution.sweep_expired` + `POST /sessions/sweep`
- **引入 `openai>=3.0` 厂商包**（R9）—— 功能上无害（llmgw 是 OpenAI 兼容协议），但属**治理决定**；若将来复审不通过，回退路径见 §9 备选
- **框架语义渗漏**（R10）—— 若实现时图省事把 `as_tool` / `RunState` 当接口用，TeamBus 会被 `openai-agents` 塑形，将来接 Codex/dsh 必然返工。由验收 #19/#20 守门

---

## 9. 备选方案

| 方案 | 结论 |
| --- | --- |
| **A. 引入 langchain 作运行时** | ❌ 硬拖 langgraph，与 ADR-0061 及 v6 草案双向冲突；且只解决执行层，不解决 D1/D4/D5 |
| **B. 引入 agent-native 作平台** | ❌ 平台级替换（TS 全栈重写），栈冲突；License 仓库级未声明 |
| **C. 保持「动态创建新 `AgentRole`」** | ❌ 撞 PRD-01 `FR-EMP-EVOLVE-004`（枚举不变）硬约束。本方案改为任务作用域 spawn 后该约束自然满足 |
| **D. 复用 A2A 协议做团队协同（不加新协议）** | ❌ 本轮放弃。A2A 是**跨系统**互操作协议（agent card + message envelope），不提供 task 父子关系、深度闸门、任务作用域身份；把团队协同塞进 A2A 会把「内部协同」与「跨域互操作」两个关注点耦合。**保留 A2A 作为 `runtime_kind=external_a2a` 的一种 runtime** |
| **E. 临场装配一律人审** | ❌ 已否（R5）。每次动态装身份都要点确认，"动态加载"名存实亡 |
| **F. 并发设可配硬上限（初版方案）** | 🟡 已改为无硬上限（R7）；若 llmgw 背压实测不够，回退到「默认 4 + 按租户可调」 |
| **G. langgraph 作 L2 运行时** | ❌ 已评（§1.4）。HITL `interrupt()` **强制**开 checkpointer → 反过来强加持久化栈；Pregel 引擎与 Temporal 争控制面 |
| **H. crewAI / google-adk 作 L2 运行时** | ❌ 已评。两者都**自带第二套编排控制面**（crewAI 的 Flow 引擎、adk 的 `Runner`+workflow 引擎），撞 ADR-0061；adk 还强制 `session_service` |
| **I. agno / pydantic-ai 作 L2 运行时** | 🟡 已评，保留为 **R9 的回退备选**。agno：团队原语最全（`Team.members` callable）但**自己要拥有一套团队语义**，与 TeamBus 重叠；pydantic-ai：Temporal 一等可插拔后端但**无子 agent 原语**，S1 工作量最大 |
| **J. 继续自研 `agent_loop.py` 作 L2** | 🟡 保留为**最终回退**（零新依赖、无厂商包）。放弃的是框架提供的 provider 抽象 / tool 审批 / handoff / 流式事件分类 |

---

## 10. 评审记录（2026-09-16，三轮）

> 评审方式：作者对抗性自审（把本稿当第三方评审）→ 决议项拍板。对齐 ADR-0064「评审拍板 → 切片收口」路径。
> 决策人：MatePlatform 用户（2026-09-16）；纸质签字位 `__/__________`

### 10.1 第一轮决议

| # | 议题 | 结论 |
| --- | --- | --- |
| **R1** | 并行组 × HITL 语义 | ✅ HITL 只允许落在并行组**边界**；组内 `hitl=True` 在计划校验期拒绝（§5.7） |
| **R2** | `send` 投递语义 | ✅ 写 inbox，子 agent 在**下一轮迭代边界**消费；已终态返回 409，不隐式起新轮（§5.5） |
| **R3** | 子 agent 规划权 | ✅ 默认**不含 spawn 工具**（只执行不规划）；需再委派由 `maxDepth` 显式放开（§5.8） |

### 10.2 第二轮决议（身份装配面）

| # | 议题 | 结论 |
| --- | --- | --- |
| **R4** | 身份 / 权限是否拆分 | ✅ **拆**。Role Identity 与 Authority Envelope 两轴分离；不变量「子 ⊆ 父」，链根 = 发起用户（§3.3）。拍板语：「要动态」 |
| **R5** | 临场装配审批档位 | ✅ **不扩权即免审，扩权才审**；提权授权只限本次任务（§3.4） |
| **R6** | skill 怎么进 agent | ✅ **profile 挂 skill，子 agent 按需读**（投影出清单，`read_skill` 拉全文）（§3.5） |
| **R7** | 并发上限 | ✅ **不设硬上限**，靠 llmgw 背压（对齐 WorkBuddy Agent Swarm）（§5.6） |
| **R8** | 定义/实例分层 + 统一调用面 + 不照抄文件式 profile | ✅ 定义层 `AgentProfile` / 实例层 `team_task`；`spawn` 接受 `profileId` 或 `inlineProfile`，产出同种实例；采**声明式格式 + DB 存储**（§3.1 / §5.2 / §2.1-7） |

### 10.3 第三轮决议（L2 运行时技术选型）

| # | 议题 | 结论 |
| --- | --- | --- |
| **R9** | L2 执行运行时是否引入成熟组件 | ✅ **引入 `openai/agents`（MIT）**。六候选调研（§1.4）后选中，理由：**持久化中立**（`Session` 是 Protocol、`RunState` 可 JSON 化、无自带引擎）**且不抢团队语义**（团队语义留给自建 TeamBus）。代价：接受 `openai>=3.0` 硬依赖（§2.1-10） |
| **R10** | 引入框架后的隔离纪律 | ✅ **框架必须待在 adapter 之后，TeamBus 语义 runtime 中立**。`as_tool`/`handoff`/`RunState`/`Session` 是实现手段不是接口；其类型不得出现在 TeamBus 公开契约中（§2.1-9 / §5.8），由验收 #19/#20 守门 |

**规划意图（R9 拍板语境）**：用户目标是「引擎现在 + 多 runtime 将来」的**叠加**路线——`openai-agents` 作 L2 内部引擎，将来经 `RuntimeKind` 接 **Codex harness**（挂载面已预验：`AGENTS.md` / `.codex/skills/` / `config.md` / `exec.md` 非交互模式，见 §1.4）与 **dsh**。两条路交汇于自建 TeamBus，**不经过 `openai-agents`**，故选型不锁死后路。

**备选（回退顺序）**：agno → pydantic-ai → 自研 `agent_loop.py`（§9 G–J）。

### 10.4 自审发现与处置

| # | 发现 | 级别 | 处置 |
| --- | --- | --- | --- |
| **F1** | `mate-clients` 无 DW client，S0 会被硬规则 #4 拦 | 🔴 阻断 | 补入 S0 前置项（§6） |
| **F4** | `dispatch_employee` 与 `spawn` 双路径语义重叠 | 🟡 重要 | 定义为同一实现的两种语法（§5.3） |
| **F5** | 并发 × LLM 配额联动未定义 | 🟡 重要 | §5.6（经 R7 改为背压） |
| **F6** | `team_task` TTL 无 owner | 🟡 重要 | `POST /team/sweep`（§6 S1 / §8） |
| **F7** | 子 agent 规划权未定义（= R3） | 🟡 重要 | §5.8 |
| **F8** | `profile_projection` 建空表 | 🟢 轻微 | S0 起即落审计行（§4.2） |
| **F9** | Requirement ID → 契约映射缺失 | 🟢 轻微 | 指向 `mate-platform-backend/contracts/`（§6） |

### 10.5 评审要求（进入实现前必达）

1. **FR-TEAM-001..0NN 每条有对应失败用例**（硬规则 #7：跳过不标记 Accepted）
2. **OpenAPI contract 先行**（硬规则 #1）
3. **跨租户 negative ≥ 6 条**（§7 第 6 项）
4. **无密钥泄露断言 + gitleaks**（§7 第 7 项）
5. **权限包络子集检查的 negative 矩阵**（§7 第 15/18 项）——这是本 ADR 唯一的安全关键路径
6. S0 首个 commit 必须是 `mate-clients/dw/DwEmployeeClient`（F1 前置）
7. **框架 import 边界断言**（§7 第 19 项）——`openai` 包只被 `superai` adapter 引用，TeamBus 契约零框架类型（R10）

---

## 11. 参考

- `docs/active/reports/REPORT-LangChain与AgentNative调研-2026-09-16.md`（本轮开源对位调研，含真实 API 数据与 License 审计）
- `docs/active/specs/2026-07-27-mate-platform-architecture-implementation.md`（主架构）
- `mate-kernel/src/mate_kernel/agent/orchestrator.py`（PlanSpec / StepKind / ≥1 HITL 硬校验）
- `mate-tech-orchestrator/src/mate_tech_orchestrator/scheduler/{plan_runner,dispatcher,role_registry,session_evolution}.py`
- `mate-app-copilot/src/mate_app_copilot/agent_loop.py`（既有 FC 循环，**迁移基线**；S1 执行改用 `openai-agents`）
- **`openai/openai-agents-python`**（MIT，L2 执行运行时，R9）：`src/agents/agent.py`（`as_tool` / `clone` / `handoff`）、`models/openai_provider.py`（`base_url` 指自研网关）、`memory/session.py`（`Session` Protocol）、`run_internal/approvals.py`（tool 审批）
- **`openai/codex`**（`RuntimeKind.CODEX` 挂载面预验，§1.4）：`docs/agents_md.md` / `docs/skills.md` / `docs/config.md` / `docs/exec.md`（非交互模式）、`.codex/skills/`
- L2 运行时六候选选型调研（2026-09-16，结论见 §1.4）
- `mate-platform/src/mate_platform/marketplace/skillhub/store.py`（Skill canonical，content 即 SKILL.md）
- `mate-tech-orchestrator/src/mate_tech_orchestrator/bootstrap.py`（`search_skill`/`read_skill` 既有绑定）
- `docs/active/decisions/ADR-0028-digital-employee-prompt-source.md`（prompt 单一数据源）
- `docs/active/prd/APP-DW/PRD-01-Employee-Evolve_v1.0-20260908.md`（FR-EMP-EVOLVE-004 枚举不变）
- WorkBuddy（腾讯云数字员工平台）Agent Swarm 形态：`https://www.cnblogs.com/xindaoxin/p/22440631`
