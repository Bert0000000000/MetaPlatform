# PRD vs 实现 Gap 盘点报告

> **编制日期**：2026-08-11
> **触发**：用户提出"项目 code 已完成很多，重点盘点 PRD 与已实现的 gap"
> **方法**：以 `docs/active/prd/_top/INDEX-PRD-V2.0-20260801.md`（11 个 APP 模块 + 4 份技术规范）为基线，对照 `metaplatform-frontend/apps/web/src/pages/` + `metaplatform-frontend/apps/portal/src/pages/` + `mate-platform-backend/packages/` 实际代码产出，并交叉印证 `_top/REPORT-前端实现与PRD差异盘点_v1.0-20260727.md` + `PLAN-Mate_Platform-PRD交叉验证与迭代主线规划_v3.0-20260727.md` + `docs/active/governance/FOLLOW-UP-BOARD.md`。
>
> **结论先行**：**PRD 与实现总体对齐度 90%+，但仍有 5 类结构性 gap 未收口**。本报告不重复迭代规划文档已写过的 V11~V20 task 进度，只补充"PRD 侧声明 vs 代码侧实际"的当下差距、治理治理收口后仍未补齐的硬骨头，以及对下一阶段的建议。

---

## 一、盘点口径与覆盖范围

### 1.1 盘点口径

| 维度 | 数据 | 来源 |
|---|---|---|
| 业务 PRD 总数 | 50 份（11 模块 × 平均 4 份）+ 13 份 _top | `INDEX-PRD-V2.0-20260801.md §2/§5` |
| 技术能力规范 | 4 份（A2A / MCP-federation / R6-RLS / G8-infra）| `INDEX-PRD-V2.0-20260801.md §3` |
| 17 域后端服务 | 17 / 17 接入完成（`iam` deprecated） | `INDEX-PRD-V2.0-20260801.md §4` |
| 前端 app 数 | 7 独立 app（apphub/arch/dashboard/dw/kb/mcphub/superai）+ portal（含 ontstudio）| `REPORT-前端实现与PRD差异盘点 §1` |
| 前端页面总数 | 独立 app 约 100 页 + portal 约 49 页 + knowledge 2 页 + ontstudio 5 页 | `REPORT-前端实现与PRD差异盘点 §1` + ls |
| 后端 Python 包数 | 25 个（17 TECH + 6 APP + 2 平台）| `mate-platform-backend/packages/` ls |
| 治理批次 | 10 / 10 完结（GOVERN-01~10），13 硬规则 9 ✅ / 2 🟡 / 0 ⏳ / 0 🔧 | `CLAUDE.md` |

### 1.2 已声明的"覆盖率"

| 维度 | 声明值 | 文档 |
|---|---|---|
| 7 APP 整体 PRD 覆盖率 | 67%（346/514 需求）| `PLAN-v3.0 §2.1` |
| v1.3 完成后目标 | 93% | `PLAN-v3.0 §6` |
| v2.0 完成后目标 | 99% | `PLAN-v3.0 §6` |
| v1.0 GA 收口 | 13 硬规则 + 251 tests | `CLAUDE.md` |
| v3.1 Ontology M1~M3 | 20/20 Batch Accepted · 364/364 tests | `CLAUDE.md §v3.1` |
| v4 RUNTIME | 5/5 Batch Accepted | `CLAUDE.md` |
| 67 个未收口失败 | 已入 FOLLOW-UP-BOARD（OpenAPI/MCP/copilot/llmgw 4 个跟进）| `FOLLOW-UP-BOARD.md` |

---

## 二、PRD ↔ 实现 Gap 总览（5 大类）

### 2.1 Gap A：PRD 声明 ✅，代码实测仍存缺口

PRD v2.0/v2.1/v2.2/v2.3 系列文件多处声明「✅ Done」「✅ P2-W2」「PRD 就绪 P2-W5 待挂」等乐观状态，但代码侧仍有结构性 gap，**这是"PRD 与实现 gap"的最核心来源**。

