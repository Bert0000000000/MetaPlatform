# Semantica 深度调研报告

> 项目：semantica-agi/semantica · https://github.com/semantica-agi/semantica
> 调研日期：2026-08-20 · 调研者：Claude (MiniMax-M3)
> 调研目的：为 MetaPlatform 的 MP-SAL（语义层 AI 落地）与 MP-ONT-KERNEL-01（Ontology 12 基元）做对位/可借鉴评估

---

## TL;DR

Semantica（**The Open Source Palantir for AI Agents**）是一个 Python 单体的 "Graph-Native Infrastructure for Context and Accountable AI Systems"，定位 **context graph + decision intelligence + 全链路 provenance**，自标 "Open Source, Self-Hostable, Auditable, Governed"。当前 release **v0.6.5 / PyPI 0.6.0**，GitHub **9,446 stars / 985 forks / 129 open issues**，**MIT**，仓库体积 ~53 MB。19 天前（2026-08-19）仍在持续 push。

与 MetaPlatform 的核心区别：**Semantica 是"开源版 Palantir"路线**（决策留痕 + 合规审计为主轴），**MetaPlatform 是"组织级操作层"路线**（Ontology 作为强 schema 12 基元 + AI 写库前必须 HITL confirm）。两者在 Ontology / KG / RAG 三个交集会形成竞品，借鉴价值集中在 **Provenance（W3C PROV-O）+ Decision Lifecycle + MCP Server 形态 + SHACL/SKOS 复用** 四块。

---

## 1. 项目立项动机与自我定位

| 维度 | 描述 |
|---|---|
| **Logo slogan** | "Graph-Native Infrastructure for Context and Accountable AI Systems" |
| **副标题** | "The Open Source Palantir for AI Agents" |
| **5 大卖点** | Decision Intelligence · Context Management · Deterministic Reasoning · Ontology Management · Knowledge Modeling · End-to-End Traceability |
| **5 大承诺** | Open Source · Self-Hostable · Auditable · Governed · Zero Vendor Lock-In |
| **技术承诺** | Polyglot Graph Storage · RDF + LPG · W3C Standards · Interoperable |
| **目标场景** | "Built for High-Stakes, Regulated Domains"（金融、医疗、政务、合规场景） |
| **GitHub Topics** | agent-memory, ai-governance, context-engineering, context-graphs, decision-intelligence, explainable-ai, graph-rag, knowledge-graph, llm, ontology, provenance, reasoning, semantic-search |

读 self-positioning：核心命题是 **"AI 必须可解释 / 可审计 / 可追责"**，对标 Palantir Foundry 的开放化版本，强调 "PALANTIR OVERVIEW 原文" 的复刻。

> **关键观察**：项目自我命名为 "semantica-agi"，但 CHANGELOG/PyPI 都没有用 AGI 作产品承诺，只是 GitHub org brand。整个 codebase 是 **脚踏实地的 KG 工具**，并未追逐 AGI 叙事。

---

## 2. 仓库健康度（2026-08-19 数据）

