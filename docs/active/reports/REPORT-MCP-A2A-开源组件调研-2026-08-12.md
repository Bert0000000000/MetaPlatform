# REPORT：MCP / A2A 服务中心开源组件调研（2026-08-12）

> **目的**：为「MCP 服务中心 + A2A 服务中心，支持多角色（数字员工）动态调度」选型，避免自研成本过大。SuperAI 部分计划引入 Pi Agent。
> **方法**：`gh api`（GitHub 真实星标/活动/许可证数据）+ 直接读取 LICENSE 文件 + 读取关键源码（skill: github-architecture-research 全流程）。
> **数据日期**：2026-08-12。

## 1. 一句话判断

**A2A 没有争议 —— 官方 `a2aproject/A2A` 协议 + `a2aproject/a2a-python` SDK（Apache-2.0）就是 Star TOP1，直接引入替代手写 envelope。**
**MCP 服务中心有两条路**：要"一个组件全包"选 **IBM/mcp-context-forge**（一个 Python 组件同时覆盖 MCP+A2A+API 网关，Apache-2.0，4.3K 星，2026-08-11 仍在活跃）；要"贴合现有自建架构、规避大框架反噬"则走官方 `mcp` python-sdk + 自托管 `modelcontextprotocol/registry` + 自建调度层。

## 2. 真实数据表（gh api，按星标降序）

### A2A 相关

| ⭐ Stars | 🍴 Forks | 最近 push | 语言 | License | 仓库 | 说明 |
|---|---|---|---|---|---|---|
| 25,305 | 2,564 | 2026-08-11 | Shell | Apache-2.0 | a2aproject/A2A | **W3C A2A 协议官方规范** + governance |
| 2,072 | 475 | 2026-08-10 | Python | Apache-2.0 | **a2aproject/a2a-python** | **官方 Python SDK**：agent cards / message envelope / tasks / SSE 流式 |
| 584 | 160 | 2026-08-12 | TypeScript | Apache-2.0 | a2aproject/a2a-js | 官方 JS SDK |
| 469 | 162 | 2026-08-11 | Java | Apache-2.0 | a2aproject/a2a-java | 官方 Java SDK |
| 433 | 89 | 2026-08-11 | Go | Apache-2.0 | a2aproject/a2a-go | 官方 Go SDK |
| 249 | 66 | 2026-08-10 | C# | Apache-2.0 | a2aproject/a2a-dotnet | 官方 .NET SDK |
| 1,628 | 231 | 2026-07-16 | Python | — | johnson7788/MultiAgentPPT | A2A+MCP 集成参考样例 |
| 551 | 115 | 2026-07-17 | TypeScript | — | win4r/openclaw-a2a-gateway | A2A 网关插件（OpenClaw） |
| 261 | 31 | 2026-07-01 | Python | — | franzvill/lad | A2A agent 局域网发现协议（实验性） |

### MCP 服务中心（registry / gateway / 框架）

| ⭐ Stars | 🍴 Forks | 最近 push | 语言 | License | 仓库 | 说明 |
|---|---|---|---|---|---|---|
| 11,976 | 964 | 2025-11-24 | Python | — | tadata-org/fastapi_mcp | 把 FastAPI 端点暴露成 MCP（低成本接入，Python 栈友好） |
| 8,501 | 876 | 2026-01-25 | Python | — | lastmile-ai/mcp-agent | MCP agent 框架（2026-01 起少维护） |
| 7,137 | 942 | 2026-08-10 | Go | Apache-2.0 | **modelcontextprotocol/registry** | **MCP 官方 registry 服务**（app-store 式发布/发现/安装，可自托管） |
| 4,302 | 813 | 2026-08-11 | Python | Apache-2.0 | **IBM/mcp-context-forge** | **MCP+A2A+REST/gRPC 统一网关/registry**：治理、发现、可观测、插件、RBAC、反向代理 |
| 4,179 | 1,174 | 2026-08-12 | TypeScript | **无 LICENSE 文件** | archestra-ai/archestra | 企业 AI 平台（MCP registry+gateway+guardrails）→ **商用阻塞，出局** |
| 3,249 | 300 | 2026-08-11 | TypeScript | MIT | punkpeye/fastmcp | Fast MCP server 框架（TS 栈，与本项目 Python 不符） |
| 2,806 | 433 | 2026-08-12 | Python | — | ascending-llc/jarvis-registry | 企业 copilot/agent 注册中心 |
| 859 | 216 | 2026-08-12 | Python | — | agentic-community/mcp-gateway-registry | 企业级 MCP 网关+注册中心（早期） |
| 542 | 1,135 | 2026-08-12 | Go | — | docker/mcp-registry | 官方 Docker MCP registry |
| 2,360 | 470 | 2026-08-09 | Python | — | Observal/Observal | 本地 MCP registry + 分析平台 |

