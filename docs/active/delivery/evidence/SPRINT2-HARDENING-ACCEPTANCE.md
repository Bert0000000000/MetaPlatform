# SPRINT-2 ACCEPTANCE — 准生产硬化（SAL-05 P2 常驻化 / G17 / G18 / 北极星 v2 / in-flight 清账）

> **日期**: 2026-09-08 · **范围**: goal「Sprint 2 准生产硬化」 · **部署**: docker 全栈（29 容器 / worker 1.5）

## 1. SAL-05 P2 尾巴收口 → [x]

- **常驻 relay**：`outbox_relay_loop.py`（`TemporalWorkflowStarter` 惰性 client 适配 +
  `RelayLoop` 10s 周期）；接入 orchestrator lifespan（temporalio 缺失时降级跳过）。
- **REST**：`POST /orchestrator/outbox/events`（真实 InMemoryOutboxWriter append）+
  `POST /orchestrator/outbox/relay`（手动一轮）。
- **服务 token**：worker 无用户上下文场景新增 `_service_token()`（IAM 密码换证 + TTL 缓存）。
- **Live e2e（无 mock）**：
  1. append `order.review.requested` → 201 pending
  2. 常驻循环 10s 自动消费 → relay `started:1`
  3. Temporal workflow `outbox-f4867650…` 启动 → propose（create_instance，服务 token）
  4. HITL 挂起 → signal approve → **实例 `ont.tenant-default.ind.employee.o-final-1` 真实落库 PG**
  5. workflow COMPLETED；plan_mirror 对账 `completed` ✅
- 触发规则修正：propose 目标 404（mark-review 不存在）→ 改 create_instance@employee。

## 2. ONT-G17 本体验证 → [x]

- kernel `validation_ops.py`：`validate_model`（PK 完整性 / rid 形制 / slug 重复 / PK 引用）
  + `validate_instance`（必填 / 未知属性 / 类型 / PK 缺值，slug+rid 双键）。
- REST `ontValidateV2Model` / `ontValidateV2Data`；构造器 ValueError 转验证结果。
- Live：坏 PK → `valid:false`（错误清单）；合法类型 → `valid:true`；实例缺必填+未知+错型 →
  5 条 errors 逐条输出 ✅。单测 8/8。

## 3. ONT-G18 Axiom 注册中心 → [x]

- PG `ont_axiom` 表 + repo `upsert_axiom_record / list_axiom_records / delete_axiom_record`
  （避开 legacy `upsert_axiom(ax)`/`list_axioms()` 遮蔽）。
- REST：`GET/POST /reasoning/axioms` + `DELETE /reasoning/axioms/{rid}` +
  `POST /reasoning/explain`（derivation chain：每条推导事实给 rule+premises 链）。
- Live：upsert×3 → list 2-3 条（kind 齐全）→ delete → list 递减 ✅；
  explain 输出 `emp-001 ∈ agent` 链 `employee⊑person⊑agent→emp-001` 等 3 条 ✅。
- 修复：legacy 表缺 enabled 列（ALTER 补）、dict-cursor、created_at→updated_at、方法名遮蔽 ×2。

## 4. 北极星 demo v2 → PASS

`scripts/demo_northstar_v2.py`：登录 → 真实订单（SO-101 amount=101000 unpaid，经
propose→confirm→execute 种子）→ Temporal plan（evaluate_object_set 证据 + propose
action order-review-confirm）→ HITL → approve → 真实写回 completed ✅ →
RevertWorkflow → `reverted / equivalence=partial`（action 审计型正确降级）✅。
（脚本 stages 1-4 + revert 单独执行留证；`northstar-v2-result.json` 落盘。）

## 5. in-flight 清账

| 批次 | 复验证据 | 状态 |
|---|---|---|
| MP-ONT-PROPOSAL-01 | 今日全生命周期 live 数十次（propose/confirm/execute/reject/withdraw/revert/409 negatives）| [x] |
| MP-DEDUP-01 | 同 PK 重复 execute 实探（幂等覆盖路径确认）+ 8-31 local acceptance | [x] |
| action-orchestration v1.7 | 今日 Temporal 路径 5 StepKind + HITL + graph 全 live（v1.7 动态 schema/连线语义被 Temporal 执行面完整复用）| [x] |
| MP-SR-01 | **边界**：semantic_router 为 LLM 预筛，依赖 llmgw 后台 AI Provider 指向 MiniMax（显式 base_url 覆盖未被旧 chat 路由消费）→ 保持 [~]，随真实 LLM 接入批转 [x] | [~] |

## 6. 真实 LLM（边界，如实）

`.env` 已有 MiniMax 凭证；docker llmgw 默认打 api.openai.com（后台 Provider 配置面未指向
MiniMax；显式 base_url 覆盖仅 v2 参数、旧 chat 路由不消费）。已重灌 llmgw 容器注入凭证，
Provider 配置面切换留下一批（IAM 后台配置或 llmgw env 扩展），不阻塞本批其余判据。

## 7. 测试

新增：G17 8 + relay loop 2 = 10/10 ✅（goal ≥10 达成）。既有 bridge 5 + translation 6 + dual-rail 9 无回归。
