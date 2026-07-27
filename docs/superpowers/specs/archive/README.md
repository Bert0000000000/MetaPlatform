# Archive - 架构文档归档

> 本目录归档**已被 `../2026-07-27-mate-platform-technical-architecture.md`（v3.0 THE ONE DOC）整合**的历史文档。
>
> **使用原则**：
> - 日常参考请直接看顶层 `2026-07-27-mate-platform-technical-architecture.md`（**THE ONE DOC**）
> - 决策追溯可查阅本目录
> - 本目录文档**不再更新**

## 归档文档清单

| 文档 | 原版本 / 用途 | 当前内容已并入主架构的章节 |
|---|---|---|
| `2026-07-27-mate-platform-technical-architecture-v2.1.md` | **v2.1 主架构**（Java 主力 + Python AI + 14 业务场景） | 演进为 v3.0（Polyglot Microservice） |
| `2026-07-27-mate-platform-rag-architecture.md` | RAG 子系统主架构（v1 整合） | §6.1 RAGFlow, §6.2 LightRAG, §9 RAG 子系统 |
| `2026-07-27-v2-tech-stack-decision.md` | v2 技术栈决策 | 演进为 v3.0（语言无关注） |
| `2026-07-27-ragflow-graphrag-integration-a.md` | A 方案整体方向 | §6.1 RAGFlow, §9.1 数据流 |
| `2026-07-27-lightrag-integration.md` | LightRAG 详细集成 | §6.2 LightRAG, §9.2 数据流 |
| `2026-07-27-rag-graphrag-best-solution.md` | v1 GraphRAG 方案 | 🗑️ 已废止（仅作决策历史） |
| `2026-07-27-platform-rag-technical-architecture.md` | v1 全 Java 架构 | 🗑️ 已废止（v2.0 决策推翻） |

## 当前主架构版本

**v3.0 (2026-07-27) - Plan D Polyglot Microservice Architecture**

核心特点：
- 主后端 Python（FastAPI + LangChain）
- AI 子域 Python（RAGFlow / LightRAG / DeerFlow）
- 企业引擎 Java 服务化（Flowable / Drools / Keycloak）
- 基础设施统一（TECH-LLMGW / TECH-IAM / TECH-OBS / Nacos）

## 归档时间线

| 时间 | 事件 |
|---|---|
| 2026-07-27 上午 | v1 方案 → v2 决策（"AI 作为技术专家"） |
| 2026-07-27 中午 | v2.0 主架构 + RAGFlow + LightRAG 集成 |
| 2026-07-27 下午 | v2.1（+ 14 业务场景全图）|
| 2026-07-27 晚间 | **v3.0 升为主架构（Plan D Polyglot Microservice）** |
| 2026-07-27 晚间 | v2.0 / v2.1 文档统一归档 |

## 相关文档

- **主架构**：`../2026-07-27-mate-platform-technical-architecture.md`（**THE ONE DOC**）
- **OpenViking 候选**：`../2026-07-27-openviking-future-architecture-candidate.md`（独立主题，保留顶层）
- **法务自评估**：`../../../legal/LEGAL_CLEARANCE-ragflow-2026-07-27.md`（保留在 `docs/legal/`，**不**归档）