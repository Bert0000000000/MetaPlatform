# SPEC - TECH-RAG GraphRAG + 深度文档解析 最佳方案

> 版本：v1.0 | 日期：2026-07-27 | 模块：TECH-RAG（含新建 graphrag / parser-deep 子系统） | 状态：方案定稿
>
> **核心决策**：以 RAGFlow（深度文档解析范式）与 Microsoft GraphRAG（实体抽取 + 社区检测 + 摘要 Map-Reduce 范式）为算法参考，在 Java 21 + Spring AI Alibaba 1.1.2 技术栈上**统一实现**，不引入任何 Python 运行时。
>
> **关联文档**：
> - 既有规范 `TECH-RAG/docs/SPEC-TECH-RAG-RAG引擎API规范_v1.0-20260716.md`（v1 基础）
> - 既有 PRD `docs/prd/APP-KB/PRD-APP-KB-知识库_v1.1-20260722.md`（消费侧）
> - 既有 PRD `docs/prd/APP-ARCH/PRD-APP-ARCH-架构中心_v2.1-20260722.md`（架构资产侧）

---

## 0. 摘要（TL;DR）

| 维度 | 决策 |
|---|---|
| 借鉴对象 | RAGFlow（DeepDoc 思路）+ Microsoft GraphRAG（社区检测 / 全局检索思路） |
| 实现语言 | **Java 21 + Spring AI Alibaba 1.1.2**（守住 v1.2 决策，不引入 Python 运行时） |
| 借鉴方式 | **算法级重写 + 设计思想借鉴**，不复制任何开源代码 |
| 法律风险 | 🟢 低（仅算法/思想借鉴，开源代码零复制；AGPL-3.0 合规边界见 §1.3） |
| 落点 | TECH-RAG 内部新增 `graphrag` / `parser-deep` / `eval` 子包；不动 TECH-ONT / TECH-IAM / TECH-OBS |
| 差异化 | 与现有 Graph-Enhanced（基于 Ontology）**并列共存**，由检索路由层按问题类型分发 |
| 工期 | MVP（Phase 0+1）2 个月；完整版（Phase 0~4）3~4 个月 |
| 投入 | 2 名资深 Java + 1 名算法/数据工程师 + 0.5 名 Prompt/评测工程师 |

---

## 1. 决策与法律边界

### 1.1 为什么"直接引用"是正确的选择

Mate Platform 当前的 RAG 能力（详见既有 RAG 规范 §1.1、§3.4）已具备：
- 向量检索（Milvus 2.5 + SAA VectorStore）
- 关键词检索（BM25）
- 混合检索 + Rerank
- Graph-Enhanced（基于 Ontology 实体链接 + 1~3 跳图谱扩展）
- 引用溯源（Citation + Evidence）

**缺口是工程问题，不是范式问题**。直接借鉴 RAGFlow / Microsoft GraphRAG 的算法思路落地，比从零研究更经济。开源项目的价值是"减少试错"，而不是"减少思考"。

### 1.2 借鉴层级（红线与边界）

| 借鉴层级 | 是否允许 | 用途 | 备注 |
|---|---|---|---|
| 算法思想 / 数据结构 / Prompt 模板设计 | ✅ 允许 | 直接借鉴，重写成 Java | 算法本身非版权保护客体 |
| 数据模型 / Schema / 接口设计 | ✅ 借鉴 | 重写并适配本平台 | 字段命名 / 表结构可重新设计 |
| 文档 / 论文 / 公开博客描述的方法 | ✅ 引用 | 标注来源 | 需在代码注释中写明 `References: ...` |
| 复制开源项目的源代码 | ❌ 禁止 | 不得复制 | 触发对应开源协议 |
| 服务级封装调用（HTTP/gRPC 调用 RAGFlow 实例） | ❌ 禁止 | 不得引入 | 触发 AGPL-3.0 传染 + 破 v1.2 决策 |
| 使用 RAGFlow 自带的 UI / 前端 | ❌ 禁止 | 不得引入 | 与平台前端冲突 |
| 直接 fork / vendor RAGFlow 子模块 | ❌ 禁止 | 不得引入 | 触发 AGPL-3.0 传染 |

### 1.3 开源协议合规性

| 借鉴对象 | 协议 | 我们的方式 | 合规性 |
|---|---|---|---|
| RAGFlow | AGPL-3.0 | 仅借鉴算法/设计，**不复制代码、不服务级包装、不引入二进制** | 🟢 合规 |
| Microsoft GraphRAG | MIT | 仅借鉴算法/设计，**不复制代码** | 🟢 合规 |
| Leiden 算法 | BSD / MIT（论文/实现） | 自研实现或使用 JGraphT（LGPL 2.1，仅动态链接） | 🟢 合规 |
| PaddleOCR 模型权重 | Apache 2.0 | 模型权重可商用，**通过 onnxruntime-java 调用** | 🟢 合规 |
| Apache PDFBox / Tika | Apache 2.0 | 直接使用 | 🟢 合规 |
| JGraphT | LGPL 2.1 + EPL | 动态链接 + 引用声明 | 🟢 合规 |

