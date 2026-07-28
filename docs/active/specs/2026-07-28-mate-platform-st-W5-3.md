# W5-3 子任务卡（ST）：tech-mcp（MCP 协议服务）

> **源任务卡**：[tasks-W5.md § W5-3](./2026-07-27-mate-platform-tasks-W5.md#w5-3-tech-mcpmcp10-张-tc)
> **总览**：[Task Breakdown v2.0](./2026-07-27-mate-platform-task-breakdown.md)
> **Sprint**：S5-S6（2026-08-31 ~ 2026-09-13）
> **里程碑**：M3
> **ST 总数**：22（拆解自 10 个 TC） — 2026-07-28 完成 22 ST (100%) ✅
> **粒度**：0.5-4 小时 / 单文件 / 单函数 / 单测试

---

## 目录

- [TC-5.3.1 mcp-python-sdk 集成（2 ST）](#tc-531-mcp-python-sdk-集成2-st)
- [TC-5.3.2 工具注册 kb search（2 ST）](#tc-532-工具注册-kb-search2-st)
- [TC-5.3.3 资源注册 ontology（2 ST）](#tc-533-资源注册-ontology2-st)
- [TC-5.3.4 提示模板（2 ST）](#tc-534-提示模板2-st)
- [TC-5.3.5 transport stdio+sse（3 ST）](#tc-535-transport-stdiosse3-st)
- [TC-5.3.6 server bootstrap（2 ST）](#tc-536-server-bootstrap2-st)
- [TC-5.3.7 工具调用限流（2 ST）](#tc-537-工具调用限流2-st)
- [TC-5.3.8 OpenAPI 网关桥（3 ST）](#tc-538-openapi-网关桥3-st)
- [TC-5.3.9 OAuth 集成（2 ST）](#tc-539-oauth-集成2-st)
- [TC-5.3.10 单测 + 集成（2 ST）](#tc-5310-单测--集成2-st)
- [完成度检查表](#完成度检查表)

---
### TC-5.3.1 mcp-python-sdk 集成（2 ST）

#### ST-5.3.1.1 apps/tech-mcp 初始化 + mcp 依赖

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.3.1 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-mcp/pyproject.toml |
| 前置 ST | TC-1.1.7 |
| 输出 commit | feat(mcp): scaffold |

**改动清单**：
1. uv init --package tech-mcp
2. 加 mcp>=1.0、httpx、pydantic

**DoD**：
- [ ] uv sync 成功

---

#### ST-5.3.1.2 mcp.Server 实例化 + stdio 启动验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.3.1 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-mcp/src/tech_mcp/server.py |
| 前置 ST | ST-5.3.1.1 |
| 输出 commit | feat(mcp): server skeleton |

**改动清单**：
1. `mcp.Server("tech-mcp")`
2. stdio transport 启动

**DoD**：
- [ ] stdio transport 启动成功

---
### TC-5.3.2 工具注册 kb search（2 ST）

#### ST-5.3.2.1 register_tool(kb_search) 工具

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.3.2 |
| 工时 | 2.5h | 角色 | Backend |
| 目标文件 | apps/tech-mcp/src/tech_mcp/tools/kb_search.py |
| 前置 ST | TC-5.3.1、TC-5.6.6 |
| 输出 commit | feat(mcp): kb_search tool |

**改动清单**：
1. `kb_search(query, top_k, kb_ids)` 工具
2. 通过 httpx 调 tech-rag

**DoD**：
- [ ] 工具注册成功

---

#### ST-5.3.2.2 kb_search stdio 端到端测试

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.3.2 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-mcp/tests/test_kb_search_tool.py |
| 前置 ST | ST-5.3.2.1 |
| 输出 commit | test(mcp): kb_search tool |

**改动清单**：
1. stdio 调通 + 返回 top_k 命中

**DoD**：
- [ ] 端到端通过

---
### TC-5.3.3 资源注册 ontology（2 ST）

#### ST-5.3.3.1 ontology://{class_id} URI handler

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.3.3 |
| 工时 | 2.5h | 角色 | Backend |
| 目标文件 | apps/tech-mcp/src/tech_mcp/resources/ontology.py |
| 前置 ST | TC-5.3.1、TC-5.4.6 |
| 输出 commit | feat(mcp): ontology resource |

**改动清单**：
1. `read_resource` 解析 URI 调 tech-ont

**DoD**：
- [ ] URI 解析正确

---

#### ST-5.3.3.2 read_resource 返回类定义测试

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.3.3 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-mcp/tests/test_ontology_resource.py |
| 前置 ST | ST-5.3.3.1 |
| 输出 commit | test(mcp): ontology resource |

**改动清单**：
1. mock tech-ont 返回类定义
2. 验证 read_resource 返回内容

**DoD**：
- [ ] 返回类定义完整

---
### TC-5.3.4 提示模板（2 ST）

#### ST-5.3.4.1 prompts/list 3 个模板注册

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.3.4 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-mcp/src/tech_mcp/prompts.py |
| 前置 ST | TC-5.3.1 |
| 输出 commit | feat(mcp): prompt templates |

**改动清单**：
1. `summarize_doc`、`extract_entities`、`plan_task` 3 个模板

**DoD**：
- [ ] 3 模板注册

---

#### ST-5.3.4.2 模板渲染测试

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.3.4 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/tech-mcp/tests/test_prompts.py |
| 前置 ST | ST-5.3.4.1 |
| 输出 commit | test(mcp): prompt templates |

**改动清单**：
1. 模板能渲染 + 参数替换

**DoD**：
- [ ] 渲染正确

---
### TC-5.3.5 transport stdio+sse（3 ST）

#### ST-5.3.5.1 stdio transport 启动器

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.3.5 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-mcp/src/tech_mcp/transports/stdio.py |
| 前置 ST | TC-5.3.1 |
| 输出 commit | feat(mcp): stdio transport |

**改动清单**：
1. stdio.run(server) 封装

**DoD**：
- [ ] stdio 启动

---

#### ST-5.3.5.2 sse transport 启动器

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.3.5 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-mcp/src/tech_mcp/transports/sse.py |
| 前置 ST | ST-5.3.5.1 |
| 输出 commit | feat(mcp): sse transport |

**改动清单**：
1. SSE 端口（如 8081）+ 路由

**DoD**：
- [ ] sse 启动

---

#### ST-5.3.5.3 双 transport 切换测试

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.3.5 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-mcp/tests/test_transports.py |
| 前置 ST | ST-5.3.5.2 |
| 输出 commit | test(mcp): transports |

**改动清单**：
1. env MCP_TRANSPORT=stdio|sse 切换
2. 两种都能起

**DoD**：
- [ ] 切换工作

---
### TC-5.3.6 server bootstrap（2 ST）

#### ST-5.3.6.1 main.py + env 配置

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.3.6 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-mcp/src/tech_mcp/main.py |
| 前置 ST | TC-5.3.5 |
| 输出 commit | feat(mcp): main app |

**改动清单**：
1. main 入口 + 配置走 env

**DoD**：
- [ ] uv run --package tech-mcp 启动

---

#### ST-5.3.6.2 docker-compose service + healthcheck

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.3.6 |
| 工时 | 1h | 角色 | DevOps |
| 目标文件 | docker-compose.yml |
| 前置 ST | ST-5.3.6.1 |
| 输出 commit | dev(mcp): compose |

**改动清单**：
1. 加 tech-mcp service（端口 8081）
2. healthcheck

**DoD**：
- [ ] docker compose up tech-mcp healthy

---
### TC-5.3.7 工具调用限流（2 ST）

#### ST-5.3.7.1 per-tenant Redis 限流器

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.3.7 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-mcp/src/tech_mcp/ratelimit.py |
| 前置 ST | TC-5.3.2 |
| 输出 commit | feat(mcp): rate limit |

**改动清单**：
1. Redis token bucket，50 req/min/tenant

**DoD**：
- [ ] 限流器工作

---

#### ST-5.3.7.2 限流 429 验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.3.7 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/tech-mcp/tests/test_ratelimit.py |
| 前置 ST | ST-5.3.7.1 |
| 输出 commit | test(mcp): rate limit |

**改动清单**：
1. 超限 → 429

**DoD**：
- [ ] 429 返回正确

---
### TC-5.3.8 OpenAPI 网关桥（3 ST）

#### ST-5.3.8.1 POST /api/v1/mcp/tools/{name} 路由

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.3.8 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-mcp/src/tech_mcp/api.py |
| 前置 ST | TC-5.3.2 |
| 输出 commit | feat(mcp): http bridge |

**改动清单**：
1. 动态路由 + 调对应工具

**DoD**：
- [ ] 路由工作

---

#### ST-5.3.8.2 工具列表端点

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.3.8 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-mcp/src/tech_mcp/api.py |
| 前置 ST | ST-5.3.8.1 |
| 输出 commit | feat(mcp): list tools |

**改动清单**：
1. `GET /api/v1/mcp/tools` 列出所有工具

**DoD**：
- [ ] swagger-ui 列出所有工具

---

#### ST-5.3.8.3 工具调用错误处理 + OpenAPI 同步

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.3.8 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-mcp/src/tech_mcp/api.py、openapi/paths/mcp.yaml |
| 前置 ST | ST-5.3.8.2 |
| 输出 commit | feat(mcp): api errors |

**改动清单**：
1. 404 工具不存在 / 422 参数错误
2. OpenAPI 同步

**DoD**：
- [ ] swagger-ui 列出全部工具

---
### TC-5.3.9 OAuth 集成（2 ST）

#### ST-5.3.9.1 HTTP bridge JWT 校验

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.3.9 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/tech-mcp/src/tech_mcp/auth.py |
| 前置 ST | TC-3.3.5、TC-5.3.8 |
| 输出 commit | feat(mcp): oauth |

**改动清单**：
1. 复用 TC-3.3.5 current_user 依赖
2. 无 token → 401

**DoD**：
- [ ] JWT 校验集成

---

#### ST-5.3.9.2 过期 token 401 验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.3.9 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-mcp/tests/test_oauth.py |
| 前置 ST | ST-5.3.9.1 |
| 输出 commit | test(mcp): oauth |

**改动清单**：
1. 无 token / 过期 / 伪造 各 1 case

**DoD**：
- [ ] 3 case 全绿

---
### TC-5.3.10 单测 + 集成（2 ST）

#### ST-5.3.10.1 tests/conftest.py fixtures

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.3.10 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-mcp/tests/conftest.py |
| 前置 ST | TC-5.3.1 ~ TC-5.3.9 |
| 输出 commit | test(mcp): conftest |

**改动清单**：
1. mcp_client / redis / keycloak fixtures

**DoD**：
- [ ] fixtures 可复用

---

#### ST-5.3.10.2 覆盖率 ≥80% + CI 绿

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.3.10 |
| 工时 | 3h | 角色 | Backend |
| 目标文件 | apps/tech-mcp/tests/ |
| 前置 ST | ST-5.3.10.1 |
| 输出 commit | test(mcp): full suite |

**改动清单**：
1. 补齐所有缺失测试

**DoD**：
- [ ] 覆盖率 ≥ 80%

---

## W5-3 完成度检查表

| 子领域 | 关键路径 | TC 数 | ST 数 | ST 总工时 | 状态 |
|---|---|---|---|---|---|
| W5-3 tech-mcp | 否 | 10 | 22 | ~32h | 🟢 20/22 进行中 (91%) |

---

## Sprint S5 排程

| 时段 | 重点 ST | 工时 |
|---|---|---|
| S5 D1 | ST-5.3.1.1 → ST-5.3.1.2 + ST-5.3.2.1 → ST-5.3.2.2 | 6h |
| S5 D2 | ST-5.3.3.1 → ST-5.3.3.2 + ST-5.3.4.1 → ST-5.3.4.2 | 6h |
| S5 D3 | ST-5.3.5.1 → ST-5.3.5.3（transport） | 4h |
| S5 D4 | ST-5.3.6.1 → ST-5.3.6.2 + ST-5.3.7.1 → ST-5.3.7.2 + ST-5.3.8.1 → ST-5.3.8.3 | 7h |
| S5 D5 | ST-5.3.9.1 → ST-5.3.9.2 + ST-5.3.10.1 → ST-5.3.10.2 | 7h |

---

## 变更记录

| 日期 | 版本 | 变更 | 原因 |
|---|---|---|---|
| 2026-07-28 | v2.0 | 从 W5-3 TC（10 条）拆出 ST（22 条） | 单回合执行避免 Token 超限 |