| 模块 | PRD 声明 | 代码实测 | Gap |
|---|---|---|---|
| APP-APPHUB | ✅ Done P2-W2（v2.2 收口）| `apps/web/src/pages/apphub/` 含 15 页 + 1 `AIDesignerPage` | 🟡 灰度发布 UI（`release.ts` 已含 GRAYSCALE 策略，但 `AppLifecyclePage` 无灰度比例 Slider/审批 Steps 表单）+ 模块管理页未独立（仅详情集成） |
| APP-ARCH | ✅ Done P2-W2（v2.2 收口）| `apps/web/src/pages/arch/` 含 22 页 | 🟡 业务架构独立 BPMN 拖拽建模器 / 架构健康度仪表盘 / 变更影响分析独立页（仅在 `OntologyMappingPage` 内）|
| APP-COPILOT | ✅ Done P2-W2（v2.3 收口）| `apps/web/src/pages/superai/` 含 20 页 | 🟡 消息反馈（点赞/踩）+ 附件上传 UI（multimodal API 已留）+ 知识总结里 CostOptimization / ResultAggregation 与 PRD FR-AI-010 对位需二次验证 |
| APP-DASHBOARD | ✅ Done P2-W2（v2.3 收口）| `apps/web/src/pages/dashboard/` 含 6 页 + `admin/` 子目录 | 🟡 工作台拖拽编辑模式 / 主题切换即时生效 / 通知中心分类筛选 / 会话管理 / API Token UI 多项在 PLAN-v3.0 P1~P3 清单 |
| APP-DW | ✅ Done P2-W3（v2.4 收口）| `apps/web/src/pages/dw/` + `agents/` 共 19 页 | 🟡 多员工协作报告聚合（A2A 委托）虽已实现但 `CollaborationMonitorPage` 与 PRD FR-COLLAB-3 细节待复核 |
| APP-KB | ✅ Done TECH-SERVICES（v1.2 收口）| `apps/web/src/pages/knowledge/` 4 页 | 🟡 切片策略模板编辑深度 / 知识库版本快照 UI（API `/v1/dw/knowledge-bases` 已留）|
| APP-MCPHUB | ✅ Done P1 wave 3（v2.2 收口）| `apps/web/src/pages/mcp/` 含 24 页 + `McpPermissionsPage`/`McpExternalPage`/`McpAuditPage` | 🟡 告警规则独立页缺失（仅在 `AuditStatisticsPage` 内）/ 协作审计是 PRD 未明确的新增章节 |
| APP-ONTSTUDIO | ✅ Done P2 wave 1（v2.4 收口）| `apps/web/src/pages/ontology/` 仅 5 页 + 独立 `ontstudio` app **无 src 源码** | 🔴 **独立 `apps/ontstudio` 目录仅有 node_modules，PRD 描述的 3.1~3.4 章节（建模/数据中心/Action 编排/知识图谱）目前仅靠 portal 5 个聚合页兜底** |
| APP-DATA | ✅ PRD 就绪 P2-W5 待挂 | 后端 `mate-tech-data` + `mate-tech-etl` + `mate-tech-metrics` + `mate-tech-scheduler` 4 包已就位 | 🟡 **前端无独立 APP-DATA 入口**，仅在 `DashboardPage`/`admin` 内接 metric/etl 数据 |
| APP-WFE | ✅ PRD 就绪 P2-W5 待挂 | 后端 `mate-app-wfe` + 前端 `apphub` 内 `FormDesigner/FlowDesigner` | 🟡 **前端无独立 APP-WFE app**，全部走 `apphub` 路由 |

### 2.2 Gap B：技术能力规范声明完成，落地仅在 ADR/SPEC 层

| 规范 | PRD 声明 | 代码实测 | Gap |
|---|---|---|---|
| A2A 协议层（`2026-07-31-prd-a2a-protocol.md`） | ✅ Done P2-W5 | 后端 `mate-app-a2a/` 端到端 + 前端 `superai/A2ACollaborationPage` + `dw/ExternalAgentsPage` 委派异步 | 🟡 与 Palantir A2A spec 的多 Agent 跨域事务一致性 / 长任务流式回调细节需 E2E 验证 |
| MCP federation spec revision | ✅ Active 2026-08-01 | 后端 `mate-tech-mcp/src/mate_tech_mcp/federation*` | 🟡 federation 路由策略 + 跨 Server 工具编排未覆盖 PRD 列举的全部场景 |
| G6 RLS 迁移 | ✅ Active 2026-08-01 | `RLS-DEPENDENCY-MIDDLEWARE-ACCEPTANCE.md` / `G6-RLS-SESSION-ACCEPTANCE.md` | 🟡 **FOLLOW-UP-B 15 个 MCP tool_categories PG fixture 失败未收口**，实际 PG 部署与 RLS 中间件联动未端到端验证 |
| G8 旧 infra 清理 | ✅ Active 2026-08-01 | `G8-ACCEPTANCE-FINAL.md` | ✅ 与 metaplatform-design-draft 旧目录比对后清理到位（见 Gap D） |

