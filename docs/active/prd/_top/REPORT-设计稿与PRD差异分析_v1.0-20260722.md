# 设计稿 vs PRD 差异分析报告

> **版本**: v1.0 | **日期**: 2026-07-22 | **范围**: PRD v1.0 → v2.0 刷新依据
> **设计稿来源**: `metaplatform-design-draft/`（MetaPlatform3.0 设计库，49 个 HTML 页面）
> **PRD 范围**: `docs/prd/APP-*/`（10 份 PRD v1.0-20260716/20260721）

---

## 1. 报告目的

本次差异分析目的是为 PRD v2.0 刷新提供**唯一可追溯的设计基准**，确保：

1. **页面覆盖率 100%**：设计稿每个 HTML 页面在 PRD 中能找到对应的功能章节
2. **新增模块识别**：从设计稿中识别出 PRD 缺失的新模块（如知识库）
3. **既有模块变更点**：明确每个 APP PRD 需要新增/调整/废弃的章节
4. **设计语言一致性**：将设计稿中的 UI 元数据（颜色/字体/组件语言）写入 PRD 附录

---

## 2. 设计稿总览

### 2.1 设计系统基线（MetaPlatform3.0）

| 维度 | 取值 |
|------|------|
| 设计库标识 | `_-ZRH2U5YKIYA4`（version 1） |
| 设备类型 | Desktop |
| **颜色系统** | **Dark theme**：background `#0a0a0a`、foreground `#fafafa`、card `#111111`、border `#262626`、muted `#1a1a1a`、primary `#fafafa`、destructive `#ff6166`、success `#62d178`、warning `#eab308` |
| **形状系统** | `--radius: 8px`，1px 边框，**零阴影** |
| **字体系统** | Geist：`--font-sans:'Geist',ui-sans-serif,system-ui,sans-serif` |
| 组件语言 | `.v-card`、`.v-btn`、`.v-btn-primary`、`.v-table`、`.v-input`、`.v-tab`、`.v-badge`（success/warning/error/neutral）、`.v-eyebrow`、`.v-value`、`.v-meta`、`.v-divider`、`.v-sidebar-item` |
| 表面与深度 | **零阴影**，仅用背景深度分层：`#0a0a0a > #111111 > #1a1a1a` |
| 交互语气 | 微妙 hover 背景色，无阴影过渡 |

### 2.2 页面清单（按 group 排序，共 43 个编排页面 + 6 个未编排页面）

| Group | 模块 | 页面数 | 页面清单 |
|------|------|------|------|
| 0 | **APP-DASHBOARD**（工作台） | 6 | dashboard、dashboard-myapps、dashboard-myagents、dashboard-messages、dashboard-portal、dashboard-deliverables |
| 1 | **APP-COPILOT**（超级AI） | 1 | superai-dialogue |
| 2 | **APP-ARCH**（架构中心） | 5 | arch-business、arch-app、arch-data、arch-tech、arch-governance |
| 3 | **APP-APPHUB**（应用中心） | 8 | apps-list、apps-detail、apps-modeling、apps-formdesigner、apps-processdesigner、apps-config、apps-publish、apps-version |
| 4 | **APP-ONTSTUDIO**（本体论引擎） | 4 | ontology-modeling、ontology-datacenter、ontology-action、ontology-graph |
| 5 | **APP-KB**（知识库，**新增**） | 1 | ontology-knowledgebase（设计稿标记为 page-knowledge-base） |
| 6 | **APP-MCPHUB**（MCP 服务中心） | 7 | mcp-tools、mcp-server、mcp-client、mcp-debugger、mcp-permissions、mcp-external、mcp-audit |
| 7 | **APP-DW**（数字员工） | 6 | agents-list、agents-detail、agents-knowledge、agents-tasks、agents-collab、agents-evaluation |
| 8 | **后台管理**（**合并入 APP-DASHBOARD**） | 5 | admin-users、admin-permissions、admin-org、admin-logs、admin-config |

### 2.3 未编排但 HTML 已存在的页面（6 个）

