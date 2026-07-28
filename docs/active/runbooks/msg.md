# mate-tech-msg Runbook

## 概述

Mate Platform 消息总线服务（Kafka + Redis 幂等 + DLQ + retry）。

## 启动

```bash
cd packages/mate-tech-msg
uv run --package mate-tech-msg python -m mate_tech_msg.main
```

## 端点

| Method | Path | 说明 |
|---|---|---|
| GET | /healthz | 健康检查 |
| POST | /api/v1/msg/publish | 发布消息（带幂等） |
| GET | /api/v1/msg/topics | 列出常用主题 |

## 默认主题

- `mate.msg.dlq` — Dead Letter Queue
- `mate.events.user` — 用户事件
- `mate.events.system` — 系统事件
- `mate.kb.ingest` — KB 摄入事件
- `mate.rag.query` — RAG 查询事件

## 幂等性

publisher 强制 `idempotency_key` → Redis SETNX 7 天去重。

重复 publish 同 key → 返回 `idempotency_hit=True`，partition/offset=-1（虚拟响应）。

## 分区策略

默认 `partition_key = payload.tenant_id`（同租户有序）。

## 重试

handler 失败按 1s/5s/30s 指数退避重试 3 次。

3 次失败 → 走 DLQ topic `mate.msg.dlq`（ST-5.1.6 占位）。

## OTel Trace

producer → consumer 跨服务 trace 关联：
- producer: inject `trace_id` / `tenant_id` 到 Kafka headers
- consumer: extract → 创建子 span

## 故障排查

| 现象 | 排查 |
|---|---|
| publish 500 | 检查 Kafka broker 连接 |
| 幂等命中不返回 | 检查 `idempotency_key` 是否一致 |
| DLQ 累积 | 检查 handler 异常 + OTel trace |
| 重复消息 | 检查 `X-Idempotency-Key` 是否设置 |