### 已采用基线（本项目现状）

| ⭐ Stars | 语言 | License | 仓库 | 说明 |
|---|---|---|---|---|
| ~20K（mcp 主仓库生态） | Python | MIT | modelcontextprotocol/python-sdk | 本项目 `mate-tech-mcp` 已依赖的官方 MCP SDK（`mcp>=1.0.0`） |
| — | Python | — | 自建 | `mate-app-a2a`（手写 W3C envelope，10+ 端点） |

### SuperAI → Pi Agent

| ⭐ Stars | 🍴 Forks | 最近 push | 语言 | License | 仓库 | 说明 |
|---|---|---|---|---|---|---|
| 87,924 | 10,925 | 2026-08-11 | TypeScript | **MIT** | **earendil-works/pi** | **Pi Agent 主仓库**：统一 LLM API + agent loop + TUI + 编码 agent CLI（Claude Code / Codex 开源平替） |
| 24,017 | 2,283 | 2026-08-12 | TypeScript | — | can1357/oh-my-pi | Pi 终端编码 agent（hash-anchored edits） |
| 4,040 | 562 | 2026-08-12 | TypeScript | — | agegr/pi-web | Pi 的 Web UI |
| 2,365 | 207 | 2026-06-06 | JavaScript | — | badlogic/pi-skills | Pi 的 skills（兼容 Claude Code / Codex CLI） |
| 2,283 | 269 | 2026-08-11 | Python | — | huggingface/tau | **Pi 的 Python 移植版**（如果希望后端 Python 侧调用） |
| 758 | 63 | 2026-05-26 | — | — | cellinlab/how-pi-agent-works | Pi Agent 原理与实现（中文拆解） |

## 3. 许可证审计（读取实际 LICENSE 文件，全部通过）

| 候选 | 实际 LICENSE | 结论 |
|---|---|---|
| a2aproject/A2A + a2a-python | Apache-2.0 | ✅ 商用/嵌入/服务化全无限制 |
| modelcontextprotocol/registry | Apache-2.0（官方 MIT→Apache 过渡期，新代码 Apache-2.0） | ✅ |
| IBM/mcp-context-forge | Apache-2.0 | ✅ |
| punkpeye/fastmcp | MIT | ✅ |
| earendil-works/pi | MIT | ✅ |
| archestra-ai/archestra | **仓库内无 LICENSE 文件** | ❌ 商用硬阻塞，出局 |

## 4. 代码级验证（不只信 README）

- **a2aproject/a2a-python**：`pyproject.toml` + `itk/` + `samples/` 结构确认是完整协议实现（非占位）。
- **IBM/mcp-context-forge**：`mcpgateway/routers/a2a_agent_plugin_bindings.py` 真实存在 —— 提供 A2A agents 的 per-agent per-tenant 插件策略绑定 API（`/v1/a2a-agents/plugin-bindings`）；README 确认三大能力：Tools Gateway（MCP/REST/gRPC-to-MCP）、Agent Gateway（**A2A 协议** + OpenAI/Anthropic agent 路由）、API Gateway（限流/鉴权/重试/反代）。
- **modelcontextprotocol/registry**：README 自述"app store for MCP servers"，Go + Docker 可自托管，API v0.1 已冻结。
- **earendil-works/pi**：`packages/` + `tui-plan.md`，是完整 agent toolkit（非 demo）。

