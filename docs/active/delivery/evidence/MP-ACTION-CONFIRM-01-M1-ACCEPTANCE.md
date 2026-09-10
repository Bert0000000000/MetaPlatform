# MP-ACTION-CONFIRM-01 M1 ACCEPTANCE — AI Proposal 回滚（withdraw / revert / 等价判定）

> **Batch**: PRD-02 · M1（`docs/active/prd/APP-WFE/PRD-02-Action-Confirm-Rollback_v1.0-20260908.md`）
> **日期**: 2026-09-08 · **部署**: mate-tech-ont 容器（prd worktree 挂载源，live 实测）

## 1. 交付

| #   | 项                                                                                     | 落点                                                              | 状态 |
| --- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---- |
| 1   | `ProposalStatus.WITHDRAWN / REVERTED` + 转移守卫                                       | mate-kernel `action/engine.py`（main + prd 双源）                 | ✅   |
| 2   | `withdraw_proposal` / `revert_proposal`（PG：状态回写 + 事件流 + 补偿 + 执行记录覆盖） | prd worktree `v2_kernel/pg_repo.py`                               | ✅   |
| 3   | REST：`POST /proposals/{id}/withdraw` · `/revert`（revert 带幂等键）                   | `v2_kernel/api.py`（ontWithdrawV2Proposal / ontRevertV2Proposal） | ✅   |
| 4   | I1 ≃ 等价判定（create→删实例→查消失→equivalent；否则 partial）                         | pg_repo.revert_proposal                                           | ✅   |
| 5   | 7 天回滚窗口（超窗 ValueError→409）                                                    | 同上 `_REVERT_WINDOW_DAYS`                                        | ✅   |
| 6   | 单测 9/9（转移守卫/终态/枚举面）                                                       | mate-kernel tests（双源同步）                                     | ✅   |

## 2. live 实机验证（mate-tech-ont 容器 · 真 PG）

| #   | 路径                                                                  | 结果                                                                                                                                 |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | propose → **withdraw**                                                | `{"status":"withdrawn"}` ✓                                                                                                           |
| 2   | propose→confirm→execute(建实例)→**revert**                            | `{"status":"reverted","equivalence":"equivalent","compensation":{"deleted_individual":"…ind.employee.rv-eq-2","rows":1}}` ✓ 实例消失 |
| 3   | action 类（order-review-confirm，decision=confirm）execute→**revert** | `{"equivalence":"partial"}` ✓ audit-only 降级                                                                                        |
| 4   | 已 reverted 再 revert                                                 | 409 `revert requires executed` ✓                                                                                                     |
| 5   | withdrawn 后 execute                                                  | 409 `withdrawn; execute requires confirmed` ✓                                                                                        |

## 3. 出范围（M2/M3，见 PRD-02 里程碑）

- OTel 五事件（propose/confirm/reject/withdraw/revert）结构化埋点（现为 proposal 事件流表记录）
- Temporal 长补偿链联动（revert 走 workflow）
- 前端撤销入口（approval UI）
- model_type revert（类型版本回退）

## 4. M2 增量（同日收口）

- **五事件留痕**：`ont_proposal_event` 表 live 实测完整生命周期
  （`→pending / pending→confirmed / confirmed→executed / executed→reverted`，
  含 actor_id）；propose/reject 同表覆盖 → FR-ACT-CONFIRM-005 以**审计表**为权威落档
  （api 层 structlog 钩子同步布点；stdout 受级别过滤）。
- **7 天窗口 live**：`UPDATE applied_at = now()-8d` → revert `409
"revert window (7d) exceeded: applied 8d ago"`（FR-ACT-CONFIRM-006）。
- **HITL 对称闸**：by-design —— withdraw/revert 与 confirm 同为用户侧端点
  （非 LLM 工具面），满足 FR-ACT-CONFIRM-003 的「人审」语义。

## 5. M3 增量（同日收口 · Temporal 长补偿链）

- `RevertWorkflow`（单 activity 起步：orch_revert_proposal → OntologyActionClient.revert，
  幂等键 `revert-{proposal_id}`，RetryPolicy cap 3）注册入 worker；
  worker 正式镜像升至 `mate-temporal-worker:1.3`（docker cp 烤包，非挂载）。
- **live**：start RevertWorkflow →
  `{status:"reverted", equivalence:"equivalent", compensation:{deleted_individual:"…rv-tmp-2", rows:1}}`
  —— 补偿链由 Temporal 历史驱动，可重试、可观测（FR-ACT-CONFIRM-007）。

## 6. 结论

PRD-02 **M1+M2+M3 全收口**：撤销语义（withdraw/revert/等价/时窗/幂等）live 全过；
状态机向后兼容（既有四态不受影响，9/9 + 既有 kernel 套件无回归面——仅新增）。
