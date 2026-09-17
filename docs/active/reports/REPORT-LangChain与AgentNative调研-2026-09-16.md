# REPORT — LangChain / Agent-Native 深度调研与自研 vs 引入判断

> **日期**：2026-09-16
> **触发**：SuperAI + 数字员工「语义识别 → 动态创建员工 → agent team 调度」落地方案选型
> **方法**：github-architecture-research 四步法（真实 API 数据 → License 审计 → 读真代码 → 分层对比）
> **前置**：同日的 SuperAI/数字员工调度现状差距分析（G1–G6）

---

## 1. 一句话判断

**两仓都不引入代码，保持自研。** 但两个项目各有一处必须借鉴的设计：**agent-native 的「Agent Teams」五动作协议 + 任务作用域子 agent 模型**（直接对位我们的 G3/G4），以及 **langchain 的 middleware 分层与 subagent 流式 handle 协议**（对位 G1 的运行时组织）。

**本轮最大的一处方案修正**：把 G3 从「动态创建数字员工（持久注册表实体）」改写为「**任务作用域 spawn 子 agent**」，可完全绕开 `AgentRole` 枚举冻结的硬约束。

---

## 2. 真实数据（GitHub API，2026-09-16 实测）

| ⭐ Stars | 🍴 Forks | 📅 Last push | 💻 Language | License | Recommendation |
|---|---|---|---|---|---|
| 146,397 | 24,470 | 2026-09-15 | Python | **MIT**（LICENSE 文件在） | ❌ 不引入（硬拖 langgraph，与本仓编排路线冲突） |
| 4,787 | 454 | 2026-09-16 | TypeScript | **⚠️ 不一致**（见 §3） | ❌ 不引入（平台级框架，引入 = 重写全栈） |

补充事实：

| 项 | langchain-ai/langchain | BuilderIO/agent-native |
|---|---|---|
| created_at | 2022-10-17（4 年） | 2026-03-12（6 个月） |
| size | 596,793 KB（≈583 MB monorepo） | 342,278 KB（≈334 MB monorepo） |
| open issues | 494 | 113 |
| fork/star 比 | 16.7%（健康） | 9.5%（健康） |
| 活跃度 | 昨日有 commit | **每日多次合 PR（PR 号已 5 千+）** |

**两仓都是活的**，不存在「已废弃」这一否决理由——否决必须来自架构与 License，不能来自生死。

---

## 3. License 审计（阻塞项）

### langchain — ✅ MIT 清晰

- `repos/langchain-ai/langchain/license` → `spdx_id: MIT`，根目录 `LICENSE` 文件存在。
- 商业使用无限制。**不构成阻塞**。

### agent-native — ⚠️ 仓库级不一致，需澄清后才能谈引入

| 位置 | 声明 |
|---|---|
| 根目录 | **无 LICENSE 文件**（根目录树里只有 `.changeset/`、`package.json`、`README.md` 等，无 LICENSE） |
| 根 `package.json` | `"license": "ISC"`，且 `"private": true` |
| `packages/core/package.json` | `"license": "MIT"`（`@agent-native/core@0.180.0`，含 `bin`，可 `npx` 安装） |
| `packages/{dispatch,scheduling,agentkit,frame}/package.json` | `"license": "MIT"` |
| GitHub API `license.spdx_id` | `NONE`（因为无根 LICENSE 文件） |
| 仓内 search `filename:LICENSE` | 仅 4 个命中，全部是**第三方资源**：`packages/vscode-extension/LICENSE.md`、两个字体 license、一个字体 license |

**判定**：可安装的 `@agent-native/core` 及各子包声明 MIT，商业上大概率可用；但**仓库根无 LICENSE 文件**意味着仓库级授权意图未经正式声明，fork/整体引入前必须与 Builder.io 澄清。**ADR-0065 原文记的「MIT」应修正为「子包 MIT / 根仓未声明」。**

> 这正是四步法要求「永远读 LICENSE 文件、不要信 API 字段」的实例——不过这次是反向：API 说 NONE，真实情况是「根仓缺失 + 子包 MIT」的混合态。

---

## 4. 架构速览（5 关键文件 × 2 仓）

### langchain v1（`libs/langchain_v1/`，v1 是重写版）

