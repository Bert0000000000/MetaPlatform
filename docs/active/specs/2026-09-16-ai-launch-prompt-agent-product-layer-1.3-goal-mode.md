# GOAL 模式启动提示词 —— Agent 产品层 1.3

> **开工前必读**：`2026-09-16-agent-product-layer-env-facts.md`（踩坑卡）、
> `2026-09-16-agent-product-layer-roadmap.md`、ADR-0066 §3.3/§3.4/§5.5。
> 1.0/1.1/1.2 已在 main（PR #41/#43/#44）。

你是自主执行工程师。**三条轨互不阻塞，能并行就并行**；每条轨先写 failing tests 再实现，完成后跑验证并 commit。全部完成后输出报告。判据达不到且继续会破坏时才停下问人。

## GOAL

**轨 1 · 派活加固**：把 1.1 **建好却没接上**的权限闸门接到真实派活路径（现在是"假安心"）+ 让 `depends_on` 真正执行。
**轨 2 · 运行控制面**：动态员工创建入口 + 取消/超时 + Run 事件流。
**轨 3 · 交付面**：容器重建，让 8013 跑最新镜像。

## 锁死决策

- **用户包络从「发起用户令牌的角色/标记」解析**——这才是 ADR-0066「包络链根 = 发起用户」
- 闸门**只加在派活入口**（`TeamBus`），不散落各调用点
- **越权 → 转 proposal**（不是 403）；**深度超限 / 跨租户 → 硬拒**
- 动态员工用现有 `profile_store.upsert`（PG 已实现），只补 API 面与契约
- **LangChain 类型不得进公开契约**（ADR-0066 R10）
- **不用 `interrupt()`**；**不用裸 dict 作状态 schema**
- 不动 13 硬规则；不换 LLM 通道

## 并行纪律（关键，先读）

| 轨 | 只许碰 | 与谁并行 |
|---|---|---|
| 1 | core：`graph.py` `team_bus.py` `brain.py` `planner.py` `llm_planner.py` `state.py` `authority.py` | 与 2、3 **零文件交集** |
| 2 | API 面：`api/app.py` + `contracts/` | 与 1、3 零交集 |
| 3 | `Dockerfile` / compose / 网关路由 | 独立 |

**若要多会话真并行**：各自 worktree，**按轨提交**，避免混提。

## 轨 1 · 派活加固

**现状**：`graph.py:85` worker 直接 `runtime.run(subtask, tenant)`，**绕过 `TeamBus`** → 1.1 的权限包络衰减与深度闸门**空转**（员工工具白名单仍在生效，缺的是"profile 权限 ⊆ 发起用户"与深度上限）。

1. **解析发起用户包络**（从令牌角色/标记）
2. **派活改走 `TeamBus`**（闸门在那里判）
3. 越权 → 转 proposal（授权只限本次任务）；深度超限 / 跨租户 → 硬拒
4. **`depends_on` 真正执行**：planner 填它 + 图按依赖分组（现在的 `depends_on=[]` 是硬编码，图也从不读）

**判据**：越权派活转 proposal；跨租户硬拒；深度超限硬拒；`depends_on` 生效（有依赖的节点必须后跑）；既有链路不回归。

## 轨 2 · 运行控制面

1. **动态员工入口**：`POST` / `PUT /profiles`（`profile_store.upsert` 已有）+ OpenAPI 契约
2. **取消**：`POST /runs/{run_id}/cancel`
3. **超时**：运行级超时 → 落入终态（不是挂着）
4. **事件流**：`GET /runs/{run_id}/events`（SSE，步骤级事件）

**判据**：建员工 → 重启仍在（且跨租户不可见）；取消后终态；超时后终态；SSE 能收到步骤事件；**跨租户负例**。

## 轨 3 · 交付面

容器重建，让 8013 跑最新镜像；端到端冒烟。
**判据**：容器内 8013 走完一条主链。

## 验证

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest <涉及包>/tests -q
```

每轨各自的端到端 + 既有链路**不得回归**（主链 / 权限闸门 / 深度闸门 / MCP 对外租户绑定 / 双向消息）。

## 报告

三轨各自结果 + 回归 + 基线→最终 + commits + PR + 遗留与建议。

## 边界

不接 Claude Code / dsh；不做沙箱分级 / 复杂图 / A2A 外联；不重写本体引擎 / SkillHub / MCP 中心。
**不换 LLM 通道**；**不让 LangChain 类型漏进公开契约**。
不用 `interrupt()`；不用裸 dict 作状态 schema；建表不用服务角色（RLS 静默失效）；隔离断言不用 `meta`（假通过）；secret 不进 git。