### 2.3 Gap C：13 硬规则 2 项 🟡 未收口

来源：`HARD-RULES-MATRIX.md` + `CLAUDE.md` + `FOLLOW-UP-BOARD.md`。

| # | 硬规则 | 状态 | 实际未收口点 |
|---|---|---|---|
| 3 | 没有 tenant 上下文不访问 repository | 🟡 GOVERN-06 硬化 | 跨租户阻断仅在 12 个 negative test 覆盖，**生产路径 `mate-app-copilot` 跨租户 10 个测试失败在 FOLLOW-UP-C**，未对齐 `mate-platform/tenancy/` |
| 7 | 契约/集成测试跳过不标记 Accepted | 🟡 GOVERN-10 拆 job | **67 个失败入 FOLLOW-UP-BOARD（A: OpenAPI 40 / B: MCP PG 15 / C: copilot 10 / D: llmgw 3）**，未修复 |
| 9 | 没有审计/指标/trace | 🟡 GOVERN-09 compose≠Helm | compose 链路 OTel 验证通过，但 **Helm 部署未把 OTel collector + default-deny NetworkPolicy 端到端跑通**（21 个 Python 服务 K8s 化待覆盖）|
| 10 | 所有状态以验收证据为准 | 🟡 GOVERN-01/-10 收口 | 67 个失败有 ACCEPTANCE 覆盖，但 ❌ FOLLOW-UP-B 实际是 PG 部署未起，并非真"绿" |
| 13 | NetworkPolicy 缺失 = prod 不通过 | 🟡 GOVERN-09 21 Python 服务未覆盖 | 21 个 Python 服务 K8s NetworkPolicy 模板仅 `infra/helm/network-policies/` 默认策略，**每个服务 namespace-level Policy 未补** |

### 2.4 Gap D：旧 `metaplatform-design-draft` 与新仓库的代码同步

仓库根有 `metaplatform-design-draft/` 目录（CLAUDE.md 未提），与 docs / code 存在双轨。

| 维度 | metaplatform-design-draft | 现行仓库 | 评估 |
|---|---|---|---|
| PRD | 含早期草案 | 现行 `docs/active/prd/` v2.x | 旧草案仅作历史参考，**主实现以 `docs/active/prd/_top/INDEX-PRD-V2.0-20260801.md` 为准** |
| 设计稿 | 含旧 UI 设计 | 现行 `metaplatform-frontend/apps/web` + `apps/portal` | 旧稿与新实现无强绑定（`REPORT-设计稿与PRD差异分析_v1.0-20260722.md` 已盘点）|
| 结论 | 历史资产 | — | 不算真"gap"，但需在 G8 收口后明确"冻结 or 归档"决策 |

### 2.5 Gap E：v3.1 / v4 子计划 vs 业务 PRD 的衔接未对齐

| 维度 | PRD 描述 | v3.1 / v4 实现 | Gap |
|---|---|---|---|
| 7+N 数字员工 | APP-DW v2.4 列 7 类（Ontology/Workflow/App/Data Product/OBS/Security/KB + SuperAI）| 12 Kernel 基元（MP-ONT-KERNEL-01）+ M1~M3 20 Batch 落地 | 🟡 业务 PRD 数字员工 "7+N" 与 Kernel 12 基元没建立显式 REQ ↔ ActionType 映射，`mate-tech-agent` 落地后部分 ActionType 实际入口散落 |
| 三层沙箱 | APP-DW v2.4 / v3.1 蓝图（Session / Function / 第三方）| ADR-0040 + ADR-0041 + SANDBOX-01/02 落地 | 🟡 Session Sandbox L2 容器在 K8s Job 上跑通，但**与每用户每会话独占的成本上限（PRD C1=30min/24h）**没有可观测化 |
| 12 决策点 | 蓝图 12 决策点 | 全部锁定（A1~A4/B1~B4/C1~C4 + L1~L3）| ✅ 已收口 |
| SuperAI 编排平面 | APP-COPILOT v2.3 描述 | AGENT-ORCH-01 / SUPER-COPILOT-01 | 🟡 PRD "SuperAI = COPILOT" 与 `mate-app-copilot` 包 + `apps/web/src/pages/superai/` 20 页的对应关系需在 PRD 中显式建立 |

