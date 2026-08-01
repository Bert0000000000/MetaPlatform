# P3-W9 MSG 业务深化 — webhook fan-out + DLQ 投递 + 订阅暂停/恢复 验收

> **验收日期**: 2026-08-01
> **批次**: P3-W9（BUSINESS-SLICES msg 业务深化）
> **范围**: publish 路径接入 webhook fan-out + DLQ 真实投递 + 订阅暂停/恢复 + DLQ 查询/重放
> **关联 ADR**: ADR-0014（5 步接入）/ ADR-0016（BUSINESS-SLICES）
> **关联 PRD**: PRD-TECH-MSG
> **状态**: ✅ **Accepted**

---

## 1. 改动清单

| 文件 | 改动 | 关键能力 |
|---|---|---|
| `subscriptions.py` | 扩展 | 新增 DLQEntry + InMemoryDLQStore + SubscriptionStore.update_subscription_status + deliver_with_retries dlq_store 参数 |
| `publisher.py` | 扩展 | publish 成功后调 find_matching → fan-out webhook delivery |
| `subscriber.py` | 扩展 | DLQ 从仅日志改为真实 InMemoryDLQStore 写入 |
| `subscription_routes.py` | 新增 | PATCH /subscriptions/{id}/status + GET /dlq + POST /dlq/{id}/replay |
| `main.py` | 接线 | publisher 注入 subscription_store + dlq_store + dlq_router 挂载 |
| `tests/test_msg_webhook.py` | 新建 | 7 tests |

---

## 2. 新增 API

| Endpoint | 方法 | 用途 |
|---|---|---|
| `/api/v1/msg/subscriptions/{sub_id}/status` | PATCH | 暂停(active→paused)/恢复(paused→active) |
| `/api/v1/msg/dlq` | GET | 查询 DLQ 消息(分页, 可按 subscription_id 过滤) |
| `/api/v1/msg/dlq/{message_id}/replay` | POST | 重放 DLQ 消息(成功后自动移除) |

---

## 3. 测试结果

```text
$ python -m pytest mate-platform-backend/packages/mate-tech-msg/tests -q --tb=short
67 passed in ~1s   # 0 failed / 0 skipped

# 新增 7 tests 逐项确认
$ python -m pytest mate-platform-backend/packages/mate-tech-msg/tests/test_msg_webhook.py -v
7 passed in 0.39s
```

### 3.1 测试明细

| 测试 | 断言要点 |
|---|---|
| `test_publish_triggers_matching_webhook` | publish 成功后匹配 subscription 触发 webhook(respx 验证 1 次调用) |
| `test_publish_no_matching_subscription_skips_webhook` | topic 不匹配时 0 次 webhook 调用 |
| `test_paused_subscription_not_triggered` | paused subscription 被 find_matching 排除, 0 次调用 |
| `test_dlq_records_failed_delivery` | deliver_with_retries 失败后 DLQ 记录含 topic/subscription_id/error |
| `test_dlq_list_filters_by_tenant` | 租户隔离 + subscription_id 过滤 |
| `test_dlq_replay_retries_delivery` | replay 成功后 entry 从 DLQ 移除 |
| `test_subscription_pause_and_resume` | active→paused→active 状态切换 + find_matching 影响 + 跨租户 None |

---

## 4. ADR-0014 五步接入确认

| 步骤 | 状态 | 说明 |
|---|---|---|
| 1. install_auth | ✅ | 已在 main.py 接入, 新增 endpoint 继承 |
| 2. require_tenant | ✅ | 所有新 endpoint 调用 `_tenant_id(request)` |
| 3. Outbox | ⏭️ | DLQ replay 不写 outbox(幂等重放) |
| 4. BearerAuth | ✅ | install_auth 已强制 |
| 5. 跨租户 negative | ✅ | test_dlq_list_filters_by_tenant + test_subscription_pause_and_resume 含跨租户断言 |

---

## 5. 硬规则对齐

| # | 硬规则 | 对齐 |
|---|---|---|
| 3 | 没有 tenant 上下文, 不访问 repository | ✅ 所有 store 操作 tenant-scoped |
| 4 | 外部系统没有 ACL Client | ✅ webhook delivery 走 httpx + HMAC 签名 |
| 7 | 契约或集成测试跳过不标记 Accepted | ✅ 0 skip / 67 pass |

---

## 6. 结论

publish → subscription → webhook fan-out → DLQ 全链路打通。订阅暂停/恢复 + DLQ 查询/重放管理能力就绪。**Accepted**。
