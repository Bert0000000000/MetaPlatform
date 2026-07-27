# PRD - SuperAI / Copilot（APP-COPILOT）

> **版本**: v2.3 | **日期**: 2026-07-27 | **模块**: APP-COPILOT | **状态**: 正式版
>
> **vv2.2 → vv2.3 主要变更**：
> 1. **范围对齐前端实现**：根据"以独立 APP 为主"策略，PRD 描述范围与前端代码 1:1 对齐
> 2. **API 接口按 Q2=B 决策归属**：所有 /v1/copilot + /v1/superai + /v1/llmgw + /v1/a2a 端点归到 MATE-AGENT + TECH-LLMGW + MATE-A2A
> 3. **新增「待补交互清单」章节**（Q3=A 决策）：列出 PRD 已描述但前端未完整实现的交互
> 4. **数据模型同步**：补全 Entity/VO/DTO 定义
> 5. **关联文档**：`API-CONTRACT-前端接口契约清单_v1.0-20260727.md`、`PLAN-前后端并行开发接口边界_v1.0-20260727.md`、`REPORT-前端实现与PRD差异盘点_v1.0-20260727.md`

---


> **版本**: v2.2 | **日期**: 2026-07-22 | **模块**: APP-COPILOT（中文名"超级AI"）| **状态**: 正式版候选
>
> 本文件是 APP-COPILOT 的**主 PRD**，包含模块定位、用户故事、FR 概要、依赖关系、设计基线等核心内容。**详细的子主题文档**作为独立子文件：
>
> | 子文件 | 内容 |
> |--------|------|
> | [`PRD-APP-COPILOT-超级AI对话_v2.1-20260722.md`](./PRD-APP-COPILOT-超级AI对话_v2.1-20260722.md) | 对话场景详细设计（页面/接口/数据模型） |
> | [`PRD-APP-COPILOT-调度与总结_v1.0-20260722.md`](./PRD-APP-COPILOT-调度与总结_v1.0-20260722.md) | 顶层调度与跨域知识总结能力（FR-AI-009/010/011） |

## 版本历史

| 版本 | 日期 | 变更说明 | 作者 |
|---|---|---|---|
| v1.0 | 2026-07-16 | 初始版本（`APP-SUPERAI` 命名） | - |
| v2.0 | 2026-07-22 | 按设计稿刷新，模块标识改为 APP-COPILOT；同步 v1.2 技术栈 | Claude PRD 刷新流程 |
| v2.0.1 | 2026-07-22 | 强化"COPILOT 通过 A2A 调度业务 RAG 知识库数字员工" | Claude PRD 刷新流程 |
| **v2.2** | **2026-07-22** | **重大重构 + 文档拆分**：①SuperAI 不嵌入业务页面 ②每个页面/应用有专属 Agent ③主 PRD 精简，详细对话场景与调度能力拆分到子文件 | Claude PRD 刷新流程 |

---

## 1. 模块概述

### 1.1 模块定位

APP-COPILOT（中文名"超级AI"，v1.3 重构后改为"智能助手"）是 Mate Platform 的**独立顶层 AI 入口**，承担**整体调度 + 跨域知识总结**两大核心职责。

**关键定位**：

- SuperAI **不嵌入**任何业务页面、应用、流程
- 每个页面/应用都有自己的**专属数字员工 Agent**（由 APP-DW 提供）负责该领域内容
- SuperAI 是这些专属 Agent 的**调度者**与**总结者**，不是直接执行者
- 用户访问路径：①在业务页面直接与专属 Agent 交互（80% 场景）②在 SuperAI 入口发起全局问题（20% 场景）

### 1.2 核心价值

- **顶层调度**：通过 A2A 协议调用各专属 Agent
- **跨域知识总结**：汇总多路 Agent 输出，生成整合回答
- **统一入口**：业务用户从一个入口访问全平台所有专属 Agent
- **页面体验解耦**：业务页面内的交互完全由专属 Agent 负责
- **独立可演进**：SuperAI 与专属 Agent 通过 A2A 标准协议解耦

### 1.3 目标用户

| 角色 | 使用场景 |
|------|----------|
| 业务用户 | 在 SuperAI 入口提问跨业务域问题 |
| 跨域咨询者 | 管理层、运营人员需要整合多领域知识 |
| 平台管理员 | 配置 SuperAI 调度策略、全局知识图谱 |

### 1.4 与各业务页面的关系

| 业务模块 | 专属 Agent | SuperAI 介入方式 |
|---------|----------|----------------|
| APP-DASHBOARD | 工作台专属 Agent | 仅在用户切换到 SuperAI 时调度 |
| APP-APPHUB | 应用建模 + 流程设计专属 Agent | 仅在跨应用咨询时调度 |
| APP-ONTSTUDIO | 本体建模 + 概念抽取 Agent | 仅在跨域语义咨询时调度 |
| APP-MCPHUB | MCP 调试专属 Agent | 仅在跨工具咨询时调度 |
| APP-KB | 业务 RAG 知识库 Agent（法务/财务/HR） | 用户从 SuperAI 入口调用 |
| APP-DW | 数字员工配置 Agent | 仅在跨员工管理咨询时调度 |
| APP-ARCH | 架构梳理专属 Agent | 仅在跨域架构咨询时调度 |