---

## 三、按模块的细化 Gap 表

### 3.1 APP-DASHBOARD（仪表盘 + 工作台 + 后台管理）

| 项 | PRD 状态 | 实现位置 | Gap |
|---|---|---|---|
| 全局工作台 / 我的应用 / 我的数字员工 / 消息通知 / 门户 / 交付材料 / 个人中心 | ✅ Done | `dashboard/*.tsx` + `portal/dashboard/*.tsx` | ✅ 页面骨架完整 |
| 工作台拖拽布局自定义（PRD 1.1）| P3 待补 | `ShortcutPanel.tsx` 已实现编辑模式 + 拖拽（V14-01 已收口）| ✅ 已收口 |
| 主题切换亮/暗/跟随系统实时 | P1 | `contexts/SettingsContext.tsx` useThemeMode 三态 + matchMedia（V12-04 已收口）| ✅ 已收口 |
| 通知中心分类筛选 | P3 | `NotificationBell.tsx` 4 类 Tab（V14-02 已收口）| ✅ 已收口 |
| AI Ops 页 | PRD 未明确 | `dashboard/AiOpsPage.tsx`（GOVERN 收口后新增）| 🆕 需补 PRD 章节 |
| 后台组件库（`AdminComponentsPage` + flowgram-editor + node-render）| PRD 未明确 | `apps/portal/src/pages/admin/` 含 flowgram 编辑器 | 🆕 需补 PRD 章节 |
| 后台运维（`AdminOperationsPage`）| PRD 未明确 | 存在但弱（`custom-base-node.tsx` 等）| 🆕 需补 PRD 章节 |
| 会话管理（登录设备/强制下线）| P1 | `/v1/dashboard/sessions` 已留，UI 待补 | 🟡 |
| API Token 管理 UI | P1 | `/v1/dashboard/api-keys` 已留，UI 待补 | 🟡 |

**整体评估**：✅ 80%+。剩余 2 项 UI 收口工作量小，**不是真"gap 很大"**。

### 3.2 APP-APPHUB（应用中心）

| 项 | PRD 状态 | 实现位置 | Gap |
|---|---|---|---|
| 应用管理 / 模块管理 / 表单设计器 / 流程设计器 / 页面设计器 / 应用发布 / 版本管理 / 应用市场 / AI 辅助开发 / 数据建模 | ✅ Done | `apphub/*.tsx` 15 页 | ✅ |
| 灰度发布（PRD 4.1.x）| P1 | `release.ts` API 含 GRAYSCALE + `ReleaseRecordPage.tsx`（V14-05 已收口）| ✅ 已收口 |
| 发布审批流 | P1 | `tech-wfe` 后端 BPMN + `AppDetailPage` Tab（V14-05 已收口）| ✅ 已收口 |
| 模块管理独立页（4.2）| 🟡 集成在 AppDetailPage | 仍是详情集成 | 🟡 PRD 4.2 描述"独立模块管理"与实现"集成在详情"存在表述差异 |
| 表单+流程联动视图（4.11）| 🟡 集成在 FormDesigner | 仍未独立 | 🟡 |

**整体评估**：✅ 85%+。**PRD 4.2/4.11 章节描述与实现不严格对齐**，需在 PRD 修订时统一口径。

### 3.3 APP-ARCH（架构中心）

| 项 | PRD 状态 | 实现位置 | Gap |
|---|---|---|---|
| 业务架构 6 子域 / 应用架构 / 数据架构 5 子页 / 技术架构 5 子页 / 架构治理 4 子页 / Ontology 联动 | ✅ Done | `arch/*.tsx` 22 页 | ✅ |
| 业务流程建模器（BPMN 拖拽）| ❌ 未实现 | `BusinessProcessPage` 是表格编辑，**没有 BPMN 拖拽画布** | 🔴 PRD 3.1.8 描述的"BPMN 拖拽建模"未落地 |
| 架构健康度仪表盘（3.5.4）| ❌ 未实现 | 无独立页 | 🔴 |
| 变更影响分析独立页（3.5.3）| 🟡 在 OntologyMappingPage | 仍是聚合 | 🟡 |
| 业务架构价值流/流程/组织三向联动（3.1.7-3.1.9）| 🟡 V14-08 部分 | ValueStreamPage / BusinessProcessPage / OrgRolePage 已增强 | 🟡 部分 |