| 页面文件 | 推测归属 | 处理 |
|----------|---------|------|
| `apps-create.html` | APP-APPHUB 创建向导 | v2.0 在"创建应用"章节补描述 |
| `apps-forms-flows.html` | APP-APPHUB 表单+流程联动 | v2.0 新增章节"表单与流程绑定视图" |
| `ontology-action-flow.html` | APP-ONTSTUDIO Action 流程 | v2.0 在"服务编排"章节补描述 |
| `ontology-modeling-detail.html` | APP-ONTSTUDIO 建模详情 | v2.0 在"概念详情"章节补描述 |
| `ontology-graph-detail.html` | APP-ONTSTUDIO 图谱详情 | v2.0 在"图谱浏览"章节补描述 |
| `ontology-graph-relation.html` | APP-ONTSTUDIO 关系视图 | v2.0 新增章节"图谱关系视图" |

辅助页面（不归属业务 PRD）：`login.html`、`components.html`、`dashboard.html`（首页导航）、`admin-operations.html`（运营监控）。

---

## 3. 既有 PRD 覆盖度评估

### 3.1 APP-DASHBOARD（仪表盘）

| 设计稿页面 | v1.0 PRD 章节 | v2.0 调整 |
|----------|-------------|---------|
| dashboard | 3.1 全局工作台 | 保留 |
| dashboard-myapps | （**缺失**） | **新增**：3.1.6 我的应用快捷入口 |
| dashboard-myagents | （**缺失**） | **新增**：3.1.7 我的数字员工快捷入口 |
| dashboard-messages | 3.4 消息通知 | 保留 |
| dashboard-portal | （**缺失**） | **新增**：3.7 门户聚合视图 |
| dashboard-deliverables | 3.6 历史交付材料 | 保留并扩展 |
| admin-users ~ admin-config | （**整组缺失**） | **新增**：3.8 后台管理（用户/权限/组织/日志/配置） |

**v2.0 重点**：仪表盘从"个人门户"扩展为"个人门户 + 后台管理"双形态，新增 portal 门户页与后台管理 5 个子模块。

### 3.2 APP-COPILOT（超级AI）

| 设计稿页面 | v1.0 PRD 章节 | v2.0 调整 |
|----------|-------------|---------|
| superai-dialogue | 通用版 1.6 + 详细版各章 | 主要润色 + 移除旧 `APP-SUPERAI` 命名 |

**v2.0 重点**：
- 命名统一为 `APP-COPILOT`（模块中文名仍沿用"超级AI"直至 v1.3 重命名）
- 通用版（18KB）升级为 v2.0 总览，保留全部功能点描述
- 详细版（102KB）保留"实现状态盘点"特色，FR 编号重新对齐到 v2.0

### 3.3 APP-APPHUB（应用中心）

| 设计稿页面 | v1.0 PRD 章节 | v2.0 调整 |
|----------|-------------|---------|
| apps-list | 4.1 应用管理 | 保留 |
| apps-create | 4.1.2 创建应用 | **细化**：拆为"空白创建"与"模板创建"两子节 |
| apps-detail | 4.1.5 应用详情 | 保留 |
| apps-modeling | （**缺失**） | **新增**：4.10 数据建模（独立大节） |
| apps-formdesigner | 4.3 表单设计器 | 保留 |
| apps-processdesigner | 4.4 流程设计器 | 保留 |
| apps-forms-flows | （**缺失**） | **新增**：4.11 表单与流程联动视图 |
| apps-config | 4.1.3 编辑应用信息 | 拆分为独立"应用配置"章节 |
| apps-publish | 4.6 应用发布 | 保留 |
| apps-version | 4.7 版本管理 | 保留 |

**v2.0 重点**：新增"数据建模"独立章节（设计稿首次将数据建模列为应用中心核心能力），新增"表单+流程绑定视图"章节。

### 3.4 APP-ARCH（架构中心）

| 设计稿页面 | v1.0 PRD 章节 | v2.0 调整 |
|----------|-------------|---------|
| arch-business | 3.1 业务架构管理 | 保留 |
| arch-app | 3.2 应用架构管理 | 保留 |
| arch-data | 3.3 数据架构管理 | 保留 |
| arch-tech | 3.4 技术架构管理 | 保留 |
| arch-governance | 3.5 架构治理 | 保留 |

**v2.0 重点**：整体结构无变化，主要修订：
- 添加设计系统元数据附录
- 调整"技术栈清单"中 Python 相关条目（v1.2 已统一为 Java 25）
- "Ontology 联动"章节强化与 APP-ONTSTUDIO 的解耦描述

### 3.5 APP-DW（数字员工）

