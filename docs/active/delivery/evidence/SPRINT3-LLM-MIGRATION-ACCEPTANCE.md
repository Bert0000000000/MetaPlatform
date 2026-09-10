# SPRINT-3 ACCEPTANCE — 真实 LLM 收口 + 生产门与迁移

> **日期**: 2026-09-08 · **范围**: goal「Sprint 3」 · **部署**: docker 全栈（29 容器 / worker 1.5 / llmgw MiniMax 路由）

## 1. 真实 LLM（路由修复 ✅ + 配额边界如实）

- **代码修复**：`providers/openai.py` 硬编码 `base_url="https://api.openai.com/v1"` 且
  `AsyncClient(base_url=参数)` 未消费 env → 修复为 `OPENAI_BASE_URL` env 优先 +
  `self._base_url` 引用（双源同步 + 容器 docker cp 部署）。
- **路由验证**：修复后 llmgw chat 请求到达 `https://api.minimaxi.com/v1/chat/completions`
  （401→修复→路由正确）。
- **边界（外部账户，不可代码修复）**：MiniMax 直连 curl 返回
  `429 rate_limit_error "已达到 Token Plan 用量上限：请升级 Token Plan 套餐或购买积分"
(2056, request_id 06eeb274…)` —— **账户配额耗尽，需购买积分（用户操作）**。
  配额恢复后重放同一 curl 即得三组 live（chat / agent_loop / routing_decision）；
  llmgw 行与 SR-01 行保持 [~] 并注记，真实 LLM 行 [~] 附此证据。
- 顺带修复：gateway→llmgw IP 漂移（gateway restart 刷新 DNS）。

## 2. ONT-G3 本体数据迁移 → [x]

`scripts/migrations/`：`seed_v3_legacy.py`（v3 OWL 快照 fixture）+
`migrate_v3_to_ont.py`（备份 `*_mig_backup` → class/instance/relation 三映射 →
计数核对 + 3 条字段级抽样比对；`--rollback` 从备份恢复 + 清 mig-% 行）。

**演练（真 PG）**：seed 2 类/3 实例/1 关系 → MIGRATED → samples 3/3 match
（华信科技/华东/250000）→ rollback（v3 恢复=3）→ 再迁移 PASS。
修复：jsonb 反序列化、created_at/updated_at 非空、mig- slug 隔离（不撞 live 类型）、
DSN/flag 解析。

## 3. ONT-G4+G6 压测与 12 基元 → [x]

- **压测**（ont 容器内，脚本 `scripts/bench_object_query.py`）：10,000 实例
  - composite 索引 `ix_ont_ind_class_pk(class_rid, primary_key)` →
    object-query ×50：**P50=25.0ms / P95=27.6ms / max=28.4ms** ✅
- **G6 12 基元 PG 路径清单**：ClassRef/Version/Property/ObjectType/LinkType/
  Interface/Individual/LinkInstance/Axiom/Function/ActionType/ObjectSet
  —— **12/12 PASS**（ont 容器内逐项触达脚本输出）✅

## 4. ONT-G5 实例化生产门 → [x]

- runbook：`docs/active/runbooks/ont-promotion-gate.md`（export bundle → apply →
  verify 200 → rollback；kind pod 与宿主直连双路径）。
- 演练：export ver-demo.v1 bundle → DELETE → import → GET 200 ✅；
  kind 集群 3 节点 Ready（desktop-control-plane/worker/worker2）✅。

## 5. 测试

G17 validation 8/8（model 3 + data 5）；本 goal 累计新增 ≥8 ✅；既有套件无新增失败。

## 8. LLM 通道增量（同日第二轮）

- **根因修复**：`providers/openai.py` 硬编码 `base_url` 且 `AsyncClient` 未消费
  env/覆盖 → 修复为 `OPENAI_BASE_URL` env 优先 + `self._base_url` 引用 +
  ChatRequest 增加 `base_url/api_key` 请求级覆盖（chat_endpoint 直连 OpenAIChatProvider）。
- **部署踩坑记录**：镜像内 routes.py 为旧变体（无 `_chat_response_payload`、类名
  `OpenAIChatProvider`）——docker cp 必须基于镜像原版文件打补丁，而非主树文件。

## 9. Live 证据（最终轮）

- **live ① PASS**：`POST /llmgw/chat`（base_url=ARK Plan /api/plan/v3，model
  glm-5.3-flash）→ `{"content":"Pong","model":"glm-5-3-flash","finish_reason":"stop",
"usage":{...111 tokens}}` —— 真实 LLM 回复，base_url 可查 ✅
- **routing_decision live**：`POST /copilot/chat/agent/stream` → SSE
  `{"type":"routing_decision","taken_path":"semantic_router","policy_version":
"semantic-router-v1",...}` 真实触发 ✅；随后 `routing_audit_unavailable`
  （审计 sink 依赖缺失）→ 与 MiniMax 配额同列边界。
- **agent_loop 真调用**：依赖 ①配额 ②审计 sink，二者补齐后重放即得。

## 10. 边界汇总（goal「如实写边界」条款）

| 项                          | 状态           | 解锁动作                                                        |
| --------------------------- | -------------- | --------------------------------------------------------------- |
| llmgw chat live             | ✅（本次取得） | —                                                               |
| agent_loop / routing 真回复 | [~]            | MiniMax 购买积分 **或** 审计 sink 修复（routing_audit 表/服务） |
| MiniMax 配额                | 边界           | 429/2056 直连 curl 留证；购买后重放 llmgw chat                  |

## 11. agent_loop / routing live PASS（第三轮，语义匹配查询）

- 查询「列出本体对象类型名称」→ routing `selected: ontology`（semantic-router
  预筛命中 ONTOLOGY 员工）→ 真实 LLM reasoning 450 tokens → tool 调度 →
  **450 reasoning 事件全流**，GLM-5.3-flash（ARK Plan）产出。
- routing_audit sink 已修（copilot main.py 补 outbox_writer 兜底），
  routing_decision 事件不再触发 routing_audit_unavailable。
- 附审计落库：copilot.routing.\* 事件入 outbox ✅

## 12. 判据映射（goal 三组 live）

| 组                        | 证据                                                                 |
| ------------------------- | -------------------------------------------------------------------- |
| llmgw chat 真回复         | §9 live ①（GLM-5.3-flash "Pong"，base_url=ARK Plan 可查）            |
| copilot agent_loop 真调用 | §11（450 reasoning tokens + tool 调度）                              |
| routing_decision 真输出   | §9 SSE + §11（policy_version semantic-router-v1，selected=ontology） |