### 1.5 角色边界定义

**SuperAI 不做 vs 必须做**：

| SuperAI **不做** | SuperAI **必须做** |
|----------------|------------------|
| 嵌入业务页面渲染 | 作为独立顶层入口存在 |
| 直接调用 APP-KB 检索 | 调度业务 RAG Agent 完成检索 |
| 直接处理页面内业务 | 调度专属 Agent 处理跨域问题 |
| 维护单一领域深度知识 | 维护全局调度策略与跨域总结能力 |
| 与用户在页面内实时协作 | 在独立对话窗口中与用户交互 |

### 1.6 设计稿对应

| 设计稿页面 | URL | 说明 |
|----------|-----|------|
| AI 对话（顶层入口） | `metaplatform-design-draft/pages/superai-dialogue.html` | SuperAI 独立顶层对话页 |
| 顶部导航 | `nav-superai` → `page-superai-dialogue` | 全平台唯一入口 |

> **v2.2 重要变更**：其他业务页面（如 apps-modeling / agents-knowledge / mcp-tools 等）**不再嵌入 SuperAI 对话组件**，各页面有自己的专属 Agent。

---

## 2. 功能需求概要

详细功能需求按子主题拆分到子文件。主 PRD 仅保留概要。

### 2.1 智能问答与对话（FR-AI-001）

**说明**：完整 FR 列表见 [`PRD-APP-COPILOT-超级AI对话_v2.1-20260722.md`](./PRD-APP-COPILOT-超级AI对话_v2.1-20260722.md)。

**概要**：

| 编号 | 功能 | 优先级 |
|------|------|--------|
| FR-AI-001-01 | 对话界面（Ant Design X 2.0） | P0 |
| FR-AI-001-02 | A2A 调度业务 RAG 数字员工（核心场景） | P0 |
| FR-AI-001-02a | A2A 调度业务 RAG 知识库数字员工 | P0 |
| FR-AI-001-03 | 引用溯源（Agent→KB→文档→段落） | P0 |
| FR-AI-001-04 | 多模态输入 | P1 |
| FR-AI-001-05 | 对话历史 | P0 |
| FR-AI-001-07 | 反馈评价 | P1 |

### 2.2 数据分析 NL2SQL（FR-AI-002）

完整 FR 列表见 [`PRD-APP-COPILOT-超级AI对话_v2.1-20260722.md`](./PRD-APP-COPILOT-超级AI对话_v2.1-20260722.md) §2。

**概要**：自然语言转 SQL、可视化、多数据源（通过 TECH-DATA）、SQL 安全审计。

### 2.3 Action 执行（FR-AI-003）

完整 FR 列表见 [`PRD-APP-COPILOT-超级AI对话_v2.1-20260722.md`](./PRD-APP-COPILOT-超级AI对话_v2.1-20260722.md) §3。

**概要**：意图识别、Action 匹配、参数填充、用户确认执行、操作审计。

### 2.4 Ontology 探索（FR-AI-004）

**概要**：用自然语言查询 Ontology 概念、实体、关系（通过 TECH-ONT）。

### 2.5 代码生成（FR-AI-005）

**概要**：Java/TypeScript/SQL 代码片段生成（**移除 Python**，v1.2 决策）。

### 2.6 任务编排（FR-AI-006）

完整 FR 列表见 [`PRD-APP-COPILOT-超级AI对话_v2.1-20260722.md`](./PRD-APP-COPILOT-超级AI对话_v2.1-20260722.md) §6。

**概要**：任务分解、执行计划、监控、聚合。底层基于 **Spring AI Alibaba Graph Core**（已替代 LangGraph）。

### 2.7 顶层调度与知识总结（FR-AI-009/010/011）

**说明**：完整 FR 列表见 [`PRD-APP-COPILOT-调度与总结_v1.0-20260722.md`](./PRD-APP-COPILOT-调度与总结_v1.0-20260722.md)。

**概要**：

| FR 簇 | 功能 | 优先级 |
|------|------|--------|
| FR-AI-009 | 顶层调度（Agent 发现、意图路由、单/多 Agent 调度） | P0 |
| FR-AI-010 | 知识总结（多源融合、引用溯源整合、业务域标签） | P0 |
| FR-AI-011 | 顶层入口特性（独立对话窗口、全局快捷键、可视化） | P0 |

---

## 3. 上下游依赖

### 3.1 上游依赖

