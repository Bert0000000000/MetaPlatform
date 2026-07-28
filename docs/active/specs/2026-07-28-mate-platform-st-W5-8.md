# W5-8 子任务卡（ST）：app-kb（业务聚合）

> **源任务卡**：[tasks-W5.md § W5-8](./2026-07-27-mate-platform-tasks-W5.md#w5-8-app-kb业务聚合12-张-tc)
> **总览**：[Task Breakdown v2.0](./2026-07-27-mate-platform-task-breakdown.md)
> **Sprint**：S9-S10（2026-10-26 ~ 2026-11-22）
> **里程碑**：M3 关键路径
> **ST 总数**：27（拆解自 12 个 TC）
> **粒度**：0.5-4 小时 / 单文件 / 单函数 / 单测试

---

## 目录

- [TC-5.8.1 apps/app-kb 初始化（2 ST）](#tc-581-appsapp-kb-初始化2-st)
- [TC-5.8.2 业务模型 Pydantic（2 ST）](#tc-582-业务模型-pydantic2-st)
- [TC-5.8.3 知识库管理聚合（3 ST）](#tc-583-知识库管理聚合3-st)
- [TC-5.8.4 文档上传 + 异步向量化（3 ST）](#tc-584-文档上传--异步向量化3-st)
- [TC-5.8.5 检索聚合（2 ST）](#tc-585-检索聚合2-st)
- [TC-5.8.6 Agent 对话聚合（3 ST）](#tc-586-agent-对话聚合3-st)
- [TC-5.8.7 任务编排（3 ST）](#tc-587-任务编排3-st)
- [TC-5.8.8 业务事件订阅（2 ST）](#tc-588-业务事件订阅2-st)
- [TC-5.8.9 统计与计量（2 ST）](#tc-589-统计与计量2-st)
- [TC-5.8.10 OpenAPI（1 ST）](#tc-5810-openapi1-st)
- [TC-5.8.11 端到端 E2E（2 ST）](#tc-5811-端到端-e2e2-st)
- [TC-5.8.12 单测 + 集成（2 ST）](#tc-5812-单测--集成2-st)
- [完成度检查表](#完成度检查表)

---
### TC-5.8.1 apps/app-kb 初始化（2 ST）

#### ST-5.8.1.1 apps/app-kb pyproject + 依赖

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.1 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/app-kb/pyproject.toml |
| 前置 ST | TC-1.1.7 |
| 输出 commit | feat(app-kb): scaffold |

**改动清单**：
1. uv init --package app-kb
2. 加 fastapi、httpx、aiokafka、psycopg

**DoD**：
- [ ] uv sync 成功

---

#### ST-5.8.1.2 main.py + /healthz + docker-compose

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.1 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/app-kb/src/app_kb/main.py、docker-compose.yml |
| 前置 ST | ST-5.8.1.1 |
| 输出 commit | feat(app-kb): main+compose |

**改动清单**：
1. FastAPI app + `/healthz`
2. docker-compose 加 app-kb（端口 8010）

**DoD**：
- [ ] app 启动

---
### TC-5.8.2 业务模型 Pydantic（2 ST）

#### ST-5.8.2.1 DocumentApp / RetrievalRequestApp / AgentChatRequest schema

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.2 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | libs/openapi-schemas/src/openapi_schemas/app_kb.py |
| 前置 ST | TC-1.7.4 |
| 输出 commit | feat(app-kb): models |

**改动清单**：
1. `DocumentApp`、`RetrievalRequestApp`、`AgentChatRequest` 等聚合 schema

**DoD**：
- [ ] pyright strict 通过

---

#### ST-5.8.2.2 schema roundtrip + OpenAPI 同步

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.2 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | libs/openapi-schemas/tests/test_app_kb_schema.py |
| 前置 ST | ST-5.8.2.1 |
| 输出 commit | test(app-kb): schema roundtrip |

**改动清单**：
1. roundtrip 测试

**DoD**：
- [ ] roundtrip 通过

---
### TC-5.8.3 知识库管理聚合（3 ST）

#### ST-5.8.3.1 /api/v1/app-kb/kbs CRUD 端点

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.3 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/app-kb/src/app_kb/api/kbs.py |
| 前置 ST | TC-5.8.2、TC-2.3.3 |
| 输出 commit | feat(app-kb): kb api |

**改动清单**：
1. POST / GET / PUT / DELETE `/api/v1/app-kb/kbs`

**DoD**：
- [ ] swagger-ui 列出

---

#### ST-5.8.3.2 鉴权 + 限流封装

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.3 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/app-kb/src/app_kb/auth.py |
| 前置 ST | ST-5.8.3.1 |
| 输出 commit | feat(app-kb): auth wrapper |

**改动清单**：
1. 复用 tech-iam 的 current_user
2. 限流（每租户）

**DoD**：
- [ ] 鉴权 + 限流

---

#### ST-5.8.3.3 KB 端到端集成测试

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.3 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/app-kb/tests/test_kb_api.py |
| 前置 ST | ST-5.8.3.2 |
| 输出 commit | test(app-kb): kb e2e |

**改动清单**：
1. 端到端 200

**DoD**：
- [ ] 端到端通过

---
### TC-5.8.4 文档上传 + 异步向量化（3 ST）

#### ST-5.8.4.1 multipart 上传 + 存原档

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.4 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/app-kb/src/app_kb/api/upload.py |
| 前置 ST | TC-5.8.3、TC-5.6.7 |
| 输出 commit | feat(app-kb): upload |

**改动清单**：
1. POST /upload（multipart）
2. 调 tech-kb 存原档到 MinIO

**DoD**：
- [ ] 上传工作

---

#### ST-5.8.4.2 发 Kafka 触发向量化

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.4 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/app-kb/src/app_kb/publisher.py |
| 前置 ST | ST-5.8.4.1 |
| 输出 commit | feat(app-kb): kafka publish |

**改动清单**：
1. 上传后 → 调 tech-msg publish `mate.kb.ingest`

**DoD**：
- [ ] kafka 消息发出

---

#### ST-5.8.4.3 上传后 30s 可检索验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.4 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/app-kb/tests/test_upload_flow.py |
| 前置 ST | ST-5.8.4.2 |
| 输出 commit | test(app-kb): upload flow |

**改动清单**：
1. 上传 → 等 30s → 检索

**DoD**：
- [ ] 30s 内可检索

---
### TC-5.8.5 检索聚合（2 ST）

#### ST-5.8.5.1 检索前按 tenant/权限过滤 KB

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.5 |
| 工时 | 3h | 角色 | Backend |
| 目标文件 | apps/app-kb/src/app_kb/api/search.py |
| 前置 ST | TC-5.8.3、TC-5.6.6 |
| 输出 commit | feat(app-kb): search |

**改动清单**：
1. `/api/v1/app-kb/search` 接收 → 过滤 kb_ids → 调 tech-rag

**DoD**：
- [ ] 检索聚合工作

---

#### ST-5.8.5.2 跨租户 0 召回验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.5 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/app-kb/tests/test_search_isolation.py |
| 前置 ST | ST-5.8.5.1 |
| 输出 commit | test(app-kb): search isolation |

**改动清单**：
1. tenant A 上传 → tenant B 检索 → 0 召回

**DoD**：
- [ ] 跨租户隔离

---
### TC-5.8.6 Agent 对话聚合（3 ST）

#### ST-5.8.6.1 /api/v1/app-kb/chat 端点

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.6 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/app-kb/src/app_kb/api/chat.py |
| 前置 ST | TC-5.7.5、TC-5.8.5 |
| 输出 commit | feat(app-kb): chat |

**改动清单**：
1. POST /chat 接 AgentChatRequest → AgentChatResponse

**DoD**：
- [ ] 端点工作

---

#### ST-5.8.6.2 自动注入用户可访问的 KB

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.6 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/app-kb/src/app_kb/api/chat.py |
| 前置 ST | ST-5.8.6.1 |
| 输出 commit | feat(app-kb): chat kb filter |

**改动清单**：
1. 自动从 user.permissions 推 kb_ids
2. 传给 agent

**DoD**：
- [ ] 自动注入

---

#### ST-5.8.6.3 返回引用 + 答案验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.6 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/app-kb/tests/test_chat.py |
| 前置 ST | ST-5.8.6.2 |
| 输出 commit | test(app-kb): chat e2e |

**改动清单**：
1. chat → 验证返回引用 + 答案

**DoD**：
- [ ] 引用 + 答案工作

---
### TC-5.8.7 任务编排（3 ST）

#### ST-5.8.7.1 /api/v1/app-kb/workflows 启动端点

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.7 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/app-kb/src/app_kb/api/workflows.py |
| 前置 ST | TC-3.4.5、TC-5.7.8 |
| 输出 commit | feat(app-kb): workflow |

**改动清单**：
1. POST /workflows 接收 workflow_key + inputs → 调 tech-bpm start_process

**DoD**：
- [ ] 启动端点

---

#### ST-5.8.7.2 BPMN 流程变量 + 回调 webhook

| 字段 | 值 |
---|---|
| 所属 TC | TC-5.8.7 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/app-kb/src/app_kb/api/webhooks.py |
| 前置 ST | ST-5.8.7.1 |
| 输出 commit | feat(app-kb): workflow callback |

**改动清单**：
1. POST /webhooks/bpm 接收 Flowable 回调
2. 写流程变量

**DoD**：
- [ ] 回调到位

---

#### ST-5.8.7.3 workflow 端到端验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.7 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/app-kb/tests/test_workflow.py |
| 前置 ST | ST-5.8.7.2 |
| 输出 commit | test(app-kb): workflow |

**改动清单**：
1. workflow 跑通 + 回调到位

**DoD**：
- [ ] e2e 通过

---
### TC-5.8.8 业务事件订阅（2 ST）

#### ST-5.8.8.1 订阅 mate.events.* + 转 SSE

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.8 |
| 工时 | 3h | 角色 | Backend |
| 目标文件 | apps/app-kb/src/app_kb/events.py |
| 前置 ST | TC-5.1.3 |
| 输出 commit | feat(app-kb): events |

**改动清单**：
1. 订阅 mate.events.* → 推 SSE

**DoD**：
- [ ] 订阅工作

---

#### ST-5.8.8.2 事件 1s 内到达前端验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.8 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/app-kb/tests/test_events.py |
| 前置 ST | ST-5.8.8.1 |
| 输出 commit | test(app-kb): events |

**改动清单**：
1. 发事件 → EventSource 1s 内收到

**DoD**：
- [ ] 1s 延迟达标

---
### TC-5.8.9 统计与计量（2 ST）

#### ST-5.8.9.1 /stats 端点 + SQL 聚合

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.9 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/app-kb/src/app_kb/api/stats.py |
| 前置 ST | TC-5.8.3 |
| 输出 commit | feat(app-kb): stats |

**改动清单**：
1. `/api/v1/app-kb/stats`：KB / 文档 / 检索量

**DoD**：
- [ ] 端点工作

---

#### ST-5.8.9.2 dashboard SQL 验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.9 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/app-kb/tests/test_stats.py |
| 前置 ST | ST-5.8.9.1 |
| 输出 commit | test(app-kb): stats |

**改动清单**：
1. SQL 聚合 + 校验

**DoD**：
- [ ] dashboard 可用

---
### TC-5.8.10 OpenAPI（1 ST）

#### ST-5.8.10.1 openapi/paths/app-kb.yaml 同步

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.10 |
| 工时 | 3h | 角色 | Backend |
| 目标文件 | openapi/paths/app-kb.yaml |
| 前置 ST | TC-5.8.1 ~ TC-5.8.9 |
| 输出 commit | docs(app-kb): openapi |

**改动清单**：
1. 同步所有 app-kb 端点

**DoD**：
- [ ] CI lint 绿

---
### TC-5.8.11 端到端 E2E（2 ST）

#### ST-5.8.11.1 tests/e2e/test_kb_lifecycle.py

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.11 |
| 工时 | 4h | 角色 | QA |
| 目标文件 | apps/app-kb/tests/e2e/test_kb_lifecycle.py |
| 前置 ST | TC-5.8.4、TC-5.8.5、TC-5.8.6 |
| 输出 commit | test(app-kb): e2e lifecycle |

**改动清单**：
1. 上传 → 检索 → 对话 → 引用 完整生命周期

**DoD**：
- [ ] CI 绿

---

#### ST-5.8.11.2 录屏归档 + 报告

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.11 |
| 工时 | 2h | 角色 | QA |
| 目标文件 | docs/active/reports/app-kb-e2e.md |
| 前置 ST | ST-5.8.11.1 |
| 输出 commit | docs(app-kb): e2e report |

**改动清单**：
1. 跑流程录屏
2. 写报告

**DoD**：
- [ ] 录屏 + 报告

---
### TC-5.8.12 单测 + 集成（2 ST）

#### ST-5.8.12.1 tests/conftest.py fixtures

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.12 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/app-kb/tests/conftest.py |
| 前置 ST | TC-5.8.1 ~ TC-5.8.11 |
| 输出 commit | test(app-kb): conftest |

**改动清单**：
1. tech-kb / tech-rag / tech-msg / tech-agent fixtures

**DoD**：
- [ ] fixtures 可复用

---

#### ST-5.8.12.2 覆盖率 ≥80% + CI 绿

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.8.12 |
| 工时 | 3h | 角色 | Backend |
| 目标文件 | apps/app-kb/tests/ |
| 前置 ST | ST-5.8.12.1 |
| 输出 commit | test(app-kb): full suite |

**改动清单**：
1. 补齐缺失测试

**DoD**：
- [ ] 覆盖率 ≥ 80%

---

## W5-8 完成度检查表

| 子领域 | 关键路径 | TC 数 | ST 数 | ST 总工时 | 状态 |
|---|---|---|---|---|---|
| W5-8 app-kb | **是** | 12 | 27 | ~55h | 🔴 未启动 |

---

## 变更记录

| 日期 | 版本 | 变更 | 原因 |
|---|---|---|---|
| 2026-07-28 | v2.0 | 从 W5-8 TC（12 条）拆出 ST（27 条） | 单回合执行避免 Token 超限 |