> **法律边界声明位**：本方案正式立项前需生成 `docs/legal/LEGAL_CLEARANCE-graphrag-ragflow-2026-07-27.md`，由法务签字。**该文件缺失则不得进入 Phase 1 开发**。

### 1.4 与既有决策的兼容性

| 既有决策 | 兼容性 |
|---|---|
| v1.2：全量 Java + Spring AI Alibaba | ✅ 完全兼容，无 Python 运行时引入 |
| v1.2：去 Python 化 | ✅ 守住 |
| v1.3：R2 阶段 6 服务骨架 + Nacos | ✅ 本方案在 TECH-RAG 内部完成 |
| v1.3：R3 阶段 Java + SAA 重写 | ✅ 与本方案并行推进 |
| R4 阶段 MCP / A2A 协议层 | ✅ 新增 API 默认 MCP 暴露 + A2A Agent Card 描述 |
| R5 阶段生产化 | ✅ 包含在 Phase 3 评估/可观测性中 |

---

## 2. 平台场景与最佳方案映射

### 2.1 平台核心场景清单

| 场景 ID | 场景名称 | 主用户 | 典型问题 | 当前能力 | 增强后能力 |
|---|---|---|---|---|---|
| S1 | 数字员工知识库问答 | APP-DW 数字员工 | "劳动合同里关于试用期的条款是怎么说的？" | ✅ 混合检索 | ✅ + 跨文档主题 |
| S2 | Copilot 跨域问答 | APP-COPILOT 终端用户 | "Q3 财报里主要的风险点是什么？" | 🟡 主题型问题召回差 | ✅ Global Search |
| S3 | 架构中心资产问答 | APP-ARCH + SuperAI | "哪些应用系统依赖 PostgreSQL 17？" | ✅ Graph-Enhanced | ✅ 增强 |
| S4 | 制度 / 合同比对 | 法务 / HR / 业务专家 | "对比 2024 与 2025 年合同模板的差异" | ❌ 需要跨文档主题归纳 | ✅ 主题归纳 + Diff |
| S5 | 多模态文档（表格 / 扫描件）解析 | 业务专家 | "上传一份 PDF 财报自动抽取表格" | 🟠 Tika 基础解析 | ✅ 深度解析 |
| S6 | 数字员工冷启动（新知识库） | 业务专家 | "我上传了 1000 份产品手册，能直接用吗？" | 🟠 需要预建 Ontology | ✅ 无需预建 Ontology |

### 2.2 场景 → 方案模块映射

| 场景 | 主要调用 | 关键模块 | 评估指标 |
|---|---|---|---|
| S1 | `/api/v1/rag/retrieve/hybrid` | HybridRetrieveService（已存在） | Recall@10, Answer-Relevance |
| S2 | `/api/v1/rag/retrieve/global` | **GraphRAGService.globalSearch**（新建） | 主题召回率, 摘要质量 |
| S3 | `/api/v1/rag/retrieve/graph` | GraphSearchService（已存在 + 增强） | 实体链接准确率, 扩展相关性 |
| S4 | `/api/v1/rag/retrieve/global` + Diff API | **GraphRAGService + 对比 API** | 主题准确率 |
| S5 | `DocumentIngest.deepParse` | **DeepParserService**（新建） | 表格抽取 F1, 阅读顺序准确率 |
| S6 | 自动建图（无 Ontology 也能跑） | **GraphRAGService.graphBuilder** | 实体抽取 F1, 关系抽取 F1 |

---

## 3. 整体架构

### 3.1 架构总图

```
                                 ┌────────────────────────┐
                                 │   TECH-RAG (Java/SAA)  │
                                 │                        │
   ┌──────────────┐              │  ┌──────────────────┐  │
   │  APP-KB      │  ── KB CRUD ──▶│  KnowledgeBase    │  │
   │  APP-COPILOT │              │  │  Service         │  │
   │  APP-DW      │  ── 检索 ────▶│  │                  │  │
   │  APP-ARCH    │              │  │  DocumentIngest ─┼──┼──┐
   │  APP-MCPHUB  │              │  │  - DeepParser ◀──┼──┼──┘ (Phase 1)
   └──────────────┘              │  │  - Chunking       │  │
                                 │  │                  │  │
                                 │  │  HybridRetrieve  │  │
                                 │  │  GraphSearch     │  │
                                 │  │  GraphRAG ◀──────┼──┼──┐ (Phase 2)
                                 │  │  Citation        │  │
                                 │  │  Evidence        │  │
                                 │  │  Eval ◀──────────┼──┼──┘ (Phase 4)
                                 │  └──────────────────┘  │
                                 │                        │
                                 └───┬──────┬──────┬──────┘
                                     │      │      │
                            ┌────────┘      │      └────────┐
                            ▼               ▼               ▼
                     ┌──────────┐    ┌──────────┐    ┌──────────┐
                     │ Milvus   │    │ Neo4j    │    │PostgreSQL│
                     │ 2.5      │    │ 5.x      │    │ 17       │
                     │ (向量)   │    │ (图谱)   │    │ (元数据) │
                     └──────────┘    └──────────┘    └──────────┘
                                       ▲                 ▲
                                       │                 │
                              ┌────────┴────────┐        │
                              │  TECH-ONT       │        │
                              │  (Ontology      │        │
                              │   概念/关系)    │        │
                              └─────────────────┘        │
                                                         │
                              ┌──────────────────────────┘
                              │
                       ┌──────────────┐
                       │  TECH-LLMGW  │
                       │  (统一 LLM   │
                       │   路由)      │
                       └──────────────┘
```

