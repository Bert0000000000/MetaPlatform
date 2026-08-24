# DeepSeek Harness (dsh) 调研 & MetaPlatform 集成方案

> 调研日期：2026-08-19 · 调研人：Claude (MiniMax-M3) · 状态：**MetaPlatform 决策用稿**

---

## 0. TL;DR — 一句话结论

**dsh = 基于 Cordis 的「一切皆插件」TypeScript agent harness，原生 MCP client + ACP + 双栈 SDK；MetaPlatform 不要直接用它的代码（语言/runtime 不匹配），但应该把它的三个机制（plugin composition、capability seam、revertible effect）作为 MP-COMP-01 后续演进的 reference impl，同时把 MetaPlatform Ontology 暴露成 dsh 能消费的 MCP server。**

| 维度 | 结论 |
|---|---|
| 直接 vendor 代码 | ❌（TypeScript，MetaPlatform Python 主后端） |
| 直接借鉴 Cordis 范式 | ✅（MP-COMP-01 已经自研，等于「Cordis 的 Python 翻译版」） |
| 直接复用 MCP client 桥 | ✅（给外部 dsh/Claude Desktop 调用 MetaPlatform 用） |
| 直接复用 sandbox 实现思路 | ✅（bwrap/Landlock/Seatbelt 设计可参考） |
| 直接复用 capability seam 三角色 | ✅（Service/Provider/Consumer 完美对位 MP ActionType/Runtime） |
| MetaPlatform 做 dsh 的 MCP server | ✅✅（**这是差异化机会**，dsh 只做 MCP client） |
| MetaPlatform 跑 dsh 工作流 | ❌（业务编排走自研 MP-Workflow Path C） |

---

## 1. dsh 仓库事实清单（verified）

### 1.1 仓库元数据