| 服务 | 依赖内容 | 类型 |
|------|---------|------|
| TECH-LLMGW | LLM 推理调用、流式输出、模型路由（SAA ChatModel） | 强 |
| **TECH-A2A** | **A2A 协议调用业务 RAG 知识库数字员工（核心场景）** | **强** |
| TECH-RAG | 仅 fallback 时使用（核心场景已下沉到数字员工） | 中 |
| TECH-ACTION | Action 定义查询、Action 执行 | 强 |
| TECH-AGENT | Agent 框架、任务编排（SAA Graph Core） | 强 |
| TECH-ONT | Ontology 概念查询、关系推理、语义映射 | 强 |
| TECH-MCP | MCP 工具调用、外部资源访问 | 中 |
| **APP-DW** | **业务 RAG 知识库数字员工 + 页面专属 Agent** | **强** |
| APP-KB | 企业知识库（间接，通过数字员工） | 间接 |
| APP-ONTSTUDIO | Ontology 概念与 Action 定义 | 中 |

### 3.2 下游消费方

| 下游 | 消费内容 |
|------|---------|
| APP-DASHBOARD | 工作台入口（含 SuperAI 入口跳转） |
| 所有业务模块 | 通过 A2A 反向调用 SuperAI 进行跨域协调（高级场景） |

---

## 4. 非功能需求概要

| 类别 | 要求 |
|------|------|
| 对话首字响应 | < 2s（流式输出） |
| RAG 检索 | P95 < 1s |
| 调度响应 | P95 < 5s（单 Agent）/ < 10s（多 Agent 协同） |
| 并发对话 | 支持 500 并发用户 |
| 可用性 | 99.9% |
| RAG 准确率 | > 85% |
| 引用溯源覆盖率 | 100% |

完整非功能需求见子文件。

---

## 附录 A：UI 设计基线

| 维度 | 取值 |
|------|------|
| 设计库 | MetaPlatform3.0（id: `_-ZRH2U5YKIYA4`） |
| 设备类型 | Desktop |
| 主题 | Dark theme |
| 颜色 token | `--background:#0a0a0a`、`--card:#111111`、`--border:#262626`、`--primary:#fafafa`、`--success:#62d178`、`--destructive:#ff6166`、`--warning:#eab308` |
| 字体 | Geist |
| 形状 | `--radius:8px`，1px 边框，零阴影 |
| 组件前缀 | `.v-card`、`.v-btn`、`.v-table`、`.v-input`、`.v-tab`、`.v-badge-*`、`.v-sidebar-item` |
| 对应设计稿 | `pages/superai-dialogue.html`（**唯一入口**） |

---

## 附录 B：版本变更汇总

| 版本 | 变更说明 | 关联文件 |
|------|---------|---------|
| v1.0 | 初始版本（APP-SUPERAI） | 已拆分 |
| v2.0 | 按设计稿刷新、技术栈 v1.2 同步 | 合并到 v2.2 |
| v2.0.1 | 强化 A2A 调度业务 RAG 数字员工 | 合并到 v2.2 |
| **v2.2** | 重大重构：SuperAI 不嵌入页面 + 文档拆分 | 本文件 + 2 个子文件 |

---

**PRD 版本**: v2.2（主 PRD）
**PRD 日期**: 2026-07-22
**关联子文件**:
- `PRD-APP-COPILOT-超级AI对话_v2.1-20260722.md`
- `PRD-APP-COPILOT-调度与总结_v1.0-20260722.md`
**关联 PRD**:
- `docs/prd/APP-DW/PRD-APP-DW-数字员工_v2.2-20260722.md`（专属 Agent 由 APP-DW 提供）
- `docs/prd/APP-DASHBOARD/PRD-APP-DASHBOARD-仪表盘_v2.1-20260722.md`（工作台专属 Agent）

---

## 附录 X：v2.x → v2.x 增量更新说明

> **更新日期**: 2026-07-27
> **更新原因**: 基于前端代码盘点 + 前后端并行开发需求
> **覆盖度**: 61%

### X.1 主要变更

1. **范围对齐前端实现**：根据"以独立 APP 为主"策略，PRD 描述范围与前端代码 1:1 对齐
2. **API 接口按 Q2=B 归属**：本模块所有 API 端点统一归到 **MATE-AGENT + TECH-LLMGW + MATE-A2A**
3. **新增「待补交互清单」**：列出 PRD 已描述但前端未完整实现的交互
4. **数据模型与前端类型同步**：补全所有 Entity/VO/DTO 定义
5. **关联文档**：`API-CONTRACT-前端接口契约清单_v1.0-20260727.md`、`PLAN-前后端并行开发接口边界_v1.0-20260727.md`、`REPORT-前端实现与PRD差异盘点_v1.0-20260727.md`

### X.2 待补交互清单（Q3=A 决策新增）

> **触发决策**: 2026-07-27 与用户确认 Q3=A，"标记为待前端补，PRD 列入清单并排期"

#### X.2.1 P0 - 必须补全