### 3.2 子系统划分

| 子系统 | 路径 | 状态 | 阶段 | 借鉴对象 |
|---|---|---|---|---|
| 既有 HybridRetrieve | `com.metaplatform.rag.hybrid` | ✅ 已实现 | - | - |
| 既有 GraphSearch（Ontology 增强） | `com.metaplatform.rag.graph` | ✅ 已实现 | - | - |
| **DeepParser（深度文档解析）** | `com.metaplatform.rag.parser.deep` | 🆕 新建 | Phase 1 | RAGFlow DeepDoc |
| **GraphRAG（实体抽取+社区+全局）** | `com.metaplatform.rag.graphrag` | 🆕 新建 | Phase 1-3 | Microsoft GraphRAG |
| **Citation 增强** | `com.metaplatform.rag.citations` | 🔄 增强 | Phase 2 | RAGFlow Citation |
| **Eval（评估）** | `com.metaplatform.rag.eval` | 🆕 新建 | Phase 4 | 自研 + 公开数据集 |

### 3.3 检索路由（核心创新点）

```java
// 设计原则：保留既有 Graph-Enhanced，新增 GraphRAG，按问题类型路由
public interface RetrievalRouter {
    RetrievalResult route(QueryRequest req);
}

@Component
public class DefaultRetrievalRouter implements RetrievalRouter {
    public RetrievalResult route(QueryRequest req) {
        // 1. 意图分类（cheap LLM call or rule-based）
        QueryType type = classify(req);  // FACTUAL / ENTITY / THEMATIC / MIXED
        
        return switch (type) {
            case FACTUAL  -> hybridSearch(req);            // 现有能力
            case ENTITY   -> graphEnhancedSearch(req);     // 现有 Graph-Enhanced
            case THEMATIC -> graphRAGService.globalSearch(req);  // 新增
            case MIXED    -> combine(                       // 组合
                hybridSearch(req),
                graphEnhancedSearch(req),
                graphRAGService.globalSearch(req)
            );
        };
    }
}
```

**路由策略**（按问题分类分发）：
- **FACTUAL**（事实型："X 是什么"）→ HybridRetrieve
- **ENTITY**（实体型："哪些应用依赖 X"）→ GraphEnhanced（基于 Ontology）
- **THEMATIC**（主题型："Q3 主要讲了什么"）→ GraphRAG GlobalSearch
- **MIXED** → 三路并行 + RRF 融合

---

## 4. 工程包设计

### 4.1 Phase 1：DeepParser（深度文档解析）

**包结构**：
```
com.metaplatform.rag.parser.deep/
├── DeepParserService.java            # 总入口
├── layout/
│   ├── LayoutAnalyzer.java           # 版面分析（标题/段落/列表/表格检测）
│   ├── ReadingOrderResolver.java     # 阅读顺序还原（中英文版式）
│   └── BoundingBox.java              # 坐标抽象
├── ocr/
│   ├── OcrEngine.java                # OCR 抽象接口
│   ├── PaddleOcrEngine.java          # onnxruntime-java 实现
│   └── OcrResult.java
├── table/
│   ├── TableExtractor.java           # 表格抽取
│   ├── TableStructureRecognizer.java # TSR 模型调用
│   └── TableDto.java
├── reader/
│   ├── PdfReader.java                # PDFBox 包装
│   ├── WordReader.java               # Tika + docx4j
│   ├── ExcelReader.java              # Apache POI
│   └── MarkdownReader.java
└── pipeline/
    ├── ParsingPipeline.java          # 编排：Reader → OCR → Layout → Table
    └── ParsedDocument.java           # 统一输出
```

**关键算法**（借鉴 RAGFlow DeepDoc 思想）：
1. **版面分析**：基于文本块坐标 + 字号 + 加粗，启发式 + 规则识别标题层级
2. **OCR**：onnxruntime-java 加载 PaddleOCR 检测+识别 ONNX 模型
3. **表格识别**：TableStructureRecognizer（公开模型，如 PubTabNet）抽取表格结构
4. **阅读顺序**：基于块坐标的中文版面排序（左→右、上→下、列优先/行优先自适应）

