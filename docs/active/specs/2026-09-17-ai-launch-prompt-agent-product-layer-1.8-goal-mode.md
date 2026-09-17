# GOAL 模式启动提示词 —— Agent 产品层 1.8（三轨并行）

> **开工前必读**：`2026-09-16-agent-product-layer-env-facts.md`（踩坑卡）、ADR-0066 §5.8（RuntimeKind 与 Projection）。
> 1.0~1.7 已在 main（→ `6ff46528`）。

你是自主执行工程师。**三轨能并行就并行**；每轨先写 failing tests 再实现，完成后跑验证并 commit。全部完成后输出报告。判据达不到且继续会破坏时才停下问人。

## GOAL

- **轨 1 可靠**：后台执行**脱离进程内事件循环**（现在进程重启在途 run 就停住）
- **轨 2 外联**：接**一个**外部 runtime（Claude Code 或 dsh，选一）+ **A2A 外联**打通
- **轨 3 编排**：**主图能重规划**（现在一次定型）+ 复杂图最小形态

## 锁死决策

- **轨 1**：在途 run 必须**可恢复**——重启后能续跑到终态；run 状态**以检查点为准**，不另建真相
- **轨 2**：**只接一个**外部 runtime（写明选型理由）；走 **Projection 下放**（角色/技能/工具面下发 + 读回结果），**不是把外部 CLI 当黑盒调**
- **轨 3**：重规划必须在**同一 run 内**（按结果再规划），不破「不用 `interrupt()`」与既有 HITL 语义
- **1.3~1.7 已定语义别破**（取消幂等 / 终态 409 / 越权转 proposal / 深度与跨租户硬拒 / 包络四维 / 重试幂等 / 证据 / Artifact / 202 受理 / SSE）
- **LangChain 类型不得进公开契约**（R10）；**不用 `interrupt()`**；**不用裸 dict 作状态 schema**

## 并行纪律（关键）

| 轨 | **只许碰** |
|---|---|
| 1 可靠 | `api/run_control.py` · `main.py` · `checkpoint.py` |
| 2 外联 | 新模块 `runtimes/` · `a2a/` · `wiring.py` · `profiles.py` |
| 3 编排 | `graph.py` · `llm_planner.py` · `planner.py` · `state.py` |

**三轨零文件交集**。多会话真并行就各开 worktree，按轨提交。

## 硬约束

不绕过 13 硬规则；只用 `mate-platform-backend/.venv`，首跑记基线此后不得低于；代理 7897；Conventional Commits + **按文件 add（禁 `git add -A`）**；从 main 开 `feat/agent-product-layer-1.8`；**契约先行**；中文加 `PYTHONIOENCODING=utf-8`。**新 operationId 同步登记 `REQUIREMENT-MATRIX.yaml`**。

## 轨 1 · 后台执行可恢复

**现状**：`api/run_control.py` 用 `asyncio.create_task` 在**进程内**跑后台执行 → 进程重启在途 run 停住。

在途 run 在重启后**续跑**（启动扫未完成 run / 或持久化调度）；**不另建 run 真相**。
**判据**：起 run → **执行中重启进程** → **续跑到终态**；已完成的不重跑。

## 轨 2 · 外联

外部 runtime 按 `RuntimeKind` + Projection **下放角色/技能/工具面**并读回结果；A2A 打通（注意 A2A `Task` **无父子/深度**、终态不能续发消息，如实处理）。
**判据**：外部 runtime 被派活并返回**真实结果**；**跨租户负例**；A2A 有可复现证据。

## 轨 3 · 编排深度

主图**能重规划**（同一 run 内按中间结果再规划）；复杂图**只做最小形态**（有界回环；嵌套子图无真需求可不做，写明理由）。
**判据**：构造"首轮规划不够、需再规划"的场景 → **同一 run 内重规划完成**；既有链路不回归。

## 验证

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest <涉及包>/tests -q
```

既有链路**不得回归**（主链 / 闸门 / 包络四维 / MCP 租户绑定 / 双向消息 / 运行控制 / 重试 / 证据 / Artifact / 审计 / SSE）。

## 报告

三轨结果 + 回归 + 基线→最终 + commits + PR + 遗留。

## 边界

不重写本体引擎 / SkillHub / MCP 中心；只接一个外部 runtime（另一个留 1.9+）。
不换 LLM 通道；不让 LangChain 类型漏进契约；不用 `interrupt()`；不用裸 dict 作 schema；建表不用服务角色；断言不用 `meta`；secret 不进 git。
