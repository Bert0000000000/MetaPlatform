# Mate Platform 文档导航

> **最后更新**：2026-08-25（ADR-0061 Temporal Workflow 架构同步）
>
> **平台状态**：v3.0 GA + v3.1/v4 增量；Temporal 目标架构已接受，Sprint 1A 迁移尚未完成

## 🚀 新成员必读

按顺序阅读这 4 份文档：

1. **项目上下文**：[`CLAUDE.md`](../CLAUDE.md) / [`agent.md`](../agent.md)
2. **主架构**：[`active/specs/2026-07-27-mate-platform-architecture-implementation.md`](active/specs/2026-07-27-mate-platform-architecture-implementation.md) ⭐ **THE ONE DOC**
3. **当前发布计划**：[`active/V1.0-RELEASE-PLAN.md`](active/V1.0-RELEASE-PLAN.md)
4. **PRD 集合**：[`active/prd/`](active/prd/)

## 📁 目录结构

### 🟢 `active/` — 当前活跃（v3.x / v4 增量）

| 子目录 | 内容 |
|---|---|
| [`active/specs/`](active/specs/) | 架构规范、集成规范、设计规范 |
| [`active/prd/`](active/prd/) | 8 个 APP 的业务 PRD（已完成） |
| [`active/legal/`](active/legal/) | 法务自评估、合规备案 |
| [`active/reviews/`](active/reviews/) | 代码评审报告 |
| [`active/plans/`](active/plans/) | 开发计划、阶段任务 |
| [`active/api/`](active/api/) | API 规范、OpenAPI 文档 |
| [`active/runbooks/`](active/runbooks/) | 运维手册 |
| [`active/scenarios/`](active/scenarios/) | 端到端测试场景 |
| [`active/security/`](active/security/) | 安全规范 |
| [`active/user-manual/`](active/user-manual/) | 用户手册 |

### ⚫ `legacy/` — 已废止（v1 / v2）

| 子目录 | 内容 |
|---|---|
| [`legacy/specs/`](legacy/specs/) | v1 / v2 历史架构文档（**不要**用做新决策） |

## 🏗️ 核心架构文档（v3.x）

| 文档 | 说明 |
|---|---|
| [主架构实施版](active/specs/2026-07-27-mate-platform-architecture-implementation.md) | **THE ONE DOC** - v3.x 实施基线 + ADR-0061 Temporal 覆盖层 |
| [技术栈定稿](active/specs/2026-07-27-mate-platform-tech-stack-confirmed.md) | 组件选型、版本线与 Temporal/Flowable 迁移边界 |
| [v3.0 决策导向架构](active/specs/2026-07-27-mate-platform-technical-architecture.md) | 历史决策追溯；其中 Flowable 主引擎描述已被 ADR-0061 覆盖 |
| [OpenViking 候选](active/specs/2026-07-27-openviking-future-architecture-candidate.md) | 待评估的候选方案 |

## 🔑 关键架构决策

| 决策 | 状态 | 说明 |
|---|---|---|
| v1.2 决策（去 Python） | ❌ 已废止 | 详见 legacy/ |
| v2 决策（主力 + AI 子域） | ❌ 已演进 | 详见 legacy/ |
| **v3.0 决策（Polyglot Microservice）** | ✅ **当前** | Python 主后端 + Java 引擎服务化 |
| **ADR-0061（Temporal 业务 Workflow）** | ✅ **Accepted / 待迁移** | Temporal 为可靠编排控制面；PlanRunner 为 DSL 翻译层；Flowable 为双轨期 legacy |
| RAGFlow 集成 | ✅ 自我评估通过 | 仅做 DeepDoc 解析 |
| LightRAG 集成 | ✅ MIT 协议 | GraphRAG 检索 + 实体抽取 |

## 📋 业务 PRD（8 个 APP）

| APP | 说明 | 路径 |
|---|---|---|
| **APP-KB** | 知识库管理 | [active/prd/APP-KB/](active/prd/APP-KB/) |
| **APP-COPILOT** | 智能助手 | [active/prd/APP-COPILOT/](active/prd/APP-COPILOT/) |
| **APP-DW** | 数字员工 | [active/prd/APP-DW/](active/prd/APP-DW/) |
| **APP-ARCH** | 架构中心 | [active/prd/APP-ARCH/](active/prd/APP-ARCH/) |
| **APP-ONTSTUDIO** | 本体建模 | [active/prd/APP-ONTSTUDIO/](active/prd/APP-ONTSTUDIO/) |
| **APP-MCPHUB** | MCP 服务 | [active/prd/APP-MCPHUB/](active/prd/APP-MCPHUB/) |
| **APP-DASHBOARD** | 工作台 | [active/prd/APP-DASHBOARD/](active/prd/APP-DASHBOARD/) |
| **APP-APPHUB** | 应用中心 | [active/prd/APP-APPHUB/](active/prd/APP-APPHUB/) |

## 🚀 开发路线图（6 阶段）