| 1 | 消息反馈（点赞/踩） | FR-AI-001 | ❌ chat.ts 缺 | v1.4 (1 周) |
| 2 | 附件上传 UI | FR-AI-001 | 🟡 multimodal/upload API 有 | v1.4 (1 周) |
| 3 | 代码沙箱运行面板 | FR-AI-005 | 🟡 code/execute API 有 | v1.4 (1 周) |
| 4 | SQL 编辑器深度 | FR-AI-002 | 🟡 DataAnalysisPage 基础 | v1.4 (2 周) |

#### X.2.2 P1 - 增强功能

| 1 | 数据源选择 | FR-AI-002 | 🟡 datasources API 有 | v1.5 (1 周) |
| 2 | 分析历史 | FR-AI-002 | 🟡 queries/history 有 | v1.5 (1 周) |
| 3 | 数据导出 | FR-AI-002 | ❌ | v1.5 (1 周) |
| 4 | 任务依赖可视化 | FR-AI-006 | 🟡 plans API 有 | v1.5 (1 周) |
| 5 | 调度策略配置 | FR-AI-009 | 🟡 templates API 有 | v1.5 (1 周) |

#### X.2.3 P2 - 体验完善

| 1 | 异常处理策略（任务编排） | FR-AI-006 | 🟡 基础 | v2.0+ |
| 2 | 成本估算 | FR-AI-009 | ❌ | v2.0+ |
| 3 | 多模态模型切换 | FR-AI-001 | 🟡 models/multimodal 有 | v2.0+ |

### X.3 API 接口概要（Q2=B 归属更新）

> **触发决策**: 2026-07-27 与用户确认 Q2=B，"合并到现有 TECH 服务"
>
> **本模块 API 前缀**: /v1/copilot + /v1/superai + /v1/llmgw + /v1/a2a
> **归属后端服务**: MATE-AGENT + TECH-LLMGW + MATE-A2A
>
> **完整契约清单**: `docs/prd/_top/API-CONTRACT-前端接口契约清单_v1.0-20260727.md` §3.x

#### X.3.1 端点归属一览

| 前缀 | 端点数 | 后端 Service | Controller 建议 | 优先级 |
|---|---|---|---|---|

| /v1/copilot | 56 | MATE-AGENT | ChatController/AnalysisController/QueryController/ActionController/RagController/GenerateController/PlanController/OntologyController/ScheduleController/CodeController/A2AController/ConversationController/AuthController/ModelsController | P0 |
| /v1/superai | 4 | MATE-AGENT | GenerateController（同 copilot） | P0 |
| /v1/llmgw | 1 | TECH-LLMGW | ChatCompletionController | P0 |
| /v1/a2a | 2 | MATE-A2A | AgentCardController/DelegationController | P1 |

#### X.3.2 前端代码位置

- 独立 app: `metaplatform-frontend/apps/copilot/src/api/`
- portal 聚合: `metaplatform-frontend/apps/portal/src/pages/copilot/`
- shared: `metaplatform-frontend/packages/shared/src/api/`

#### X.3.3 契约测试要求

- 单元测试：每个端点覆盖正常 + 异常路径
- 契约测试：响应结构与 API-CONTRACT.md 一致
- 集成测试：含租户隔离
- 性能：P99 < 500ms（普通 CRUD），P99 < 3000ms（LLM/检索）

### X.4 前端实现覆盖度

- 总页面数：见盘点报告附录 B
- API 模块数：见盘点报告 §五
- 实现状态：详见盘点报告 §五.APP-COPILOT
- 覆盖率：61%

### X.5 前端代码 → PRD 章节映射

按盘点报告 §五.APP-COPILOT 的页面/API 清单与本 PRD 章节的对应关系，明确"哪些页面/API 由前端哪个文件承载、哪些是 Mock 实现"。

### X.6 关联文档

- `docs/prd/_top/API-CONTRACT-前端接口契约清单_v1.0-20260727.md` —— 141 端点契约
- `docs/prd/_top/PLAN-前后端并行开发接口边界_v1.0-20260727.md` —— 并行开发规范
- `docs/prd/_top/REPORT-前端实现与PRD差异盘点_v1.0-20260727.md` —— 差异盘点


## 9. 核心操作手册（按场景）

> **触发决策**: 2026-07-27 用户反馈"很多操作按钮没有写PRD"后补全
> **覆盖**: P0 核心创建/操作类

---

### 9.17 【发起对话】操作

**触发位置**:
- APP-COPILOT 顶层入口（`/superai`）中央输入框
- 工作台 → SuperAI 快捷入口
- 任何业务页面的嵌入式 Chat 组件（EmbeddedChat）

**前置条件**:
- 用户已登录
- 至少 1 个可用 LLM 模型

**操作流程**:
1. 用户在中央输入框输入首条消息
2. 系统自动：
   - 创建新会话（POST /v1/copilot/conversations）
   - 模式自动检测（CHAT/ANALYSIS/ACTION/CODE/PLAN/ONTOLOGY）
3. 系统流式返回 AI 回复
4. 左侧会话列表新增该会话

