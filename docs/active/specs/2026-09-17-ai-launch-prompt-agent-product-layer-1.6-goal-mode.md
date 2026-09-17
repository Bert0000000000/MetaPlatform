# GOAL 模式启动提示词 —— Agent 产品层 1.6（证据与交付）

> **开工前必读**：`2026-09-16-agent-product-layer-env-facts.md`（踩坑卡）、
> `2026-09-16-agent-product-layer-roadmap.md`、
> **copilot 的 `agent_loop.py::_evidence_items`**（证据形态的既有范式，本批复刻它）。
> 1.0~1.5 已在 main。

你是自主执行工程师。按任务 1→4 推进，每任务**先写 failing tests 再实现**，完成后跑验证并 commit。全部完成后输出报告。判据达不到且继续会破坏时才停下问人。

## GOAL

把 Agent 产品层从"能跑"推进到"**能看、能查、能交付**"：员工工具结果变成**结构化证据**（与既有 copilot 同形）/ 产出物成为**可寻址 Artifact** / agent-team 测试**进 CI 且 required** / 前端升级为**工作台**。

## 锁死决策

- **证据形态复刻 copilot 的 `_evidence_items`**（同形状，**不另造**）——同一平台里"证据"只该有一种样子
- 证据**忠实映射**：只对结果里**真实存在**的字段取证，**取不到就不产出条目**（copilot 既有原则，不许编造）
- **Artifact 必须有落地存储**（MinIO 或 PG，**选一并在代码注释写明理由**），不是内存态
- **CI 门禁必须 required**（不是 `continue-on-error`）——否则等于没进
- 前端**复用既有 Semi 组件与设计系统**，不另造
- **LangChain 类型不得进公开契约**（R10）；**不用 `interrupt()`**；**不用裸 dict 作状态 schema**

## 硬约束

不绕过 13 硬规则；只用 `mate-platform-backend/.venv`，首跑记基线此后不得低于；网络走代理 7897；Conventional Commits + **按文件 add（禁 `git add -A`）**；从 main 开 `feat/agent-product-layer-1.6`；契约先行；中文加 `PYTHONIOENCODING=utf-8`。

## 任务 1 · 证据接线

**现状**：copilot 已有证据范式（本体工具结果 → 结构化条目，随 SSE 外流）；**agent-team 零 `evidence` 概念**。

- 员工工具调用结果 → **与 copilot 同形状**的证据条目
- 随 run 事件流（1.3 SSE + 1.5 尾随）外流

**判据**：员工调本体工具 → 事件流里有**结构化证据**；**取不到字段时不产出条目**（负例，防编造）。

## 任务 2 · 真实 Artifact

**现状**：员工产出只有文本，**零 artifact**。

- 产出物（报告 / 清单 / 表格等）落成**可寻址 artifact**，有落地存储（写明选 MinIO 还是 PG 及理由）

**判据**：一次 run 产出 **≥1 artifact**，**可寻址可取回**。

## 任务 3 · 生产 CI 门禁

**现状**：**agent-team 测试从未进 CI**（CI 只跑 `tests/architecture` 与 `packages/mate-platform`）。

- 纳入 CI **且设为 required**

**判据**：CI 里能看到 agent-team 测试在跑；**人为弄红一个测试 → CI 红**（证明真卡）。

## 任务 4 · 前端工作台

**现状**：只有一个最小页面 `AgentTeamRunPage.tsx`。

- 升级为能看到**任务图 / 员工状态 / 证据 / Artifact / 终态**的工作台；复用既有 Semi 组件

**判据**：浏览器里走完一次 run，四类信息都可见。

## 验证

```bash
cd mate-platform-backend && PYTHONIOENCODING=utf-8 .venv/Scripts/python.exe -m pytest <涉及包>/tests -q
```

既有链路**不得回归**（主链 / 闸门 / 包络四维 / MCP 租户绑定 / 双向消息 / 运行控制 / 重试 / 审计）。

## 报告

任务 1~4 结果 + 回归 + 基线→最终 + commits + PR + 遗留与建议。

## 边界

不接 Claude Code / dsh；不做 A2A / 复杂图；不重写本体引擎 / SkillHub / MCP 中心。
**不改 1.3~1.5 已定语义**（取消幂等、终态 409、越权转 proposal、深度/跨租户硬拒、包络四维、重试幂等边界）。
**不换 LLM 通道**；不让 LangChain 类型漏进契约；不用 `interrupt()`；不用裸 dict 作 schema；建表不用服务角色；断言不用 `meta`；secret 不进 git。