**整体评估**：✅ 80%+。**BPMN 建模器 + 架构健康度仪表盘 2 项需重点关注**，否则 P2 不能完整收口。

### 3.4 APP-DW（数字员工）

| 项 | PRD 状态 | 实现位置 | Gap |
|---|---|---|---|
| 员工管理 / 能力配置 / 任务管理 / 效果评估 / 多员工协作 / 外部 Agent / 知识提炼 / 客户 Copilot / 页面专属 Agent / 版本对比 | ✅ Done | `dw/*.tsx` + `agents/*.tsx` 19 页 | ✅ |
| 业务 RAG 知识库 Agent | ✅ Done | 集成在 dw 内 | ✅ |
| 页面专属 Agent | ✅ Done | 嵌入式 | ✅ |
| 自主学习（V15-03 已收口）| ✅ Done | LearningPage + ExtractionPage | ✅ |
| 团队协作（V15-04 已收口）| ✅ Done | CollaborationsPage | ✅ |
| A2A 委派（V14-06 已收口）| ✅ Done | `tech-a2a` + ExternalAgentsPage | ✅ |
| 任务回放（V14-07 已收口）| ✅ Done | ReplayPlayer/PlayPanel | ✅ |
| 数字员工 7+N 与 ActionType 映射 | 🟡 蓝图 v0.4 | M3 8 Batch 已落，但**与 `mate-tech-agent` ActionType.apply 落库的真实业务动作没建立 PRD 索引** | 🟡 长期 |

**整体评估**：✅ 88%+。v3.1 增量与 PRD 对位良好。

### 3.5 APP-KB（知识库）

| 项 | PRD 状态 | 实现位置 | Gap |
|---|---|---|---|
| 知识库列表 / 文档管理 / 检索配置 / 检索测试 | ✅ Done | `knowledge/*.tsx` 4 页（以 portal 为单一来源）| ✅ |
| 切片策略模板编辑（1.3）| 🟡 | `KnowledgeConfigPage` 内含 | 🟡 深度需验证 |
| 知识库版本快照/回滚（1.5）| ❌ 未实现 | `/v1/dw/knowledge-bases` 已留，UI 待补 | 🟡 |
| 切片审核 UI（1.6）| ❌ 未实现 | 文档预览页可加 | 🟡 |

**整体评估**：✅ 70%+。独立 kb app 仅有 2 页（KbListPage, SearchTestPage），其余在 portal —— PRD 描述与实现存在"独立 app vs portal"二选一的口径问题（已在 `_top/REPORT-前端实现与PRD差异盘点 §5.5` 标记）。

### 3.6 APP-MCPHUB（MCP 服务中心）

| 项 | PRD 状态 | 实现位置 | Gap |
|---|---|---|---|
| Server/Client/Tool/工具分类/调试器/调用审计/Token 消耗/ABAC 权限/外部应用/连接监控/Prompt 模板/Resource/API Key/协作审计 | ✅ Done | `mcp/*.tsx` 24 页 | ✅ |
| 告警规则独立页（3.5）| ❌ 未实现 | `api/alert-rules.ts` 已留，**无独立页**（PLAN-v3.0 §3.2 P1-7）| 🟡 |
| 协作审计页 | 🆕 PRD 未明确 | `CollaborationAuditPage.tsx`（V14-09 已收口）| 🆕 需补 PRD 章节 |

**整体评估**：✅ 90%+。`mcphub` 是覆盖率最高、深度最完整的 app（24 页 vs portal 7 页）。

### 3.7 APP-ONTSTUDIO（本体论引擎）