| 阶段 | 周数 | 交付 | 场景 |
|---|---|---|---|
| **P0 基础** | 1 周 | 基线评估 + 环境 | — |
| **P1 RAG MVP** | 3-4 周 | 上传 + 检索 | S1, S3, S8 |
| **P2 知识工程** | 2-3 周 | 抽取 + 审核 | S2 |
| **P3 高级检索** | 2-3 周 | GraphRAG + Router | S3 增强 |
| **Sprint 1A 工作流** | 4 周 | Temporal + PlanRunner DSL + HITL Signal；Flowable 双轨迁移 | S4、长审批、跨域流程 |
| **P5 企业级** | 2-3 周 | 版本/治理/多租户 | S6, S10, S11 |
| **P6 打磨** | 2 周 | 性能 + 文档 | 全部 |

**总计：15-20 周（4-5 月）**

## ⚠️ 重要提示

> **不要看 `legacy/` 里的内容做新决策**。它只用于：
> - 决策追溯（为什么某个决定被废止）
> - 提取历史业务需求
>
> **所有新工作必须基于 `active/` 目录**。
>
> **Workflow 特别规则**：新增可靠业务流程基于 ADR-0061 和主架构 §1.3；旧 Flowable 文档仅用于存量实现、迁移和回滚。Temporal 负责可靠编排，不替代 FastAPI CRUD、Kafka/Outbox、Flink/Airflow、AgentLoop、规则引擎或 K8s 沙箱。

## 🔒 合规

| 文档 | 说明 |
|---|---|
| [法务自评估 RAGFlow](active/legal/LEGAL_CLEARANCE-ragflow-2026-07-27.md) | AGPL-3.0 自评估（已签字） |

## 📊 评审

| 文档 | 说明 |
|---|---|
| [评审报告](active/reviews/) | 各类代码评审与方案评审 |

## 🛠️ 集成规范

| 文档 | 说明 |
|---|---|
| [FlowGram 使用规范](active/specs/flowgram-usage-specification.md) | 流程画布使用 |
| [Flow Canvas 设计](active/specs/2026-07-23-flow-canvas-design.md) | 流程画布设计 |
| [Metaflow 三场景架构](active/specs/2026-07-25-metaflow-three-scenario-architecture.md) | Metaflow 集成 |
| [AI Launch Prompt v1](active/specs/2026-07-26-ai-launch-prompt.md) | AI 启动 Prompt |
| [AI Launch Prompt v2](active/specs/2026-07-26-ai-launch-prompt-batchB.md) | AI 启动 Prompt 增强 |
| [DeerFlow 本地部署](active/specs/2026-07-26-deerflow-local-deploy-guide.md) | DeerFlow 部署 |
| [DeerFlow 生产集成设计](active/specs/2026-07-26-deerflow-production-integration-design.md) | DeerFlow 集成 |
| [Ontology-DeerFlow 集成](active/specs/2026-07-26-ontology-deerflow-engineering-handoff.md) | Ontology 集成 |
| [Ontology-DeerFlow 全栈 E2E](active/specs/2026-07-26-ontology-deerflow-fullstack-e2e-roadmap.md) | E2E 路线图 |
| [Ontology-DeerFlow Phase1 接口](active/specs/2026-07-26-ontology-deerflow-phase1-interfaces.md) | Phase1 接口 |
| [Ontology-DeerFlow Phase1 接口 errata](active/specs/2026-07-26-ontology-deerflow-phase1-interfaces-errata.md) | 勘误 |
| [Ontology Native DeerFlow 最终交付](active/specs/2026-07-26-ontology-native-deerflow-final-delivery-plan.md) | 最终计划 |
| [Ontology Native 集成迁移](active/specs/2026-07-26-ontology-native-deerflow-integration-and-migration-plan.md) | 迁移计划 |
| [Ontology Native 推广](active/specs/2026-07-26-ontology-native-deerflow-rollout-roadmap.md) | 推广路线 |
| [Flow 组件目录](active/specs/flow-component-catalog.md) | 流程组件清单 |
| [Flow 侧边栏分组](active/specs/flow-sidebar-group-accent.md) | 侧边栏分组 |
| [IAM 管理员集成](active/specs/INTEGRATION-MODULE-IAM-ADMIN.md) | IAM 集成 |
| [Nacos 3.0 POC 清单](active/specs/NACOS-3.0-POC-CHECKLIST.md) | Nacos POC |
| [R4 协议 E2E 验证](active/specs/R4-PROTOCOL-E2E-VERIFICATION.md) | R4 协议验证 |
| [R5 Hibernate PG16 兼容](active/specs/R5-HIBERNATE-PG16-COMPAT-REPORT.md) | R5 兼容性 |

## 📞 给 AI Agent 的提示

> 当你（AI）被问及架构决策时：
> 1. **第一参考**：`active/specs/2026-07-27-mate-platform-architecture-implementation.md`
> 2. **当前版本**：v3.x 实施基线；Temporal 目标态已接受、迁移未完成
> 3. **关键路径**：Python 主后端 + Temporal 可靠编排控制面 + 专用执行引擎/AI 服务
> 4. **14 业务场景**：评估完整性的标准
> 5. **Workflow 决策源**：`active/decisions/ADR-0061-temporal-as-workflow-engine.md`
