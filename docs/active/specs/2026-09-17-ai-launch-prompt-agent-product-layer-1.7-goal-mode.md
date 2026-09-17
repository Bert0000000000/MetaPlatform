# GOAL 模式启动提示词 —— Agent 产品层 1.7（异步化与实时流）

> **开工前必读**：`2026-09-16-agent-product-layer-env-facts.md`（踩坑卡）、
> `2026-09-16-agent-product-layer-roadmap.md`、**1.6 的「剩下的真边界」**。
> 1.0~1.6 已在 main（→ `940a9d7b`）。

你是自主执行工程师。按任务 1→3 推进，每任务**先写 failing tests 再实现**，完成后跑验证并 commit。全部完成后输出报告。判据达不到且继续会破坏时才停下问人。

## GOAL

把"起一轮 run"从**同步阻塞**改成**异步 + 订阅**：`POST /runs` 返回 **202 + run_id**；前端做**实时事件流**；把**分支保护**开起来（且不让路径过滤卡死别的 PR）。

## 锁死决策

- **`POST /runs` 改 202 + run_id** —— **契约变更，契约先行**（硬规则 #1）
- **终态只能从事件流/查询取**——根治 1.6 那个"提交失败其实已建好、重试多跑一轮"的坑
- 前端实时流**不用 `EventSource`**（它**带不了 `Authorization` 头**）——用 `fetch` + `ReadableStream`，消费 1.5 已有的**回放 + 尾随**
- **分支保护必须处理路径过滤**：`python-ci.yml` 有 `paths:` 过滤，直接设 required 会在**不碰后端的 PR 上永远 pending → 死锁**。要么去掉过滤，要么让 job **总是运行、内部快速跳过**
- **1.3~1.6 已定语义别破**（取消幂等、终态 409、越权转 proposal、深度/跨租户硬拒、包络四维、重试幂等、证据形状、Artifact 落 PG）
- **LangChain 类型不得进公开契约**（R10）；**不用 `interrupt()`**；**不用裸 dict 作状态 schema**

## 硬约束

不绕过 13 硬规则；只用 `mate-platform-backend/.venv`，首跑记基线此后不得低于；代理 7897；Conventional Commits + **按文件 add（禁 `git add -A`）**；从 main 开 `feat/agent-product-layer-1.7`；中文加 `PYTHONIOENCODING=utf-8`。**新 operationId 必须同步登记 `docs/active/delivery/REQUIREMENT-MATRIX.yaml`**（CI 双向校验）。

## 任务 1 · `POST /runs` 改异步

**现状**：同步返回（约 60s）→ 前端 30s 默认超时必失败；网关 60s 读超时 → 504，**且 run 其实已建好拿不到 run_id**（重试一次多跑一轮）。

- 改 **202 + run_id**；契约先行；按服务放宽超时的补丁可回退

**判据**：提交**立即**返回 run_id；订阅事件流能拿终态；**重复提交不产生重复 run**。

## 任务 2 · 前端实时事件流

**现状**：前端**无 SSE**。

- 用 **`fetch` + `ReadableStream`**（**不用 `EventSource`**）消费同一份事件流，复用**回放 + 尾随**
- 工作台实时刷新：任务图 / 员工状态 / 证据 / Artifact / 终态

**判据**：浏览器起 run → **步骤实时出现** → 终态自动收尾；**无长轮询**。

## 任务 3 · 分支保护

**现状**：`main` **无保护**（无 required checks）。

- 开分支保护 + required checks；**先解决路径过滤死锁**

**判据**：required 生效且**不碰后端的 PR 不被卡死**——构造**只改文档的 PR** 验证它不永远 pending。

## 验证

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest <涉及包>/tests -q
```

既有链路**不得回归**（主链 / 闸门 / 包络四维 / MCP 租户绑定 / 双向消息 / 运行控制 / 重试 / 证据 / Artifact / 审计）。
CI 改动沿用 1.6 做法：**人为弄红一次验证真卡**，随后 revert。

## 报告

任务 1~3 结果 + 回归 + 基线→最终 + commits + PR + 遗留与建议。

## 边界

不接 Claude Code / dsh；不做 A2A / 复杂图 / 主图重规划（→ 1.8+）；不重写本体引擎 / SkillHub / MCP 中心。
不换 LLM 通道；不让 LangChain 类型漏进契约；不用 `interrupt()`；不用裸 dict 作 schema；建表不用服务角色；断言不用 `meta`；secret 不进 git。