| 设计稿页面 | v1.0 PRD 章节 | v2.0 调整 |
|----------|-------------|---------|
| agents-list | 3.1 员工管理 | 保留 |
| agents-detail | 3.1.7 员工详情 | 保留 |
| agents-knowledge | 3.3 知识提炼 | 保留 |
| agents-tasks | 3.4 任务管理 | 保留 |
| agents-collab | 3.7 多员工协作 | 保留 |
| agents-evaluation | 3.6 效果评估 | 保留 |

**v2.0 重点**：结构调整小，主要修订：
- 删除 Python 相关依赖描述，全部切换为 Spring AI Alibaba + Java 25
- 与 TECH-AGENT 强依赖关系明确化（统一到 SAA Graph Core）
- 评价模型升级到 v1.2 评测指标（RAG 准确率 ≥85%、意图准确率 ≥90%）

### 3.6 APP-MCPHUB（MCP 服务中心）

| 设计稿页面 | v1.0 PRD 章节 | v2.0 调整 |
|----------|-------------|---------|
| mcp-tools | 3.3 工具注册中心 | 保留 |
| mcp-server | 3.1 MCP Server 管理 | 保留 |
| mcp-client | 3.2 MCP Client 管理 | 保留 |
| mcp-debugger | 3.4 MCP 调试器 | 保留 |
| mcp-permissions | 3.6 权限控制 | 保留 |
| mcp-external | 3.7 外部应用对接 | 保留 |
| mcp-audit | 3.5 调用审计 | 保留 |

