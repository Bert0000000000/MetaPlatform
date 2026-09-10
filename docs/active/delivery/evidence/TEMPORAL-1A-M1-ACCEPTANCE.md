# TEMPORAL-1A-M1 ACCEPTANCE — Temporal 工作流引擎接入（Milestone 1）

> **Batch**: Sprint 1A · M1（ADR-0061 · PlanRunner 退化为 DSL 翻译层 · Temporal 承载持久执行）
> **日期**: 2026-09-07 · **分支**: main 工作树（未提交，待 PR）
> **范围**: ADR-0061 §2.2 双轨期第一步 —— 集群 + 翻译层 + Worker + HITL signal + live e2e

## 1. 交付清单

| #   | 资产                                                            | 路径                                                                                              | 状态          |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------- |
| 1   | Temporal 集群（docker，隔离网络 + 专用 DB）                     | 容器 `temporal`(auto-setup 1.28) + `temporal-db`(postgres:17)，network `temporal-net`，gRPC :7233 | ✅            |
| 2   | DSL 翻译层（plan JSON ⇄ Temporal workflow input）               | `packages/mate-tech-orchestrator/src/mate_tech_orchestrator/temporal_translation.py`              | ✅            |
| 3   | 持久 Workflow 定义（run→HITL signal→resume→terminal）           | `.../temporal_workflow.py`（独立模块，sandbox 可 re-import）                                      | ✅            |
| 4   | Worker（2 Activity 包装 PlanRunner.execute/review，进程内单例） | `.../temporal_worker.py`                                                                          | ✅            |
| 5   | 单测（翻译层 round-trip / B3 / payload 模板保真）               | `tests/test_temporal_translation.py`（6/6 pass）                                                  | ✅            |
| 6   | live e2e smoke（approve / reject 双路径）                       | `scripts/smoke_temporal_plan.py`                                                                  | ✅ SMOKE PASS |

## 2. 架构对位（ADR-0061 §2.1）

| ADR 条目                             | M1 实现                                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------- |
| PlanRunner = LLM-friendly DSL 翻译层 | ✅ Activity 内复用 `PlanRunner.submit/execute/review` 公有 API，零改动                   |
| Temporal = 业务 Workflow 引擎        | ✅ `PlanWorkflow` 逐步 Activity 持久执行 + signal 驱动 HITL                              |
| HITL 合一语义不变                    | ✅ review approve = confirm+apply 逻辑原样走 `PlanRunner.review`                         |
| B3（每 plan ≥1 HITL）                | ✅ `PlanRunner.submit` 原校验保留（PROPOSE/APPLY_ACTION 自动计入）                       |
| signal 通道                          | ✅ `ReviewSignal(step_id, approved, feedback, reviewer)` + `wait_condition`              |
| 可观测（SRE）                        | ✅ Temporal 自带 history / query `status()`（workflow query 暴露 `hitl_waiting:<step>`） |
| 双轨切流                             | ⬜ M2（`WORKFLOW_ENGINE=temporal\|legacy` 开关 + REST 接线）                             |
| outbox→Temporal 桥                   | ⬜ M2                                                                                    |
| plan 镜像表 reconcile                | ⬜ M2/M3                                                                                 |

## 3. Live 实机验证（真 Temporal server + 真 worker 进程）

```
APPROVE: hitl_waiting:s2 -> completed b2d225f3…   # run_function→HITL闸→signal approve→恢复→completed
REJECT:  hitl_waiting:s2 -> aborted dd3dbb26…     # signal reject→abort
SMOKE PASS
```

- workflow query 中间态 `hitl_waiting:s2` 经 `@workflow.query status()` 实测可查。
- Activity 重试 / 历史留痕由 Temporal 引擎承担（evidence: workflow history 事件序列）。
- 遗留 best-effort 警告 `plan.pi_sync_failed`：流程实例本体化（SAL-05 通道③）在无 ontology URL 时降级，不影响主链路 —— M2 接 ONTOLOGY_URL 后消除。

## 4. 部署/环境要点（Windows 主机特有坑位，复现必读）

1. **地址必须 `127.0.0.1:7233`**，不能用 `localhost`（IPv6 解析导致 gRPC h2 broken pipe）。
2. **Docker 内嵌 DNS 会间歇超时**（`lookup postgres ... i/o timeout`）→ Temporal 容器用 `--add-host` 钉住 DB IP；DB 容器重启后需同步更新。
3. **宿主机 ↔ 容器长连接 gRPC（worker poll）在 Docker VM 劣化时会被 RST** —— 重启 Docker Desktop 后恢复；unary 调用不受影响（这也是 M1 排障最久的坑）。
4. Workflow 类不能定义在 `__main__`（sandbox 校验失败）→ 已拆独立模块。
5. Worker 的 PlanRunner 必须进程内单例（plan 状态内存态，与 REST 路径一致）；跨 Activity 共享。

## 5. 测试

| 套件                                                                        | 结果                                                      |
| --------------------------------------------------------------------------- | --------------------------------------------------------- |
| `pytest packages/mate-tech-orchestrator/tests/test_temporal_translation.py` | 6 passed / 0 failed                                       |
| `python scripts/smoke_temporal_plan.py`（live）                             | SMOKE PASS（2 路径 × 4 断言）                             |
| 既有 orchestrator 套件回归                                                  | 未触碰 PlanRunner/dispatcher 源码（仅新增文件），无回归面 |

## 6. 出范围（后续里程碑）

- M2：REST `POST /plans?engine=temporal` 双轨开关 + outbox→start_workflow 桥 + ONTOLOGY_URL 接线（消除 pi_sync 警告）+ PROPOSE→真实 proposal HITL e2e
- M3：plan 镜像表 + reconcile + 压测 + 切流 80% + 13 硬规则 #8/#9 对位更新（Temporal sub-chart 化）

## 7. 结论

ADR-0061 M1 验收通过：Temporal 承载持久化 / 重试 / HITL signal，PlanRunner 保持唯一业务语义源。剩余 M2/M3 为接线与生产化，不改架构。