| 指标 | 值 | 解读 |
|---|---|---|
| Stargazers | 9,446 | 健康的中型开源，**比 LangChain/LlamaIndex 低 1 个数量级**，但比多数垂直 KG 项目高 |
| Forks | 985 | **fork/星 = 10.4%**，偏高，说明很多人拿去二次开发/自托管 |
| Open Issues | 129 | 活跃维护 |
| Watchers | 51 (subscribers) | vs. Stars 9446 → 比例 0.5%，**说明关注者 < 使用者**，典型"工具型"项目 |
| License | MIT | ✅ 商用 friendly，与 MetaPlatform 一致 |
| Repo size | 53 MB | 内置 static/ 前端 + static/assets + ontology/vocabulary/*.ttl |
| Created | 2025-06-25 | **项目实际年龄仅 14 个月**；能在 14 个月拿到 9.4k stars 是异常值 |
| Last push | 2026-08-19 | 持续维护 |

> **14 个月涨 9k stars 不正常**——很可能有早期 Growth Hacking（README 里挂了 Trendshift 双徽章，且视觉 polished）。**需把"社区真实活跃度"和"市场声量"分开看**。

---

## 3. 架构与数据流（ARCHITECTURE.md 全图还原）

> 注：源文件 ARCHITECTURE.md 在 `raw.githubusercontent.com/semantica-agi/semantica/main/ARCHITECTURE.md`

```
┌─────────── SOURCES ──────────┐
│ File · Web · DB · Cloud · Stream · Dev │
└───────────────┬───────────────┘
                ▼
┌──────── INGEST (semantica.ingest) ────────┐
│ FileIngestor / WebIngestor / DBIngestor /  │
│ ParquetIngestor / StreamIngestor / Repo/    │
│ Email / MCP / Snowflake / Databricks       │
└───────────────┬───────────────┘
                ▼
┌──────── PARSE + NORMALIZE + SPLIT ────────┐
│ semantica.parse → semantica.normalize →    │
│ semantica.split (entity_aware, relation_   │
│  aware, graph_based, ontology_aware,       │
│  hierarchical)                             │
└───────────────┬───────────────┘
                ▼
┌──────── EXTRACT + CONFLICTS + DEDUP ───────┐
│ NamedEntityRecognizer · RelationExtractor  │
│ TripletExtractor · CoreferenceResolver     │
│ ConflictDetector/Resolver · SourceTracker  │
│ DuplicateDetector · EntityMerger           │
└───────────────┬───────────────┘
                ▼
┌──────── KG CONSTRUCTION (semantica.kg) ────┐
│ GraphBuilder · EntityResolver ·            │
│ BiTemporalFact · TemporalGraphQuery        │
└───────────────┬───────────────┘
                ▼
┌──── INTELLIGENCE LAYER (4 路并行入栈) ────┐
│ • Ontology (OWL/SHACL/SKOS)               │
│ • Reasoning (ReteEngine/Datalog/SPARQL)   │
│ • Provenance (W3C PROV-O)                 │
│ • Context & Decisions (Decision Recorder) │
└───────────────┬───────────────┘
                ▼
┌──── STORAGE ──────────────────────────────┐
│ Vector Store: FAISS/Qdrant/Weaviate/      │
│              Milvus/Pinecone/PgVector/    │
│              SQLite-vec + RRF Fusion     │
│ Graph Store: Neo4j/FalkorDB/Apache AGE/   │
│              Amazon Neptune               │
└───────────────┬───────────────┘
                ▼
┌──── OUTPUTS ─────────────────────────────┐
│ Export: RDF/JSON-LD/OWL/SHACL/Parquet/    │
│         Cypher/ArangoDB AQL/GraphML      │
│ Visualize: KG/Ontology/Embedding/Temporal│
│ Services: REST 100+ endpoints ·          │
│           MCP 10+ tools ·                │
│           CLI 50+ commands · Explorer UI │
└─────────────────────────────────────────┘
```

**Decision Intelligence Lifecycle**（ARCHITECTURE.md 第 2 张图）是 Semantica 的**差异化重点**：

```
1️⃣ Record (record_decision)     → 决策节点
        ↓ decision_id
2️⃣ Link (add_causal_relationship) → 因果边
        ↓ causal graph
3️⃣ Query (find_similar_decisions / trace_decision_chain /
         analyze_decision_impact) → 决策语义检索
        ↓ results
4️⃣ Govern (check_decision_rules) → 策略门禁
        ↓ signed-off decisions
5️⃣ Audit Export (W3C PROV-O · CSV · JSON) → 监管取证
```

> **与 MetaPlatform 的关键差异**：MetaPlatform 在 MP-ONT-KERNEL-01/ACTION-03 路线是 **ObjectType / ActionType.apply 强 schema 写库前 HITL confirm**；Semantica 是 **decision_id 节点 + record/link/query/govern/audit 五步松耦合**。前者是 ontology-first，后者是 provenance-first。

---

## 4. 模块全景（22 子包 + 入口）

```
semantica/
├── __init__.py            # 懒加载 _ModuleProxy，子包 dot-notation 访问
├── server.py              # FastAPI + uvicorn (loopback only) + 11 router
├── worker.py              # 占位 worker (time.sleep loop，待补 Celery/RQ)
├── cli.py                 # 174KB CLI（50+ commands）
├── mcp_server/            # MCP over stdio · 11 tools · 3 resources
├── core/                  # Semantica 主类、Orchestrator
├── ingest/                # 6 类数据源 + Snowflake/Databricks/Parquet/Arrow
├── parse/                 # DocumentParser · StructuredDataParser · CodeParser
├── normalize/             # TextNormalizer · EntityNormalizer · Date/Number
├── split/                 # entity_aware · relation_aware · graph_based ·
│                          # ontology_aware · hierarchical
├── semantic_extract/      # NamedEntityRecognizer · RelationExtractor ·
│                          # TripletExtractor · CoreferenceResolver
├── conflicts/             # ConflictDetector · ConflictResolver · SourceTracker
├── deduplication/         # DuplicateDetector · EntityMerger
├── kg/                    # GraphBuilder · CentralityCalculator ·
│                          # CommunityDetector · EntityResolver ·
│                          # BiTemporalFact · GraphValidator
├── ontology/              # 23 文件：OntologyEngine + OWL/SHACL/SKOS +
│                          # Version/Diff/Reuse/CQ/Doc/Associative
├── reasoning/             # ReteEngine · DatalogReasoner · SPARQLReasoner ·
│                          # Abductive + Deductive + ExplanationGenerator
├── provenance/            # ProvenanceManager (W3C PROV-O) · Integrity ·
│                          # BridgeAxiom · Storage · Schemas
├── context/               # ContextGraph · AgentContext · AgentMemory ·
│                          # CausalChainAnalyzer · DecisionRecorder /
│                          # Query/Methods/Models · PolicyEngine · EntityLinker
├── vector_store/          # FAISS/Qdrant/Weaviate/Milvus/Pinecone/PgVector/
│                          # sqlite-vec + RRF fusion
├── graph_store/           # Neo4j/FalkorDB/Neptune/Apache AGE
├── triplet_store/         # RDF(rdflib) + Oxigraph
├── export/                # RDF Turtle · JSON-LD · N-Triples · OWL ·
│                          # SHACL · Parquet · Cypher · ArangoDB ·
│                          # GraphML · CSV · HTML
├── visualization/         # KGVisualizer · OntologyVisualizer ·
│                          # EmbeddingVisualizer · TemporalVisualizer
├── llms/                  # OpenAI/Groq/Gemini/Anthropic/Ollama/DeepSeek/
│                          # LiteLLM/Instructor 适配器
├── embeddings/            # sentence-transformers / fastembed / OpenAI
├── pipeline/              # PipelineBuilder DSL · ExecutionEngine ·
│                          # FailureHandler · ParallelismManager
├── change_management/     # VersionManager · OntologyVersion · ChangeLog
├── seed/                  # Seed data
├── utils/                 # logging · progress · exceptions
├── eval(s)/               # evals
├── explorer/              # Knowledge Explorer FastAPI routers + WebSocket
├── integrations/          # Agno (3 个 cookbook)
└── static/                # React/Vite 静态资源 (Knowledge Explorer SPA)
```

> **可借鉴点**：`context/` 是 **9,400 行级的复杂子包**（context_graph.py 168KB！）。它是把 KG/Decision/Provenance/Ontology 全部聚合的单类，**1 个文件 168KB 是反模式**——值得在 MetaPlatform 内部讨论 "要不要走 ContextGraph 单类聚合" vs "Domain Service 拆解"。

---

## 5. 技术栈（pyproject.toml 全列）

### 核心依赖（默认安装即有）

| 类别 | 关键库 | 版本下限 |
|---|---|---|
| 数值 / ML | numpy, pandas, scipy, scikit-learn, umap-learn | numpy ≥2.0.2, sklearn ≥1.7.2 |
| NLP | spacy ≥3.4, transformers ≥4.20, torch ≥1.13 | LLM 推理基本款 |
| 嵌入 | sentence-transformers ≥2.2, fastembed ≥0.2 | 双轨 |
| 图算法 | networkx ≥2.8 | 纯 Python 图算法 |
| RDF | rdflib ≥6.2 | Python RDF 标准 |
| 向量检索 | faiss-cpu ≥1.7 | 兜底本地向量 |
| 推理 | onnxruntime ≥1.20, tokenizers ≥0.15 | ONNX 推理加速 |
| 数据 IO | pydantic ≥2.13, click, rich, tqdm, structlog, loguru | Python 工程标配 |
| 网络 / 解析 | requests, GitPython, beautifulsoup4, lxml, python-docx, openpyxl, pillow | 全文档格式 |
| 多模态 | librosa, opencv-python | 音频 + 图像 |
| 序列化 | protobuf, grpcio | gRPC 钩子 |

### Optional Extras（按需）

**LLM providers**：`llm-openai`, `llm-groq`, `llm-gemini`, `llm-anthropic`, `llm-ollama`, `llm-deepseek`, `llm-litellm`, `llm-instructor` — **8 个独立 extras**，可用 `semantica[llm-all]`。

**Parsing**：`parse-docling` (Docling ≥2.107) — IBM Docling 是当前最好的 PDF/Office 解析器。

**Graph backends**：`graph-neo4j`, `graph-falkordb` (+redis), `graph-amazon-neptune` (+boto3), `graph-apache-age` (+psycopg2) — **4 大图后端**。

**Vector stores**：`vectorstore-qdrant`, `vectorstore-weaviate`, `vectorstore-pinecone`, `vectorstore-milvus`, `vectorstore-pgvector`, `vectorstore-sqlite` (+sqlite-vec) — **6 大向量库**。

**Triplet store**：`tripletstore-oxigraph` — Rust 高性能 RDF 三元组库。

**Database connectors**：`db-snowflake`, `db-databricks`, `db-arrow`, `ingest-parquet`, `ingest-arrow`。

**Embeddings/models**：`models-huggingface`。

**Infra/Queue**：redis ≥4.3, celery ≥5.2, kafka-python ≥3.0, pulsar-client ≥3.0, pika ≥1.3 — **全消息队列栈**。

**Cloud**：boto3, azure-storage-blob, google-cloud-storage。

**Monitoring**：prometheus-client + opentelemetry-(api/sdk/semantic-conventions/instrumentation) — OpenTelemetry 完整对接。

**Visualization**：pyvis, graphviz, d3blocks。

**GPU**：faiss-gpu, cupy。

**Agent frameworks**：`agno` (推荐) / `crewai` — **特别注释：crewai 因为有 CVE-2026-45829 不进默认 all**（细节见下风险点）。

**Splitting**：`split-tiktoken`, `split-community` (python-louvain), `split-topic` (BERTopic + gensim)。

**Dev**：pytest ≥7.1, pytest-cov, pytest-asyncio, black, isort, flake8, mypy, pre-commit, jupyter, ipykernel。

**Explorer Dashboard**：`explorer` = FastAPI + uvicorn + websockets（REST API + WS 双通道）；`explorer-lite` = Streamlit + streamlit-agraph（轻量版）。

### CLI 入口

```toml
[project.scripts]
semantica        = "semantica.cli:main"        # 50+ commands
semantica-server = "semantica.server:main"     # REST server (loopback 127.0.0.1:8000)
semantica-worker = "semantica.worker:main"     # worker
semantica-explorer = "semantica.explorer:main" # Knowledge Explorer SPA
semantica-mcp    = "semantica.mcp_server:main" # MCP stdio
```

---

## 6. 核心技术点（深挖）

### 6.1 MCP Server（极简自实现 stdio MCP）

`semantica/mcp_server/__init__.py` 是 **24719 字节的自实现 MCP JSON-RPC**，没依赖 mcp / fastmcp 库。提供 **11 个 tools + 3 个 resources**，协议版本 `2024-11-05`：

| Tool | 入参 | 用途 |
|---|---|---|
| `extract_entities` | text | NER |
| `extract_relations` | text | 关系 + 三元组抽取 |
| `record_decision` | category/scenario/reasoning/outcome/confidence (+ valid_from/until) | **落决策** |
| `query_decisions` | query/category/limit | 决策语义检索 |
| `find_precedents` | scenario/max_results | 历史先例检索 |
| `get_causal_chain` | decision_id/direction/max_depth | **因果链上下游追溯** |
| `add_entity` / `add_relationship` | id/label/type 或 source/target/type | 写图 |
| `run_reasoning` | facts/rules | forward-chaining |
| `get_graph_analytics` | — | PageRank + community + node/edge count |
| `export_graph` | format (ttl/nt/xml/json-ld/json) | 导出 |
| `get_graph_summary` | — | 图状态 |

Resources：`semantica://graph/summary` · `semantica://decisions/list` · `semantica://schema/info`。

> **关键借鉴价值**：Semantica 把 MCP server **作为产品入口**（不是 SDK extension）—— `command: semantica-mcp` 直接进 Claude Desktop / Windsurf / Cline / Continue / VS Code。这是 **"以 MCP 为头号界面"** 的设计，对 MetaPlatform 的 MP-INTEGRATION-HUB-01 是直接参考。

### 6.2 Provenance（W3C PROV-O 完整对齐）

`semantica/provenance/` 6 个文件：
- `manager.py` (61KB) — **ProvenanceManager** 主导
- `bridge_axiom.py` — **Bridge axiom**（跨域 provenance 衔接，公理化）
- `integrity.py` — **provenance 完整性证明**（hash 链）
- `storage.py` (37KB) — 落库
- `schemas.py` (18KB) — PROV-O schema 序列化
- `vocabulary` — semantica-ns.ttl 命名空间挂在自己 `https://semantica.dev/ns#`

CHANGELOG 早期重点修复：**RDF/JSON-LD export 必须使用声明过的 vocabulary；entity/relationship IRI 必须确定性（拒绝 Python `hash()` + `PYTHONHASHSEED` 的赌博式 IRI）**。这是典型的 "设计正确性" bug 修复记录，反映团队意识到了 IRI 稳定性对去重/差分/可审计的重要性。

> **可借鉴点**：MetaPlatform 的 MP-AUDIT 是审计，但**没有 provenance 桥接（bridge axiom）+ 完整性证明（hash chain）** 这层抽象。如果未来要做监管/合规场景（GDPR、SOX、HIPAA、AI Act），Semantica 的 provenance/ 是直接可用的 reference impl。

### 6.3 Decision Lifecycle（核心产品创新）

5 步：`Record → Link → Query → Govern → Audit`，每步都有对应 module：

| Step | Module | API |
|---|---|---|
| Record | `context/decision_recorder.py` (24KB) | `graph.record_decision(...)` |
| Link | `context/causal_analyzer.py` (31KB) | `add_causal_relationship(triggers/enables/causes/precedes)` |
| Query | `context/decision_query.py` (56KB) + `agent_memory.py` (81KB) | `find_similar_decisions`, `trace_decision_chain`, `analyze_decision_impact` |
| Govern | `context/policy_engine.py` (42KB) | `check_decision_rules` |
| Audit | `provenance/manager.py` | W3C PROV-O + CSV/JSON |

> **与 MetaPlatform HITL 的关键区别**：
> - Semantica：decision 是 KG 里一个 node（typed "decision"），通过 provenance + policy 治理。**面向 "事后审计"**。
> - MetaPlatform：ActionType 是 schema-level 的 mutation primitive，**写库前 HITL confirm**（ADR-0043 已升格）。**面向 "事前拦截"**。
>
> 两者**正交**：Semantica 是 audit 链，MetaPlatform 是 governance 链。**未来互操作性**：可以在 MP-ACTION-CONFIRM-01 之上加一层 "decision_record"，把 ActionType.apply 落到 audit-friendly 的 provenance。

### 6.4 Ontology（OWL + SHACL + SKOS 完整三大标准）

`semantica/ontology/` 23 个文件，**已覆盖企业级本体的完整能力矩阵**：

- **6-Stage Pipeline**：Semantic Network Parsing → YAML-to-Definition → Definition-to-Types → Hierarchy → TTL → HermiT/Pellet Validation
- **OWL/RDF**：rdflib 包装，对齐 W3C 标准
- **SHACL**：**两阶段** — `to_shacl` 自动生成 shapes / `validate_graph` 运行时校验（pyshacl）
- **SKOS**：`list_vocabularies` / `list_concepts` / `search_concepts` 三个核心查询
- **版本管理**：VersionManager + diff + 影响报告 + 自动 impact analysis（在 change_management/）
- **可复用性**：ReuseManager (FOAF/Dublin Core/Schema.org 已知本体目录查找 + 对齐评分)
- **需求规范**：RequirementsSpec + CompetencyQuestions
- **变更管理**：generate_change_report（嵌套在 kg.graph_validator）

> **可借鉴点**：MetaPlatform MP-ONT-KERNEL-01 当前是 12 Protocol/dataclass 基元 + 60 tests（admission 阶段）。**Semantica 的 ontology 给了"完整 OO 法规模板"作为参照**——特别是：
> - **SHACL 而非自定义 constraint language**（schema-driven validation）
> - **Version Manager with impact analysis**（这是 MP-EMP-EVOLVE-01 的关键依赖）
> - **Reuse Manager 对齐 FOAF/DC/Schema.org**（MP-EMP-EVOLVE-01 的语义对齐基础）
> - **Associative Class**（n-ary 关系的中间类建模，对 MP-ONT 中 LinkType 复杂场景有直接借鉴）

### 6.5 Reasoning（三引擎并存）

`semantica/reasoning/` 8 个文件：
- **ReteEngine** (13KB) — 前向链规则引擎（生产式）
- **DatalogReasoner** (16KB) — Datalog 演绎
- **SPARQLReasoner** (14KB) — SPARQL 推理
- **AbductiveReasoner** (14KB) — 溯因推理（best-explanation）
- **DeductiveReasoner** (18KB) — 演绎
- **ExplanationGenerator** (16KB) — 把推理结果翻译成人话
- **GraphReasoner** (7KB) — 图基础推理（最短路等）

> **可借鉴点**：MetaPlatform 在 v3.0 GA 把 Drools / jBPM 等外部引擎降级后，MP 的 REA 引擎尚未上日程。**Semantica 的 ReteEngine + DatalogReasoner 两线值得做轻量抽出来做 MP-REA-01 候选**——尤其 Datalog 对 ontology-to-data 物化非常合适。

### 6.6 Context（聚合单类，9,400 行级，⚠️ 反模式但有参考价值）

最大的 `context_graph.py` (168KB) 把 Context/Decision/AgentMemory/Provenance/Policy/Schema 全部聚合到一个类。**这是反模式但是起步期常见结构**。优点：单一入口方便 demo；缺点：失忆、难测、难多租。

> MetaPlatform 的设计哲学（13 硬规则 #3 "没有 tenant 上下文不访问 repository"，强制 dependency injection）明确反对这种"上帝对象"。可以**参考其上下文模型字段划分**但**拒绝其聚合度**。

---

## 7. Cookbook（37 个 Notebook 全索引）

> 分布在 `cookbook/introduction/` · `cookbook/advanced/` · `cookbook/integrations/`

### 7.1 Introduction（21 个基础 + 3 个示例文件）

| # | Notebook | 覆盖 |
|---|---|---|
| 01 | Welcome to Semantica | 项目哲学 / QuickStart |
| 02 | Data Ingestion | 6 类数据源接入 |
| 03 | Document Parsing | 多格式解析 |
| 04 | Data Normalization | 文本/实体/日期/数字归一 |
| 05 | Entity Extraction | NER |
| 06 | Relation Extraction | 关系 + 三元组 |
| 07 | Building Knowledge Graphs | KG 构造 |
| 08 | Your First Knowledge Graph | hello-world KG |
| 09 | Graph Store | 4 图后端选型 |
| 10 | Graph Analytics | PageRank + Community |
| 11 | Chunking and Splitting | 5 种切分策略 |
| 12 | Embedding Generation | 多模型嵌入 |
| 13 | Vector Store | 6 向量库 + RRF |
| 14 | Ontology | SHACL/SKOS/OWL |
| 15 | Export | 11 种导出格式 |
| 16 | Visualization | 4 类可视化 |
| 17 | Conflict Detection | 冲突检测 + 解决 |
| 18 | Deduplication | 实体去重 + 合并 |
| 19 | Context Module | ContextGraph + AgentMemory |
| 20 | Triplet Store | RDF 三元组存储 |
| 21 | Amazon Neptune Store | Neptune 实操 |
| — | `config.yaml` `corporate_ontology.ttl` `neptune-setup.yaml` | 示例资源 |

### 7.2 Advanced（13 个）

01_Advanced_Extraction · 02_Advanced_Graph_Analytics · 03_Complete_Visualization_Suite ·
05_Multi_Format_Export · 06_Multi_Source_Data_Integration (66KB，最大) ·
08_Reasoning_and_Inference · 09_Semantic_Layer_Construction · 10_Temporal_Knowledge_Graphs ·
11_Advanced_Context_Engineering · 12_Unstructured_to_Ontology ·
13_Manual_Ontology_Snowflake_Mapping · 14_Datalog_Style_Reasoning ·
Advanced_Vector_Store_and_Search

### 7.3 Integrations / Agno（3 个）

- `agno_decision_intelligence.ipynb` — Agno Agent + Semantica Decision
- `agno_graphrag_context.ipynb` — Agno Agent + GraphRAG
- `agno_multi_agent_shared_context.ipynb` — 多 Agent 共享 Context

> **说明**：README 提到 "37 个" 但实际数到 **37 个 (.ipynb)**（21 + 13 + 3），与 README 一致✅。

---

## 8. 与 MetaPlatform 的对位（核心研判）

### 8.1 12 Ontology 基元对照

| MetaPlatform (MP-ONT-KERNEL-01, ADR-0021) | Semantica 对位 |
|---|---|
| `ClassRef` | 没独立的 class ref 类型；用 rdflib.URIRef |
| `Version` | ✅ VersionManager + `get_ontology_version_dict` + `compare_versions`（直接可借鉴） |
| `Property` | ✅ property_generator.infer_properties + Domain/Range Inference |
| `ObjectType` | 🟡 `OntologyGenerator.generate_ontology` 6-Stage Pipeline 中的"概念定义"，但不如 ADR-0021 严格 |
| `LinkType` | 🟡 Relationship 类型有但语义弱（直接 triple） |
| `ActionType` / `ActionType.apply` | ❌ **没有原生对应**——这是 MetaPlatform 独一无二的 write-side schema primitive |
| `Interface` | 🟡 ModuleManager + DomainOntologies |
| `Individual` | ✅ KG node（`add_node` / `find_nodes`） |
| `LinkInstance` | ✅ KG edge（`add_edge`） |
| `Axiom` | ✅ SHACLConstraint + Integrity 中类似概念 |
| `Function` | 🟡 SPARQL/Datalog 中有等价表达，但不是头等公民 |
| `ObjectSet` | ✅ ContextGraph + AgentContext 的查询能力 |

### 8.2 v3.1 20 Batch 路线对位

| MP Batch | Semantica 对位 | 借鉴度 |
|---|---|---|
| MP-ONT-KERNEL-01 (12 基元) | semantica/ontology（OWL/SHACL/SKOS） | 🟡 **借鉴协议形式 + 复用 owl/skos，主体仍是自建 12 基元** |
| MP-MODEL-02 | semantica/embeddings + models-huggingface | ✅ 直接复用 fastembed / sentence-transformers |
| MP-SANDBOX-01 (B1 Function L2+第三方 L3) | ❌ 无沙箱概念 | 无 |
| MP-SESSION-01 (B2 会话级 token) | 🟡 context/agent_memory.py（agent 级 memory，非 session） | 借鉴 memory 模型 |
| MP-AIP-GATEWAY-01 | llms/ 8 provider adapter | ✅ **可参考 llm_extras 设计** |
| MP-AGENT-ORCH-01 | mcp_server/ + integrations/agno (3 cookbooks) | ✅ **MCP server 直接能 pip 安装当本地 gateway** |
| MP-ACTION-03 | ❌ ActionType.apply 写库前 HITL 是独家 | 无 |
| MP-OBJECTSET-04 | context/context_graph.py + GraphBuilder | 🟡 借鉴 query 范式 |
| MP-MANAGER-05 | change_management/ | 🟡 借鉴 diff + version 概念 |
| MP-AGENT-ONT-01 | semantica/ontology/OntologyEngine | ✅ 直接资源 |
| MP-RAG-ONT-01 | cookbook/advanced/12_Unstructured_to_Ontology | ✅ **直击 MP-SAL 痛点**，可作 MP-SAL-02 输入 |
| MP-AGENT-EXT-01 | mcp_server + integrations/ | ✅ |

### 8.3 MP-SAL（语义层 AI 落地规划）对位

MP-SAL 五大差距 + 路线已在 MEMORY 索引。Semantica 直接命中的：

1. **"AI 理解数据语义差距"** → `semantica.ontology` OWL/SHACL/SKOS 完整闭环
2. **"AI 查询/推理数据差距"** → `semantica.reasoning` 4 引擎（Rete+Datalog+SPARQL+Abductive）
3. **"AI 调用数据影响可追溯差距"** → `semantica.provenance` W3C PROV-O + integrity hash chain

**强烈建议**：MP-SAL-02 / MP-SAL-03 可以考虑**借调 semantica 的 ontology / reasoning / provenance 模块作为参考实现**，但**要避免耦合**——通过对其 manager.py + engine.py 的 test surface 做 protocol 化适配，封装在 `mate-clients/` 后面。

---

## 9. 风险与局限

| 风险 | 详情 | 影响 |
|---|---|---|
| **14 个月涨 9k stars** | 极不寻常，可能有 Growth Hacking / Reddit 推送 | 项目活跃度 vs 市场声量需分开评估；fork/星比 10.4% 偏高是验证 |
| **context_graph.py 168KB 单类** | 反模式，难测、难多租 | 复杂业务会撞墙；MetaPlatform 坚持 ADR 13 硬规则是对的 |
| **worker.py 还是占位 loop** | `time.sleep(5)` + signal handling；没有真正接 Celery/Kafka | 不适合生产；要自己接 |
| **`crewai` extra CVE-2026-45829** | pyproject 自己注释："chromadb 携带 pre-auth 代码注入" | 攻击面；本项目选 `agno` 作为旗舰是及时止损 |
| **CLI 174KB（50+ commands）+ 4 router×100 endpoints 都是声称** | 没有看到完整 contract 验证 | 集成时要先实测 |
| **OpenTelemetry 依赖被限定 `<2.0.0` / `<0.65`** | 与 v2 → v2 升级锁定，可能拖累长期升级 | 监控栈兼容性 |
| **没看到多租户隔离** | 13 硬规则 #3 "没有 tenant 上下文不访问 repository" Semantica 没有 | 与 MetaPlatform 强约束差距大 |
| **REST 只绑 127.0.0.1** | "expose via reverse proxy only"——是产品定位而非缺陷 | 但需要前置 proxy |
| **`record_decision` 完全同步写图，无 HITL 闸门** | 与 MP-ACTION-CONFIRM-01 直接对立 | 这是范式差异，不能合并 |
| **`PyTorch ≥1.13` 进 core deps** | 即便用户只想用 graph capabilities 也要拉 torch | 安装包 ~600MB+ 是 RAG 工具常见诟病 |

---

## 10. 建议动作（按优先级）

### P0（强烈建议）

1. **MP-SAL-02 立项时直接调 semantica 的 ontology 模块做 reference impl**——重点是 bridge_axiom / VersionManager / ReuseManager 三个文件的 protocol 化抽取。
2. **MP-INTEGRATION-HUB-01 把 Semantica 当 MCP server pilot 之一**——`pip install semantica[llm-anthropic] && semantica-mcp` 是 5 分钟集成，验证整个 MCP hub 的协议栈。
3. **MP-AUDIT 升级时（如果未来要做 SOX/AI Act/HIPAA 合规）参考 provenance/manager.py + integrity.py**——尤其是 hash chain 完整性证明。

### P1（建议但不紧急）

4. **MP-ONT-KERNEL-01 的 12 基元如果要做 reference tests，对位 Semantica 的 ontology_usage.md（29KB，文档质量极高）**。
5. **MP-Workflow / MP-EMP-EVOLVE-01 的版本管理概念**借鉴 VersionManager + compare_versions 的影响报告结构。
6. **DatalogReasoner 作为 MP-REA-01 的备选实现**：14KB Python 纯实现，比 SPARQL 简单，比规则引擎严谨。

### P2（观察 / 跟踪）

7. **观察他们 `record_decision` 的语义化模式**——如果未来客户希望接入 audit 友好路径，这条路径是 already-built。
8. **观察 `semantica-mcp` 在 Claude Desktop 实际体验**：MCP over stdio 的 UX 是 MetaPlatform 的 MP-INTEGRATION-HUB 同源问题。

### 反向（即不要做的事）

- **不要把 semantica 当后端依赖**：14 个月活跃项目 + 多名外部 contributor 的 codebase 进 production 风险远大于自研 200 行。
- **不要 fork 整个包做内部 fork**：MIT 商用 OK，但单类 168KB 的反模式不应该被放大到 MetaPlatform 内。
- **不要让 semantica 的 SPARQLReasoner 替换自研推理**：MetaPlatform 路线是 Python-native + 自主可控（参考 [[mp-workflow-path-c-corrected]]），引入 SPARQL 会重新走向外部引擎路径（违反 v3.0 GA 路线）。

---

## 附录 A — 关键文件清单

> 调研者手抓的核心文件，按重要性排序

1. `pyproject.toml` (8.8KB) — 完整 deps + extras + entrypoints
2. `ARCHITECTURE.md` — 双图（pipeline + decision lifecycle）
3. `semantica/__init__.py` — 懒加载 _ModuleProxy
4. `semantica/server.py` (9.3KB) — FastAPI loopback + 11 router
5. `semantica/mcp_server/__init__.py` (24.7KB) — 11 MCP tools 完全实现
6. `semantica/ontology/engine.py` (28.5KB) — OntologyEngine 完整 API（OWL/SHACL/SKOS/Version/Align/Search/Validate）
7. `semantica/ontology/__init__.py` (11.9KB) — 完整 module 索引
8. `semantica/context/` (9 个文件，~600KB) — 决策生命周期 + agent memory
9. `semantica/provenance/manager.py` (61KB) — W3C PROV-O 主导
10. `semantica/reasoning/` (8 个文件) — 4 个推理引擎
11. `CHANGELOG.md` (244KB) — 持续修复项显示代码质量在快速收敛

## 附录 B — 关键数字

| 指标 | 值 |
|---|---|
| 模块数 (Python 包) | 22 + static SPA |
| Cookbook Notebook | 37 (21 + 13 + 3) |
| GitHub Stars | 9,446 |
| Forks | 985 |
| License | MIT |
| Repo size | ~53 MB |
| PyPI version | 0.6.5 (项目 0.6.0) |
| Python | ≥3.8 |
| Core deps | 38 个 |
| Optional extras | 23 类 |
| MCP tools | 11 |
| CLI commands | 50+ |
| REST endpoints | 100+ (声称) |
| Graph backends | 4 (Neo4j, FalkorDB, Neptune, Apache AGE) |
| Vector backends | 6 (FAISS, Qdrant, Weaviate, Milvus, Pinecone, PgVector, sqlite-vec) |
| Triplet backends | 2 (rdflib in-memory, Oxigraph) |
| Reasoning engines | 4 (Rete, Datalog, SPARQL, Abductive) |
| LLM providers | 8 (OpenAI, Groq, Gemini, Anthropic, Ollama, DeepSeek, LiteLLM, Instructor) |