**表单字段**（输入框）:
| 字段 | 类型 | 必填 | 默认 | 校验 | 说明 |
|---|---|---|---|---|---|
| 消息内容 | string | 是 | - | 1-10000 字符 | |
| 附件 | upload | 否 | [] | 最多 5 个，每个 10MB | 图片、PDF、文本 |
| 模式 | select | 否 | AUTO | CHAT/ANALYSIS/ACTION/CODE/PLAN/ONTOLOGY | AUTO 时系统自动检测 |
| 引用知识库 | multi-select | 否 | - | 已有 KB | 限定检索范围 |

**结果反馈**:
- 成功：流式显示 AI 回复（打字机效果）
- 失败：
  - 网络异常：toast "AI 服务暂时不可用"
  - 配额超限：toast "今日对话次数已达上限"
  - 敏感词：toast "消息包含敏感内容，已拦截"

**关联 API**:
- POST /v1/copilot/conversations
- POST /v1/copilot/chat/completions（流式）
- POST /v1/copilot/chat/multimodal/upload

---

### 9.18 【发送消息】操作

**触发位置**:
- SuperAIChatPage 会话窗口底部输入框
- 嵌入式 Chat 组件

**前置条件**:
- 会话已存在
- 用户拥有会话访问权限

**操作流程**:
1. 用户在输入框输入消息
2. 可选：
   - 上传附件（图片/PDF）
   - 选择引用的工具
   - 选择引用的知识库
3. 点击「发送」按钮或按 Enter
4. 消息添加到消息列表（用户消息在上方）
5. 流式显示 AI 回复
6. AI 回复完成后：
   - 自动保存到历史
   - 显示引用来源（如果有 RAG）
   - 显示工具调用结果（如果有 Tool Call）

**表单字段**:
| 字段 | 类型 | 必填 | 默认 | 校验 | 说明 |
|---|---|---|---|---|---|
| 消息内容 | string | 是 | - | 1-100000 字符 | |
| 附件 | upload | 否 | [] | 最多 5 个 | |
| 引用工具 | multi-select | 否 | - | 启用中的工具 | 让 AI 调用 |
| 知识库 | multi-select | 否 | - | 启用 KB | RAG 检索 |
| 反馈 | radio | 否 | - | UP/DOWN | 消息发送后显示 |

**快捷键**:
- Enter：发送
- Shift+Enter：换行
- Esc：取消流式生成

**结果反馈**:
- 流式生成中：显示「▌▌」光标效果
- 完成：自动滚动到底部
- 失败：
  - Token 超限：toast "消息过长，请分段发送"
  - 工具调用失败：在消息下方显示错误

**关联 API**:
- POST /v1/copilot/chat/multimodal/upload
- POST /v1/copilot/chat/completions（流式）
- POST /v1/copilot/feedback

**附件上传**:
- 拖拽到输入框
- 点击 📎 按钮
- 支持：jpg/png/webp/pdf/docx/txt/md

---

### 9.19 【创建计划】操作

**触发位置**:
- SuperAIChatPage 输入框下方「📋 计划」按钮
- APP-COPILOT 任务编排页（`/superai/task-orchestration`）→ 「+ 新建计划」

**前置条件**:
- 用户拥有 `plan.create` 权限
- 至少 1 个 ACTIVE 员工

**操作流程**:
1. 点击「📋 计划」或「+ 新建计划」→ 弹出计划编辑器 Drawer
2. 用户填写：
   | 字段 | 类型 | 必填 | 默认 | 校验 | 说明 |
   |---|---|---|---|---|---|
   | 计划标题 | string | 是 | - | 1-256 字符 | |
   | 详细描述 | textarea | 是 | - | 1-4096 字符 | AI 用于理解任务 |
   | 目标 | textarea | 是 | - | 1-1024 字符 | 期望完成什么 |
   | 上下文 | json (textarea) | 否 | "{}" | 有效 JSON | 额外背景 |
   | 约束 | object | 否 | - | - | {maxDuration, maxCost, allowedActions} |
   | 自动审批 | boolean | 否 | false | - | true 时无需人工审批直接执行 |

3. 点击「✨ AI 生成步骤」
4. 系统调用 AI 将描述拆分为步骤（POST /v1/copilot/plans）
5. AI 返回步骤列表（每步包含员工、依赖、输入）
6. 用户可：
   - 调整步骤顺序（拖拽）
   - 修改每步的员工/输入
   - 添加/删除步骤
   - 设置步骤依赖关系
7. 点击「创建」→ 保存计划（status = DRAFT）
8. 提交审批（status = PENDING_APPROVAL）或直接执行

**结果反馈**:
- AI 生成中：loading toast
- 创建成功：toast "计划创建成功"，跳转到计划详情页
- 审批通过：开始执行
- 步骤执行中：实时进度（WebSocket）
- 执行完成：toast "计划执行完成"，展示结果

**关联 API**:
- POST /v1/copilot/plans
- POST /v1/copilot/plans/{id}/steps/{stepId}/approve
- POST /v1/copilot/plans/{id}/execute