| 文件 | 内容 | 结论 |
|---|---|---|
| `pyproject.toml` | deps = `langchain-core` + **`langgraph>=1.2.11`** + `pydantic` | **langgraph 是硬依赖** |
| `langchain/agents/factory.py` | `create_agent()`，内部 `import langgraph.graph.state.StateGraph / ToolNode / Send / Command` | **langchain v1 是 langgraph 之上的一层薄封装** |
| `langchain/agents/middleware/` | 22 个中间件：`summarization` / `human_in_the_loop` / `tool_call_limit` / `model_fallback` / `model_retry` / `pii` / `tool_selection` / `context_editing` / `shell_tool` / `todo` / `file_search` … | 真正的价值密度在这里 |
| `langchain/agents/_subagent_transformer.py` | `create_agent(name=...)` 从工具派生的嵌套 run，按 `lc_agent_name` 判定子 agent 边界，暴露为 typed `run.subagents` 流式 handle | 有子 agent 概念，但**只有流式 handle，没有编排语义** |
| `README.md` | 自述：「简单用 LangChain，**复杂编排用 LangGraph**」 | 官方自己划界 |

### agent-native（`packages/core/`）

| 文件 | 内容 | 结论 |
|---|---|---|
| `package.json` | `@agent-native/core@0.180.0`，MIT，含 `bin` → `npx @agent-native/core@latest create my-agent --template chat` | **是「你用它建 App」的框架，不是库** |
| `src/action.ts` | **单文件 89,730 bytes**；`ActionCaller = tool\|http\|frontend\|cli\|mcp\|webmcp\|a2a\|automation` | 统一 action 层，注释明确写「in-app agent loop, **sub-agents/agent-teams**, or A2A (which drives the same agent loop)」 |
| `src/server/agent-teams.ts` + `agent-teams-run-queue.ts` + `agent-teams-delegation-depth.spec.ts` | Agent Teams 编排原语（含委派深度限制、运行队列） | **本仓 G4 缺失的那一层** |
| `docs/content/agent-teams.mdx` | 完整协议（见 §5） | 可直接照抄的协议形态 |
| `src/agent/engine/` | 多 provider engine（`anthropic` / `openai-compatible` / `openrouter` / `ai-sdk` / `builder`）+ 生产级关注点（`failure-taxonomy` / `prompt-cache` / `output-tokens` / `first-event-timeout` / `continuation-dispatch-retry`） | 成熟度远超"demo 框架" |
| 旁证：`templates/`（chat / tasks / calendar / design）、`src/{org,identity,oauth-tokens,email-catalog,deploy,eject,realtime,notifications,feature-flags}`、`agent-native.eject.json` | 自带组织/身份/OAuth/邮件/部署/实时/eject 的**平台级**框架 | 引入 = 用 TS 重写整个 MetaPlatform |

---

## 5. 原理深挖：agent-native 的 Agent Teams（本轮最高价值发现）

来源：`packages/core/docs/content/agent-teams.mdx`

### 5.1 心智模型

- **主 chat = 编排者（orchestrator）**，「很少自己做重活」。
- **子 agent**：各自拥有 **独立 thread + 独立 system prompt + 独立工具集**；每个映射到一个 "custom agent" profile（`agents/<slug>.md`，Markdown + YAML frontmatter）。
- **Chip**：内联在主 chat 的实时预览卡（当前步 / 流式输出 / 最终摘要），点开成为独立 tab。
- **双向消息**：主 agent 可给运行中的子 agent 发追问；子 agent 遇歧义可回问而不是静默阻塞。

### 5.2 调度工具协议（**五动作**）

| Action | 作用 |
|---|---|
| `spawn` | 启动一个子 agent 任务（可选 `agent` 参数指名 profile） |
| `status` | 查运行中子 agent 进度 |
| `read-result` | 取已完成子 agent 的输出 |
| `send` | 给运行中子 agent 发消息 |
| `list` | 列当前用户的全部任务 |

触发路径三档：`@mention`（用户显式）→ 主 agent 自动委派（模型判据）→ `spawnTask()` 程序化。

### 5.3 关键 API：**任务作用域**子 agent

```ts
const task = await spawnTask({
  description, instructions, ownerEmail,
  systemPrompt,          // ← 临场拼装
  actions,               // ← 临场传入工具集
  apiKey, parentSend,
});
```

**子 agent 是 `(system_prompt, tools, thread)` 三元组，不是注册表实体。** profile 是声明式文件（可选引用），spawn 是运行时任务。

### 5.4 生命周期与持久化

```
spawnTask() → chat_threads 建行 → application_state['agent-task:<id>'] status=running
  → agent_task_started（chip 出现）→ agent_task_step（chip 实时更新）
  → status=completed + 摘要 + preview → agent_task_done
```

