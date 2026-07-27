# Legacy - 文档归档

> **最后更新**：2026-07-27（v3.0 文档重构）
>
> ⚠️ **本目录下所有文档已废止**，**不要**用于新决策。
>
> **仅用于**：
> - 决策追溯（为什么某个决定被废止）
> - 提取历史业务需求

## 归档原因

2026-07-27 **v3.0 Plan D Polyglot Microservice Architecture** 正式发布，原有架构（v1.2 / v2.0 / v2.1）已演进为 v3.0：

| 版本 | 决策 | 状态 |
|---|---|---|
| v1.2 | "全量 Java + SAA，去 Python" | ❌ 已废止 |
| v2.0 | "Java 主力 + Python AI 子域" | ❌ 已演进 |
| v2.1 | v2.0 + 14 业务场景全图 | ❌ 已演进 |
| **v3.0** | **Polyglot Microservice（Python 主 + Java 引擎服务）** | ✅ **当前** |

## 归档文档清单

### v2.1 主架构（最终演进版）

| 文档 | 原用途 |
|---|---|
| `2026-07-27-mate-platform-technical-architecture-v2.1.md` | v2.1 主架构（Java 主力 + Python AI + 14 场景） |

### v2.0 文档（v2.1 之前）

| 文档 | 原用途 |
|---|---|
| `2026-07-27-mate-platform-rag-architecture.md` | RAG 子系统主架构（v1 整合） |
| `2026-07-27-v2-tech-stack-decision.md` | v2 技术栈决策 |
| `2026-07-27-ragflow-graphrag-integration-a.md` | RAGFlow 集成方案 |
| `2026-07-27-lightrag-integration.md` | LightRAG 详细集成 |

### v1 文档（最初方案，已废止）

| 文档 | 原用途 |
|---|---|
| `2026-07-27-rag-graphrag-best-solution.md` | v1 GraphRAG 方案 |
| `2026-07-27-platform-rag-technical-architecture.md` | v1 全 Java 架构 |

## 演进时间线

| 时间 | 事件 |
|---|---|
| 2026-07-21 | v1.2 决策：全量 Java |
| 2026-07-22 | 文档重构期开始 |
| 2026-07-25 | FlowGram 全能力补齐 |
| 2026-07-26 | DeerFlow 集成规划 |
| 2026-07-27 上午 | v2.0 主架构 + RAGFlow + LightRAG 集成 |
| 2026-07-27 中午 | v2.1 主架构 + 14 业务场景全图 |
| 2026-07-27 下午 | **v3.0 Plan D Polyglot Microservice** 升为正式主架构 |
| 2026-07-27 晚间 | GoF 23 个设计模式并入主架构 |
| 2026-07-27 晚间 | **文档结构重构**（active/ vs legacy/） |

## 相关链接

- **当前主架构**：[`../active/specs/2026-07-27-mate-platform-technical-architecture.md`](../active/specs/2026-07-27-mate-platform-technical-architecture.md)
- **当前文档导航**：[`../README.md`](../README.md)
- **v3.0 决策**：见主架构 §1