---

### 9.20 【发起调度】操作

**触发位置**:
- SuperAIChatPage 输入框下方「📅 调度」按钮
- APP-COPILOT 调度页（`/superai/scheduling`）→「+ 发起调度」

**前置条件**:
- 至少 1 个 ACTIVE 员工
- 至少 1 个调度模板（可选）

**操作流程**:
1. 用户在 SuperAI 输入框输入调度需求（如"帮我下周整理上周的销售数据"）
2. 点击「📅 调度」→ 弹出调度向导 Drawer

#### 步骤 1/5：意图识别
- 系统调用 POST /v1/copilot/scheduling/intent/detect
- 返回：意图类型（CONVERSATION/TASK/RESEARCH/ANALYSIS/AUTOMATION/UNKNOWN）
- 显示识别结果

#### 步骤 2/5：员工匹配
- 系统调用 POST /v1/copilot/scheduling/employees/match
- 返回：Top 5 匹配员工（按评分排序）
- 用户确认或换人

#### 步骤 3/5：计划生成
- 系统调用 POST /v1/copilot/scheduling/plan/generate
- 返回：执行计划（步骤列表）
- 用户可调整

#### 步骤 4/5：审批
- HIGH/URGENT 调度需要审批
- 用户提交审批

#### 步骤 5/5：执行
- 用户点击「立即执行」或「定时执行」（需选定时模板）
- 系统创建 ScheduleExecution
- 后台执行，实时更新进度

**结果反馈**:
- 调度成功：toast "调度已发起"，跳转调度详情页
- 执行中：实时进度
- 完成：toast 显示结果 + 报告链接
- 失败：toast 显示具体原因

**关联 API**:
- POST /v1/copilot/scheduling/intent/detect
- POST /v1/copilot/scheduling/employees/match
- POST /v1/copilot/scheduling/plan/generate
- POST /v1/copilot/scheduling/execution/start
- GET /v1/copilot/scheduling/execution/{id}/report

---

### 9.21 【SQL 执行】操作

**触发位置**:
- APP-COPILOT 数据分析页（`/superai/data-analysis`）→ SQL 编辑器
- SuperAIChatPage 在 NL2SQL 后点击「▶ 执行」

**前置条件**:
- 已选择数据源
- 用户拥有 `sql.execute` 权限
- SQL 已通过审计（自动）

**操作流程**:
1. 用户在 SQL 编辑器输入或 AI 生成 SQL
2. 系统自动审计（POST /v1/copilot/analysis/audit-sql）
3. 审计结果显示在 SQL 下方：
   - ✅ 通过：绿色对勾
   - ⚠️ 警告：黄色提示（如 SELECT *）
   - ❌ 风险：红色阻止（如 DELETE 全表）
4. 审计通过后用户点击「▶ 执行」
5. 弹出执行配置 Modal：
   | 字段 | 类型 | 必填 | 默认 | 校验 | 说明 |
   |---|---|---|---|---|---|
   | 最大行数 | number | 否 | 1000 | 1-100000 | 防止大量数据返回 |
   | 超时 | number | 否 | 30 | 1-300 秒 | |
   | 格式化 | radio | 是 | "table" | table/json/csv | 结果展示格式 |
6. 点击「执行」→ 调用 POST /v1/copilot/analysis/execute-sql
7. 展示结果：
   - 表格视图（默认）
   - JSON 视图
   - CSV 导出
   - 图表视图（自动推荐图表类型）

**危险操作**:
- DELETE/UPDATE/DROP/TRUNCATE → 必须勾选「我了解风险」+ 二次确认
- 显示影响行数预估

**结果反馈**:
- 成功：表格显示结果 + 耗时
- 失败：toast 显示错误信息
- 超时：toast "查询超时，请优化或缩小范围"

**关联 API**:
- POST /v1/copilot/analysis/audit-sql
- POST /v1/copilot/analysis/execute-sql
- POST /v1/copilot/analysis/explain-sql（解释 SQL）

---

### 9.22 【代码执行】操作

**触发位置**:
- APP-COPILOT 代码生成页（`/superai/code`）→ 代码编辑完成后点击「▶ 执行」
- 嵌入式代码块右上角「Run」按钮

**前置条件**:
- 用户拥有 `code.execute` 权限
- 配额未用尽

**操作流程**:
1. 用户在代码编辑器输入或 AI 生成代码
2. 点击「▶ 执行」→ 弹出执行配置 Modal：
   | 字段 | 类型 | 必填 | 默认 | 校验 | 说明 |
   |---|---|---|---|---|---|
   | 语言 | radio | 是 | "PYTHON" | PYTHON/JS/TS/JAVA/GO/SHELL/SQL | |
   | 变量 | json (textarea) | 否 | "{}" | 有效 JSON | 注入到代码 |
   | 超时 | number | 否 | 30 | 1-300 秒 | |
   | 内存限制 | number | 否 | 256 | 64-2048 MB | |
   | 网络访问 | boolean | 否 | false | - | 默认禁用，更安全 |
