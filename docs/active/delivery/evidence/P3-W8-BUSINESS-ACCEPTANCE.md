# P3-W8 业务深化 — 4 域 PRD 业务逻辑补齐验收

> **验收日期**: 2026-08-01
> **批次**: P3-W8（BUSINESS-SLICES 业务深化 wave）
> **范围**: 4 个域的真实业务逻辑补齐（状态机 / 跨服务 / 真实持久化）
> **关联 ADR**: ADR-0014（5 步接入）/ ADR-0013（Outbox）/ ADR-0016（BUSINESS-SLICES）
> **关联 PRD**: PRD-APP-ARCH / PRD-APP-AGENT / PRD-TECH-MSG / PRD-APP-WFE
> **状态**: ✅ **Accepted**

---

## 1. 改动清单（4 域）

| 域 | endpoint | 业务能力 | 新增 tests |
|---|---|---|---:|
| **mate-app-arch** | `GET /capabilities` + `GET /capability-mappings` | 能力清单 + 能力→应用映射（分页） | 4 |
| **mate-tech-agent** | `POST /plan/execute` | cross-agent plan 编排 + outbox `agent.plan.executed` | 3 |
| **mate-tech-msg** | `GET /messages` | 历史消息查询（topic / since 过滤 + 分页） | 4 |
| **mate-app-wfe** | `POST /flows/deploy` | Flowable BPMN deploy 集成（httpx + in-memory 降级）+ outbox `wfe.flow.deployed` | 5 |
| | | **合计** | **16** |

---

## 2. 测试结果

```text
# 4 域独立测试（含全部历史用例回归）
$ python -m pytest mate-platform-backend/packages/{mate-app-arch,mate-tech-agent,mate-tech-msg,mate-app-wfe}/tests \
    -q --tb=short
177 passed in ~62s   # 0 failed / 0 skipped

# 新增 16 个测试逐项确认
$ python -m pytest <16 个新增 test node id> -v
16 passed in 0.79s    # 0 failed / 0 skipped
```

### 2.1 测试明细

| 域 | 测试 | 断言要点 |
|---|---|---|
| arch | `test_capabilities_returns_seed_data` | 种子能力 ≥3，含 cap-data / cap-knowledge / cap-platform |
| arch | `test_capabilities_tenant_isolation` | acme / globex 互不可见 |
| arch | `test_capability_mappings_returns_seed_data` | 映射含 capability_code / application_code / business_process_code |
| arch | `test_capability_mappings_tenant_isolation` | 每租户独立种子集 |
| agent | `test_plan_execute_happy_path` | execution_id 生成 + 每步 completed |
| agent | `test_plan_execute_emits_outbox` | `agent.plan.executed` + payload / tenant_id |
| agent | `test_plan_execute_tenant_isolation` | 两租户事件 tenant_id 绑定各自租户 |
| msg | `test_messages_returns_history` | 种子历史 + tenant_id 绑定 |
| msg | `test_messages_filtered_by_topic` | topic 精确过滤 |
| msg | `test_messages_tenant_isolation` | 租户隔离 |
| msg | `test_messages_since_filter` | since=1250 仅返回 ts≥1250 |
| wfe | `test_flowable_client_initializes_from_env` | 读 FLOWABLE_BASE_URL → mode=flowable |
| wfe | `test_flowable_client_fallback_to_inmemory` | 无 base_url → in-memory；引擎不可达 → fallback |
| wfe | `test_deploy_flow_happy_path` | 201 + engine=in-memory + tenant 绑定 |
| wfe | `test_deploy_flow_emits_outbox` | `wfe.flow.deployed` + payload |
| wfe | `test_deploy_flow_tenant_isolation` | 事件 tenant_id + per-tenant store 隔离 |

---

## 3. 关键交付详情

### 3.1 mate-app-arch（capabilities / capability-mappings）
- `GET /capabilities`、`GET /capability-mappings` 已在 P2-W4 落地（复用 `_paginate`）。
- 本批次补齐 4 个命名 PRD 测试（种子数据 + 租户隔离），闭环 FR-ARCH-ARCHGETARCHCAPABILITIES / FR-ARCH-ARCHGETARCHCAPABILITYMAPPINGS。

### 3.2 mate-tech-agent（cross-agent plan execute）
- `repositories/in_memory.py` 新增 `PlanExecution` dataclass + `_PLAN_EXECUTIONS` 存储 + 种子。
- `api/schemas.py` 新增 `PlanStep` / `PlanExecuteRequest` / `PlanExecuteResponse`。
- `POST /api/v1/agent/plan/execute`：编排 steps → 记录每步 result → 持久化 → emit `agent.plan.executed`。

### 3.3 mate-tech-msg（历史消息查询）
- 新建 `src/mate_tech_msg/in_memory.py`：`MessageRecord` + tenant-scoped 历史 + `list_messages(topic/since)` + 种子。
- `main.py` 新增 `GET /api/v1/msg/messages`（topic / since 过滤 + 分页信封）。

### 3.4 mate-app-wfe（Flowable BPMN deploy 集成 stub）
- `clients.py` 新增 `FlowableClient`（httpx 调 Flowable REST，读 `FLOWABLE_BASE_URL`，引擎不可达降级 in-memory）。
- `repositories/in_memory.py` 新增 `FlowDeployment` + `deploy_flow()` / `list_deployments()`。
- `POST /api/v1/wfe/flows/deploy`：解析 BPMN → FlowableClient.deploy → 持久化 → emit `wfe.flow.deployed`。

---

## 4. ADR-0014 5 步接入复核

| 步骤 | arch | agent | msg | wfe |
|---|:---:|:---:|:---:|:---:|
| 1. install_auth | ✅ | ✅ | ✅ | ✅ |
| 2. require_tenant | ✅ | ✅ | ✅ | ✅ |
| 3. Outbox event | — (读) | ✅ `agent.plan.executed` | — (读) | ✅ `wfe.flow.deployed` |
| 4. BearerAuth 出站 | — | — | — | ✅ FlowableClient |
| 5. 跨租户 negative | ✅ | ✅ | ✅ | ✅ |

---

## 5. 结论

4 域 PRD 业务逻辑补齐完成，**177 passed / 0 failed / 0 skipped**，16 个新增测试全部通过。**Accepted**。
