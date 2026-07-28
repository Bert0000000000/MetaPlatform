# W5-6 子任务卡（ST）：tech-rag（RAG 核心）

> **源任务卡**：[tasks-W5.md § W5-6](./2026-07-27-mate-platform-tasks-W5.md#w5-6-tech-ragrag-核心14-张-tc)
> **总览**：[Task Breakdown v2.0](./2026-07-27-mate-platform-task-breakdown.md)
> **Sprint**：S7-S8（2026-09-28 ~ 2026-10-25）
> **里程碑**：M3 关键路径
> **ST 总数**：54（覆盖 14 张 TC）
> **颗粒度**：0.5–4 小时 / 单文件 / 单函数 / 单测试

---

## 目录

- [TC-5.6.1 apps/tech-rag 初始化（4 ST）](#tc-561-appstech-rag-初始化4-st)
- [TC-5.6.2 Embedding 模型集成（4 ST）](#tc-562-embedding-模型集成4-st)
- [TC-5.6.3 Milvus 向量入库（4 ST）](#tc-563-milvus-向量入库4-st)
- [TC-5.6.4 检索 hybrid（5 ST）](#tc-564-检索-hybrid5-st)
- [TC-5.6.5 Rerank 模型集成（4 ST）](#tc-565-rerank-模型集成4-st)
- [TC-5.6.6 检索端点（4 ST）](#tc-566-检索端点4-st)
- [TC-5.6.7 文档摄取（5 ST）](#tc-567-文档摄取5-st)
- [TC-5.6.8 Query 改写（3 ST）](#tc-568-query-改写3-st)
- [TC-5.6.9 HyDE（3 ST）](#tc-569-hyde3-st)
- [TC-5.6.10 评估集 + 自动跑分（4 ST）](#tc-5610-评估集--自动跑分4-st)
- [TC-5.6.11 引用溯源（4 ST）](#tc-5611-引用溯源4-st)
- [TC-5.6.12 多租户隔离（3 ST）](#tc-5612-多租户隔离3-st)
- [TC-5.6.13 性能基线（3 ST）](#tc-5613-性能基线3-st)
- [TC-5.6.14 单测 + 集成（4 ST）](#tc-5614-单测--集成4-st)
- [完成度检查表](#完成度检查表)
- [依赖关系图](#依赖关系图)

---

## TC-5.6.1 apps/tech-rag 初始化（4 ST）

### ST-5.6.1.1 apps/tech-rag pyproject.toml + Dockerfile

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.1 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/pyproject.toml、apps/tech-rag/Dockerfile |
| 前置 ST | TC-1.1.7 |
| 输出 commit | feat(rag): pyproject (ST-5.6.1.1) |

**改动清单**：
1. uv init --package tech-rag 生成包
2. 加依赖：fastapi、uvicorn、pydantic、httpx、numpy、structlog
3. Dockerfile：python:3.12 + uv install

**DoD**：
- [ ] uv sync --package tech-rag 成功

---

### ST-5.6.1.2 main.py + FastAPI app + /healthz

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.1 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/main.py |
| 前置 ST | ST-5.6.1.1 |
| 输出 commit | feat(rag): main app |

**改动清单**：
1. pp = FastAPI(title=tech-rag, version=0.1.0)
2. @app.get(/healthz) 返回 {status: ok, version}
3. lifespan 钩子：初始化 logger

**DoD**：
- [ ] uv run --package tech-rag uvicorn tech_rag.main:app 启动

---

### ST-5.6.1.3 docker-compose.yml 加 tech-rag service

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.1 |
| 工时 | 0.5h | 角色 | DevOps |
| 目标文件 | docker-compose.yml |
| 前置 ST | ST-5.6.1.2 |
| 输出 commit | dev: tech-rag service |

**改动清单**：
1. service tech-rag：build context apps/tech-rag、port 8080
2. depends_on: milvus、llmgw
3. env：LOG_LEVEL=INFO、MILVUS_HOST=milvus

**DoD**：
- [ ] docker compose up tech-rag healthy

---

### ST-5.6.1.4 OpenAPI 标签 + 路由占位

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.1 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/main.py |
| 前置 ST | ST-5.6.1.3 |
| 输出 commit | feat(rag): openapi tags |

**改动清单**：
1. pp.openapi_tags = [{name: search}, {name: ingest}, {name: eval}]
2. 预声明 3 个路由占位（返回 501 Not Implemented）

**DoD**：
- [ ] swagger-ui 列出 3 个 tag

---

## TC-5.6.2 Embedding 模型集成（4 ST）

### ST-5.6.2.1 EmbeddingProvider Protocol 定义

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.2 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/embedding/base.py |
| 前置 ST | TC-5.5.2（llmgw 提供 LangChain chat，Embedding 复用同一 provider） |
| 输出 commit | feat(rag): embedding protocol |

**改动清单**：
1. class EmbeddingProvider(Protocol)：sync def embed(self, texts: list[str]) -> list[list[float]]
2. def dim(self) -> int 属性

**DoD**：
- [ ] pyright 无 error；Protocol 可被 type-check

---

### ST-5.6.2.2 OpenAI Embedding 实现

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.2 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/embedding/openai.py |
| 前置 ST | ST-5.6.2.1 |
| 输出 commit | feat(rag): openai embed |

**改动清单**：
1. class OpenAIEmbedding: __init__(self, api_key, model=text-embedding-3-small)
2. sync def embed(self, texts: list[str])：httpx POST v1/embeddings
3. dim：查 model 对应维度（3-small=1536、3-large=3072）

**DoD**：
- [ ] 100 文本 embed < 5s（mock HTTP 即可）

---

### ST-5.6.2.3 BGE Embedding（本地，可选）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.2 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/embedding/bge.py |
| 前置 ST | ST-5.6.2.2 |
| 输出 commit | feat(rag): bge embed |

**改动清单**：
1. 用 sentence-transformers 加载 BAAI/bge-m3
2. class BgeEmbedding: dim() -> 1024
3. sync def embed：用 asyncio.to_thread 调同步推理

**DoD**：
- [ ] 1000 文本 embed < 30s（CPU）；< 5s（GPU）

---

### ST-5.6.2.4 Embedding 工厂 + 配置

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.2 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/embedding/factory.py |
| 前置 ST | ST-5.6.2.3 |
| 输出 commit | feat(rag): embedding factory |

**改动清单**：
1. def get_embedding() -> EmbeddingProvider：根据 env EMBEDDING_PROVIDER=openai|bge 切换
2. 默认 openai

**DoD**：
- [ ] 切换 env 后行为不同

---

## TC-5.6.3 Milvus 向量入库（4 ST）

### ST-5.6.3.1 Collection schema 定义

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.3 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/index/schema.py |
| 前置 ST | TC-2.3.6（Milvus Repository） |
| 输出 commit | feat(rag): milvus schema |

**改动清单**：
1. 定义字段：id (auto)、chunk_id、kb_id、tenant_id、vector (FLOAT_VECTOR, dim=1536)、text (VARCHAR, max=8192)、metadata (JSON)
2. index：vector HNSW + tenant_id scalar
3. partition_key：tenant_id

**DoD**：
- [ ] schema 在 testcontainers 上 create 成功

---

### ST-5.6.3.2 VectorRepository.insert 实现

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.3 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/index/repository.py |
| 前置 ST | ST-5.6.3.1 + TC-2.3.6 |
| 输出 commit | feat(rag): vector insert |

**改动清单**：
1. class MilvusVectorRepository: __init__(self, client, collection_name)
2. sync def insert(self, chunks: list[Chunk], vectors: list[list[float]])
3. 批量 100 条提交一次

**DoD**：
- [ ] 1 万条入库 < 10s（testcontainers）

---

### ST-5.6.3.3 VectorRepository.delete_by_document 实现

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.3 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/index/repository.py（追加） |
| 前置 ST | ST-5.6.3.2 |
| 输出 commit | feat(rag): vector delete |

**改动清单**：
1. sync def delete_by_document(self, document_id: str)
2. 用 filter expr document_id == X

**DoD**：
- [ ] 删除后再检索 0 命中

---

### ST-5.6.3.4 集成测试（testcontainers）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.3 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | tests/integration/tech_rag/test_vector_repo.py |
| 前置 ST | ST-5.6.3.3 |
| 输出 commit | test(rag): vector integration |

**改动清单**：
1. testcontainers 拉 milvus standalone
2. fixture：建 collection、清理
3. 测试：insert 1 万条、count、delete by document

**DoD**：
- [ ] pytest -m integration -k vector 全绿

---

## TC-5.6.4 检索 hybrid（5 ST）

### ST-5.6.4.1 Retriever Protocol 定义

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.4 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/retrieval/base.py |
| 前置 ST | ST-5.6.3.2 |
| 输出 commit | feat(rag): retriever protocol |

**改动清单**：
1. class Retriever(Protocol)：sync def retrieve(self, query, top_k, **filters) -> list[Chunk]

**DoD**：
- [ ] Protocol type-check 通过

---

### ST-5.6.4.2 VectorRetriever 实现

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.4 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/retrieval/vector.py |
| 前置 ST | ST-5.6.4.1 |
| 输出 commit | feat(rag): vector retriever |

**改动清单**：
1. class VectorRetriever: __init__(self, vector_repo, embedding)
2. sync def retrieve：embed query → vector search → 返回 Chunk

**DoD**：
- [ ] 单测：1 万条数据上 top-10 < 50ms

---

### ST-5.6.4.3 BM25Retriever 实现（PG tsvector）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.4 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/retrieval/bm25.py |
| 前置 ST | ST-5.6.4.2 + TC-2.3.3（PG repo） |
| 输出 commit | feat(rag): bm25 retriever |

**改动清单**：
1. class BM25Retriever: __init__(self, pg_repo)
2. SQL：SELECT id, ts_rank(tsv, query) FROM chunks WHERE tsv @@ to_tsquery(...) ORDER BY rank DESC LIMIT k
3. 中英混合：tsvector 用 simple 配置 + 	o_tsquery('simple', ...)

**DoD**：
- [ ] 中文检索「人工智能」命中包含该词的 chunks

---
### ST-5.6.4.4 HybridRetriever 实现（RRF 融合）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.4 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/retrieval/hybrid.py |
| 前置 ST | ST-5.6.4.3 |
| 输出 commit | feat(rag): hybrid retriever |

**改动清单**：
1. class HybridRetriever: __init__(self, vector, bm25)
2. 并发调 vector + bm25，各取 top-20
3. RRF 融合：score = sum(1 / (k + rank_i))，k=60
4. 返回 top-k

**DoD**：
- [ ] hybrid p95 < 200ms（1 万条数据）

---

### ST-5.6.4.5 Retriever 工厂 + 模式选择

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.4 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/retrieval/factory.py |
| 前置 ST | ST-5.6.4.4 |
| 输出 commit | feat(rag): retriever factory |

**改动清单**：
1. def get_retriever(mode=hybrid) -> Retriever：根据 mode 返回对应实例
2. mode ∈ {vector, bm25, hybrid}

**DoD**：
- [ ] 切换 mode 后行为不同

---

## TC-5.6.5 Rerank 模型集成（4 ST）

### ST-5.6.5.1 Reranker Protocol 定义

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.5 |
| 工时 | 0.3h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/rerank/base.py |
| 前置 ST | TC-5.6.4.5 |
| 输出 commit | feat(rag): rerank protocol |

**改动清单**：
1. class Reranker(Protocol)：sync def rerank(self, query, chunks: list[Chunk]) -> list[Chunk]

---

### ST-5.6.5.2 BGE Reranker 实现（HTTP API）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.5 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/rerank/bge.py |
| 前置 ST | ST-5.6.5.1 |
| 输出 commit | feat(rag): bge rerank |

**改动清单**：
1. class BgeReranker: __init__(self, endpoint=http://bge-reranker:8080/rerank)
2. POST {query, documents} → scores 数组
3. sync def rerank：按 score 降序排 chunks

**DoD**：
- [ ] 50 条 chunks rerank < 300ms

---

### ST-5.6.5.3 NoOpReranker（占位，可关闭）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.5 |
| 工时 | 0.3h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/rerank/noop.py |
| 前置 ST | ST-5.6.5.2 |
| 输出 commit | feat(rag): noop rerank |

**改动清单**：
1. class NoOpReranker: async def rerank 返回原顺序

---

### ST-5.6.5.4 Rerank 开关 + 集成到 retriever pipeline

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.5 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/retrieval/pipeline.py |
| 前置 ST | ST-5.6.5.3 |
| 输出 commit | feat(rag): pipeline rerank |

**改动清单**：
1. 在 HybridRetriever 后加 rerank 步骤
2. env RERANK_ENABLED=true|false，默认 true
3. false 时返回原 top-k

**DoD**：
- [ ] 切换开关后行为不同

---

## TC-5.6.6 检索端点（4 ST）

### ST-5.6.6.1 SearchRequest / SearchResponse Pydantic 模型

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.6 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/api/schemas.py |
| 前置 ST | TC-1.4.1.3（已有 RetrievalRequest/Response，但 rag 需独立 model 加 rerank/citation 字段） |
| 输出 commit | feat(rag): search schemas |

**改动清单**：
1. SearchRequest(query, top_k, mode, kb_ids, rerank, filter)
2. SearchResponse(results, total, took_ms)
3. ChunkResult(chunk_id, document_id, text, score, citation)

**DoD**：
- [ ] Pydantic model roundtrip 通过

---

### ST-5.6.6.2 POST /api/v1/rag/search 端点

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.6 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/api/search.py |
| 前置 ST | ST-5.6.6.1 + ST-5.6.4.5 |
| 输出 commit | feat(rag): search endpoint |

**改动清单**：
1. @router.post(/search) → 调用 retriever
2. 加 OTel span 
ag.search
3. 鉴权：依赖 X-Tenant-Id header

**DoD**：
- [ ] swagger-ui Try it out 返回 top-10

---

### ST-5.6.6.3 POST /api/v1/rag/search/stream 端点（SSE）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.6 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/api/search.py（追加） |
| 前置 ST | ST-5.6.6.2 |
| 输出 commit | feat(rag): search stream |

**改动清单**：
1. @router.post(/search/stream) → StreamingResponse
2. 先发 retrieval 结果（data: {type: retrieval, chunks: [...]}

）
3. 再发生成结果（data: {type: generation, token: ...}

）
4. 最后发 {type: done}

**DoD**：
- [ ] EventSource 收到完整事件流

---

### ST-5.6.6.4 OpenAPI 同步

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.6 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | openapi/paths/rag/search.yaml |
| 前置 ST | ST-5.6.6.3 |
| 输出 commit | docs(rag): openapi |

**改动清单**：
1. 写 path YAML，引用 tech_rag.api.schemas
2. 跑 regen-and-check.sh 验证 Pydantic 模型同步

**DoD**：
- [ ] CI openapi-lint + model-align 全绿

---

## TC-5.6.7 文档摄取（5 ST）

### ST-5.6.7.1 监听 tech-kb document.indexed 事件（Kafka consumer）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.7 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/ingest/consumer.py |
| 前置 ST | ST-5.6.3.2 + TC-5.1.3（复用 KafkaClient） |
| 输出 commit | feat(rag): ingest consumer |

**改动清单**：
1. consumer group tech-rag-ingest
2. topic mate.kb.document.indexed
3. 收到事件 → 调 handler（先 stub）

**DoD**：
- [ ] 发 1 个事件，consumer 收到

---

### ST-5.6.7.2 Document chunker（langchain text splitter）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.7 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/ingest/chunker.py |
| 前置 ST | ST-5.6.7.1 |
| 输出 commit | feat(rag): chunker |

**改动清单**：
1. class Chunker: __init__(self, strategy=recursive, chunk_size=512, overlap=64)
2. def split(self, text: str, metadata: dict) -> list[Chunk]
3. 支持中英文（langchain RecursiveCharacterTextSplitter）

**DoD**：
- [ ] 100KB 文本切分 < 1s

---

### ST-5.6.7.3 Embedding + 入库 pipeline

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.7 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/ingest/pipeline.py |
| 前置 ST | ST-5.6.7.2 |
| 输出 commit | feat(rag): ingest pipeline |

**改动清单**：
1. sync def ingest_document(document)：chunker.split → embedding.embed → vector_repo.insert
2. 失败重试 3 次（指数退避）

**DoD**：
- [ ] 1 个 PDF（10 页）走通 + 可检索

---
### ST-5.6.7.4 chunker 策略配置（从 KB 配置读取）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.7 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/ingest/pipeline.py（修改） |
| 前置 ST | ST-5.6.7.3 |
| 输出 commit | feat(rag): chunker config |

**改动清单**：
1. ingest_document 接收 KB 对象，读取 chunkStrategy
2. 传参给 Chunker

**DoD**：
- [ ] 不同 KB 用不同 chunk_size

---

### ST-5.6.7.5 摄取进度事件发回 tech-kb

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.7 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/ingest/pipeline.py（追加） |
| 前置 ST | ST-5.6.7.4 |
| 输出 commit | feat(rag): progress event |

**改动清单**：
1. 进度 0/25/50/75/100 时发 Kafka 事件 mate.kb.ingest.progress
2. payload {document_id, kb_id, progress, status}

**DoD**：
- [ ] tech-kb consumer 收到 5 个进度事件

---

## TC-5.6.8 Query 改写（3 ST）

### ST-5.6.8.1 QueryRewriter Protocol

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.8 |
| 工时 | 0.3h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/query_rewrite/base.py |
| 前置 ST | ST-5.6.6.2 |
| 输出 commit | feat(rag): query rewrite protocol |

**改动清单**：
1. class QueryRewriter(Protocol)：sync def rewrite(self, query, history=[]) -> str

---

### ST-5.6.8.2 LLMQueryRewriter（用 llmgw 调 LLM）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.8 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/query_rewrite/llm.py |
| 前置 ST | ST-5.6.8.1 + TC-5.5.3 |
| 输出 commit | feat(rag): llm query rewrite |

**改动清单**：
1. class LLMQueryRewriter: __init__(self, llm_client)
2. prompt template：把口语化 query 转关键词 + 合并历史
3. sync def rewrite：调 llm → 取回复

**DoD**：
- [ ] SQuAD 50 题上 recall +3%

---

### ST-5.6.8.3 Query 改写集成到 search 流程

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.8 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/api/search.py（修改） |
| 前置 ST | ST-5.6.8.2 |
| 输出 commit | feat(rag): rewrite in search |

**改动清单**：
1. search 端点先 rewriter.rewrite → 再 retriever.retrieve
2. env QUERY_REWRITE_ENABLED=true|false

**DoD**：
- [ ] 开关可控

---

## TC-5.6.9 HyDE（3 ST）

### ST-5.6.9.1 HydeProvider（用 LLM 生成假想答案）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.9 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/hyde/provider.py |
| 前置 ST | TC-5.6.8.2 |
| 输出 commit | feat(rag): hyde provider |

**改动清单**：
1. prompt：假设你是专家，请简洁回答 {query}（不需真实）
2. sync def generate(self, query) -> str → 假想答案

**DoD**：
- [ ] 返回 50-100 字文本

---

### ST-5.6.9.2 HydeRetriever（用假想答案检索）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.9 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/hyde/retriever.py |
| 前置 ST | ST-5.6.9.1 |
| 输出 commit | feat(rag): hyde retriever |

**改动清单**：
1. class HydeRetriever: __init__(self, hyde, base_retriever)
2. retrieve：hyde.generate → base_retriever.retrieve(假想答案)

---

### ST-5.6.9.3 HyDE 开关 + A/B 报告

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.9 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/api/search.py |
| 前置 ST | ST-5.6.9.2 |
| 输出 commit | feat(rag): hyde toggle |

**改动清单**：
1. env HYDE_ENABLED=true|false
2. 写 docs/eval/rag-hyde-ab.md 报告

**DoD**：
- [ ] 评估集对比 hit@5 差异 ±1%

---

## TC-5.6.10 评估集 + 自动跑分（4 ST）

### ST-5.6.10.1 eval 数据集目录 + 50 题样本

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.10 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-rag/eval/dataset.jsonl |
| 前置 ST | TC-5.6.4.5 |
| 输出 commit | feat(rag): eval dataset |

**改动清单**：
1. 50 条 JSONL：{id, query, relevant_chunk_ids, mode (vector/bm25/hybrid)}
2. 覆盖中英文 + 不同难度

**DoD**：
- [ ] 50 条可加载

---

### ST-5.6.10.2 评估脚本（hit@k, nDCG@k）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.10 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/eval/runner.py |
| 前置 ST | ST-5.6.10.1 |
| 输出 commit | feat(rag): eval runner |

**改动清单**：
1. load dataset + retriever
2. 对每题：retrieve → 计算 hit@5/10, nDCG@10
3. 输出 markdown 报告

**DoD**：
- [ ] 跑通，报告归档

---

### ST-5.6.10.3 pytest --eval 集成

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.10 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/tests/test_eval.py |
| 前置 ST | ST-5.6.10.2 |
| 输出 commit | test(rag): eval pytest |

**改动清单**：
1. 把 runner 包装成 pytest 形式
2. 加 marker @pytest.mark.eval

**DoD**：
- [ ] pytest -m eval 跑通

---

### ST-5.6.10.4 评估报告基线 + ADR

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.10 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | docs/adr/0008-rag-eval-baseline.md |
| 前置 ST | ST-5.6.10.3 |
| 输出 commit | docs: rag eval ADR |

**改动清单**：
1. 跑基线：hybrid hit@10 ≥ X%、nDCG@10 ≥ Y%
2. ADR 记录基线 + 后续优化目标

**DoD**：
- [ ] ADR-0008 合并

---

## TC-5.6.11 引用溯源（4 ST）

### ST-5.6.11.1 ChunkResult 加 citation 字段

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.11 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/api/schemas.py |
| 前置 ST | ST-5.6.6.1 |
| 输出 commit | feat(rag): citation schema |

**改动清单**：
1. ChunkResult 加 fields：document_id, document_title, source_uri, char_start, char_end

**DoD**：
- [ ] Pydantic model roundtrip

---

### ST-5.6.11.2 Milvus metadata 写入原文位置

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.11 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/index/repository.py |
| 前置 ST | ST-5.6.3.2 |
| 输出 commit | feat(rag): metadata cite |

**改动清单**：
1. insert 时 metadata 加 source_uri、char_start、char_end
2. chunker 计算并写入

**DoD**：
- [ ] 检索结果含原文位置

---

### ST-5.6.11.3 文档原文回查 endpoint

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.11 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/api/citation.py |
| 前置 ST | ST-5.6.11.2 + TC-5.8.3（app-kb 提供原文 API） |
| 输出 commit | feat(rag): cite endpoint |

**改动清单**：
1. GET /api/v1/rag/citations/{chunk_id} 返回 {text_span, document_title, source_uri}
2. 调 app-kb API 取原文片段

**DoD**：
- [ ] 端到端：检索 → 引用 → 反查原文

---

### ST-5.6.11.4 前端引用组件契约（OpenAPI）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.11 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | openapi/components/schemas/rag.yaml |
| 前置 ST | ST-5.6.11.3 |
| 输出 commit | docs(rag): cite schema |

**DoD**：
- [ ] swagger-ui 列出 citation 字段

---
## TC-5.6.12 多租户隔离（3 ST）

### ST-5.6.12.1 Milvus partition by tenant

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.12 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/index/schema.py |
| 前置 ST | ST-5.6.3.1 |
| 输出 commit | feat(rag): tenant partition |

**改动清单**：
1. schema 加 partition_key field：tenant_id
2. create_collection 时启用 partition_key

**DoD**：
- [ ] 多租户数据物理隔离

---

### ST-5.6.12.2 retriever 强制带 tenant filter

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.12 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-rag/src/tech_rag/retrieval/base.py、vector.py、bm25.py |
| 前置 ST | ST-5.6.12.1 |
| 输出 commit | feat(rag): tenant filter |

**改动清单**：
1. retrieve(query, tenant_id, ...) → 强制 filter
2. 没带 tenant_id → 抛 401

**DoD**：
- [ ] 跨租户 unit test 全 0 召回

---

### ST-5.6.12.3 跨租户访问测试

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.12 |
| 工时 | 0.5h | 角色 | QA |
| 目标文件 | tests/unit/tech_rag/test_tenant.py |
| 前置 ST | ST-5.6.12.2 |
| 输出 commit | test(rag): tenant isolation |

**改动清单**：
1. tenant A 写入 10 条
2. tenant B 用 A 的 tenant_id 检索 → 0 命中
3. tenant B 用自己的 tenant_id 检索 → 0 命中（无数据）

**DoD**：
- [ ] 3 个断言全绿

---

## TC-5.6.13 性能基线（3 ST）

### ST-5.6.13.1 pytest-benchmark 配置 + 1 万条数据准备

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.13 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | tests/bench/conftest.py、apps/tech-rag/eval/benchmark_data.py |
| 前置 ST | TC-5.6.4.5 |
| 输出 commit | test(rag): bench setup |

**改动清单**：
1. pytest-benchmark fixture
2. 生成 1 万条随机 chunks（用于性能测试）

**DoD**：
- [ ] fixture 可被 benchmark 用例引用

---

### ST-5.6.13.2 vector retrieve 性能测试

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.13 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | tests/bench/test_vector_bench.py |
| 前置 ST | ST-5.6.13.1 |
| 输出 commit | test(rag): vector bench |

**改动清单**：
1. 100 query × top-10 benchmark
2. 断言 p95 < 200ms

**DoD**：
- [ ] pytest-benchmark 输出归档

---

### ST-5.6.13.3 hybrid + rerank 端到端性能

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.13 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | tests/bench/test_pipeline_bench.py |
| 前置 ST | ST-5.6.13.2 |
| 输出 commit | test(rag): pipeline bench |

**改动清单**：
1. 50 query × hybrid + rerank benchmark
2. 断言 p95 < 500ms

**DoD**：
- [ ] 报告归档 + ADR-0009 性能基线

---

## TC-5.6.14 单测 + 集成（4 ST）

### ST-5.6.14.1 全局 conftest + fixtures（mock embedding、mock milvus）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.14 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/tech-rag/tests/conftest.py |
| 前置 ST | TC-5.6.13.3 |
| 输出 commit | test(rag): conftest |

**改动清单**：
1. mock EmbeddingProvider 返回固定 1536 维向量
2. mock MilvusClient 用 SQLite in-memory 模拟
3. fixture：tenant_id、kb_id、chunks 样本

**DoD**：
- [ ] 单测跑得快（< 5s）

---

### ST-5.6.14.2 单测覆盖（embedding/retrieval/ingest/query_rewrite/hyde）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.14 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | tests/unit/tech_rag/*.py |
| 前置 ST | ST-5.6.14.1 |
| 输出 commit | test(rag): unit suite |

**改动清单**：
1. 每个模块 ≥ 5 个测试用例
2. 边界条件：空输入、超长 query、特殊字符

**DoD**：
- [ ] 覆盖率 ≥ 80%

---

### ST-5.6.14.3 集成测试（API + 摄取 pipeline）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.14 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | tests/integration/tech_rag/test_api.py |
| 前置 ST | ST-5.6.14.2 |
| 输出 commit | test(rag): integration |

**改动清单**：
1. testcontainers 拉 milvus + postgres
2. TestClient 测 5 个核心端点

**DoD**：
- [ ] pytest -m integration -k rag 全绿

---

### ST-5.6.14.4 覆盖率门槛 CI 集成

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.6.14 |
| 工时 | 0.5h | 角色 | DevOps |
| 目标文件 | .github/workflows/python.yml（已配置，验证） |
| 前置 ST | ST-5.6.14.3 |
| 输出 commit | ci: rag cov |

**DoD**：
- [ ] tech-rag 覆盖率 < 80% 时 CI 阻断

---

## 完成度检查表

| TC | 路线图工时 | ST 数 | ST 总工时 | 关键路径 | 状态 |
|---|---|---|---|---|---|
| TC-5.6.1 | 2h | 4 | ~2h | 是 | 🔴 |
| TC-5.6.2 | 4h | 4 | ~3.5h | 是 | 🔴 |
| TC-5.6.3 | 4h | 4 | ~3.5h | 是 | 🔴 |
| TC-5.6.4 | 6h | 5 | ~6h | 是 | 🔴 |
| TC-5.6.5 | 4h | 4 | ~2.6h | — | 🔴 |
| TC-5.6.6 | 4h | 4 | ~3.5h | 是 | 🔴 |
| TC-5.6.7 | 6h | 5 | ~5h | 是 | 🔴 |
| TC-5.6.8 | 4h | 3 | ~2.3h | — | 🔴 |
| TC-5.6.9 | 3h | 3 | ~3h | — | 🔴 |
| TC-5.6.10 | 4h | 4 | ~3.5h | — | 🔴 |
| TC-5.6.11 | 4h | 4 | ~3h | — | 🔴 |
| TC-5.6.12 | 3h | 3 | ~2.5h | 是 | 🔴 |
| TC-5.6.13 | 3h | 3 | ~1.5h | — | 🔴 |
| TC-5.6.14 | 4h | 4 | ~4h | 是 | 🔴 |
| **合计** | **~57h** | **54** | **~46h** | — | **🔴** |

---

## 依赖关系图

`mermaid
flowchart TD
    A[TC-5.6.1 init] --> B[TC-5.6.2 Embedding]
    A --> C[TC-5.6.3 Milvus]
    B --> C
    C --> D[TC-5.6.4 Retriever]
    D --> E[TC-5.6.5 Rerank]
    E --> F[TC-5.6.6 Search API]
    F --> G[TC-5.6.11 Citation]
    C --> H[TC-5.6.7 Ingest]
    H --> I[TC-5.6.10 Eval]
    F --> J[TC-5.6.8 Rewrite]
    J --> K[TC-5.6.9 HyDE]
    C --> L[TC-5.6.12 Tenant]
    L --> D
    D --> M[TC-5.6.13 Bench]
    M --> N[TC-5.6.14 Tests]
`

---

## 变更记录

| 日期 | 版本 | 变更 | 原因 |
|---|---|---|---|
| 2026-07-28 | v2.0 | 从 W5-6 TC（14 张）拆出 ST（54 张） | 单回合执行避免 Token 超限，TC 4-24h 仍过大 |
