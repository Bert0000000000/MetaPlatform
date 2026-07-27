# PRD - APP-COPILOT（主 PRD）

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