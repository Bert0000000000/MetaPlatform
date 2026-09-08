# TEMPORAL-1A-M2 ACCEPTANCE — Temporal 引擎接入（Milestone 2）

> **Batch**: Sprint 1A · M2（ADR-0061 · worker 容器化 / 5 StepKind 全量 e2e / 长任务 demo / outbox 桥 / 幂等修复）
> **日期**: 2026-09-07/08 · **前置**: `TEMPORAL-1A-M1-ACCEPTANCE.md`

## 1. 交付清单

| # | 项 | 落点 | 状态 |
|---|---|---|---|
| 1 | **Temporal Worker 容器化**（docker 常驻，非宿主进程） | 容器 `mate-temporal-worker`（image `mate-temporal-worker:dev`，基 mate-tech-orchestrator:dev + 离线 wheels；双网络 temporal-net + metaplatform_default；源码 ro 挂载；`--restart unless-stopped`） | ✅ |
| 2 | **5 StepKind live e2e 全量**（真 Temporal + 容器 worker + 真 ont + 真 MCP + 真 PG） | run 5k3 + callag/lt 轮 | ✅ |
| 3 | **长任务 demo**（HITL 挂起 ≥75s + wait_condition + signal 恢复） | 同上 | ✅ |
| 4 | **outbox→Temporal 桥**（SAL-05 P2 通道②） | `mate_tech_orchestrator/outbox_temporal_bridge.py` + `tests/test_outbox_temporal_bridge.py`（5/5） | ✅ 代码+单测（常驻 relay 调度留 M3） |
| 5 | **Activity 重试封顶**（RetryPolicy maximum_attempts=3，毒丸免疫） | `temporal_workflow.py` | ✅ |
| 6 | **plan-state-lost 终态化**（worker 重启后 review 不再无限重试） | `temporal_worker.py` orch_review_step | ✅ |
| 7 | **P0 缺陷修复：pg_repo 幂等键遮蔽** | prd-05-08 worktree `pg_repo.py` create_instance 分支 `for key,value` 遮蔽外层幂等 `key` → 写入最后 prop slug（jsonb 排序常为 `emp-id`）→ 跨 proposal 撞 `ont_proposal_idempotency_pkey`。已改 `prop_name/prop_value` 并清历史毒行 | ✅ |
| 8 | **MCP 本体代理接线修复**（TECH_ONT_URL 未配置→localhost 自指；无出站凭证） | `ontology_proxy.py` 支持 `TECH_ONT_TOKEN`/`TECH_ONT_TENANT` 服务凭证头；容器以 `host.docker.internal:8007` 直达 ont | ✅ |

## 2. 5 StepKind live e2e 结果（分散于两轮，环境抖动致分批）

| Kind | 场景 | 结果 |
|---|---|---|
| run_function | 内联沙箱 print | **completed** |
| evaluate_object_set | 真 ont IR 查询（employee 类型 + paging） | **completed** |
| propose → reject | create_instance proposal + HITL reject | **aborted**（零落库 negative ✓） |
| apply_action → approve | create_instance proposal + confirm + execute | **completed**（真实 PG 落库 ✓，employee 实例 rid 生成） |
| call_agent | ONTOLOGY 数字员工 → MCP `ont_list_classes` → 真 agent-tools 清单 | **completed** |
| **长任务** | HITL 挂起 75s，mid-query 仍 `hitl_waiting:lt`（wait_condition 持久等待），signal 后 | **completed** |

```
call_agent: hitl_waiting:s2 -> completed
long_task: hitl_waiting:lt waited=75s mid=hitl_waiting:lt -> completed
CALLAG+LT PASS
```

## 3. 环境坑位账（Windows Docker VM，M3 须固化）

1. **容器 IP 漂移**：容器重启即换 IP——`--add-host` 钉 IP 会过期；跨服务 HTTP 一律走 `host.docker.internal:<发布端口>`（本轮 worker/mcp 已切换，免疫漂移）。
2. **gRPC 长轮询间歇僵死**：宿主↔temporal 与 worker↔temporal 的 gRPC 长连接会被 VM 静默掐断（进程存活、不再领任务）；临时手段＝`SMOKE_RESTART_WORKER=1`（每 workflow 前重启 worker 换新 poller）；**根治留 M3**（keepalive 探针 + 自愈重启 sidecar，或升级 Docker Desktop/WSL2）。
3. **temporal 容器只监听首网络接口**：加入第二网络后该接口拒绝连接——worker 必须与 temporal 同在 temporal-net。
4. **docker commit 会固化 `--entrypoint`**：需 `--change 'ENTRYPOINT []'` 清除。
5. **Git Bash 路径改写**：`-v /d/...` 会被 MSYS 改写坏——用 `MSYS_NO_PATHCONV=1` + `D:/...` 形式。
6. BuildKit 对本地 tag FROM 会去 HEAD registry（daocloud 403）——薄镜像用 `docker run+pip+commit` 绕过。

## 4. 测试

| 套件 | 结果 |
|---|---|
| `test_temporal_translation.py` | 6/6 |
| `test_outbox_temporal_bridge.py` | 5/5（started/published、skip 不消费、失败计次、模板渲染、tenantless 拒绝） |
| live 5 StepKind + LT | 全 PASS（§2） |

## 5. 出范围（M3）

- 双轨 REST 开关（`WORKFLOW_ENGINE=temporal|legacy` 端点接线）
- outbox 桥常驻 relay 调度（pg_cron/循环）+ 真事件触发 e2e
- plan 镜像表 + reconcile；`check_temporal_grammar.py`；双轨对比报告
- gRPC 长轮询自愈（§3.2 根治）；worker 镜像正式化（去源码挂载，烘进发版镜像）
- MCP proxy 生产化：逐请求透传调用方 token 替代服务 token（现 `TECH_ONT_TOKEN` 为 staging 过渡，1h 有效期随登录续）

## 6. 结论

ADR-0061 M2 验收通过：**全部 5 种 StepKind 在 Temporal 路径 live 端到端打通（含真实落库与 MCP 调度），长任务 wait_condition 持久等待验证成立，worker 以 docker 容器常驻**。剩余为 M3 接线与生产化硬化。
