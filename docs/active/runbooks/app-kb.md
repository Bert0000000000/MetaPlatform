# app-kb Runbook (ST-5.8.10)

## 概述

Mate Platform app-kb 业务聚合服务 — KB / 检索 / 对话 / 引用的统一入口。

## 启动

```bash
cd packages/mate-app-kb
uv run --package mate-app-kb python -m mate_app_kb.main
```

## 端点

| Method | Path | 说明 |
|---|---|---|
| GET | /healthz | 健康检查 |
| POST | /api/v1/app-kb/kbs | 创建 KB |
| GET | /api/v1/app-kb/kbs | 列出 KB |
| GET | /api/v1/app-kb/kbs/{id} | 读取 KB |
| DELETE | /api/v1/app-kb/kbs/{id} | 删除 KB |
| POST | /api/v1/app-kb/kbs/{id}/upload | 上传文档 |
| POST | /api/v1/app-kb/search | 检索（带租户过滤） |
| POST | /api/v1/app-kb/chat | Agent 对话（含 KB 自动注入） |
| POST | /api/v1/app-kb/workflows | 启动 S4 BPMN workflow |
| GET | /api/v1/app-kb/stats | 统计（KB / 文档 / 检索量） |

## 数据模型

- **KnowledgeBase**: id, name, namespace, tenant_id
- **Document**: id, kb_id, status, content_uri
- **Instance**: 关联到 KB + 实体引用
- **Workflow**: S4 BPMN 编排

## 跨租户隔离

所有 KB 强制带 tenant_id。跨租户访问 0 召回。

## 双写策略

上传 → tech-kb 存原档 (MinIO) → 发 Kafka `mate.kb.ingest` → tech-rag 监听入库。

## 故障排查

| 现象 | 排查 |
|---|---|
| 跨租户有召回 | 检查 tenant_id 透传 |
| 上传 500 | 检查 Kafka broker + MinIO |
| chat 慢 | 检查 tech-agent / tech-rag 健康 |
| 引用为空 | 检查 search top_k ≥ 1 |