## 5. 场景评估与推荐

### 场景 A：A2A 服务中心 —— 结论：直接引入官方 SDK（零争议）

**推荐：`a2aproject/a2a-python`（Apache-2.0，官方）。**
- 现状 `mate-app-a2a` 是手写 W3C envelope（部分协议自研），协议边缘（agent cards / task 生命周期 / SSE 流式）全靠自己维护。
- 官方 SDK 是 W3C A2A 的权威实现（2.1K 星 + 协议仓 25.3K 星），替换成本 = 改 `mate-app-a2a` 的 handler 层，外部契约不变（本项目 OpenAPI 契约仍是 `/api/v1/a2a/*`）。

### 场景 B：MCP 服务中心 —— 两条路，需定夺

**路线 B1（全包）：引入 `IBM/mcp-context-forge`。**
- ✅ 一个组件同时解决 MCP 注册中心 + MCP 网关 + **A2A agent 网关** + API 反代 + RBAC + 租户策略 + 可观测，Python 栈，Apache-2.0，活跃。
- ⚠️ 反噬风险：430MB 大仓（含 Rust crates + Node 前端 + 自带 alembic DB + 自有 RBAC/team 模型），与本项目 13 硬规则（SEC-TENANT 5 层隔离、硬规则4 外部系统 ACL Client、Keycloak 身份模型）存在模型冲突，接入是"框架适配工程"而非"拿来即用"。

**路线 B2（贴合自建）：官方 `mcp` python-sdk（已用）+ 自托管 `modelcontextprotocol/registry`（Go，做工具注册目录）+ `fastapi_mcp`（把 FastAPI 服务低成本暴露为 MCP）+ 自建动态调度层。**
- ✅ 符合本项目"核心组件自建、协议层用官方 SDK"的既定取向；无大框架反噬；`mate-tech-mcp` 已跑通，增量是 registry 目录 + 调度。
- ⚠️ 注册目录与调度仍需自己写（但有 `modelcontextprotocol/registry` 兜底，不必从零）。

### 场景 C：SuperAI → Pi Agent（用户已定）

**`earendil-works/pi`（MIT，87.9K 星）** 确认存在且成熟；配套 `badlogic/pi-skills`（skills，兼容 Claude Code 语法）、`agegr/pi-web`（Web UI）、`huggingface/tau`（Python 移植，便于后端进程内调用）。**注意**：pi 是编码 agent CLI，做 SuperAI 数字员工 worker 时，多角色调度编排仍需本项目自建（对齐既有"自研 agent 编排"决策）。

## 6. 下一步（三选一）

- **A（推荐）**：A2A 换官方 SDK（场景 A）+ MCP 走 B2（场景 B2）+ 先做"多角色动态调度"骨架。改动最小、贴合硬规则、自研成本可控。
- **B**：MCP/A2A 全部引入 ContextForge（场景 B1），接受大框架适配成本，最快获得完整网关能力。
- **C**：先不写代码，把"数字员工多角色动态调度"的需求规格（角色-能力-路由-负载）写成设计文档，再定技术选型。

## 7. 数据来源

- `gh api /search/repositories?q=...`（星标/forks/push/license 元数据，2026-08-12 拉取）
- `raw.githubusercontent.com/<repo>/<branch>/LICENSE`（逐仓读取实际许可证）
- 关键源码：`mcpgateway/routers/a2a_agent_plugin_bindings.py`（ContextForge A2A 路由）、`modelcontextprotocol/registry/README.md`、`earendil-works/pi` 目录结构
- 缓存：`docs/active/reports/_research_cache/`