**v2.0 重点**：结构调整小，主要修订：
- MCP Server 注册基线由 Nacos 2.x 升级到 **Nacos 3.0+**（v1.2 决策）
- 客户端 SDK 描述从 LangChain 切换到 **Spring AI Alibaba Nacos MCP Starter**
- IAM 鉴权路径细化（/api/v1/mcp/** → TECH-IAM OAuth2 网关）

### 3.7 APP-ONTSTUDIO（本体论引擎）

| 设计稿页面 | v1.0 PRD 章节 | v2.0 调整 |
|----------|-------------|---------|
| ontology-modeling | 3.1 本体论管理 | 保留 |
| ontology-modeling-detail | 3.1.1.5 概念详情 | **细化**：补"建模详情视图"描述 |
| ontology-datacenter | 3.2 数据中心 | 保留 |
| ontology-action | 3.3 Action 编排 | 保留 |
| ontology-action-flow | 3.3.2 服务编排 | **细化**：补"服务编排流程视图"描述 |
| ontology-graph | 3.4 知识图谱 | 保留 |
| ontology-graph-detail | 3.4.1.1 图谱主界面 | **细化**：补"图谱详情视图"描述 |
| ontology-graph-relation | （**缺失**） | **新增**：3.4.3 图谱关系视图 |

**v2.0 重点**：补充 3 个详情/视图子节，与设计稿页面清单对齐。

### 3.8 APP-KB（知识库）—— 新增模块

| 设计稿页面 | v1.0 PRD | v2.0 处理 |
|----------|---------|---------|
| ontology-knowledgebase（page-knowledge-base） | **无** | **新建 PRD** |

**v2.0 重点**：从 APP-ONTSTUDIO 抽离的独立模块，对应 `nav-knowledge` 顶部导航项。功能范围：
- 文档库管理（上传/分类/版本）
- 文档解析与切片
- 向量索引与检索
- 知识库与 RAG 协同（被 APP-COPILOT/APP-DW 调用）
- 知识库与数字员工绑定（被 APP-DW 调用）

---

## 4. 关键决策与变化点

### 4.1 新增模块（v2.0 范围）

| 新增项 | 来源 | 影响 |
|-------|------|------|
| **APP-KB 知识库** | 设计稿 group 5 独立页 | 新建 PRD；TECH-RAG 在 v2.0 中作为消费方显式出现 |
| **APP-DASHBOARD 后台管理子模块** | 设计稿 group 8 五页 | 合并到 APP-DASHBOARD v2.0，作为 3.8 章节 |
| **APP-APPHUB 数据建模** | 设计稿 apps-modeling | 新建 4.10 数据建模章节 |
| **APP-APPHUB 表单+流程联动** | 设计稿 apps-forms-flows | 新建 4.11 表单与流程联动章节 |
| **APP-ONTSTUDIO 图谱关系视图** | 设计稿 ontology-graph-relation | 新建 3.4.3 图谱关系视图小节 |

### 4.2 命名变化（v2.0 范围）

| 范围 | v1.0 | v2.0 | 说明 |
|------|------|------|------|
| 文件名（保留旧名） | `PRD-APP-COPILOT-超级AI_v1.0.md` | `PRD-APP-COPILOT-超级AI_v2.0-20260722.md` | 用户决定保留旧名 |
| 模块内部引用 | `APP-SUPERAI` | `APP-COPILOT`（**推荐，但本次保留旧名以最小化变更**） | CLAUDE.md 已说明本次刷新不重命名 |

### 4.3 技术基线变化（v1.2 重构同步）

| 维度 | v1.0 PRD | v2.0 PRD |
|------|---------|---------|
| 后端语言 | Java + Python 双栈 | **Java 25 唯一后端** |
| AI 编排底座 | LangChain / LangGraph | **Spring AI Alibaba 1.1.2.0** |
| AI 协议注册 | Nacos 2.x | **Nacos 3.0+** |
| 数据访问 | SQLAlchemy + JPA | **Spring Data JPA 统一** |
| Web 框架 | FastAPI + Spring | **Spring WebFlux/MVC + 虚拟线程** |
| AI 模块名 | APP-SUPERAI | **APP-COPILOT**（文件保留旧名） |

### 4.4 设计系统元数据（v2.0 PRD 附录）

所有 v2.0 PRD 必须新增 **附录 A：UI 设计基线** 章节，包含：
- 颜色系统（Dark theme 9 色）
- 字体系统（Geist）
- 形状系统（8px 圆角 + 零阴影）
- 组件语言前缀（.v-*）
- 对应设计稿页面（metaplatform-design-draft/pages/*.html）

---

## 5. 详细差异清单（逐 PRD）

### 5.1 PRD-APP-DASHBOARD-仪表盘 / PRD_v2.0-20260722.md

| 序号 | 变化类型 | 章节 | 变化内容 |
|------|---------|------|---------|
| 1 | 新增 | 3.1.6 | 我的应用快捷入口（design: dashboard-myapps） |
| 2 | 新增 | 3.1.7 | 我的数字员工快捷入口（design: dashboard-myagents） |
| 3 | 新增 | 3.7 | 门户聚合视图（design: dashboard-portal） |
| 4 | 扩展 | 3.6 | 历史交付材料：增加搜索/分享/版本管理细节 |
| 5 | **新增** | **3.8** | **后台管理**（design: admin-users/permissions/org/logs/config 五页） |
| 6 | 新增 | 附录 A | UI 设计基线 |

### 5.2 PRD-APP-COPILOT-超级AI_v2.0-20260722.md

| 序号 | 变化类型 | 章节 | 变化内容 |
|------|---------|------|---------|
| 1 | 全文替换 | 全文 | `APP-SUPERAI` → `APP-COPILOT`（仅模块标识） |
| 2 | 扩展 | 头部 | 版本元数据更新为 v2.0-20260722，状态由"草案"改为"正式版候选" |
| 3 | 新增 | 附录 A | UI 设计基线 |
| 4 | 更新 | FR-AI-001~006 | 描述中去除 LangChain/LangGraph 引用，统一到 SAA |
| 5 | 调整 | 7. 依赖关系 | TECH-LLMGW 描述更新到 SAA ChatModel |

### 5.3 PRD-APP-COPILOT-通用_v2.0-20260722.md

| 序号 | 变化类型 | 章节 | 变化内容 |
|------|---------|------|---------|
| 1 | 全文替换 | 全文 | `APP-SUPERAI` → `APP-COPILOT` |
| 2 | 新增 | 1.1 | 注明"模块名沿用'超级AI'直至 v1.3 重命名为'智能助手'" |
| 3 | 新增 | 附录 A | UI 设计基线 |

### 5.4 PRD-APP-APPHUB-应用中心_v2.0-20260722.md

| 序号 | 变化类型 | 章节 | 变化内容 |
|------|---------|------|---------|
| 1 | 拆分 | 4.1.2 | 创建应用：拆为"空白创建"和"模板创建" |
| 2 | 拆分 | 4.1.3 | 应用信息编辑升级为独立的"应用配置"章节 4.12 |
| 3 | **新增** | **4.10** | **数据建模**（design: apps-modeling） |
| 4 | **新增** | **4.11** | **表单与流程联动视图**（design: apps-forms-flows） |
| 5 | 新增 | 4.12 | 应用配置（design: apps-config） |
| 6 | 新增 | 附录 A | UI 设计基线 |

### 5.5 PRD-APP-ARCH-架构中心_v2.0-20260722.md

| 序号 | 变化类型 | 章节 | 变化内容 |
|------|---------|------|---------|
| 1 | 修订 | 3.4.2 | 技术栈清单：去除 Python 描述，标注"Java 25 唯一后端" |
| 2 | 修订 | 3.6 | Ontology 联动：明确与 APP-ONTSTUDIO 解耦（arch 仅做映射） |
| 3 | 新增 | 附录 A | UI 设计基线 |

### 5.6 PRD-APP-DW-数字员工_v2.0-20260722.md

| 序号 | 变化类型 | 章节 | 变化内容 |
|------|---------|------|---------|
| 1 | 修订 | 3.2.4 | 模型选择：明确 SAA ChatModel 适配器，列出支持模型 |
| 2 | 修订 | 3.3.2 | AI 自动抽取 Ontology：明确与 APP-ONTSTUDIO 协同路径 |
| 3 | 修订 | 5.1 | 上游依赖：去除 LangGraph 引用，统一到 SAA Graph Core |
| 4 | 新增 | 8 | 非功能需求中追加 SAA 性能基准 |
| 5 | 新增 | 附录 A | UI 设计基线 |

### 5.7 PRD_v2.0-20260722.md（APP-DW 精简版）

| 序号 | 变化类型 | 章节 | 变化内容 |
|------|---------|------|---------|
| 1 | 修订 | 全文 | 与详细版对齐：去除 Python 依赖，更新 API 路径为 `/api/v1/digital-worker/**` |
| 2 | 新增 | 附录 A | UI 设计基线 |

### 5.8 PRD-APP-MCPHUB-MCP服务中心_v2.0-20260722.md

| 序号 | 变化类型 | 章节 | 变化内容 |
|------|---------|------|---------|
| 1 | 修订 | 3.1 | MCP Server 管理：基线升级到 Nacos 3.0+ |
| 2 | 修订 | 3.2 | MCP Client：客户端 SDK 统一为 Spring AI Alibaba Nacos MCP Starter |
| 3 | 修订 | 5.1 | 上游依赖：TECH-MCP 基于 SAA Nacos MCP |
| 4 | 修订 | 6 | API 路径：`/api/v1/mcp/**` 经 TECH-IAM OAuth2 网关 |
| 5 | 新增 | 附录 A | UI 设计基线 |

### 5.9 PRD-APP-ONTSTUDIO-本体论引擎_v2.0-20260722.md

| 序号 | 变化类型 | 章节 | 变化内容 |
|------|---------|------|---------|
| 1 | 细化 | 3.1.1.5 | 概念详情：补"建模详情视图"（design: ontology-modeling-detail） |
| 2 | 细化 | 3.3.2 | 服务编排：补"服务编排流程视图"（design: ontology-action-flow） |
| 3 | 细化 | 3.4.1.1 | 图谱主界面：补"图谱详情视图"（design: ontology-graph-detail） |
| 4 | **新增** | **3.4.3** | **图谱关系视图**（design: ontology-graph-relation） |
| 5 | 调整 | 1.3 | 与 APP-KB 知识库的边界：本体论专注语义建模，知识库专注内容资产 |
| 6 | 新增 | 附录 A | UI 设计基线 |

### 5.10 PRD-APP-ONTSTUDIO-状态与改进规划_v2.0-20260722.md

| 序号 | 变化类型 | 章节 | 变化内容 |
|------|---------|------|---------|
| 1 | 修订 | 2.1 | 代码规模更新到 2026-07-22 |
| 2 | 修订 | 3 | 差距盘点对齐 v1.2 重构（R3 阶段） |
| 3 | 修订 | 4 | 改进规划：P1/P2 项重排（基于 v1.2 技术栈） |
| 4 | 新增 | 5 | 验收标准补充 SAA 适配验收 |
| 5 | 新增 | 附录 A | UI 设计基线 |

### 5.11 PRD-APP-KB-知识库_v1.0-20260722.md（**新增**）

| 序号 | 章节 | 内容 |
|------|------|------|
| 1 | 1. 模块概述 | 定位、价值、用户、与 APP-ONTSTUDIO 的边界 |
| 2 | 2. 用户动线 | 上传→解析→索引→检索→绑定数字员工 |
| 3 | 3. 功能详情 | 知识库列表、新建、文档管理、检索配置、版本管理、权限 |
| 4 | 4. 增量交付 | Phase 1~4 |
| 5 | 5. 依赖 | 上游（TECH-RAG、TECH-ONT、TECH-DATA）+ 下游（APP-COPILOT、APP-DW、APP-APPHUB） |
| 6 | 6. API | /api/v1/knowledge-base/** |
| 7 | 7. 数据模型 | KnowledgeBase / Document / DocumentChunk / IndexConfig |
| 8 | 8. 非功能 | 检索性能、并发、可用性 |
| 9 | 附录 A | UI 设计基线（design: ontology-knowledgebase） |

---

## 6. 风险与回退方案

### 6.1 风险清单

| 风险 | 等级 | 缓解措施 |
|------|------|---------|
| 设计稿与 PRD 命名不一致（如 `APP-SUPERAI` vs `APP-COPILOT`） | 中 | 本次 v2.0 保留旧名以最小化变更；v1.3 重命名 PR 单独处理 |
| 现存 PRD 内容量大（部分 > 100KB），全量重写易丢失历史决策 | 中 | 采用"差异增量"策略：保留原有功能描述，仅替换章节级增量 |
| v2.0 涉及 10 份 PRD 并发刷新可能存在上下文溢出 | 中 | 分批执行，每批 ≤ 3 份 |
| 后台管理（admin-*）5 页合并到 DASHBOARD 改变模块边界 | 低 | 仅做章节级合并，不改变 DASHBOARD 模块定位 |
| 新增 APP-KB 与 TECH-RAG 关系需在 v1.3 重构阶段同步 | 中 | 在 PRD 中明确标注"R3 阶段 TECH-RAG 收敛后落地" |

### 6.2 回退方案

若 v2.0 刷新后任意一份 PRD 出现重大错误，可通过以下方式回退：

1. **Git 回退**：`git checkout HEAD~1 -- docs/prd/`
2. **文件名回退**：v2.0 文件命名规则 `PRD-XXX_v2.0-20260722.md`，旧 v1.0 文件未删除，可直接替换
3. **差异报告为本**：本报告 (`REPORT-设计稿与PRD差异分析_v1.0-20260722.md`) 是所有刷新的依据，可逐项核对回滚

---

## 7. 验收标准

| 维度 | 标准 |
|------|------|
| 页面覆盖率 | 设计稿 43 个编排页面 + 6 个未编排 HTML 页面，100% 在 v2.0 PRD 中有对应功能描述 |
| 新增模块 | APP-KB 知识库 PRD v1.0 已新建并填充完整结构 |
| 命名一致性 | 文件名沿用旧名（用户确认），但内部模块标识统一为 APP-COPILOT（除特别声明） |
| 技术基线 | 所有 v2.0 PRD 已同步 v1.2 重构决策（Java 25 + SAA + Nacos 3.0+） |
| 设计系统附录 | 所有 v2.0 PRD 已新增附录 A：UI 设计基线 |
| 文档质量 | 每份 PRD 包含：版本历史、实现状态、功能详情、API、数据模型、非功能、依赖、设计附录 |

---

## 8. 后续行动项

| # | 行动 | 负责人 | 截止 |
|---|------|-------|------|
| 1 | 按本报告 §5 清单逐份刷新 PRD | Claude | 2026-07-22 |
| 2 | 新建 APP-KB PRD v1.0-20260722 | Claude | 2026-07-22 |
| 3 | 在 PLAN 文档中追加 v2.0 刷新记录 | 后续人工 | 2026-07-23 |
| 4 | v1.3 重命名 PR：`APP-SUPERAI` → `APP-COPILOT` 文件级重命名 | 后续人工 | 待 R1 阶段完成 |

---

**报告版本**: v1.0
**报告日期**: 2026-07-22
**报告人**: Mate Platform PRD 自动化刷新流程
**关联文档**: `CLAUDE.md`（v1.3 重构期）、`docs/prd/_top/PLAN-Mate_Platform-PRD交叉验证与迭代主线规划_v2.0-20260719.md`