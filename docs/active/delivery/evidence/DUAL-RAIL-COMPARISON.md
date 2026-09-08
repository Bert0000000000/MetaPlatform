# TEMPORAL DUAL-RAIL COMPARISON — legacy PlanRunner vs Temporal 引擎（Sprint 1A M3）

> 日期：2026-09-08 · 依据：本机 live 双轨实测（同一 docker 栈、同一 ont/PG）
> 结论先行：**两条轨道 API 语义对齐，Temporal 轨在持久性 / 可观测 / 容错上全面占优；功能等价，建议按 ADR-0061 双轨灰度后切主。**

## 1. 双轨 API 对照（同一 REST 面）

| 能力 | legacy（默认） | temporal（`?engine=temporal`） |
|---|---|---|
| 提交 | `POST /plans` → 201 `{plan_id, status:"submitted"}`（不执行） | `POST /plans?engine=temporal` → 201 `{plan_id:"twf-*", status:"hitl_waiting:s2"}`（**提交即持久执行**） |
| 执行 | `POST /plans/{id}/execute`（进程内跑到 HITL） | 隐式（提交即跑）；显式 execute 返回 409 指引 |
| 状态查询 | `GET /plans/{id}`（内存态，**进程重启即丢**） | `GET /plans/{id}`（Temporal history 权威，**跨重启/跨副本**） |
| HITL 审批 | `POST .../review`（confirm+apply 合一，进程内） | 同端点 → signal（`ReviewSignal`）→ review activity（同一 PlanRunner.review 合一语义） |

## 2. live 实测（同晚同栈）

| 维度 | legacy | temporal |
|---|---|---|
| 5 StepKind 全过 | ✅（v3.1 SAL-05 起即有） | ✅（M2 五项 PASS，含 apply_action 真实落库、call_agent MCP 调度） |
| approve/reject 双路径 | ✅ | ✅（completed / aborted） |
| 进程重启后 plan 可续 | ❌ 状态丢（M2 已做终态化止损） | ✅ workflow 由 history 驱动，worker 换进程照跑 |
| 挂起等待（HITL）时长上限 | 进程生命周期 | **无上限**（LT 实测 75s 仅受测试窗口约束；1 周+ 由 wait_condition 天然支持） |
| 失败重试 | 无（步骤失败即终态） | Activity RetryPolicy（cap 3，防毒丸） |
| SRE 可观测 | 自研 /graph | Temporal history + query `status()` + plan_mirror 对账 |
| 毒丸免疫（plan 丢失重放） | N/A | ✅（review → 终态 aborted，不重试） |
| 单测 | 既有套件 | translation 6/6 + bridge 5/5 + dual-rail 9/9 |

## 3. 已知差异（有意为之）

1. temporal 轨 plan_id 带 `twf-` 前缀，status 端点返回引擎字段 `engine:"temporal"`。
2. legacy `submitted` 中间态在 temporal 轨不存在（提交即执行）——前端如需两段式可先 create 后 start（M3+ 可加 `?defer=true`）。
3. legacy execute 显式触发；temporal 显式 execute 409。

## 4. 切流建议（M3 后）

1. 前端/调用方默认仍 legacy；`WORKFLOW_ENGINE=temporal` 环境级灰度（engine_from 参数>环境>legacy）。
2. plan_mirror 每小时 reconcile（scripts/loop/reconcile_plan_mirror.py 挂 pg_cron/计划任务）。
3. 观测双轨成功率/时延 1 个 Sprint 后切 temporal 为默认，legacy 保底一个版本。
