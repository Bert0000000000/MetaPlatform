# mate-tech-agent-team

**Agent 产品层 1.0** —— 超级大脑 + 数字员工。

> 设计依据：`docs/active/specs/2026-09-16-agent-product-layer-1.0.md`（1.0 定义）
> + `docs/active/decisions/ADR-0066-agent-team-role-config-and-task-scoped-subagents.md`（身份与协同）

## 形态

```
用户一句话
   ↓
超级大脑（langgraph 任务图：拆解 → 并行派活 → HITL 闸门 → 汇总）
   ↓ 派活
数字员工（提示词 + 技能清单 + 工具白名单；真实调 LLM 与工具）
   ↓ 读写
Ontology 本体（走既有 Action/proposal 通道）
```

## 关键约束

| 项 | 做法 |
| --- | --- |
| 租户隔离 | `thread_id = <租户ID>\|<任务ID>` + PG RLS 策略（`app.tenant_id`），不改 langgraph 表结构 |
| 状态 schema | `TypedDict` 显式声明字段；不用裸 dict（裸 dict 会静默丢写入） |
| HITL | 不用 `interrupt()`（会重跑节点）；`update_state(as_node=...)` + `invoke(None, cfg)` |
| 暂停/恢复网络 | 暂停/恢复不产生额外 LLM 调用；已完成节点的调用次数在恢复后不变 |

## 运行

服务端口 **8013**，挂载在 `/api/v1/agent-team/*`。

```bash
cd mate-platform-backend
PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest packages/mate-tech-agent-team/tests -q
```