状态落 SQL（`application_state`），**因此能跨 serverless 冷启动存活、可跨进程**。另有委派深度限制（`agent-teams-delegation-depth.spec.ts`）防递归失控。

---

## 6. 对本仓 6 条差距的对位

| 差距 | langchain 能给什么 | agent-native 能给什么 | 自研成本 | 判定 |
|---|---|---|---|---|
| **G1 员工执行运行时** | `create_agent(model, tools, system_prompt, middleware)` 可直接当 runtime | `engine/` 已实现（TS） | **低**（复用既有 `agent_loop.py` 894 行：FC 循环 / 流式 / 并行 dispatch / 证据事件都已就绪） | 自研 |
| **G2 身份桥（DW ↔ 可调度）** | 无（库里不存在业务身份概念） | `agents/*.md` profile + spawn 引用 | 低 | 自研 |
| **G3 动态装配** | 无 | ✅ **`spawnTask(systemPrompt, actions)` 任务作用域** | 中 | **借鉴（关键）** |
| **G4 组队编排** | 弱：仅 subagent 流式 handle，编排语义要自己在 langgraph 里写 | ✅ **五动作 + 深度限制 + SQL 持久化 + chip** | 中 | **借鉴（关键）** |
| **G5 语义路由** | 无 | 无（用 `@mention` + 模型自选） | 低（本仓已有 `SemanticRouter`） | 自研 |
| **G6 汇总 / UI** | 无 | chip 内联 + 摘要 + preview | 中 | 借鉴形态 |

### 6.1 由此产生的方案修正（重要）

第一轮我把 G3 写成「动态创建数字员工」，会在 `AgentRole` 枚举冻结（PRD-01 `FR-EMP-EVOLVE-004` 明确「枚举不变」）上撞墙。

**修正后的模型**：

| | 旧提法 | 新提法 |
|---|---|---|
| 动态产物 | 新的**员工注册表实体**（需要新 role） | **任务作用域的子 agent**（system_prompt + tools + thread） |
| 落库对象 | 员工记录 | **任务记录**（agent-task） |
| 与枚举约束 | 冲突 | **完全不冲突** |
| 持久员工（DW）角色 | 唯一形态 | 降为可选的 **profile**，spawn 时可引用也可不引用 |

这条修正同时解释了 ADR-0065 的对位结论为什么成立：**agent-native 与本仓 ADR-0021/0064 同构，但它的"动态"从来不发生在角色注册表层，而发生在任务层。**

---

## 7. 为什么不引入（分别论证）

### 7.1 langchain — 引入即硬拖 langgraph

1. **依赖硬性**：`langchain>=1.0` 的 deps 列表里 `langgraph` 不是 optional。要 langchain 的 agent，就要 langgraph 的运行时。
2. **与本仓既定决策双向冲突**：
   - ADR-0061 已接受 **Temporal 作为业务 Workflow 可靠编排控制面**；
   - `docs/active/specs/2026-08-19-mp-v6-architecture.md` 草案里 **LangChain/LangGraph 在「抛弃的旧实现模式」清单中**（决策 19：「编排框架 LangChain / LangGraph → dsh 替代」）。
   - 两条线都不欢迎 langgraph 落地。
3. **功能重叠约 80%**：本仓 `mate-app-copilot/agent_loop.py`（894 行）已实现 FC 决策 → 并行 dispatch → tool_result 回灌 → 循环，且已带 reasoning 流式、evidence/proposal 事件、`MAX_TOOL_ITERATIONS` 上限、工具预算护栏。langchain 的增量主要在 middleware 广度（summarization / context_editing / pii / model_fallback）。
4. **不解决真正的产品差距**：G2/G3/G4 是产品层问题，库层面没有对应物。

**结论**：不引入为运行时；**借鉴 middleware 分层思想与 subagent 流式 handle 协议**。

### 7.2 agent-native — 引入 = 平台级替换

1. **它是「你用它建 App」的框架**，不是可嵌入的库：自带 `db`（自有 schema/migration）、`org` / `identity` / `oauth-tokens` / `email-catalog` / `deploy` / `realtime` / `notifications` / `feature-flags`，外加 `templates/{chat,tasks,calendar,design}` 与 `eject` 机制。
2. **栈全面冲突**：TS/React/Postgres 全栈 vs 本仓 Python（30+ 服务）+ Semi/React。引入等价于重写前后端——那已不是"技术选型"，而是 v6 级别的平台替换决策。
3. **License 仓库级未声明**（§3），在澄清前不具备引入前提。
4. **它的 `action.ts` 与本仓 ADR-0064 统一执行器/EditSet 高度同构**——即我们已有更贴合自身治理（markings / 五层租户 / HITL proposal）的等价物，引入是净损失。