**输出格式**（统一 ParsedDocument）：
```json
{
  "docId": "uuid",
  "sections": [
    {
      "id": "sec-1",
      "title": "第三章 违约责任",
      "level": 1,
      "content": "...",
      "tables": [{"rows": [[...]], "caption": "..."}],
      "figures": [{"caption": "...", "pageRef": 5}],
      "pageRange": [3, 5],
      "bbox": [{"x": 0, "y": 0, "w": 100, "h": 50, "page": 3}]
    }
  ],
  "metadata": {"source": "...", "pageCount": 12, "format": "pdf"}
}
```

**评估指标**：
- 表格抽取 F1（对比 Gold Standard）
- 阅读顺序准确率（人工标注 100 样本）
- OCR 字符错误率 CER（仅扫描件场景）
- P95 解析延迟（目标：1MB PDF < 3s）

### 4.2 Phase 1：GraphRAG 核心

**包结构**：
```
com.metaplatform.rag.graphrag/
├── GraphRAGService.java              # 总入口
├── builder/
│   ├── GraphBuilder.java             # Chunk → 实体-关系
│   ├── EntityExtractor.java          # LLM 实体抽取
│   ├── RelationExtractor.java        # LLM 关系抽取
│   └── ExtractionPromptTemplate.java # 借鉴 Microsoft GraphRAG prompt
├── community/
│   ├── CommunityDetector.java        # Leiden/Louvain 算法
│   ├── LeidenAlgorithm.java          # 自研 Leiden（基于 JGraphT）
│   ├── CommunityHierarchy.java       # 层次化社区树
│   └── Community.java
├── summary/
│   ├── CommunitySummarizer.java      # Map-reduce 摘要
│   ├── SummaryGenerator.java         # 单社区摘要
│   └── SummaryReducer.java           # 跨社区聚合（用于 Global Search）
├── search/
│   ├── LocalSearch.java              # 实体聚焦检索
│   ├── GlobalSearch.java             # 社区摘要检索
│   ├── DriftSearch.java              # Local + Global 混合（Phase 3）
│   └── SearchRouter.java             # 三种模式路由
├── storage/
│   ├── Neo4jGraphStore.java          # Neo4j 适配
│   ├── GraphNode.java                # 节点 DTO
│   ├── GraphEdge.java                # 关系 DTO
│   └── CommunityRepository.java      # 社区/摘要持久化
└── incremental/
    ├── IncrementalUpdater.java       # 增量更新（Phase 3）
    └── DiffCalculator.java           # 文档 diff → 局部重建
```

**核心数据流**：

```
Documents (Chunks)
    │
    ▼
GraphBuilder
    ├─ EntityExtractor.llmExtract(chunk) → List<Entity>
    ├─ RelationExtractor.llmExtract(chunk, entities) → List<Relation>
    └─ Neo4jGraphStore.upsert(nodes, edges)
            │
            ▼
       Neo4j Graph
            │
            ▼
CommunityDetector.leiden(graph) → Community[]
            │
            ▼
CommunitySummarizer
    ├─ For each community:
    │     SummaryGenerator.llmSummarize(community) → summary
    └─ Save to PG: community_summaries(community_id, level, summary, embedding)
            │
            ▼
  Retrieval Index Ready
```

### 4.3 Phase 2：Citation 增强

**借鉴数据模型**（重写为 Java Record）：
```java
public record Citation(
    String id,
    CitationLevel level,            // CHUNK / SENTENCE / ENTITY / RELATION
    String sourceDocId,
    int pageNumber,
    String sectionId,
    String textSnippet,             // 摘录（≤ 200 字）
    BoundingBox bbox,               // 物理坐标
    List<EntityRef> entities,       // 涉及的实体
    List<RelationRef> relations,    //涉及的关系
    double confidence
) {}

public record Evidence(
    String claim,                   // 答案的某个声明
    List<Citation> citations,       // 支持该声明的引用
    CitationChain chain             // 引用链（chunk → sentence → entity → relation）
) {}
```

**前端绑定**：与现有 `AntV X6` 集成，引用可视化可点击跳转原文坐标。

### 4.4 Phase 4：Eval 评估子系统

**评估框架**：
```
com.metaplatform.rag.eval/
├── BenchmarkCorpus.java            # 内置对比语料（50~100 真实样本）
├── RetrievalEvaluator.java         # Recall@K / MRR / NDCG
├── AnswerRelevanceEvaluator.java   # LLM-as-judge（用 gpt-4 或 qwen-max）
├── LatencyBenchmark.java           # P50/P95/P99
├── CostBenchmark.java              # LLM Token 消耗
└── ReportRenderer.java             # 评估报告（HTML/JSON）
```

**内置语料**（MVP 范围）：
- 50 份真实合同样本
- 30 份制度文件
- 20 份财务报表
- 标注：问题 + 期望答案 + 关键引用段落

---

## 5. 数据模型

### 5.1 Neo4j 新增节点/关系

**新节点类型**（与既有 Ontology 节点类型严格区分，加 `rag_` 前缀）：

