# mate-tech-rag Runbook (BUSINESS-SLICES P1 + ADR-0018 §2.1)

## 概述

Mate Platform RAG 提供 hybrid / graph / lightrag 三策略检索 + reranker；
tenant-scoped document registry 强制跨租户隔离（hard rule 3）。

## 启动

```bash
cd packages/mate-tech-rag
uv run --package mate-tech-rag python -m mate_tech_rag.bootstrap
```

## SLO（ADR-0018 §2.1）

| Journey | SLO | 当前基线 |
|---|---|---|
| RAG TTFT（本地） | p95 ≤ 1.5s | 待 P3-W7 之后统计 |
| RAG TTFT（含 LLM 上游） | p95 ≤ 4s | 待 P3-W7 之后统计 |
| Reranker 命中率 | ≥ 60% | dev |

## SLO 越线

### RAG TTFT 越线（本地）

**触发**：`RagTTFTLocalP95TooHigh`（p95 > 1.5s 持续 3m）

1. Grafana `RAG Retrieval Latency` dashboard，按 `tenant_id` + `mode` 切片。
2. Tempo trace `service.name=mate-tech-rag`，筛选 `rag.retrieve` span，看
   `rag.retrieve.latency_ms` 字段。
3. 若是 hybrid 慢 → 检查 `pgvector` / `milvus` 索引；若 graph 慢 →
   检查 Neo4j；若 lightrag 慢 → 检查本地图缓存。
4. 必要时切换 `RAG_DEFAULT_MODE=hybrid` 或扩容 vector store。
5. 仍不能恢复 → oncall SRE 升级。

## 故障排查

| 现象 | 排查 |
|---|---|
| 检索 0 hits | 检查 tenant document registry（`tenant_document_ids`） |
| 越权返回其他租户内容 | hard rule 3 — tenant_document_ids 必须强制 |
| reranker 慢 | 检查 `RAG_RERANK_BATCH_SIZE` env |
| 嵌入超时 | 看 embedding provider 健康（openai / doubao / local） |