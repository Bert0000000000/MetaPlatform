# TEMPORAL-1A-M3 ACCEPTANCE — Temporal 引擎接入（Milestone 3 收口）

> **Batch**: Sprint 1A · M3（ADR-0061 · REST 双轨 / 正式 worker 镜像 / 自愈 / 镜像表 / CI 守门 / 对比报告）
> **日期**: 2026-09-08 · **前置**: M1/M2 ACCEPTANCE

## 1. 交付清单

| # | 项 | 落点 | 状态 |
|---|---|---|---|
| 1 | **REST 双轨开关**（`?engine=temporal`，env `WORKFLOW_ENGINE`；参数>环境>legacy） | `temporal_rest.py` + `api/app.py` submit/status/review/execute 四端点接线（main + prd worktree 双源同步） | ✅ live |
| 2 | **正式 worker 镜像**（无源码挂载、HEALTHCHECK NONE、自含 temporalio） | `mate-temporal-worker:1.0`（基 mate-tech-orchestrator:dev 烘焙 + wheels；CMD `python -m ...temporal_worker`） | ✅ 容器常驻 |
| 3 | **gRPC 长轮询自愈**（30s get_system_info 探活 ×3 失败 → 退出由 restart 拉起） | `temporal_worker._selfheal_watcher` | ✅ 代码+部署（本机病灶=VM 静默掐断长连接；自愈把「僵死」转成「秒级重启」） |
| 4 | **plan 镜像表 + 对账** | `alembic/versions/0028_plan_mirror.sql` + `scripts/loop/reconcile_plan_mirror.py`（live 跑通：twf-* upsert，status=completed 落表） | ✅ live |
| 5 | **CI 守门** `check_temporal_grammar.py`（命名/前缀/retry_policy 注册一致性/selfheal 存在性，AST 级） | `scripts/ci/`（PASS） | ✅ |
| 6 | **双轨对比报告** | `evidence/DUAL-RAIL-COMPARISON.md`（API 对照 + live 实测矩阵 + 切流建议） | ✅ |
| 7 | **Sprint 1 PRD-01/02 立稿** | `docs/active/prd/APP-DW/PRD-01…` / `APP-WFE/PRD-02…`（状态 Not Started） | ✅ 文档 |
| 8 | 单测：REST 双轨 9/9（fake 网关；engine 选择/前缀路由/legacy 不回归/execute 409） | `tests/test_temporal_rest_dualrail.py` | ✅ |

## 2. live 实机验证（REST 双轨全环 ×2 轮）

```
POST /api/v1/orchestrator/plans?engine=temporal
  → 201 {"plan_id":"twf-1788802087702-15331","status":"hitl_waiting:s2","engine":"temporal"}
POST .../plans/twf-…/steps/s2/review {"approved":true}
  → {"status":"completed","engine":"temporal"}
GET  /plans/twf-… → {"status":"completed","engine":"temporal"}
（正式镜像 mate-temporal-worker:1.0 换装后同环复测：twf-1788803451699 → completed ✓）
```

legacy 默认轨回归：`POST /plans`（无参）→ 201 submitted（内存路径不变）✓

## 3. 环境处置台账（承接 M2 §3，新增固化）

- 容器内 SDK 安装：镜像烘焙优先；运行容器补救 = `docker cp wheels` + `pip install --no-index`（或容器内 tuna 在线）。
- temporalio SDK 版本差异：`WorkflowHandle.is_running` 不存在 → 用 `describe().status`（int 枚举 1..7 需映射表）。
- `docker commit` 链注意 CMD/ENTRYPOINT 逐层继承——每层显式 `--change` 声明。

## 4. 出范围（v1.0 后续 / Sprint 1+）

- outbox 桥常驻调度（pg_cron/循环接线）——桥与单测已就绪（M2），调度器属平台运维面。
- 切流 80% 灰度执行（需按 DUAL-RAIL-COMPARISON §4 计划跑一个观测 Sprint）。
- 13 硬规则 #8 sub-chart 化（temporal helm chart）——现部署为 docker 直跑，K8s 化归 PLATFORM-K8S 模式。
- PRD-01/02 实现（EMP-EVOLVE / ACTION-CONFIRM 两 Batch，各 2 周）。

## 5. 结论

**Sprint 1A（ADR-0061 Temporal 引擎替换）M1+M2+M3 全部收口**：DSL 翻译层 / 持久
workflow / HITL signal / 5 StepKind live e2e / 长任务 / REST 双轨 / 正式镜像 /
自愈 / 镜像表 / CI 守门 / 对比报告齐备。PlanRunner 保持唯一业务语义源，Temporal
为持久执行面，符合 ADR-0061 架构边界。