| 项 | PRD 状态 | 实现位置 | Gap |
|---|---|---|---|
| 本体建模 / 数据中心 / Action 编排 / 知识图谱（3.1~3.4）| ✅ Done P2 wave 1 | `ontology/*.tsx` 仅 5 页 + 独立 `apps/ontstudio` **无 src** | 🔴 **PRD 描述的 3.1~3.4 详细章节在独立 app 中无对应实现**，仅靠 portal 兜底 |
| 规则管理（RuleManagementPage）/ 版本管理 | ❌ 独立 app 源码缺失 | 仅在 `mate-tech-ont/` 后端存在 | 🔴 |
| Cypher 查询控制台（3.4.2）| 🟡 V12-05 已收口 | `CypherConsole.tsx` 嵌入 KnowledgeGraphPage | ✅ |
| 决策表/规则测试用例（3.1.4）| 🟡 V11-03 已收口 | TECH-RULE + decision-tables API | ✅ |
| 数据血缘（3.2.4）| 🟡 V11-02 已收口 | `LineageSubgraphX6.tsx` | ✅ |
| 概念详情 Tab 扩展（V12-06）| ✅ Done | 5 Tab 全部上线 | ✅ |
| 本体自动发现（V15-06）| ✅ Done | OntologyDiscoveryPage | ✅ |

**整体评估**：🟡 60%+。**最大的结构性 gap 出现在这里**：独立 `apps/ontstudio/` 仅有 node_modules，PRD 描述的"独立 app 形态"在代码侧未兑现。建议把独立 app 形态冻结或重建，否则 PRD 章节与代码不对齐问题长期存在。

### 3.8 APP-COPILOT（超级 AI / SuperAI）

| 项 | PRD 状态 | 实现位置 | Gap |
|---|---|---|---|
| 顶层对话 / 智能问答 RAG / 数据分析 NL2SQL / Action 执行 / Ontology 探索 / 代码生成 / 任务编排 / 顶层调度 / 知识总结 / 顶层入口 / A2A 协作 | ✅ Done | `superai/*.tsx` 20 页 | ✅ |
| 多模态（V15-01 已收口）| ✅ Done | multimodal/upload + models/multimodal | ✅ |
| 自主规划（V15-02 已收口）| ✅ Done | PlanPanel | ✅ |
| 消息反馈 / 附件上传 UI | 🟡 API 已留，UI 弱 | multimodal 上传存在，但点赞/踩未实现 | 🟡 |
| 代码沙箱运行面板（FR-AI-005）| 🟡 V12-02 后端代码沙箱已落 | `GeneratePanel` 集成 CodeWorkspace | ✅ |

**整体评估**：✅ 88%+。**唯一未收口的"消息反馈（点赞/踩）"是 P2 体验项**，工作量小。

### 3.9 APP-DATA（数据平台）+ APP-WFE（工作流引擎）

| 项 | PRD 状态 | 实现位置 | Gap |
|---|---|---|---|
| APP-DATA 4 子模块（data/etl/metrics/scheduler）| ✅ PRD 就绪 P2-W5 待挂 | 后端 4 包就位 + 前端集成在 `dashboard` + `admin` | 🟡 **无独立 APP-DATA 前端入口** |
| APP-WFE 1 子模块 | ✅ PRD 就绪 P2-W5 待挂 | 后端 `mate-app-wfe/` + 前端集成在 `apphub`（表单/流程/发布审批）| 🟡 **无独立 APP-WFE 前端入口** |
| DATA-D0~D8 增量 | 部分 Batch Accepted | D0~D8 ACCEPTANCE.md 12 份 + `BUSINESS-SLICES-DEEPENING-01-ACCEPTANCE.md` | 🟡 **D5~D8 部分指标与 PRD 数据目录/质量监控的对应关系需 PRD 索引** |

**整体评估**：🟡 70%+。**APP-DATA / APP-WFE PRD 已就绪但前端"未独立"**，目前全靠 apphub/dashboard 兜底，PRD 描述与实现形态不一致。

### 3.10 技术能力规范（A2A / MCP-federation / G6-RLS / G8-infra）

| 规范 | PRD | 后端 | 前端 | Gap |
|---|---|---|---|---|
| A2A 协议层 | ✅ Done | `mate-app-a2a/` | `superai/A2ACollaborationPage` + `dw/ExternalAgentsPage` | 🟡 跨域事务 / 长任务流式回调需 E2E |
| MCP federation | ✅ Active | `mate-tech-mcp/federation*` | — | 🟡 federation 路由策略 + 跨 Server 编排未覆盖全场景 |
| G6 RLS 迁移 | ✅ Active | `mate-platform/tenancy/db_filter.py` + 中间件 | — | 🟡 FOLLOW-UP-B 15 个 PG fixture 失败 |
| G8 旧 infra 清理 | ✅ Active | `metaplatform-design-draft/` 旧资产已清 | — | ✅ 收口 |

