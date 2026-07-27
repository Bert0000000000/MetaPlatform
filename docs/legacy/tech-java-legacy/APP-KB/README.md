# APP-KB - 知识库服务

> Mate Platform 知识库（P2.1 全量落地）。
> 配套：TECH-RAG（向量检索）、APP-KB Frontend（metaplatform-frontend/apps/kb）。

## 关键能力

- KB 主数据（`kb_knowledge_base`）+ 版本
- 文档上传 → MinIO 存储 → 解析 → 切片 → 向量化全链路
- 切片策略模板（段落 / 标题 / Token / 句子）
- Chunk Review 工作流（已存在 `kb_chunk_reviews`）
- KB 绑定（Agent / AgentSpec / Ontology Object / Page）
- 检索配置（topK / threshold / hybrid_alpha / Ontology Filter）
- 与 `TECH-RAG` 通过 `kb_chunk.embedding_id` 关联 Milvus 向量

## 数据模型概览

```
kb_knowledge_base            -- 知识库主表
kb_chunk_strategy            -- 切片策略模板
kb_document                  -- 文档元数据 + MinIO key
kb_chunk                     -- 切片（最小检索单元）
kb_chunk_vector              --（间接）Milvus 向量 ID
kb_kb_binding                -- KB ↔ Agent / Object 绑定
kb_retrieval_config          -- 检索参数
kb_chunk_reviews             -- 切片审核（V1）
kb_version_diffs             -- 版本差异（V1）
```

## API 概览

| Method | Path | 用途 |
|---|---|---|
| POST | /api/v1/kb/knowledge-bases | 创建知识库 |
| GET  | /api/v1/kb/knowledge-bases | 列表 |
| POST | /api/v1/kb/documents | 上传文档 |
| POST | /api/v1/kb/documents/{id}/process | 触发解析/切片/向量化 |
| POST | /api/v1/kb/search | 检索（代理到 TECH-RAG） |
| POST | /api/v1/kb/bindings | 创建绑定 |
| GET  | /api/v1/kb/bindings | 查询绑定 |
| POST | /api/v1/kb/retrieval-configs | 配置检索参数 |

详见 `docs/superpowers/specs/2026-07-26-ontology-native-deerflow-rollout-roadmap.md` P2.1。
