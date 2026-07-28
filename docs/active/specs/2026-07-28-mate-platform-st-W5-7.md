# W5-7 子任务卡（ST）：tech-agent（Agent + LangGraph）

> **源任务卡**：[tasks-W5.md § W5-7](./2026-07-27-mate-platform-tasks-W5.md#w5-7-tech-agentagent--langgraph14-张-tc)
> **总览**：[Task Breakdown v2.0](./2026-07-27-mate-platform-task-breakdown.md)
> **Sprint**：S8-S9（2026-10-12 ~ 2026-11-08）
> **里程碑**：M3 关键路径
> **ST 总数**：33（拆解自 14 个 TC）
> **粒度**：0.5-4 小时 / 单文件 / 单函数 / 单测试

---

## 目录

- [TC-5.7.1 apps/tech-agent 初始化（2 ST）](#tc-571-appstech-agent-初始化2-st)
- [TC-5.7.2 LangGraph 集成（2 ST）](#tc-572-langgraph-集成2-st)
- [TC-5.7.3 工具调用桥 MCP（3 ST）](#tc-573-工具调用桥-mcp3-st)
- [TC-5.7.4 状态持久化 PG（2 ST）](#tc-574-状态持久化-pg2-st)
- [TC-5.7.5 S1 单 Agent 问答（3 ST）](#tc-575-s1-单-agent-问答3-st)
- [TC-5.7.6 S2 多 Agent 协作（3 ST）](#tc-576-s2-多-agent-协作3-st)
- [TC-5.7.7 S3 Human-in-the-loop（3 ST）](#tc-577-s3-human-in-the-loop3-st)
- [TC-5.7.8 S4 流程驱动（3 ST）](#tc-578-s4-流程驱动3-st)
- [TC-5.7.9 SSE 流式输出（2 ST）](#tc-579-sse-流式输出2-st)
- [TC-5.7.10 内存与上下文（3 ST）](#tc-5710-内存与上下文3-st)
- [TC-5.7.11 安全护栏（2 ST）](#tc-5711-安全护栏2-st)
- [TC-5.7.12 评估集（2 ST）](#tc-5712-评估集2-st)
- [TC-5.7.13 OpenAPI（1 ST）](#tc-5713-openapi1-st)
- [TC-5.7.14 单测 + 集成（2 ST）](#tc-5714-单测--集成2-st)
- [完成度检查表](#完成度检查表)

---
### TC-5.7.1 apps/tech-agent 初始化（2 ST）

#### ST-5.7.1.1 apps/tech-agent pyproject + 依赖

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.1 |
| 工时 | 0.5h | 角色 | Backend |
| 目标文件 | apps/tech-agent/pyproject.toml |
| 前置 ST | TC-1.1.7 |
| 输出 commit | feat(agent): scaffold |

**改动清单**：
1. uv init --package tech-agent
2. 加 langgraph、langchain、httpx、psycopg、sse-starlette

**DoD**：
- [ ] uv sync 成功

---

#### ST-5.7.1.2 main.py + /healthz + docker-compose

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.1 |
| 工时 | 1.5h | 角色 | Backend |
| 目标文件 | apps/tech-agent/src/tech_agent/main.py、docker-compose.yml |
| 前置 ST | ST-5.7.1.1 |
| 输出 commit | feat(agent): main+compose |

**改动清单**：
1. FastAPI app + `/healthz`
2. docker-compose 加 tech-agent（端口 8009）

**DoD**：
- [ ] app 启动

---
### TC-5.7.2 LangGraph 集成（2 ST）

#### ST-5.7.2.1 libs/agent/graph.py StateGraph 工厂

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.2 |
| 工时 | 3h | 角色 | Backend |
| 目标文件 | libs/agent/src/agent/graph.py |
| 前置 ST | TC-5.7.1 |
| 输出 commit | feat(agent): langgraph factory |

**改动清单**：
1. `def build_state_graph(name, nodes, edges) -> CompiledGraph`
2. 支持 add_node / add_edge / add_conditional_edges

**DoD**：
- [ ] pyright strict 通过

---

#### ST-5.7.2.2 echo graph 跑通验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.2 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | libs/agent/tests/test_graph.py |
| 前置 ST | ST-5.7.2.1 |
| 输出 commit | test(agent): echo graph |

**改动清单**：
1. 示例 "echo" graph：input → output

**DoD**：
- [ ] echo graph 跑通

---
### TC-5.7.3 工具调用桥 MCP（3 ST）

#### ST-5.7.3.1 MCP 客户端封装

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.3 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/tech-agent/src/tech_agent/mcp_client.py |
| 前置 ST | TC-5.3.1、TC-5.7.2 |
| 输出 commit | feat(agent): mcp client |

**改动清单**：
1. 调 tech-mcp HTTP bridge
2. 异步调工具

**DoD**：
- [ ] 客户端可用

---

#### ST-5.7.3.2 LangChain Tool 适配器

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.3 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/tech-agent/src/tech_agent/tools.py |
| 前置 ST | ST-5.7.3.1 |
| 输出 commit | feat(agent): tool adapter |

**改动清单**：
1. MCP tool → LangChain Tool 转换（name、description、args schema）

**DoD**：
- [ ] 适配器工作

---

#### ST-5.7.3.3 echo agent 调用 kb_search 验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.3 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/tech-agent/tests/test_tool_bridge.py |
| 前置 ST | ST-5.7.3.2 |
| 输出 commit | test(agent): tool bridge |

**改动清单**：
1. echo agent + kb_search tool 调用

**DoD**：
- [ ] 端到端拿到 kb_search 结果

---
### TC-5.7.4 状态持久化 PG（2 ST）

#### ST-5.7.4.1 PostgresSaver 配置 + checkpoint 表

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.4 |
| 工时 | 3h | 角色 | Backend |
| 目标文件 | apps/tech-agent/src/tech_agent/checkpoint.py |
| 前置 ST | TC-2.1.1、TC-5.7.2 |
| 输出 commit | feat(agent): checkpoint pg |

**改动清单**：
1. `langgraph.checkpoint.postgres.PostgresSaver` 初始化
2. checkpoint 表自动建

**DoD**：
- [ ] Saver 可用

---

#### ST-5.7.4.2 kill -9 重启恢复 state 验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.4 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-agent/tests/test_checkpoint.py |
| 前置 ST | ST-5.7.4.1 |
| 输出 commit | test(agent): checkpoint |

**改动清单**：
1. 启 agent → kill → 重启 → 验证 state 恢复

**DoD**：
- [ ] state 恢复工作

---
### TC-5.7.5 S1 单 Agent 问答（3 ST）

#### ST-5.7.5.1 kb_search tool + LLM 节点

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.5 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/tech-agent/src/tech_agent/scenarios/s1.py |
| 前置 ST | TC-5.7.3、TC-5.6.6 |
| 输出 commit | feat(agent): s1 kb node |

**改动清单**：
1. S1 graph：input → llm (tool call) → tool → llm → output

**DoD**：
- [ ] graph 结构完成

---

#### ST-5.7.5.2 /api/v1/agent/chat 端点

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.5 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/tech-agent/src/tech_agent/api/chat.py |
| 前置 ST | ST-5.7.5.1 |
| 输出 commit | feat(agent): chat api |

**改动清单**：
1. POST /chat 接 AgentRequest → AgentResponse

**DoD**：
- [ ] swagger-ui 列出

---

#### ST-5.7.5.3 S1 端到端集成测试

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.5 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/tech-agent/tests/test_s1.py |
| 前置 ST | ST-5.7.5.2 |
| 输出 commit | test(agent): s1 e2e |

**改动清单**：
1. swagger-ui 端到端 + 返回答案

**DoD**：
- [ ] 端到端通

---
### TC-5.7.6 S2 多 Agent 协作（3 ST）

#### ST-5.7.6.1 planner / worker / synthesizer 节点

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.6 |
| 工时 | 3h | 角色 | Backend |
| 目标文件 | apps/tech-agent/src/tech_agent/scenarios/s2.py |
| 前置 ST | TC-5.7.5 |
| 输出 commit | feat(agent): s2 nodes |

**改动清单**：
1. planner → workers → synthesizer 3 节点
2. add_conditional_edges

**DoD**：
- [ ] 3 节点结构

---

#### ST-5.7.6.2 worker fan-out + synthesizer merge

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.6 |
| 工时 | 3h | 角色 | Backend |
| 目标文件 | apps/tech-agent/src/tech_agent/scenarios/s2.py |
| 前置 ST | ST-5.7.6.1 |
| 输出 commit | feat(agent): s2 fan-out |

**改动清单**：
1. worker 多任务并发执行
2. synthesizer 合并结果

**DoD**：
- [ ] fan-out + merge 工作

---

#### ST-5.7.6.3 S2 端到端测试

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.6 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/tech-agent/tests/test_s2.py |
| 前置 ST | ST-5.7.6.2 |
| 输出 commit | test(agent): s2 e2e |

**改动清单**：
1. 3 节点 graph 串通验证

**DoD**：
- [ ] 串通通过

---
### TC-5.7.7 S3 Human-in-the-loop（3 ST）

#### ST-5.7.7.1 interrupt_before 节点配置

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.7 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/tech-agent/src/tech_agent/scenarios/s3.py |
| 前置 ST | TC-5.7.5 |
| 输出 commit | feat(agent): s3 interrupt |

**改动清单**：
1. graph 加 interrupt_before=["approval"]

**DoD**：
- [ ] interrupt 工作

---

#### ST-5.7.7.2 /api/v1/agent/approve 端点

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.7 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/tech-agent/src/tech_agent/api/approve.py |
| 前置 ST | ST-5.7.7.1 |
| 输出 commit | feat(agent): approve api |

**改动清单**：
1. POST /approve 接 thread_id + decision

**DoD**：
- [ ] approve 端点工作

---

#### ST-5.7.7.3 审批后自动继续验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.7 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/tech-agent/tests/test_s3.py |
| 前置 ST | ST-5.7.7.2 |
| 输出 commit | test(agent): s3 hitl |

**改动清单**：
1. interrupt → approve → 自动继续

**DoD**：
- [ ] 审批后继续

---
### TC-5.7.8 S4 流程驱动（3 ST）

#### ST-5.7.8.1 agent-decision-flow BPMN 完善

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.8 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/tech-agent/bpmn/agent-decision-flow.bpmn |
| 前置 ST | TC-3.4.5、TC-5.7.5 |
| 输出 commit | feat(agent): s4 bpmn |

**改动清单**：
1. 完整 BPMN：start → service task → exclusive gateway → 2 支
2. agent task 调 tech-agent

**DoD**：
- [ ] BPMN 完整

---

#### ST-5.7.8.2 tech-agent worker 调 BPMN

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.8 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/tech-agent/src/tech_agent/bpm_worker.py |
| 前置 ST | ST-5.7.8.1 |
| 输出 commit | feat(agent): s4 worker |

**改动清单**：
1. 监听 Flowable 任务 → 调 agent → 写回变量

**DoD**：
- [ ] worker 集成

---

#### ST-5.7.8.3 S4 端到端 + agent 输出写流程变量

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.8 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/tech-agent/tests/test_s4.py |
| 前置 ST | ST-5.7.8.2 |
| 输出 commit | test(agent): s4 bpm |

**改动清单**：
1. BPMN 跑通 + agent 输出 → 流程变量

**DoD**：
- [ ] S4 e2e 通过

---
### TC-5.7.9 SSE 流式输出（2 ST）

#### ST-5.7.9.1 /api/v1/agent/chat/stream 端点

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.9 |
| 工时 | 3h | 角色 | Backend |
| 目标文件 | apps/tech-agent/src/tech_agent/api/stream.py |
| 前置 ST | TC-5.7.5 |
| 输出 commit | feat(agent): stream api |

**改动清单**：
1. SSE 输出 token + tool_call + final 三类事件

**DoD**：
- [ ] 端点工作

---

#### ST-5.7.9.2 EventSource 三类事件验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.9 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-agent/tests/test_stream.py |
| 前置 ST | ST-5.7.9.1 |
| 输出 commit | test(agent): stream |

**改动清单**：
1. sse-starlette + httpx 测

**DoD**：
- [ ] 浏览器 EventSource 验证

---
### TC-5.7.10 内存与上下文（3 ST）

#### ST-5.7.10.1 短期 thread 内记忆

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.10 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/tech-agent/src/tech_agent/memory/short.py |
| 前置 ST | TC-5.7.4 |
| 输出 commit | feat(agent): short memory |

**改动清单**：
1. thread_id 内历史消息缓存（in-memory + TTL）

**DoD**：
- [ ] 短期记忆工作

---

#### ST-5.7.10.2 长期向量库记忆（写 Milvus）

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.10 |
| 工时 | 2h | 角色 | Backend |
| 目标文件 | apps/tech-agent/src/tech_agent/memory/long.py |
| 前置 ST | ST-5.7.10.1 |
| 输出 commit | feat(agent): long memory |

**改动清单**：
1. 重要对话写入 Milvus
2. 召回 top_k

**DoD**：
- [ ] 长期记忆可用

---

#### ST-5.7.10.3 跨会话召回历史验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.10 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-agent/tests/test_memory.py |
| 前置 ST | ST-5.7.10.2 |
| 输出 commit | test(agent): memory |

**改动清单**：
1. 跨 thread 召回历史

**DoD**：
- [ ] 召回验证通过

---
### TC-5.7.11 安全护栏（2 ST）

#### ST-5.7.11.1 输入检查 + 输出脱敏

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.11 |
| 工时 | 3h | 角色 | Backend |
| 目标文件 | apps/tech-agent/src/tech_agent/guardrails.py |
| 前置 ST | TC-5.7.5 |
| 输出 commit | feat(agent): guardrails |

**改动清单**：
1. 输入：prompt injection 检测
2. 输出：PII 自动脱敏

**DoD**：
- [ ] 双向检查

---

#### ST-5.7.11.2 恶意 prompt 拦截验证

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.11 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-agent/tests/test_guardrails.py |
| 前置 ST | ST-5.7.11.1 |
| 输出 commit | test(agent): guardrails |

**改动清单**：
1. 恶意 prompt → 拦截
2. PII 输出 → 脱敏

**DoD**：
- [ ] 拦截 + 脱敏工作

---
### TC-5.7.12 评估集（2 ST）

#### ST-5.7.12.1 20 个对话场景 eval 集

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.12 |
| 工时 | 3h | 角色 | Backend |
| 目标文件 | apps/tech-agent/evals/scenarios.yaml |
| 前置 ST | TC-5.7.5 |
| 输出 commit | feat(agent): eval set |

**改动清单**：
1. 单轮 / 多轮 / 工具 / 审批 各 5 例 = 20 个

**DoD**：
- [ ] 20 场景

---

#### ST-5.7.12.2 pytest --eval 跑通

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.12 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-agent/tests/test_eval.py |
| 前置 ST | ST-5.7.12.1 |
| 输出 commit | test(agent): eval |

**改动清单**：
1. 加 marker `eval`
2. `pytest --eval` 跑通

**DoD**：
- [ ] eval 跑通

---
### TC-5.7.13 OpenAPI（1 ST）

#### ST-5.7.13.1 openapi/paths/agent.yaml 同步

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.13 |
| 工时 | 3h | 角色 | Backend |
| 目标文件 | openapi/paths/agent.yaml |
| 前置 ST | TC-5.7.5、TC-5.7.9 |
| 输出 commit | docs(agent): openapi |

**改动清单**：
1. 同步所有 agent 端点

**DoD**：
- [ ] CI lint 绿

---
### TC-5.7.14 单测 + 集成（2 ST）

#### ST-5.7.14.1 tests/conftest.py fixtures

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.14 |
| 工时 | 1h | 角色 | Backend |
| 目标文件 | apps/tech-agent/tests/conftest.py |
| 前置 ST | TC-5.7.1 ~ TC-5.7.13 |
| 输出 commit | test(agent): conftest |

**改动清单**：
1. mcp_client / pg / kafka fixtures

**DoD**：
- [ ] fixtures 可复用

---

#### ST-5.7.14.2 覆盖率 ≥80% + CI 绿

| 字段 | 值 |
|---|---|
| 所属 TC | TC-5.7.14 |
| 工时 | 3h | 角色 | Backend |
| 目标文件 | apps/tech-agent/tests/ |
| 前置 ST | ST-5.7.14.1 |
| 输出 commit | test(agent): full suite |

**改动清单**：
1. 补齐缺失测试

**DoD**：
- [ ] 覆盖率 ≥ 80%

---

## W5-7 完成度检查表

| 子领域 | 关键路径 | TC 数 | ST 数 | ST 总工时 | 状态 |
|---|---|---|---|---|---|
| W5-7 tech-agent | **是** | 14 | 33 | ~65h | 🔴 未启动 |

---

## 变更记录

| 日期 | 版本 | 变更 | 原因 |
|---|---|---|---|
| 2026-07-28 | v2.0 | 从 W5-7 TC（14 条）拆出 ST（33 条） | 单回合执行避免 Token 超限 |