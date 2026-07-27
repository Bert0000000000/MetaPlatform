# Tech Java Legacy - 旧 Java 模块归档

> **最后更新**：2026-07-27（v3.0 文档重构 + Java 模块归档）
>
> ⚠️ **本目录下所有 Java 模块已废止**，**不要**用于新开发。
>
> **仅用于**：
> - 决策追溯（为什么 v3.0 决定用 Python 重写）
> - 参考现有 Java 实现（v3.0 Python 版本要重写类似功能）
> - 提取历史业务逻辑

## 归档原因

2026-07-27 **v3.0 Plan D Polyglot Microservice Architecture** 正式发布，**主后端语言从 Java 改为 Python**（FastAPI + LangChain）。

| 模块 | 之前（Java） | **现在（Python / Java）** |
|---|---|---|
| 主后端 | Java + Spring Boot | **Python + FastAPI** |
| AI 编排 | SAA | **LangChain** |
| Agent | LangGraph | **LangGraph**（已在 DeerFlow 中） |
| LLM 路由 | Spring AI | **LiteLLM** |
| Ontology | Java + Neo4j | **Python + neo4j-driver** |
| RAG | 自研 Java | **RAGFlow + LightRAG** |
| IAM | Spring Security | **Keycloak**（Java 微服务） |
| BPMN | 无 | **Flowable Service**（Java 微服务） |
| 规则 | 无 | **Drools Service**（Java 微服务） |
| MCP | Java | **Python mcp-sdk** |
| A2A | Java | **Python a2a-sdk** |
| ACTION | Java | **Python** |
| DATA | Java | **Python (SQLAlchemy)** |
| EA | Java | **Python** |
| GW | Java | **Kong / Traefik** |
| MSG | Java | **Pydantic + aiokafka** |
| OBS | Java | **OpenTelemetry Python SDK** |
| RULE | Java | **Drools Service**（Java 微服务） |
| WFE | Java | **Flowable Service**（Java 微服务） |

## 归档模块清单（15 个）

| 模块 | 原职责 | 状态 |
|---|---|---|
| **TECH-A2A** | A2A 协议（Agent 间通信） | 🆕 Python 重写 |
| **TECH-ACTION** | Action 引擎 | 🆕 Python 重写 |
| **TECH-AGENT** | Agent 编排（DeerFlow 集成） | 🆕 Python 重写 |
| **TECH-DATA** | 数据访问层 | 🆕 Python（SQLAlchemy） |
| **TECH-EA** | Enterprise Architecture | 🆕 Python 重写 |
| **TECH-GW** | API Gateway | 🆕 Kong / Traefik（独立） |
| **TECH-IAM** | 身份认证 | 🆕 Keycloak（Java 微服务） |
| **TECH-LLMGW** | LLM 路由 | 🆕 Python（LiteLLM） |
| **TECH-MCP** | MCP 协议 | 🆕 Python（mcp-python-sdk） |
| **TECH-MSG** | 消息基础设施 | 🆕 Python（aiokafka） |
| **TECH-OBS** | 可观测性 | 🆕 Python（OpenTelemetry SDK） |
| **TECH-ONT** | Ontology 引擎 | 🆕 Python（neo4j-driver） |
| **TECH-RAG** | RAG 引擎 | 🆕 Python（LangChain + LlamaIndex） |
| **TECH-RULE** | 规则引擎 | 🆕 Drools Service（Java 微服务） |
| **TECH-WFE** | 工作流引擎 | 🆕 Flowable Service（Java 微服务） |

## 复盘建议

**v3.0 重写时**：
1. 复制相关 **业务逻辑**（不是 Java 语法）
2. 保留 **SQL schema** 和 **API 契约**
3. 重写为 Python + Hexagonal Architecture
4. 用 GoF 23 模式中合适的（Adapter / Builder / Strategy 等）

## 重要：不要做的事

- ❌ **不要**直接拷贝 Java 代码到 Python（语言不同，习语不同）
- ❌ **不要**保留 Java 包名（应改为 Python 命名空间）
- ❌ **不要**直接翻译 JPA 到 SQLAlchemy（数据访问模式不同）
- ❌ **不要**用 Java 的 Exception 模型（应用 Python 异常层次）

## 复盘示例（参考）

### TECH-RAG 的 Python 重写路线

| 原 Java 实现 | v3.0 Python 重写 |
|---|---|
| `HybridSearchService` | `mate-tech-rag/services/hybrid_search.py` |
| `GraphSearchService` | `mate-tech-rag/services/graph_search.py` |
| `DocumentService` | `mate-tech-rag/services/document_service.py` |
| `MilvusClient` | `mate-tech-rag/infrastructure/milvus_client.py` |
| `CitationService` | `mate-tech-rag/services/citation.py` |

---

## 相关链接

- **当前主架构**：[`../../active/specs/2026-07-27-mate-platform-technical-architecture.md`](../../active/specs/2026-07-27-mate-platform-technical-architecture.md)
- **当前文档导航**：[`../../README.md`](../../README.md)
- **v3.0 决策**：见主架构 §1