| 节点 Label | 字段 | 说明 |
|---|---|---|
| `rag_chunk` | id, doc_id, kb_id, content, position | 文档切片（图谱的最小单元） |
| `rag_entity` | id, name, type, description, embedding | 自动抽取的实体 |
| `rag_community` | id, level, parent_id, summary, summary_embedding | 社区（多层级） |
| `rag_document` | id, kb_id, title, source | 文档元数据 |

**新关系类型**：

| 关系 Type | 起点 | 终点 | 字段 |
|---|---|---|---|
| `rag_mentions` | rag_chunk | rag_entity | weight, position |
| `rag_related_to` | rag_entity | rag_entity | relation_type, description, weight |
| `rag_belongs_to` | rag_chunk | rag_community | level |
| `rag_contains` | rag_community | rag_community | level_diff |
| `rag_part_of` | rag_chunk | rag_document | order |

**与既有 Ontology 图谱的关系**：
- **严格隔离**：`rag_*` 节点 Label 永远不与 Ontology 概念/实体混用
- **可选桥接**：通过 `kbId.ontologyConceptCode` 显式桥接（业务侧主动配置）
- **不要试图合并**：自动抽取的实体 vs 人工建模的概念，**质量、口径、用途都不同**

### 5.2 PostgreSQL 新增表

```sql
-- 社区摘要表
CREATE TABLE rag_community_summary (
    id              BIGSERIAL PRIMARY KEY,
    community_id    VARCHAR(64) NOT NULL,
    level           SMALLINT NOT NULL,         -- 0=leaf, 1, 2, ...
    kb_id           VARCHAR(64) NOT NULL,
    summary         TEXT NOT NULL,
    summary_emb     vector(1024),              -- pgvector 或单独存 Milvus
    entity_count    INTEGER,
    chunk_count     INTEGER,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(community_id, level, kb_id)
);
CREATE INDEX idx_community_kb ON rag_community_summary(kb_id, level);

-- 抽取任务状态表
CREATE TABLE rag_extraction_task (
    id              BIGSERIAL PRIMARY KEY,
    doc_id          VARCHAR(64) NOT NULL,
    kb_id           VARCHAR(64) NOT NULL,
    status          VARCHAR(20) NOT NULL,      -- PENDING / RUNNING / DONE / FAILED
    extracted_entities  INTEGER,
    extracted_relations  INTEGER,
    error_message   TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ
);

-- 评估结果表
CREATE TABLE rag_eval_result (
    id              BIGSERIAL PRIMARY KEY,
    eval_set        VARCHAR(50) NOT NULL,      -- benchmark-corpus-v1
    method          VARCHAR(30) NOT NULL,      -- hybrid / graph-enhanced / graphrag-global / graphrag-local / drift
    metrics         JSONB NOT NULL,           -- {recall_at_10: 0.78, ...}
    config          JSONB,                    -- 当时的配置快照
    run_at          TIMESTAMPTZ DEFAULT now()
);
```

### 5.3 Milvus 新增 Collection

| Collection | 字段 | 说明 |
|---|---|---|
| `rag_community_summary_vec` | id, kb_id, level, embedding(1024) | 社区摘要向量（用于 Global Search 召回） |
| `rag_entity_vec` | id, kb_id, embedding(1024) | 实体向量（用于 Local Search 召回） |

---

## 6. API 设计

> 命名沿用既有规范 `v1.0` 的路径风格：`/api/v1/rag/*`。本节仅列新增或增强的 API。

### 6.1 文档解析增强

```http
POST /api/v1/rag/documents/{docId}/reparse
Content-Type: application/json
Authorization: Bearer {token}

{
  "parser": "DEEP",              // BASIC | DEEP（DEEP = DeepParser）
  "options": {
    "ocrEnabled": true,
    "tableExtraction": true,
    "language": "zh-CN"
  }
}

→ 202 Accepted
{
  "taskId": "uuid",
  "status": "PENDING"
}
```

### 6.2 GraphRAG 检索

```http
POST /api/v1/rag/retrieve/global
Content-Type: application/json
Authorization: Bearer {token}

{
  "query": "Q3 2024 财报里主要的风险点是什么？",
  "kbIds": ["kb-finance-2024"],
  "topK": 10,
  "communityLevel": 1,           // 0=最细, 1, 2
  "maxCommunities": 5,           // 参与的社区数
  "mapReduceBatch": 3            // Map 阶段并发
}

→ 200 OK
{
  "answer": "...",               // 来自 map-reduce 聚合
  "communities": [
    {
      "id": "comm-123",
      "level": 1,
      "summary": "...",
      "entities": [...],
      "citations": [...]
    }
  ],
  "traceId": "trace-xxx"
}
```

```http
POST /api/v1/rag/retrieve/local
Content-Type: application/json
{
  "query": "违约责任条款如何界定？",
  "kbIds": ["kb-contracts"],
  "topK": 10,
  "entityLinking": true,         // 启用 TECH-ONT 实体链接
  "expandDepth": 2
}
```