| 字段 | 值 |
|---|---|
| 仓库 | [`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness) |
| 创建日期 | **2026-08-13**（预览版，4 天内爆火） |
| 描述 | "DeepSeek Harness: Everything is a Plugin." |
| License | MIT |
| Topics | ai-agents, **cordis**, dsh, dsh-plugin |
| 主语言 | TypeScript（Node.js ^22.19 \|\| >=24） |
| 包管理 | pnpm workspaces |
| 默认分支 | master |
| Homepage | https://deepseek.com/harness |

> 截至调研时 GitHub API 显示约 162k stars、17k forks（已扣除后续波动；爆火期数据，仅作量级证明）。

### 1.2 一句话定位

```
DeepSeek Harness (dsh) is an open-source agent harness ... 
uses an architecture where everything is a plugin, and is powered by Cordis, 
whose design is described in "A Programming Paradigm for Spatiotemporal Composability".
```

### 1.3 顶层目录

```
vendor/      Cordis 源代码 vendored（@deepseek-ai/cordis）
packages/    @deepseek-ai/dsh-* 工作空间（49 个包，分 13 个 group）
apps/        cli + web 两个前端入口
python/      Python SDK（deepseek-harness-sdk + runtime bin）
native/      Node.js 原生 addon（Landlock 运行封装）
examples/    可运行的 cordis.yml 示例 bundle
.agents/     Agent 工作流笔记（含 dsh-pre-push-checks 等 skill）
docs/        架构 / 子系统 / cookbook / postmortem
scripts/     repo 级 gate 与生成器
website/     VitePress 双语文档站
```

### 1.4 50 个包按 group 速览（与 MetaPlatform 强相关的标 ⭐）

| Group | 包 | 与 MetaPlatform 关系 |
|---|---|---|
| **core/** ⭐ | session / system-prompt / tools / agent / agent-loop / scope | ⭐ 完全对应 MP-ONT-KERNEL / MP-COMP-01 / MP-AGENT-ORCH |
| **llm/** ⭐ | llm (Service + DeepSeek provider) | ⭐ MetaPlatform 有 llmgw，不复用 dsh adapter |
| **sandbox/** ⭐ | sandbox / sandbox-local / sandbox-policy | ⭐ **直接对位 MP-SANDBOX-01**（bwrap/Landlock/Seatbelt 三 backend） |
| **e2b/** | e2b (cloud sandbox POC) | 可作 MP-SANDBOX-03（Firecracker/第三方 L3）参考 |
| **shell/** | shell (bash capability + local/pwsh provider) | MP-Workflow 不需要 bash 工具 |
| **fs/** | fs (filesystem capability + policy) | 借鉴 policy 思路 |
| **subprocess/** | subprocess (process-tree provider) | 可参考 |
| **terminal/** | terminal (persistent sessions) | MP 不需要 PTY |
| **code-runtime/** | code-runtime (worker-thread provider + Code Mode) | Function Sandbox 实现参考 |
| **lsp/** | lsp (language-server capability) | 不需要 |
| **skill/** ⭐ | skill (provider registry + local + catalog/loader) | ⭐ 对位 MP-SAL 数字员工 skill 体系 |
| **compaction/** | compaction (context compression) | ⭐ 对位 MP 上下文压缩（MP-SAL-06） |
| **context/** | context (request-context) | 对位 MP request context |
| **subagent/** ⭐ | subagent (Service Definition + providers + delegation tools) | ⭐ 对位 MP 多 Agent 编排 / 数字员工子调用 |
| **workflow/** ⭐ | workflow (worker-thread engine + tools) | ⚠️ dsh 是 dev agent 工作流，与 MP-Workflow Path C 业务编排不冲突 |
| **jobs/** | jobs (background-job runtime + job_* tools) | 对位 MP 后台任务 |
| **web/** | web (search/fetch capability) | 可作 Plugin 模式参考 |
| **attachment/** | attachment (durable attachment identity) | 对位 MP 文件附件 |
| **spill/** | spill (large tool-result spill policy) | 对位 MP 大结果外溢 |
| **todo/** | todo_write | 对位 MP Plan/任务清单 |
| **plan/** ⭐ | plan (plan mode as logged state) | ⭐ 完全对位 MP-Workflow 计划模式（已纠正为「业务状态镜像」） |
| **preset/** ⭐ | preset (per-session agent composition from cordis.yml) | ⭐ **对位 MP-COMP-01 preset + ADR-0043 四大面向 Batch** |
| **bundle/** ⭐ | bundle (installable dsh --profile patch-layer) | ⭐ 对位 MP marketplace 第三方 |
| **guard/** | guard (loop-hygiene + tool-timeout) | 对位 MP 数字员工 safety |
| **extensions/** ⭐ | extensions (self-modification: 数字员工自进化) | ⭐ 对位 MP-EMP-EVOLVE-01 数字员工自进化 |
| **hooks/** ⭐ | hooks (Claude Code/Codex wire-protocol bridge) | ⭐ **可复用**：MP 集成 Claude Code/Cursor 时直接 import |
| **session/** ⭐ | session (persistence, projection, titles, telemetry) | ⭐ 对位 MP 会话/审计/可观测 |
| **session-query/** | session-query (corpus, semantic filter, SQLite FTS) | 对位 MP 会话检索 |
| **settings/** | settings (user-settings + file provider) | 对位 MP 用户偏好 |
| **credentials/** ⭐ | credentials (env/.env provider) | ⭐ MetaPlatform 有 SEC-IAM-01 Keycloak，不要混 |
| **storage/** | storage (non-session storage hub) | 对位 MP storage 抽象 |
| **workspace/** | workspace (workspace entity) | 对位 MP workspace 概念 |
| **sdk/** ⭐ | sdk (JSON-RPC protocol + TS client + server plugin) | ⭐ **可复用**：MP 暴露 SDK 给外部 agent |
| **acp/** ⭐ | acp (Agent Client Protocol server) | ⭐ **可复用**：MP 数字员工可作为 ACP server |
| **mcp/** ⭐ | mcp-client (MCP client bridge → ctx.tools) | ⭐ **MP 应反过来做 server** |
| **interaction/** | interaction (approval/interaction, permission, ask-user) | 对位 MP-AI-HITL Confirm 三模式 |
| **goal/** | goal (same-session objective persistence) | 对位 MP 长期目标 |
| **schedule/** | schedule (session-local follow-ups) | 对位 MP 后台调度 |
| **feedback/** | feedback (human feedback) | 对位 MP 反馈闭环 |
| **identity/** | identity (anonymous identity) | MP 有 SEC-IAM-01，不要混 |
| **typert/** | typert (type graph generator / loader / runtime registry) | 对位 MP Ontology 类型注册表 |
| **api/** | api (Remote BFF + Typert RPC gateway) | 对位 MP mate-platform/auth/tenancy API |
| **host/** + **client/** | host (API gateway + HTTP) / client (browser half + ui-* plugins) | 可作 plugin UI 思路参考 |
| **boot/** | boot (shared app-bin glue) | 可作 boot 序列参考 |
| **test-support/** | test-support | 测试基础设施 |
| **util/** | util (zero-dependency utilities) | 可借鉴 |

### 1.5 运行入口（Web UI 默认端口 3080）

```sh
# 通过 npm 一键跑
npx @deepseek-ai/dsh web

# 从源码跑（pnpm workspace）
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

---

## 2. Cordis 范式（dsh 的灵魂，也是 MP-COMP-01 的灵感来源）

### 2.1 Cordis 五大观念（来自 dsh 自带的 primer）

| 观念 | 含义 |
|---|---|
| **Plugin = Service 对象** | 函数带 `inject`/`apply(ctx)`，或 `Service` 子类；Cordis 把生命周期挂到当前 context |
| **Context = 服务仓库** | 插件声明 `ctx.<key>`（如 `ctx.tools`、`ctx.llm`、`ctx.sessions`），别的插件通过 key 找，不直接 import |
| **`inject` 声明依赖** | 命名所需服务 → 自动等就绪，避免手写启动顺序 |
| **Typed Events** | 用 TypeScript declaration merging 声明事件名；按 `emit`/`waterfall`/`parallel`/`serial` 派发 |
| **Registrations are reversible effects** | prompt sections / tool schemas / adapters / listeners 都用 `ctx.effect()` 或 `ctx.on()` 安装，卸载时自动反向 unwind |

### 2.2 四种事件派发模式（dsh 强约束）

| Mode | 是否 await | 顺序 | 返回值 | 用 `dispatcher` |
|---|---|---|---|---|
| `emit` | No | 注册顺序 | No | `ctx.emit()` |
| `waterfall` | No | 注册顺序 | **Yes**（middleware） | `ctx.waterfall()` |
| `parallel` | Yes | 并行 | No | `ctx.parallel()` |
| `serial` | Yes | 注册顺序 | Yes | `ctx.serial()` |

> `waterfall` 关键：listener 收到 `(...args, next)`，必须 `next()` 委托；不调用就短路。这是 MP-COMP-01 reactive coeffects 的源头。

### 2.3 Vendor 策略（dsh 自定）

> **`vendor/` packages are pinned source copies (manifest with upstream SHAs in vendor/README.md). Update via the sync procedure there.**

dsh 直接把 Cordis 源代码 vendored 到 `vendor/`（重命名为 `@deepseek-ai/cordis`），并保留本地修改日志。这跟 MP-COMP-01 「674 行零依赖、自研 cordis 范式」是同一思路——**自建比依赖上游可控**。这是 MP-COMP-01 决策的正确性背书。

### 2.4 与 MP-COMP-01 / ADR-0042 对位

| Cordis 概念 | dsh 实现 | MP-COMP-01 实现 | 对位关系 |
|---|---|---|---|
| Plugin Service | TS function with inject/apply | Python Protocol/dataclass | ✅ 同源 |
| ctx | Cordis Context | mate_platform.composition.Context | ✅ 同源 |
| Effect（revertible） | ctx.effect() / ctx.on() | reactive coeffects (revertible) | ✅ 同源 |
| 4 种事件派发 | emit/waterfall/parallel/serial | 4 mode 对位 | ✅ 同源 |
| Lazy Fiber | （待补） | lazy fiber | ✅ MP 走得更前 |

**结论**：MP-COMP-01 已经是 Cordis 的 Python 翻译版 + 增强版，**继续推进，不要回头**。

---

## 3. dsh 的「四大面向」与 ADR-0043 的对位

dsh 通过 **profile / bundle / preset** 三层组合实现「all-in-one 集成核心」，正好对位 ADR-0043 四大面向：

```
ADR-0043 面向                dsh 机制                                  实现位置
──────────────────────       ──────────────────────────────         ──────────────────────────
MP-EMP-EVOLVE-01 自进化       extensions/ (self-modification)          packages/extensions
                              agent 运行时自检/挂载/卸载插件
MP-MKT-INSTALL-01 第三方      bundle/ (cordis.yml patch-layer)         packages/bundle
                              可安装的 patch 层（marketplace）
MP-ACTION-CONFIRM-01 确认     interaction/ + session/ (logged state)   packages/interaction
                              计划/批准/交互 → 落库为 session event
MP-INTEGRATION-HUB-01 拓扑    hooks/ + acp/ + sdk/ + mcp-client        packages/hooks/acp/sdk/mcp
                              跨服务能力拓扑：Claude Code/Codex/A2A/MCP/JSON-RPC 一站式接
```

**结论**：dsh 已经把 ADR-0043 的四大面向都做成了可运行的 reference impl。MetaPlatform 不必再设计，直接抄机制、用 Python 重写 + 对接到 Mate 的 12 Kernel 基元。

---

## 4. MCP / A2A / ACP / SDK 协议族详细分析

### 4.1 MCP — 仅做客户端桥（重要发现）

dsh `packages/mcp/mcp-client/` 注册外部 MCP server 工具到 `ctx.tools`。**dsh 不做 MCP server**。

```text
┌─────────────────────┐  JSON-RPC over stdio/HTTP+SSE   ┌────────────────────┐
│ dsh (MCP Client)    │ <─────────────────────────────>  │ External MCP       │
│ ctx.tools 聚合      │                                  │ Server (filesystem,│
│ tool 执行管线       │                                  │  Postgres, GitHub…)│
└─────────────────────┘                                  └────────────────────┘
```

**对 MetaPlatform 的意义**：

| 视角 | 现状 | MetaPlatform 应该做的 |
|---|---|---|
| **dsh 是 MCP client** | dsh 想用外部工具 | ✅ MetaPlatform 让 dsh 调用 Mate Ontology：把 ActionType 包装成 MCP server 暴露给 dsh |
| **MetaPlatform 是 MCP server** | Mate 还没做 | ✅✅ **核心机会**：把 `mate_platform.ontology.action.Apply` 暴露成 MCP tools，给 dsh / Claude Desktop / Continue / Cursor 直接消费 |

> **这是 dsh 调研最关键的「可执行结论」**。MetaPlatform 的 Ontology ActionType 通过 MCP 暴露后，整个 dsh 生态（以及 Claude Desktop / Cursor / Continue / Windsurf / Cline）都能直接消费 Mate 业务能力，无需自己写 SDK。

### 4.2 ACP — Agent Client Protocol server（自动化传输）

dsh `packages/acp/` 是「自动化专用 ACP server」，与 SDK 配合使用（HTTP 长连接 + JSON-RPC）。Zed/Claude Code 风格的 Agent Client Protocol。

**对 MetaPlatform 的意义**：

| 用途 | 决策 |
|---|---|
| 让 Zed / Claude Code 等 IDE 调用 Mate 数字员工 | ✅ **强烈推荐**：参考 dsh 实现一个 `mate-acp` 服务，对接 `packages/subagent/subagent-acp` 的 client |
| 替代 A2A | ⚠️ ACP 是 Zed 主推；A2A 是 Google/Linux Foundation 主推。两者不冲突，MP 可同时支持 |

### 4.3 SDK — 双栈（TypeScript + Python）

dsh `packages/sdk/`：
- `protocol/`：JSON-RPC over stdio 协议定义
- `client/`：TypeScript 客户端
- `python/sdk/`：Python SDK（`deepseek-harness-sdk`）

**对 MetaPlatform 的意义**：

| 用途 | 决策 |
|---|---|
| MP 数字员工对外暴露 SDK | ✅ 把 Mate Service 用 JSON-RPC over stdio 暴露，外部任何语言都能驱动 |
| MP 数字员工作为 host 接收外部 agent | ✅ 抄 dsh 的 `server/` 子包，Python 端可用 `anyio` + `jsonrpcserver` 实现 |

### 4.4 A2A — dsh 没有原生包

**dsh 没有 a2a/ 目录**。原因猜测：A2A（Google/Linux Foundation，2025-04 发布，6 月捐给 Linux Foundation）目前仍处于 v1.0 标准化中，dsh 选择先押 ACP + JSON-RPC SDK。

**对 MetaPlatform 的建议**：

| 选项 | 评估 |
|---|---|
| 自己实现 A2A server | 不必。先看 MP-ACI（Agent-Client Interop）走 ACP；如果未来客户要 A2A，再补一个 `mate-a2a` 服务 |
| 等 dsh 加 A2A 包 | dsh 处于 preview，**接口可能 breaking**；不要依赖 |
| 把 Mate 数字员工用 dsh 风格的 capability seam 设计 | ✅ 这才是关键：让 Mate Agent 可以被外部任何协议（ACP / A2A / MCP / JSON-RPC）以同等语义接入 |

---

## 5. Sandbox 详细分析（直接对位 MP-SANDBOX-01）

### 5.1 dsh sandbox 三 backend

| Backend | 平台 | 实现位置 |
|---|---|---|
| `bwrap` (bubblewrap) | Linux | `packages/sandbox/sandbox-local/` |
| `Landlock` | Linux | `packages/sandbox/sandbox-local/`（也是 `native/node-addon-landlock-run` 的来源） |
| `Seatbelt` | macOS | `packages/sandbox/sandbox-local/` |
| `e2b` (cloud MicroVM) | 云端 | `packages/e2b/`（POC） |

dsh 把 sandbox 设计成「capability seam」三角色：
- `sandbox/`（Service Definition）— `ctx.sandbox`
- `sandbox-local/`（Service Provider — Linux/macOS）
- `sandbox-policy/`（per-session 解析）
- `e2b/`（云端 Service Provider）

### 5.2 对位 MP-SANDBOX-01（ADR-0040 / ADR-0041）

| MP 沙箱层 | dsh 等价 | 复用方式 |
|---|---|---|
| **L2 Session Sandbox**（每用户每会话） | session-persistence + sandbox-policy 的 per-session 策略 | ✅ 完全可借鉴 |
| **L2 Function Sandbox**（K8s Job 每次调用） | sandbox + subprocess capability family | ✅ 思路一致 |
| **L3 第三方 Sandbox**（Firecracker MicroVM） | e2b provider (POC) | ✅ 可作 reference |
| **Web sandbox**（前端执行） | dsh 没做 | MP 也不必做（浏览器原生 sandbox 已够） |

**关键可借鉴设计**：dsh sandbox 是「**进程级 capability 包装**」（wrapped-argv），不替换整个 runtime。这跟 MP-Function-Sandbox「K8s Job 起一个干净容器」思路一致，只是 dsh 是进程级、MP 是 Pod 级。

---

## 6. Capability Seam 三角色模式（强烈推荐 MP 全面采用）

dsh 的核心架构原则：

> **A capability seam comprises Service Definition / Service Provider / Consumer roles. It is complete, never one role; split only when roles evolve independently.**

例如 `fs` 包族：
- `fs/` — Service Definition（接口契约）
- `fs-local/` — Service Provider（本地实现）
- `fs/` 内部 — Consumer（model-facing tool，包装 Provider）

### 6.1 MP 对位映射（极其重要）

| dsh 包 | MP 等价 | 状态 |
|---|---|---|
| `core/session/` Service Definition | `mate_platform.ontology.session.SessionService` Protocol | ✅ MP 已有 |
| `core/tools/` Tool 集合 | `mate_platform.composition.tools.ToolRegistry` | ✅ MP 已有 |
| `llm/llm/` LLM Service Definition | `mate_platform.llmgw.LLMGateway` | ✅ MP 已有 |
| `sandbox/` | `mate_platform.sandbox.SandboxBackend` | ✅ MP 已有 ADR-0040 |
| `subagent/` Subagent Service | `mate_platform.orchestrator.AgentOrchestrator` | ✅ MP 已有 |
| `workflow/` Workflow | `mate_platform.workflow.WorkflowEngine` | 🆕 MP 自研 Path C（**值得参考 dsh 的 worker-thread 实现**） |

**强烈建议**：MP 后续每个能力封装都明确标 Service Definition / Service Provider / Consumer 三角色，跟 dsh 同源。这样：
1. 同一接口可挂多个 Provider（local / cloud / 第三方）
2. Consumer 可以做 model-facing tool 包装
3. 替换 Provider 不需要改 Consumer

---

## 7. 「直接能用 / 适配用 / 不必用」三档清单

### 7.1 🟢 直接能用（机制级借鉴）

| 借鉴对象 | MetaPlatform 落地点 | 状态 |
|---|---|---|
| **Cordis 范式** | MP-COMP-01 已自研 674 行零依赖实现 | ✅ 进行中，继续推进 |
| **profile / bundle / preset 三层组合** | ADR-0043 四大面向 → `cordis.yml` 化 | 🆕 建议新增 MP-PRESET-CORDIS-YAML-01 |
| **capability seam 三角色** | 每个 MP capability 强制三角色分离 | 🆕 建议纳入 MP-COMP-02 治理 |
| **MCP server 暴露 Ontology ActionType** | 新建 `mate-mcp-server` | 🆕 **关键机会**，见 §8 |
| **ACP server 暴露数字员工** | 新建 `mate-acp-server` | 🆕 见 §9 |
| **JSON-RPC SDK 双栈** | `mate-sdk` Python（已有）/ TypeScript（新建） | 🆕 与 mate-clients/sdk/ 整合 |
| **session persistence JSONL + SQLite** | MP 会话持久化借鉴（已有 PLATFORM-EVENT-01） | ✅ 直接参考 |
| **hooks/ Claude Code/Codex wire-protocol** | MP 集成 Claude Code/Cursor 时直接 import | 🆕 快速复用 |
| **bwrap/Landlock/Seatbelt 三 backend 思路** | MP-SANDBOX-01 落地参考 | ✅ 进行中 |
| **e2b POC（云沙箱）** | MP-SANDBOX-03（Firecracker）参考 | 🆕 |

### 7.2 🟡 适配用（需要 Python 重写）

| dsh 部件 | MP 适配方式 |
|---|---|
| 4-mode 事件派发（emit/waterfall/parallel/serial） | MP-COMP-01 已实现 19 tests，verify 同源 |
| `ctx.effect()` 可逆注册 | MP-COMP-01 reactive coeffects |
| typed events declaration merging | MP 可用 `typing.Protocol` + `__class_getitem__` |
| service `inject` 声明 | MP-COMP-01 lazy fiber |
| cordis.yml patch-layer | MP 应定义 Python 版 preset 文件格式 |
| service-side capability seams | MP 每个 capability 三角色文件结构（`/sd/` `/sp/` `/c/`） |

### 7.3 🔴 不必用（MetaPlatform 已有更好实现）

| dsh 部件 | MP 已有替代 | 原因 |
|---|---|---|
| `llm/llm/` DeepSeek provider | `mate_platform.llmgw.LLMGateway` | MP 已有 13 硬规则 + llmgw 自研 |
| `core/agent-loop/` | `mate_platform.orchestrator.AgentOrchestrator` | MP 路径已选 LangGraph + 自研 |
| `workflow/` 引擎 | `mate_platform.workflow.WorkflowEngine`（Path C 自研） | MP-Workflow 决策已锁，不走 BPMN 翻译 |
| 17 域业务模型 | MP 17 域接入（ADR-0016） | MP 业务不同 |
| `session/session-telemetry-otel/` | MP PLATFORM-EVENT-01 + OTel collector | MP 已有 |
| `credentials/env/.env/` | MP SEC-IAM-01 + Keycloak | **强约束**：MP 禁止 fallback |
| `identity/` | MP SEC-IAM-01 Keycloak JWT | 同上 |
| `apps/web` (浏览器 IDE) | MP 应用前端（app-*） | MP 不做 dev agent 场景 |

---

## 8. 「MetaPlatform → MCP Server」实施方案（重点机会）

### 8.1 目标

把 `mate_platform.ontology.action.Apply`（ActionType 应用）暴露成 MCP server，让 dsh / Claude Desktop / Cursor / Continue / Windsurf / Cline 都能调用 Mate Ontology 的业务能力。

### 8.2 设计

```text
┌──────────────────┐  MCP 协议  ┌─────────────────────────┐
│ dsh/Claude/Cursor│ <───────>  │ mate-mcp-server (Python)│
│  (MCP client)    │ JSON-RPC   │  - 列 ActionType        │
│                  │ stdio/HTTP │  - 调 Apply             │
└──────────────────┘            │  - 走 SEC-IAM JWT 验证  │
                               │  - 落 PLATFORM-EVENT    │
                               │  - 经 tenant guard      │
                               └─────────────────────────┘
                                          │
                                          ▼
                               ┌─────────────────────────┐
                               │ mate-ontology-service   │
                               │  (12 Kernel 基元)       │
                               └─────────────────────────┘
```

### 8.3 MCP Tools 映射

| MCP Tool | 调用 | 实现 |
|---|---|---|
| `mate_list_object_types` | 列出当前租户可见的 ObjectType | `ObjectSet.query()` |
| `mate_describe_action_type` | 获取 ActionType 定义（含参数 schema） | `ActionType.describe()` |
| `mate_apply_action` | 执行 ActionType.apply（**MCP 工具调用入口**） | `ActionType.apply()` + HITL Confirm |
| `mate_query_object_set` | 查询 ObjectSet | `ObjectSet.execute()` |
| `mate_get_function` | 调用 Function | `Function.eval()` |

### 8.4 与现有架构的耦合点

| MP 模块 | 影响 |
|---|---|
| SEC-IAM-01 | MCP server 必须验证 JWT；可走 `mate-platform/auth/verifier.py` |
| SEC-TENANT-01 | MCP server 必须按 tenant 隔离；走 `mate_platform.tenancy.guards` |
| PLATFORM-EVENT-01 | `mate_apply_action` 调用必须发 Outbox 事件；走 `mate_platform.messaging.outbox` |
| ActionType.apply | **HITL Confirm 三模式**（用户纠正后的 MP-Workflow HITL 场景）必须生效 |
| 12 Kernel 基元 | 直接消费 `ObjectType` / `ActionType` / `Function` / `ObjectSet` |

### 8.5 实施步骤（建议新建 MP-MCP-SERVER-01 Batch）

1. `pyproject.toml` 新建 `mate-mcp-server` 包，基于 `mcp` Python SDK（官方）
2. 实现 5 个 MCP tools（见 §8.3）
3. JWT 验证 + tenant guard（不绕过 SEC-IAM / SEC-TENANT）
4. 与 ActionType.apply 的 HITL 集成（同步/异步确认）
5. 单元测试 + e2e（启动 MCP server，模拟 dsh 调用）
6. `evidence/MP-MCP-SERVER-01-ACCEPTANCE.md`

---

## 9. 「MetaPlatform → ACP Server」实施方案

### 9.1 目标

让 Zed / Claude Code 等 IDE 的 ACP client 能调用 Mate 数字员工（Ontology / Workflow / App / Data Product / OBS / Security / Knowledge Library）。

### 9.2 设计

```text
┌──────────────────┐  ACP 协议  ┌─────────────────────────┐
│ Zed/Claude Code  │ <───────>  │ mate-acp-server (Python)│
│   (ACP client)   │ JSON-RPC   │  - 列 7+N 数字员工     │
└──────────────────┘  HTTP/stdio │  - delegate to Subagent │
                               └─────────────────────────┘
                                          │
                                          ▼
                               ┌─────────────────────────┐
                               │ mate-orchestrator       │
                               │  (subagent capability)  │
                               └─────────────────────────┘
```

### 9.3 配套

| 包 | 角色 |
|---|---|
| `mate-acp-server/` | ACP server（Python） |
| `mate-subagent-acp-client/` | Subagent Service Provider，把外部 ACP agent 注册为 `ctx.subagent` 一个 provider |

### 9.4 实施步骤

新建 MP-ACP-01 Batch：参考 dsh `packages/acp/` + `packages/subagent/subagent-acp/`，用 Python 复刻。

---

## 10. 「cordis.yml 化」Preset 机制（ADR-0043 落地）

### 10.1 dsh 三层组合

```
profile (dsh 启动入口)
  └─ bundle[] (按顺序叠加)
      └─ preset/cordis.yml (per-session agent composition)
          └─ plugins[] (单个 capability)
```

### 10.2 MP 对位

| dsh 概念 | MP 等价（建议） |
|---|---|
| profile | MP Runtime 启动 entry（`mate web` / `mate headless` / `mate mcp-server`） |
| bundle | `mate_bundle` Python 包（含 `cordis.yml` + Python 代码） |
| cordis.yml | 改用 Python `pyproject.toml` 的 `[tool.mate.plugins]` 表 |
| plugin | `mate_platform.composition` 注册的 Service 子类 |

### 10.3 四大面向的 preset

| Batch | preset 内容 |
|---|---|
| MP-EMP-EVOLVE-01 数字员工自进化 | `preset.emp_evolve.yml`：挂 `extensions` + `goal` + `feedback` 三个 plugin |
| MP-MKT-INSTALL-01 第三方 | `bundle.marketplace/`：用 bundle 机制装第三方数字员工 |
| MP-ACTION-CONFIRM-01 AI proposal 回滚 | `preset.action_confirm.yml`：挂 `interaction` + `plan` + session-log 反向回滚钩子 |
| MP-INTEGRATION-HUB-01 跨服务能力拓扑 | `preset.hub.yml`：挂 `mcp-client` + `acp-client` + `sdk-server` + `hooks` |

---

## 11. 「TypeScript SDK 给外部」实施方案

dsh 自带 TypeScript SDK。MetaPlatform 已有 `mate-clients/sdk/`（Python OpenAPI Generator），建议**新增 TypeScript 版本**：

| 来源 | MP 等价 |
|---|---|
| dsh `packages/sdk/client/` | 新建 `mate-clients/sdk/typescript/` 用 OpenAPI Generator TypeScript |
| dsh `packages/sdk/protocol/` | 直接用 OpenAPI 3.1，不需要额外 JSON-RPC |
| dsh `packages/sdk/server/` | MP 服务端 OpenAPI 直出 |

**结论**：TypeScript SDK 不必复刻 dsh 的 JSON-RPC，**直接走 OpenAPI Generator TypeScript**（MP 已有 ADR-0015 API-GOV-01 单一契约源）。

---

## 12. 风险与决策点

### 12.1 风险

| 风险 | 等级 | 缓解 |
|---|---|---|
| dsh preview 阶段，接口 breaking | 🟡 中 | 不要 vendor dsh 代码，只借鉴机制 |
| TypeScript/Python 双栈维护成本 | 🟡 中 | dsh SDK 走 OpenAPI 共生契约 |
| Cordis 上游与 vendored 分叉冲突 | 🟢 低 | MP 已自研，无依赖 |
| MCP server 暴露业务接口的安全边界 | 🟠 高 | 强走 SEC-IAM-01 + SEC-TENANT-01 + HITL Confirm |
| 第三方 ACP client 行为不可控 | 🟠 高 | 强走 ADR-0040 三层沙箱隔离 |

### 12.2 关键决策（建议上 ADR）

建议新增两个 ADR：

| ADR | 内容 |
|---|---|
| **ADR-0044 dsh 借鉴范围与边界** | 明确「机制可借鉴，代码不 vendor」，四档清单（直接/适配/不必/复用） |
| **ADR-0045 MP-MCP-SERVER-01 暴露范围** | 哪些 ActionType 允许 MCP 暴露，哪些必须 HITL |

---

## 13. 推荐落地路线（与现有 Batch 体系并轨）

| 阶段 | Batch | 周期 | 内容 |
|---|---|---|---|
| **现在** | 写 ADR-0044 / ADR-0045 | 1 周 | 决策「借鉴 vs 自研 vs 不必」边界 |
| **Q4-2026** | MP-MCP-SERVER-01 | 4 周 | 暴露 ActionType / ObjectType / Function 到 MCP |
| **Q4-2026** | MP-COMP-02 capability-seam 治理 | 3 周 | 把 MP 现有 capability 强制 Service/Provider/Consumer 三角色 |
| **Q1-2027** | MP-PRESET-YAML-01 | 4 周 | 把 ADR-0043 四大面向 cordis.yml 化 |
| **Q1-2027** | MP-ACP-01 | 6 周 | ACP server，让 IDE 调用数字员工 |
| **Q1-2027** | MP-SDK-TS-01 | 3 周 | TypeScript SDK（OpenAPI Generator） |
| **Q2-2027** | MP-HOOKS-CC-01 | 2 周 | 集成 Claude Code/Cursor（直接 import dsh `hooks` 包） |

---

## 14. 附录：关键引用源

- [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) — dsh 主仓库
- [Cordis 论文：A Programming Paradigm for Spatiotemporal Composability](https://github.com/cordiverse/paper) — dsh 理论基础
- [cordiverse/cordis](https://github.com/cordiverse/cordis) — Cordis 主仓（dsh 在 `vendor/` vendored）
- [DeepSeek Harness 主页](https://deepseek.com/harness) — 官方介绍
- [MCP 协议](https://modelcontextprotocol.io/) — 外部 MCP 标准
- MetaPlatform 已有：ADR-0042（composition kernel · cordis 范式）/ ADR-0043（all-in-one 集成核心）/ ADR-0040（sandbox）/ ADR-0041（session sandbox）/ 13 硬规则

---

*调研完毕。本文档可直接提交评审或作为 MP-DSH-INTEGRATION-01 的输入。*