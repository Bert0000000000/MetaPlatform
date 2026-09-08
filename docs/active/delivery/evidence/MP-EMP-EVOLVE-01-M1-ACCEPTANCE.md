# MP-EMP-EVOLVE-01 M1 ACCEPTANCE — 数字员工会话级热进化

> **Batch**: PRD-01 · M1（`docs/active/prd/APP-DW/PRD-01-Employee-Evolve_v1.0-20260908.md`）
> **日期**: 2026-09-08 · **部署**: mate-tech-orchestrator 容器（prd worktree 挂载源，live 实测）

## 1. 交付

| # | 项 | 落点 | 状态 |
|---|---|---|---|
| 1 | `SessionScope` / `SessionEvolution`（每会话独立 CapabilityRuntime + 快照 + TTL 30min） | `scheduler/session_evolution.py`（main + prd 双源） | ✅ |
| 2 | 会话内 mount/unmount（FR-001/002）——fiber 反应式失活/复激活（内核语义复用） | 同上 | ✅ |
| 3 | 快照还原（FR-006/007）：close 销毁会话域，全局注册表全程未被改动 | 同上 | ✅ |
| 4 | REST 五端点：`POST /sessions/{id}/open` · `POST …/capabilities` · `DELETE …/capabilities/{name}` · `GET …/evolution` · `POST …/close`（跨租户 403） | `api/app.py`（双源） | ✅ |
| 5 | dispatch 会话门（`_REQ_CTX.session_id` → 会话 runtime 优先，缺省全局） | `scheduler/dispatcher.py`（双源） | ✅ |
| 6 | 单测 13/13（evolution 8 + capability_runtime 回归 5） | `tests/test_session_evolution.py`（双源） | ✅ |

## 2. live 实机验证（mate-tech-orchestrator 容器）

```
POST /sessions/emp-live-1/open      → {"roles_snapshotted":4}        # app/data_product/ontology/workflow
POST /sessions/emp-live-1/capabilities {name:hot_skill,ref:sk_hot} → mounted ✓
GET  /sessions/emp-live-1/evolution → mounted:{hot_skill} | roles:[app,data_product,ontology,workflow]
DELETE …/capabilities/hot_skill     → unmounted ✓
POST /sessions/emp-live-1/close     → {"closed":true,"mounted":0,"snapshot_roles":4}  # 快照还原
```

fiber 反应式（mount→active / unmount→deactivated / remount→复激活）由单测矩阵覆盖
（`test_mount_unmount_reactive`），与 MP-COMP-01 内核不变量同源。

## 3. M2 增量（同日收口）

- `POST /sessions/sweep` TTL 清扫端点（幂等可重入，live 通）；evolve.session.opened/closed + capability.mounted/unmounted 审计事件在册；单测扩至 9/9（含 sweep）。原 M2 项「后台清扫调度」以端点 + 访问时惰性过期（get 判 TTL）双路径满足
- M3：进化提案闸（员工提议新技能 → 市场检索/生成 → proposal 人审）+ Marketplace 消费面

## 4. M3 增量（同日收口 · 进化提案闸）

REST 三端点（`POST /sessions/{id}/evolve-proposals` + `/approve` + `/reject`），
**live（经网关）**：提议 `evop-43051213`（批准前 `mounted:{}` 不生效）→ approve →
`mounted:{proposed_skill: sk_p}` 真实挂载；reject 路径终态。FR-008 Marketplace
消费面留 MP-MKT-INSTALL-01。既有 9/9 测试无回归。

## 5. 结论

PRD-01 **M1+M2+M3 收口 → 批次 [x]**：会话级能力热进化（挂载/卸载/反应式/快照还原/REST/live）落地，
kernel `AgentRole` 与全局注册表零改动（只增不改），composition 内核复用无侵入。