```http
POST /api/v1/rag/retrieve/drift          // Phase 3
{
  "query": "...",
  "kbIds": [...],
  "driftIterations": 3,
  "localWeight": 0.6,
  "globalWeight": 0.4
}
```

### 6.3 统一检索入口（含路由）

```http
POST /api/v1/rag/retrieve
{
  "query": "...",
  "kbIds": [...],
  "mode": "AUTO",                 // AUTO | HYBRID | GRAPH_ENHANCED | GRAPHRAG_LOCAL | GRAPHRAG_GLOBAL | DRIFT
  "topK": 10
}

→ 200 OK
{
  "answer": "...",
  "mode": "GRAPHRAG_GLOBAL",      // AUTO 路由后实际选择的模式
  "results": [...],
  "evidences": [...],
  "traceId": "..."
}
```

**`mode: AUTO` 的路由策略**（见 §3.3）：
- 意图分类（cheap LLM call）
- 规则兜底：包含 "对比 / 总结 / 主要 / 主题" → THEMATIC
- 包含 "哪些 / 谁 / 依赖 / 关系" → ENTITY
- 其他 → FACTUAL

### 6.4 知识库配置增强

```http
PATCH /api/v1/rag/knowledge/{kbId}/config
{
  "graphragEnabled": true,         // 启用 GraphRAG 自动建图
  "deepParserEnabled": true,       // 启用深度解析
  "graphragConfig": {
    "extractionModel": "qwen-max",
    "summaryModel": "qwen-turbo",  // 摘要用便宜模型
    "communityLevels": 2,
    "incrementalUpdate": true
  }
}
```

### 6.5 管理 API

```http
POST /api/v1/rag/graphrag/rebuild/{kbId}      # 全量重建
POST /api/v1/rag/graphrag/refresh/{docId}     # 增量刷新
GET  /api/v1/rag/graphrag/status/{kbId}       # 索引状态
GET  /api/v1/rag/graphrag/communities/{kbId}  # 社区列表（用于可视化）
```

---

## 7. 核心算法实现要点

### 7.1 Leiden 社区检测

**自研实现路径**（推荐）：
- 输入：Neo4j 图（节点 + 边 + 边权重）
- 步骤：LocalMoving → Refinement → Aggregation
- 输出：层次化社区（多 level）
- 包：`com.metaplatform.rag.graphrag.community.LeidenAlgorithm`
- 依赖：JGraphT（LGPL 2.1，仅 dynamic-link）或自研（~500 行）

**算法要点**（参考 Blondel et al. 2008 + Traag et al. 2019）：
1. 节点局部移动到邻居社区（最大化模块度）
2. 社区合并成超级节点
3. 重复直到稳定
4. 展开回原图（refinement 阶段）

**性能目标**：100K 节点 / 500K 边的图，P95 < 30s

### 7.2 LLM 实体抽取 Prompt 模板

**借鉴 Microsoft GraphRAG 的 prompt 设计思路**（**重写 Java 字符串模板，不复制源码**）：

```
You are an expert at extracting entities and relationships from text.
Extract all named entities and the relationships between them.

<entity_types>
- PERSON / ORG / LOCATION / DATE / MONEY / CONTRACT / REGULATION / SYSTEM / CONCEPT
</entity_types>

<text>
{chunk_content}
</text>

Return JSON format:
{
  "entities": [{"name": "...", "type": "...", "description": "..."}],
  "relations": [{"source": "...", "target": "...", "type": "...", "description": "..."}]
}
```

**优化策略**：
- Map-Reduce：长文档先分块抽取，再合并去重
- 批量并发：每批 10~20 个 chunk 并发抽取
- 缓存：相同 chunk 文本直接复用抽取结果（Redis TTL 7 天）

### 7.3 Global Search 实现

```
Query
  ↓
Query → Embedding → 向量召回社区摘要 Top-K（Milvus rag_community_summary_vec）
  ↓
For each 候选社区:
  summary + related entities + related chunks
  ↓
  Map 阶段：LLM 根据每个社区生成"该社区如何回答该问题"的 partial answer
  ↓
Reduce 阶段：LLM 聚合所有 partial answer → 最终答案 + 引用
  ↓
Answer + Citations
```

**Token 控制**：
- Map 阶段每个社区摘要 ≤ 500 token 输入
- 候选社区数 ≤ 5（默认）
- Reduce 阶段输入 ≤ 3000 token
- 总成本：5 社区 × (500 + 200) + 3000 ≈ 7000 token/查询

---

## 8. 实施路线图

### Phase 0：基线评估（1 周）

**目标**：用现有 RAG 跑出 Recall@K / Answer-Relevance 基线数字。

**交付物**：
- `eval/benchmark-corpus-v1.json`：50 份真实样本 + 标注
- `eval/baseline-report.md`：现有能力的数字
- `docs/legal/LEGAL_CLEARANCE-graphrag-ragflow-2026-07-27.md`（**Phase 1 启动前置条件**）