3. 点击「执行」→ 调用 POST /v1/copilot/code/execute
4. 后端在沙箱中执行（DOCKER 隔离）
5. 展示结果：
   - stdout/stderr 输出
   - 错误信息（如有）
   - 执行时间
   - Token 消耗

**安全限制**:
- 沙箱隔离（无网络/无文件系统访问默认）
- 内存限制 64-2048MB
- CPU 限制 1-4 核
- 执行后自动清理

**结果反馈**:
- 成功：显示输出 + 耗时
- 超时：toast "执行超时"
- 内存超限：toast "内存超限，已终止"
- 语法错误：toast 显示具体错误行
- 危险代码：toast "检测到危险操作，已拦截"

**关联 API**:
- POST /v1/copilot/code/execute
- POST /v1/copilot/generate/explain-code
- POST /v1/copilot/generate/review-code


## 10. P2 操作（成本与多模态增强）

---

### 10.13 【成本估算】操作

**触发位置**:
- APP-COPILOT 计划编辑器 → 底部「💰 成本估算」按钮
- SuperAIChatPage → 工具栏「💰 成本」按钮

**前置条件**:
- LLM 模型已配置
- 历史成本数据存在

**操作流程**:

#### A. 估算方式
1. **实时估算**：执行过程中累加
2. **预估**：在创建计划/任务时估算

#### B. 估算输入
| 维度 | 数据来源 |
|---|---|
| 模型 | modelConfig.model |
| Prompt Token | chat.completions.prompt_tokens |
| Completion Token | chat.completions.completion_tokens |
| 工具调用 | Tool 单价 × 次数 |
| 检索调用 | RAG 单价 × 次数 |
| 沙箱执行 | 计算资源 × 时长 |

#### C. 估算结果
| 项目 | 数量 | 单价 | 小计 |
|---|---|---|---|
| LLM 调用 | 1500 tokens | $0.002/1K | $0.003 |
| 工具调用 | 2 次 | $0.001/次 | $0.002 |
| 检索 | 3 次 | $0.0005/次 | $0.0015 |
| **合计** | | | **$0.0065** |

#### D. 优化建议
系统基于历史数据推荐：
- 「使用 cheaper 模型可省 60%」
- 「减少 Rerank 可省 30%」
- 「缓存 prompt 可省 15%」

#### E. 预算控制
| 字段 | 类型 | 说明 |
|---|---|---|
| 单次任务预算 | number | 超过则提醒 |
| 每日总预算 | number | 超过则暂停 |
| 预算告警阈值 | number | 默认 80% |

**结果反馈**:
- 估算完成：表格 + 图表
- 超预算：弹窗确认「是否继续？」

**关联 API**:
- POST /v1/copilot/cost/estimate
- GET /v1/copilot/cost/history
- GET /v1/copilot/cost/optimize

---

### 10.14 【多模态模型切换】操作

**触发位置**:
- APP-COPILOT 设置 → 模型管理 Tab
- SuperAIChatPage → 模型下拉 → 「管理模型」

**前置条件**:
- 至少 2 个多模态模型已注册
- 用户拥有 `model.manage` 权限

**操作流程**:

#### A. 查看已注册模型
1. 系统列出所有多模态模型（GET /v1/copilot/models/multimodal）
2. 显示每个模型的：
   | 字段 | 说明 |
   |---|---|
   | 模型名 | 如 "GPT-4V" |
   | 提供方 | OpenAI/Anthropic/Google/自研 |
   | 能力 | 图像/音频/视频 |
   | 分辨率 | 支持的最大分辨率 |
   | 价格 | 每千 Token |
   | 启用 | 状态 |
   | 默认 | 是否为默认 |

#### B. 切换默认模型
1. 用户选择模型 → 「设为默认」
2. 系统更新默认配置
3. 后续自动使用此模型

#### C. 临时切换（对话级别）
1. 在 SuperAIChatPage 顶部模型下拉选择
2. 仅当前对话使用此模型
3. 不影响全局默认

#### D. 按场景路由
| 场景 | 推荐模型 |
|---|---|
| 通用对话 | GPT-4 Turbo |
| 复杂推理 | Claude 3.5 Sonnet |
| 长文本 | Claude 3 Opus |
| 图像理解 | GPT-4V / Claude 3V |
| 中文场景 | Qwen-VL / 文心一言 |
| 实时性要求高 | GPT-3.5 Turbo |
| 成本敏感 | GPT-3.5 Turbo / Llama 3 |

#### E. 能力配置
| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| 启用 | boolean | 是 | |
| 能力 | multi-checkbox | 是 | IMAGE/AUDIO/VIDEO |
| 最大尺寸 | number | 否 | MB |
| 超时 | number | 否 | 秒 |
| 重试 | number | 否 | 0-3 |