**结论**：不引入代码；**借鉴 Agent Teams 五动作协议、任务作用域子 agent 模型、chip 内联 + 落库形态**。

---

## 8. 落地方案修订（在 G1–G6 方案基础上）

| 批次 | 原方案 | 修订后 |
|---|---|---|
| **T1 员工执行运行时** | 补 `worker_kind="http"` 指向新端点，宿主 `mate-tech-agent` | 不变。**组织方式借鉴 langchain middleware 分层**（把「工具预算/证据限流/上下文裁剪/失败重试」拆成可组合层，而非继续堆在 `agent_loop.py` 里） |
| **T2 身份统一** | DW 员工 create → outbox → 注册 orchestrator role | 不变。补一条：**注册的 role 携带 `spawn_profile` 引用**，与 agent-native 的 `agents/<slug>.md` profile 等价 |
| **T3 动态装配** | LLM 生成员工定义 → proposal → 建**员工记录** | **改写**：LLM 生成 `(system_prompt, tools)` → proposal（HITL）→ 确认后 **spawn 任务作用域子 agent**；持久员工记录降为可选 profile。**绕开枚举冻结** |
| **T4 组队编排** | `generate_plan` 改 LLM 规划 + PlanRunner 数据流 | **补齐五动作协议**：`spawn / status / read-result / send / list` + **委派深度上限**（防递归）+ **任务状态落库**（复用既有 PG，非 agent-native 的 SQL 表）。前端补 **chip 内联预览**形态 |
| 汇总 / HITL | `report` 端点真实现 | 不变。chip 的「摘要 + preview」形态可直接照抄 |

**不动的部分**：语义识别（自研 `SemanticRouter` 已有 embedding + 关键词加权，够用）、租户/HITL/proposal 治理链（本仓比两个参考实现都更完整）。

---

## 9. 结论表

| 维度 | 决策 |
|---|---|
| 引入 langchain | ❌ 否（硬拖 langgraph，与 ADR-0061 / v6 草案双向冲突，功能重叠 80%） |
| 引入 agent-native | ❌ 否（平台级框架，栈全面冲突，Root license 未声明） |
| 借鉴 langchain | ✅ middleware 分层组织 + subagent 流式 handle 协议 |
| 借鉴 agent-native | ✅✅ **Agent Teams 五动作协议 + 任务作用域子 agent + chip 内联/落库**（本轮最高价值） |
| 总体路线 | **保持自研**，与既往结论一致（MAF / LiteLLM / agent-native 均「引原理不引组件」） |
| 方案修正 | G3 由「动态建员工」→「**任务作用域 spawn 子 agent**」，绕开 AgentRole 枚举冻结 |

---

## 10. 下一步（3 选 1）

| 选项 | 内容 | 适用 |
|---|---|---|
| **A（推荐）** | 把本报告 + G1–G6 方案写成 **ADR-0066（数字员工执行运行时与任务作用域子 agent）**，并修订 T1–T4 立项文档；S1 只交付「任务作用域 spawn 子 agent」最小闭环 | 确认按当前架构推进 |
| B | 先做旁路 POC：用 `langchain.create_agent` 起一个员工 runtime，实测与自研 `agent_loop.py` 的成本/能力差，再定 T1 宿主 | 对"自研 runtime 够不够"仍有疑虑 |
| C | 若 v6 轨道（dsh 替代 SuperAI）确定重启，则本报告 §5 的 Agent Teams 协议应转投「dsh preset 编排」评估 | v6 决策优先 |

---

## 附：证据来源

- `gh api repos/langchain-ai/langchain` / `/license` / `/contents/libs/langchain_v1/**`
- `gh api repos/BuilderIO/agent-native` / `/license` / `/contents/**` / `search/code?filename:LICENSE`
- `packages/core/docs/content/agent-teams.mdx`（原文引用）
- `packages/core/src/action.ts`（`ActionCaller` 联合类型原文引用）
- 本仓对位：`agent_loop.py` / `scheduler/*.py` / `ADR-0021` / `ADR-0044` / `ADR-0061` / `ADR-0064` / `ADR-0065` / `PRD-01-Employee-Evolve`