**负责人**：1 名 Java + 0.5 Prompt 工程师

**评估问题**：
1. 在 S1~S6 场景上，现有 RAG 的 Recall@10 是多少？
2. 在 S2（主题型）场景上，现有 RAG 是不是真的有明显缺陷？（用数据说话）
3. Token 成本现状：每查询平均多少 LLM Token？

### Phase 1：MVP 关键路径（4~5 周）

**目标**：跑通"自动建图 + 全局检索"主链路，验证 S2 / S4 / S6 场景。

**交付物**：
- `parser.deep.DeepParserService`（仅 PDF + Word）
- `graphrag.builder.GraphBuilder`（LLM 抽取 → Neo4j 写入）
- `graphrag.community.LeidenAlgorithm`（自研实现 + 单测覆盖）
- `graphrag.summary.CommunitySummarizer`（Map-reduce）
- `graphrag.search.GlobalSearch`（基础版）
- `POST /api/v1/rag/retrieve/global` API
- `POST /api/v1/rag/documents/{id}/reparse` API
- 单元测试 + 集成测试（覆盖 80%）

**评估**：
- S2 场景 Recall@10 提升 ≥ 20%
- 文档解析准确率：表格抽取 F1 ≥ 0.85
- 全局检索 P95 延迟 ≤ 5s

**风险点**：
- 摘要 Token 成本可能超预算 → 限制社区数 + 用便宜模型
- Leiden 自研实现可能踩坑 → 准备 JGraphT 备选
- LLM 抽取质量不稳 → 准备 prompt 迭代 A/B 框架

### Phase 2：路由 + 本地检索（2~3 周）

**目标**：实现统一检索入口 + Local Search + 与 Ontology 协同。

**交付物**：
- `graphrag.search.LocalSearch`
- `search.RetrievalRouter`（AUTO 模式路由）
- `POST /api/v1/rag/retrieve` 统一 API
- `POST /api/v1/rag/retrieve/local` API
- Citation 增强（多层 Evidence）

**评估**：
- S1 / S3 场景不能 regression（路由后 Recall@10 不能下降）
- S4 场景支持主题归纳

### Phase 3：增量更新 + DRIFT（2~3 周）

**目标**：支持文档新增/删除/更新时的局部重建。

**交付物**：
- `graphrag.incremental.IncrementalUpdater`
- `graphrag.search.DriftSearch`
- `POST /api/v1/rag/retrieve/drift` API
- 重建任务调度（基于 Kafka / TECH-MSG）

**评估**：
- 增量重建延迟 ≤ 1 分钟/文档
- DRIFT Search 在 S4 复杂问题上的表现

### Phase 4：评估 + 调优（持续）

**目标**：建立持续评估与回归防护。

**交付物**：
- `eval.RetrievalEvaluator`（Recall@K / MRR / NDCG）
- `eval.AnswerRelevanceEvaluator`（LLM-as-judge）
- 评估数据集 v1（50 样本）→ v2（200 样本）
- CI 集成：每次 PR 跑 baseline 对比

---

## 9. 关键决策点（需用户/架构组确认）

| 决策点 | 建议 | 影响 | 时机 |
|---|---|---|---|
| **D1**：借鉴 RAGFlow + Microsoft GraphRAG 算法 + Java 重写 | ✅ 推荐 | 决定一切 | 本方案确认前 |
| **D2**：不引入 Python 运行时（守住 v1.2 决策） | ✅ 推荐 | 影响文档解析能力 | 本方案确认前 |
| **D3**：法律合规边界（仅借鉴思想/算法，不复制代码） | ✅ 推荐 | 决定能否立项 | Phase 0 前 |
| **D4**：Leiden 自研 vs JGraphT | 倾向 JGraphT（成熟） | 影响工期 | Phase 1 启动前 |
| **D5**：摘要模型选 qwen-turbo | 性价比高 | 影响成本/质量 | Phase 1 启动前 |
| **D6**：是否并行跑 Phase 0 + Phase 1 的部分设计 | 建议串行 | 影响工期 | Phase 0 启动前 |
| **D7**：GraphRAG 与现有 Graph-Enhanced 的关系 | 并列共存，按路由分发 | 决定架构 | Phase 1 设计前 |
| **D8**：是否在 R4 阶段把 GraphRAG 能力通过 MCP / A2A 暴露给外部 Agent | 建议默认暴露 | 决定 API 形态 | Phase 1 设计前 |

---

## 10. 风险与缓解