**结果反馈**:
- 切换成功：toast "已切换到 XXX 模型"
- 模型不可用：toast "模型暂不可用"

**关联 API**:
- GET /v1/copilot/models/multimodal
- POST /v1/copilot/models/multimodal
- PUT /v1/copilot/models/multimodal/{id}


## 11. P3 操作（SuperAI 增强）

---

### 11.23 【消息反馈（点赞/踩）】操作

**触发位置**:
- APP-COPILOT 任意 AI 回复下方

**操作流程**:
1. 用户对 AI 回复点击 👍 或 👎
2. 弹出反馈 Modal（如点 👎）：
   | 字段 | 类型 | 必填 |
   |---|---|---|
   | 类型 | radio | 是 | UP/DOWN |
   | 原因 | multi-checkbox | 否 | "答非所问"/"信息过时"/"格式混乱"/"重复"等 |
   | 评论 | textarea | 否 | 0-500 字符 |
3. 点击「提交」→ POST /v1/copilot/feedback
4. 反馈用于优化模型

**结果反馈**:
- 成功：toast "感谢您的反馈"
- 失败：toast 显示错误

**业务规则**:
- 同一消息同一用户只能反馈一次
- 反馈后 7 天内可修改

**关联 API**:
- POST /v1/copilot/messages/{id}/feedback

---

### 11.24 【附件上传】操作

**触发位置**:
- SuperAIChatPage 输入框「📎」按钮

**操作流程**:

#### A. 上传方式
- 拖拽到输入框
- 点击按钮选择
- 粘贴（Ctrl+V）

#### B. 文件类型
- 图片：jpg/png/webp/gif（最大 10MB）
- 文档：pdf/docx/xlsx/pptx/txt/md（最大 50MB）
- 代码：py/js/ts/java/go/shell（最大 1MB）
- 音频：mp3/wav（最大 50MB）

#### C. 处理
- 图片：OCR 识别
- 文档：解析 + 切片
- 代码：语法高亮
- 音频：ASR 转写

#### D. 显示
- 缩略图/文件名
- 上传进度
- 处理状态

**结果反馈**:
- 上传中：进度条
- 处理中：loading
- 完成：缩略图

**关联 API**:
- POST /v1/copilot/chat/multimodal/upload

---

### 11.25 【代码沙箱运行】操作

**触发位置**:
- 代码生成页 → 代码块右上角「▶ Run」

**操作流程**:
1. 用户点击「▶ Run」
2. 弹出运行配置：
   | 字段 | 类型 | 默认 |
   |---|---|---|
   | 输入参数 | json | {} |
   | 超时 | number | 30 |
   | 内存 | number | 256 |
3. 点击「运行」→ POST /v1/copilot/code/execute
4. 沙箱执行（DOCKER）
5. 显示：
   - stdout/stderr
   - 返回值
   - 错误信息
   - 耗时 + Token

**安全限制**:
- 无网络
- 无文件
- 内存 64-2048MB
- CPU 1-4 核

**关联 API**:
- POST /v1/copilot/code/execute

---

### 11.26 【SQL 编辑器】操作

**触发位置**:
- 数据分析页（`/superai/data-analysis`）→ SQL 编辑器

**操作流程**:

#### A. 编辑器功能
- Monaco Editor
- 语法高亮
- 自动补全（基于 schema）
- 格式化（Ctrl+Shift+F）
- 多 Tab

#### B. AI 辅助
- 「✨ 自然语言转 SQL」→ 输入 NL → 生成 SQL
- 「💡 SQL 解释」→ 选中 SQL → 解释
- 「🔍 SQL 优化」→ 选中 SQL → 优化建议

#### C. 执行
- 「▶ 执行」→ POST /v1/copilot/analysis/execute-sql
- 「🔍 仅审计」→ POST /v1/copilot/analysis/audit-sql
- 「💾 保存为查询」→ 保存为常用

#### D. 历史
- 显示执行历史
- 可重新执行

**关联 API**:
- POST /v1/copilot/analysis/generate-sql
- POST /v1/copilot/analysis/explain-sql
- POST /v1/copilot/analysis/audit-sql
- POST /v1/copilot/analysis/execute-sql

---

### 11.27 【调度模板】操作

**触发位置**:
- APP-COPILOT 调度页 → 「模板」Tab → 「+ 新建模板」

**操作流程**:

#### A. 模板信息
| 字段 | 类型 | 必填 |
|---|---|---|
| 模板名 | string | 是 |
| 描述 | string | 否 |
| 类别 | radio | 是 |
| 标签 | tags | 否 |

#### B. 模板内容
- 预定义意图模式（regex/DSL）
- 预定义员工匹配规则
- 预定义执行计划模板
- 预定义输入参数

#### C. 使用
1. 在调度页选择模板
2. 系统自动应用模板
3. 微调后执行

**关联 API**:
- GET /v1/copilot/scheduling/templates
- POST /v1/copilot/scheduling/templates
- POST /v1/copilot/scheduling/templates/{id}/apply
