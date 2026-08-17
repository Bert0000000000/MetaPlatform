# MP-SAL-05 ACCEPTANCE — Action 流程编排与本体联动（P1）

> **Batch**: MP-SAL-05 P1（ADR-0045 · 三通道联动之①③：流程→本体出站绑定 + 流程本体化）
> **日期**: 2026-08-17 · **分支**: `refactor/mp-sal-05`
> **用户要求**: 所有 action 可流程编排可视化

## 1. 交付范围

| 项 | 落点 | 状态 |
|---|---|---|
| 四执行器 | `PlanRunner._dispatch_step`：PROPOSE / APPLY_ACTION（≡PROPOSE 同管线，ADR-0045）/ EVALUATE_OBJECTSET（IR 查询）/ RUN_FUNCTION（内联沙箱）；CALL_AGENT 不变 | ✅ |
| **HITL 合一** | PROPOSE 步 → tech-ont propose → HITL_WAITING（携带 proposal_id + 已解析 payload）；**review approve = proposal confirm + execute/apply 一次完成**；reject = proposal reject + abort。plan 审批与 proposal 确认从此是同一个动作（G4 断点④收口） | ✅ |
| 数据流 | payload 值中 `{{steps.<sid>.<path>}}` 从历史输出解析（执行时替换；挂起存已解析值，approve 不重放模板——live 实测修复） | ✅ |
| B3 语义 | PROPOSE/APPLY_ACTION 步自动计入 ≥1 HITL（runner 侧补 requires_hitl 以过 kernel PlanSpec 硬校验） | ✅ |
| OntologyActionClient | async httpx → tech-ont v2 全管线（propose×3/confirm/reject/apply/execute/object-query）；**单例 client 逐请求置换 tenant 头 + 用户 Bearer**（plan_execute/review 端点从 ctx/原始头取 token 透传） | ✅ |
| **流程实例本体化** | `ensure_process_type` + `upsert_process_instance`（编排元数据走管理面直写——非业务对象不经 proposal 闸，治理边界文档化）；状态机每次迁移同步 → `query_process_instance` 自动上工具面 | ✅ |
| **可视化图模型** | `GET /plans/{plan_id}/graph`：nodes（kind/hitl/实时 status/proposal_id/expected_diff/impact_summary）+ edges（顺序边 + data_refs 数据流引用）——任何图组件（如前端 SemiGraphCanvas）可直接渲染 | ✅ |
| REST 放开 | `PlanStepRequest.kind` 从 `Literal["call_agent"]` 放开到全部 5 种 StepKind | ✅ |
| 契约 | orchestrator.yaml +`/plans/{plan_id}/graph`（orchestratorGetPlansPlanIdGraph）+ PlanGraph schema（18 paths/11 schemas 校验通过） | ✅ |

## 2. 测试

`test_plan_action_orchestration.py` 10 项：propose 挂起携 proposal_id / PROPOSE 计入 B3 / **approve→confirm→apply 时序** / reject→proposal reject+abort / create_instance→execute / **IR 输出经模板注入后步**（target_iid 断言为真实 rid）/ APPLY_ACTION 同管线 / graph 状态推导 / 无 HITL 拒绝。**orchestrator 55 passed + kernel 487 passed = 542 全绿**，既有 CALL_AGENT 链零回归。

## 3. Live 实机验证（双服务：orchestrator 8317 + tech-ont 8307 + 真 PG）

> 场景：查超 10 万订单 → 提议标记待复核 → 人批准 → 落库

| 步 | 结果 |
|---|---|
| ① POST /plans（evaluate→propose，`{{steps.s1.rows.0.__rid__}}` 数据流） | submitted ✓ |
| ② execute：s1 IR 真查 completed → s2 真提议 → hitl_waiting | proposal=prop-3e… ✓ |
| ③ graph：s1 completed / s2 hitl_waiting + proposal + 数据流边 | 可视化模型成立 ✓ |
| ④ review approve → **confirm+apply 一次完成** | plan completed ✓ |
| ⑤ w1 `wf-note`=「金额超10万待复核」 | **真实写回 PG** ✓ |
| ⑥ process-instance 对象 status=completed | 本体化生效（AI 可查）✓ |
| ⑦ graph 终态全 completed | ✓ |

live 暴露并修复 3 项：token 逐请求透传（单例 client 401）/ 挂起 payload 存原始模板串（apply 404）/ PlanStepRequest kind 白名单锁死。demo 数据已清理。

## 4. 出范围（P2）

通道② outbox 事件→流程自动启动 / kernel WorkflowAgent on_complete_action 深化 / Flowable 桥取舍 / plan 持久化（现内存态）。

## 5. 联动通道全景（P1 后）

① 流程→本体（出站绑定：PROPOSE/APPLY_ACTION 步 + HITL 合一）✅
③ 流程本体化（process-instance 对象 → 工具面/可视化/AI 可读）✅
② 本体→流程（事件入站）—— P2