| 风险 ID | 风险 | 等级 | 缓解 |
|---|---|---|---|
| R1 | LLM 抽取实体/关系质量不稳定 | 高 | 准备 prompt A/B 框架；准备 few-shot 模板库 |
| R2 | 摘要 Token 成本超预算 | 高 | 限制社区数 + 用便宜模型 + 摘要分级缓存 |
| R3 | Leiden 自研实现踩坑 | 中 | JGraphT 备选 + 详细单测 |
| R4 | 与既有 Graph-Enhanced 重复建设 | 中 | 严格划分：Graph-Enhanced 走 Ontology 路线，GraphRAG 走自动建图路线 |
| R5 | Neo4j GDS 社区版功能受限 | 中 | 用 JGraphT 替代 GDS 做 Leiden |
| R6 | PaddleOCR 在 onnxruntime-java 下精度损失 | 中 | 模型权重公开，理论上无差异；如有损失，引入 python-bridge 仅做 OCR |
| R7 | AGPL-3.0 法律风险 | 低 | 仅借鉴算法/设计，不复制代码；法务签字 |
| R8 | Phase 1 工期内 v1.3 重构期冲突 | 中 | 与 R1~R3 主线错峰推进 |
| R9 | 评估数据样本不足 | 中 | 50 真实样本起步，逐步扩到 200+ |
| R10 | LLM 厂商变更影响 | 低 | 全部 LLM 调用走 TECH-LLMGW |

---

## 11. 度量指标（KPI）

### 11.1 质量指标

| 指标 | 现状（基线） | Phase 1 目标 | Phase 4 目标 |
|---|---|---|---|
| S1 Recall@10 | TBD（Phase 0 测） | 不 regression | 不 regression |
| S2 Recall@10（主题型） | 显著低 | ≥ +20% | ≥ +50% |
| S3 实体链接准确率 | TBD | ≥ 0.90 | ≥ 0.95 |
| S4 主题归纳准确率 | N/A | 人工评估 ≥ 0.80 | ≥ 0.90 |
| S5 表格抽取 F1 | TBD | ≥ 0.85 | ≥ 0.92 |

### 11.2 性能指标

| 指标 | 目标 |
|---|---|
| Local Search P95 | ≤ 1.5s |
| Global Search P95 | ≤ 5s（5 社区场景） |
| DRIFT Search P95 | ≤ 8s |
| DeepParser（1MB PDF）P95 | ≤ 3s |
| 增量重建（单文档） | ≤ 60s |

### 11.3 成本指标

| 指标 | 目标 |
|---|---|
| Global Search 单查询 LLM Token | ≤ 7000 |
| 社区摘要生成（每 1000 文档） | ≤ 5M Token（一次性） |
| 实体抽取（每 1000 文档） | ≤ 2M Token（一次性） |

---

## 12. 依赖清单

### 12.1 新增 Maven 依赖

```xml
<!-- 文档解析 -->
<dependency>
    <groupId>org.apache.pdfbox</groupId>
    <artifactId>pdfbox</artifactId>
    <version>3.0.3</version>
</dependency>
<dependency>
    <groupId>org.apache.tika</groupId>
    <artifactId>tika-core</artifactId>
    <version>2.9.2</version>
</dependency>
<dependency>
    <groupId>com.microsoft.onnxruntime</groupId>
    <artifactId>onnxruntime</artifactId>
    <version>1.18.0</version>
</dependency>

<!-- 图算法 -->
<dependency>
    <groupId>org.jgrapht</groupId>
    <artifactId>jgrapht-core</artifactId>
    <version>1.5.2</version>
</dependency>

<!-- 已有的（不新增） -->
<dependency>Spring AI 1.1.2</dependency>
<dependency>Spring AI Alibaba 1.1.2.0</dependency>
<dependency>Spring Data Neo4j</dependency>
<dependency>Milvus SDK 2.5</dependency>
```

### 12.2 模型资源（合规可用）

| 模型 | 用途 | 协议 |
|---|---|---|
| PaddleOCR (det/rec) | OCR | Apache 2.0 |
| TableStructureRecognizer (PubTabNet) | 表格识别 | Apache 2.0 |
| PaddleLayout（可选） | 版面分析 | Apache 2.0 |

### 12.3 借鉴参考（不复制代码）

| 参考 | 借鉴内容 | 协议 |
|---|---|---|
| Microsoft GraphRAG | Leiden + Map-reduce 摘要 + Local/Global/DRIFT 三模式 | MIT |
| RAGFlow | DeepDoc 文档解析思路 | AGPL-3.0（仅参考） |
| Leiden 算法论文 (Traag et al. 2019) | 算法实现 | 公开论文 |

---

## 13. 文档维护

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 | 2026-07-27 | 初版方案定稿 |

---

**下一步行动**（按推荐路径）：

1. **本周内**：法务启动 `LEGAL_CLEARANCE` 流程
2. **下周**：启动 Phase 0（基线评估）— 1 周工期
3. **Phase 0 完成后**：根据基线数据决定是否进入 Phase 1
4. **Phase 1 启动前**：本方案需要架构组 review + 项目 owner 签字

---

**相关 Review 入口**：
- 法务：`docs/legal/LEGAL_CLEARANCE-graphrag-ragflow-2026-07-27.md`（待创建）
- 架构组：本文件 §9 决策点 D1~D8
- 项目 Owner：Phase 0/1 启动批准