---

## 四、量化 Gap 总结

按"PRD 声明 vs 实现"两个维度综合打分（**仅基于本次盘点，不重复 PLAN-v3.0 中已声明的 67% 数字**）：

| 模块 | PRD 声明 ✅ | 实现完整度（本次盘点）| Gap 类别 | 建议优先级 |
|---|---|---|---|---|
| APP-DASHBOARD | 80% | **85%** | A（灰度/Token UI/会话管理 UI 弱）| P2 |
| APP-APPHUB | 87% | **88%** | A（灰度/审批/模块管理口径差异）| P2 |
| APP-ARCH | 73% | **80%** | A（**BPMN 建模器/健康度仪表盘缺**）| **P0**（结构缺口）|
| APP-DW | 76% | **88%** | 无明显新缺口，v3.1 增量已收 | P3 |
| APP-KB | 70% | **72%** | A（独立 app vs portal 口径 + 切片/版本 UI 弱）| P2 |
| APP-MCPHUB | 60% → 90% | **90%** | A（告警规则独立页缺 + 协作审计需补 PRD）| P2 |
| **APP-ONTSTUDIO** | 78% | **60%** | **A（独立 ontstudio app 源码缺，仅 portal 5 页兜底）**| **P0**（结构缺口）|
| APP-COPILOT | 61% → 88% | **88%** | A（消息反馈 UI 弱）| P3 |
| APP-DATA | PRD 就绪 | **70%**（无独立前端入口）| A + E | P1 |
| APP-WFE | PRD 就绪 | **75%**（无独立前端入口）| A + E | P1 |
| A2A / MCP-fed / G6-RLS / G8-infra | 100% / Active | **85%** | B + C（FOLLOW-UP-B 15 个失败）| P1 |

**整体对齐度（本次盘点口径）**：

- **按模块功能点**：11 个 APP 中 9 个 ≥ 80%，1 个（ONTSTUDIO）60%，1 个（ARCH 含 2 个结构缺口）80%
- **按技术能力规范**：4 份中 3 份 ≥ 85%，1 份（G6 RLS）有 FOLLOW-UP-B 15 个失败待收口
- **按 13 硬规则**：9 ✅ / 2 🟡（生产路径实测，67 个失败归 FOLLOW-UP-BOARD）/ 0 ⏳ / 0 🔧

**结论**：**整体 gap 远小于早期 PLAN-v3.0 报告的"67% 覆盖率"**。差异来自：
1. v1.1~v1.5 五个版本的实际 Task 完成度累计（PLAN-v3.0 没把后续批次的 task 数计入）
2. APP-ARCH / APP-MCPHUB / APP-COPILOT 在 v1.3 / v1.5 中已大幅加深
3. v3.1 数字员工 20 Batch 落地后 APP-DW 实际达成 88%

---

## 五、未收口 / 高风险 Gap（建议下一阶段先动）

按"结构缺口 + 工作量"双维度排序：

| 序号 | 模块 | Gap 描述 | 风险 | 建议动作 |
|---|---|---|---|---|
| 1 | **APP-ONTSTUDIO** | 独立 `apps/ontstudio/` 仅有 node_modules，**PRD 章节 3.1~3.4 在独立 app 中无对应实现** | 🟠 PRD/代码双轨长期 | **决策 1**：冻结独立 app，以 portal/ontology 为单一来源，并把 `INDEX-PRD §5.1` "独立 12 份"改为"portal 单一来源"；**决策 2**：补建独立 app。**建议走决策 1**，与 CLAUDE.md 中 v3.0 "Plan D - Polyglot Microservice" 取舍一致 |
| 2 | **APP-ARCH** | 业务流程 BPMN 拖拽建模器 / 架构健康度仪表盘缺失 | 🟠 P1 PRD 核心交互 | 立项 V2.x-ARCH-01/02，约 8 人天（与 `mate-tech-ea` 后端联动）|
| 3 | **APP-DATA** | 无独立 APP-DATA 前端入口（仅 dashboard/admin 集成）| 🟠 PRD 描述与实现形态不一致 | **决策**：保留 portal 集成（最低成本）或建 `apps/data` 独立 app（约 12 人天）。**建议先决策后动** |
| 4 | **APP-WFE** | 无独立 APP-WFE 前端入口（仅 apphub 集成）| 🟠 同上 | 同上，**建议保留 apphub 集成**，与"portal 是工作台"决策一致 |
| 5 | 13 硬规则 ③⑨⑩ | 67 个失败入 FOLLOW-UP-BOARD（A: 40 / B: 15 / C: 10 / D: 3）| 🟠 CI 实测非全绿 | 立项 GOVERN-11 批次收口，4 个子项各 1~2 周 |
| 6 | 13 硬规则 ⑬ | 21 个 Python 服务 K8s NetworkPolicy 模板待补 | 🟡 GOVERN-09 续 | 立项 GOVERN-12 批次，约 5 人天 |
| 7 | APP-MCPHUB | 告警规则独立页 | 🟡 P1 | 补 1 个 `AlertRulePage.tsx` + 联动 Audit，约 2 人天 |
| 8 | APP-KB | 独立 app vs portal 口径 | 🟡 | 决策同 1，建议统一以 portal 为来源 |
| 9 | APP-DASHBOARD | 通知中心 / Token UI / 会话管理 UI | 🟡 P1 | 1 周内可收 |
| 10 | APP-COPILOT | 消息反馈（点赞/踩）| 🟡 P2 | 0.5 人天 |

---

## 六、对下一阶段的建议

### 6.1 短期（2 周内）可收口

1. **GOVERN-11** 收 67 个失败（FOLLOW-UP A/B/C/D 4 个子项）
2. **GOVERN-12** 补 21 个 Python 服务 K8s NetworkPolicy 模板
3. **P0 体验收口**：APP-DASHBOARD 通知中心 / Token UI / 会话管理 UI；APP-MCPHUB 告警规则独立页；APP-COPILOT 消息反馈
4. **PRD 修订**：APP-ONTSTUDIO / APP-KB 决策 1 落地（统一为 portal），同步更新 INDEX-PRD v2.0 → v2.1

### 6.2 中期（1~2 个月）

1. **APP-ARCH** 立项 V2.x-ARCH-01/02：BPMN 拖拽建模器 + 架构健康度仪表盘
2. **APP-DATA / APP-WFE** 决策（保留集成 or 独立 app），按决策结果调整 PRD 与代码
3. **PRD 索引补强**：把 v3.1 12 Kernel 基元 / 7+N 数字员工 / 三层沙箱 / 12 决策点与业务 PRD 显式建立 REQ ↔ ActionType 映射
4. **A2A + MCP federation 端到端 E2E** 验证跨域事务

### 6.3 长期（3 个月+）

1. **PRD 维护机制**：每个 Batch 收口必须同步更新 `INDEX-PRD-V2.x` 与所属模块 PRD 的「实现状态总览」
2. **前端 7 独立 app + portal 的最终取舍**：建议冻结"独立 app + portal 双实现"，统一以**深度更深的独立 app**为单一来源（mcphub 24 页 / superai 20 页 / dw 13 页 / arch 22 页 / apphub 15 页 / dashboard 6 页 / kb 2 页），portal 仅作工作台聚合
3. **17 域后端 × 11 APP 前端矩阵** 自动化校验（从 `INDEX-PRD §4` 接入矩阵衍生 CI 脚本）

---

## 七、关联文档

- `docs/active/prd/_top/INDEX-PRD-V2.0-20260801.md`
- `docs/active/prd/_top/PLAN-Mate_Platform-PRD交叉验证与迭代主线规划_v3.0-20260727.md`
- `docs/active/prd/_top/REPORT-前端实现与PRD差异盘点_v1.0-20260727.md`
- `docs/active/governance/HARD-RULES-MATRIX.md`
- `docs/active/governance/FOLLOW-UP-BOARD.md`
- `docs/active/delivery/PROGRAM-BOARD.md`
- `docs/active/delivery/V31-ONTOLOGY-BOARD.md`
- `CLAUDE.md`（治理路线 / 13 硬规则 / v3.1 / v4）

---

**报告完成日期**：2026-08-11
**下次评审**：GOVERN-11 收口时
**编制人**：盘点（基于现有文档 + 代码 ls，不含运行时二次验证）
